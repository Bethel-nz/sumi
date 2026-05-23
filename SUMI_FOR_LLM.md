# Sumi Framework — Complete Context for AI Assistants

> Use this document to understand and generate code for **Sumi** (`@bethel-nz/sumi` v1.1.5), a Bun-only file-based web framework built on top of [Hono](https://hono.dev). Every concept below maps directly to real code you can write.

---

## 1. What Sumi Is

Sumi is a thin layer on top of Hono that gives you:

- **File-based routing** — folder/file structure maps directly to URL paths
- **Schema validation** — Zod schemas declared alongside handlers; `c.req.valid()` is fully typed
- **Named middleware** — middleware files become string names; Sumi wires them up by name at build time
- **Built-ins** — OpenAPI/Scalar docs, SSE, WebSockets, CORS, requestId, health check, rate limiting, static files
- **Zero extra deps for users** — everything runs on Bun, no config beyond `sumi.config.ts`

**Runtime requirement: Bun only.** Do not suggest Node.js or Deno.

---

## 2. Project Layout

```
my-project/
├── sumi.config.ts          # required — app config
├── sumi.d.ts               # auto-generated at dev time — DO NOT edit
├── tsconfig.json           # auto-created/patched by sumi dev if missing bun types
├── routes/                 # file-based routes
│   ├── index.ts            # → GET/POST/… /
│   ├── users/
│   │   ├── index.ts        # → /users
│   │   └── [id].ts         # → /users/:id
│   └── events.ts           # → /events (SSE if stream key present)
└── middleware/
    ├── _index.ts           # global middleware (underscore prefix = applied everywhere)
    └── auth.ts             # named middleware, used as middleware: ['auth']
```

---

## 3. `sumi.config.ts`

```ts
import { defineConfig } from '@bethel-nz/sumi';

export default defineConfig({
  port: 3000,
  logger: true,
  basePath: '/api/v1',        // optional — all routes mount under this prefix
  routesDir: './routes',
  middlewareDir: './middleware',

  cors: true,                  // or pass hono/cors options object
  requestId: true,             // adds x-request-id to every response
  healthCheck: { path: '/healthz' },  // auto GET /healthz endpoint

  rateLimit: {                 // optional, requires hono-rate-limiter installed
    windowMs: 60_000,
    limit: 100,
  },

  openapi: {
    documentation: {
      info: { title: 'My API', version: '1.0.0' },
      servers: [{ url: 'http://localhost:3000/api/v1' }],
    },
  },

  docs: {
    path: '/docs',             // Scalar UI at /api/v1/docs
    theme: 'purple',
    pageTitle: 'My API Docs',
  },

  hooks: {
    onReady: () => console.log('Server up'),
    onRequest: async (c) => { /* runs before every request */ },
    onResponse: async (c) => { /* runs after every response */ },
    onError: async (error, c) => { /* global error hook */ },
    onFileChange: (path, type) => { /* dev-mode file watcher */ },
  },
});
```

---

## 4. Route Files

Every route file exports a default `createRoute({...})` object. Keys are HTTP methods (`get`, `post`, `put`, `delete`, `patch`) plus `_` for route-level middleware.

### 4a. Basic route (no schema)

```ts
// routes/ping.ts → GET /api/v1/ping
import { createRoute } from '@bethel-nz/sumi/router';

export default createRoute({
  get: (c) => c.json({ pong: true }),
});
```

### 4b. Route with Zod schema + OpenAPI

```ts
// routes/users/[id].ts → GET /users/:id
import { z } from 'zod';
import { createRoute } from '@bethel-nz/sumi/router';
import { resolver } from 'hono-openapi/zod';

const paramSchema = z.object({ id: z.string() });
const responseSchema = z.object({ id: z.string(), name: z.string() });

export default createRoute({
  get: {
    schema: {
      param: paramSchema,          // path params
      query: z.object({ v: z.string().optional() }),  // query string
      json: z.object({ body: z.string() }),            // request body
      header: z.object({ 'x-token': z.string() }),    // headers
    },
    handler: (c) => {
      const { id } = c.req.valid('param');   // fully typed
      const { v }  = c.req.valid('query');
      return c.json({ id, name: `User ${id}` });
    },
    openapi: {
      summary: 'Get user by ID',
      tags: ['users'],
      responses: {
        200: {
          description: 'User object',
          content: { 'application/json': { schema: resolver(responseSchema) } },
        },
      },
    },
    middleware: ['auth'],           // named middleware applied before handler
  },
});
```

### 4c. Multiple methods in one file

```ts
export default createRoute({
  get: {
    schema: { query: z.object({ page: z.string().optional() }) },
    handler: (c) => c.json({ items: [] }),
  },
  post: {
    schema: { json: z.object({ name: z.string() }) },
    handler: (c) => {
      const { name } = c.req.valid('json');
      return c.json({ created: name }, 201);
    },
  },
  delete: (c) => c.json({ deleted: true }),  // shorthand — no schema needed
});
```

### 4d. SSE (Server-Sent Events)

Use `stream` key instead of `handler`. Sumi wraps it with `streamSSE` automatically and passes both the stream object **and the full Hono context** as arguments.

```ts
// routes/events.ts → GET /events
import { createRoute } from '@bethel-nz/sumi/router';

export default createRoute({
  get: {
    schema: {
      query: z.object({ topic: z.string().optional() }),
    },
    stream: async (stream, c) => {   // c is the full Hono Context
      const { topic } = c.req.valid('query');
      const userId = c.get('userId'); // values set by middleware are available

      for (let i = 0; i < 10; i++) {
        await stream.writeSSE({
          event: 'update',
          data: JSON.stringify({ index: i, topic, userId }),
          id: String(i),
        });
        await stream.sleep(500);
      }
      await stream.writeSSE({ event: 'done', data: '' });
    },
    middleware: ['auth'],
  },
});
```

**POST + SSE** — `c.req.valid('json')` works too because `c` is fully available:

```ts
export default createRoute({
  post: {
    schema: { json: z.object({ prompt: z.string() }) },
    middleware: ['auth'],
    stream: async (stream, c) => {
      const { prompt } = c.req.valid('json');   // POST body accessible here
      await stream.writeSSE({ event: 'token', data: prompt });
      await stream.writeSSE({ event: 'done', data: '' });
    },
  },
});
```

### 4e. WebSocket

Use a `+ws.ts` suffix file (e.g. `routes/chat/+ws.ts`).

```ts
// routes/chat/+ws.ts → WS /chat
import { createWS } from '@bethel-nz/sumi/router';

export default createWS({
  handler: (c) => ({
    onOpen:    (evt, ws) => ws.send('connected'),
    onMessage: (evt, ws) => ws.send(`echo: ${evt.data}`),
    onClose:   () => console.log('closed'),
  }),
});
```

---

## 5. Middleware Files

Every file in `middlewareDir` is auto-registered. Files with an underscore prefix (`_index.ts`) are applied globally to all routes. Files without underscore are named — use them in `middleware: ['filename']` (without `.ts`).

### 5a. Global middleware (`_index.ts`)

```ts
// middleware/_index.ts — runs on every request
import { createMiddleware } from '@bethel-nz/sumi/router';
import type { SumiContext } from '@bethel-nz/sumi/types';

export default createMiddleware({
  _: async (c: SumiContext, next) => {
    console.log(`→ ${c.req.method} ${c.req.url}`);
    await next();
    console.log(`← ${c.res.status}`);
  },
});
```

### 5b. Named middleware (`auth.ts`)

```ts
// middleware/auth.ts — used as middleware: ['auth']
import { createMiddleware } from '@bethel-nz/sumi/router';
import type { SumiContext } from '@bethel-nz/sumi/types';

export default createMiddleware({
  _: async (c: SumiContext, next) => {
    const token = c.req.header('authorization')?.replace('Bearer ', '');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'user_123');  // available via c.get('userId') in routes
    await next();
  },
});
```

### 5c. Passing data from middleware to route handlers

Use `c.set()` in middleware and `c.get()` in handlers. For full type safety, extend Hono's `ContextVariableMap` in a `types.d.ts` at the project root:

```ts
// types.d.ts
declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    userLastSeen: Date | null;
  }
}
```

### 5d. Type safety for middleware names

When `sumi dev` runs, it generates `sumi.d.ts` in the project root:

```ts
// sumi.d.ts (auto-generated — do not edit)
declare global {
  type MiddlewareName = 'auth' | '_index';
}
```

`middleware: ['typo']` becomes a TypeScript error. `sumi dev` also auto-creates or patches `tsconfig.json` to include `types: ['bun']` and `include: ['**/*.ts']` so both `sumi.d.ts` and Bun globals are always picked up.

---

## 6. Key Types

```ts
import type { SumiContext } from '@bethel-nz/sumi/types';
import type { SumiConfig }  from '@bethel-nz/sumi/types';
```

| Type | Description |
|---|---|
| `SumiContext` | Hono `Context` extended with `validatedEnv` |
| `SumiConfig` | Full config shape passed to `defineConfig()` |
| `ValidationTarget` | `'json' \| 'form' \| 'query' \| 'param' \| 'header' \| 'cookie'` |
| `RouteConfig<T>` | `{ schema?, handler, openapi?, middleware? }` |
| `SSERouteConfig` | `{ stream: (stream, c) => Promise<void>, middleware?, openapi? }` |
| `WebSocketDefinition` | `{ handler: (c) => WSHandler, middleware? }` |

---

## 7. Testing

```ts
import { createMockApp } from '@bethel-nz/sumi/testing';

// createMockApp is async — it auto-calls burn() so routes are ready
const { request, sumi, hono } = await createMockApp({
  routesDir: 'routes',
  middlewareDir: 'middleware',
  basePath: '/api/v1',
});

// Make requests
const res = await request('/users', { method: 'GET' });
const body = await res.json();

// Access underlying instances
console.log(sumi);  // Sumi instance
console.log(hono);  // raw Hono app
```

For testing against your real `sumi.config.ts`:

```ts
import { createTestApp } from '@bethel-nz/sumi/testing';

const app = await createTestApp({ configPath: 'sumi.config.ts' });
const res = await app.request('/healthz');
```

---

## 8. File Naming → URL Mapping

| File path | URL path |
|---|---|
| `routes/index.ts` | `/` |
| `routes/users/index.ts` | `/users` |
| `routes/users/[id].ts` | `/users/:id` |
| `routes/posts/[postId]/comments/[id].ts` | `/posts/:postId/comments/:id` |
| `routes/chat/+ws.ts` | `/chat` (WebSocket) |

Dynamic segments use `[name]` brackets. Catch-all: `[...slug].ts` → `/*`.

---

## 9. Entry Point & CLI

```bash
# Development (hot reload) — also ensures tsconfig.json has bun types
sumi dev

# Production
sumi start

# Build (TypeScript + assets)
sumi build

# Build for Cloudflare Workers
sumi build --target cloudflare

# New project scaffold
sumi init
```

There is no `index.ts` entry point you write manually — `sumi.config.ts` is the entry. Sumi reads it and calls `burn()` internally to start the Hono server via `Bun.serve`.

---

## 10. Groq + Sumi — Lightweight AI API Blueprint

### Install deps

```bash
bun add groq-sdk @bethel-nz/sumi
```

### `sumi.config.ts`

```ts
import { defineConfig } from '@bethel-nz/sumi';

export default defineConfig({
  port: 3000,
  logger: true,
  basePath: '/api',
  routesDir: './routes',
  middlewareDir: './middleware',
  cors: true,
  requestId: true,
  healthCheck: { path: '/healthz' },
  openapi: {
    documentation: {
      info: { title: 'AI API', version: '1.0.0' },
    },
  },
  docs: { path: '/docs' },
});
```

### `middleware/auth.ts`

```ts
import { createMiddleware } from '@bethel-nz/sumi/router';
import type { SumiContext } from '@bethel-nz/sumi/types';

export default createMiddleware({
  _: async (c: SumiContext, next) => {
    const key = c.req.header('x-api-key');
    if (key !== process.env.API_KEY) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
  },
});
```

### `routes/chat.ts` — single-response chat

Always lazy-initialize SDK clients that read from `process.env` — initializing at module top level throws if the env var is missing, which causes Sumi to silently skip the route at startup.

```ts
import { z } from 'zod';
import { createRoute } from '@bethel-nz/sumi/router';
import Groq from 'groq-sdk';

// Lazy singleton — safe, only constructed on first request
let _groq: Groq | null = null;
function getGroq(): Groq {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not set');
    _groq = new Groq({ apiKey });
  }
  return _groq;
}

const bodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })),
  model: z.string().default('llama-3.3-70b-versatile'),
});

export default createRoute({
  post: {
    schema: { json: bodySchema },
    middleware: ['auth'],
    handler: async (c) => {
      const { messages, model } = c.req.valid('json');
      const completion = await getGroq().chat.completions.create({ model, messages });
      return c.json({
        content: completion.choices[0].message.content,
        model: completion.model,
        usage: completion.usage,
      });
    },
    openapi: { summary: 'Chat completion', tags: ['ai'] },
  },
});
```

### `routes/chat/stream.ts` — streaming chat via SSE

`stream:` handlers receive `(stream, c)` — the full context is always available, including validated body, path params, and values set by middleware. No workarounds needed.

```ts
import { z } from 'zod';
import { createRoute } from '@bethel-nz/sumi/router';
import Groq from 'groq-sdk';

let _groq: Groq | null = null;
function getGroq(): Groq {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not set');
    _groq = new Groq({ apiKey });
  }
  return _groq;
}

export default createRoute({
  post: {
    schema: {
      json: z.object({
        prompt: z.string(),
        model: z.string().optional().default('llama-3.3-70b-versatile'),
      }),
    },
    middleware: ['auth'],
    stream: async (stream, c) => {             // c is the full Hono Context
      const { prompt, model } = c.req.valid('json');   // POST body available
      const userId = c.get('userId');                   // middleware values available

      const completion = await getGroq().chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      });

      for await (const chunk of completion) {
        const token = chunk.choices[0]?.delta?.content ?? '';
        if (token) {
          await stream.writeSSE({
            event: 'token',
            data: JSON.stringify({ token }),
          });
        }
      }

      await stream.writeSSE({ event: 'done', data: JSON.stringify({ userId }) });
    },
  },
});
```

### `routes/models.ts` — list available models

```ts
import { createRoute } from '@bethel-nz/sumi/router';
import Groq from 'groq-sdk';

let _groq: Groq | null = null;
function getGroq(): Groq {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not set');
    _groq = new Groq({ apiKey });
  }
  return _groq;
}

export default createRoute({
  get: {
    middleware: ['auth'],
    handler: async (c) => {
      const models = await getGroq().models.list();
      return c.json({ models: models.data });
    },
    openapi: { summary: 'List available Groq models', tags: ['models'] },
  },
});
```

---

## 11. What Sumi Does NOT Do

- No database ORM — bring your own (Drizzle, Prisma, etc.)
- No built-in auth system — implement in middleware
- No Node.js support — Bun only
- No edge runtime except Cloudflare Workers (via `sumi build --target cloudflare`)

---

## 12. Common Mistakes to Avoid

1. **Do not `import { Sumi } from '@bethel-nz/sumi'` in route files.** Routes only use `createRoute` / `createMiddleware` / `createWS` from `@bethel-nz/sumi/router`.
2. **Do not call `burn()` yourself** in userland — `sumi dev` / `sumi start` handles it.
3. **Do not skip `await` on `createMockApp`** — it's async.
4. **Do not initialize SDK clients at module top level** if they read `process.env` — use a lazy singleton pattern. A top-level throw causes Sumi to silently skip the route at startup.
5. **Schema keys must match `ValidationTarget`** (`json`, `query`, `param`, `header`, `form`, `cookie`). Any other key is ignored.
6. **Middleware names are filenames without `.ts`** — `auth.ts` → `'auth'`, `_index.ts` → `'_index'`.
7. **`basePath` is set once in config** — do not repeat it in route file paths.
8. **Do not import `streamSSE` from `hono/streaming` manually** — use the `stream:` key in `createRoute`. Sumi handles the wrapping and passes `(stream, c)` automatically.
