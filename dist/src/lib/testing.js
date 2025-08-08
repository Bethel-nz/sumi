import fs from 'fs';
import path from 'path';
import { Sumi } from './sumi';
/**
 * Creates a test instance of your Sumi app for testing
 */
export async function createTestApp(options = {}) {
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
        const configModule = await import(`file://${fullConfigPath}?v=${Date.now()}`);
        const config = { ...configModule.default, ...overrides };
        // Create test instance
        const sumi = new Sumi(config);
        // Build routes without starting server
        await sumi.burn(); // This will skip server startup in test mode
        // Return a test-friendly interface
        return {
            /**
             * Make a request to your app
             */
            request: (path, init) => {
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
    }
    catch (error) {
        // Restore environment on error
        process.env = originalEnv;
        throw error;
    }
}
/**
 * Creates a minimal test app with custom config
 */
export function createMockApp(config = {}) {
    const mockConfig = {
        logger: false,
        port: 3000,
        routesDir: 'test/fixtures/routes',
        middlewareDir: 'test/fixtures/middleware',
        ...config,
    };
    const sumi = new Sumi(mockConfig);
    return {
        request: (path, init) => {
            const url = `http://localhost${mockConfig.basePath || ''}${path}`;
            const request = new Request(url, init);
            return sumi.fetch()(request);
        },
        app: sumi,
        hono: sumi.app,
    };
}
