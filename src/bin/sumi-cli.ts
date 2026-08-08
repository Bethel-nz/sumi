#!/usr/bin/env bun
import { cac } from 'cac';
import { z } from 'zod';
import prompts from 'prompts';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chokidar from 'chokidar';

import { Sumi } from '../lib/sumi';
import type { SumiConfig } from '../lib/types';
import { generateManifest, writeManifest } from '../lib/manifest';

// Read version from package.json for --version output
const pkgPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../package.json');
const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : { version: '0.0.0' };

const cli = cac('sumi');
cli.version(pkg.version);

function createDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function isDirEmpty(dir: string){
  try{
    return fs.readdirSync(dir).length === 0;
  } catch {
    return true;
  }
}

function ensureFavicon(publicDirAbs: string)
{
  const here = path.dirname(new URL(import.meta.url).pathname);
  const candidates = [
    path.resolve(here, '../lib/public/favicon.ico'),
    path.resolve(here, '../../lib/public/favicon.ico'),
    path.resolve(here, './public/favicon.ico'),
  ]

  let src: string | null = null;
  for(const p of candidates)
  {
    if(fs.existsSync(p)) {src = p; break;}
  }

  if(!fs.existsSync(publicDirAbs)) fs.mkdirSync(publicDirAbs, {recursive: true});

  const dest = path.join(publicDirAbs, 'favicon.ico');

  if(fs.existsSync(dest)){
    return;
  }

  if(src){
    fs.copyFileSync(src, dest);
    console.log(`📦 Copied default favicon to ${dest}`);

  } else {
    console.warn('⚠️  No default favicon found in the framework; skipping creation.');
  }
}

// Ensures there is package.json and creates if it does not exist
function ensurePackageJson(projectPath: string) {
  const pkgPath = path.join(projectPath, 'package.json');

  const baseDeps = {
    '@bethel-nz/sumi': 'latest',
    'hono': '^4.8.0',
    'zod': '^4.0.0',
    '@hono/zod-validator': '^0.7.0',
    'hono-openapi': '^0.4.8',
    '@scalar/hono-api-reference': '^0.9.13',
    'zod-openapi': '^5.3.0',
  };

  if(!fs.existsSync(pkgPath)){
    const pkg = {
      name: path.basename(projectPath) || 'sumi-app',
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'sumi dev',
        start: 'sumi start',
        build: 'sumi build',
      },

      dependencies: baseDeps,
      devDependencies: {},
    }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log('Created package.json');
    return;
  } 

  // augment existing package.json (scripts + deps), but don’t overwrite user versions if present
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.scripts ||= {};
  pkg.scripts.dev ||= 'sumi dev';
  pkg.scripts.start ||= 'sumi start';
  pkg.scripts.build ||= 'sumi build';


  pkg.dependencies ||= {};
  for (const [k, v] of Object.entries(baseDeps)) {
    if (!pkg.dependencies[k]) pkg.dependencies[k] = v;
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  console.log('🛠️  Updated package.json (scripts/dependencies)');
  
}

// This function installs the dependencies sumi uses by default
function installAppDeps(projectPath: string){
  console.log(`[sumi] Installing dependencies in: ${projectPath}`);
  const desiredSpecs = [
    '@bethel-nz/sumi',
    'hono',
    'zod@^4.0.0',
    '@hono/zod-validator',
    'hono-openapi',
    '@scalar/hono-api-reference',
    'zod-openapi',
  ]

  console.log(`[sumi] Running: bun add ${desiredSpecs.join(" ")}`);

  const getPkgName = (spec: string) => {
    if(spec.startsWith('file:') || spec.startsWith('link:')) return spec;

    if(spec.startsWith('@')){
      const lastAt = spec.lastIndexOf('@');
      return lastAt > 0 ? spec.slice(0, lastAt) : spec;
    }

    const firstAt = spec.indexOf('@');
    return firstAt > 0 ? spec.slice(0, firstAt) : spec;
  }

  const pkgPath = path.join(projectPath, 'package.json');
  const pkg = fs.existsSync(pkgPath)
    ? JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    : {dependencies: {}, devDependencies: {}};

  const existing = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {})
  ])

  
  const sumiSpec = (pkg.dependencies && pkg.dependencies['@bethel-nz/sumi']) || '';
  const isSumiLinked = typeof sumiSpec === 'string' && (sumiSpec.startsWith('link:') || sumiSpec.startsWith('file:'));

  let missing = desiredSpecs.filter((spec) => !existing.has(getPkgName(spec)))

  if (isSumiLinked) {
    missing = missing.filter((spec) => getPkgName(spec) !== '@bethel-nz/sumi');
  }

  const nodeModulesPath = path.join(projectPath, 'node_modules');
  const bunLockPath = path.join(projectPath, 'bun.lockb');
  const needsBootstrapInstall = !fs.existsSync(nodeModulesPath) || !fs.existsSync(bunLockPath);


  if(missing.length === 0)
  {
    if (needsBootstrapInstall) {
      console.log('Installing dependencies (bootstrap)…');
      try {
        execSync(`bun install`, { cwd: projectPath, stdio: 'inherit' });
      } catch {
        console.error('bun install failed. Aborting (Bun-only mode).');
        process.exit(1);
      }
    } else {
      console.log('Dependencies already satisfied (nothing to install).');
    }
    return;
  }

  console.log('Installing app dependencies...');
  try{
    execSync(`bun add ${missing.join(' ')}`, {cwd: projectPath, stdio: 'inherit'});
  } catch {
    console.error('bun add failed. Aborting (Bun-only mode).');
    process.exit(1);
  }
}

function generateIndexRouteContent(): string {
  return `
import { z } from 'zod';
import { createRoute } from '@bethel-nz/sumi/router';
import { resolver } from 'hono-openapi/zod';

const querySchema = z.object({
  name: z.string().optional().default('World').describe('Name for personalized greeting'),
});

const responseSchema = z.object({
  message: z.string().describe('Welcome message'),
  timestamp: z.string().describe('ISO timestamp of the response'),
  protected: z.boolean().describe('Whether this route was protected by middleware'),
});

export default createRoute({
  get: {
    // Apply route-specific auth middleware
    middleware: ['auth'],
    
    schema: {
      query: querySchema,
    },
    openapi: {
      summary: 'Protected Welcome endpoint',
      description: 'Returns a personalized welcome message. Requires x-api-key header.',
      tags: ['welcome'],
      responses: {
        200: {
          description: 'Welcome message with timestamp',
          content: {
            'application/json': {
              schema: resolver(responseSchema)
            }
          }
        },
        401: {
          description: 'Unauthorized. API Key is missing or invalid.'
        }
      }
    },
    handler: (c) => {
      const { name } = c.req.valid('query');
      return c.json({
        message: \`Hello, \${name}! You've accessed a protected route! 🔥\`,
        timestamp: new Date().toISOString(),
        protected: true,
      });
    },
  },
});
  `;
}

