# Sumi

Sumi is a file-based routing and configuration layer for [Hono](https://hono.dev), designed to streamline backend development on the Bun runtime. It integrates OpenAPI generation, Zod validation, and a command-line interface to provide a structured development experience.

Choose Sumi if you require Hono's performance but need a more structured, convention-over-configuration approach for your project.

## Core Features

- **File-based Routing**: Maps directory structure to URL paths (e.g., `routes/users/[id].ts` -> `/users/:id`).
- **Integrated OpenAPI Generation**: Automatically generates an `openapi.json` specification from your routes and Zod schemas.
- **Schema-driven Validation**: Leverages Zod for compile-time and runtime validation of requests (params, query, JSON body).
- **Command-Line Interface**: Includes tools for project scaffolding, code generation, and running the development server.
- **Hot Reload**: The development server (`sumi dev`) monitors file changes and reloads automatically.
- **Environment Validation**: Enforces required environment variables and validates their types on startup.
- **Middleware System**: Supports directory-level (global, nested) and per-route middleware.

## Quick Start

### 1. Create a new project

```bash
# Using bunx (recommended)
bunx @bethel-nz/sumi new my-api
```

### 2. Start the development server

```bash
cd my-api
bun install
sumi dev
```

The server will be available at `http://localhost:3000`, with the following endpoints enabled by default:

- `/docs`: Interactive API documentation (Scalar UI).
- `/openapi.json`: The raw OpenAPI specification.
- Hot reloading is active.

## Project Structure

A new Sumi project uses the following directory structure:

```text
my-api/
├── routes/                    # API routes (file-based)
│   ├── index.ts              # Handles GET /
│   └── users/
│       ├── index.ts          # Handles GET/POST /users
│       └── [id].ts           # Handles GET/PUT/DELETE /users/:id
├── middleware/               # Reusable middleware
│   ├── _index.ts             # Applied to all routes in the project
│   └── auth.ts               # Example route-specific middleware
└── sumi.config.ts           # Main configuration file
```

## Route Examples

### Basic Route

A file's exported `default` object defines the handlers for each HTTP method.

```typescript
// routes/hello.ts
import { createRoute } from '@bethel-nz/sumi/router';

export default createRoute({
  get: (c) => c.json({ message: 'Hello World!' }),
});
```

### Validated Route with OpenAPI

By adding a `schema` and `openapi` block, you enable validation and documentation.

```typescript
// routes/users/index.ts
import { z } from 'zod';
import { createRoute } from '@bethel-nz/sumi/router';

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export default createRoute({
  // This route does not define a schema, but provides OpenAPI metadata.
  get: {
    openapi: {
      summary: 'Get all users',
      responses: {
        '200': {
          description: 'List of users',
          content: {
            'application/json': { schema: z.array(userSchema) },
          },
        },
      },
    },
    handler: (c) => c.json([{ name: 'John', email: 'john@example.com' }]),
  },
  // This route validates the incoming JSON body against the schema.
  post: {
    schema: { json: userSchema },
    openapi: {
      summary: 'Create a user',
      responses: {
        '201': {
          description: 'User created',
          content: {
            'application/json': { schema: userSchema },
          },
        },
      },
    },
    handler: (c) => {
      // c.req.valid('json') returns the validated and typed data.
      const userData = c.req.valid('json');
      return c.json(userData, 201);
    },
  },
});
```

### Dynamic Route

Bracketed filenames (`[param]`) create dynamic routes. The parameter is available via `c.req.param()`.

```typescript
// routes/users/[id].ts
import { createRoute } from '@bethel-nz/sumi/router';

export default createRoute({
  get: (c) => {
    const userId = c.req.param('id');
    return c.json({ userId });
  },
});
```

## Middleware System

### Global and Scoped Middleware

Middleware is applied based on its location. A file named `_index.ts` in the `middleware` directory applies to all routes. A file named `_index.ts` in `middleware/admin/` would apply to all routes inside a corresponding `routes/admin/` directory.

```typescript
// middleware/_index.ts
import { createMiddleware } from '@bethel-nz/sumi/router';

// This middleware will run for every request.
export default createMiddleware({
  _: async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    console.log(
      `HTTP ${c.req.method} ${c.req.url} - ${c.res.status} (${duration}ms)`
    );
  },
});
```

### Route-Specific Middleware

Individual middleware files can be applied explicitly in a route's configuration.

#### 1. Define the Middleware

```typescript
// middleware/auth.ts
import { createMiddleware } from '@bethel-nz/sumi/router';

export default createMiddleware({
  _: async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    // Add data to the context for downstream handlers.
    c.set('user', { id: '123', role: 'admin' });
    await next();
  },
});
```

#### 2. Apply it in a Route

Reference the middleware by its filename (without the extension) in the `middleware` array.

```typescript
// routes/admin/users.ts
import { createRoute } from '@bethel-nz/sumi/router';

export default createRoute({
  get: {
    // Apply the 'auth' middleware to this specific endpoint.
    middleware: ['auth'],
    openapi: {
      summary: 'Get admin users',
      security: [{ bearerAuth: [] }],
    },
    handler: (c) => {
      // Retrieve context data set by the middleware.
      const user = c.get('user');
      return c.json({ message: `Admin data for user ${user.id}` });
    },
  },
});
```

## Configuration

The `sumi.config.ts` file centralizes project-wide settings.

```typescript
// sumi.config.ts
import { defineConfig } from '@bethel-nz/sumi';
import { z } from 'zod';

export default defineConfig({
  port: 3000,

  // Defines environment variables required by the application.
  // Missing or invalid variables will cause an error on startup.
  env: {
    schema: {
      DATABASE_URL: z.string().url(),
      JWT_SECRET: z.string().min(32),
      NODE_ENV: z.enum(['development', 'production']).default('development'),
    },
    // Specify which variables are mandatory in a production environment.
    required: ['DATABASE_URL'],
  },

  // Serves static files from the specified directory.
  static: [{ path: '/public/*', root: './public' }],

  // Configuration for generated OpenAPI specification.
  openapi: {
    info: {
      title: 'My API',
      version: '1.0.0',
      description: 'API for my application',
    },
  },

  // Configuration for the Scalar documentation UI.
  // This requires the 'openapi' configuration to be present.
  docs: {
    path: '/docs', // Custom URL for the docs page.
    theme: 'purple',
    pageTitle: 'My API Docs',
  },

  // Application lifecycle hooks.
  hooks: {
    onReady: () => console.log('Server is ready.'),
    onShutdown: () => console.log('Server is shutting down.'),
    onError: (error, c) =>
      console.error(`Error on ${c.req.path}:`, error.message),
  },
});
```

## CLI Commands

```bash
# Start dev server with hot reload
sumi dev

# Start production server
sumi start

# Create a new Sumi project
sumi new <project-name>

# Generate a route file
sumi generate route users/[id] --methods get,put,delete

# Generate a middleware file
sumi generate middleware rate-limiter
```

## Testing

Sumi provides a test utility that loads your application instance for use in tests.

```typescript
// tests/users.test.ts
import { createTestApp } from '@bethel-nz/sumi/testing';
import { test, expect } from 'bun:test';

test('GET /users should return an array', async () => {
  // createTestApp loads sumi.config.ts and builds the route tree.
  const app = await createTestApp();

  const response = await app.request('/users');
  expect(response.status).toBe(200);

  const body = await response.json();
  expect(Array.isArray(body)).toBe(true);
});
```

## Environment Variables

Access validated environment variables from the context in any route handler.

```typescript
// In any route file
import { createRoute } from '@bethel-nz/sumi/router';

export default createRoute({
  get: (c) => {
    // c.get('env') provides the validated & typed environment object.
    const nodeEnv = c.get('env').NODE_ENV;
    return c.json({ current_environment: nodeEnv });
  },
});
```

## Framework Comparison

| Feature                 | Sumi | Hono | Express | Fastify |
| ----------------------- | ---- | ---- | ------- | ------- |
| File-based routing      | ✅   | ❌   | ❌      | ❌      |
| Auto OpenAPI docs       | ✅   | 🔧   | 🔧      | 🔧      |
| Built-in Zod validation | ✅   | 🔧   | ❌      | 🔧      |
| TypeScript-first        | ✅   | ✅   | 🔧      | 🔧      |
| CLI tooling             | ✅   | ❌   | ❌      | ❌      |

`🔧`: Requires manual integration or plugins.

## License

MIT
