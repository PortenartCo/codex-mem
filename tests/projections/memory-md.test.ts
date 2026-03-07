import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { queryRecentSessions } from '../../src/services/projections/memory-md.js';
import { SessionStore } from '../../src/services/sqlite/SessionStore.js';

describe('MEMORY.md projection queries', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  it('returns only the latest summary row for a session', () => {
    const repoRoot = '/tmp/projection-test';
    const sessionDbId = store.createSDKSession(
      'codex:codex-cli:thread-1',
      'projection-test',
      'Seed prompt',
      undefined,
      {
        platform: 'codex',
        clientKind: 'codex-cli',
        captureMode: 'notify',
        platformSessionId: 'thread-1',
        repoRoot,
        repoId: 'repo-projection-1',
        gitBranch: 'main'
      },
      1700000000000
    );
    store.updateMemorySessionId(sessionDbId, 'memory-1');

    store.storeSummary(
      'memory-1',
      'projection-test',
      {
        request: 'First request',
        investigated: 'Initial investigation',
        learned: 'Old learning',
        completed: 'Old outcome',
        next_steps: 'Old next step',
        notes: null
      },
      1,
      0,
      1700000001000,
      {
        platform: 'codex',
        clientKind: 'codex-cli',
        captureMode: 'notify',
        repoRoot,
        repoId: 'repo-projection-1'
      }
    );

    store.storeSummary(
      'memory-1',
      'projection-test',
      {
        request: 'Latest request',
        investigated: 'Latest investigation',
        learned: 'Latest learning',
        completed: 'Latest outcome',
        next_steps: 'Latest next step',
        notes: null
      },
      2,
      0,
      1700000002000,
      {
        platform: 'codex',
        clientKind: 'codex-cli',
        captureMode: 'notify',
        repoRoot,
        repoId: 'repo-projection-1'
      }
    );

    const rows = queryRecentSessions(store.db, repoRoot, 'projection-test', 5, 'repo-projection-1');

    expect(rows).toHaveLength(1);
    expect(rows[0].request).toBe('Latest request');
    expect(rows[0].completed).toBe('Latest outcome');
    expect(rows[0].next_steps).toBe('Latest next step');
  });

  it('scopes MEMORY.md session queries to the current repo root when project names collide', () => {
    const project = 'shared-project';
    const repoRootA = '/tmp/projection-scope-a';
    const repoRootB = '/tmp/projection-scope-b';

    const sessionA = store.createSDKSession(
      'codex:codex-cli:thread-a',
      project,
      'Repo A prompt',
      undefined,
      {
        platform: 'codex',
        clientKind: 'codex-cli',
        captureMode: 'notify',
        platformSessionId: 'thread-a',
        repoRoot: repoRootA,
        repoId: 'repo-a'
      },
      1700000100000
    );
    store.updateMemorySessionId(sessionA, 'memory-a');
    store.storeSummary(
      'memory-a',
      project,
      {
        request: 'Repo A request',
        investigated: 'Repo A investigation',
        learned: 'Repo A learning',
        completed: 'Repo A outcome',
        next_steps: 'Repo A next step',
        notes: null
      },
      1,
      0,
      1700000101000,
      {
        platform: 'codex',
        clientKind: 'codex-cli',
        captureMode: 'notify',
        repoRoot: repoRootA,
        repoId: 'repo-a'
      }
    );

    const sessionB = store.createSDKSession(
      'codex:codex-cli:thread-b',
      project,
      'Repo B prompt',
      undefined,
      {
        platform: 'codex',
        clientKind: 'codex-cli',
        captureMode: 'notify',
        platformSessionId: 'thread-b',
        repoRoot: repoRootB,
        repoId: 'repo-b'
      },
      1700000200000
    );
    store.updateMemorySessionId(sessionB, 'memory-b');
    store.storeSummary(
      'memory-b',
      project,
      {
        request: 'Repo B request',
        investigated: 'Repo B investigation',
        learned: 'Repo B learning',
        completed: 'Repo B outcome',
        next_steps: 'Repo B next step',
        notes: null
      },
      1,
      0,
      1700000201000,
      {
        platform: 'codex',
        clientKind: 'codex-cli',
        captureMode: 'notify',
        repoRoot: repoRootB,
        repoId: 'repo-b'
      }
    );

    const rows = queryRecentSessions(store.db, repoRootA, project, 10, 'repo-a');

    expect(rows).toHaveLength(1);
    expect(rows[0].request).toBe('Repo A request');
    expect(rows[0].completed).toBe('Repo A outcome');
  });

  it('keeps projection continuity when the same repo id has historical rows under an older root', () => {
    const project = 'moved-project';
    const repoId = 'repo-stable';
    const oldRoot = '/tmp/projection-old-root';
    const newRoot = '/tmp/projection-new-root';

    const oldSession = store.createSDKSession(
      'codex:codex-cli:thread-old',
      project,
      'Old root prompt',
      undefined,
      {
        platform: 'codex',
        clientKind: 'codex-cli',
        captureMode: 'notify',
        platformSessionId: 'thread-old',
        repoRoot: oldRoot,
        repoId
      },
      1700000300000
    );
    store.updateMemorySessionId(oldSession, 'memory-old');
    store.storeSummary(
      'memory-old',
      project,
      {
        request: 'Old root request',
        investigated: 'Old root investigation',
        learned: 'Old root learning',
        completed: 'Old root outcome',
        next_steps: 'Old root next step',
        notes: null
      },
      1,
      0,
      1700000301000,
      {
        platform: 'codex',
        clientKind: 'codex-cli',
        captureMode: 'notify',
        repoRoot: oldRoot,
        repoId
      }
    );

    const rows = queryRecentSessions(store.db, newRoot, project, 10, repoId);

    expect(rows).toHaveLength(1);
    expect(rows[0].request).toBe('Old root request');
    expect(rows[0].completed).toBe('Old root outcome');
  });
});
