import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { buildNormalizedEvent } from '../src/services/platform/normalization.js';
import { SessionStore } from '../src/services/sqlite/SessionStore.js';

describe('SessionStore raw events', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  it('persists platform metadata on sessions and deduplicates raw events by payload hash', () => {
    const sessionDbId = store.createSDKSession(
      'codex:codex-cli:thread-123',
      'test-project',
      'initial prompt',
      undefined,
      {
        platform: 'codex',
        clientKind: 'codex-cli',
        captureMode: 'notify',
        platformSessionId: 'thread-123',
        platformTurnId: 'turn-456',
        cwd: process.cwd(),
        project: 'test-project',
        repoRoot: process.cwd(),
        repoId: 'repo-123',
        gitBranch: 'main',
        gitCommit: 'abc123'
      }
    );

    const session = store.getSessionById(sessionDbId);
    expect(session?.platform).toBe('codex');
    expect(session?.client_kind).toBe('codex-cli');
    expect(session?.capture_mode).toBe('notify');
    expect(session?.platform_session_id).toBe('thread-123');

    const event = buildNormalizedEvent({
      platform: 'codex',
      clientKind: 'codex-cli',
      captureMode: 'notify',
      platformSessionId: 'thread-123',
      platformTurnId: 'turn-456',
      cwd: process.cwd(),
      project: 'test-project',
      repoRoot: process.cwd(),
      repoId: 'repo-123',
      gitBranch: 'main',
      gitCommit: 'abc123',
      eventType: 'prompt.submitted',
      createdAtEpochMs: 1700000000000,
      privacyState: 'normal',
      sourceConfidence: 'medium',
      captureFidelity: 'low',
      promptText: 'resume project memory',
      summaryText: 'resume project memory',
      payload: {
        threadId: 'thread-123',
        turnId: 'turn-456'
      }
    });

    const first = store.storeRawEvent(event, sessionDbId);
    const second = store.storeRawEvent(event, sessionDbId);

    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(second.id).toBe(first.id);

    const events = store.listRawEvents({ platformSessionId: 'thread-123' });
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('prompt.submitted');
    expect(events[0].payload_hash).toBe(event.payloadHash);
  });

  it('creates projection and retrieval metadata tables', () => {
    const tables = store.db.query(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name IN ('memory_projections', 'retrieval_feedback')
      ORDER BY name
    `).all() as Array<{ name: string }>;

    expect(tables.map(table => table.name)).toEqual([
      'memory_projections',
      'retrieval_feedback'
    ]);
  });
});
