#!/usr/bin/env node
/**
 * AES-256-GCM encrypted backup proof for a disposable Codex-Mem synthetic
 * retention candidate. Deliberately not a production backup or key escrow tool.
 *
 * Encrypts ONLY a prepared candidate, never the live source database.
 * Decrypts ONLY into a new restore-test file, never over an existing SQLite DB.
 * The randomly generated 256-bit key is provided via a process environment
 * variable and is never printed, persisted or accepted as a CLI argument.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import {
  closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync,
  realpathSync, rmSync, writeSync
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { homedir } from 'node:os';

const MAGIC = Buffer.from('CMEM_SYNTHETIC_V1\n', 'utf8');
const AAD = Buffer.from('codex-mem-synthetic-backup-only-v1', 'utf8');
const MAX_SIZE = 64 * 1024 * 1024;
const SQLITE_MAGIC = Buffer.from('SQLite format 3\0', 'binary');
const KEY_VARIABLE = 'CODEX_MEM_PILOT_KEY_HEX';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function ownRealDirectory(value, name) {
  assert(typeof value === 'string' && isAbsolute(value), name + ' must be absolute');
  assert(existsSync(value) && !lstatSync(value).isSymbolicLink(), name + ' is absent or a symlink');
  const canonical = realpathSync(value);
  assert(lstatSync(canonical).isDirectory(), name + ' must be a directory');
  return canonical;
}
function within(parent, child) {
  const rem = relative(parent, child);
  return rem === '' || (rem !== '..' && !rem.startsWith('..' + sep) && !isAbsolute(rem));
}
function nameSafe(value, extension) {
  assert(typeof value === 'string' && value.endsWith(extension) &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value) &&
    value !== '.' && value !== '..',
    'Unsafe output/input filename');
  return value;
}
function readMarker(dir, file) {
  const marker = join(dir, file);
  assert(existsSync(marker) && !lstatSync(marker).isSymbolicLink(),
    'Synthetic-only marker missing');
  assert(readFileSync(marker, 'utf8').trim() === 'SYNTHETIC_ONLY',
    'Synthetic-only marker invalid');
}
function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
function scope(args) {
  const dataDir = ownRealDirectory(args['data-dir'], 'Pilot data directory');
  const project = ownRealDirectory(args['project-dir'], 'Synthetic project');
  assert(/^synthetic-|^fixture-/i.test(basename(project)), 'Project name must denote synthetic fixture');
  readMarker(dataDir, '.synthetic-pilot-allow');
  readMarker(project, '.synthetic-fixture-only');
  const defaultDir = resolve(homedir(), '.claude-mem');
  assert(resolve(dataDir) !== defaultDir, 'Default user memory database is not allowed');
  assert(!within(project, dataDir) && !within(dataDir, project),
    'Project and data directories may not overlap');
  assert(existsSync(join(dataDir, 'pilot.stop')),
    'pilot.stop required; do not snapshot while pilot capture is active');
  return dataDir;
}
function keyFromEnv() {
  const hex = process.env[KEY_VARIABLE] || '';
  assert(/^[a-f0-9]{64}$/i.test(hex),
    'Missing valid 256-bit encryption key in process environment');
  return Buffer.from(hex, 'hex');
}
function parse(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 2) {
    const arg = argv[i];
    assert(arg?.startsWith('--') && i + 1 < argv.length, 'Arguments must be --key value pairs');
    const key = arg.slice(2);
    assert(['mode', 'data-dir', 'project-dir', 'input-name', 'output-name', 'ack'].includes(key),
      'Unsupported argument');
    assert(a[key] === undefined, 'Duplicate argument');
    a[key] = argv[i + 1];
  }
  assert(a.mode === 'encrypt' || a.mode === 'restore', 'mode must be encrypt or restore');
  assert(a.ack === 'SYNTHETIC_ENCRYPTION_TEST_ONLY', 'Explicit synthetic approval required');
  return a;
}
function assertExistingInput(parent, inputName, extension) {
  const folder = ownRealDirectory(parent, 'Input folder');
  const candidate = join(folder, nameSafe(inputName, extension));
  assert(existsSync(candidate) && !lstatSync(candidate).isSymbolicLink(),
    'Input is missing or is a symlink');
  assert(lstatSync(candidate).isFile(), 'Input must be a regular file');
  assert(lstatSync(candidate).size > 0 && lstatSync(candidate).size <= MAX_SIZE,
    'Input size exceeds synthetic proof limit');
  assert(dirname(realpathSync(candidate)) === folder, 'Input escaped expected synthetic folder');
  return candidate;
}
function exclusiveWrite(file, bytes) {
  let fd;
  let created = false;
  try {
    fd = openSync(file, 'wx', 0o600);
    created = true;
    let offset = 0;
    while (offset < bytes.length) {
      offset += writeSync(fd, bytes, offset, bytes.length - offset);
    }
  } catch (error) {
    if (fd !== undefined) { closeSync(fd); fd = undefined; }
    if (created) rmSync(file, { force: true });
    throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
function encrypt(dataDir, args, key) {
  const input = assertExistingInput(join(dataDir, 'retention-candidates'), args['input-name'], '.sqlite');
  const plaintext = readFileSync(input);
  try {
    assert(plaintext.subarray(0, SQLITE_MAGIC.length).equals(SQLITE_MAGIC),
      'Candidate must be a SQLite database');
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(AAD);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const envelope = Buffer.concat([MAGIC, nonce, tag, encrypted]);
    const folder = join(dataDir, 'encrypted-backups');
    if (!existsSync(folder)) mkdirSync(folder, { mode: 0o700 });
    assert(!lstatSync(folder).isSymbolicLink(), 'Unsafe backup destination folder');
    const dest = join(folder, nameSafe(args['output-name'], '.cmem'));
    exclusiveWrite(dest, envelope);
    return {
      mode: 'encrypted_synthetic_backup',
      input_sha256: sha256(plaintext),
      output_sha256: sha256(envelope),
      bytes_encrypted: plaintext.length,
      output: dest,
      authentication: 'AES-256-GCM',
      warning: 'Proof only. Key escrow and recovery policy are NOT implemented.'
    };
  } finally {
    plaintext.fill(0);
  }
}
function restore(dataDir, args, key) {
  const input = assertExistingInput(join(dataDir, 'encrypted-backups'), args['input-name'], '.cmem');
  const bytes = readFileSync(input);
  const head = bytes.subarray(0, MAGIC.length);
  assert(head.equals(MAGIC) && bytes.length > MAGIC.length + 12 + 16,
    'Invalid encrypted synthetic backup header');
  const nonce = bytes.subarray(MAGIC.length, MAGIC.length + 12);
  const tag = bytes.subarray(MAGIC.length + 12, MAGIC.length + 28);
  const ciphertext = bytes.subarray(MAGIC.length + 28);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);
  let plaintext;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    assert(plaintext.subarray(0, SQLITE_MAGIC.length).equals(SQLITE_MAGIC),
      'Authenticated output is not SQLite');
    const folder = join(dataDir, 'restore-tests');
    if (!existsSync(folder)) mkdirSync(folder, { mode: 0o700 });
    assert(!lstatSync(folder).isSymbolicLink(), 'Unsafe restore destination folder');
    const dest = join(folder, nameSafe(args['output-name'], '.sqlite'));
    exclusiveWrite(dest, plaintext);
    return {
      mode: 'synthetic_restore_test',
      input_sha256: sha256(bytes),
      restored_sha256: sha256(plaintext),
      output: dest,
      protection: 'authenticated decrypt; no source database overwritten',
      warning: 'Proof only. Active SQLite storage remains plaintext.'
    };
  } finally {
    plaintext?.fill(0);
  }
}
function main() {
  let key;
  try {
    const args = parse(process.argv.slice(2));
    const dataDir = scope(args);
    key = keyFromEnv();
    const result = args.mode === 'encrypt' ? encrypt(dataDir, args, key) : restore(dataDir, args, key);
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (error) {
    process.stderr.write(JSON.stringify({ok:false, error:error.message}) + '\n');
    process.exitCode = 2;
  } finally {
    key?.fill(0);
  }
}
main();
