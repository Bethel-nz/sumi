// test/manifest.test.ts
import { describe, it, expect } from 'bun:test';
import {
  generateManifest,
  writeManifest,
  loadManifest,
  clearManifest,
  extractRouteShape,
} from '../src/lib/manifest';
import path from 'path';

describe('Route manifest', () => {
  const middlewareDir = path.resolve('test/fixtures/middleware');

  it('generates a manifest with correct route entries', () => {
    const routesDir = path.resolve('test/fixtures/worker-routes');
    const manifest = generateManifest(routesDir, middlewareDir);
    expect(manifest.routes.length).toBeGreaterThan(0);

    const indexRoute = manifest.routes.find((r) => r.routePath === '/');
    expect(indexRoute).toBeDefined();
    expect(indexRoute?.filePath.endsWith('index.ts')).toBe(true);
  });

  it('writes and loads a manifest from disk', () => {
    clearManifest();
    const routesDir = path.resolve('test/fixtures/worker-routes');
    const manifest = generateManifest(routesDir, middlewareDir);
    writeManifest(manifest);

    const loaded = loadManifest();
    expect(loaded).not.toBeNull();
    expect(loaded?.routes.length).toBe(manifest.routes.length);
    clearManifest();
  });

  it('returns null when no manifest exists', () => {
    clearManifest();
    const loaded = loadManifest();
    expect(loaded).toBeNull();
  });

  it('includes WebSocket routes with isWebSocket flag', () => {
    const wsRoutesDir = path.resolve('test/fixtures/ws-routes');
    const manifest = generateManifest(wsRoutesDir, middlewareDir);
    const wsRoute = manifest.routes.find((r) => r.isWebSocket);
    expect(wsRoute).toBeDefined();
    expect(wsRoute?.routePath).toBe('/');
  });
});

describe('Route method extraction', () => {
  const middlewareDir = path.resolve('test/fixtures/middleware');

  it('reads the verbs a route file defines', () => {
    const { methods } = extractRouteShape(`
      import { createRoute } from '@bethel-nz/sumi/router';
      export default createRoute({
        get: { handler: (c) => c.json({}) },
        post: { handler: (c) => c.json({}) },
      });
    `);
    expect(methods).toEqual(['GET', 'POST']);
  });

  it('reports verbs in a stable order regardless of how they are written', () => {
    const source = `export default createRoute({ delete: h, get: h, patch: h });`;
    expect(extractRouteShape(source).methods).toEqual(['GET', 'PATCH', 'DELETE']);
  });

  it('reports the underscore route-level middleware as MIDDLEWARE', () => {
    expect(extractRouteShape(`export default createRoute({ _: mw, get: h });`).methods).toEqual([
      'GET',
      'MIDDLEWARE',
    ]);
  });

  it('ignores method names nested inside a route config', () => {
    const { methods } = extractRouteShape(`
      export default createRoute({
        post: {
          schema: { json: z.object({ get: z.string(), delete: z.boolean() }) },
          openapi: { responses: { 200: { description: 'ok' } } },
          handler: (c) => c.json({}),
        },
      });
    `);
    expect(methods).toEqual(['POST']);
  });

  it('ignores method names appearing in strings and comments', () => {
    const { methods } = extractRouteShape(`
      // get: this is commented out
      /* delete: also not real */
      export default createRoute({
        post: { handler: (c) => c.text('put: not a key, and a } brace') },
      });
    `);
    expect(methods).toEqual(['POST']);
  });

  it('is not confused by a ternary colon in a top-level value', () => {
    const { methods } = extractRouteShape(
      `export default createRoute({ get: dev ? a : b, post: h });`
    );
    expect(methods).toEqual(['GET', 'POST']);
  });

  it('anchors on the createRoute call, not the import that names it', () => {
    const { methods } = extractRouteShape(`
      import { createRoute } from '@bethel-nz/sumi/router';
      import { resolver } from 'hono-openapi/zod';
      import { z } from 'zod';

      const schema = z.object({ orgId: z.string() });

      export default createRoute({
        post: { schema: { json: schema }, handler: (c) => c.json({}) },
      });
    `);
    expect(methods).toEqual(['POST']);
  });

  it('finds the call when the route object is assigned before export', () => {
    const { methods } = extractRouteShape(`
      import { createRoute } from '@bethel-nz/sumi/router';
      const route = createRoute({ put: h });
      export default route;
    `);
    expect(methods).toEqual(['PUT']);
  });

  it('returns nothing for a file that defines no route object', () => {
    expect(extractRouteShape(`export const helper = 1;`)).toEqual({ methods: [], sse: [] });
  });

  it('attaches methods to every scanned route', () => {
    const routesDir = path.resolve('test/fixtures/worker-routes');
    const manifest = generateManifest(routesDir, middlewareDir);
    const indexRoute = manifest.routes.find((r) => r.routePath === '/');
    expect(indexRoute?.methods).toEqual(['GET']);
  });

  it('marks WebSocket routes as WS', () => {
    const manifest = generateManifest(path.resolve('test/fixtures/ws-routes'), middlewareDir);
    expect(manifest.routes.find((r) => r.isWebSocket)?.methods).toEqual(['WS']);
  });
});

describe('SSE detection', () => {
  it('marks a verb whose config supplies a stream handler', () => {
    const shape = extractRouteShape(`
      export default createRoute({
        get: {
          schema: { query: q },
          stream: async (stream, c) => { await stream.writeSSE({ data: 'hi' }); },
        },
      });
    `);
    expect(shape.methods).toEqual(['GET']);
    expect(shape.sse).toEqual(['GET']);
  });

  it('separates a streaming verb from a plain one in the same file', () => {
    const shape = extractRouteShape(`
      export default createRoute({
        get: { stream: async (s, c) => {} },
        post: { handler: (c) => c.json({}) },
      });
    `);
    expect(shape.methods).toEqual(['GET', 'POST']);
    expect(shape.sse).toEqual(['GET']);
  });

  it('does not mark a route whose handler merely mentions stream', () => {
    const shape = extractRouteShape(`
      export default createRoute({
        get: { handler: (c) => { const stream = c.get('stream'); return c.json({ stream }); } },
      });
    `);
    expect(shape.sse).toEqual([]);
  });

  it('does not mark a nested stream key belonging to some other config', () => {
    const shape = extractRouteShape(`
      export default createRoute({
        post: { openapi: { responses: { 200: { stream: true } } }, handler: h },
      });
    `);
    expect(shape.sse).toEqual([]);
  });

  it('leaves sse empty for a shorthand function handler', () => {
    expect(extractRouteShape(`export default createRoute({ get: (c) => c.json({}) });`)).toEqual({
      methods: ['GET'],
      sse: [],
    });
  });
});
