import { describe, expect, it } from 'bun:test';
import {
  normalizeCodexAppServerMessage,
  normalizeCodexExecJsonEntry,
  normalizeCodexNotifyPayload
} from '../../src/services/platform/codex.js';

describe('Codex normalization', () => {
  it('normalizes notify payloads into prompt and turn events', () => {
    const events = normalizeCodexNotifyPayload({
      'thread-id': 'thread-123',
      'turn-id': 'turn-456',
      cwd: process.cwd(),
      'input-messages': [
        { role: 'system', content: 'ignore' },
        { role: 'user', content: 'resume the auth refactor' }
      ],
      'last-assistant-message': 'Implemented the auth refactor.'
    });

    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe('prompt.submitted');
    expect(events[0].promptText).toBe('resume the auth refactor');
    expect(events[1].eventType).toBe('turn.completed');
    expect(events[1].assistantText).toBe('Implemented the auth refactor.');
    expect(events[0].platform).toBe('codex');
    expect(events[0].clientKind).toBe('codex-cli');
    expect(events[0].captureMode).toBe('notify');
  });

  it('normalizes exec --json item completion into command execution events', () => {
    const events = normalizeCodexExecJsonEntry({
      type: 'item.completed',
      thread_id: 'thread-123',
      turn_id: 'turn-456',
      cwd: process.cwd(),
      item: {
        type: 'CommandExecution',
        command: 'git status',
        output: 'clean'
      }
    });

    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('command.execution');
    expect(events[0].toolInput).toBe('git status');
    expect(events[0].toolOutput).toBe('clean');
    expect(events[0].clientKind).toBe('codex-exec');
    expect(events[0].captureMode).toBe('exec-json');
  });

  it('normalizes app-server approval notifications', () => {
    const events = normalizeCodexAppServerMessage({
      method: 'item/commandExecution/requestApproval',
      params: {
        threadId: 'thread-789',
        turnId: 'turn-999'
      },
      cwd: process.cwd()
    });

    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('approval.requested');
    expect(events[0].clientKind).toBe('codex-app-server');
    expect(events[0].captureMode).toBe('app-server');
  });

  it('normalizes app-server thread completion into a session completion event', () => {
    const events = normalizeCodexAppServerMessage({
      method: 'thread/completed',
      params: {
        threadId: 'thread-789',
        output: 'Finished syncing the session graph.'
      },
      cwd: process.cwd()
    });

    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('session.completed');
    expect(events[0].assistantText).toBe('Finished syncing the session graph.');
    expect(events[0].clientKind).toBe('codex-app-server');
    expect(events[0].captureMode).toBe('app-server');
  });

  it('normalizes app-server thread completion notifications', () => {
    const events = normalizeCodexAppServerMessage({
      method: 'thread/completed',
      params: {
        threadId: 'thread-789',
        result: 'Finished session'
      },
      cwd: process.cwd()
    });

    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('session.completed');
    expect(events[0].assistantText).toBe('Finished session');
    expect(events[0].clientKind).toBe('codex-app-server');
  });
});
