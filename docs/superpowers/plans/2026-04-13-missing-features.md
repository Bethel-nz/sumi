# Missing Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six missing features to Sumi: CORS config, request IDs, health check endpoint, PluginManager wiring, rate limiting, typed route client, and WebSocket support.

**Architecture:** All features follow the established pattern — config fields in `SumiConfig`, applied in `burn()` / `clearRoutesAndMiddleware()`, typed in `router.ts` where needed. WebSocket is the most invasive: it requires `createBunWebSocket()` from `hono/bun` at construction time, a `ws` key in `RouteDefinition`, and `websocket` passed to `Bun.serve`. All other features are additive and non-breaking.

**Tech Stack:** Hono built-ins (`hono/cors`, `hono/request-id`), `hono-rate-limiter` (new dep), `hono/client` (re-export), `hono/websocket` + `hono/bun` for WebSocket, `bun:test`.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| **Modify** | **`src/lib/testing.ts`** | **Make `createMockApp` async, auto-call `burn()` — do this first** |
| Modify | `src/lib/types.ts` | Add `cors?`, `requestId?`, `healthCheck?`, `rateLimit?` to `SumiConfig` |
| Modify | `src/lib/sumi.ts` | Wire all new features in constructor / `burn()` / `clearRoutesAndMiddleware()` |
| Modify | `src/lib/router.ts` | Add `WSHandler`, `WSRouteConfig`; extend `RouteDefinition.get` |
| Modify | `src/lib/pluginmanager.ts` | Add `reset(newApp)` method |
| Modify | `src/index.ts` | Export `createClient`, new config types |
| Modify | `package.json` | Add `hono-rate-limiter` dependency |
| Create | `test/features.test.ts` | Tests for CORS, request ID, health check, plugins, rate limit |
| Create | `test/websocket.test.ts` | WebSocket type and integration tests |

---

### ~~Task 0: Make `createMockApp` async~~ ✅ ALREADY DONE

**Files already updated:** `src/lib/testing.ts`, `test/sse.test.ts`, `test/features.test.ts`, `test/websocket.test.ts`

`createMockApp` is now async and auto-calls `burn()`. The returned object uses `sumi` instead of `app` for the Sumi instance. Skip this task.

The clean pattern for all tests going forward:

```ts
// Simple — just await, no burn() needed
const app = await createMockApp({ cors: true });
await app.request('/path');

// Destructure when accessing the Sumi instance
const { request, sumi, hono } = await createMockApp({});
sumi.plugins.set('db', myDb);
```

---

### ~~Task 0 original steps — kept for reference only~~

**Files:**
- Modify: `src/lib/testing.ts`
- Modify: `test/sse.test.ts` (update call site)

`createMockApp` is currently synchronous and never calls `burn()`, meaning routes and middleware are never built. Every test that uses it must awkwardly call `await app.app.burn()` manually. `createTestApp` already does the right thing — `createMockApp` should match.

- [ ] **Step 1: Make `createMockApp` async in `src/lib/testing.ts`**

Replace the entire `createMockApp` function with:

```ts
/**
 * Creates a minimal test app with custom config.
 * Automatically calls burn() so routes and middleware are ready immediately.
 */
export async function createMockApp(config: Partial<SumiConfig> = {}) {
  const mockConfig: SumiConfig = {
    logger: false,
    port: 0,
    routesDir: 'test/fixtures/routes',
    middlewareDir: 'test/fixtures/middleware',
    ...config,
  };

  const sumi = new Sumi(mockConfig);
  await sumi.burn();

  return {
    request: (path: string, init?: RequestInit) => {
      const url = `http://localhost${mockConfig.basePath || ''}${path}`;
      const request = new Request(url, init);
      return sumi.fetch()(request);
    },
    app: sumi,
    hono: sumi.app,
  };
}
```

> **Note:** Default `port` changed from `3001` to `0` — port `0` tells the OS to skip actual binding in test mode (`NODE_ENV=test` skips `Bun.serve` entirely).

- [ ] **Step 2: Update `test/sse.test.ts` to use the new async form**

In `test/sse.test.ts`, replace the `beforeAll` block:

```ts
// BEFORE:
beforeAll(async () => {
  app = createMockApp({
    routesDir: 'test/fixtures/sse-routes',
    middlewareDir: 'test/fixtures/middleware',
    port: 0,
    logger: false,
  });
  await app.app.burn();
});

