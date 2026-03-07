import { Database } from 'bun:sqlite';
import path from 'path';
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, appendFileSync } from 'fs';
import { DB_PATH } from '../../shared/paths.js';
import { logger } from '../../utils/logger.js';
import { getRepoContext } from '../platform/repo-context.js';

const START_MARKER = '<!-- codex-mem:start -->';
const END_MARKER = '<!-- codex-mem:end -->';

interface ProjectionOptions {
  cwd?: string;
  dryRun?: boolean;
}

interface SessionProjectionRow {
  id: number;
  project: string;
  status: string;
  git_branch: string | null;
  started_at_epoch: number;
  completed_at_epoch: number | null;
  user_prompt: string | null;
  request: string | null;
  completed: string | null;
  learned: string | null;
  next_steps: string | null;
}

interface ObservationProjectionRow {
  id: number;
  type: string;
  title: string | null;
  subtitle: string | null;
  narrative: string | null;
  created_at_epoch: number;
  git_branch: string | null;
}

function replaceProjectionBlock(existingContent: string, blockContent: string): string {
  const wrapped = `${START_MARKER}\n${blockContent}\n${END_MARKER}`;

  if (!existingContent.trim()) {
    return `${wrapped}\n`;
  }

  const startIndex = existingContent.indexOf(START_MARKER);
  const endIndex = existingContent.indexOf(END_MARKER);
  if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
    return (
      existingContent.slice(0, startIndex) +
      wrapped +
      existingContent.slice(endIndex + END_MARKER.length)
    ).replace(/\n{3,}/g, '\n\n');
  }

  const suffix = existingContent.endsWith('\n') ? '' : '\n';
  return `${existingContent}${suffix}\n${wrapped}\n`;
}

function stripProjectionBlock(existingContent: string): string {
  const pattern = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}\\n?`, 'g');
  return existingContent.replace(pattern, '').replace(/\n{3,}/g, '\n\n').trim();
}

function ensureIgnored(repoRoot: string): void {
  const excludePath = path.join(repoRoot, '.git', 'info', 'exclude');
  if (!existsSync(excludePath)) {
    return;
  }

  const current = readFileSync(excludePath, 'utf-8');
  if (current.includes('/MEMORY.md')) {
    return;
  }

  appendFileSync(excludePath, `${current.endsWith('\n') ? '' : '\n'}# codex-mem\n/MEMORY.md\n`, 'utf-8');
}

export function queryRecentSessions(
  db: Database,
  repoRoot: string,
  project: string,
  limit: number,
  repoId?: string | null
): SessionProjectionRow[] {
  const useRepoIdScope = Boolean(repoId);
  return db.prepare(`
    SELECT s.id, s.project, s.status, s.git_branch, s.started_at_epoch, s.completed_at_epoch,
           s.user_prompt, sum.request, sum.completed, sum.learned, sum.next_steps
    FROM sdk_sessions s
    LEFT JOIN session_summaries sum ON sum.id = (
      SELECT ss.id
      FROM session_summaries ss
      WHERE ss.memory_session_id = s.memory_session_id
      ORDER BY ss.created_at_epoch DESC, ss.id DESC
      LIMIT 1
    )
    WHERE ${
      useRepoIdScope
        ? '(s.repo_id = ? OR (s.repo_id IS NULL AND s.repo_root = ?) OR (s.repo_id IS NULL AND s.repo_root IS NULL AND s.project = ?))'
        : '(s.repo_root = ? OR (s.repo_root IS NULL AND s.project = ?))'
    }
    ORDER BY COALESCE(s.completed_at_epoch, s.started_at_epoch) DESC
    LIMIT ?
  `).all(
    ...(useRepoIdScope ? [repoId, repoRoot, project] : [repoRoot, project]),
    limit
  ) as SessionProjectionRow[];
}

function queryRecentObservations(
  db: Database,
  repoRoot: string,
  project: string,
  limit: number,
  types?: string[],
  repoId?: string | null
): ObservationProjectionRow[] {
  const typeFilter = types && types.length > 0
    ? `AND o.type IN (${types.map(() => '?').join(', ')})`
    : '';
  const useRepoIdScope = Boolean(repoId);

  return db.prepare(`
    SELECT o.id, o.type, o.title, o.subtitle, o.narrative, o.created_at_epoch, o.git_branch
    FROM observations o
    WHERE ${
      useRepoIdScope
        ? '(o.repo_id = ? OR (o.repo_id IS NULL AND o.repo_root = ?) OR (o.repo_id IS NULL AND o.repo_root IS NULL AND o.project = ?))'
        : '(o.repo_root = ? OR (o.repo_root IS NULL AND o.project = ?))'
    }
      AND (o.staleness_score IS NULL OR o.staleness_score < 0.8)
      ${typeFilter}
    ORDER BY o.created_at_epoch DESC
    LIMIT ?
  `).all(
    ...(useRepoIdScope ? [repoId, repoRoot, project] : [repoRoot, project]),
    ...(types || []),
    limit
  ) as ObservationProjectionRow[];
}

