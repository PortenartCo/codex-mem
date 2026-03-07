import { createInterface } from 'readline';
import { readFile } from 'fs/promises';
import { getWorkerHost, getWorkerPort } from '../../shared/worker-utils.js';
import { logger } from '../../utils/logger.js';
import {
  normalizeCodexAppServerMessage,
  normalizeCodexExecJsonEntry,
  normalizeCodexNotifyPayload
} from './codex.js';
import type { NormalizedEvent } from './types.js';

const WORKER_BASE_URL = `http://${getWorkerHost()}:${getWorkerPort()}`;
const DEFAULT_BATCH_SIZE = 50;

async function postEvents(events: NormalizedEvent[]): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const response = await fetch(`${WORKER_BASE_URL}/api/events/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ events })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Worker event ingest failed (${response.status}): ${body}`);
  }
}

async function readAllStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return '';
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString('utf-8');
}

async function resolveInputText(args: string[]): Promise<string> {
  const fileFlagIndex = args.indexOf('--file');
  if (fileFlagIndex >= 0 && args[fileFlagIndex + 1]) {
    return await readFile(args[fileFlagIndex + 1], 'utf-8');
  }

  if (args.length > 0) {
    return args.join(' ');
  }

  return await readAllStdin();
}

async function ingestJsonLines(
  args: string[],
  label: string,
  normalizer: (payload: unknown) => NormalizedEvent[]
): Promise<number> {
  const fileFlagIndex = args.indexOf('--file');
  if (fileFlagIndex >= 0 && args[fileFlagIndex + 1]) {
    const contents = await readFile(args[fileFlagIndex + 1], 'utf-8');
    const lines = contents.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    let buffer: NormalizedEvent[] = [];
    let ingested = 0;

    for (const line of lines) {
      buffer.push(...normalizer(JSON.parse(line)));
      if (buffer.length >= DEFAULT_BATCH_SIZE) {
        await postEvents(buffer);
        ingested += buffer.length;
        buffer = [];
      }
    }

    if (buffer.length > 0) {
      await postEvents(buffer);
      ingested += buffer.length;
    }

    logger.info('SYSTEM', `${label} ingest completed`, { ingested });
    return 0;
  }

  if (process.stdin.isTTY) {
    logger.error('SYSTEM', `No ${label} input received. Pipe JSONL or pass --file <path>.`);
    return 1;
  }

  const rl = createInterface({
    input: process.stdin,
    crlfDelay: Infinity
  });

  let buffer: NormalizedEvent[] = [];
  let ingested = 0;

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    buffer.push(...normalizer(JSON.parse(line)));
    if (buffer.length >= DEFAULT_BATCH_SIZE) {
      await postEvents(buffer);
      ingested += buffer.length;
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    await postEvents(buffer);
    ingested += buffer.length;
  }

  logger.info('SYSTEM', `${label} ingest completed`, { ingested });
  return 0;
}

async function handleNotify(args: string[]): Promise<number> {
  const input = (await resolveInputText(args)).trim();
  if (!input) {
    logger.error('SYSTEM', 'No notify payload received. Pass a JSON string or pipe JSON to stdin.');
    return 1;
  }

  const payload = JSON.parse(input);
  const events = normalizeCodexNotifyPayload(payload);
  await postEvents(events);
  logger.info('SYSTEM', 'notify ingest completed', { ingested: events.length });
  return 0;
}

export async function handleCodexCommand(subcommand: string, args: string[]): Promise<number> {
  switch (subcommand) {
    case 'notify':
      return await handleNotify(args);
    case 'exec-json':
      return await ingestJsonLines(args, 'exec-json', normalizeCodexExecJsonEntry);
    case 'app-server':
      return await ingestJsonLines(args, 'app-server', normalizeCodexAppServerMessage);
    default:
      logger.error('SYSTEM', 'Usage: codex-mem codex <notify|exec-json|app-server> [--file path]', {
        subcommand
      });
      return 1;
  }
}