// AFTER:
beforeAll(async () => {
  app = await createMockApp({
    routesDir: 'test/fixtures/sse-routes',
    middlewareDir: 'test/fixtures/middleware',
    port: 0,
    logger: false,
  });
});
```

Also update the type annotation for `app`:

```ts
// BEFORE:
let app: ReturnType<typeof createMockApp>;

// AFTER:
let app: Awaited<ReturnType<typeof createMockApp>>;
```

- [ ] **Step 3: Run existing tests to confirm nothing broke**

```bash
cd /Users/APPLE/dev/sumi && bun test 2>&1
```

Expected: all 18 existing tests still pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/APPLE/dev/sumi && git add src/lib/testing.ts test/sse.test.ts
git commit -m "refactor(testing): make createMockApp async and auto-call burn()"
```

---

### Task 1: Add config fields to `SumiConfig` and write failing tests

**Files:**
- Modify: `src/lib/types.ts`
- Create: `test/features.test.ts`

- [ ] **Step 1: Add new fields to `SumiConfig` in `src/lib/types.ts`**

Add these imports at the top of `src/lib/types.ts` after the existing imports:

```ts
import type { CorsOptions } from 'hono/cors';
import type { RateLimiterOptions } from 'hono-rate-limiter';
```

Then replace the `SumiConfig` type with this expanded version:

```ts
export type SumiConfig = {
  app?: import('hono').Hono;
  logger: boolean;
  basePath?: string;
  middlewareDir?: string;
  routesDir?: string;
  port: number;
  static?: StaticRouteConfig[];
  openapi?: OpenApiConfig;
  docs?: DocsConfig;
  hooks?: SumiHooks;
  env?: EnvConfig<any>;
  /** CORS options forwarded to hono/cors. Set to `true` for permissive defaults. */
  cors?: CorsOptions | true;
  /** Attach a unique x-request-id header to every request. */
  requestId?: boolean;
  /**
   * Auto-mount a health check endpoint.
   * Defaults to path '/healthz'. Override with `{ path: '/health' }`.
   */
  healthCheck?: boolean | { path?: string; metadata?: Record<string, unknown> };
  /** Global rate limiting via hono-rate-limiter. */
  rateLimit?: {
    windowMs: number;
    limit: number;
    keyGenerator?: (c: import('hono').Context) => string;
  };
};
```

- [ ] **Step 2: Write failing tests in `test/features.test.ts`**

```ts
// test/features.test.ts
import { describe, it, expect } from 'bun:test';
import { createMockApp } from '../src/lib/testing';

// ── CORS ────────────────────────────────────────────────────
describe('CORS', () => {
  it('adds Access-Control-Allow-Origin header when cors: true', async () => {
    const app = await createMockApp({ cors: true });
    const res = await app.request('/', {
      method: 'OPTIONS',
      headers: { Origin: 'http://example.com', 'Access-Control-Request-Method': 'GET' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });
});

// ── Request ID ──────────────────────────────────────────────
describe('Request ID', () => {
  it('adds x-request-id header when requestId: true', async () => {
    const app = await createMockApp({ requestId: true });
    const res = await app.request('/');
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });
});

// ── Health check ────────────────────────────────────────────
describe('Health check', () => {
  it('returns 200 at default /healthz when healthCheck: true', async () => {
    const app = await createMockApp({ healthCheck: true });
    const res = await app.request('/healthz');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('ok');
  });

  it('serves at custom path when healthCheck.path is set', async () => {
    const app = await createMockApp({ healthCheck: { path: '/health' } });
    const res = await app.request('/health');
    expect(res.status).toBe(200);
  });

  it('includes metadata in response when provided', async () => {
    const app = await createMockApp({
      healthCheck: { metadata: { version: '1.0.0' } },
    });
    const res = await app.request('/healthz');
    const body = await res.json() as any;
    expect(body.metadata?.version).toBe('1.0.0');
  });
});
```