function generateUserIdRouteContent(): string {
  return `
import { z } from 'zod';
import { createRoute } from '@bethel-nz/sumi/router';
import { resolver } from 'hono-openapi/zod';
import { ValidationContext } from '@bethel-nz/sumi/router';

const paramSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
}).describe('User ID parameter schema');

const userResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string(),
}).describe('User data response schema');

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
}).describe('User update request schema').meta({ ref: 'UpdateUserRequest' });

const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
}).describe('Standard error response');

export default createRoute({
  get: {
    schema: {
      param: paramSchema,
    },
    openapi: {
      summary: 'Get user by ID',
      description: 'Retrieve a specific user by their unique identifier',
      tags: ['users'],
      responses: {
        200: {
          description: 'User found successfully',
          content: {
            'application/json': {
              schema: resolver(userResponseSchema)
            }
          }
        },
        404: {
          description: 'User not found',
          content: {
            'application/json': {
              schema: resolver(errorResponseSchema)
            }
          }
        }
      }
    },
    handler: (c) => {
      const { id } = c.req.valid('param');
      
      // TODO: Replace with actual database lookup
      if (id === '404') {
        return c.json({
          error: 'Not Found',
          message: \`User with ID \${id} not found\`
        }, 404);
      }
      
      return c.json({
        id,
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date().toISOString(),
      });
    },
  },

  patch: {
    schema: {
      param: paramSchema,
      json: updateUserSchema,
    },
    openapi: {
      summary: 'Update user',
      description: 'Partially update a user by ID',
      tags: ['users'],
      responses: {
        200: {
          description: 'User updated successfully',
          content: {
            'application/json': {
              schema: resolver(userResponseSchema)
            }
          }
        },
        404: {
          description: 'User not found',
          content: {
            'application/json': {
              schema: resolver(errorResponseSchema)
            }
          }
        }
      }
    },
    handler: (c) => {
      const { id } = c.req.valid('param');
      const updates = c.req.valid('json');
      
      // TODO: Replace with actual database update
      return c.json({
        id,
        name: updates.name || 'John Doe',
        email: updates.email || 'john@example.com',
        createdAt: '2024-01-01T00:00:00Z',
      });
    },
  },

  delete: {
    schema: {
      param: paramSchema,
    },
    openapi: {
      summary: 'Delete user',
      description: 'Remove a user by ID',
      tags: ['users'],
      responses: {
        204: {
          description: 'User deleted successfully'
        },
        404: {
          description: 'User not found'
        }
      }
    },
    handler: (c) => {
      const { id } = c.req.valid('param');
      
      // TODO: Replace with actual database deletion
      return c.json({ message: \`User \${id} deleted successfully\` }, 204);
    },
  },
});
  `;
}

function generateSimpleRouteContent(): string {
  return `
import { z } from 'zod';
import { createRoute } from '@bethel-nz/sumi/router';
import { ValidationContext } from '@bethel-nz/sumi/router';

const messageSchema = z.object({
  text: z.string().min(1, 'Message text is required'),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
}).describe('Message request schema for simple endpoint').meta({ ref: 'MessageRequest' });

const messageResponseSchema = z.object({
  received: z.string(),
  echo: z.string(),
  length: z.number(),
  priority: z.enum(['low', 'medium', 'high']),
}).describe('Message response with echo and metadata');

export default createRoute({
  get: (c) => {
    return c.json({ 
      message: 'Simple GET endpoint without validation',
      timestamp: Date.now(),
      status: 'active'
    });
  },

  post: {
    schema: {
      json: messageSchema,
    },
    openapi: {
      summary: 'Echo message',
      description: 'Accepts a message and echoes it back with metadata',
      tags: ['simple'],
      responses: {
        201: {
          description: 'Message processed successfully',
          content: {
            'application/json': {
              schema: messageResponseSchema
            }
          }
        }
      }
    },
    handler: (c) => {
      const { text, priority } = c.req.valid('json');
      return c.json({
        received: text,
        echo: \`You said: "\${text}"\`,
        length: text.length,
        priority,
      }, 201);
    },
  },
});
  `;
}

function generateMiddlewareContent(): string {
  return `
import { Next } from 'hono';
import type { SumiContext } from '@bethel-nz/sumi/types';
import { createMiddleware } from '@bethel-nz/sumi/router';

/**
 * Request logging middleware using createMiddleware.
 * Logs request start and end with duration and status.
 */
export default createMiddleware({
  _: async (c: SumiContext, next: Next) => {
    const start = Date.now();
    const method = c.req.method;
    const url = new URL(c.req.url);
    const path = url.pathname;
    
    console.log(\`🔥 [\${new Date().toISOString()}] -> \${method} \${path}\`);
    
    await next();
    
    const duration = Date.now() - start;
    const status = c.res.status;
    const statusEmoji = status >= 400 ? '❌' : status >= 300 ? '⚠️' : '✅';
    
    console.log(
      \`\${statusEmoji} [\${new Date().toISOString()}] <- \${method} \${path} (\${status}) \${duration}ms\`
    );
  },
});
    `;
}

function generateAuthMiddlewareContent(): string {
  return `
import { Next } from 'hono';
import type { SumiContext } from '@bethel-nz/sumi/types';
import { createMiddleware } from '@bethel-nz/sumi/router';

/**
 * Route-specific authentication middleware.
 * Checks for x-api-key header with value 'demo-key'.
 * 
 * Usage: Add 'auth' to the middleware array in any route.
 * Example: middleware: ['auth']
 */
export default createMiddleware({
  _: async (c: SumiContext, next: Next) => {
    const apiKey = c.req.header('x-api-key');

    console.log('🔑 [Auth] Checking API key...');

    if (apiKey === 'demo-key') {
      console.log('🔑 [Auth] Valid API key. Access granted.');
      await next();
    } else {
      console.log('🔑 [Auth] Invalid or missing API key. Access denied.');
      return c.json({ 
        error: 'Unauthorized', 
        message: 'Please provide x-api-key header with value "demo-key"' 
      }, 401);
    }
  },
});
  `;
}

function generatePackageJsonContent(projectName: string): string {
  return JSON.stringify(
    {
      name: projectName,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'sumi dev',
        build: 'sumi build',
        start: 'sumi start',
      },
      dependencies: {
        '@bethel-nz/sumi': 'latest',
        hono: '^4.8.0',
        zod: '^4.0.0',
        '@hono/zod-validator': '^0.7.0',
        'hono-openapi': '^0.4.8',
        '@scalar/hono-api-reference': '^0.9.13',
        'zod-openapi': '^5.3.0'
      },
      devDependencies: {},
    },
    null,
    2
  );
}

