import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { buildNormalizedEvent } from '../../src/services/platform/normalization.js';
import { SessionStore } from '../../src/services/sqlite/SessionStore.js';
import { SessionRoutes } from '../../src/services/worker/http/routes/SessionRoutes.js';

describe('SessionRoutes event ingestion', () => {
  let store: SessionStore;
  let routes: SessionRoutes;
  let eventBroadcaster: any;

  beforeEach(() => {
    store = new SessionStore(':memory:');

    const sessionManager = {
      initializeSession: mock(() => null),
      queueObservation: mock(() => {}),
      queueSummarize: mock(() => {}),
      getSession: mock(() => null),
      deleteSession: mock(() => Promise.resolve()),
    };

    eventBroadcaster = {
      broadcastSessionStarted: mock(() => {}),
      broadcastSessionCompleted: mock(() => {}),
      broadcastObservationQueued: mock(() => {}),
      broadcastSummarizeQueued: mock(() => {}),
      broadcastNewPrompt: mock(() => {}),
    };

    routes = new SessionRoutes(
      sessionManager as any,
      { getSessionStore: () => store } as any,
      {} as any,
      {} as any,
      {} as any,
      eventBroadcaster,
      { broadcastProcessingStatus: mock(() => {}) } as any
    );
  });

  afterEach(() => {
    store.close();
  });

  it('marks sessions completed and re-applies duplicate completion events idempotently', () => {
    const baseEvent = {
      platform: 'codex' as const,
      clientKind: 'codex-exec' as const,
      captureMode: 'exec-json' as const,
      platformSessionId: 'thread-ingest-1',
      cwd: process.cwd(),
      project: 'test-project',
      repoRoot: process.cwd(),
      repoId: 'repo-ingest-1',
      gitBranch: 'main',
      gitCommit: 'abc123',
      privacyState: 'normal' as const,
      sourceConfidence: 'high' as const,
      captureFidelity: 'medium' as const,
    };

    const started = buildNormalizedEvent({
      ...baseEvent,
      eventType: 'session.started',
      createdAtEpochMs: 1700000000000,
      summaryText: 'started',
      payload: { threadId: 'thread-ingest-1', type: 'thread.started' }
    });
    const completed = buildNormalizedEvent({
      ...baseEvent,
      eventType: 'session.completed',
      createdAtEpochMs: 1700000010000,
      assistantText: 'done',
      summaryText: 'done',
      payload: { threadId: 'thread-ingest-1', type: 'thread.completed' }
    });

    const firstResults = (routes as any).ingestNormalizedEvents([started, completed]);
    const sessionDbId = firstResults[0].sessionDbId;

    let session = store.db.prepare(`
      SELECT status, completed_at_epoch
      FROM sdk_sessions
      WHERE id = ?
    `).get(sessionDbId) as { status: string; completed_at_epoch: number | null };

    expect(session.status).toBe('completed');
    expect(session.completed_at_epoch).toBe(1700000010000);

    store.db.prepare(`
      UPDATE sdk_sessions
      SET status = 'active', completed_at = NULL, completed_at_epoch = NULL
      WHERE id = ?
    `).run(sessionDbId);

    const duplicateResults = (routes as any).ingestNormalizedEvents([completed]);
    session = store.db.prepare(`
      SELECT status, completed_at_epoch
      FROM sdk_sessions
      WHERE id = ?
    `).get(sessionDbId) as { status: string; completed_at_epoch: number | null };

    expect(duplicateResults).toHaveLength(1);
    expect(duplicateResults[0].inserted).toBe(false);
    expect(session.status).toBe('completed');
    expect(session.completed_at_epoch).toBe(1700000010000);
    expect(eventBroadcaster.broadcastSessionCompleted).toHaveBeenCalledTimes(1);
  });
});
