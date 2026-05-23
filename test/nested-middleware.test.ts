// test/nested-middleware.test.ts
import { describe, it, expect } from 'bun:test';
import { createMockApp } from '../src/lib/testing';

describe('Nested middleware', () => {
  it('applies directory-level middleware to nested routes', async () => {
    const app = await createMockApp({
      routesDir: 'test/fixtures/nested-middleware/routes',
      middlewareDir: 'test/fixtures/nested-middleware',
      logger: false,
    });

    // /admin should have both global and admin middleware
    const res = await app.request('/admin');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.globalMw).toBe(true);
    expect(body.adminMw).toBe(true);
  });

  it('applies global middleware to root routes', async () => {
    const app = await createMockApp({
      routesDir: 'test/fixtures/nested-middleware/routes',
      middlewareDir: 'test/fixtures/nested-middleware',
      logger: false,
    });

    // / should have global middleware
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.globalMw).toBe(true);
  });
});
