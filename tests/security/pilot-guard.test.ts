import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { Server as HttpServer } from 'node:http';
import {
  assertPilotConfiguration,
  isPilotMode,
  pilotCaptureEnabled,
  pilotClientHeaders,
  pilotHttpGate,
  validatePilotEvents,
  validatePilotManualMemory
} from '../../src/services/security/PilotGuard.js';
import { buildNormalizedEvent } from '../../src/services/platform/normalization.js';

const variables = [
  'CLAUDE_MEM_PILOT_MODE',
  'CLAUDE_MEM_PILOT_ALLOW_DIRS',
  'CLAUDE_MEM_PILOT_TOKEN',
  'CLAUDE_MEM_PILOT_CAPTURE_ENABLED',
  'CLAUDE_MEM_PILOT_EXPIRES_AT',
  'CLAUDE_MEM_DATA_DIR'
];
const originals = new Map(variables.map(key => [key, process.env[key]]));
let tmp: string;
let approved: string;
let rejected: string;
let dataDir: string;

function event(text = 'Synthetic worker memory marker') {
  return buildNormalizedEvent({
    platform: 'codex',
    clientKind: 'codex-cli',
    captureMode: 'notify',
    platformSessionId: 'synthetic-thread',
    cwd: approved,
    repoRoot: approved,
    project: basename(approved),
    eventType: 'prompt.submitted',
    createdAtEpochMs: Date.now(),
    privacyState: 'normal',
    sourceConfidence: 'medium',
    captureFidelity: 'low',
    promptText: text,
    payload: { text }
  });
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'codex-mem-pilot-guard-'));
  approved = join(tmp, 'synthetic-repository');
  rejected = join(tmp, 'unapproved-project');
  dataDir = join(tmp, 'private-memory');
  [approved, rejected, dataDir].forEach(dir => mkdirSync(dir, { recursive: true }));
  writeFileSync(join(dataDir, '.synthetic-pilot-allow'), 'SYNTHETIC_ONLY');
  process.env.CLAUDE_MEM_PILOT_MODE = 'true';
  process.env.CLAUDE_MEM_PILOT_ALLOW_DIRS = JSON.stringify([approved]);
  process.env.CLAUDE_MEM_PILOT_TOKEN = randomBytes(32).toString('hex');
  process.env.CLAUDE_MEM_PILOT_CAPTURE_ENABLED = 'true';
  process.env.CLAUDE_MEM_PILOT_EXPIRES_AT = new Date(Date.now() + 86400000).toISOString();
  process.env.CLAUDE_MEM_DATA_DIR = dataDir;
});

