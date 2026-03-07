import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { buildNormalizedEvent } from '../../src/services/platform/normalization.js';
import { SessionStore } from '../../src/services/sqlite/SessionStore.js';
import { SessionRoutes } from '../../src/services/worker/http/routes/SessionRoutes.js';

describe('SessionRoutes event ingestion', () => {
  let store: SessionStore;
  let routes: SessionRoutes;
  let eventBroadcaster: Record<string, ReturnType<typeof mock>>;
  let sessionManager: Record<string, ReturnType<typeof mock>>;

  beforeEach(() => {
    store = new SessionStore(':memory:');
    eventBroadcaster = {
      broadcastSessionStarted: mock(() => {}),
      broadcastNewPrompt: mock(() => {}),
      broadcastObservationQueued: mock(() => {}),
      broadcastSessionCompleted: mock(() => {}),
      broadcastSummarizeQueued: mock(() => {})
    };

    sessionManager = {
      initializeSession: mock(() => undefined),
      queueObservation: mock(() => undefined),
      queueSummarize: mock(() => undefined),
      deleteSession: mock(() => Promise.resolve()),
      getSession: mock(() => undefined)
    };

    const dbManager = {
      getSessionStore: () => store,
      getChromaSync: () => null
    };

    routes = new SessionRoutes(
      sessionManager as any,
      dbManager as any,
      {} as any,
      {} as any,
      {} as any,
      eventBroadcaster as any,
      { broadcastProcessingStatus: mock(() => {}) } as any
    );
  });

  afterEach(() => {
    store.close();
    mock.restore();
  });

  it('marks imported Codex sessions completed and preserves source timestamps', () => {
    const events = [
      buildNormalizedEvent({
        platform: 'codex',
        clientKind: 'codex-exec',
        captureMode: 'exec-json',
        platformSessionId: 'thread-123',
        cwd: process.cwd(),
        project: 'test-project',
        repoRoot: process.cwd(),
        repoId: 'repo-123',
        gitBranch: 'main',
        gitCommit: 'abc123',
        eventType: 'session.started',
        createdAtEpochMs: 1700000000000,
        privacyState: 'normal',
        sourceConfidence: 'high',
        captureFidelity: 'medium',
        summaryText: 'Session started',
        payload: { type: 'thread.started' }
      }),
      buildNormalizedEvent({
        platform: 'codex',
        clientKind: 'codex-exec',
        captureMode: 'exec-json',
        platformSessionId: 'thread-123',
        platformTurnId: 'turn-1',
        cwd: process.cwd(),
        project: 'test-project',
        repoRoot: process.cwd(),
        repoId: 'repo-123',
        gitBranch: 'main',
        gitCommit: 'abc123',
        eventType: 'prompt.submitted',
        createdAtEpochMs: 1700000005000,
        privacyState: 'normal',
        sourceConfidence: 'high',
        captureFidelity: 'medium',
        promptText: 'Resume the Codex import',
        summaryText: 'Resume the Codex import',
        payload: { type: 'turn.started' }
      }),
      buildNormalizedEvent({
        platform: 'codex',
        clientKind: 'codex-exec',
        captureMode: 'exec-json',
        platformSessionId: 'thread-123',
        cwd: process.cwd(),
        project: 'test-project',
        repoRoot: process.cwd(),
        repoId: 'repo-123',
        gitBranch: 'main',
        gitCommit: 'abc123',
        eventType: 'session.completed',
        createdAtEpochMs: 1700000010000,
        privacyState: 'normal',
        sourceConfidence: 'high',
        captureFidelity: 'medium',
        summaryText: 'Session completed',
        payload: { type: 'thread.completed' }
      })
    ];

    const result = (routes as any).ingestNormalizedEvents(events);

    expect(result).toHaveLength(3);

    const session = store.db.prepare(`
      SELECT status, started_at_epoch, completed_at_epoch
      FROM sdk_sessions
      WHERE content_session_id = ?
    `).get('codex:codex-exec:thread-123') as {
      status: string;
      started_at_epoch: number;
      completed_at_epoch: number;
    };
    const prompt = store.getLatestUserPrompt('codex:codex-exec:thread-123');

    expect(session.status).toBe('completed');
    expect(session.started_at_epoch).toBe(1700000000000);
    expect(session.completed_at_epoch).toBe(1700000010000);
    expect(prompt?.created_at_epoch).toBe(1700000005000);
    expect(eventBroadcaster.broadcastSessionCompleted).toHaveBeenCalledWith(expect.any(Number));
  });

  it('queues imported observations and summaries with source event timestamps intact', () => {
    const events = [
      buildNormalizedEvent({
        platform: 'codex',
        clientKind: 'codex-exec',
        captureMode: 'exec-json',
        platformSessionId: 'thread-queue-1',
        platformTurnId: 'turn-queue-1',
        cwd: process.cwd(),
        project: 'test-project',
        repoRoot: process.cwd(),
        repoId: 'repo-queue-1',
        gitBranch: 'main',
        gitCommit: 'abc123',
        eventType: 'session.started',
        createdAtEpochMs: 1700000100000,
        privacyState: 'normal',
        sourceConfidence: 'high',
        captureFidelity: 'medium',
        summaryText: 'Session started',
        payload: { type: 'thread.started' }
      }),
      buildNormalizedEvent({
        platform: 'codex',
        clientKind: 'codex-exec',
        captureMode: 'exec-json',
        platformSessionId: 'thread-queue-1',
        platformTurnId: 'turn-queue-1',
        cwd: process.cwd(),
        project: 'test-project',
        repoRoot: process.cwd(),
        repoId: 'repo-queue-1',
        gitBranch: 'main',
        gitCommit: 'abc123',
        eventType: 'prompt.submitted',
        createdAtEpochMs: 1700000101000,
        privacyState: 'normal',
        sourceConfidence: 'high',
        captureFidelity: 'medium',
        promptText: 'Resume imported work',
        summaryText: 'Resume imported work',
        payload: { type: 'turn.started' }
      }),
      buildNormalizedEvent({
        platform: 'codex',
        clientKind: 'codex-exec',
        captureMode: 'exec-json',
        platformSessionId: 'thread-queue-1',
        platformTurnId: 'turn-queue-1',
        cwd: process.cwd(),
        project: 'test-project',
        repoRoot: process.cwd(),
        repoId: 'repo-queue-1',
        gitBranch: 'main',
        gitCommit: 'abc123',
        eventType: 'tool.output',
        createdAtEpochMs: 1700000102000,
        privacyState: 'normal',
        sourceConfidence: 'high',
        captureFidelity: 'medium',
        toolName: 'Bash',
        toolInput: { command: 'git status' },
        toolOutput: { stdout: 'clean' },
        summaryText: 'git status clean',
        payload: { type: 'item.completed' }
      }),
      buildNormalizedEvent({
        platform: 'codex',
        clientKind: 'codex-exec',
        captureMode: 'exec-json',
        platformSessionId: 'thread-queue-1',
        platformTurnId: 'turn-queue-1',
        cwd: process.cwd(),
        project: 'test-project',
        repoRoot: process.cwd(),
        repoId: 'repo-queue-1',
        gitBranch: 'main',
        gitCommit: 'abc123',
        eventType: 'turn.completed',
        createdAtEpochMs: 1700000103000,
        privacyState: 'normal',
        sourceConfidence: 'high',
        captureFidelity: 'medium',
        assistantText: 'Imported turn completed',
        summaryText: 'Imported turn completed',
        payload: { type: 'turn.completed' }
      })
    ];

    (routes as any).ingestNormalizedEvents(events);

    expect(sessionManager.queueObservation).toHaveBeenCalledTimes(1);
    expect(sessionManager.queueObservation).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({
        platform: 'codex',
        capture_mode: 'exec-json',
        platform_turn_id: 'turn-queue-1',
        repo_id: 'repo-queue-1',
        source_event_epoch: 1700000102000
      })
    );

    expect(sessionManager.queueSummarize).toHaveBeenCalledTimes(1);
    expect(sessionManager.queueSummarize).toHaveBeenCalledWith(
      expect.any(Number),
      'Imported turn completed',
      1700000103000
    );
  });
});
