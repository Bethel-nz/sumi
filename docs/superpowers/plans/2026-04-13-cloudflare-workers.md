# Cloudflare Workers Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Sumi apps to deploy to Cloudflare Workers by providing a build-time route manifest generator (`sumi build --target cloudflare`) and a runtime `createWorkerApp()` function that works without Node/Bun filesystem APIs.

**Architecture:** Sumi's file-based routing currently relies on `fs`, dynamic `import()` at runtime, and `Bun.serve` — none of which are available in CF workers. The solution is two-phase: (1) the CLI scans `routes/` and `middleware/` at **build time** on the developer's machine, emitting a TypeScript manifest file with static imports; (2) Bun bundles that manifest into a single `worker.js` using `Bun.build`. A new `createWorkerApp(manifest, config)` function in `src/lib/worker.ts` registers routes on a plain Hono app using the pre-built manifest — no `fs`, no dynamic imports.

**Tech Stack:** Hono (runtime-agnostic), `Bun.build` (bundler), `wrangler` (CF deployment, installed by the user separately), `bun:test` for unit and integration tests.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/worker.ts` | `createWorkerApp(manifest, config)` — pure Hono, no Node/Bun APIs |
| Create | `src/lib/worker-codegen.ts` | `generateWorkerEntry(routesDir, middlewareDir, configPath)` — scans dirs, returns TypeScript source string |
| Modify | `src/bin/sumi-cli.ts` | Add `sumi build --target cloudflare` command |
| Modify | `package.json` | Add `./worker` export path |
| Modify | `src/index.ts` | No change needed — `worker.ts` is a separate export path |
| Create | `test/worker.test.ts` | Unit tests for `createWorkerApp` |
| Create | `test/codegen.test.ts` | Tests for `generateWorkerEntry` output |
| Create | `example/cf-worker/wrangler.toml` | Example Cloudflare deployment config |

---

### Task 1: Define `WorkerManifest` types and write failing tests

**Files:**
- Create: `src/lib/worker.ts` (types only, no implementation yet)
- Create: `test/worker.test.ts`

- [ ] **Step 1: Create `src/lib/worker.ts` with types only**

```ts
// src/lib/worker.ts
import type { RouteDefinition } from './router';
import type { SumiConfig } from './types';

/** One entry per route file discovered at build time. */
export interface WorkerRouteEntry {
  /** Hono path string, e.g. '/users/:id' */
  path: string;
  /** The default export of the route file */
  module: { default: RouteDefinition };
}

/** Pre-built manifest produced by the CLI codegen step. */
export interface WorkerManifest {
  routes: WorkerRouteEntry[];
  /**
   * Middleware by name, matching the string keys in route config's `middleware` array.
   * e.g. { 'auth': authHandlerFn }
   */
  middleware?: Record<string, (c: any, next: any) => any>;
}

export type WorkerConfig = Pick<SumiConfig, 'basePath' | 'openapi' | 'docs' | 'hooks'>;

/**
 * Creates a Hono app from a pre-built route manifest.
 * Safe to use in Cloudflare Workers — no filesystem access or dynamic imports.
 */
export function createWorkerApp(
  _manifest: WorkerManifest,
  _config: WorkerConfig = {}
): { fetch: (req: Request, env?: any, ctx?: any) => Promise<Response> } {
  throw new Error('Not implemented');
}
```

- [ ] **Step 2: Write failing tests in `test/worker.test.ts`**

```ts
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
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd /Users/APPLE/dev/sumi && bun test test/worker.test.ts
```

Expected: all tests fail with `Error: Not implemented`.

- [ ] **Step 4: Commit the types and failing tests**

```bash
cd /Users/APPLE/dev/sumi && git add src/lib/worker.ts test/worker.test.ts
git commit -m "test(worker): add WorkerManifest types and failing createWorkerApp tests"
```

---

### Task 2: Implement `createWorkerApp` in `src/lib/worker.ts`

**Files:**
- Modify: `src/lib/worker.ts`

- [ ] **Step 1: Add Hono imports at the top of `src/lib/worker.ts`**

Replace the current contents of `src/lib/worker.ts` with the full implementation:

```ts
// src/lib/worker.ts
// ⚠️  This file must NOT import 'fs', 'path', or any Bun-specific APIs.
// It is bundled into Cloudflare Workers where those APIs don't exist.
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { validator as zValidator } from 'hono-openapi/zod';
import { generateSpecs } from 'hono-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import type { RouteDefinition, RouteConfig } from './router';
import type { SumiConfig } from './types';

