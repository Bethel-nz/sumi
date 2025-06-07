#!/usr/bin/env bun
import { z } from 'zod';
import { defineCommand, defineConfig, defineOptions } from 'zodest/config';
import { processConfig } from 'zodest';
import prompts from 'prompts';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function createDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function generateSumiConfigContent(config: any): string {
  const cleanConfig = { ...config };
  if (cleanConfig.port === undefined) delete cleanConfig.port;
  if (cleanConfig.basePath === undefined) delete cleanConfig.basePath;
  if (cleanConfig.static?.length === 0) delete cleanConfig.static;

  return `
import type { SumiConfig } from '@bethel-nz/sumi';
import { defineConfig } from '@bethel-nz/sumi';

export default defineConfig({
  ${JSON.stringify(cleanConfig, null, 2).slice(1, -1)}
});
  `;
}

function generateIndexRouteContent(): string {
  return `
import { Context } from 'hono';
import { z } from 'zod';
import { createRoute } from '@bethel-nz/sumi/router';

const querySchema = z.object({
  name: z.string().optional().default('World'),
});

export default createRoute({
  get: {
    schema: {
      query: querySchema
    },
    handler: (c: Context) => {
      const { name } = c.req.valid('query');
      return c.json({
        message: \`Hello, \${name}! This is the root route with validation.\`
      });
    }
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
 * Example Middleware using createMiddleware.
 * Logs request start and end with duration.
 */
export default createMiddleware({
  _: async (c: SumiContext, next: Next) => {
    const start = Date.now();
    console.log(
      \`-> \${c.req.method} \${new URL(c.req.url).pathname}\`
    );
    await next();
    const duration = Date.now() - start;
    console.log(
      \`<- \${c.req.method} \${new URL(c.req.url).pathname} (\${c.res.status}) \\\\\`\${duration}ms\\\\\`\n    );
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
        dev: 'bun run --watch src/server.ts --hot',
      },
      dependencies: {},
    },
    null,
    2
  );
}

function generateServerTsContent(): string {
  return `
import { Sumi } from '@bethel-nz/sumi';
import config from '../sumi.config';

const sumi = new Sumi(config);

await sumi.burn();

export default {
  port: config.port ?? 3000,
  fetch: sumi.fetch(),
};
    `;
}

const globalOptions = defineOptions(
  z.object({
    help: z.boolean().optional(),
    version: z.boolean().optional(),
  })
);

const cliConfig = defineConfig({
  globalOptions,
  commands: (gopts) => ({
    new: defineCommand({
      description: 'Create a new Sumi project.',
      args: z.tuple([
        z.string().min(1, { message: 'Project name is required.' }),
      ]),
      options: defineOptions(z.object({})),
      async action(options, [projectName]) {
        console.log(`✨ Creating new Sumi project: ${projectName}`);
        const projectPath = path.resolve(process.cwd(), projectName);

        if (fs.existsSync(projectPath)) {
          console.error(`❌ Directory already exists: ${projectPath}`);
          process.exit(1);
        }

        createDirectory(projectPath);

        const packageJsonPath = path.join(projectPath, 'package.json');
        fs.writeFileSync(
          packageJsonPath,
          generatePackageJsonContent(projectName)
        );
        console.log(`📄 Created package.json`);

        // Always install dependencies from npm
        console.log(`📦 Installing dependencies...`);
        try {
          execSync('bun add @bethel-nz/sumi hono zod', {
            cwd: projectPath,
            stdio: 'inherit',
          });
        } catch (error) {
          console.error('❌ Failed to install dependencies from npm.', error);
          process.exit(1);
        }

        // 3. Run the 'init' logic within the new project directory
        console.log(`⚙️ Initializing project configuration...`);
        await initProject(projectPath);

        console.log(`\n✅ Project '${projectName}' created successfully!`);
        console.log(`\nTo get started:`);
        console.log(`  cd ${projectName}`);
        // Restore simple final instructions
        console.log(`  bun run dev`);
      },
    }),

    init: defineCommand({
      description: 'Initialize Sumi configuration in the current directory.',
      args: z.tuple([]),
      options: defineOptions(z.object({})),
      async action() {
        await initProject(process.cwd());
        console.log(`\n✅ Project initialized successfully!`);
      },
    }),

    dev: defineCommand({
      description: 'Start the Sumi development server.',
      args: z
        .tuple([z.string().optional()])
        .transform(([entry]) => entry || 'src/server.ts'),
      options: defineOptions(
        z.object({
          port: z.coerce.number().optional(),
        })
      ),
      action(entryPoint, options) {
        console.log(
          `🚀 Starting development server with --hot (${entryPoint})...`
        );
        const command = `bun --hot --watch ${entryPoint}`;
        try {
          execSync(command, { stdio: 'inherit' });
        } catch (error) {
          console.error(`❌ Failed to start development server.`);
        }
      },
    }),
  }),
});

async function initProject(basePath: string) {
  const configPath = path.join(basePath, 'sumi.config.ts');

  if (fs.existsSync(configPath)) {
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

  const responses = await prompts([
    {
      type: 'text',
      name: 'routesDir',
      message: 'Routes directory?',
      initial: 'routes',
    },
    {
      type: 'text',
      name: 'middlewareDir',
      message: 'Middleware directory? (relative to routes or project root)',
      initial: 'middleware',
    },
    {
      type: 'confirm',
      name: 'logger',
      message: 'Enable request logger?',
      initial: true,
    },
    {
      type: 'number',
      name: 'port',
      message: 'Development server port?',
      initial: 3000,
    },
    {
      type: 'text',
      name: 'basePath',
      message: 'API base path? (e.g., /api/v1 or leave empty for /)',
      initial: '/',
    },
    {
      type: 'confirm',
      name: 'addStatic',
      message: 'Configure a static file directory?',
      initial: false,
    },
    {
      type: (prev) => (prev ? 'text' : null),
      name: 'staticPath',
      message: 'URL path for static files (e.g., /public/*)?',
      initial: '/public/*',
    },
    {
      type: (prev, values) => (values.addStatic ? 'text' : null),
      name: 'staticRoot',
      message: 'Filesystem directory for static files (e.g., ./public)?',
      initial: './public',
    },
  ]);

  const sumiConfig: any = {
    routesDir: path.normalize(responses.routesDir || 'routes'),
    middlewareDir: path.normalize(responses.middlewareDir || 'middleware'),
    logger: responses.logger ?? true,
    port: responses.port || 3000,
    basePath: responses.basePath === '/' ? undefined : responses.basePath,
    static: [],
  };

  if (responses.addStatic && responses.staticPath && responses.staticRoot) {
    sumiConfig.static.push({
      path: responses.staticPath,
      root: responses.staticRoot,
    });
    createDirectory(path.join(basePath, responses.staticRoot));
  }

  fs.writeFileSync(configPath, generateSumiConfigContent(sumiConfig));
  console.log(`📄 Created sumi.config.ts`);

  const routesFullPath = path.join(basePath, sumiConfig.routesDir);
  const middlewareFullPath = path.join(basePath, sumiConfig.middlewareDir);
  createDirectory(routesFullPath);
  createDirectory(middlewareFullPath);

  const indexRoutePath = path.join(routesFullPath, 'index.ts');
  if (!fs.existsSync(indexRoutePath)) {
    fs.writeFileSync(indexRoutePath, generateIndexRouteContent());
    console.log(
      `📄 Created example route: ${path.relative(basePath, indexRoutePath)}`
    );
  }

  const middlewareFilePath = path.join(middlewareFullPath, '_index.ts');
  if (!fs.existsSync(middlewareFilePath)) {
    fs.writeFileSync(middlewareFilePath, generateMiddlewareContent());
    console.log(
      `📄 Created example middleware: ${path.relative(
        basePath,
        middlewareFilePath
      )}`
    );
  }

  const serverDir = path.join(basePath, 'src');
  createDirectory(serverDir);
  const serverPath = path.join(serverDir, 'server.ts');
  if (!fs.existsSync(serverPath)) {
    fs.writeFileSync(serverPath, generateServerTsContent());
    console.log(
      `📄 Created server entry point: ${path.relative(basePath, serverPath)}`
    );
  }
}

try {
  const argv = process.argv.slice(2);

  if (argv.includes('--version') || argv.includes('-V')) {
    console.log('Sumi CLI version: 0.1.0');
    process.exit(0);
  }

  const cfgResult = processConfig(cliConfig, argv);

  if (cfgResult.options?.help) {
    console.log('Sumi CLI - Help');
    console.log('Usage: sumi <command> [options] [args]');
    console.log('\nCommands:');
    console.log('  new <project-name>   Create a new Sumi project.');
    console.log(
      '  init                 Initialize Sumi in the current directory.'
    );
    console.log(
      '  dev [entry-file]     Start the development server (default: src/server.ts).'
    );
    console.log('\nGlobal Options:');
    console.log('  --help               Show help.');
    console.log('  --version            Show version.');
    process.exit(0);
  }

  const commandAction = cfgResult.command.action as (...args: any[]) => any;
  commandAction(cfgResult.options, cfgResult.args);
} catch (error: any) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid arguments:', error.flatten().fieldErrors);
  } else {
    console.error('❌ An unexpected error occurred:', error.message || error);
  }
  process.exit(1);
}
