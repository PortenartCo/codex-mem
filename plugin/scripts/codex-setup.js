#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from 'fs';
import { homedir } from 'os';
import path, { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const MANAGED_BLOCK_START = '# >>> claude-mem codex setup >>>';
export const MANAGED_BLOCK_END = '# <<< claude-mem codex setup <<<';
export const DEFAULT_DATA_DIR = process.env.CLAUDE_MEM_DATA_DIR || join(homedir(), '.claude-mem');
export const DEFAULT_INSTALL_ROOT = process.env.CLAUDE_MEM_CODEX_INSTALL_DIR || join(DEFAULT_DATA_DIR, 'codex');
export const DEFAULT_CODEX_HOME = process.env.CODEX_HOME || join(homedir(), '.codex');
export const DEFAULT_CONFIG_PATH = join(DEFAULT_CODEX_HOME, 'config.toml');
export const FORWARD_NOTIFY_STATE_PATH = join(DEFAULT_DATA_DIR, 'codex-notify-forward.json');
const IS_WINDOWS = process.platform === 'win32';

function printUsage() {
  console.log(`
Usage:
  codex-mem codex setup [--config-path /path/to/config.toml] [--install-dir /path/to/install] [--force-notify]
  codex-mem codex doctor [--config-path /path/to/config.toml] [--install-dir /path/to/install]

Commands:
  setup   Copy the bundled runtime to a stable location, configure Codex, and start the worker
  doctor  Verify the Codex installation and worker health
`);
}

export function parseArgs(argv) {
  const args = [...argv];
  const command = args[0] && !args[0].startsWith('--') ? args.shift() : 'setup';
  const options = {
    configPath: DEFAULT_CONFIG_PATH,
    installRoot: DEFAULT_INSTALL_ROOT,
    forceNotify: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    switch (current) {
      case '--config-path':
        options.configPath = args[index + 1] || options.configPath;
        index += 1;
        break;
      case '--install-dir':
        options.installRoot = args[index + 1] || options.installRoot;
        index += 1;
        break;
      case '--force-notify':
        options.forceNotify = true;
        break;
      case '--help':
      case '-h':
        return { command: 'help', options };
      default:
        throw new Error(`Unknown argument: ${current}`);
    }
  }

  return { command, options };
}

export function resolveSourcePluginRoot() {
  return resolve(__dirname, '..');
}

export function resolveRuntimePaths(installRoot = DEFAULT_INSTALL_ROOT) {
  return {
    installRoot,
    nodePath: process.execPath,
    smartInstallPath: join(installRoot, 'scripts', 'smart-install.js'),
    bunRunnerPath: join(installRoot, 'scripts', 'bun-runner.js'),
    workerServicePath: join(installRoot, 'scripts', 'worker-service.cjs'),
    mcpServerPath: join(installRoot, 'scripts', 'mcp-server.cjs'),
    notifyScriptPath: join(installRoot, 'scripts', 'codex-notify.js')
  };
}

export function ensureDirectory(directoryPath) {
  mkdirSync(directoryPath, { recursive: true });
}

export function copyPluginBundle(sourceRoot, installRoot) {
  if (path.resolve(sourceRoot) === path.resolve(installRoot)) {
    return;
  }

  ensureDirectory(path.dirname(installRoot));
  rmSync(installRoot, { recursive: true, force: true });
  cpSync(sourceRoot, installRoot, { recursive: true });
}

function runNodeScript(scriptPath, args = [], env = {}) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ...env
    }
  });
}

export function findBunPath() {
  try {
    const pathCheck = spawnSync('bun', ['--version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: IS_WINDOWS
    });

    if (pathCheck.status === 0) {
      return 'bun';
    }
  } catch {
    // Fall through to common install locations
  }

  const commonPaths = IS_WINDOWS
    ? [join(homedir(), '.bun', 'bin', 'bun.exe')]
    : [
        join(homedir(), '.bun', 'bin', 'bun'),
        '/usr/local/bin/bun',
        '/opt/homebrew/bin/bun',
        '/home/linuxbrew/.linuxbrew/bin/bun'
      ];

  return commonPaths.find(candidate => existsSync(candidate)) || null;
}

export function serializeTomlString(value) {
  return JSON.stringify(value);
}

export function serializeTomlStringArray(values) {
  return `[${values.map(serializeTomlString).join(', ')}]`;
}

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stripManagedCodexBlock(content) {
  const blockPattern = new RegExp(
    `${escapeForRegExp(MANAGED_BLOCK_START)}[\\s\\S]*?${escapeForRegExp(MANAGED_BLOCK_END)}\\n?`,
    'g'
  );

  return content.replace(blockPattern, '').replace(/\n{3,}/g, '\n\n').trimEnd();
}