function generateReadmeContent(projectName: string): string {
  return `# ${projectName}

A blazing fast web API built with [Sumi](https://github.com/bethel-nz/sumi) 🔥

## Getting Started

### Development
\`\`\`bash
bun run dev
\`\`\`

### Project Structure
\`\`\`
├── routes/                # API routes (file-based routing)
│   ├── index.ts          # GET / (with OpenAPI docs)
│   ├── simple.ts         # GET/POST /simple (minimal example)
│   └── users/            # /users/* routes
│       └── [id].ts       # GET/PATCH/DELETE /users/:id
├── middleware/           # Global middleware
│   └── _index.ts        # Request logging
└── sumi.config.ts       # Sumi configuration
\`\`\`

### Zod v4 Schema Examples

**With Descriptions** (\`.describe()\`):
\`\`\`typescript
const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive()
}).describe('User registration schema');
\`\`\`

**With Registry References** (\`.meta({ ref: 'Name' })\`):
\`\`\`typescript
const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email()
}).describe('User creation request').meta({ ref: 'CreateUserRequest' });
\`\`\`

**Union Types with Descriptions**:
\`\`\`typescript
const statusSchema = z.union([
  z.literal('active'),
  z.literal('inactive'),
  z.literal('pending')
]).describe('User account status');
\`\`\`

### Route Examples

**Simple Route** (\`routes/simple.ts\`):
\`\`\`typescript
const messageSchema = z.object({
  text: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high']).default('medium')
}).describe('Message with priority level');

export default createRoute({
  get: (c) => c.json({ message: 'Simple endpoint' }),
  post: {
    schema: { json: messageSchema },
    handler: (c) => c.json({ received: c.req.valid('json') })
  }
});
\`\`\`

**Dynamic Route** (\`routes/users/[id].ts\`):
\`\`\`typescript
const paramSchema = z.object({
  id: z.string().uuid()
}).describe('User ID parameter');

export default createRoute({
  get: {
    schema: { param: paramSchema },
    openapi: { 
      summary: 'Get user by ID', 
      tags: ['users'] 
    },
    handler: (c) => c.json({ id: c.req.valid('param').id })
  }
});
\`\`\`

### Validation with Zod v4
\`\`\`typescript
import { z } from 'zod';

const productSchema = z.object({
  name: z.string().min(1, 'Product name required'),
  price: z.number().positive('Price must be positive'),
  category: z.enum(['electronics', 'clothing', 'books']),
  tags: z.array(z.string()).optional()
}).describe('Product creation schema').meta({ ref: 'CreateProduct' });

export default createRoute({
  post: {
    schema: { json: productSchema },
    openapi: {
      summary: 'Create a product',
      tags: ['products'],
      responses: {
        201: {
          description: 'Product created successfully',
          content: {
            'application/json': {
              schema: z.object({
                id: z.string().uuid(),
                name: z.string(),
                price: z.number(),
                createdAt: z.string().datetime()
              }).describe('Created product response')
            }
          }
        }
      }
    },
    handler: (c) => {
      const product = c.req.valid('json');
      return c.json({ 
        id: crypto.randomUUID(), 
        ...product, 
        createdAt: new Date().toISOString() 
      }, 201);
    }
  }
});
\`\`\`

## API Documentation
Visit \`/docs\` when running in development mode for auto-generated API documentation.

## Commands
- \`bun run dev\` - Start development server with hot reload
- \`bun run build\` - Build for production
- \`bun run start\` - Start production server

## Deployment
Deploy your Sumi app anywhere that supports Bun or Node.js.
`;
}

function generateGitignoreContent(): string {
  return `
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Production builds
dist/
build/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Temporary folders
tmp/
temp/

# Bun
.bun

# Database
*.db
*.sqlite
*.sqlite3

# Sumi specific
.sumi/
`.trim();
}

function generateConfigContent(options?: {
  basePath?: string;
  routesDir?: string;
  middlewareDir?: string;
  port?: number;
}) {
  // normalize basePath: '' -> '/', 'api' -> '/api'
  const rawBase = (options?.basePath ?? '/').trim();

  const basePath = rawBase === '' ? '/' : rawBase.startsWith('/') ? rawBase : `${rawBase}`;

  const routesDir = options?.routesDir ?? 'routes';
  const middlewareDir = options?.middlewareDir ?? 'middleware';
  const port = options?.port ?? 3000;

  const serverUrl = `http://localhost:${port}${basePath === '/' ? '' : basePath}`

  return `
  import { defineConfig } from '@bethel-nz/sumi';
  import { fileURLToPath } from 'url';
  import path from 'path';

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const PUBLIC_DIR = path.join(__dirname, 'public'); 

  export default defineConfig({
    port: ${port},
    logger: true,
    basePath: '${basePath}',
    routesDir: './${routesDir}',
    middlewareDir: './${middlewareDir}',

    // Static files are mounted under the app's basePath automatically by Sumi,
    // so '/public/*' becomes '${basePath === '/' ? '' : basePath}/public/*'
    static: [
      { path: '/public/*', root: PUBLIC_DIR },
    ],

    // This ensures even JSON responses hint the browser to fetch the favicon
    // hooks: {
    //   onResponse: async (c) => {
    //     c.header('Link', '</favicon.ico?v=1>; rel="icon"; type="image/x-icon"', { append: true });
    //   },
    // },

    openapi: {
      documentation: {
        info: {
          title: 'My API',
          version: '1.0.0',
          description: 'Example Sumi project',
        },
        servers: [
          { url: '${serverUrl}', description: 'Local' },
        ],
      }
    },
    
    // Scalar docs will be available at ${basePath === '/' ? '/docs' : basePath + '/docs'}
    docs: {
      path: '/docs',
      theme: 'purple',
      pageTitle: 'Sumi API Docs',
      // Keep root-path here; the framework serves BOTH /favicon.ico and ${basePath}/favicon.ico
      favicon: '/favicon.ico?v=2',
    }
  });
`.trim();
}

cli
  .command('new <projectName>', 'Create a new Sumi project')
  .action(async (projectName: string) => {
    console.log(`Creating new Sumi project: ${projectName}`);

    const isDot = projectName === '.' || projectName === './';
    const projectPath = isDot
      ? process.cwd()
      : path.resolve(process.cwd(), projectName);

    if (fs.existsSync(projectPath) && !isDirEmpty(projectPath)) {
      const { cont } = await prompts({
        type: 'confirm',
        name: 'cont',
        message: `Directory already exists: ${projectPath}. Continue and only create missing files?`,
        initial: false
      });

      if (!cont) {
        console.log('Aborted.');
        process.exit(0);
      }
    }

    if (!fs.existsSync(projectPath)) {
      createDirectory(projectPath);
      const packageJsonPath = path.join(projectPath, 'package.json');
      fs.writeFileSync(packageJsonPath, generatePackageJsonContent(path.basename(projectPath)));
      console.log('Created package.json');
    } else {
      // Dir exists (dot or not): ensure scripts/deps are present without overwriting user versions
      ensurePackageJson(projectPath);
    }


    installAppDeps(projectPath);

    // Initialize project files (config/routes/middleware/etc.)
    console.log(`Initializing project configuration...`);
    await initProject(projectPath);

    console.log(`\nProject ${isDot ? 'bootstrapped' : `'${projectName}' created`} successfully!`);
    if (!isDot) {
      console.log(`\nTo get started:\n  cd ${projectName}\n  sumi dev`);
    } else {
      console.log(`\nRun:\n  sumi dev`);
    }
  });


