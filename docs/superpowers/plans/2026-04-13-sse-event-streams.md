# SSE / Event Streams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow route files to declare Server-Sent Events (SSE) handlers using a `stream` key in the route config, with full Hono `streamSSE` integration and type safety.

**Architecture:** Add an `SSERouteConfig` type to `router.ts` alongside the existing `RouteConfig`. Detect the `stream` key in `sumi.ts`'s `processRouteFile` and wrap the user's stream callback with Hono's `streamSSE`. No new files — two file modifications plus tests and an example fixture.

**Tech Stack:** Hono `streamSSE` + `SSEStreamingApi` from `hono/streaming`, Bun test (`bun:test`), existing `createMockApp` from `src/lib/testing.ts`.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/router.ts` | Add `SSEStreamHandler`, `SSERouteConfig` types; extend `RouteDefinition.get` to accept `SSERouteConfig` |
| Modify | `src/lib/sumi.ts` | Detect `stream` key in `processRouteFile`; wrap with `streamSSE` |
| Modify | `src/index.ts` | Re-export new SSE types |
| Create | `test/fixtures/sse-routes/events.ts` | Fixture route for tests |
| Create | `test/sse.test.ts` | Integration tests |
| Create | `example/routes/events.ts` | Example SSE route |

---

### Task 1: Add SSE types to `router.ts`

**Files:**
- Modify: `src/lib/router.ts`
- Create: `test/sse.test.ts` (skeleton to verify type compilation only — no runtime test yet)

- [ ] **Step 1: Write the failing type-check test (compilation check)**

Create `test/sse.test.ts`:

```ts
// test/sse.test.ts
import { describe, it, expect } from 'bun:test';
import { createRoute } from '../src/lib/router';
import type { SSERouteConfig } from '../src/lib/router';

