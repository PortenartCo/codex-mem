import { createHash, randomUUID } from 'crypto';
import type { NormalizedEvent } from './types.js';

function stableSortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableSortValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, stableSortValue(nestedValue)])
    );
  }

  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableSortValue(value ?? {}));
}

export function buildPayloadHash(event: {
  platform: string;
  clientKind: string;
  captureMode: string;
  platformSessionId: string;
  platformTurnId?: string | null;
  itemId?: string | null;
  eventType: string;
  createdAtEpochMs: number;
  payloadJson: string;
}): string {
  const hash = createHash('sha256');
  hash.update(event.platform);
  hash.update('\n');
  hash.update(event.clientKind);
  hash.update('\n');
  hash.update(event.captureMode);
  hash.update('\n');
  hash.update(event.platformSessionId);
  hash.update('\n');
  hash.update(event.platformTurnId || '');
  hash.update('\n');
  hash.update(event.itemId || '');
  hash.update('\n');
  hash.update(event.eventType);
  hash.update('\n');
  hash.update(String(event.createdAtEpochMs));
  hash.update('\n');
  hash.update(event.payloadJson);
  return hash.digest('hex');
}

type BuildEventInput = Omit<NormalizedEvent, 'id' | 'payloadJson' | 'payloadHash'> & {
  id?: string;
  payload?: unknown;
};

export function buildNormalizedEvent(input: BuildEventInput): NormalizedEvent {
  const payloadJson = stableStringify(input.payload);

  return {
    ...input,
    id: input.id || randomUUID(),
    payloadJson,
    payloadHash: buildPayloadHash({
      platform: input.platform,
      clientKind: input.clientKind,
      captureMode: input.captureMode,
      platformSessionId: input.platformSessionId,
      platformTurnId: input.platformTurnId,
      itemId: input.itemId,
      eventType: input.eventType,
      createdAtEpochMs: input.createdAtEpochMs,
      payloadJson
    })
  };
}