cli
  .command('init', 'Initialize Sumi configuration in the current directory')
  .option('--yes, -y', 'Skip prompts and use defaults', { default: false })
  .action(async (options: { yes?: boolean }) => {
    const cwd = process.cwd();

    ensurePackageJson(cwd);
    installAppDeps(cwd);
    await initProject(cwd, options?.yes === true)

    
    console.log(`\n✅ Project initialized successfully!`);
    console.log(`\nNext:\n sumi dev`);
  });

cli
  .command('dev', 'Start the Sumi development server with hot reload')
  .option('-p, --port <port>', 'Port number', { default: undefined })
  .option('-c, --config <config>', 'Config file path', {
    default: 'sumi.config.ts',
  })
  .action(async (options: { port?: number; config: string }) => {
    const configPath = path.resolve(process.cwd(), options.config);

    if (!fs.existsSync(configPath)) {
      console.error(`❌ Error: ${options.config} not found.`);
      console.error('💡 Run `sumi init` to create one.');
      process.exit(1);
    }

    // Ensure tsconfig.json exists and has Bun types
    ensureBunTypes(path.join(process.cwd(), 'tsconfig.json'));

    // Create the .sumi directory
    const sumiDir = path.join(process.cwd(), '.sumi');
    const serverPath = path.join(sumiDir, 'server.ts');

    if (!fs.existsSync(sumiDir)) {
      fs.mkdirSync(sumiDir, { recursive: true });
    }

    // Generate route manifest for fast startup
    try {
      const configModule = await import(`file://${configPath}?v=${Date.now()}`);
      const appConfig: SumiConfig = configModule.default;
      const manifest = generateManifest(
        appConfig.routesDir || 'routes',
        appConfig.middlewareDir || 'middleware'
      );
      writeManifest(manifest);
    } catch {
      // If config can't be loaded, manifest will be generated at runtime
    }

    // Generate the temporary server entry point
    const serverContent = `// Auto-generated Sumi dev server - DO NOT EDIT
import { Sumi } from '@bethel-nz/sumi';
import configPromise from '../${options.config.replace('.ts', '')}';

const config = await Promise.resolve(configPromise);

${options.port ? `config.port = ${options.port};` : ''}

const sumi = new Sumi(config);

await sumi.burn();
`;

    fs.writeFileSync(serverPath, serverContent);

    const { spawn } = require('child_process');
    const bunArgs = ['run', '--watch', './.sumi/server.ts', '--hot'];
    const bunEnv: Record<string, string> = { ...process.env, NODE_ENV: 'development' };

    // Watch .env* files and restart bun when they change
    const envWatcher = chokidar.watch('.env*', {
      cwd: process.cwd(),
      ignoreInitial: true,
      depth: 0,
    });

    const cleanup = () => {
      envWatcher.close();
      if (fs.existsSync(sumiDir)) {
        fs.rmSync(sumiDir, { recursive: true, force: true });
      }
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);

    let isRestarting = false;

    const spawnBun = () => {
      const proc = spawn('bun', bunArgs, { stdio: 'inherit', cwd: process.cwd(), env: bunEnv });
      proc.on('exit', (code: number | null) => {
        if (!isRestarting) {
          cleanup();
          process.exit(code || 0);
        }
      });
      return proc;
    };

    let currentProcess = spawnBun();

    const restartForEnv = (filePath: string) => {
      if (isRestarting) return;
      isRestarting = true;
      console.log(`\n  .env changed (${filePath}) — restarting\n`);
      currentProcess.once('exit', () => {
        currentProcess = spawnBun();
        isRestarting = false;
      });
      currentProcess.kill('SIGTERM');
    };

    envWatcher.on('change', restartForEnv);
    envWatcher.on('add', restartForEnv);
  });

cli
  .command('start', 'Start the Sumi production server')
  .option('-p, --port <port>', 'Port number', { default: undefined })
  .option('-c, --config <config>', 'Config file path', {
    default: 'sumi.config.ts',
  })
  .action(async (options: { port?: number; config: string }) => {
    const configPath = path.resolve(process.cwd(), options.config);

    if (!fs.existsSync(configPath)) {
      console.error(
        '❌ Error: sumi.config.ts not found in the root of your project.'
      );
      console.error('💡 Run `sumi init` to create one.');
      process.exit(1);
    }

    try {
      console.log('🚀 Starting Sumi production server...');
      process.env.NODE_ENV = 'production';

      const configModule = await import(`file://${configPath}?v=${Date.now()}`);
      const config: SumiConfig = configModule.default;

      if (options.port) {
        config.port = options.port;
      }

      // Generate route manifest for fast startup
      const manifest = generateManifest(
        config.routesDir || 'routes',
        config.middlewareDir || 'middleware'
      );
      writeManifest(manifest);

      const sumi = new Sumi(config);

      // Graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🔥 Gracefully shutting down Sumi...');
        await sumi.shutdown();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log('\n🔥 Gracefully shutting down Sumi...');
        await sumi.shutdown();
        process.exit(0);
      });

      await sumi.burn();
    } catch (error) {
      console.error('🔥 Error starting Sumi production server:', error);
      process.exit(1);
    }
  });

