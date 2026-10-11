/**
 * Fail-closed, opt-in pilot boundary for a dedicated synthetic SQLite sandbox.
 * This is not a comprehensive DLP scanner or a production IAM system.
 */
import { timingSafeEqual } from 'node:crypto';
import { existsSync, realpathSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import type { NormalizedEvent } from '../platform/types.js';

export type PilotDecision =
  | { allowed: true }
  | { allowed: false; status: number; reason: string };

const PASS: PilotDecision = { allowed: true };
const MAX_EVENT_BYTES = 65536;
const MAX_BATCH_SIZE = 50;
const REJECTED = {
  scope: { allowed: false, status: 403, reason: 'Project is not allowed in the isolated pilot' },
  secret: { allowed: false, status: 422, reason: 'Potential private information detected; event not stored' },
  stopped: { allowed: false, status: 423, reason: 'Pilot capture is disabled' },
  configuration: { allowed: false, status: 503, reason: 'Pilot security configuration is invalid' },
  size: { allowed: false, status: 413, reason: 'Pilot input exceeds the permitted size' }
} as const;

export function isPilotMode(): boolean {
  return process.env.CLAUDE_MEM_PILOT_MODE === 'true';
}

function canonicalPath(raw: string): string {
  if (!raw || !isAbsolute(raw)) throw new Error('Pilot paths must be absolute');
  const canonical = realpathSync(resolve(raw));
  if (!statSync(canonical).isDirectory()) throw new Error('Pilot path is not a directory');
  return canonical;
}

function samePath(left: string, right: string): boolean {
  const norm = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value;
  return norm(left) === norm(right);
}

function insidePath(root: string, candidate: string): boolean {
  const remainder = relative(root, candidate);
  return remainder === '' || (
    remainder !== '..' &&
    !remainder.startsWith('..' + sep) &&
    !isAbsolute(remainder)
  );
}

function pilotRoots(): string[] {
  const raw = process.env.CLAUDE_MEM_PILOT_ALLOW_DIRS;
  if (!raw) throw new Error('Pilot allowlist is required');
  const paths: unknown = JSON.parse(raw);
  // One synthetic project per pilot to avoid cross-project exposure.
  if (!Array.isArray(paths) || paths.length !== 1 || typeof paths[0] !== 'string') {
    throw new Error('Pilot requires exactly one approved directory');
  }
  return [canonicalPath(paths[0])];
}

function pilotDataDir(): string {
  const raw = process.env.CLAUDE_MEM_DATA_DIR;
  if (!raw) throw new Error('A separate pilot data directory is required');
  const dataDir = canonicalPath(raw);
  // An explicit marker prevents accidental use of the normal memory database.
  if (!existsSync(join(dataDir, '.synthetic-pilot-allow'))) {
    throw new Error('Data directory is not marked for synthetic-only pilot use');
  }
  for (const root of pilotRoots()) {
    if (insidePath(root, dataDir) || insidePath(dataDir, root)) {
      throw new Error('Pilot data and project directories must not overlap');
    }
  }
  return dataDir;
}

function pilotProject(): string {
  return basename(pilotRoots()[0]);
}

function token(): string {
  return process.env.CLAUDE_MEM_PILOT_TOKEN || '';
}

export function assertPilotConfiguration(): void {
  if (!isPilotMode()) return;
  if (token().length < 32 || token().length > 512) {
    throw new Error('Pilot bearer token must be at least 32 characters');
  }
  if (!/^[\x21-\x7e]+$/.test(token())) {
    throw new Error('Pilot bearer token must contain printable ASCII without spaces');
  }
  pilotDataDir(); // Validates allowlist and synthetic-only storage isolation.
  const expiryText = process.env.CLAUDE_MEM_PILOT_EXPIRES_AT || '';
  const expires = Date.parse(expiryText);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expiryText) ||
      !Number.isFinite(expires) || expires <= Date.now() ||
      expires > Date.now() + 7 * 24 * 60 * 60 * 1000) {
    throw new Error('Pilot capture lease must expire within seven days');
  }
}

export function pilotClientHeaders(): Record<string, string> {
  if (!isPilotMode()) return {};
  const key = token();
  if (!key) throw new Error('Pilot bearer token missing');
  return { Authorization: 'Bearer ' + key };
}

