import { describe, expect, it, mock } from 'bun:test';
import { SearchManager } from '../../../src/services/worker/SearchManager.js';

describe('SearchManager in SQLite-only mode', () => {
  it('passes a text query and its project scope to SQLite observation search', async () => {
    const searchObservations = mock(() => [{ id: 7, title: 'CITRON-BLEU' }]);
    const searchSessions = mock(() => []);
    const searchUserPrompts = mock(() => []);
    const sessionSearch: any = { searchObservations, searchSessions, searchUserPrompts };
    const manager = new SearchManager(sessionSearch, {} as any, null, {} as any, {} as any);
    const result = await manager.search({
      query: 'CITRON-BLEU', type: 'observations', project: 'fixture', format: 'json'
    });
    expect(result.totalResults).toBe(1);
    expect(result.observations[0].id).toBe(7);
    expect(searchObservations).toHaveBeenCalledWith(
      'CITRON-BLEU', expect.objectContaining({ project: 'fixture' })
    );
    expect(searchSessions).not.toHaveBeenCalled();
    expect(searchUserPrompts).not.toHaveBeenCalled();
  });

  it('searches session summaries and prompts without Chroma', async () => {
    const searchObservations = mock(() => []);
    const searchSessions = mock(() => [{ id: 10, request: 'CITRON-BLEU' }]);
    const searchUserPrompts = mock(() => [{ id: 30, prompt_text: 'CITRON-BLEU' }]);
    const manager = new SearchManager(
      { searchObservations, searchSessions, searchUserPrompts } as any,
      {} as any, null, {} as any, {} as any
    );
    const result = await manager.search({ query: 'CITRON-BLEU', project: 'fixture', format: 'json' });
    expect(result.totalResults).toBe(2);
    expect(searchSessions).toHaveBeenCalledWith(
      'CITRON-BLEU', expect.objectContaining({ project: 'fixture' })
    );
    expect(searchUserPrompts).toHaveBeenCalledWith(
      'CITRON-BLEU', expect.objectContaining({ project: 'fixture' })
    );
  });
});