cli
  .command('build', 'Build the Sumi app for deployment')
  .option('--target <target>', 'Deployment target: cloudflare', {
    default: 'cloudflare',
  })
  .option('--routes-dir <dir>', 'Routes directory', { default: 'routes' })
  .option(
    '--middleware-dir <dir>',
    'Middleware directory',
    { default: 'middleware' }
  )
  .option('--config <path>', 'Path to sumi.config.ts', {
    default: 'sumi.config.ts',
  })
  .option('--out-dir <dir>', 'Output directory', { default: 'dist' })
  .option(
    '--external <packages>',
    'Comma-separated packages to exclude from the bundle (e.g. native addons)',
    { default: '' }
  )
  .action(
    async (options: {
      target: string;
      routesDir: string;
      middlewareDir: string;
      config: string;
      outDir: string;
      external: string;
    }) => {
      // Run onBuild hook if config is loadable (non-CF targets also get this)
      const configPath = path.resolve(process.cwd(), options.config);
      if (fs.existsSync(configPath)) {
        try {
          const configModule = await import(`file://${configPath}?v=${Date.now()}`);
          const appConfig: SumiConfig = configModule.default;
          if (appConfig.hooks?.onBuild) await appConfig.hooks.onBuild();
        } catch {
          // ignore — config may not be loadable in all contexts
        }
      }

      const validTargets = ['cloudflare', 'vercel'];
      if (!validTargets.includes(options.target)) {
        console.error(
          `[sumi build] Unknown target: "${options.target}". Supported: ${validTargets.join(', ')}`
        );
        process.exit(1);
      }

      if (options.target === 'cloudflare') {
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
          // hono-rate-limiter is dynamically imported inside Sumi only when rateLimit
          // is configured. CF Workers handle rate-limiting natively, so exclude it.
          // Users can pass additional --external packages for native addons or other
          // unbundleable deps (e.g. @memvid/sdk which ships a .node native binding).
          external: [
            'hono-rate-limiter',
            ...options.external
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          ],
        });

        if (!result.success) {
          console.error('[sumi build] Bundle failed:');
          for (const log of result.logs) console.error(' ', log);
          process.exit(1);
        }

        console.log(`[sumi build] ✅ Worker bundle ready: ${workerOutFile}`);
        console.log('[sumi build] Deploy with: wrangler deploy');
      }

      if (options.target === 'vercel') {
        console.log('[sumi build] Generating Vercel Edge entry...');

        const { generateVercelEntry } = await import('../lib/vercel-codegen');

        const outEntryFile = path.join(options.outDir, 'vercel-entry.ts');

        const source = await generateVercelEntry({
          routesDir: options.routesDir,
          middlewareDir: options.middlewareDir,
          configPath: options.config,
          outFile: outEntryFile,
        });

        fs.mkdirSync(options.outDir, { recursive: true });
        fs.writeFileSync(outEntryFile, source, 'utf8');
        console.log(`[sumi build] Written: ${outEntryFile}`);
        console.log('[sumi build] ✅ Vercel Edge entry ready.');
        console.log('[sumi build] Next steps:');
        console.log('  1. Copy the entry file to your Vercel project (e.g., api/index.ts)');
        console.log('  2. Ensure "@bethel-nz/sumi" is installed as a dependency');
        console.log('  3. Deploy with: vercel deploy');
      }
    }
  );

cli
  .command('generate <type> <name>', 'Generate route files or middleware')
  .option('-m, --methods <methods>', 'HTTP methods (comma-separated)', {
    default: 'get,post',
  })
  .option('-c, --config <config>', 'Config file path', {
    default: 'sumi.config.ts',
  })
  .action(
    async (
      type: string,
      name: string,
      options: { methods: string; config: string }
    ) => {
      if (type === 'middleware') {
        await generateMiddlewareFile(name, options.config);
      } else if (type === 'route') {
        const configPath = path.resolve(process.cwd(), options.config);
        let routesDir = 'routes';

        if (fs.existsSync(configPath)) {
          try {
            const configModule = await import(
              `file://${configPath}?v=${Date.now()}`
            );
            const config: SumiConfig = configModule.default;
            routesDir = config.routesDir || 'routes';
          } catch (error) {
            console.warn(
              '⚠️  Could not read config, using default routes directory'
            );
          }
        }

        const methods = options.methods
          .split(',')
          .map((m) => m.trim().toLowerCase());
        await generateRouteFile(name, routesDir, methods);
      } else if (type === 'resource') {
        const configPath = path.resolve(process.cwd(), options.config);
        let routesDir = 'routes';

        if (fs.existsSync(configPath)) {
          try {
            const configModule = await import(`file://${configPath}?v=${Date.now()}`);
            const config: SumiConfig = configModule.default;
            routesDir = config.routesDir || 'routes';
          } catch {
            console.warn('⚠️  Could not read config, using default routes directory');
          }
        }

        // Generate collection index route (e.g., routes/users/index.ts)
        await generateRouteFile(`${name}/index`, routesDir, ['get', 'post']);
        // Generate single resource route (e.g., routes/users/[id].ts)
        await generateRouteFile(`${name}/[id]`, routesDir, ['get', 'patch', 'delete']);
        console.log(`📦 Resource '${name}' scaffolded with collection + [id] routes.`);
      } else {
        console.error(
          '❌ Invalid type. Use: sumi generate middleware <name>, sumi generate route <path>, or sumi generate resource <name>'
        );
      }
    }
  );

// Helper functions
async function initProject(basePath: string, force = false) {
  const configPath = path.join(basePath, 'sumi.config.ts');

  if (fs.existsSync(configPath) && !force) {
    const { overwrite } = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `sumi.config.ts already exists. Overwrite?`,
      initial: false,
    });
    if (!overwrite) {
      console.log('🤷 Init cancelled.');
      process.exit(0);
    }
  }

  const defaults = {
    routesDir: 'routes',
    middlewareDir: 'middleware',
    logger: true,
    port: 3000,
    basePath: '/',
    addStatic: false,
    staticPath: '/public/*',
    staticRoot: './public',
    enableOpenAPI: true,
  };

  const responses = force ? defaults : await prompts([
    {
      type: 'text',
      name: 'routesDir',
      message: 'Routes directory?',
      initial: defaults.routesDir,
    },
    {
      type: 'text',
      name: 'middlewareDir',
      message: 'Middleware directory?',
      initial: defaults.middlewareDir,
    },
    {
      type: 'confirm',
      name: 'logger',
      message: 'Enable request logger?',
      initial: defaults.logger,
    },
    {
      type: 'number',
      name: 'port',
      message: 'Development server port?',
      initial: defaults.port,
    },
    {
      type: 'text',
      name: 'basePath',
      message: 'API base path? (e.g., /api/v1 or leave empty for /)',
      initial: defaults.basePath,
    },
    {
      type: 'confirm',
      name: 'addStatic',
      message: 'Configure a static file directory?',
      initial: defaults.addStatic,
    },
    {
      type: (prev) => (prev ? 'text' : null),
      name: 'staticPath',
      message: 'URL path for static files (e.g., /public/*)?',
      initial: defaults.staticPath,
    },
    {
      type: (prev, values) => (values.addStatic ? 'text' : null),
      name: 'staticRoot',
      message: 'Filesystem directory for static files (e.g., ./public)?',
      initial: defaults.staticRoot,
    },
    {
      type: 'confirm',
      name: 'enableOpenAPI',
      message: 'Enable OpenAPI documentation?',
      initial: defaults.enableOpenAPI,
    },
  ]);

  // Create project structure
  const routesDir = path.join(basePath, responses.routesDir || 'routes');
  const middlewareDir = path.join(
    basePath,
    responses.middlewareDir || 'middleware'
  );

  createDirectory(routesDir);
  createDirectory(middlewareDir);

  if (responses.addStatic && responses.staticRoot) {
    createDirectory(path.join(basePath, responses.staticRoot));
  }

  const publicDir = path.join(basePath, 'public');
  createDirectory(publicDir);
  ensureFavicon(publicDir);

  console.log(responses)

  // Write config file
  fs.writeFileSync(
    configPath,
    generateConfigContent({
      basePath: responses.basePath || '/',
      routesDir: responses.routesDir || 'routes',
      middlewareDir: responses.middlewareDir || 'middleware',
      port: responses.port || 3000,
    })
  );


  // fs.writeFileSync(configPath, generateConfigContent());
  console.log(`📄 Created sumi.config.ts`);

  // Create only the index route
  const indexRoutePath = path.join(routesDir, 'index.ts');
  if (!fs.existsSync(indexRoutePath)) {
    fs.writeFileSync(indexRoutePath, generateIndexRouteContent());
    console.log(
      `📄 Created example route: ${path.relative(basePath, indexRoutePath)}`
    );
  }

  // Create global middleware (_index.ts)
  const globalMiddlewarePath = path.join(middlewareDir, '_index.ts');
  if (!fs.existsSync(globalMiddlewarePath)) {
    fs.writeFileSync(globalMiddlewarePath, generateMiddlewareContent());
    console.log(
      `📄 Created global middleware: ${path.relative(
        basePath,
        globalMiddlewarePath
      )}`
    );
  }

  // Create route-specific auth middleware
  const authMiddlewarePath = path.join(middlewareDir, 'auth.ts');
  if (!fs.existsSync(authMiddlewarePath)) {
    fs.writeFileSync(authMiddlewarePath, generateAuthMiddlewareContent());
    console.log(
      `📄 Created auth middleware: ${path.relative(
        basePath,
        authMiddlewarePath
      )}`
    );
  }

  // Remove the users directory and simple route creation
  // Keep only README and .gitignore creation...

  // Create example middleware
  const middlewareFilePath = path.join(middlewareDir, '_index.ts');
  if (!fs.existsSync(middlewareFilePath)) {
    fs.writeFileSync(middlewareFilePath, generateMiddlewareContent());
    console.log(
      `📄 Created example middleware: ${path.relative(
        basePath,
        middlewareFilePath
      )}`
    );
  }

  // Create other files
  const readmePath = path.join(basePath, 'README.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(
      readmePath,
      generateReadmeContent(path.basename(basePath))
    );
    console.log(`📄 Created README.md`);
  }

  const gitignorePath = path.join(basePath, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, generateGitignoreContent());
    console.log(`📄 Created .gitignore`);
  }

  ensureBunTypes(path.join(basePath, 'tsconfig.json'));
}

