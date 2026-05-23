// test/manifest.test.ts
import { describe, it, expect } from 'bun:test';
import {
  generateManifest,
  writeManifest,
  loadManifest,
  clearManifest,
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
