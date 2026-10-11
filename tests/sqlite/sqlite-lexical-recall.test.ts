import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Database } from 'bun:sqlite';
import { SessionSearch } from '../../src/services/sqlite/SessionSearch.js';

describe('SQLite lexical recall without Chroma or vector dependencies', () => {
  let search: SessionSearch;

  beforeEach(() => {
    // An in-memory DB avoids Bun/Windows WAL file locking during teardown.
    // These tests exercise LIKE retrieval even if FTS5 is not initialized.
    search = new SessionSearch(':memory:');
    const db = (search as any).db as Database;
    db.run('CREATE TABLE observations (id INTEGER PRIMARY KEY, memory_session_id TEXT, project TEXT, repo_root TEXT, repo_id TEXT, type TEXT, title TEXT, subtitle TEXT, narrative TEXT, text TEXT, facts TEXT, concepts TEXT, files_read TEXT, files_modified TEXT, discovery_tokens INTEGER, created_at TEXT, created_at_epoch INTEGER)');
    db.run('CREATE TABLE session_summaries (id INTEGER PRIMARY KEY, memory_session_id TEXT, project TEXT, repo_root TEXT, repo_id TEXT, request TEXT, investigated TEXT, learned TEXT, completed TEXT, next_steps TEXT, notes TEXT, files_read TEXT, files_edited TEXT, discovery_tokens INTEGER, created_at TEXT, created_at_epoch INTEGER)');
    db.run('CREATE TABLE sdk_sessions (id INTEGER PRIMARY KEY, content_session_id TEXT, project TEXT, repo_root TEXT, repo_id TEXT)');
    db.run('CREATE TABLE user_prompts (id INTEGER PRIMARY KEY, content_session_id TEXT, prompt_number INTEGER, prompt_text TEXT, created_at TEXT, created_at_epoch INTEGER)');

    const observation = db.prepare("INSERT INTO observations (id, project, type, title, narrative, facts, concepts, files_read, files_modified, discovery_tokens, created_at_epoch) VALUES (?, ?, 'discovery', ?, ?, '[]', '[]', '[]', '[]', 0, ?)");
    observation.run(1, 'pilot', 'CITRON-BLEU log', 'A synthetic observation for the pilot', 1000);
    observation.run(2, 'other-project', 'CITRON-BLEU log', 'Must not leak across projects', 1001);
    observation.run(3, 'pilot', '100%_safe literal', 'Do not interpret % or _ as wildcards', 1002);
    observation.run(4, 'pilot', 'Nothing related', 'No match expected here', 1003);
    db.run("INSERT INTO session_summaries(id, project, request, next_steps, discovery_tokens, created_at_epoch) VALUES (10, 'pilot', 'Test request', 'Restore CITRON-BLEU state', 0, 1004)");
    db.run("INSERT INTO session_summaries(id, project, request, next_steps, discovery_tokens, created_at_epoch) VALUES (11, 'other-project', 'Test request', 'Restore CITRON-BLEU state', 0, 1005)");
    db.run("INSERT INTO sdk_sessions(id, content_session_id, project, repo_id) VALUES (21, 'session-pilot', 'pilot', 'repo-pilot')");
    db.run("INSERT INTO sdk_sessions(id, content_session_id, project, repo_id) VALUES (22, 'session-other', 'other-project', 'repo-other')");
    db.run("INSERT INTO user_prompts(id, content_session_id, prompt_number, prompt_text, created_at_epoch) VALUES (31, 'session-pilot', 1, 'Find CITRON-BLEU in local memory', 1006)");
    db.run("INSERT INTO user_prompts(id, content_session_id, prompt_number, prompt_text, created_at_epoch) VALUES (32, 'session-other', 1, 'Find CITRON-BLEU in local memory', 1007)");
  });

  afterEach(() => {
    search?.close();
  });

  it('retrieves observation text while preserving project filtering', () => {
    expect(search.searchObservations('CITRON-BLEU', { project: 'pilot' }).map(o => o.id)).toEqual([1]);
    expect(search.searchObservations('CITRON-BLEU', { project: 'no-project' })).toEqual([]);
  });

  it('matches literal percent and underscore and safely handles SQL control text', () => {
    expect(search.searchObservations('100%_', { project: 'pilot' }).map(o => o.id)).toEqual([3]);
    expect(search.searchObservations("' OR 1=1 --", { project: 'pilot' })).toEqual([]);
    expect(search.searchObservations('CITRON-BLEU', { project: 'pilot', type: 'decision' })).toEqual([]);
  });

  it('searches summaries and prompts without Chroma', () => {
    expect(search.searchSessions('CITRON-BLEU', { project: 'pilot' }).map(s => s.id)).toEqual([10]);
    expect(search.searchUserPrompts('CITRON-BLEU', { project: 'pilot' }).map(p => p.id)).toEqual([31]);
    expect(search.searchUserPrompts('CITRON-BLEU', { project: 'pilot', repoId: 'repo-unknown' })).toEqual([]);
  });

  it('preserves filter-only retrieval and safe pagination', () => {
    expect(search.searchObservations(undefined, { project: 'pilot', limit: 1, offset: 1, orderBy: 'date_asc' }).map(o => o.id)).toEqual([3]);
    expect(search.searchObservations('CITRON-BLEU', { dateRange: { end: 999 } })).toEqual([]);
  });

  it('rejects an unbounded blank query without filters', () => {
    expect(() => search.searchObservations('   ')).toThrow('Either query or filters required');
    expect(() => search.searchSessions(undefined)).toThrow('Either query or filters required');
    expect(() => search.searchUserPrompts(undefined)).toThrow('Either query or filters required');
  });
});