/**
 * Ensures tsconfig.json exists and includes `types: ['bun']`.
 * Creates a minimal config if the file is absent.
 * Patches the existing file if bun is missing from compilerOptions.types.
 */
function ensureBunTypes(tsconfigPath: string): void {
  if (!fs.existsSync(tsconfigPath)) {
    fs.writeFileSync(tsconfigPath, JSON.stringify({
      compilerOptions: {
        target: 'ESNext',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        skipLibCheck: true,
        types: ['bun'],
      },
      include: ['**/*.ts'],
      exclude: ['node_modules', 'dist'],
    }, null, 2));
    return;
  }

  try {
    const raw = fs.readFileSync(tsconfigPath, 'utf-8');
    const config = JSON.parse(raw);
    const types: string[] = config?.compilerOptions?.types ?? [];
    if (!types.includes('bun')) {
      config.compilerOptions ??= {};
      config.compilerOptions.types = [...types, 'bun'];
      fs.writeFileSync(tsconfigPath, JSON.stringify(config, null, 2));
    }
  } catch {
    // JSONC or unreadable tsconfig — skip silently
  }
}

function determineFilePattern(routePath: string): {
  filePath: string;
  isCollection: boolean;
} {
  const cleanPath = routePath.replace(/^\/+|\/+$/g, '');
  const segments = cleanPath.split('/');
  const lastSegment = segments[segments.length - 1];

  const isCollection = !lastSegment.includes('[') && !lastSegment.includes(']');

  let filePath;
  if (isCollection) {
    filePath = path.join(cleanPath, 'index.ts');
  } else {
    filePath = cleanPath + '.ts';
  }

  return { filePath, isCollection };
}

