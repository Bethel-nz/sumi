# Sumi Documentation

## Introduction

`Sumi` (すみ) is the evolution of the Wiggly framework, maintaining its core strengths as a lightweight framework built on top of Hono while introducing new features. It continues to provide simple server setup with middleware and dynamic routing through a file-based routing system.

## What's Changed?

1. **Framework Rename**: From Wiggly to Sumi (すみ)
2. **Simplified Configuration**: More intuitive setup with better defaults
3. **Plugin System**: New plugin architecture for extending functionality
4. **Static File Serving**: Beta feature through the Hibana (火花) component
5. **No Support for Node**: With Sumi, you no longer have to worry about a node server sumi supports only bun out of the box

## Quick Start

### Installation

```bash
bun install sumi //WIP
```

### Basic Server Setup

```typescript
import { Sumi } from 'sumi';

const sumi = new Sumi({
  port: 3000,
  routesDir: './routes',
  middlewareDir: './routes/middleware'
});

sumi.burn();
const fetch = sumi.fetch()

export default {
 port: /*your port number*/,
 fetch
}
```

### Directory Structure

The directory structure remains familiar but with some enhancements:

```text
project-root/
├── routes/
│   ├── middleware/
│   │   ├── _index.ts      # Global middleware
│   ├── users/
│   │   ├── _middleware.ts # Route-specific middleware
│   │   ├── index.ts       # GET /users
│   │   ├── [id].ts       # GET /users/:id
│   │   └── [id]/
│   │       └── posts/
│   │           └── index.ts # GET /users/:id/posts
└── static/                  # Static files directory (Beta)
    └── public/
        ├── images/
        ├── css/
        └── js/
```

## Core Features

### 1. Route Handlers

```typescript
// routes/users/index.ts
export default {
  get: (c) => c.json({ users: [] }),
  post: async (c) => {
    const body = await c.req.json();
    return c.json(body);
  }
};
```

### 2. Middleware Support

```typescript
// routes/middleware/_index.ts
export default {
  _: async (c, next) => {
    c.set('requestTime', Date.now());
    await next();
  }
};
```

### 3. Plugin System (New!)

```typescript
const sumi = new Sumi({ /*...configs*/ });

// Register a database plugin
sumi.plugin(async (c, next) => {
  c.plugin.set('db', database);
  await next();
});

// Use in routes
export default {
  get: async (c) => {
    const db = c.plugin.use('db');
    const users = await db.query('SELECT * FROM users');
    return c.json(users);
  }
};
```

## Coming Soon: Static File Serving (Beta)

Sumi introduces Hibana (火花) for static file serving:

```typescript
import { Sumi, hibana } from 'sumi';

const app = new Sumi({
  port: 3000
});

// Beta: Serve static files //WIP
app.use(hibana({
  root: './public',
  prefix: '/static'
}));

app.burn();
```

## Configuration Options

```typescript
interface SumiOptions {
  app?: Hono;            // Custom Hono instance
  basePath?: string;     // Base path for all routes
  routesDir?: string;    // Routes directory path
  middlewareDir?: string; // Middleware directory path
  logger?: boolean;      // Enable logging
}
```

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build
```

## Migration from Wiggly

1. Update your imports:

```typescript
// Old
import Wiggly from 'wiggly';

// New
import { Sumi } from 'sumi';
```

2. Update initialization:

```typescript
// Old
const app = new Wiggly({
  base_path: '/api',
  useLogger: true,
  port:8080
});

// New
const sumi = new Sumi({
  basePath: '/api',
  logger: true,
  ...other configs
});
```

3. Update server start:

```typescript
// Old
app.serve();

// New
sumi.burn();
const fetch = sumi.fetch()

export default {
  port: 5790,
  fetch
};

//seems excessive but this is all in favor of bun
```

## License

MIT
