#!/usr/bin/env node
import { spawnSync } from 'child_process';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const pluginScriptsDir = join(packageRoot, 'plugin', 'scripts');
const codexSetupScript = join(pluginScriptsDir, 'codex-setup.js');
const bunRunnerScript = join(pluginScriptsDir, 'bun-runner.js');
const workerServiceScript = join(pluginScriptsDir, 'worker-service.cjs');

function printUsage() {
  console.log(`
Usage:
  npx codex-mem-cli@latest codex setup
  npx codex-mem-cli@latest codex doctor
  npx codex-mem-cli@latest <worker-service-args...>
`);
}

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  printUsage();
  process.exit(0);
}

let result;
if (args[0] === 'codex' && ['setup', 'doctor'].includes(args[1] || 'setup')) {
  const forwarded = args[1] ? args.slice(1) : ['setup'];
  result = spawnSync(process.execPath, [codexSetupScript, ...forwarded], {
    stdio: 'inherit',
    env: process.env
  });
} else {
  result = spawnSync(process.execPath, [bunRunnerScript, workerServiceScript, ...args], {
    stdio: 'inherit',
    env: process.env
  });
}

process.exit(result.status ?? 0);