// This file must compile without errors once types are added.
describe('SSERouteConfig type', () => {
  it('createRoute accepts a stream key on get', () => {
    const route = createRoute({
      get: {
        stream: async (stream) => {
          await stream.writeSSE({ data: 'hello', event: 'message' });
        },
      } satisfies SSERouteConfig,
    });
    expect(route).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails (type error)**

```bash
cd /Users/APPLE/dev/sumi && bun test test/sse.test.ts
```

Expected: error — `SSERouteConfig` does not exist in `../src/lib/router`.

- [ ] **Step 3: Add SSE types to `src/lib/router.ts`**

Add these lines after the existing imports at the top of `src/lib/router.ts`:

```ts
import type { SSEStreamingApi } from 'hono/streaming';
```

Then add these types after the `OpenApiConfig` type alias (currently line 44):

```ts
export type SSEStreamHandler = (stream: SSEStreamingApi) => Promise<void>;

export interface SSERouteConfig {
  stream: SSEStreamHandler;
  middleware?: string[];
  openapi?: OpenApiConfig;
}
```

Then update the `RouteDefinition` interface so that `get` also accepts `SSERouteConfig`:

```ts
export interface RouteDefinition {
  get?: RouteConfig<any> | RouteHandler | SSERouteConfig;
  post?: RouteConfig<any> | RouteHandler;
  put?: RouteConfig<any> | RouteHandler;
  delete?: RouteConfig<any> | RouteHandler;
  patch?: RouteConfig<any> | RouteHandler;
  _?: RouteConfig<any> | MiddlewareHandler;
}
```

- [ ] **Step 4: Run type-check test to confirm it passes**

```bash
cd /Users/APPLE/dev/sumi && bun test test/sse.test.ts
```

Expected: PASS (1 test passing).

- [ ] **Step 5: Commit**

```bash
cd /Users/APPLE/dev/sumi && git add src/lib/router.ts test/sse.test.ts
git commit -m "feat(types): add SSERouteConfig and SSEStreamHandler types to router"
```

---

### Task 2: Create SSE fixture route and add runtime integration tests

**Files:**
- Create: `test/fixtures/sse-routes/events.ts`
- Modify: `test/sse.test.ts`

- [ ] **Step 1: Create the fixture route**

Create directory and file `test/fixtures/sse-routes/events.ts`:

```ts
// test/fixtures/sse-routes/events.ts
import { createRoute } from '../../../src/lib/router';

export default createRoute({
  get: {
    stream: async (stream) => {
      await stream.writeSSE({ data: 'ping', event: 'heartbeat', id: '1' });
      await stream.writeSSE({ data: 'done', event: 'end', id: '2' });
    },
  },
});
```

- [ ] **Step 2: Add runtime integration tests to `test/sse.test.ts`**

Replace the contents of `test/sse.test.ts` with:

```ts
// test/sse.test.ts
import { describe, it, expect, beforeAll } from 'bun:test';
import { createRoute } from '../src/lib/router';
import type { SSERouteConfig } from '../src/lib/router';
import { createMockApp } from '../src/lib/testing';

// ── Type compilation check ────────────────────────────────
describe('SSERouteConfig type', () => {
  it('createRoute accepts a stream key on get', () => {
    const route = createRoute({
      get: {
        stream: async (stream) => {
          await stream.writeSSE({ data: 'hello', event: 'message' });
        },
      } satisfies SSERouteConfig,
    });
    expect(route).toBeDefined();
  });
});

// ── Integration: SSE response ─────────────────────────────
describe('SSE route integration', () => {
  let app: ReturnType<typeof createMockApp>;

  beforeAll(async () => {
    app = createMockApp({
      routesDir: 'test/fixtures/sse-routes',
      middlewareDir: 'test/fixtures/middleware',
      port: 0,
      logger: false,
    });
    // build_routes is not called in createMockApp constructor — it must burn()
    await app.app.burn();
  });

  it('responds with Content-Type: text/event-stream', async () => {
    const res = await app.request('/events');
    expect(res.headers.get('content-type')).toContain('text/event-stream');
  });

  it('streams SSE data in correct format', async () => {
    const res = await app.request('/events');
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toContain('event: heartbeat');
    expect(text).toContain('data: ping');
    expect(text).toContain('event: end');
    expect(text).toContain('data: done');
  });
});
```

- [ ] **Step 3: Create the fixture middleware directory (required by createMockApp)**

```bash
mkdir -p /Users/APPLE/dev/sumi/test/fixtures/middleware
```

- [ ] **Step 4: Run tests to confirm integration tests fail**

```bash
cd /Users/APPLE/dev/sumi && bun test test/sse.test.ts
```

Expected: `SSERouteConfig type` passes. `SSE route integration` tests fail — `createMockApp` doesn't expose `burn()` / routes are not built yet, and `processRouteFile` doesn't handle `stream` key.

- [ ] **Step 5: Commit fixture files**

```bash
cd /Users/APPLE/dev/sumi && git add test/fixtures/sse-routes/events.ts test/fixtures/middleware test/sse.test.ts
git commit -m "test(sse): add integration test fixtures and failing integration tests"
```

---

### Task 3: Implement SSE handling in `sumi.ts`

**Files:**
- Modify: `src/lib/sumi.ts`

- [ ] **Step 1: Add `streamSSE` import to `sumi.ts`**

At the top of `src/lib/sumi.ts`, add to the existing Hono imports:

```ts
import { streamSSE } from 'hono/streaming';
```

The full import block should now look like:

```ts
import { Hono, Next, Context as HonoContext } from 'hono';
import { serveStatic } from 'hono/bun';
import { streamSSE } from 'hono/streaming';
```

- [ ] **Step 2: Add SSE detection inside `processRouteFile`**

In `sumi.ts`, locate `processRouteFile`. Find the block starting at approximately line 420:

```ts
      if (typeof methodConfig === 'function') {
        userHandler = methodConfig;
      } else if (typeof methodConfig === 'object' && methodConfig.handler) {
```

Extend it to also handle the `stream` key. The full block becomes:

```ts
      if (typeof methodConfig === 'function') {
        userHandler = methodConfig;
      } else if (
        typeof methodConfig === 'object' &&
        'stream' in methodConfig &&
        typeof (methodConfig as any).stream === 'function'
      ) {
        // SSE route — wrap the user's stream callback with Hono's streamSSE
        const sseCallback = (methodConfig as any).stream;

        if ((methodConfig as any).openapi) {
          middlewareChain.push(describeRoute((methodConfig as any).openapi));
        }

        if (
          (methodConfig as any).middleware &&
          Array.isArray((methodConfig as any).middleware)
        ) {
          for (const middlewareName of (methodConfig as any).middleware) {
            const middleware = await this.resolveMiddleware(middlewareName);
            if (middleware) {
              middlewareChain.push(middleware);
            }
          }
        }

        userHandler = (c: HonoContext) => streamSSE(c, sseCallback);
      } else if (typeof methodConfig === 'object' && methodConfig.handler) {
        // existing handler path ...
```

> **Important:** The `} else if (typeof methodConfig === 'object' && methodConfig.handler) {` block continues unchanged after this new block. Do not remove it.

- [ ] **Step 3: Run integration tests**

```bash
cd /Users/APPLE/dev/sumi && bun test test/sse.test.ts
```

Expected: all 3 tests passing (type check + 2 integration tests).

- [ ] **Step 4: Commit**

```bash
cd /Users/APPLE/dev/sumi && git add src/lib/sumi.ts
git commit -m "feat(core): detect SSERouteConfig stream key in processRouteFile and wrap with streamSSE"
```

---

### Task 4: Export types and add example route

**Files:**
- Modify: `src/index.ts`
- Create: `example/routes/events.ts`

- [ ] **Step 1: Re-export `SSERouteConfig` and `SSEStreamHandler` from `src/index.ts`**

The existing `export * from './lib/router'` already re-exports everything from `router.ts`, so no change to `src/index.ts` is needed — `SSERouteConfig` and `SSEStreamHandler` are already public. Verify:

```bash
cd /Users/APPLE/dev/sumi && grep -n "SSERouteConfig" dist/index.js 2>/dev/null || echo "rebuild needed"
bun run build
grep "SSERouteConfig\|SSEStreamHandler" dist/index.js | head -5
```

Expected: type names appear in the build output.

- [ ] **Step 2: Create example SSE route**

Create `example/routes/events.ts`:

```ts
// example/routes/events.ts
// Accessible at GET /api/v1/events (with basePath from example config)
import { createRoute } from '../../src/lib/router';

export default createRoute({
  get: {
    stream: async (stream) => {
      let count = 0;
      while (count < 5) {
        await stream.writeSSE({
          data: JSON.stringify({ tick: count, ts: Date.now() }),
          event: 'tick',
          id: String(count),
        });
        await stream.sleep(1000);
        count++;
      }
      await stream.writeSSE({ data: 'stream closed', event: 'done' });
    },
  },
});
```

- [ ] **Step 3: Run all tests**

```bash
cd /Users/APPLE/dev/sumi && bun test
```

Expected: all tests passing.

- [ ] **Step 4: Final commit**

```bash
cd /Users/APPLE/dev/sumi && git add src/index.ts example/routes/events.ts
git commit -m "feat(sse): export SSERouteConfig types and add example SSE route"
```

---

## Self-Review Checklist

- [x] `SSERouteConfig` typed — `stream`, `middleware?`, `openapi?`
- [x] SSE detection in `processRouteFile` handles middleware chain before wrapping
- [x] `streamSSE` imported at top of `sumi.ts`, not dynamically
- [x] SSE only accepted on `get` (correct — SSE is always GET)
- [x] Type test + integration test (Content-Type + body format)
- [x] No placeholder steps — all code is real
- [x] `createMockApp` note: `burn()` must be called separately — tests reflect this