/** One entry per route file discovered at build time. */
export interface WorkerRouteEntry {
  /** Hono path string, e.g. '/users/:id' */
  path: string;
  /** The default export of the route file */
  module: { default: RouteDefinition };
}

/** Pre-built manifest produced by the CLI codegen step. */
export interface WorkerManifest {
  routes: WorkerRouteEntry[];
  /**
   * Middleware by name, matching the string keys in route config's `middleware` array.
   * e.g. { 'auth': authHandlerFn }
   */
  middleware?: Record<string, (c: any, next: any) => any>;
}

export type WorkerConfig = Pick<SumiConfig, 'basePath' | 'openapi' | 'docs' | 'hooks'>;

/**
 * Creates a Hono app from a pre-built route manifest.
 * Safe to use in Cloudflare Workers — no filesystem access or dynamic imports.
 */
export function createWorkerApp(
  manifest: WorkerManifest,
  config: WorkerConfig = {}
): { fetch: (req: Request, env?: any, ctx?: any) => Promise<Response> } {
  let app = new Hono();

  if (config.basePath) {
    const normalized = '/' + config.basePath.replace(/^\/*|\/*$/g, '');
    app = app.basePath(normalized);
  }

  // Apply onRequest hook
  if (config.hooks?.onRequest) {
    app.use('*', async (c, next) => {
      await config.hooks!.onRequest!(c);
      await next();
    });
  }

  // Register all routes from manifest
  for (const { path: routePath, module: routeModule } of manifest.routes) {
    const routeDefinition = routeModule.default;

    for (const [method, methodConfig] of Object.entries(routeDefinition)) {
      if (!methodConfig) continue;

      const chain: any[] = [];
      let userHandler: Function;

      if (typeof methodConfig === 'function') {
        userHandler = methodConfig;
      } else if (
        typeof methodConfig === 'object' &&
        'stream' in methodConfig &&
        typeof (methodConfig as any).stream === 'function'
      ) {
        // SSE route — import streamSSE lazily to keep CF compat
        // (hono/streaming is CF-compatible)
        const sseCallback = (methodConfig as any).stream;
        userHandler = async (c: any) => {
          const { streamSSE } = await import('hono/streaming');
          return streamSSE(c, sseCallback);
        };
      } else if (
        typeof methodConfig === 'object' &&
        (methodConfig as RouteConfig<any>).handler
      ) {
        const cfg = methodConfig as RouteConfig<any>;
        userHandler = cfg.handler;

        if (cfg.openapi) {
          chain.push(describeRoute(cfg.openapi as any));
        }

        if (cfg.middleware && manifest.middleware) {
          for (const name of cfg.middleware) {
            const mw = manifest.middleware[name];
            if (mw) chain.push(mw);
          }
        }

        if (cfg.schema) {
          for (const [target, schema] of Object.entries(cfg.schema)) {
            if (schema && typeof schema === 'object' && '_def' in schema) {
              chain.push(zValidator(target as any, schema as any));
            }
          }
        }
      } else {
        continue;
      }

      chain.push(userHandler!);

      const honoMethod = method.toLowerCase() as keyof Hono;
      if (method === '_') {
        app.use(routePath, ...chain);
      } else if (typeof app[honoMethod] === 'function') {
        (app[honoMethod] as Function)(routePath, ...chain);
      }
    }
  }

  // OpenAPI endpoints
  if (config.openapi) {
    app.get('/openapi.json', async (c) => {
      const spec = await generateSpecs(app, config.openapi!);
      return c.json(spec);
    });

    if (config.docs) {
      const { path: docsPath = '/docs', ...scalarConfig } = config.docs as any;
      app.get(
        docsPath,
        Scalar({
          url: '/openapi.json',
          ...scalarConfig,
          pageTitle: scalarConfig.pageTitle || 'API Documentation',
        })
      );
    }
  }

  // Apply onResponse hook
  if (config.hooks?.onResponse) {
    app.use('*', async (c, next) => {
      await next();
      await config.hooks!.onResponse!(c);
    });
  }

  app.onError(async (err, c) => {
    if (config.hooks?.onError) await config.hooks.onError(err, c);
    return c.json({ error: 'Internal Server Error', message: err.message }, 500);
  });

  return { fetch: app.fetch.bind(app) };
}
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/APPLE/dev/sumi && bun test test/worker.test.ts
```

Expected: all 7 tests passing.

- [ ] **Step 3: Commit**

```bash
cd /Users/APPLE/dev/sumi && git add src/lib/worker.ts
git commit -m "feat(worker): implement createWorkerApp for Cloudflare Workers deployment"
```

---

### Task 3: Implement `generateWorkerEntry` codegen

**Files:**
- Create: `src/lib/worker-codegen.ts`
- Create: `test/codegen.test.ts`

- [ ] **Step 1: Write failing codegen tests**

Create `test/codegen.test.ts`:

```ts
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
```

- [ ] **Step 2: Create fixture route files for codegen tests**

```bash
mkdir -p /Users/APPLE/dev/sumi/test/fixtures/worker-routes/users
```

Create `test/fixtures/worker-routes/index.ts`:

```ts
import { createRoute } from '../../../src/lib/router';
export default createRoute({
  get: (c) => c.json({ route: 'index' }),
});
```

Create `test/fixtures/worker-routes/users/[id].ts`:

```ts
import { createRoute } from '../../../../src/lib/router';
export default createRoute({
  get: (c) => c.json({ id: c.req.param('id') }),
});
```

- [ ] **Step 3: Run codegen tests to confirm they fail**

```bash
cd /Users/APPLE/dev/sumi && bun test test/codegen.test.ts
```

Expected: error — `generateWorkerEntry` not found.

- [ ] **Step 4: Implement `src/lib/worker-codegen.ts`**

```ts
// src/lib/worker-codegen.ts
// Runs at BUILD TIME on the developer's machine (Node/Bun OK here).
import fs from 'fs';
import path from 'path';
import { RouteParser } from './RouteParser';

export interface CodegenOptions {
  /** Absolute or cwd-relative path to routes directory */
  routesDir: string;
  /** Absolute or cwd-relative path to middleware directory */
  middlewareDir: string;
  /** Path to sumi.config.ts (for the import statement) */
  configPath: string;
  /** Output file path (written by the CLI, not this function) */
  outFile: string;
}

interface DiscoveredRoute {
  /** Import identifier, e.g. route_users_id */
  varName: string;
  /** Filesystem path to the route file */
  filePath: string;
  /** Hono path, e.g. /users/:id */
  routePath: string;
}

interface DiscoveredMiddleware {
  varName: string;
  filePath: string;
  /** Name used in route config middleware arrays */
  name: string;
}

function slugify(filePath: string, baseDir: string): string {
  const rel = path.relative(baseDir, filePath);
  return 'route_' + rel
    .replace(/\\/g, '/')
    .replace(/\.[tj]s$/, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function fileToHonoPath(filePath: string, routesDir: string): string {
  const routeName = path.basename(filePath, path.extname(filePath));
  if (routeName.startsWith('_')) return '';

  const isIndex = routeName === 'index';
  const rel = path.relative(routesDir, filePath);
  const dir = path.dirname(rel);

  const segments = dir
    .split(path.sep)
    .filter((s) => s !== '.' && s !== '')
    .map(RouteParser.parseSegment);

  const filePart = isIndex ? '' : RouteParser.parseSegment(routeName);
  const all = [...segments, filePart].filter(Boolean);
  const p = all.length > 0 ? `/${all.join('/')}` : '/';
  return p.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function scanRoutes(dir: string, baseDir: string, out: DiscoveredRoute[] = []): DiscoveredRoute[] {
  if (!fs.existsSync(dir)) return out;
  const ignored = ['dist', 'static', 'public', 'node_modules'];
  if (ignored.some((d) => dir.includes(d)) || path.basename(dir).startsWith('.')) return out;

  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanRoutes(full, baseDir, out);
    } else if (
      (entry.endsWith('.ts') || entry.endsWith('.js')) &&
      !entry.startsWith('_') &&
      stat.size > 0
    ) {
      const routePath = fileToHonoPath(full, baseDir);
      if (!routePath) continue;
      out.push({ varName: slugify(full, baseDir), filePath: full, routePath });
    }
  }
  return out;
}

function scanMiddleware(dir: string): DiscoveredMiddleware[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(
      (f) =>
        (f.endsWith('.ts') || f.endsWith('.js')) &&
        !f.startsWith('_') &&
        fs.statSync(path.join(dir, f)).size > 0
    )
    .map((f) => {
      const name = path.basename(f, path.extname(f));
      return {
        name,
        varName: `mw_${name.replace(/[^a-zA-Z0-9]/g, '_')}`,
        filePath: path.join(dir, f),
      };
    });
}

export async function generateWorkerEntry(opts: CodegenOptions): Promise<string> {
  const routesDir = path.resolve(opts.routesDir);
  const middlewareDir = path.resolve(opts.middlewareDir);
  const outDir = path.resolve(path.dirname(opts.outFile));

  const routes = scanRoutes(routesDir, routesDir);
  const middlewares = scanMiddleware(middlewareDir);

  const rel = (from: string, to: string) => {
    const r = path.relative(from, to).replace(/\\/g, '/');
    return r.startsWith('.') ? r : `./${r}`;
  };

  const lines: string[] = [
    '// AUTO-GENERATED by sumi build --target cloudflare — do not edit',
    "import { createWorkerApp } from '@bethel-nz/sumi/worker';",
    '',
  ];

  // Config import
  const configRel = rel(outDir, path.resolve(opts.configPath)).replace(/\.[tj]s$/, '');
  lines.push(`import sumiConfig from '${configRel}';`);
  lines.push('');

  // Route imports
  for (const r of routes) {
    const importPath = rel(outDir, r.filePath).replace(/\.[tj]s$/, '');
    lines.push(`import * as ${r.varName} from '${importPath}';`);
  }

  // Middleware imports
  if (middlewares.length > 0) {
    lines.push('');
    for (const m of middlewares) {
      const importPath = rel(outDir, m.filePath).replace(/\.[tj]s$/, '');
      lines.push(`import ${m.varName} from '${importPath}';`);
    }
  }

  lines.push('');
  lines.push('const { fetch } = createWorkerApp(');
  lines.push('  {');
  lines.push('    routes: [');
  for (const r of routes) {
    lines.push(`      { path: '${r.routePath}', module: ${r.varName} },`);
  }
  lines.push('    ],');

  if (middlewares.length > 0) {
    lines.push('    middleware: {');
    for (const m of middlewares) {
      lines.push(`      '${m.name}': ${m.varName},`);
    }
    lines.push('    },');
  } else {
    lines.push('    middleware: {},');
  }

  lines.push('  },');
  lines.push('  sumiConfig,');
  lines.push(');');
  lines.push('');
  lines.push('export default { fetch };');
  lines.push('');

  return lines.join('\n');
}
```

- [ ] **Step 5: Run codegen tests**

```bash
cd /Users/APPLE/dev/sumi && bun test test/codegen.test.ts
```

Expected: all 5 tests passing.

- [ ] **Step 6: Commit**

```bash
cd /Users/APPLE/dev/sumi && git add src/lib/worker-codegen.ts test/codegen.test.ts test/fixtures/worker-routes
git commit -m "feat(codegen): add generateWorkerEntry — scans routes/middleware and emits static CF worker entry"
```

---

### Task 4: Add `sumi build --target cloudflare` CLI command

**Files:**
- Modify: `src/bin/sumi-cli.ts`

- [ ] **Step 1: Locate where CLI commands are registered in `src/bin/sumi-cli.ts`**

Open `src/bin/sumi-cli.ts` and find the section where `cli.command` calls are made (search for `cli.command`). All new commands go in this section.

- [ ] **Step 2: Add `build` command**

Find the `cli.help()` and `cli.parse()` calls at the bottom of the file. Before them, insert:

```ts
cli
  .command('build', 'Build the Sumi app for deployment')
  .option('--target <target>', 'Deployment target: cloudflare', { default: 'cloudflare' })
  .option('--routes-dir <dir>', 'Routes directory', { default: 'routes' })
  .option('--middleware-dir <dir>', 'Middleware directory', { default: 'middleware' })
  .option('--config <path>', 'Path to sumi.config.ts', { default: 'sumi.config.ts' })
  .option('--out-dir <dir>', 'Output directory', { default: 'dist' })
  .action(async (options: {
    target: string;
    routesDir: string;
    middlewareDir: string;
    config: string;
    outDir: string;
  }) => {
    if (options.target !== 'cloudflare') {
      console.error(`[sumi build] Unknown target: "${options.target}". Only "cloudflare" is supported.`);
      process.exit(1);
    }

    console.log('[sumi build] Generating Cloudflare Worker entry...');

    const { generateWorkerEntry } = await import('../lib/worker-codegen');

    const outEntryFile = path.join(options.outDir, 'worker-entry.ts');
    const workerOutFile = path.join(options.outDir, 'worker.js');

    const source = await generateWorkerEntry({
      routesDir: options.routesDir,
      middlewareDir: options.middlewareDir,
      configPath: options.config,
      outFile: outEntryFile,
    });

    fs.mkdirSync(options.outDir, { recursive: true });
    fs.writeFileSync(outEntryFile, source, 'utf8');
    console.log(`[sumi build] Written: ${outEntryFile}`);

    // Bundle with Bun
    console.log(`[sumi build] Bundling with Bun → ${workerOutFile}`);
    const result = await Bun.build({
      entrypoints: [path.resolve(outEntryFile)],
      outdir: options.outDir,
      target: 'browser', // CF workers use browser-compatible APIs
      format: 'esm',
      minify: false,
      naming: 'worker.js',
      external: [], // bundle everything
    });

    if (!result.success) {
      console.error('[sumi build] Bundle failed:');
      for (const log of result.logs) console.error(' ', log);
      process.exit(1);
    }

    console.log(`[sumi build] ✅ Worker bundle ready: ${workerOutFile}`);
    console.log('[sumi build] Deploy with: wrangler deploy');
  });
```

- [ ] **Step 3: Verify CLI compiles without errors**

```bash
cd /Users/APPLE/dev/sumi && bun build src/bin/sumi-cli.ts --outfile=dist/bin/sumi-cli.js --format=esm --target=bun \
  --external hono --external zod --external @hono/zod-validator --external hono-openapi \
  --external @scalar/hono-api-reference 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Run all existing tests to confirm nothing regressed**

```bash
cd /Users/APPLE/dev/sumi && bun test
```

Expected: all tests passing.

- [ ] **Step 5: Commit**

```bash
cd /Users/APPLE/dev/sumi && git add src/bin/sumi-cli.ts
git commit -m "feat(cli): add 'sumi build --target cloudflare' command"
```

---

### Task 5: Export `./worker` path from `package.json` and rebuild

**Files:**
- Modify: `package.json`
- Modify: `src/index.ts` (re-export worker types)

- [ ] **Step 1: Add `./worker` export entry to `package.json`**

In `package.json`, find the `"exports"` field and add this entry after `"./testing"`:

```json
"./worker": {
  "import": "./dist/lib/worker.js",
  "types": "./dist/lib/worker.d.ts"
}
```

And in `"typesVersions"` → `"*"`, add:

```json
"worker": ["dist/lib/worker.d.ts"]
```

- [ ] **Step 2: Add `worker.ts` to the JS build script in `package.json`**

In `"scripts"."build:js"`, the existing `bun build src/index.ts ...` command bundles the public API. `worker.ts` needs its own bundle because it's a separate entry point (CF workers bundle everything). Add a third `bun build` invocation:

```
&& bun build src/lib/worker.ts --outfile=dist/lib/worker.js --format=esm --target=bun --external hono --external zod --external @hono/zod-validator --external hono-openapi --external @scalar/hono-api-reference
```

The full `build:js` script becomes:

```
bun build src/bin/sumi-cli.ts --outfile=dist/bin/sumi-cli.js --format=esm --target=bun --external hono --external zod --external @hono/zod-validator --external hono-openapi --external @scalar/hono-api-reference && bun build src/index.ts --outfile=dist/index.js --format=esm --target=bun --external hono --external zod --external @hono/zod-validator --external hono-openapi --external @scalar/hono-api-reference && bun build src/lib/worker.ts --outfile=dist/lib/worker.js --format=esm --target=bun --external hono --external zod --external @hono/zod-validator --external hono-openapi --external @scalar/hono-api-reference
```

- [ ] **Step 3: Rebuild and verify**

```bash
cd /Users/APPLE/dev/sumi && bun run build 2>&1 | tail -10
ls dist/lib/worker.js dist/lib/worker.d.ts
```

Expected: both files exist.

- [ ] **Step 4: Commit**

```bash
cd /Users/APPLE/dev/sumi && git add package.json
git commit -m "feat(exports): add ./worker export path and include worker.ts in build"
```

---

### Task 6: Add example Cloudflare Worker app

**Files:**
- Create: `example/cf-worker/wrangler.toml`
- Create: `example/cf-worker/README.md`

> Skip README if docs are not explicitly requested; just create `wrangler.toml` as the deployment config template.

- [ ] **Step 1: Create `example/cf-worker/wrangler.toml`**

```toml
# example/cf-worker/wrangler.toml
# Cloudflare Workers deployment config for a Sumi app.
# 1. Run: sumi build --target cloudflare
# 2. Run: wrangler deploy

name = "sumi-worker"
main = "../../dist/worker.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[build]
command = "bun run build && sumi build --target cloudflare"
```

- [ ] **Step 2: Run final test suite**

```bash
cd /Users/APPLE/dev/sumi && bun test
```

Expected: all tests passing.

- [ ] **Step 3: Final commit**

```bash
cd /Users/APPLE/dev/sumi && git add example/cf-worker/wrangler.toml
git commit -m "feat(example): add Cloudflare Workers wrangler.toml deployment example"
```

---

## Self-Review Checklist

- [x] `createWorkerApp` — zero `fs`/`path`/Bun API usage; safe for CF workers
- [x] `generateWorkerEntry` — runs only at build time; correctly uses `fs`/`path`
- [x] `[param]` → `:param` conversion reuses existing `RouteParser.parseSegment`
- [x] Middleware resolution: manifest's `middleware` map is keyed by the same string as `route.middleware[]`
- [x] SSE routes (`stream` key) are supported inside `createWorkerApp` via lazy `import('hono/streaming')` (hono/streaming is CF-compatible)
- [x] `basePath` normalisation matches the pattern in `sumi.ts`
- [x] `./worker` export added to `package.json` exports and typesVersions
- [x] Build step covers `worker.ts` as a separate bundle entry
- [x] All test variable/function names consistent across tasks (`WorkerManifest`, `WorkerRouteEntry`, `createWorkerApp`, `generateWorkerEntry`)
- [x] No placeholder steps — all code is real and complete