export function removeTomlTable(content, tableName) {
  const lines = content.split(/\r?\n/);
  const output = [];
  let skipping = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!skipping && trimmed === `[${tableName}]`) {
      skipping = true;
      continue;
    }

    if (skipping && /^\s*\[/.test(trimmed)) {
      skipping = false;
    }

    if (!skipping) {
      output.push(line);
    }
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function countBracketDelta(line) {
  const opens = (line.match(/\[/g) || []).length;
  const closes = (line.match(/\]/g) || []).length;
  return opens - closes;
}

export function extractAndRemoveTopLevelKey(content, keyName) {
  const lines = content.split(/\r?\n/);
  const output = [];
  const captured = [];
  let collecting = false;
  let bracketDepth = 0;
  let sawSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!collecting && /^\s*\[/.test(trimmed)) {
      sawSection = true;
    }

    if (!collecting && !sawSection && new RegExp(`^${keyName}\\s*=`).test(trimmed)) {
      collecting = true;
      captured.push(line);
      bracketDepth += countBracketDelta(line);

      if (bracketDepth <= 0) {
        collecting = false;
        bracketDepth = 0;
      }
      continue;
    }

    if (collecting) {
      captured.push(line);
      bracketDepth += countBracketDelta(line);

      if (bracketDepth <= 0) {
        collecting = false;
        bracketDepth = 0;
      }
      continue;
    }

    output.push(line);
  }

  return {
    content: output.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd(),
    rawValue: captured.length > 0 ? captured.join('\n').trim() : null
  };
}

export function parseTomlStringArray(rawValue) {
  if (!rawValue) {
    return null;
  }

  const startIndex = rawValue.indexOf('[');
  const endIndex = rawValue.lastIndexOf(']');
  if (startIndex < 0 || endIndex <= startIndex) {
    return null;
  }

  const arrayText = rawValue
    .slice(startIndex, endIndex + 1)
    .replace(/^\s*#.*$/gm, '')
    .replace(/,\s*]/g, ']');

  try {
    const parsed = JSON.parse(arrayText);
    return Array.isArray(parsed) && parsed.every(item => typeof item === 'string') ? parsed : null;
  } catch {
    return null;
  }
}

function isClaudeMemNotifyCommand(command, notifyScriptPath) {
  if (!Array.isArray(command) || command.length === 0) {
    return false;
  }

  const normalizedNotifyPath = path.normalize(notifyScriptPath);
  return command.some(entry => typeof entry === 'string' && path.normalize(entry) === normalizedNotifyPath);
}

export function buildManagedCodexBlock(runtimePaths) {
  return [
    MANAGED_BLOCK_START,
    `notify = ${serializeTomlStringArray([runtimePaths.nodePath, runtimePaths.notifyScriptPath])}`,
    '',
    '[mcp_servers.codex_mem]',
    `command = ${serializeTomlString(runtimePaths.nodePath)}`,
    `args = ${serializeTomlStringArray([runtimePaths.mcpServerPath])}`,
    'enabled = true',
    'required = false',
    MANAGED_BLOCK_END
  ].join('\n');
}

export function upsertCodexConfig(content, runtimePaths, options = {}) {
  const strippedManaged = stripManagedCodexBlock(content);
  const strippedMcp = removeTomlTable(strippedManaged, 'mcp_servers.codex_mem');
  const notifyResult = extractAndRemoveTopLevelKey(strippedMcp, 'notify');

  const parsedNotify = parseTomlStringArray(notifyResult.rawValue);
  if (notifyResult.rawValue && !parsedNotify && !options.forceNotify) {
    throw new Error(
      'Found an existing Codex notify setting that codex-mem could not safely preserve. ' +
      'Re-run with --force-notify to replace it.'
    );
  }

  const managedBlock = buildManagedCodexBlock(runtimePaths);
  const nextContent = [notifyResult.content, managedBlock].filter(Boolean).join('\n\n').trimEnd() + '\n';

  return {
    content: nextContent,
    forwardNotifyCommand:
      parsedNotify && !isClaudeMemNotifyCommand(parsedNotify, runtimePaths.notifyScriptPath) ? parsedNotify : null
  };
}

function writeForwardNotifyState(forwardNotifyCommand) {
  ensureDirectory(DEFAULT_DATA_DIR);

  if (!forwardNotifyCommand || forwardNotifyCommand.length === 0) {
    if (existsSync(FORWARD_NOTIFY_STATE_PATH)) {
      unlinkSync(FORWARD_NOTIFY_STATE_PATH);
    }
    return;
  }

  writeFileSync(
    FORWARD_NOTIFY_STATE_PATH,
    JSON.stringify(
      {
        command: forwardNotifyCommand,
        updatedAt: new Date().toISOString()
      },
      null,
      2
    ) + '\n',
    'utf-8'
  );
}

async function waitForWorkerHealth(port) {
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(1500)
      });

      if (response.ok) {
        return true;
      }
    } catch {
      // Keep polling until timeout
    }

    await new Promise(resolvePromise => setTimeout(resolvePromise, 500));
  }

  return false;
}

