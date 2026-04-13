// test/sse.test.ts
import { describe, it, expect, beforeAll } from 'bun:test';
import { createRoute } from '../src/lib/router';
import type { SSERouteConfig } from '../src/lib/router';
import { createMockApp } from '../src/lib/testing';

// ── Type compilation check ────────────────────────────────
describe('SSERouteConfig type', () => {
  it('createRoute accepts a stream key on get', () => {
    const route = createRoute({
      get: {
        stream: async (stream) => {
          await stream.writeSSE({ data: 'hello', event: 'message' });
        },
      } satisfies SSERouteConfig,
    });
    expect(route).toBeDefined();
  });
});

// ── Integration: SSE response ─────────────────────────────
describe('SSE route integration', () => {
  let app: Awaited<ReturnType<typeof createMockApp>>;

  beforeAll(async () => {
    app = await createMockApp({
      routesDir: 'test/fixtures/sse-routes',
      middlewareDir: 'test/fixtures/middleware',
      logger: false,
    });
  });

  it('responds with Content-Type: text/event-stream', async () => {
    const res = await app.request('/events');
    expect(res.headers.get('content-type')).toContain('text/event-stream');
  });

  it('streams SSE data in correct format', async () => {
    const res = await app.request('/events');
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toContain('event: heartbeat');
    expect(text).toContain('data: ping');
    expect(text).toContain('event: end');
    expect(text).toContain('data: done');
  });
});
