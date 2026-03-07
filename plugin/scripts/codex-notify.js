#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = process.env.CLAUDE_MEM_DATA_DIR || join(homedir(), '.claude-mem');
const FORWARD_NOTIFY_STATE_PATH = join(DATA_DIR, 'codex-notify-forward.json');

function readForwardCommand() {
  if (!existsSync(FORWARD_NOTIFY_STATE_PATH)) {
    return null;
  }

  try {
    const state = JSON.parse(readFileSync(FORWARD_NOTIFY_STATE_PATH, 'utf-8'));
    return Array.isArray(state.command) ? state.command : null;
  } catch {
    return null;
  }
}

function readStdin() {
  return new Promise(resolvePromise => {
    if (process.stdin.isTTY) {
      resolvePromise('');
      return;
    }

    const chunks = [];
    process.stdin.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    process.stdin.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', () => resolvePromise(''));
  });
}

function spawnCommand(command, args, payloadText, payloadSource) {
  return new Promise(resolvePromise => {
    const useStdin = payloadSource === 'stdin';
    const child = spawn(command, payloadSource === 'argv' && payloadText ? [...args, payloadText] : args, {
      stdio: [useStdin ? 'pipe' : 'ignore', 'ignore', 'inherit'],
      windowsHide: true,
      env: process.env
    });

    child.on('error', error => {
      console.error(`codex-mem notify command failed to start: ${error.message}`);
      resolvePromise(1);
    });

    child.on('close', code => {
      resolvePromise(code ?? 0);
    });

    if (useStdin && child.stdin) {
      child.stdin.write(payloadText);
      child.stdin.end();
    }
  });
}

async function main() {
  const argvPayload = process.argv.slice(2).join(' ').trim();
  const payloadSource = argvPayload ? 'argv' : 'stdin';
  const payloadText = argvPayload || (await readStdin());
  const forwardCommand = readForwardCommand();

  const bunRunnerPath = join(__dirname, 'bun-runner.js');
  const workerServicePath = join(__dirname, 'worker-service.cjs');

  const exitCodes = [];
  exitCodes.push(
    await spawnCommand(process.execPath, [bunRunnerPath, workerServicePath, 'codex', 'notify'], payloadText, 'stdin')
  );

  if (forwardCommand && forwardCommand.length > 0) {
    exitCodes.push(
      await spawnCommand(forwardCommand[0], forwardCommand.slice(1), payloadText, payloadSource)
    );
  }

  if (exitCodes.some(code => code !== 0)) {
    console.error('codex-mem notify completed with non-fatal errors');
  }
}

main().catch(error => {
  console.error(`codex-mem notify failed: ${error.message}`);
  process.exit(0);
});
