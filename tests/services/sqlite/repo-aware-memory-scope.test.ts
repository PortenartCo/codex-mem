import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { unlinkSync } from 'fs';
import { SessionSearch } from '../../../src/services/sqlite/SessionSearch.js';
import { SessionStore } from '../../../src/services/sqlite/SessionStore.js';

describe('Repo-aware SQLite memory scope', () => {
  let dbPath: string;
  let store: SessionStore;
  let search: SessionSearch;

  beforeEach(() => {
    dbPath = `/tmp/repo-scope-${crypto.randomUUID()}.db`;
    store = new SessionStore(dbPath);
    search = new SessionSearch(dbPath);
  });

  afterEach(() => {
    search.close();
    store.close();
    try {
      unlinkSync(dbPath);
    } catch {
      // ignore cleanup errors
    }
  });

  function seedObservation({
    contentSessionId,
    memorySessionId,
    repoRoot,
    repoId,
    project,
    title,
    timestamp
  }: {
    contentSessionId: string;
    memorySessionId: string;
    repoRoot?: string;
    repoId?: string;
    project: string;
    title: string;
    timestamp: number;
  }): number {
    const sessionDbId = store.createSDKSession(
      contentSessionId,
      project,
      `${title} prompt`,
      undefined,
      {
        platform: 'codex',
        clientKind: 'codex-cli',
        captureMode: 'notify',
        platformSessionId: contentSessionId,
        repoRoot,
        repoId
      },
      timestamp
    );
    store.updateMemorySessionId(sessionDbId, memorySessionId);

    return store.storeObservation(
      memorySessionId,
      project,
      {
        type: 'decision',
        title,
        subtitle: null,
        facts: [],
        narrative: `${title} narrative`,
        concepts: ['memory'],
        files_read: [],
        files_modified: []
      },
      1,
      0,
      timestamp,
      {
        platform: 'codex',
        clientKind: 'codex-cli',
        captureMode: 'notify',
        repoRoot,
        repoId
      }
    ).id;
  }

  it('searchObservations keeps current repo rows plus legacy project rows, but excludes sibling repos', () => {
    const project = 'shared-project';
    const repoRoot = '/tmp/worktrees/repo-a';
    const repoId = 'repo-a';

    seedObservation({
      contentSessionId: 'session-current',
      memorySessionId: 'memory-current',
      repoRoot,
      repoId,
      project,
      title: 'Current repo observation',
      timestamp: 1700000000000
    });
    seedObservation({
      contentSessionId: 'session-legacy',
      memorySessionId: 'memory-legacy',
      project,
      title: 'Legacy project observation',
      timestamp: 1700000001000
    });
    seedObservation({
      contentSessionId: 'session-sibling',
      memorySessionId: 'memory-sibling',
      repoRoot: '/tmp/worktrees/repo-b',
      repoId: 'repo-b',
      project,
      title: 'Sibling repo observation',
      timestamp: 1700000002000
    });

    const results = search.searchObservations(undefined, {
      project,
      repoRoot,
      repoId,
      limit: 10,
      orderBy: 'date_desc'
    });

    const titles = results.map(result => result.title);
    expect(titles).toContain('Current repo observation');
    expect(titles).toContain('Legacy project observation');
    expect(titles).not.toContain('Sibling repo observation');
  });

  it('getObservationsByIds applies the same repo-aware filtering during hydration', () => {
    const project = 'shared-project';
    const repoRoot = '/tmp/worktrees/repo-a';
    const repoId = 'repo-a';

    const currentId = seedObservation({
      contentSessionId: 'session-current',
      memorySessionId: 'memory-current',
      repoRoot,
      repoId,
      project,
      title: 'Current repo hydration',
      timestamp: 1700000010000
    });
    const legacyId = seedObservation({
      contentSessionId: 'session-legacy',
      memorySessionId: 'memory-legacy',
      project,
      title: 'Legacy hydration',
      timestamp: 1700000011000
    });
    const siblingId = seedObservation({
      contentSessionId: 'session-sibling',
      memorySessionId: 'memory-sibling',
      repoRoot: '/tmp/worktrees/repo-b',
      repoId: 'repo-b',
      project,
      title: 'Sibling hydration',
      timestamp: 1700000012000
    });

    const results = store.getObservationsByIds([currentId, legacyId, siblingId], {
      project,
      repoRoot,
      repoId,
      limit: 10,
      orderBy: 'date_desc'
    });

    const titles = results.map(result => result.title);
    expect(titles).toContain('Current repo hydration');
    expect(titles).toContain('Legacy hydration');
    expect(titles).not.toContain('Sibling hydration');
  });
});