function formatProjectionContent(
  repoRoot: string,
  project: string,
  branch: string | null,
  sessions: SessionProjectionRow[],
  decisions: ObservationProjectionRow[],
  observations: ObservationProjectionRow[]
): string {
  const lines: string[] = [];
  lines.push('# Project Memory');
  lines.push('');
  lines.push(`Repo: ${project}`);
  lines.push(`Root: ${repoRoot}`);
  lines.push(`Branch: ${branch || 'unknown'}`);
  lines.push(`Updated: ${new Date().toLocaleString()}`);
  lines.push('');

  lines.push('## Current State');
  lines.push('');
  if (sessions.length === 0) {
    lines.push('- No captured sessions yet.');
  } else {
    for (const session of sessions.slice(0, 3)) {
      const label = session.request || session.user_prompt || 'No request captured';
      const outcome = session.completed || session.learned || session.next_steps || 'No summary yet';
      const date = new Date(session.completed_at_epoch || session.started_at_epoch).toLocaleString();
      lines.push(`- ${date} | ${session.status} | ${label}`);
      lines.push(`  Outcome: ${outcome}`);
    }
  }

  lines.push('');
  lines.push('## Decisions');
  lines.push('');
  if (decisions.length === 0) {
    lines.push('- No high-salience decisions captured yet.');
  } else {
    for (const decision of decisions.slice(0, 5)) {
      lines.push(`- #${decision.id} | ${decision.title || decision.narrative || 'Untitled'}`);
    }
  }

  lines.push('');
  lines.push('## Open Loops');
  lines.push('');
  const openLoops = sessions
    .map(session => session.next_steps)
    .filter((value): value is string => !!value)
    .slice(0, 5);
  if (openLoops.length === 0) {
    lines.push('- No open loops recorded.');
  } else {
    for (const loop of openLoops) {
      lines.push(`- ${loop}`);
    }
  }

  lines.push('');
  lines.push('## Recent Observations');
  lines.push('');
  if (observations.length === 0) {
    lines.push('- No recent observations.');
  } else {
    for (const observation of observations.slice(0, 10)) {
      const label = observation.title || observation.narrative || 'Untitled';
      lines.push(`- #${observation.id} | ${observation.type} | ${label}`);
    }
  }

  return lines.join('\n');
}

export function generateMemoryMdProjection(options: ProjectionOptions = {}): {
  path: string;
  changed: boolean;
  content: string;
} {
  const repo = getRepoContext(options.cwd || process.cwd());
  const memoryPath = path.join(repo.repoRoot, 'MEMORY.md');
  const db = new Database(DB_PATH);

  try {
    const sessions = queryRecentSessions(db, repo.repoRoot, repo.project, 5, repo.repoId);
    const decisions = queryRecentObservations(db, repo.repoRoot, repo.project, 5, ['decision', 'plan', 'bugfix'], repo.repoId);
    const observations = queryRecentObservations(db, repo.repoRoot, repo.project, 10, undefined, repo.repoId);
    const content = formatProjectionContent(
      repo.repoRoot,
      repo.project,
      repo.gitBranch,
      sessions,
      decisions,
      observations
    );

    const existing = existsSync(memoryPath) ? readFileSync(memoryPath, 'utf-8') : '';
    const next = replaceProjectionBlock(existing, content);
    const changed = next !== existing;

    if (!options.dryRun && changed) {
      const tempPath = `${memoryPath}.tmp`;
      writeFileSync(tempPath, next, 'utf-8');
      renameSync(tempPath, memoryPath);
      db.prepare(`
        INSERT INTO memory_projections (
          repo_id, repo_root, project, projection_type, target_path, content,
          generated_at, generated_at_epoch
        )
        VALUES (?, ?, ?, 'memory-md', ?, ?, ?, ?)
        ON CONFLICT(projection_type, target_path) DO UPDATE SET
          repo_id = excluded.repo_id,
          repo_root = excluded.repo_root,
          project = excluded.project,
          content = excluded.content,
          generated_at = excluded.generated_at,
          generated_at_epoch = excluded.generated_at_epoch
      `).run(
        repo.repoId,
        repo.repoRoot,
        repo.project,
        memoryPath,
        content,
        new Date().toISOString(),
        Date.now()
      );
      ensureIgnored(repo.repoRoot);
      logger.info('SYSTEM', 'Updated MEMORY.md projection', {
        path: memoryPath,
        repoRoot: repo.repoRoot
      });
    }

    return { path: memoryPath, changed, content };
  } finally {
    db.close();
  }
}

export function cleanMemoryMdProjection(options: ProjectionOptions = {}): {
  path: string;
  changed: boolean;
} {
  const repo = getRepoContext(options.cwd || process.cwd());
  const memoryPath = path.join(repo.repoRoot, 'MEMORY.md');

  if (!existsSync(memoryPath)) {
    return { path: memoryPath, changed: false };
  }

  const existing = readFileSync(memoryPath, 'utf-8');
  const cleaned = stripProjectionBlock(existing);
  const changed = cleaned !== existing;

  if (!options.dryRun && changed) {
    const db = new Database(DB_PATH);
    if (!cleaned.trim()) {
      unlinkSync(memoryPath);
    } else {
      const tempPath = `${memoryPath}.tmp`;
      writeFileSync(tempPath, `${cleaned}\n`, 'utf-8');
      renameSync(tempPath, memoryPath);
    }
    db.prepare(`
      DELETE FROM memory_projections
      WHERE projection_type = 'memory-md' AND target_path = ?
    `).run(memoryPath);
    db.close();
    logger.info('SYSTEM', 'Cleaned MEMORY.md projection', {
      path: memoryPath,
      repoRoot: repo.repoRoot
    });
  }

  return { path: memoryPath, changed };
}
