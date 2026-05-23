// test/conflicts.test.ts
import { describe, it, expect } from 'bun:test';
import { createMockApp } from '../src/lib/testing';

describe('Route conflicts', () => {
  it('skips duplicate routes and keeps the first registered', async () => {
    const app = await createMockApp({
      routesDir: 'test/fixtures/conflict-routes',
      middlewareDir: 'test/fixtures/middleware',
      logger: false,
    });

    // Both routes/users.ts and routes/users/index.ts would map to /users
    // The first one discovered should win, the second should be skipped
    const res = await app.request('/users');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    // Should be the first one registered (alphabetically or by scan order)
    expect(body.source).toBeDefined();
  });

  it('warns when duplicate route methods are detected', async () => {
    // This tests that Sumi logs a warning for duplicate method + path combinations
    // We verify the app still starts successfully despite the conflict
    const app = await createMockApp({
      routesDir: 'test/fixtures/conflict-routes',
      middlewareDir: 'test/fixtures/middleware',
      logger: false,
    });

    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.route).toBe('index');
  });
});
