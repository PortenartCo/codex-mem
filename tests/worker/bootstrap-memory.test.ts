import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { SearchManager } from '../../src/services/worker/SearchManager.js';
import { getRepoContext } from '../../src/services/platform/repo-context.js';

describe('SearchManager.bootstrapMemory', () => {
  let searchManager: SearchManager;
  let mockSessionSearch: any;
  let mockSessionStore: any;

  beforeEach(() => {
    mockSessionSearch = {
      searchObservations: mock(() => [
        {
          id: 11,
          memory_session_id: 'memory-1',
          project: 'test-project',
          text: 'observation text',
          type: 'decision',
          title: 'Adopt adapter-based ingress',
          subtitle: 'Platform refactor',
          facts: '[]',
          narrative: 'Use platform adapters for Codex and Claude.',
          concepts: '[]',
          files_read: '[]',
          files_modified: '[]',
          prompt_number: 1,
          discovery_tokens: 50,
          created_at: '2026-03-07T00:00:00.000Z',
          created_at_epoch: 1762819200000
        }
      ])
    };

    mockSessionStore = {
      getRecentSessionsWithStatus: mock(() => [
        {
          memory_session_id: 'memory-1',
          status: 'completed',
          started_at: '2026-03-06T12:00:00.000Z',
          user_prompt: 'Build Codex memory support',
          has_summary: true
        }
      ]),
      getSummaryForSession: mock(() => ({
        request: 'Build Codex memory support',
        completed: 'Raw event ingestion shipped',
        learned: 'notify is low-fidelity',
        next_steps: 'Add app-server capture'
      }))
    };

    searchManager = new SearchManager(
      mockSessionSearch,
      mockSessionStore,
      null,
      {} as any,
      {} as any
    );
  });

  it('returns a compact brief with follow-up suggestions', async () => {
    const result = await searchManager.bootstrapMemory({
      project: 'test-project',
      goal: 'resume codex adapter work'
    });

    const text = result.content[0].text;
    expect(text).toContain('# Memory Brief');
    expect(text).toContain('Build Codex memory support');
    expect(text).toContain('#11');
    expect(text).toContain('timeline(anchor=11)');
    expect(text).toContain('get_observations(ids=[11])');
    expect(mockSessionStore.getRecentSessionsWithStatus).toHaveBeenCalledWith('test-project', 3);
    expect(
      mockSessionSearch.searchObservations.mock.calls.some(([, options]: any[]) =>
        options?.project === 'test-project' &&
        options?.repoRoot === undefined &&
        options?.repoId === undefined &&
        options?.limit === 5 &&
        options?.orderBy === 'date_desc'
      )
    ).toBe(true);
  });

  it('uses repo-aware filters when bootstrapping from cwd', async () => {
    const repo = getRepoContext(process.cwd());

    await searchManager.bootstrapMemory({
      cwd: process.cwd(),
      goal: 'resume codex adapter work'
    });

    expect(mockSessionStore.getRecentSessionsWithStatus).toHaveBeenCalledWith(
      repo.project,
      3,
      expect.objectContaining({
        repoRoot: repo.repoRoot,
        repoId: repo.repoId
      })
    );
    expect(
      mockSessionSearch.searchObservations.mock.calls.some(([, options]: any[]) =>
        options?.project === repo.project &&
        options?.repoRoot === repo.repoRoot &&
        options?.repoId === repo.repoId
      )
    ).toBe(true);
  });

  it('does not fall back to unrelated project-only recall when repo-scoped recall is empty', async () => {
    mockSessionStore.getRecentSessionsWithStatus = mock()
      .mockImplementationOnce(() => []);
    mockSessionSearch.searchObservations = mock()
      .mockImplementationOnce(() => []);

    searchManager = new SearchManager(
      mockSessionSearch,
      mockSessionStore,
      null,
      {} as any,
      {} as any
    );

    const result = await searchManager.bootstrapMemory({
      cwd: process.cwd(),
      goal: 'legacy recall'
    });

    expect(mockSessionStore.getRecentSessionsWithStatus).toHaveBeenCalledTimes(1);
    expect(
      mockSessionSearch.searchObservations.mock.calls.some(([, options]: any[]) =>
        options?.project === getRepoContext(process.cwd()).project &&
        options?.repoRoot === getRepoContext(process.cwd()).repoRoot &&
        options?.repoId === getRepoContext(process.cwd()).repoId &&
        options?.limit === 5 &&
        options?.orderBy === 'date_desc'
      )
    ).toBe(true);
    expect(result.content[0].text).toContain('No recent sessions found for this project.');
    expect(result.content[0].text).toContain('No matching observations found.');
  });
});
