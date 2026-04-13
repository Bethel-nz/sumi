// test/websocket.test.ts
import { describe, it, expect, beforeAll } from 'bun:test';
import { createWS } from '../src/lib/router';
import type { WebSocketDefinition } from '../src/lib/router';

// ── Type compilation check ────────────────────────────────
describe('WebSocketDefinition type', () => {
  it('createWS accepts a handler at top level', () => {
    const route = createWS({
      handler: (_c) => ({
        onOpen(_evt, ws) { ws.send('connected'); },
        onMessage(evt, ws) { ws.send(`echo: ${evt.data}`); },
        onClose() {},
      }),
    });
    expect(route).toBeDefined();
    expect(typeof route.handler).toBe('function');
  });
});

// ── Integration ───────────────────────────────────────────
describe('WebSocket integration', () => {
  let port: number;

  beforeAll(async () => {
    const { createMockApp } = await import('../src/lib/testing');
    port = 4321;

    // Bun test sets NODE_ENV=test, which skips server startup in sumi.burn()
    // We override it to allow starting a real server for WS integration.
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    await createMockApp({
      routesDir: 'test/fixtures/ws-routes',
      middlewareDir: 'test/fixtures/middleware',
      port,
      logger: false,
    });

    process.env.NODE_ENV = originalEnv;
    // Small delay to ensure server is bound
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('upgrades connection via +ws.ts and echoes messages', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/`);

    const received = await new Promise<string>((resolve, reject) => {
      ws.onmessage = (e) => resolve(e.data as string);
      ws.onerror = reject;
      ws.onopen = () => ws.send('hello');
      setTimeout(() => reject(new Error('timeout')), 3000);
    });

    ws.close();
    expect(received).toBe('echo: hello');
  });
});