afterEach(() => {
  for (const key of variables) {
    const original = originals.get(key);
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
  rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe('Pilot opt-in and storage boundary', () => {
  it('is disabled by default and does not change existing behavior', () => {
    delete process.env.CLAUDE_MEM_PILOT_MODE;
    expect(isPilotMode()).toBe(false);
    expect(validatePilotEvents([event()]).allowed).toBe(true);
    expect(pilotClientHeaders()).toEqual({});
  });

  it('fails closed without a strong bearer token or without an allowlist', () => {
    assertPilotConfiguration();
    process.env.CLAUDE_MEM_PILOT_TOKEN = 'short';
    expect(() => assertPilotConfiguration()).toThrow('at least 32');
    process.env.CLAUDE_MEM_PILOT_TOKEN = randomBytes(32).toString('hex');
    process.env.CLAUDE_MEM_PILOT_ALLOW_DIRS = '[]';
    expect(() => assertPilotConfiguration()).toThrow('exactly one');
  });

  it('requires a synthetic-only database marker and short-lived lease', () => {
    expect(() => assertPilotConfiguration()).not.toThrow();
    rmSync(join(dataDir, '.synthetic-pilot-allow'));
    expect(() => assertPilotConfiguration()).toThrow('not marked');
    writeFileSync(join(dataDir, '.synthetic-pilot-allow'), 'SYNTHETIC_ONLY');
    process.env.CLAUDE_MEM_PILOT_EXPIRES_AT = new Date(Date.now() - 1000).toISOString();
    expect(() => assertPilotConfiguration()).toThrow('seven days');
    process.env.CLAUDE_MEM_PILOT_EXPIRES_AT = new Date(Date.now() + 8 * 86400000).toISOString();
    expect(() => assertPilotConfiguration()).toThrow('seven days');
  });

  it('does not allow the data store to overlap an approved project', () => {
    process.env.CLAUDE_MEM_DATA_DIR = approved;
    writeFileSync(join(approved, '.synthetic-pilot-allow'), 'SYNTHETIC_ONLY');
    expect(() => assertPilotConfiguration()).toThrow('must not overlap');
  });

  it('accepts only events from the exact approved root', () => {
    expect(validatePilotEvents([event()]).allowed).toBe(true);
    expect(validatePilotEvents([{ ...event(), repoRoot: rejected }]).allowed).toBe(false);
    expect(validatePilotEvents([{ ...event(), cwd: rejected }]).allowed).toBe(false);
    expect(validatePilotEvents([{ ...event(), project: 'other' }]).allowed).toBe(false);
    expect(validatePilotEvents([{ ...event(), repoRoot: undefined }]).allowed).toBe(false);
  });

  it('rejects common synthetic secrets and personal identifiers before storage', () => {
    const prohibited = [
      'This is a dummy sk-' + 'proj-FAKE_TEST_VALUE not an actual key',
      'Synthetic gh' + 'p_ABCDEFGHIJKLMNOPQRSTUVWX',
      'Authorization: Bearer syntheticExampleToken',
      'password = test-password',
      '{"api_key":"synthetic-fake-value"}',
      '{"client_secret":"synthetic-only"}',
      'Test only: person@example.test',
      'Test synthetic IBAN BE00000000000000',
      '-----BEGIN OPENSSH PRIVATE KEY-----',
      'AK' + 'IAABCDEFGHIJKLMNOP'
    ];
    for (const [index, string] of prohibited.entries()) {
      const outcome = validatePilotEvents([event(string)]);
      if (outcome.allowed) throw new Error('Sensitive synthetic fixture was accepted: #' + index);
      expect(outcome.allowed).toBe(false);
    }
  });

  it('rejects its own randomly generated bearer token if exposed in captured text', () => {
    expect(validatePilotEvents([event('Accidental token value: ' + process.env.CLAUDE_MEM_PILOT_TOKEN)]).allowed).toBe(false);
  });

  it('rejects invalid batches atomically and large records', () => {
    expect(validatePilotEvents([event('fine'), event('person@example.test')]).allowed).toBe(false);
    expect(validatePilotEvents([event('A'.repeat(70000))]).allowed).toBe(false);
    expect(validatePilotEvents(Array.from({ length: 51 }, () => event())).allowed).toBe(false);
  });

  it('kills capture at once without restarting the worker', () => {
    expect(pilotCaptureEnabled().allowed).toBe(true);
    writeFileSync(join(dataDir, 'pilot.stop'), 'stop', 'utf8');
    expect(existsSync(join(dataDir, 'pilot.stop'))).toBe(true);
    const denied = pilotCaptureEnabled();
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.status).toBe(423);
  });

  it('requires explicit capture-enabled=true and manual-memory project scope', () => {
    const good = { cwd: approved, project: basename(approved), text: 'Synthetic decision 42' };
    expect(validatePilotManualMemory(good).allowed).toBe(true);
    expect(validatePilotManualMemory({ ...good, cwd: rejected }).allowed).toBe(false);
    expect(validatePilotManualMemory({ ...good, text: 'person@example.test' }).allowed).toBe(false);
    delete process.env.CLAUDE_MEM_PILOT_CAPTURE_ENABLED;
    expect(validatePilotManualMemory(good).allowed).toBe(false);
  });
});

describe('Pilot HTTP authentication and endpoint restrictions', () => {
  let server: HttpServer | null = null;

  async function start() {
    const app = express();
    app.use(pilotHttpGate);
    app.use(express.json());
    app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
    app.get('/api/search', (_req, res) => res.json({ matches: ['synthetic'] }));
    app.post('/api/events/batch', (_req, res) => res.json({ accepted: true }));
    app.get('/api/projects', (_req, res) => res.json({ projects: ['should-not-leak'] }));
    server = await new Promise<HttpServer>(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Invalid listener');
    return 'http://127.0.0.1:' + address.port;
  }

  afterEach(async () => {
    if (server) {
      const previous = server;
      server = null;
      await new Promise<void>((resolve, reject) =>
        previous.close(error => error ? reject(error) : resolve()));
    }
  });

  it('protects searches and ingestion, while leaving only health public', async () => {
    const url = await start();
    expect((await fetch(url + '/api/health')).status).toBe(200);
    expect((await fetch(url + '/api/search?project=' + basename(approved))).status).toBe(401);
    const headers = pilotClientHeaders();
    expect((await fetch(url + '/api/search?project=' + basename(approved), { headers })).status).toBe(200);
    expect((await fetch(url + '/api/search?project=other', { headers })).status).toBe(403);
    expect((await fetch(url + '/api/projects', { headers })).status).toBe(403);
    expect((await fetch(url + '/api/search?project=' + basename(approved), {
      headers: { ...headers, Origin: 'https://example.invalid' }
    })).status).toBe(403);
    expect((await fetch(url + '/api/events/batch', {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [] })
    })).status).toBe(200);
  });

  it('rejects a wrong token without reflecting it', async () => {
    const url = await start();
    const response = await fetch(url + '/api/search?project=' + basename(approved), {
      headers: { Authorization: 'Bearer ' + 'z'.repeat(64) }
    });
    expect(response.status).toBe(401);
    expect((await response.text()).includes('zzzz')).toBe(false);
  });
});
