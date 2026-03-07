import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import path from 'path';
import { getProjectName } from '../../utils/project-name.js';

export interface RepoContext {
  cwd: string;
  project: string;
  repoRoot: string;
  repoId: string;
  gitBranch: string | null;
  gitCommit: string | null;
  remoteUrl: string | null;
  isGitRepo: boolean;
}

const repoContextCache = new Map<string, RepoContext>();

function runGit(cwd: string, args: string[]): string | null {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    timeout: 2000,
    shell: false,
    windowsHide: true
  });

  if (result.status !== 0) {
    return null;
  }

  const output = result.stdout.trim();
  return output || null;
}

function buildRepoId(repoRoot: string, remoteUrl: string | null): string {
  const source = remoteUrl || repoRoot;
  return createHash('sha1').update(source).digest('hex').slice(0, 16);
}

export function getRepoContext(cwd: string | null | undefined): RepoContext {
  const resolvedCwd = path.resolve(cwd || process.cwd());
  const cached = repoContextCache.get(resolvedCwd);
  if (cached) {
    return cached;
  }

  const repoRoot = runGit(resolvedCwd, ['rev-parse', '--show-toplevel']) || resolvedCwd;
  const remoteUrl = runGit(repoRoot, ['config', '--get', 'remote.origin.url']);
  const branch = runGit(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const commit = runGit(repoRoot, ['rev-parse', 'HEAD']);

  const context: RepoContext = {
    cwd: resolvedCwd,
    project: getProjectName(repoRoot),
    repoRoot,
    repoId: buildRepoId(repoRoot, remoteUrl),
    gitBranch: branch === 'HEAD' ? null : branch,
    gitCommit: commit,
    remoteUrl,
    isGitRepo: repoRoot !== resolvedCwd || !!remoteUrl || !!branch || !!commit
  };

  repoContextCache.set(resolvedCwd, context);
  return context;
}

export function clearRepoContextCache(): void {
  repoContextCache.clear();
}

