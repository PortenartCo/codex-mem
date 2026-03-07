/**
 * Tests for SessionStore in-memory database operations
 *
 * Mock Justification: NONE (0% mock code)
 * - Uses real SQLite with ':memory:' - tests actual SQL and schema
 * - All CRUD operations are tested against real database behavior
 * - Timestamp handling and FK relationships are validated
 *
 * Value: Validates core persistence layer without filesystem dependencies
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SessionStore } from '../src/services/sqlite/SessionStore.js';

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  it('should correctly count user prompts', () => {
    const claudeId = 'claude-session-1';
    store.createSDKSession(claudeId, 'test-project', 'initial prompt');
    
    // Should be 0 initially
    expect(store.getPromptNumberFromUserPrompts(claudeId)).toBe(0);

    // Save prompt 1
    store.saveUserPrompt(claudeId, 1, 'First prompt');
    expect(store.getPromptNumberFromUserPrompts(claudeId)).toBe(1);

    // Save prompt 2
    store.saveUserPrompt(claudeId, 2, 'Second prompt');
    expect(store.getPromptNumberFromUserPrompts(claudeId)).toBe(2);

    // Save prompt for another session
    store.createSDKSession('claude-session-2', 'test-project', 'initial prompt');
    store.saveUserPrompt('claude-session-2', 1, 'Other prompt');
    expect(store.getPromptNumberFromUserPrompts(claudeId)).toBe(2);
  });

  it('should store observation with timestamp override', () => {
    const claudeId = 'claude-sess-obs';
    const memoryId = 'memory-sess-obs';
    const sdkId = store.createSDKSession(claudeId, 'test-project', 'initial prompt');

    // Set the memory_session_id before storing observations
    // createSDKSession now initializes memory_session_id = NULL
    store.updateMemorySessionId(sdkId, memoryId);

    const obs = {
      type: 'discovery',
      title: 'Test Obs',
      subtitle: null,
      facts: [],
      narrative: 'Testing',
      concepts: [],
      files_read: [],
      files_modified: []
    };

    const pastTimestamp = 1600000000000; // Some time in the past

    const result = store.storeObservation(
      memoryId, // Use memorySessionId for FK reference
      'test-project',
      obs,
      1,
      0,
      pastTimestamp
    );

    expect(result.createdAtEpoch).toBe(pastTimestamp);

    const stored = store.getObservationById(result.id);
    expect(stored).not.toBeNull();
    expect(stored?.created_at_epoch).toBe(pastTimestamp);

    // Verify ISO string matches
    expect(new Date(stored!.created_at).getTime()).toBe(pastTimestamp);
  });

  it('should store summary with timestamp override', () => {
    const claudeId = 'claude-sess-sum';
    const memoryId = 'memory-sess-sum';
    const sdkId = store.createSDKSession(claudeId, 'test-project', 'initial prompt');

    // Set the memory_session_id before storing summaries
    store.updateMemorySessionId(sdkId, memoryId);

    const summary = {
      request: 'Do something',
      investigated: 'Stuff',
      learned: 'Things',
      completed: 'Done',
      next_steps: 'More',
      notes: null
    };

    const pastTimestamp = 1650000000000;

    const result = store.storeSummary(
      memoryId, // Use memorySessionId for FK reference
      'test-project',
      summary,
      1,
      0,
      pastTimestamp
    );

    expect(result.createdAtEpoch).toBe(pastTimestamp);

    const stored = store.getSummaryForSession(memoryId);
    expect(stored).not.toBeNull();
    expect(stored?.created_at_epoch).toBe(pastTimestamp);
  });

  it('should preserve source timestamps for sessions, prompts, and completion', () => {
    const contentSessionId = 'codex:codex-exec:thread-123';
    const startedAtEpoch = 1700000000000;
    const promptAtEpoch = 1700000005000;
    const completedAtEpoch = 1700000010000;

    const sessionDbId = store.createSDKSession(
      contentSessionId,
      'test-project',
      'initial prompt',
      undefined,
      {
        platform: 'codex',
        clientKind: 'codex-exec',
        captureMode: 'exec-json',
        platformSessionId: 'thread-123'
      },
      startedAtEpoch
    );

    store.saveUserPrompt(
      contentSessionId,
      1,
      'Resume the Codex import',
      {
        platform: 'codex',
        clientKind: 'codex-exec',
        captureMode: 'exec-json',
        platformTurnId: 'turn-1'
      },
      promptAtEpoch
    );
    store.markSessionCompleted(sessionDbId, completedAtEpoch);

    const session = store.db.prepare(`
      SELECT started_at_epoch, completed_at_epoch, status
      FROM sdk_sessions
      WHERE id = ?
    `).get(sessionDbId) as {
      started_at_epoch: number;
      completed_at_epoch: number;
      status: string;
    };
    const prompt = store.getLatestUserPrompt(contentSessionId);

    expect(session.started_at_epoch).toBe(startedAtEpoch);
    expect(session.completed_at_epoch).toBe(completedAtEpoch);
    expect(session.status).toBe('completed');
    expect(prompt?.created_at_epoch).toBe(promptAtEpoch);
  });

  it('should backfill an earlier started_at timestamp when a session is replayed out of order', () => {
    const contentSessionId = 'codex:codex-exec:thread-456';
    const laterEpoch = 1700000100000;
    const earlierEpoch = 1700000000000;

    const sessionDbId = store.createSDKSession(contentSessionId, 'test-project', 'late replay', undefined, undefined, laterEpoch);
    store.createSDKSession(contentSessionId, 'test-project', 'early replay', undefined, undefined, earlierEpoch);

    const session = store.db.prepare(`
      SELECT id, started_at_epoch
      FROM sdk_sessions
      WHERE id = ?
    `).get(sessionDbId) as { id: number; started_at_epoch: number };

    expect(session.started_at_epoch).toBe(earlierEpoch);
  });
});
