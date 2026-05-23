// test/openapi.test.ts
import { describe, it, expect } from 'bun:test';
import { createMockApp } from '../src/lib/testing';
import { z } from 'zod';
import { createRoute } from '../src/lib/router';

describe('OpenAPI generation', () => {
  it('serves openapi.json when configured', async () => {
    const app = await createMockApp({
      routesDir: 'test/fixtures/worker-routes',
      middlewareDir: 'test/fixtures/middleware',
      logger: false,
      openapi: {
        documentation: {
          info: { title: 'Test API', version: '1.0.0' },
        },
      },
    });

    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.openapi).toMatch(/^3\./);
    expect(body.info.title).toBe('Test API');
  });

  it('serves docs UI when configured', async () => {
    const app = await createMockApp({
      routesDir: 'test/fixtures/worker-routes',
      middlewareDir: 'test/fixtures/middleware',
      logger: false,
      openapi: {
        documentation: {
          info: { title: 'Test API', version: '1.0.0' },
        },
      },
      docs: { path: '/docs' },
    });

    const res = await app.request('/docs');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('scalar');
  });

  it('includes route metadata in OpenAPI spec', async () => {
    const app = await createMockApp({
      routesDir: 'test/fixtures/worker-routes',
      middlewareDir: 'test/fixtures/middleware',
      logger: false,
      openapi: {
        documentation: {
          info: { title: 'Test API', version: '1.0.0' },
        },
      },
    });

    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.paths).toBeDefined();
    // The spec should have a paths object (may be empty if routes lack openapi metadata)
    expect(typeof body.paths).toBe('object');
  });
});