function spawnRuntimeStart(runtimePaths) {
  const bunPath = findBunPath();
  if (!bunPath) {
    throw new Error('Bun not found after smart-install completed');
  }

  return spawn(bunPath, [runtimePaths.workerServicePath, 'start'], {
    stdio: 'ignore',
    detached: false,
    windowsHide: true,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: runtimePaths.installRoot
    }
  });
}

function installRuntime(installRoot) {
  const sourceRoot = resolveSourcePluginRoot();
  copyPluginBundle(sourceRoot, installRoot);

  const runtimePaths = resolveRuntimePaths(installRoot);
  const installResult = runNodeScript(runtimePaths.smartInstallPath, [], {
    CLAUDE_PLUGIN_ROOT: installRoot
  });

  if (installResult.status !== 0) {
    throw new Error(installResult.stderr.trim() || installResult.stdout.trim() || 'smart-install failed');
  }

  return runtimePaths;
}

async function setupCodex(options) {
  const runtimePaths = installRuntime(options.installRoot);
  ensureDirectory(path.dirname(options.configPath));

  const existingConfig = existsSync(options.configPath) ? readFileSync(options.configPath, 'utf-8') : '';
  const updatedConfig = upsertCodexConfig(existingConfig, runtimePaths, {
    forceNotify: options.forceNotify
  });

  writeFileSync(options.configPath, updatedConfig.content, 'utf-8');
  writeForwardNotifyState(updatedConfig.forwardNotifyCommand);

  const workerPort = Number(process.env.CLAUDE_MEM_WORKER_PORT || 37777);
  let startHelper = null;
  let startError = null;

  const alreadyHealthy = await waitForWorkerHealth(workerPort);
  if (!alreadyHealthy) {
    startHelper = spawnRuntimeStart(runtimePaths);
    startHelper.on('error', error => {
      startError = error;
    });
  }

  const healthy = alreadyHealthy || await waitForWorkerHealth(workerPort);
  if (startHelper && startHelper.exitCode === null) {
    try {
      startHelper.kill('SIGTERM');
    } catch {
      // Helper is best-effort cleanup only
    }
  }

  if (!healthy) {
    if (startError) {
      throw startError;
    }
    throw new Error(`worker did not become healthy on http://127.0.0.1:${workerPort}`);
  }

  console.log('codex-mem setup complete');
  console.log(`  Install root: ${options.installRoot}`);
  console.log(`  Codex config: ${options.configPath}`);
  console.log(`  Worker: http://127.0.0.1:${workerPort}`);
  if (updatedConfig.forwardNotifyCommand) {
    console.log('  Notify: existing Codex notify command preserved and chained');
  }
  console.log('  Next step: start Codex normally and use the codex_mem MCP tools');
}

async function runDoctor(options) {
  const runtimePaths = resolveRuntimePaths(options.installRoot);
  const issues = [];

  if (!existsSync(runtimePaths.workerServicePath)) {
    issues.push(`missing runtime: ${runtimePaths.workerServicePath}`);
  }

  if (!existsSync(runtimePaths.mcpServerPath)) {
    issues.push(`missing MCP server: ${runtimePaths.mcpServerPath}`);
  }

  if (!existsSync(runtimePaths.notifyScriptPath)) {
    issues.push(`missing notify script: ${runtimePaths.notifyScriptPath}`);
  }

  if (!existsSync(options.configPath)) {
    issues.push(`missing Codex config: ${options.configPath}`);
  } else {
    const config = readFileSync(options.configPath, 'utf-8');
    if (!config.includes('[mcp_servers.codex_mem]')) {
      issues.push('Codex config does not include [mcp_servers.codex_mem]');
    }
    if (!config.includes('codex-notify.js')) {
      issues.push('Codex config does not route notify through codex-notify.js');
    }
  }

  const workerPort = Number(process.env.CLAUDE_MEM_WORKER_PORT || 37777);
  const healthy = await waitForWorkerHealth(workerPort);
  if (!healthy) {
    issues.push(`worker is not healthy on http://127.0.0.1:${workerPort}`);
  }

  if (issues.length === 0) {
    console.log('codex-mem doctor: healthy');
    console.log(`  Install root: ${options.installRoot}`);
    console.log(`  Codex config: ${options.configPath}`);
    console.log(`  Worker: http://127.0.0.1:${workerPort}`);
    return;
  }

  console.error('codex-mem doctor found issues:');
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  process.exit(1);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (command === 'help') {
    printUsage();
    return;
  }

  if (command === 'setup') {
    await setupCodex(options);
    return;
  }

  if (command === 'doctor') {
    await runDoctor(options);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

const isMainModule =
  typeof require !== 'undefined'
    ? require.main === module
    : import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('codex-setup.js');

if (isMainModule) {
  main().catch(error => {
    console.error(`codex-mem setup failed: ${error.message}`);
    process.exit(1);
  });
}