function bearerMatches(header: string | undefined): boolean {
  const expected = token();
  const received = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (expected.length < 32 || received.length !== expected.length) return false;
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(received, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Restrict the HTTP surface while the pilot switch is enabled. */
export function pilotHttpGate(req: Request, res: Response, next: NextFunction): void {
  if (!isPilotMode()) { next(); return; }
  try {
    assertPilotConfiguration();
  } catch {
    res.status(503).json({ error: REJECTED.configuration.reason });
    return;
  }

  const route = req.method.toUpperCase() + ' ' + req.path;
  if (['GET /api/health', 'GET /api/readiness', 'GET /api/version'].includes(route)) {
    next();
    return;
  }

  // Browser origins and DNS-rebinding hostnames are not pilot CLI clients.
  if (req.headers.origin || !/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i.test(req.headers.host || '')) {
    res.status(403).json({ error: 'Pilot HTTP clients must use local CLI access' });
    return;
  }
  if (!bearerMatches(req.headers.authorization)) {
    res.status(401).json({ error: 'Pilot bearer authorization required' });
    return;
  }

  if (['GET /api/search', 'GET /api/bootstrap-memory'].includes(route)) {
    if (req.query.project !== pilotProject()) {
      res.status(403).json({ error: REJECTED.scope.reason });
      return;
    }
    next();
    return;
  }

  if (['POST /api/events/batch', 'POST /api/events/ingest', 'POST /api/memory/save'].includes(route)) {
    next();
    return;
  }
  res.status(403).json({ error: 'Endpoint disabled in isolated pilot mode' });
}

// Heuristics are deliberately conservative, not a promise to detect all
// personal, financial or credential data. Real company data stays prohibited.
const suspiciousContent: RegExp[] = [
  /-----BEGIN\s+(?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:sk-proj-|sk-[A-Za-z0-9]{16}|gh[pousr]_[A-Za-z0-9_]{16}|github_pat_[A-Za-z0-9_]{16})/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:authorization["']?\s*[:=]\s*["']?\s*bearer|client_secret["']?\s*[:=]|password["']?\s*[:=]|api[_-]?key["']?\s*[:=])\s*["']?\S+/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\bBE[0-9]{14}\b/i
];

function safeText(value: unknown): PilotDecision {
  if (typeof value !== 'string') return REJECTED.secret;
  if (Buffer.byteLength(value, 'utf8') > MAX_EVENT_BYTES) return REJECTED.size;
  if (suspiciousContent.some(pattern => pattern.test(value))) return REJECTED.secret;
  // Prevent this pilot's own ephemeral bearer credential from being recorded.
  if (isPilotMode() && token().length >= 32 && value.includes(token())) return REJECTED.secret;
  return PASS;
}

// Decode structured payloads before inspection; JSON escaping must never
// bypass secret-key detection or a nested value scanner.
const secretFieldName = /^(authorization|password|passwd|client[_-]?secret|api[_-]?key|secret[_-]?key|access[_-]?token|private[_-]?key)$/i;

function safeStructured(value: unknown, depth = 0): PilotDecision {
  if (depth > 12) return REJECTED.secret;
  if (typeof value === 'string') return safeText(value);
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return PASS;
  if (Array.isArray(value)) {
    for (const child of value) {
      const inspected = safeStructured(child, depth + 1);
      if (!inspected.allowed) return inspected;
    }
    return PASS;
  }
  if (typeof value !== 'object') return REJECTED.secret;
  for (const [key, child] of Object.entries(value)) {
    if (secretFieldName.test(key)) return REJECTED.secret;
    const inspected = safeStructured(child, depth + 1);
    if (!inspected.allowed) return inspected;
  }
  return PASS;
}

function approvedProjectPath(rootInput: unknown, cwdInput: unknown, projectInput: unknown): PilotDecision {
  if (typeof rootInput !== 'string' || typeof cwdInput !== 'string' || typeof projectInput !== 'string') {
    return REJECTED.scope;
  }
  try {
    const allowed = pilotRoots()[0];
    const realRoot = canonicalPath(rootInput);
    const realCwd = canonicalPath(cwdInput);
    if (!samePath(allowed, realRoot) || !insidePath(allowed, realCwd) || projectInput !== basename(allowed)) {
      return REJECTED.scope;
    }
  } catch {
    return REJECTED.scope;
  }
  return PASS;
}

/** The pilot.stop sentinel provides an immediate, restart-free capture kill switch. */
export function pilotCaptureEnabled(): PilotDecision {
  if (!isPilotMode()) return PASS;
  try {
    assertPilotConfiguration();
    const stopFile = join(pilotDataDir(), 'pilot.stop');
    if (process.env.CLAUDE_MEM_PILOT_CAPTURE_ENABLED !== 'true' || existsSync(stopFile)) {
      return REJECTED.stopped;
    }
    return PASS;
  } catch {
    return REJECTED.configuration;
  }
}

export function validatePilotEvents(events: NormalizedEvent[]): PilotDecision {
  if (!isPilotMode()) return PASS;
  const enabled = pilotCaptureEnabled();
  if (!enabled.allowed) return enabled;
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_BATCH_SIZE) return REJECTED.size;

  // Validate the WHOLE batch before any event reaches SQLite.
  for (const event of events) {
    if (!event || event.platform !== 'codex' || event.privacyState !== 'normal') return REJECTED.scope;
    const scope = approvedProjectPath(event.repoRoot, event.cwd, event.project);
    if (!scope.allowed) return scope;
    const encoded = safeText(JSON.stringify(event));
    if (!encoded.allowed) return encoded;
    if (typeof event.payloadJson !== 'string') return REJECTED.secret;
    const payload = safeText(event.payloadJson);
    if (!payload.allowed) return payload;
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.payloadJson);
    } catch {
      return REJECTED.secret;
    }
    const structured = safeStructured(parsed);
    if (!structured.allowed) return structured;
    for (const value of [event.promptText, event.assistantText, event.summaryText, event.toolInput, event.toolOutput]) {
      if (value === undefined || value === null) continue;
      const inspected = safeStructured(value);
      if (!inspected.allowed) return inspected;
    }
  }
  return PASS;
}

export function validatePilotManualMemory(input: unknown): PilotDecision {
  if (!isPilotMode()) return PASS;
  const enabled = pilotCaptureEnabled();
  if (!enabled.allowed) return enabled;
  if (!input || typeof input !== 'object') return REJECTED.secret;
  const memory = input as Record<string, unknown>;
  const scope = approvedProjectPath(memory.cwd, memory.cwd, memory.project);
  if (!scope.allowed) return scope;
  if (typeof memory.text !== 'string' || memory.text.trim().length === 0) return REJECTED.secret;
  const encoded = safeText(JSON.stringify(memory));
  if (!encoded.allowed) return encoded;
  return safeStructured(memory);
}
