'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const script = join(__dirname, '..', '..', 'tools', 'pilots', 'codex_mem_synthetic_crypto.mjs');
const ACK = 'SYNTHETIC_ENCRYPTION_TEST_ONLY';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'codex-mem-crypto-'));
  const project = join(root, 'synthetic-project');
  const data = join(root, 'isolated-data');
  const candidates = join(data, 'retention-candidates');
  mkdirSync(project);
  mkdirSync(candidates, { recursive: true });
  writeFileSync(join(project, '.synthetic-fixture-only'), 'SYNTHETIC_ONLY');
  writeFileSync(join(data, '.synthetic-pilot-allow'), 'SYNTHETIC_ONLY');
  writeFileSync(join(data, 'pilot.stop'), 'stopped');
  const marker = 'FICTIONAL-ENCRYPTION-CANARY';
  const plain = Buffer.concat([
    Buffer.from('SQLite format 3\0', 'binary'),
    Buffer.from(marker.repeat(35), 'utf8')
  ]);
  const db = join(candidates, 'candidate.sqlite');
  writeFileSync(db, plain);
  return {
    root, project, data, marker, plain, db,
    key: randomBytes(32).toString('hex'),
    cleanup() { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); }
  };
}

function call(f, mode, input, output, options={}) {
  const args = [
    script,
    '--mode', mode,
    '--data-dir', f.data,
    '--project-dir', f.project,
    '--input-name', input,
    '--output-name', output,
    '--ack', options.ack || ACK
  ];
  if (options.extra) args.push(...options.extra);
  const env = {...process.env};
  delete env.CODEX_MEM_PILOT_KEY_HEX;
  if (options.key !== null) env.CODEX_MEM_PILOT_KEY_HEX = options.key || f.key;
  const run = spawnSync(process.execPath, args, {
    env, encoding: 'utf8', timeout: 10000, maxBuffer: 20000,
    windowsHide: true
  });
  return { status:run.status, stdout:run.stdout||'', stderr:run.stderr||'' };
}
function assertDenied(run) {
  assert.equal(run.status, 2, run.stderr);
  assert.equal(run.stdout.trim(), '');
  assert.ok(run.stderr.includes('"ok":false'));
}

test('synthetic encrypted snapshot round-trips with authenticated decryption', () => {
  const f = fixture();
  try {
    const encrypted = call(f,'encrypt','candidate.sqlite','candidate.cmem');
    assert.equal(encrypted.status,0,encrypted.stderr);
    const container=join(f.data,'encrypted-backups','candidate.cmem');
    const cipher=readFileSync(container);
    assert.ok(cipher.length>100);
    assert.ok(!cipher.includes(Buffer.from(f.marker)));
    assert.ok(cipher.subarray(0,18).toString('utf8').startsWith('CMEM_SYNTHETIC_V1'));
    assert.equal(statSync(f.db).size,f.plain.length);
    assert.equal(readFileSync(f.db).toString('hex'),f.plain.toString('hex'));
    const restore=call(f,'restore','candidate.cmem','restored.sqlite');
    assert.equal(restore.status,0,restore.stderr);
    const restored=join(f.data,'restore-tests','restored.sqlite');
    assert.deepEqual(readFileSync(restored), f.plain);
  } finally { f.cleanup(); }
});

test('bad key or tampered ciphertext must fail authentication with no restore artifact', () => {
  const f = fixture();
  try {
    assert.equal(call(f,'encrypt','candidate.sqlite','sample.cmem').status,0);
    assertDenied(call(f,'restore','sample.cmem','wrong.sqlite',{
      key:randomBytes(32).toString('hex')
    }));
    assert.ok(!existsSync(join(f.data,'restore-tests','wrong.sqlite')));
    const file=join(f.data,'encrypted-backups','sample.cmem');
    const bytes=readFileSync(file);
    bytes[bytes.length-1] ^= 0xff;
    writeFileSync(file,bytes);
    assertDenied(call(f,'restore','sample.cmem','tampered.sqlite'));
    assert.ok(!existsSync(join(f.data,'restore-tests','tampered.sqlite')));
  } finally { f.cleanup(); }
});

test('refuse overwrites and preserve first encrypted backup', () => {
  const f = fixture();
  try {
    assert.equal(call(f,'encrypt','candidate.sqlite','sample.cmem').status,0);
    const encrypted=join(f.data,'encrypted-backups','sample.cmem');
    const original=readFileSync(encrypted);
    assertDenied(call(f,'encrypt','candidate.sqlite','sample.cmem'));
    assert.deepEqual(readFileSync(encrypted),original);
    assert.equal(call(f,'restore','sample.cmem','out.sqlite').status,0);
    const restored=join(f.data,'restore-tests','out.sqlite');
    assertDenied(call(f,'restore','sample.cmem','out.sqlite'));
    assert.deepEqual(readFileSync(restored),f.plain);
  } finally { f.cleanup(); }
});

test('missing key, malformed key, or missing explicit acknowledgement is denied', () => {
  const f = fixture();
  try {
    assertDenied(call(f,'encrypt','candidate.sqlite','example.cmem',{key:null}));
    assertDenied(call(f,'encrypt','candidate.sqlite','example.cmem',{key:'12345'}));
    assertDenied(call(f,'encrypt','candidate.sqlite','example.cmem',{ack:'invalid'}));
    assert.ok(!existsSync(join(f.data,'encrypted-backups','example.cmem')));
  } finally { f.cleanup(); }
});

test('refuse non-synthetic scopes and removal of capture stop sentinel', () => {
  const f = fixture();
  try {
    rmSync(join(f.data,'pilot.stop'));
    assertDenied(call(f,'encrypt','candidate.sqlite','sample.cmem'));
    writeFileSync(join(f.data,'pilot.stop'),'stop');
    rmSync(join(f.project,'.synthetic-fixture-only'));
    assertDenied(call(f,'encrypt','candidate.sqlite','sample.cmem'));
    writeFileSync(join(f.project,'.synthetic-fixture-only'),'SYNTHETIC_ONLY');
    rmSync(join(f.data,'.synthetic-pilot-allow'));
    assertDenied(call(f,'encrypt','candidate.sqlite','sample.cmem'));
  } finally { f.cleanup(); }
});

test('deny traversal, extension confusion and duplicate parameters', () => {
  const f = fixture();
  try {
    for (const input of ['../candidate.sqlite', 'candidate.cmem', '.hidden.sqlite']) {
      assertDenied(call(f,'encrypt',input,'out.cmem'));
    }
    for (const output of ['../escape.cmem','child/name.cmem','out.sqlite']) {
      assertDenied(call(f,'encrypt','candidate.sqlite',output));
    }
    assertDenied(call(f,'encrypt','candidate.sqlite','out.cmem',{extra:['--mode','restore']}));
    assert.ok(!existsSync(join(f.root,'escape.cmem')));
  } finally { f.cleanup(); }
});

test('fresh nonces generate distinct encrypted content for the same synthetic input', () => {
  const f = fixture();
  try {
    assert.equal(call(f,'encrypt','candidate.sqlite','first.cmem').status,0);
    assert.equal(call(f,'encrypt','candidate.sqlite','second.cmem').status,0);
    const first=readFileSync(join(f.data,'encrypted-backups','first.cmem'));
    const second=readFileSync(join(f.data,'encrypted-backups','second.cmem'));
    assert.notDeepEqual(first,second);
  } finally { f.cleanup(); }
});