- [ ] **Step 3: Run to confirm tests fail**

```bash
cd /Users/APPLE/dev/sumi && bun test test/features.test.ts 2>&1 | tail -10
```

Expected: errors about `cors`, `requestId`, `healthCheck` not being handled by Sumi yet.

- [ ] **Step 4: Commit**

```bash
cd /Users/APPLE/dev/sumi && git add src/lib/types.ts test/features.test.ts
git commit -m "test(features): add SumiConfig fields and failing tests for cors/requestId/healthCheck"
```

---

### Task 2: Implement CORS, Request ID, and Health Check in `sumi.ts`

**Files:**
- Modify: `src/lib/sumi.ts`

- [ ] **Step 1: Add new imports to `sumi.ts`**

After the existing Hono imports at the top of `src/lib/sumi.ts`, add:

```ts
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
```

- [ ] **Step 2: Add new private fields to the `Sumi` class**

Inside the class body, after `private openApiSetup: boolean = false;`, add:

```ts
private corsConfig: SumiConfig['cors'];
private requestIdEnabled: boolean;
private healthCheckConfig: SumiConfig['healthCheck'];
private rateLimitConfig: SumiConfig['rateLimit'];
```

- [ ] **Step 3: Capture config values in the constructor**

Inside the `constructor` body, after the line `this.openApiSetup = false` is implied and before `this.normalizeBasePath`, add these captures after `this.hooks = default_args.hooks || {};`:

```ts
this.corsConfig = default_args.cors;
this.requestIdEnabled = default_args.requestId ?? false;
this.healthCheckConfig = default_args.healthCheck;
this.rateLimitConfig = default_args.rateLimit;
```

- [ ] **Step 4: Create `applyBaseMiddleware()` private method**

Add this method to the `Sumi` class (after `normalizeBasePath`):

```ts
private applyBaseMiddleware(): void {
  // CORS
  if (this.corsConfig) {
    const corsOptions =
      this.corsConfig === true ? {} : this.corsConfig;
    this.app.use('*', cors(corsOptions));
  }

  // Request ID
  if (this.requestIdEnabled) {
    this.app.use('*', requestId());
  }

  // Rate limit — applied here so it runs before route handlers
  // (implementation added in Task 5)
}
```

- [ ] **Step 5: Mount health check endpoint in `setupOpenAPIEndpoints` or a new method**

Add a `setupHealthCheck()` private method to the `Sumi` class:

```ts
private setupHealthCheck(): void {
  if (!this.healthCheckConfig) return;

  const cfg =
    this.healthCheckConfig === true ? {} : this.healthCheckConfig;
  const checkPath = cfg.path ?? '/healthz';

  this.app.get(checkPath, (c) => {
    return c.json({
      status: 'ok',
      uptime: process.uptime(),
      routes: this.uniqueRoutes.size,
      ...(cfg.metadata ? { metadata: cfg.metadata } : {}),
    });
  });
}
```

- [ ] **Step 6: Wire `applyBaseMiddleware` and `setupHealthCheck` into `burn()` and `clearRoutesAndMiddleware()`**

In `burn()`, find the existing sequence in the `process.env.NODE_ENV !== 'test'` block:

```ts
this.clearRoutesAndMiddleware();
await this.middlewareHandler.applyGlobalMiddleware();
await this.build_routes();
this.setupOpenAPIEndpoints();
```

Replace with:

```ts
this.clearRoutesAndMiddleware();
this.applyBaseMiddleware();
await this.middlewareHandler.applyGlobalMiddleware();
await this.build_routes();
this.setupOpenAPIEndpoints();
this.setupHealthCheck();
```

Apply the same change in the `else` block (test environment):

```ts
this.clearRoutesAndMiddleware();
this.applyBaseMiddleware();
await this.middlewareHandler.applyGlobalMiddleware();
await this.build_routes();
this.setupOpenAPIEndpoints();
this.setupHealthCheck();
```

- [ ] **Step 7: Run tests**

```bash
cd /Users/APPLE/dev/sumi && bun test test/features.test.ts 2>&1
```

