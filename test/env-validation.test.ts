// test/env-validation.test.ts
import { describe, it, expect } from 'bun:test';
import { createMockApp } from '../src/lib/testing';
import { z } from 'zod';

describe('Environment validation', () => {
  it('validates env vars at startup and attaches them to context', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    process.env.TEST_API_KEY = 'secret-123';

    try {
      const app = await createMockApp({
        routesDir: 'test/fixtures/worker-routes',
        middlewareDir: 'test/fixtures/middleware',
        logger: false,
        env: {
          schema: {
            TEST_API_KEY: z.string().min(1),
          },
          required: ['TEST_API_KEY'],
        },
      });

      const res = await app.request('/');
      expect(res.status).toBe(200);
      // validatedEnv should be available on the context
      expect(app.sumi).toBeDefined();
    } finally {
      process.env.NODE_ENV = originalEnv;
      delete process.env.TEST_API_KEY;
    }
  });

  it('does not fail when env var is missing in non-production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    delete (process.env as any).MISSING_VAR;

    try {
      const app = await createMockApp({
        routesDir: 'test/fixtures/worker-routes',
        middlewareDir: 'test/fixtures/middleware',
        logger: false,
        env: {
          schema: {
            MISSING_VAR: z.string().optional(),
          },
        },
      });

      const res = await app.request('/');
      expect(res.status).toBe(200);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
