// test/worker.test.ts
import { describe, it, expect } from 'bun:test';
import { createWorkerApp } from '../src/lib/worker';
import { createRoute } from '../src/lib/router';
import type { WorkerManifest } from '../src/lib/worker';

// ── helpers ───────────────────────────────────────────────
function makeManifest(overrides: Partial<WorkerManifest> = {}): WorkerManifest {
  return {
    routes: [
      {
        path: '/hello',
        module: {
          default: createRoute({
            get: (c) => c.json({ message: 'hello' }),
          }),
        },
      },
    ],
    middleware: {},
    ...overrides,
  };
}

// ── basic routing ─────────────────────────────────────────
describe('createWorkerApp — basic routing', () => {
  it('returns a fetch function', () => {
    const { fetch } = createWorkerApp(makeManifest(), {});
    expect(typeof fetch).toBe('function');
  });

  it('handles a registered GET route', async () => {
    const { fetch } = createWorkerApp(makeManifest(), {});
    const res = await fetch(new Request('http://localhost/hello'));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.message).toBe('hello');
  });

  it('returns 404 for unknown routes', async () => {
    const { fetch } = createWorkerApp(makeManifest(), {});
    const res = await fetch(new Request('http://localhost/nope'));
    expect(res.status).toBe(404);
  });
});

// ── dynamic params ────────────────────────────────────────
describe('createWorkerApp — dynamic params', () => {
  it('resolves :param segments', async () => {
    const manifest: WorkerManifest = {
      routes: [
        {
          path: '/users/:id',
          module: {
            default: createRoute({
              get: (c) => c.json({ id: c.req.param('id') }),
            }),
          },
        },
      ],
    };
    const { fetch } = createWorkerApp(manifest, {});
    const res = await fetch(new Request('http://localhost/users/42'));
    const body = await res.json() as any;
    expect(body.id).toBe('42');
  });
});

// ── base path ─────────────────────────────────────────────
describe('createWorkerApp — basePath', () => {
  it('mounts all routes under basePath', async () => {
    const { fetch } = createWorkerApp(makeManifest(), { basePath: '/api/v1' });
    const res = await fetch(new Request('http://localhost/api/v1/hello'));
    expect(res.status).toBe(200);
    // Without base path prefix should 404
    const res2 = await fetch(new Request('http://localhost/hello'));
    expect(res2.status).toBe(404);
  });
});

// ── inline middleware ─────────────────────────────────────
describe('createWorkerApp — middleware', () => {
  it('runs named middleware before handler', async () => {
    const calls: string[] = [];

    const manifest: WorkerManifest = {
      routes: [
        {
          path: '/protected',
          module: {
            default: createRoute({
              get: {
                middleware: ['logger'],
                handler: (c) => {
                  calls.push('handler');
                  return c.json({ ok: true });
                },
              },
            }),
          },
        },
      ],
      middleware: {
        logger: async (c, next) => {
          calls.push('middleware');
          await next();
        },
      },
    };

    const { fetch } = createWorkerApp(manifest, {});
    await fetch(new Request('http://localhost/protected'));
    expect(calls).toEqual(['middleware', 'handler']);
  });
});

// ── POST / other methods ──────────────────────────────────
describe('createWorkerApp — HTTP methods', () => {
  it('handles POST routes', async () => {
    const manifest: WorkerManifest = {
      routes: [
        {
          path: '/items',
          module: {
            default: createRoute({
              post: (c) => c.json({ created: true }, 201),
            }),
          },
        },
      ],
    };
    const { fetch } = createWorkerApp(manifest, {});
    const res = await fetch(
      new Request('http://localhost/items', { method: 'POST' })
    );
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.created).toBe(true);
  });
});