Expected: CORS, request ID, and health check tests pass. Rate limit tests don't exist yet.

- [ ] **Step 8: Commit**

```bash
cd /Users/APPLE/dev/sumi && git add src/lib/sumi.ts
git commit -m "feat(core): add CORS, requestId, and healthCheck config fields"
```

---

### Task 3: Wire PluginManager into `Sumi`

**Files:**
- Modify: `src/lib/pluginmanager.ts`
- Modify: `src/lib/sumi.ts`
- Modify: `test/features.test.ts`

- [ ] **Step 1: Add `reset()` method to `PluginManager`**

In `src/lib/pluginmanager.ts`, the class needs to update its `app` reference when `Sumi` clears and rebuilds routes. Add this method after `register()`:

```ts
reset(newApp: Hono): void {
  this.app = newApp;
  // Re-register the plugin context middleware on the fresh app
  this.app.use('*', async (c: Context, next: Next) => {
    if (!c.plugin) {
      c.plugin = {
        set: <T>(key: string, value: T): void => this.set(key, value),
        use: <T>(key: string): T => this.use<T>(key),
      };
    }
    await next();
  });
}
```

- [ ] **Step 2: Add PluginManager to `Sumi` class**

In `src/lib/sumi.ts`, add the import:

```ts
import { PluginManager } from './pluginmanager';
```

Add a private field after `private openApiSetup`:

```ts
public readonly plugins: PluginManager;
```

In the constructor, after `this.hooks = default_args.hooks || {};`, add:

```ts
this.plugins = new PluginManager(this.app);
```

In `clearRoutesAndMiddleware()`, after `this.middlewareHandler.reset(this.app)`, add:

```ts
this.plugins.reset(this.app);
```

- [ ] **Step 3: Add plugin tests to `test/features.test.ts`**

Append to `test/features.test.ts`:

```ts
// ── PluginManager ───────────────────────────────────────────
describe('PluginManager', () => {
  it('sumi.plugins.set and use store/retrieve values', async () => {
    const app = await createMockApp({});
    app.app.plugins.set('db', { query: () => 'result' });
    const db = app.app.plugins.use<{ query: () => string }>('db');
    expect(db.query()).toBe('result');
  });

  it('throws when using an unregistered plugin', async () => {
    const app = await createMockApp({});
    expect(() => app.app.plugins.use('missing')).toThrow('Plugin "missing" not found');
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/APPLE/dev/sumi && bun test test/features.test.ts 2>&1
```

Expected: all existing tests still pass + 2 new plugin tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/APPLE/dev/sumi && git add src/lib/pluginmanager.ts src/lib/sumi.ts test/features.test.ts
git commit -m "feat(plugins): wire PluginManager into Sumi as sumi.plugins"
```

---

### Task 4: Rate limiting

**Files:**
- Modify: `package.json`
- Modify: `src/lib/sumi.ts`
- Modify: `test/features.test.ts`

- [ ] **Step 1: Install `hono-rate-limiter`**

```bash
cd /Users/APPLE/dev/sumi && bun add hono-rate-limiter
```

- [ ] **Step 2: Add rate limit tests to `test/features.test.ts`**

Append to `test/features.test.ts`:

```ts
// ── Rate Limiting ───────────────────────────────────────────
describe('Rate limiting', () => {
  it('returns 429 after exceeding the limit', async () => {
    const app = await createMockApp({
      rateLimit: {
        windowMs: 60_000,
        limit: 2,
        keyGenerator: (_c) => 'test-key', // same key for all requests
      },
    });

    // First two requests should succeed
    await app.request('/');
    await app.request('/');

    // Third request should be rate-limited
    const res = await app.request('/');
    expect(res.status).toBe(429);
  });
});
```

- [ ] **Step 3: Run to confirm rate limit test fails**

```bash
cd /Users/APPLE/dev/sumi && bun test test/features.test.ts --testNamePattern="Rate limiting" 2>&1
```

Expected: test fails — rate limiting not implemented yet.

- [ ] **Step 4: Add rate limiter import and implementation to `sumi.ts`**

Add import at the top of `sumi.ts`:

```ts
import { rateLimiter } from 'hono-rate-limiter';
```

In the `applyBaseMiddleware()` method, replace the `// (implementation added in Task 5)` comment with:

