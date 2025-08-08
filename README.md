# Sumi 🔥

A blazing fast web framework built on [Hono](https://hono.dev) with file-based routing, automatic OpenAPI documentation, and powerful CLI tooling.

## ✨ Features

- **🚀 File-based routing** - Intuitive directory structure maps to URL paths
- **📚 Automatic OpenAPI docs** - Beautiful API documentation with Scalar UI
- **✅ Built-in validation** - Zod schemas for request/response validation
- **🔧 Powerful CLI** - Generate projects, routes, and run servers
- **⚡ Hot reload** - Lightning-fast development with file watching
- **🌍 Environment validation** - Type-safe environment variables
- **🧪 Testing utilities** - Built-in testing helpers
- **🛡️ Middleware system** - Directory-based and route-specific middleware
- **📦 Zero config** - Works out of the box with sensible defaults

## Quick Start

### Create a new project

```bash
# Using bunx (recommended)
bunx @bethel-nz/sumi new my-api

# Or install globally
bun install -g @bethel-nz/sumi
sumi new my-api
```

### Start developing

```bash
cd my-api
bun install
sumi dev  # 🔥 Start the development server
```

That's it! Your API is running on `http://localhost:3000` with:

- 📖 Interactive docs at `/docs`
- 🔗 OpenAPI spec at `/openapi.json`
- 🔄 Hot reload on file changes

## Project Structure

```text
my-api/
├── routes/                    # API routes (file-based)
│   ├── index.ts              # GET /
│   ├── users/
│   │   ├── index.ts          # GET/POST /users
│   │   ├── [id].ts           # GET/PUT/DELETE /users/:id
│   │   └── [id]/
│   │       └── posts/
│   │           └── index.ts  # GET/POST /users/:id/posts
├── middleware/               # Reusable middleware
│   ├── _index.ts            # Global middleware (applied to all routes)
│   ├── auth.ts              # Authentication middleware
│   ├── request_track.ts     # Request tracking middleware
│   └── rate_limit.ts        # Rate limiting middleware
└── sumi.config.ts           # Configuration file
```

## Route Examples

### Simple Route

```typescript
// routes/hello.ts
import { createRoute } from '@bethel-nz/sumi/router';

export default createRoute({
  get: (c) => c.json({ message: 'Hello World!' }),
});
```

### Validated Route with OpenAPI

```typescript
// routes/users/index.ts
import { z } from 'zod';
import { createRoute } from '@bethel-nz/sumi/router';

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export default createRoute({
  get: {
    openapi: {
      summary: 'Get all users',
      responses: {
        '200': {
          description: 'List of users',
          content: {
            'application/json': {
              schema: z.array(userSchema),
            },
          },
        },
      },
    },
    handler: (c) => c.json([{ name: 'John', email: 'john@example.com' }]),
  },

  post: {
    schema: { json: userSchema },
    openapi: {
      summary: 'Create a user',
      responses: {
        '201': {
          description: 'User created',
          content: {
            'application/json': {
              schema: userSchema,
            },
          },
        },
      },
    },
    handler: (c) => {
      const userData = c.req.valid('json'); // Fully typed!
      return c.json(userData, 201);
    },
  },
});
```

### Dynamic Routes

```typescript
// routes/users/[id]/posts/[slug].ts
import { createRoute } from '@bethel-nz/sumi/router';

export default createRoute({
  get: (c) => {
    const userId = c.req.param('id');
    const postSlug = c.req.param('slug');
    return c.json({ userId, postSlug });
  },
});
```

## Middleware System

### Global Middleware

Applied to all routes automatically by placing files starting with `_` in the middleware directory:

```typescript
// middleware/_index.ts
import { createMiddleware } from '@bethel-nz/sumi/router';

export default createMiddleware({
  _: async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    console.log(`${c.req.method} ${c.req.url} - ${duration}ms`);
  },
});
```

### Route-Specific Middleware

Create individual middleware files and reference them by name in your routes:

#### Creating Middleware

```typescript
// middleware/auth.ts
import { createMiddleware } from '@bethel-nz/sumi/router';

export default createMiddleware({
  _: async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Add user info to context
    (c as any).user = { id: '123', role: 'admin' };
    await next();
  },
});
```

```typescript
// middleware/request_track.ts
import { createMiddleware } from '@bethel-nz/sumi/router';

// In-memory store for request counts
const requestCounts = new Map<string, number>();

export default createMiddleware({
  _: async (c, next) => {
    const method = c.req.method;
    const path = new URL(c.req.url).pathname;
    const endpointId = `${method}:${path}`;

    // Track request count
    const currentCount = requestCounts.get(endpointId) || 0;
    const newCount = currentCount + 1;
    requestCounts.set(endpointId, newCount);

    console.log(`📊 [Request Tracker] ${endpointId} | Request #${newCount}`);

    // Add tracking info to context
    (c as any).requestTrack = {
      endpointId,
      requestCount: newCount,
      timestamp: new Date().toISOString(),
    };

    await next();
  },
});
```

#### Using Middleware in Routes

```typescript
// routes/admin/users.ts
import { z } from 'zod';
import { createRoute } from '@bethel-nz/sumi/router';