function generateRouteContent(
  routePath: string,
  methods: string[],
  isCollection: boolean
): string {
  const cleanPath = routePath.replace(/^\/+|\/+$/g, '');
  const segments = cleanPath.split('/');

  const params = segments
    .filter((segment) => segment.includes('[') && segment.includes(']'))
    .map((segment) => segment.replace(/[\[\]]/g, ''));

  const paramSchema =
    params.length > 0
      ? `const paramSchema = z.object({
  ${params
    .map(
      (param) =>
        `${param}: z.string().min(1, '${
          param.charAt(0).toUpperCase() + param.slice(1)
        } is required'),`
    )
    .join('\n  ')}
}).describe('${cleanPath} route parameters');`
      : '';

  // Generate method handlers
  const methodHandlers = methods
    .map((method) => {
      const upperMethod = method.toUpperCase();
      const hasParams = params.length > 0;

      switch (method.toLowerCase()) {
        case 'get':
          if (isCollection) {
            return `  ${method}: {
    schema: {
      query: z.object({
        page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
        limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 10),
        search: z.string().optional(),
      }).describe('Collection query parameters'),${
        hasParams ? '\n      param: paramSchema,' : ''
      }
    },
    openapi: {
      summary: 'Get ${cleanPath} collection',
      description: 'Retrieve a paginated list of ${cleanPath}',
      tags: ['${cleanPath}'],
      responses: {
        200: {
          description: 'Collection retrieved successfully',
          content: {
            'application/json': {
              schema: z.object({
                data: z.array(z.object({
                  id: z.string(),
                  // Add your fields here
                })),
                pagination: z.object({
                  page: z.number(),
                  limit: z.number(),
                  total: z.number(),
                }),
              }).describe('Paginated collection response')
            }
          }
        }
      }
    },
    handler: (c) => {
      const { page, limit, search } = c.req.valid('query');${
        hasParams
          ? `
      const ${params.map((p) => `{ ${p} }`).join(', ')} = c.req.valid('param');`
          : ''
      }
      
      // TODO: Implement your collection logic here
      return c.json({
        data: [],${hasParams ? `\n        parentId: ${params[0]},` : ''}
        pagination: { page, limit, total: 0 },
        ...(search && { searchQuery: search })
      });
    },
  }`;
          } else {
            return `  ${method}: {${
              hasParams
                ? `
    schema: {
      param: paramSchema,
    },`
                : ''
            }
    openapi: {
      summary: 'Get ${cleanPath}',
      description: 'Retrieve a specific ${cleanPath.split('/').pop()} by ID',
      tags: ['${cleanPath.split('/')[0] || cleanPath}'],
      responses: {
        200: {
          description: 'Resource found successfully',
          content: {
            'application/json': {
              schema: z.object({
                id: z.string(),
                // Add your response fields here
                createdAt: z.string().datetime(),
                updatedAt: z.string().datetime(),
              }).describe('${cleanPath} resource response')
            }
          }
        },
        404: {
          description: 'Resource not found'
        }
      }
    },
    handler: (c) => {${
      hasParams
        ? `
      const ${params.map((p) => `{ ${p} }`).join(', ')} = c.req.valid('param');`
        : ''
    }
      
      // TODO: Implement your resource lookup logic here
      return c.json({${
        hasParams
          ? `
        id: ${params[0]},`
          : ''
      }
        message: '${upperMethod} ${cleanPath} - Single resource endpoint',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
  }`;
          }

        case 'post':
          const createSchema = `z.object({
        // TODO: Define your request body schema
        name: z.string().min(1, 'Name is required'),
        description: z.string().optional(),
      }).describe('${cleanPath} creation request').meta({ ref: 'Create${
            cleanPath.charAt(0).toUpperCase() + cleanPath.slice(1)
          }Request' })`;

          return `  ${method}: {
    schema: {${
      hasParams
        ? `
      param: paramSchema,`
        : ''
    }
      json: ${createSchema},
    },
    openapi: {
      summary: 'Create ${cleanPath}',
      description: 'Create a new ${cleanPath.split('/').pop() || cleanPath}',
      tags: ['${cleanPath.split('/')[0] || cleanPath}'],
      responses: {
        201: {
          description: 'Resource created successfully',
          content: {
            'application/json': {
              schema: z.object({
                id: z.string().uuid(),
                name: z.string(),
                description: z.string().optional(),
                createdAt: z.string().datetime(),
              }).describe('Created ${cleanPath} response')
            }
          }
        }
      }
    },
    handler: (c) => {${
      hasParams
        ? `
      const ${params.map((p) => `{ ${p} }`).join(', ')} = c.req.valid('param');`
        : ''
    }
      const data = c.req.valid('json');
      
      // TODO: Implement your creation logic here
      return c.json({
        id: crypto.randomUUID(),${
          hasParams
            ? `
        ${params[0]},`
            : ''
        }
        ...data,
        createdAt: new Date().toISOString(),
      }, 201);
    },
  }`;

        case 'put':
        case 'patch':
          const updateSchema = `z.object({
        // TODO: Define your update schema
        name: z.string().min(1).optional(),
        description: z.string().optional(),
      }).describe('${cleanPath} update request').meta({ ref: 'Update${
            cleanPath.charAt(0).toUpperCase() + cleanPath.slice(1)
          }Request' })`;

          return `  ${method}: {
    schema: {${
      hasParams
        ? `
      param: paramSchema,`
        : ''
    }
      json: ${updateSchema},
    },
    openapi: {
      summary: '${method === 'put' ? 'Replace' : 'Update'} ${cleanPath}',
      description: '${method === 'put' ? 'Replace' : 'Partially update'} a ${
            cleanPath.split('/').pop() || cleanPath
          }',
      tags: ['${cleanPath.split('/')[0] || cleanPath}'],
      responses: {
        200: {
          description: 'Resource updated successfully',
          content: {
            'application/json': {
              schema: z.object({
                id: z.string(),
                name: z.string(),
                description: z.string().optional(),
                updatedAt: z.string().datetime(),
              }).describe('Updated ${cleanPath} response')
            }
          }
        },
        404: {
          description: 'Resource not found'
        }
      }
    },
    handler: (c) => {${
      hasParams
        ? `
      const ${params.map((p) => `{ ${p} }`).join(', ')} = c.req.valid('param');`
        : ''
    }
      const updates = c.req.valid('json');
      
      // TODO: Implement your update logic here
      return c.json({${
        hasParams
          ? `
        id: ${params[0]},`
          : ''
      }
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    },
  }`;

        case 'delete':
          return `  ${method}: {${
            hasParams
              ? `
    schema: {
      param: paramSchema,
    },`
              : ''
          }
    openapi: {
      summary: 'Delete ${cleanPath}',
      description: 'Remove a ${cleanPath.split('/').pop() || cleanPath}',
      tags: ['${cleanPath.split('/')[0] || cleanPath}'],
      responses: {
        204: {
          description: 'Resource deleted successfully'
        },
        404: {
          description: 'Resource not found'
        }
      }
    },
    handler: (c) => {${
      hasParams
        ? `
      const ${params.map((p) => `{ ${p} }`).join(', ')} = c.req.valid('param');`
        : ''
    }
      
      // TODO: Implement your deletion logic here
      return c.json({${
        hasParams
          ? `
        id: ${params[0]},`
          : ''
      }
        message: 'Resource deleted successfully'
      }, 204);
    },
  }`;

        default:
          return `  ${method}: (c) => {
    // TODO: Implement ${upperMethod} ${cleanPath}
    return c.json({ 
      message: '${upperMethod} ${cleanPath}',
      timestamp: new Date().toISOString()
    });
  }`;
      }
    })
    .join(',\n\n');

  return `import { z } from 'zod';
import { createRoute } from '@bethel-nz/sumi/router';
import { ValidationContext } from '@bethel-nz/sumi/router';

${paramSchema}

// Routes for /${cleanPath}
export default createRoute({
${methodHandlers}
});
`;
}

async function generateRouteFile(
  routePath: string,
  routesDir: string,
  methods: string[]
) {
  const { filePath, isCollection } = determineFilePattern(routePath);
  const fullPath = path.join(process.cwd(), routesDir, filePath);
  const dir = path.dirname(fullPath);

  // Create directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${path.relative(process.cwd(), dir)}`);
  }

  // Check if file already exists
  if (fs.existsSync(fullPath)) {
    const { overwrite } = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `File ${path.relative(
        process.cwd(),
        fullPath
      )} already exists. Overwrite?`,
      initial: false,
    });

    if (!overwrite) {
      console.log('📝 Generation cancelled.');
      return;
    }
  }

  // Generate and write the file
  const content = generateRouteContent(routePath, methods, isCollection);
  fs.writeFileSync(fullPath, content);

  console.log(`📄 Generated route: ${path.relative(process.cwd(), fullPath)}`);
  console.log(`🎯 Route pattern: ${routePath}`);
  console.log(`📋 Methods: ${methods.join(', ').toUpperCase()}`);
  console.log(`📂 Type: ${isCollection ? 'Collection' : 'Single Resource'}`);
}