```ts
// Rate limiting
if (this.rateLimitConfig) {
  this.app.use(
    '*',
    rateLimiter({
      windowMs: this.rateLimitConfig.windowMs,
      limit: this.rateLimitConfig.limit,
      keyGenerator:
        this.rateLimitConfig.keyGenerator ??
        ((c) =>
          c.req.header('x-forwarded-for') ??
          c.req.header('cf-connecting-ip') ??
          'unknown'),
    })
  );
}
```

- [ ] **Step 5: Run all feature tests**

```bash
cd /Users/APPLE/dev/sumi && bun test test/features.test.ts 2>&1
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/APPLE/dev/sumi && git add package.json bun.lockb src/lib/sumi.ts test/features.test.ts
git commit -m "feat(core): add rate limiting via hono-rate-limiter"
```

---

### Task 5: Typed route client (`createClient` re-export)

**Files:**
- Modify: `src/index.ts`

Hono's `hc` function creates a typed HTTP client. Sumi exposes `sumi.app` (a public `Hono` instance), so callers can write:

```ts
type AppType = typeof sumiInstance.app
const client = createClient<AppType>('http://localhost:3000')
```

- [ ] **Step 1: Re-export `hc` from `src/index.ts`**

In `src/index.ts`, add one line:

```ts
export { hc as createClient } from 'hono/client';
```

The full `src/index.ts` becomes:

```ts
export { Sumi, defineConfig } from './lib/sumi';
export type {
  SumiAppConfig,
  StaticRouteConfig,
  SumiContext,
} from './lib/sumi';
export * from './lib/router';
export { hibana } from './hibana';
export { createTestApp, createMockApp } from './lib/testing';
export { hc as createClient } from 'hono/client';
```

- [ ] **Step 2: Write type-check test**

Append to `test/features.test.ts`:

```ts
// ── Typed client ────────────────────────────────────────────
describe('createClient', () => {
  it('is a function (re-export of hono hc)', async () => {
    const { createClient } = await import('../src/index');
    expect(typeof createClient).toBe('function');
  });
});
```

- [ ] **Step 3: Run test**

```bash
cd /Users/APPLE/dev/sumi && bun test test/features.test.ts --testNamePattern="createClient" 2>&1
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/APPLE/dev/sumi && git add src/index.ts test/features.test.ts
git commit -m "feat: export createClient (hono hc) from sumi public API"
```

---

### Task 6: WebSocket support

**Files:**
- Modify: `src/lib/router.ts`
- Modify: `src/lib/sumi.ts`
- Create: `test/websocket.test.ts`
- Create: `test/fixtures/ws-routes/chat.ts`

WebSocket upgrades always arrive as GET requests. The `ws` key is added to `RouteDefinition.get` alongside the existing `SSERouteConfig`.

- [ ] **Step 1: Add WebSocket types to `src/lib/router.ts`**

Add this import at the top of `router.ts` (after the SSEStreamingApi import):

```ts
import type { WSContext } from 'hono/ws';
```

Add these types after the `SSERouteConfig` interface:

```ts
export interface WSHandler {
  onOpen?: (evt: Event, ws: WSContext<unknown>) => void | Promise<void>;
  onMessage?: (
    evt: MessageEvent<string | ArrayBuffer | Blob>,
    ws: WSContext<unknown>
  ) => void | Promise<void>;
  onClose?: (evt: CloseEvent, ws: WSContext<unknown>) => void | Promise<void>;
  onError?: (evt: Event, ws: WSContext<unknown>) => void | Promise<void>;
}

export interface WSRouteConfig {
  /** Factory called per-connection to return the WebSocket event handlers. */
  ws: (c: Context) => WSHandler;
  middleware?: string[];
}
```

Update `RouteDefinition.get` to also accept `WSRouteConfig`:

