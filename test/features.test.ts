// test/features.test.ts
import { describe, it, expect } from 'bun:test';
import { createMockApp } from '../src/lib/testing';

// ── CORS ────────────────────────────────────────────────────
describe('CORS', () => {
  it('adds Access-Control-Allow-Origin header when cors: true', async () => {
    const app = await createMockApp({ cors: true });
    const res = await app.request('/', {
      method: 'OPTIONS',
      headers: { Origin: 'http://example.com', 'Access-Control-Request-Method': 'GET' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });
});

// ── Request ID ──────────────────────────────────────────────
describe('Request ID', () => {
  it('adds x-request-id header when requestId: true', async () => {
    const app = await createMockApp({ requestId: true });
    const res = await app.request('/');
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });
});

// ── Health check ────────────────────────────────────────────
describe('Health check', () => {
  it('returns 200 at default /healthz when healthCheck: true', async () => {
    const app = await createMockApp({ healthCheck: true });
    const res = await app.request('/healthz');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('ok');
  });

  it('serves at custom path when healthCheck.path is set', async () => {
    const app = await createMockApp({ healthCheck: { path: '/health' } });
    const res = await app.request('/health');
    expect(res.status).toBe(200);
  });

  it('includes metadata in response when provided', async () => {
    const app = await createMockApp({
      healthCheck: { metadata: { version: '1.0.0' } },
    });
    const res = await app.request('/healthz');
    const body = await res.json() as any;
    expect(body.metadata?.version).toBe('1.0.0');
  });
});

// ── PluginManager ───────────────────────────────────────────
describe('PluginManager', () => {
  it('sumi.plugins.set and use store/retrieve values', async () => {
    const { sumi } = await createMockApp({});
    sumi.plugins.set('db', { query: () => 'result' });
    const db = sumi.plugins.use<{ query: () => string }>('db');
    expect(db.query()).toBe('result');
  });

  it('throws when using an unregistered plugin', async () => {
    const { sumi } = await createMockApp({});
    expect(() => sumi.plugins.use('missing')).toThrow('Plugin "missing" not found');
  });
});

// ── Rate Limiting ───────────────────────────────────────────
describe('Rate limiting', () => {
  it('returns 429 after exceeding the limit', async () => {
    const app = await createMockApp({
      rateLimit: {
        windowMs: 60_000,
        limit: 2,
        keyGenerator: (_c) => 'test-key',
      },
    });

    // First two requests should pass (404 = no routes, but not rate-limited)
    const res1 = await app.request('/');
    const res2 = await app.request('/');
    expect(res1.status).toBe(404);
    expect(res2.status).toBe(404);

    // Third request should be rate-limited
    const res3 = await app.request('/');
    expect(res3.status).toBe(429);
  });
});

// ── Typed client ────────────────────────────────────────────
describe('createClient', () => {
  it('is a function (re-export of hono hc)', async () => {
    const { createClient } = await import('../src/index');
    expect(typeof createClient).toBe('function');
  });
});