async function generateMiddlewareFile(
  middlewareName: string,
  configPath?: string
) {
  let middlewareDir = 'middleware'; // default

  // Try to read middleware directory from config
  if (configPath && fs.existsSync(configPath)) {
    try {
      const configModule = await import(
        `file://${path.resolve(configPath)}?v=${Date.now()}`
      );
      const config: SumiConfig = configModule.default;
      middlewareDir = config.middlewareDir || 'middleware';
    } catch (error) {
      console.warn(
        '⚠️  Could not read config, using default middleware directory'
      );
    }
  }

  const middlewareContent = `import { Next } from 'hono';
import type { SumiContext } from '@bethel-nz/sumi';
import { createMiddleware } from '@bethel-nz/sumi/router';

/**
 * ${middlewareName} middleware
 * TODO: Implement your middleware logic here
 */
export default createMiddleware({
  _: async (c: SumiContext, next: Next) => {
    const startTime = Date.now();
    
    // TODO: Add your middleware logic here
    console.log(\`🔧 [${middlewareName}] Processing request to \${c.req.url}\`);
    
    // Example: Authentication check
    // const authHeader = c.req.header('Authorization');
    // if (!authHeader?.startsWith('Bearer ')) {
    //   return c.json({ error: 'Unauthorized', message: 'Missing or invalid token' }, 401);
    // }
    
    // Example: Rate limiting
    // const clientIp = c.req.header('x-forwarded-for') || 'unknown';
    // if (await isRateLimited(clientIp)) {
    //   return c.json({ error: 'Too Many Requests' }, 429);
    // }
    
    // Example: Request validation
    // const contentType = c.req.header('content-type');
    // if (c.req.method === 'POST' && !contentType?.includes('application/json')) {
    //   return c.json({ error: 'Bad Request', message: 'Content-Type must be application/json' }, 400);
    // }
    
    await next();
    
    const duration = Date.now() - startTime;
    console.log(\`✅ [${middlewareName}] Request completed in \${duration}ms\`);
  },
});
`;

  const middlewarePath = path.join(
    process.cwd(),
    middlewareDir,
    `${middlewareName}.ts`
  );
  const dir = path.dirname(middlewarePath);

  // Create directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${path.relative(process.cwd(), dir)}`);
  }

  // Check if file already exists
  if (fs.existsSync(middlewarePath)) {
    const { overwrite } = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `Middleware ${middlewareName}.ts already exists. Overwrite?`,
      initial: false,
    });

    if (!overwrite) {
      console.log('📝 Generation cancelled.');
      return;
    }
  }

  fs.writeFileSync(middlewarePath, middlewareContent);

  console.log(
    `🔧 Generated middleware: ${path.relative(process.cwd(), middlewarePath)}`
  );
  console.log(
    `💡 Usage: Apply this middleware to routes that need ${middlewareName} functionality`
  );
}

cli
  .command('routes', 'Print all discovered routes')
  .option('-c, --config <config>', 'Config file path', {
    default: 'sumi.config.ts',
  })
  .action(async (options: { config: string }) => {
    const configPath = path.resolve(process.cwd(), options.config);
    let routesDir = 'routes';
    let middlewareDir = 'middleware';

    if (fs.existsSync(configPath)) {
      try {
        const configModule = await import(`file://${configPath}?v=${Date.now()}`);
        const config: SumiConfig = configModule.default;
        routesDir = config.routesDir || 'routes';
        middlewareDir = config.middlewareDir || 'middleware';
      } catch {
        // use defaults
      }
    }

    const { generateManifest } = await import('../lib/manifest');
    const manifest = generateManifest(routesDir, middlewareDir);

    if (manifest.routes.length === 0) {
      console.log('No routes found.');
      return;
    }

    // Build a tree from route paths
    interface TreeNode {
      segment: string;
      fullPath: string;
      methods: { method: string; filePath: string }[];
      children: Map<string, TreeNode>;
    }

    const root: TreeNode = { segment: '', fullPath: '', methods: [], children: new Map() };

    for (const route of manifest.routes) {
      const segments = route.routePath === '/' ? [''] : route.routePath.split('/').filter(Boolean);
      let current = root;
      let builtPath = '';

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        builtPath = builtPath + '/' + seg;
        if (!current.children.has(seg)) {
          current.children.set(seg, { segment: seg, fullPath: builtPath || '/', methods: [], children: new Map() });
        }
        current = current.children.get(seg)!;
      }

      const filePath = path.relative(process.cwd(), route.filePath);
      const verbs = route.methods.length > 0 ? route.methods : ['HTTP'];
      for (const verb of verbs) {
        const method = route.sse.includes(verb) ? `${verb} (SSE)` : verb;
        current.methods.push({ method, filePath });
      }
    }

    function printTree(node: TreeNode, prefix: string = '', isRoot = true) {
      const entries = Array.from(node.children.entries());
      const total = entries.length;

      for (let i = 0; i < total; i++) {
        const [seg, child] = entries[i];
        const isLast = i === total - 1;
        const branch = isLast ? '└── ' : '├── ';
        const nextPrefix = prefix + (isLast ? '    ' : '│   ');

        // Print the path segment
        const displayPath = child.fullPath;
        console.log(`${prefix}${branch}${displayPath}`);

        // Print methods for this node
        if (child.methods.length > 0) {
          const methodPrefix = nextPrefix;
          const width = Math.max(...child.methods.map((m) => m.method.length));
          child.methods.forEach((m, idx) => {
            const mIsLast = idx === child.methods.length - 1 && child.children.size === 0;
            const mBranch = mIsLast ? '└── ' : '├── ';
            console.log(`${methodPrefix}${mBranch}${m.method.padEnd(width)} → ${m.filePath}`);
          });
        }

        // Recurse into children
        printTree(child, nextPrefix, false);
      }
    }

    console.log(`\n🔥 Routes (${manifest.routes.length}):\n`);
    printTree(root);
    console.log();
  });

cli
  .command('doctor', 'Check project health: config, routes, middleware, deps')
  .option('-c, --config <config>', 'Config file path', {
    default: 'sumi.config.ts',
  })
  .action(async (options: { config: string }) => {
    const issues: string[] = [];
    const ok: string[] = [];

    // Check config
    const configPath = path.resolve(process.cwd(), options.config);
    if (fs.existsSync(configPath)) {
      ok.push(`Config file found: ${options.config}`);
      try {
        const configModule = await import(`file://${configPath}?v=${Date.now()}`);
        const config: SumiConfig = configModule.default;

        const routesDir = config.routesDir || 'routes';
        const middlewareDir = config.middlewareDir || 'middleware';

        // Check routes dir
        if (fs.existsSync(routesDir)) {
          ok.push(`Routes directory exists: ${routesDir}`);
        } else {
          issues.push(`Routes directory missing: ${routesDir}`);
        }

        // Check middleware dir
        if (fs.existsSync(middlewareDir)) {
          ok.push(`Middleware directory exists: ${middlewareDir}`);
        } else {
          issues.push(`Middleware directory missing: ${middlewareDir}`);
        }

        // Check dependencies
        const pkgJsonPath = path.resolve(process.cwd(), 'package.json');
        if (fs.existsSync(pkgJsonPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          const required = ['hono', 'zod', '@bethel-nz/sumi'];
          for (const dep of required) {
            if (deps[dep]) {
              ok.push(`Dependency installed: ${dep}@${deps[dep]}`);
            } else {
              issues.push(`Missing dependency: ${dep}`);
            }
          }
        } else {
          issues.push('No package.json found');
        }
      } catch (error: any) {
        issues.push(`Failed to load config: ${error.message}`);
      }
    } else {
      issues.push(`Config file not found: ${options.config}`);
    }

    // Report
    console.log('\n🔥 Sumi Doctor\n');
    for (const msg of ok) {
      console.log(`  ✅ ${msg}`);
    }
    for (const msg of issues) {
      console.log(`  ❌ ${msg}`);
    }
    console.log();

    if (issues.length > 0) {
      console.log(`Found ${issues.length} issue(s). Run \`sumi init\` to scaffold a new project.\n`);
      process.exit(1);
    } else {
      console.log('All checks passed.\n');
    }
  });

cli.help();

cli.parse();
