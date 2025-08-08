import fs from 'fs';
import path from 'path';
import { Sumi } from './sumi';
import type { SumiConfig } from './types';

export interface TestAppOptions {
  configPath?: string;
  env?: Record<string, string>;
  overrides?: Partial<SumiConfig>;
}

/**
 * Creates a test instance of your Sumi app for testing
 */
export async function createTestApp(options: TestAppOptions = {}) {
  const { configPath = 'sumi.config.ts', env = {}, overrides = {} } = options;

  // Set test environment variables
  const originalEnv = { ...process.env };
  Object.assign(process.env, { NODE_ENV: 'test', ...env });

  try {
    // Load the project's config
    const fullConfigPath = path.resolve(process.cwd(), configPath);

    if (!fs.existsSync(fullConfigPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    const configModule = await import(
      `file://${fullConfigPath}?v=${Date.now()}`
    );
    const config: SumiConfig = { ...configModule.default, ...overrides };

    // Create test instance
    const sumi = new Sumi(config);

    // Build routes without starting server
    await sumi.burn(); // This will skip server startup in test mode

    // Return a test-friendly interface
    return {
      /**
       * Make a request to your app
       */
      request: (path: string, init?: RequestInit) => {
        const url = `http://localhost${config.basePath || ''}${path}`;
        const request = new Request(url, init);
        return sumi.fetch()(request);
      },

      /**
       * Access the underlying Sumi instance
       */
      app: sumi,

      /**
       * Access the Hono app directly
       */
      hono: sumi.app,

      /**
       * Clean up test instance
       */
      cleanup: () => {
        // Restore original environment
        process.env = originalEnv;
      },
    };
  } catch (error) {
    // Restore environment on error
    process.env = originalEnv;
    throw error;
  }
}

/**
 * Creates a minimal test app with custom config
 */
export function createMockApp(config: Partial<SumiConfig> = {}) {
  const mockConfig: SumiConfig = {
    logger: false,
    port: 3000,
    routesDir: 'test/fixtures/routes',
    middlewareDir: 'test/fixtures/middleware',
    ...config,
  };

  const sumi = new Sumi(mockConfig);

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
