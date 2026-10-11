import { describe, it, expect, mock } from 'bun:test';
import { Server } from '../../src/services/server/Server.js';
import type { ServerOptions } from '../../src/services/server/Server.js';

const options: ServerOptions = {
  getInitializationComplete: () => true,
  getMcpReady: () => true,
  onShutdown: mock(async () => {}),
  onRestart: mock(async () => {}),
  workerPath: '/synthetic/worker.js',
  getAiStatus: () => ({ provider: 'claude', authMethod: 'cli', lastInteraction: null }),
};

describe('Local memory listener security', () => {
  it('refuses wildcard and non-loopback bind addresses without opening a socket', async () => {
    for (const host of ['0.0.0.0', '::', '192.0.2.9', 'localhost', '127.0.0.1.example']) {
      const worker = new Server(options);
      await expect(worker.listen(0, host)).rejects.toThrow('loopback only');
      expect(worker.getHttpServer()).toBeNull();
    }
  });

  it('continues to expose the loopback health check', async () => {
    const worker = new Server(options);
    await worker.listen(0, '127.0.0.1');
    try {
      const address = worker.getHttpServer()?.address();
      if (!address || typeof address === 'string') throw Error('No TCP listener');
      expect(address.address).toBe('127.0.0.1');
      const response = await fetch('http://127.0.0.1:' + address.port + '/api/health');
      expect(response.status).toBe(200);
    } finally {
      await worker.close();
    }
  });
});
