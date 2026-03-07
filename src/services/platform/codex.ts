import { buildNormalizedEvent } from './normalization.js';
import { getRepoContext } from './repo-context.js';
import type {
  MemoryCaptureFidelity,
  MemoryCaptureMode,
  MemoryClientKind,
  MemorySourceConfidence,
  NormalizedEvent
} from './types.js';

type AnyRecord = Record<string, any>;

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' ? value as AnyRecord : null;
}

function getByPath(value: unknown, path: string): unknown {
  const root = asRecord(value);
  if (!root) return undefined;

  const parts = path.split('.');
  let current: unknown = root;
  for (const part of parts) {
    const record = asRecord(current);
    if (!record || !(part in record)) {
      return undefined;
    }
    current = record[part];
  }

  return current;
}

function pickValue(value: unknown, candidates: string[]): unknown {
  for (const candidate of candidates) {
    const found = getByPath(value, candidate);
    if (found !== undefined && found !== null) {
      return found;
    }
  }
  return undefined;
}

function pickString(value: unknown, candidates: string[]): string | null {
  const found = pickValue(value, candidates);
  if (typeof found === 'string') {
    const trimmed = found.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof found === 'number' || typeof found === 'boolean') {
    return String(found);
  }
  return null;
}

function pickNumber(value: unknown, candidates: string[]): number | null {
  const found = pickValue(value, candidates);
  if (typeof found === 'number' && Number.isFinite(found)) {
    return found;
  }
  if (typeof found === 'string') {
    const parsed = Number(found);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (Array.isArray(value)) {
    const parts = value.map(extractText).filter(Boolean) as string[];
    return parts.length ? parts.join('\n') : null;
  }

  const record = asRecord(value);
  if (!record) return null;

  const fromDirectFields = pickString(record, [
    'text',
    'message',
    'content',
    'output',
    'result',
    'assistant',
    'prompt',
    'summary',
    'reasoning'
  ]);
  if (fromDirectFields) {
    return fromDirectFields;
  }

  const nested = pickValue(record, ['content', 'message', 'output', 'result', 'items']);
  if (nested !== undefined) {
    return extractText(nested);
  }

  return null;
}

function extractLastUserPrompt(messages: unknown): string | null {
  if (!Array.isArray(messages)) {
    return extractText(messages);
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const role = pickString(message, ['role', 'type']);
    if (!role) continue;

    const normalizedRole = role.toLowerCase();
    if (normalizedRole.includes('user')) {
      return extractText(pickValue(message, ['content', 'message', 'text', 'payload']));
    }
  }

  return null;
}

function buildCodexSessionBase(
  source: unknown,
  clientKind: MemoryClientKind,
  captureMode: MemoryCaptureMode,
  sourceConfidence: MemorySourceConfidence,
  captureFidelity: MemoryCaptureFidelity
) {
  const cwd = pickString(source, ['cwd', 'payload.cwd', 'params.cwd']) || process.cwd();
  const repo = getRepoContext(cwd);
  const platformSessionId = pickString(source, [
    'thread-id',
    'thread_id',
    'threadId',
    'payload.thread_id',
    'payload.threadId',
    'params.threadId',
    'params.thread_id',
    'session_id',
    'sessionId',
    'id'
  ]) || `codex-${Date.now()}`;

  return {
    platform: 'codex' as const,
    clientKind,
    captureMode,
    platformSessionId,
    platformTurnId: pickString(source, ['turn-id', 'turn_id', 'turnId', 'payload.turn_id', 'payload.turnId', 'params.turnId', 'params.turn_id']),
    itemId: pickString(source, ['itemId', 'item_id', 'payload.item_id', 'payload.itemId', 'params.itemId', 'params.item_id']),
    parentSessionId: pickString(source, ['parent_thread_id', 'parentThreadId', 'payload.parent_thread_id', 'params.parentThreadId']),
    agentRole: pickString(source, ['agentRole', 'agent_role', 'workerRole', 'params.agentRole']),
    cwd: repo.cwd,
    project: repo.project,
    repoRoot: repo.repoRoot,
    repoId: repo.repoId,
    gitBranch: repo.gitBranch,
    gitCommit: repo.gitCommit,
    sourceConfidence,
    captureFidelity
  };
}

function normalizeTimestamp(source: unknown): number {
  const epochMs = pickNumber(source, [
    'timestamp_ms',
    'timestampMs',
    'created_at_epoch_ms',
    'createdAtEpochMs',
    'created_at_epoch',
    'createdAtEpoch',
    'timestamp',
    'ts'
  ]);

  if (epochMs && epochMs > 10_000_000_000) {
    return epochMs;
  }
  if (epochMs) {
    return epochMs * 1000;
  }
  return Date.now();
}

function mapItemEventType(itemType: string | null, status: 'started' | 'completed'): string {
  const normalized = (itemType || '').toLowerCase();

  if (normalized.includes('commandexecution') || normalized === 'command' || normalized.includes('exec_command')) {
    return 'command.execution';
  }
  if (normalized.includes('filechange')) {
    return 'file.change';
  }
  if (normalized.includes('contextcompaction') || normalized.includes('compaction')) {
    return 'context.compacted';
  }
  if (normalized.includes('search')) {
    return 'web.search';
  }
  if (normalized.includes('approval')) {
    return status === 'started' ? 'approval.requested' : 'approval.resolved';
  }

  return status === 'started' ? 'tool.used' : 'tool.output';
}

function buildItemEvent(
  source: unknown,
  clientKind: MemoryClientKind,
  captureMode: MemoryCaptureMode,
  status: 'started' | 'completed',
  sourceConfidence: MemorySourceConfidence,
  captureFidelity: MemoryCaptureFidelity
): NormalizedEvent[] {
  const item = pickValue(source, ['item', 'payload.item', 'params.item']) || source;
  const itemType = pickString(item, ['type', 'kind', 'itemType']);
  const toolName = pickString(item, ['name', 'toolName', 'tool_name']);
  const toolInput = pickValue(item, ['arguments', 'input', 'params', 'command', 'query', 'search']);
  const toolOutput = pickValue(item, ['output', 'result', 'response', 'content']);
  const eventType = mapItemEventType(itemType, status);
  const base = buildCodexSessionBase(source, clientKind, captureMode, sourceConfidence, captureFidelity);

  return [
    buildNormalizedEvent({
      ...base,
      eventType,
      createdAtEpochMs: normalizeTimestamp(source),
      privacyState: 'normal',
      promptText: status === 'started' ? extractText(toolInput) : null,
      assistantText: status === 'completed' ? extractText(toolOutput) : null,
      summaryText: status === 'completed' ? extractText(toolOutput) : null,
      toolName: toolName || itemType,
      toolInput,
      toolOutput,
      payload: source
    })
  ];
}

export function normalizeCodexNotifyPayload(payload: unknown): NormalizedEvent[] {
  const base = buildCodexSessionBase(payload, 'codex-cli', 'notify', 'medium', 'low');
  const promptText = extractLastUserPrompt(
    pickValue(payload, ['input-messages', 'input_messages', 'inputMessages', 'payload.input_messages', 'payload.inputMessages'])
  );
  const assistantText = extractText(
    pickValue(payload, ['last-assistant-message', 'last_assistant_message', 'lastAssistantMessage', 'payload.last_assistant_message', 'payload.lastAssistantMessage'])
  );
  const createdAtEpochMs = normalizeTimestamp(payload);
  const events: NormalizedEvent[] = [];

  if (promptText) {
    events.push(
      buildNormalizedEvent({
        ...base,
        eventType: 'prompt.submitted',
        createdAtEpochMs,
        privacyState: 'normal',
        promptText,
        summaryText: promptText,
        payload
      })
    );
  }

  events.push(
    buildNormalizedEvent({
      ...base,
      eventType: 'turn.completed',
      createdAtEpochMs,
      privacyState: 'normal',
      assistantText,
      summaryText: assistantText,
      payload
    })
  );

  return events;
}

export function normalizeCodexExecJsonEntry(entry: unknown): NormalizedEvent[] {
  const eventType = (pickString(entry, ['type', 'event.type', 'event']) || '').replace(/_/g, '.').toLowerCase();
  const base = buildCodexSessionBase(entry, 'codex-exec', 'exec-json', 'high', 'medium');
  const createdAtEpochMs = normalizeTimestamp(entry);

  if (eventType === 'thread.started') {
    return [
      buildNormalizedEvent({
        ...base,
        eventType: 'session.started',
        createdAtEpochMs,
        privacyState: 'normal',
        summaryText: extractText(entry),
        payload: entry
      })
    ];
  }

  if (eventType === 'thread.completed') {
    return [
      buildNormalizedEvent({
        ...base,
        eventType: 'session.completed',
        createdAtEpochMs,
        privacyState: 'normal',
        assistantText: extractText(entry),
        summaryText: extractText(entry),
        payload: entry
      })
    ];
  }

  if (eventType === 'turn.started') {
    const promptText = extractText(pickValue(entry, ['input', 'prompt', 'message', 'user_message', 'payload.message']));
    return [
      buildNormalizedEvent({
        ...base,
        eventType: 'prompt.submitted',
        createdAtEpochMs,
        privacyState: 'normal',
        promptText,
        summaryText: promptText,
        payload: entry
      })
    ];
  }

  if (eventType === 'turn.completed') {
    const assistantText = extractText(pickValue(entry, ['output', 'message', 'result', 'assistant_message']));
    return [
      buildNormalizedEvent({
        ...base,
        eventType: 'turn.completed',
        createdAtEpochMs,
        privacyState: 'normal',
        assistantText,
        summaryText: assistantText,
        payload: entry
      })
    ];
  }

  if (eventType === 'item.started') {
    return buildItemEvent(entry, 'codex-exec', 'exec-json', 'started', 'high', 'medium');
  }

  if (eventType === 'item.completed') {
    return buildItemEvent(entry, 'codex-exec', 'exec-json', 'completed', 'high', 'medium');
  }

  if (eventType === 'error') {
    return [
      buildNormalizedEvent({
        ...base,
        eventType: 'turn.completed',
        createdAtEpochMs,
        privacyState: 'normal',
        assistantText: extractText(entry),
        summaryText: extractText(entry),
        payload: entry
      })
    ];
  }

  return [];
}

export function normalizeCodexAppServerMessage(message: unknown): NormalizedEvent[] {
  const method = (pickString(message, ['method', 'params.method']) || '').toLowerCase();

  if (method === 'item/started') {
    return buildItemEvent(message, 'codex-app-server', 'app-server', 'started', 'high', 'high');
  }
  if (method === 'item/completed') {
    return buildItemEvent(message, 'codex-app-server', 'app-server', 'completed', 'high', 'high');
  }
  if (method === 'item/commandexecution/requestapproval' || method === 'item/filechange/requestapproval') {
    const base = buildCodexSessionBase(message, 'codex-app-server', 'app-server', 'high', 'high');
    return [
      buildNormalizedEvent({
        ...base,
        eventType: 'approval.requested',
        createdAtEpochMs: normalizeTimestamp(message),
        privacyState: 'normal',
        summaryText: extractText(message),
        payload: message
      })
    ];
  }
  if (method === 'thread/started') {
    const base = buildCodexSessionBase(message, 'codex-app-server', 'app-server', 'high', 'high');
    return [
      buildNormalizedEvent({
        ...base,
        eventType: 'session.started',
        createdAtEpochMs: normalizeTimestamp(message),
        privacyState: 'normal',
        summaryText: extractText(message),
        payload: message
      })
    ];
  }
  if (method === 'thread/completed') {
    const base = buildCodexSessionBase(message, 'codex-app-server', 'app-server', 'high', 'high');
    const assistantText = extractText(pickValue(message, ['params.output', 'params.result', 'params.summary', 'params.thread']));
    return [
      buildNormalizedEvent({
        ...base,
        eventType: 'session.completed',
        createdAtEpochMs: normalizeTimestamp(message),
        privacyState: 'normal',
        assistantText,
        summaryText: assistantText,
        payload: message
      })
    ];
  }
  if (method === 'turn/started') {
    const base = buildCodexSessionBase(message, 'codex-app-server', 'app-server', 'high', 'high');
    const promptText = extractText(pickValue(message, ['params.input', 'params.prompt', 'params.message']));
    return [
      buildNormalizedEvent({
        ...base,
        eventType: 'prompt.submitted',
        createdAtEpochMs: normalizeTimestamp(message),
        privacyState: 'normal',
        promptText,
        summaryText: promptText,
        payload: message
      })
    ];
  }
  if (method === 'turn/completed' || method === 'turn/completednotification') {
    const base = buildCodexSessionBase(message, 'codex-app-server', 'app-server', 'high', 'high');
    const assistantText = extractText(pickValue(message, ['params.output', 'params.result', 'params.turn', 'params.item']));
    return [
      buildNormalizedEvent({
        ...base,
        eventType: 'turn.completed',
        createdAtEpochMs: normalizeTimestamp(message),
        privacyState: 'normal',
        assistantText,
        summaryText: assistantText,
        payload: message
      })
    ];
  }

  // Support event-stream shaped app-server payloads that expose `type` rather than `method`.
  const type = (pickString(message, ['type']) || '').replace(/_/g, '.').toLowerCase();
  if (type === 'thread.started' || type === 'thread.completed') {
    const base = buildCodexSessionBase(message, 'codex-app-server', 'app-server', 'high', 'high');
    const isCompleted = type.endsWith('completed');
    const assistantText = isCompleted
      ? extractText(pickValue(message, ['output', 'result', 'summary', 'thread']))
      : null;
    return [
      buildNormalizedEvent({
        ...base,
        eventType: isCompleted ? 'session.completed' : 'session.started',
        createdAtEpochMs: normalizeTimestamp(message),
        privacyState: 'normal',
        assistantText,
        summaryText: assistantText || extractText(message),
        payload: message
      })
    ];
  }
  if (type === 'context.compacted' || type === 'context.compaction') {
    const base = buildCodexSessionBase(message, 'codex-app-server', 'app-server', 'high', 'high');
    return [
      buildNormalizedEvent({
        ...base,
        eventType: 'context.compacted',
        createdAtEpochMs: normalizeTimestamp(message),
        privacyState: 'normal',
        summaryText: extractText(message),
        payload: message
      })
    ];
  }
  if (type === 'exec.command.begin' || type === 'exec.command.end') {
    return buildItemEvent(message, 'codex-app-server', 'app-server', type.endsWith('begin') ? 'started' : 'completed', 'high', 'high');
  }
  if (type === 'web.search.begin' || type === 'web.search.end') {
    const base = buildCodexSessionBase(message, 'codex-app-server', 'app-server', 'high', 'high');
    return [
      buildNormalizedEvent({
        ...base,
        eventType: 'web.search',
        createdAtEpochMs: normalizeTimestamp(message),
        privacyState: 'normal',
        toolName: 'web_search',
        toolInput: pickValue(message, ['query', 'search']),
        toolOutput: pickValue(message, ['result', 'output']),
        summaryText: extractText(message),
        payload: message
      })
    ];
  }

  return [];
}
