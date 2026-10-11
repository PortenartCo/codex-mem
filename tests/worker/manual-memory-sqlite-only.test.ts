import { afterEach, describe, expect, it, mock } from 'bun:test';
import express from 'express';
import type { Server } from 'node:http';
import { MemoryRoutes } from '../../src/services/worker/http/routes/MemoryRoutes.js';

describe('Manual memory save in SQLite-only mode', () => {
  let server: Server | null = null;

  async function postMemory(chromaSync: null | { syncObservation: ReturnType<typeof mock> }) {
    const storeObservation = mock(() => ({ id: 42, createdAtEpoch: Date.now() }));
    const dbManager: any = {
      getSessionStore: () => ({
        getOrCreateManualSession: () => 'manual-fixture',
        storeObservation
      }),
      getChromaSync: () => chromaSync
    };
    const app = express();
    app.use(express.json());
    new MemoryRoutes(dbManager, 'fixture').setupRoutes(app);
    server = await new Promise<Server>(resolve => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing local test listener');
    const response = await fetch('http://127.0.0.1:' + address.port + '/api/memory/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Synthetic memory only', project: 'fixture' })
    });
    return { response, storeObservation };
  }

  afterEach(async () => {
    if (server) {
      const s = server;
      server = null;
      await new Promise<void>((resolve, reject) => s.close(err => err ? reject(err) : resolve()));
    }
  });

  it('returns 200 after a single SQLite write when Chroma is disabled', async () => {
    const { response, storeObservation } = await postMemory(null);
    expect(response.status).toBe(200);
    const result = await response.json() as any;
    expect(result.success).toBe(true);
    expect(result.id).toBe(42);
    expect(storeObservation).toHaveBeenCalledTimes(1);
  });

  it('retains best-effort Chroma synchronization when enabled', async () => {
    const syncObservation = mock(async () => {});
    const { response, storeObservation } = await postMemory({ syncObservation });
    expect(response.status).toBe(200);
    expect(storeObservation).toHaveBeenCalledTimes(1);
    expect(syncObservation).toHaveBeenCalledTimes(1);
    expect(syncObservation.mock.calls[0][0]).toBe(42);
  });

  it('does not convert a vector sync rejection into a failed SQLite save', async () => {
    const syncObservation = mock(async () => { throw new Error('Synthetic Chroma offline'); });
    const { response, storeObservation } = await postMemory({ syncObservation });
    expect(response.status).toBe(200);
    expect(storeObservation).toHaveBeenCalledTimes(1);
    expect(syncObservation).toHaveBeenCalledTimes(1);
  });
});