// test/codegen.test.ts
import { describe, it, expect } from 'bun:test';
import { generateWorkerEntry } from '../src/lib/worker-codegen';
import path from 'path';

const FIXTURES_ROUTES = path.resolve('test/fixtures/worker-routes');
const FIXTURES_MW = path.resolve('test/fixtures/middleware');

describe('generateWorkerEntry', () => {
  it('returns a non-empty TypeScript string', async () => {
    const output = await generateWorkerEntry({
      routesDir: FIXTURES_ROUTES,
      middlewareDir: FIXTURES_MW,
      configPath: 'sumi.config.ts',
      outFile: 'dist/worker-entry.ts',
    });
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });

  it('contains static import for each route file found', async () => {
    const output = await generateWorkerEntry({
      routesDir: FIXTURES_ROUTES,
      middlewareDir: FIXTURES_MW,
      configPath: 'sumi.config.ts',
      outFile: 'dist/worker-entry.ts',
    });
    // Fixtures has index.ts → should produce an import
    expect(output).toContain('import *');
    expect(output).toContain('from');
  });

  it('includes createWorkerApp call', async () => {
    const output = await generateWorkerEntry({
      routesDir: FIXTURES_ROUTES,
      middlewareDir: FIXTURES_MW,
      configPath: 'sumi.config.ts',
      outFile: 'dist/worker-entry.ts',
    });
    expect(output).toContain('createWorkerApp');
  });

  it('includes export default { fetch }', async () => {
    const output = await generateWorkerEntry({
      routesDir: FIXTURES_ROUTES,
      middlewareDir: FIXTURES_MW,
      configPath: 'sumi.config.ts',
      outFile: 'dist/worker-entry.ts',
    });
    expect(output).toContain('export default');
    expect(output).toContain('fetch');
  });

  it('maps [param] file names to :param Hono paths', async () => {
    const output = await generateWorkerEntry({
      routesDir: FIXTURES_ROUTES,
      middlewareDir: FIXTURES_MW,
      configPath: 'sumi.config.ts',
      outFile: 'dist/worker-entry.ts',
    });
    // fixtures/worker-routes/users/[id].ts → path: '/users/:id'
    expect(output).toContain("'/users/:id'");
  });
});