```ts
export interface RouteDefinition {
  get?: RouteConfig<any> | RouteHandler | SSERouteConfig | WSRouteConfig;
  post?: RouteConfig<any> | RouteHandler;
  put?: RouteConfig<any> | RouteHandler;
  delete?: RouteConfig<any> | RouteHandler;
  patch?: RouteConfig<any> | RouteHandler;
  _?: RouteConfig<any> | MiddlewareHandler;
}
```

- [ ] **Step 2: Write WebSocket type-check test**

Create `test/websocket.test.ts`:

```ts
// test/websocket.test.ts
import { describe, it, expect, beforeAll } from 'bun:test';
import { createRoute } from '../src/lib/router';
import type { WSRouteConfig } from '../src/lib/router';

// ── Type compilation check ────────────────────────────────
describe('WSRouteConfig type', () => {
  it('createRoute accepts a ws key on get', () => {
    const route = createRoute({
      get: {
        ws: (_c) => ({
          onOpen(_evt, ws) { ws.send('connected'); },
          onMessage(evt, ws) { ws.send(`echo: ${evt.data}`); },
          onClose() {},
        }),
      } satisfies WSRouteConfig,
    });
    expect(route).toBeDefined();
  });
});

// ── Integration ───────────────────────────────────────────
describe('WebSocket integration', () => {
  let port: number;

  beforeAll(async () => {
    const { createMockApp } = await import('../src/lib/testing');
    port = 4321;

    await createMockApp({
      routesDir: 'test/fixtures/ws-routes',
      middlewareDir: 'test/fixtures/middleware',
      port,
      logger: false,
    });
    // burn() is called internally by createMockApp; server is up at port 4321
  });

  it('upgrades connection and echoes messages', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/chat`);

    const received = await new Promise<string>((resolve, reject) => {
      ws.onopen = () => ws.send('hello');
      ws.onmessage = (e) => resolve(e.data as string);
      ws.onerror = reject;
      setTimeout(() => reject(new Error('timeout')), 3000);
    });

    ws.close();
    expect(received).toBe('echo: hello');
  });
});
```

- [ ] **Step 3: Create WebSocket fixture route**

Create `test/fixtures/ws-routes/chat.ts`:

```ts
// test/fixtures/ws-routes/chat.ts
import { createRoute } from '../../../src/lib/router';