export default createRoute({
  get: {
    // Apply multiple middleware in order
    middleware: ['auth', 'request_track'],
    openapi: {
      summary: 'Get admin users',
      security: [{ bearerAuth: [] }], // Shows auth requirement in docs
    },
    handler: (c) => {
      // Access middleware-injected data
      const user = (c as any).user;
      const trackInfo = (c as any).requestTrack;

      return c.json({
        message: `Admin data for ${user.id}`,
        requestCount: trackInfo.requestCount,
        timestamp: trackInfo.timestamp,
      });
    },
  },

  post: {
    middleware: ['auth', 'rate_limit'], // Different middleware combination
    schema: {
      json: z.object({
        name: z.string().min(1),
        role: z.enum(['admin', 'user']),
      }),
    },
    handler: (c) => {
      const userData = c.req.valid('json');
      return c.json({ created: userData }, 201);
    },
  },
});
```

#### Single Route Middleware

```typescript
// routes/public/stats.ts
import { createRoute } from '@bethel-nz/sumi/router';

export default createRoute({
  get: {
    middleware: ['request_track'], // Only track this endpoint
    handler: (c) => {
      const trackInfo = (c as any).requestTrack;

      return c.json({
        message: 'Public stats endpoint',
        hits: trackInfo.requestCount,
        lastAccessed: trackInfo.timestamp,
      });
    },
  },
});
```

#### Conditional Middleware

```typescript
// routes/api/data.ts
import { createRoute } from '@bethel-nz/sumi/router';

export default createRoute({
  get: {
    // No middleware - public endpoint
    handler: (c) => c.json({ data: 'public data' }),
  },

  post: {
    middleware: ['auth'], // Protected endpoint
    handler: (c) => c.json({ data: 'protected data' }),
  },

  delete: {
    middleware: ['auth', 'admin_only'], // Admin-only endpoint
    handler: (c) => c.json({ message: 'deleted' }),
  },
});
```

## Configuration

```typescript
// sumi.config.ts
import { defineConfig } from '@bethel-nz/sumi';
import { z } from 'zod';

export default defineConfig({
  port: 3000,

  // Environment validation
  env: {
    schema: {
      DATABASE_URL: z.string().url(),
      JWT_SECRET: z.string().min(32),
      NODE_ENV: z.enum(['development', 'production']).default('development'),
    },
    required: ['DATABASE_URL'], // Required in production
  },

  // Static file serving
  static: [{ path: '/public/*', root: './public' }],

  // OpenAPI documentation
  openapi: {
    info: {
      title: 'My API',
      version: '1.0.0',
      description: 'A beautiful API built with Sumi',
    },
  },

  // Documentation UI
  docs: {
    path: '/docs', // Custom docs path
    theme: 'purple', // Scalar theme
    pageTitle: 'My API Docs',
  },

  // Lifecycle hooks
  hooks: {
    onReady: () => console.log('🚀 Server is ready!'),
    onShutdown: () => console.log('👋 Server shutting down...'),
    onError: (error, c) => console.error('Error:', error.message),
  },
});
```

## CLI Commands

```bash
# Development
sumi dev                    # Start dev server with hot reload
sumi dev --port 4000       # Custom port
sumi dev --config custom.config.ts

# Production
sumi start                 # Start production server
sumi build                 # Build for production

# Project scaffolding
sumi new my-project        # Create new project
sumi init                  # Initialize in existing directory

# Code generation
sumi generate route users        # Create routes/users.ts
sumi generate route users/posts  # Create routes/users/posts/index.ts
sumi generate route users/[id]   # Create routes/users/[id].ts
sumi generate middleware auth    # Create middleware/auth.ts
```

## Testing

```typescript
// tests/users.test.ts
import { createTestApp } from '@bethel-nz/sumi/testing';
import { test, expect } from 'bun:test';

test('GET /users should return users list', async () => {
  const app = await createTestApp(); // Loads your project automatically

  const response = await app.request('/users');
  expect(response.status).toBe(200);

  const users = await response.json();
  expect(Array.isArray(users)).toBe(true);
});
```

## Environment Variables

Access validated environment variables in your routes:

```typescript
// In your routes
export default createRoute({
  get: (c) => {
    // These are fully typed and guaranteed to exist!
    const dbUrl = c.env.DATABASE_URL;
    const jwtSecret = c.env.JWT_SECRET;
    const nodeEnv = c.env.NODE_ENV;

    return c.json({ environment: nodeEnv });
  },
});
```

## Why Sumi?

- **🏃‍♂️ Fast**: Built on Hono, one of the fastest web frameworks
- **🧘‍♀️ Simple**: File-based routing eliminates configuration overhead
- **🔒 Type-safe**: Full TypeScript support with Zod validation
- **📖 Self-documenting**: Automatic OpenAPI generation from your code
- **🔧 Developer-friendly**: Excellent DX with CLI tools and hot reload
- **⚡ Modern**: Built for Bun runtime (Node.js support coming soon)

## Framework Comparison

| Feature             | Sumi | Express | Fastify | Hono |
| ------------------- | ---- | ------- | ------- | ---- |
| File-based routing  | ✅   | ❌      | ❌      | ❌   |
| Auto OpenAPI docs   | ✅   | ❌      | 🔧      | ❌   |
| Built-in validation | ✅   | ❌      | 🔧      | 🔧   |
| TypeScript-first    | ✅   | 🔧      | 🔧      | ✅   |
| Zero config         | ✅   | ❌      | ❌      | ✅   |
| CLI tooling         | ✅   | ❌      | ❌      | ❌   |

## Examples

Check out the [examples directory](./example) for more comprehensive examples including:

- Authentication with JWT
- Database integration
- File uploads
- WebSocket support
- Microservice architecture

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**[Documentation](https://sumi.dev) • [Examples](./example) • [Discord](https://discord.gg/sumi)**

Made with ❤️ by [Bethel](https://github.com/bethel-nz)

</div>
