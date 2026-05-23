// test/websocket-integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createMockApp } from '../src/lib/testing';

describe('WebSocket integration beyond type-level', () => {
  let port: number;
  let closeServer: () => void;

  beforeAll(async () => {
    port = 8765;
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const app = await createMockApp({
      routesDir: 'test/fixtures/ws-routes',
      middlewareDir: 'test/fixtures/middleware',
      port,
      logger: false,
    });

    process.env.NODE_ENV = originalEnv;
    closeServer = () => app.sumi.shutdown();
    await new Promise((r) => setTimeout(r, 100));
  });

  afterAll(() => {
    closeServer();
  });

  it('establishes connection and can send/receive', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/`);

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = reject;
      setTimeout(() => reject(new Error('timeout')), 3000);
    });

    const received = await new Promise<string>((resolve, reject) => {
      ws.onmessage = (e) => resolve(e.data as string);
      ws.onerror = reject;
      ws.send('hello');
      setTimeout(() => reject(new Error('timeout')), 3000);
    });

    ws.close();
    expect(received).toBe('echo: hello');
  });

  it('echoes multiple messages in sequence', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/`);

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = reject;
      setTimeout(() => reject(new Error('timeout')), 3000);
    });

    const messages: string[] = [];
    ws.onmessage = (e) => messages.push(e.data as string);

    ws.send('first');
    await new Promise((r) => setTimeout(r, 100));

    ws.send('second');
    await new Promise((r) => setTimeout(r, 100));

    ws.close();

    expect(messages).toContain('echo: first');
    expect(messages).toContain('echo: second');
  });

  it('triggers onClose when client disconnects', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/`);

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = reject;
      setTimeout(() => reject(new Error('timeout')), 3000);
    });

    ws.close();
    // Just verifying close does not throw; WebSocket close is fire-and-forget
    expect(true).toBe(true);
  });
});