export default createRoute({
  get: {
    ws: (_c) => ({
      onMessage(evt, ws) {
        ws.send(`echo: ${evt.data}`);
      },
    }),
  },
});
```

- [ ] **Step 4: Run to confirm WebSocket test fails**

```bash
cd /Users/APPLE/dev/sumi && bun test test/websocket.test.ts 2>&1
```

Expected: type test passes; integration test fails — `ws` key not handled in `processRouteFile`.

- [ ] **Step 5: Add WebSocket handling to `sumi.ts`**

Add these imports at the top of `sumi.ts`:

```ts
import { createBunWebSocket } from 'hono/bun';
```

Add a private field in the `Sumi` class after `private openApiSetup`:

```ts
private bunWS = createBunWebSocket();
```

In `processRouteFile`, find the SSE detection block (the `'stream' in methodConfig` check). Add a new branch **before** it that handles `'ws' in methodConfig`. The full updated if/else chain in the `for` loop body looks like:

```ts
      if (typeof methodConfig === 'function') {
        userHandler = methodConfig;
      } else if (
        typeof methodConfig === 'object' &&
        'ws' in methodConfig &&
        typeof (methodConfig as any).ws === 'function'
      ) {
        // WebSocket route
        const wsFactory = (methodConfig as any).ws;

        if (
          (methodConfig as any).middleware &&
          Array.isArray((methodConfig as any).middleware)
        ) {
          for (const middlewareName of (methodConfig as any).middleware) {
            const mw = await this.resolveMiddleware(middlewareName);
            if (mw) middlewareChain.push(mw);
          }
        }

        userHandler = this.bunWS.upgradeWebSocket((c: any) => wsFactory(c));
      } else if (
        typeof methodConfig === 'object' &&
        'stream' in methodConfig &&
        typeof (methodConfig as any).stream === 'function'
      ) {
        // existing SSE block — unchanged ...
```

- [ ] **Step 6: Pass `websocket` to `Bun.serve` in `burn()`**

In `burn()`, find the `Bun.serve({...})` call. Replace it with:

```ts
this.server = Bun.serve({
  port: serverPort,
  development: true,
  websocket: this.bunWS.websocket,
  fetch: async (req) => {
    const url = new URL(req.url);
    const cache =
      process.env.NODE_ENV === 'development'
        ? 'no-store'
        : 'public, max-age=86400';
    const base = this.app_base_path ?? '';

    if (
      url.pathname === '/favicon.ico' ||
      (base && url.pathname === `${base}/favicon.ico`)
    ) {
      const file = Bun.file(path.resolve('public/favicon.ico'));
      if (await file.exists()) {
        const mime =
          url.pathname.endsWith('.ico')
            ? 'image/x-icon'
            : url.pathname.endsWith('.png')
            ? 'image/png'
            : url.pathname.endsWith('.webmanifest')
            ? 'application/manifest+json'
            : 'application/octet-stream';

        return new Response(file, {
          headers: {
            'content-type': mime,
            'cache-control': cache,
          },
        });
      }
      return new Response('Not found', { status: 404 });
    }
    return appFetch(req);
  },
});
```

The only change from the original is adding `websocket: this.bunWS.websocket,` — the rest of the `Bun.serve` call is identical.

- [ ] **Step 7: Run WebSocket tests**

```bash
cd /Users/APPLE/dev/sumi && bun test test/websocket.test.ts 2>&1
```

Expected: both tests pass (type check + echo integration test).

- [ ] **Step 8: Run full test suite**

```bash
cd /Users/APPLE/dev/sumi && bun test 2>&1
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
cd /Users/APPLE/dev/sumi && git add src/lib/router.ts src/lib/sumi.ts test/websocket.test.ts test/fixtures/ws-routes/chat.ts
git commit -m "feat(ws): add WebSocket support via WSRouteConfig and createBunWebSocket"
```

---

### Task 7: Update exports and rebuild

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Export new types from `src/index.ts`**

The existing `export * from './lib/router'` already covers `WSRouteConfig`, `WSHandler`, `SSERouteConfig`, `SSEStreamHandler`. Verify the build compiles:

```bash
cd /Users/APPLE/dev/sumi && bun run build 2>&1 | tail -15
```

Expected: no errors. `dist/index.js`, `dist/lib/worker.js` both built.

- [ ] **Step 2: Final full test run**

```bash
cd /Users/APPLE/dev/sumi && bun test 2>&1
```

Expected: all tests pass.

- [ ] **Step 3: Final commit**

```bash
cd /Users/APPLE/dev/sumi && git add dist/ src/index.ts
git commit -m "feat: rebuild dist with all new features (WS, CORS, requestId, health, plugins, rateLimit, client)"
```

---

## Self-Review Checklist

- [x] `applyBaseMiddleware()` is called in both branches of `burn()` (production + test) and in `clearRoutesAndMiddleware()` is implied via `burn()` calling `clearRoutesAndMiddleware()` first — but IMPORTANT: `clearRoutesAndMiddleware` rebuilds a new `app` without re-applying base middleware. `applyBaseMiddleware` is called in `burn()` **after** `clearRoutesAndMiddleware()`, which is correct.
- [x] `PluginManager.reset()` re-registers the `c.plugin` middleware on the new app — required because `clearRoutesAndMiddleware` replaces `this.app`
- [x] `bunWS = createBunWebSocket()` is called once at construction, not per-route — correct, Bun needs a single `websocket` handler object per server
- [x] `ws` branch checked **before** `stream` branch in processRouteFile — both use object detection, no conflict
- [x] Rate limiter `keyGenerator` has a safe fallback chain (`x-forwarded-for` → `cf-connecting-ip` → `'unknown'`)
- [x] `healthCheck` response includes `uptime` and `routes` count — useful for infra without being opinionated
- [x] `createClient` is a named re-export of `hc` — users can do `createClient<typeof sumi.app>(baseUrl)`
- [x] No placeholder steps — all code shown in full
- [x] Type names consistent: `WSRouteConfig`, `WSHandler`, `WSContext` across all tasks
