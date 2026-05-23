// test/vercel-codegen.test.ts
import { describe, it, expect } from 'bun:test';
import { generateVercelEntry } from '../src/lib/vercel-codegen';
import path from 'path';

const FIXTURES_ROUTES = path.resolve('test/fixtures/worker-routes');
const FIXTURES_MW = path.resolve('test/fixtures/middleware');

describe('generateVercelEntry', () => {
  it('returns a TypeScript string', async () => {
    const output = await generateVercelEntry({
      routesDir: FIXTURES_ROUTES,
      middlewareDir: FIXTURES_MW,
      configPath: 'sumi.config.ts',
      outFile: 'dist/vercel-entry.ts',
    });
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });

  it('contains a Vercel-compatible default export', async () => {
    const output = await generateVercelEntry({
      routesDir: FIXTURES_ROUTES,
      middlewareDir: FIXTURES_MW,
      configPath: 'sumi.config.ts',
      outFile: 'dist/vercel-entry.ts',
    });
    expect(output).toContain('export default function handler(request: Request)');
    expect(output).toContain('return fetch(request)');
  });

  it('does not contain the Cloudflare export pattern', async () => {
    const output = await generateVercelEntry({
      routesDir: FIXTURES_ROUTES,
      middlewareDir: FIXTURES_MW,
      configPath: 'sumi.config.ts',
      outFile: 'dist/vercel-entry.ts',
    });
    expect(output).not.toContain('export default { fetch }');
  });

  it('includes createWorkerApp call', async () => {
    const output = await generateVercelEntry({
      routesDir: FIXTURES_ROUTES,
      middlewareDir: FIXTURES_MW,
      configPath: 'sumi.config.ts',
      outFile: 'dist/vercel-entry.ts',
    });
    expect(output).toContain('createWorkerApp');
  });
});
