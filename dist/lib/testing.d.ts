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
export declare function createTestApp(options?: TestAppOptions): Promise<{
    /**
     * Make a request to your app
     */
    request: (path: string, init?: RequestInit) => Response | Promise<Response>;
    /**
     * Access the underlying Sumi instance
     */
    app: Sumi;
    /**
     * Access the Hono app directly
     */
    hono: import("hono").Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
    /**
     * Clean up test instance
     */
    cleanup: () => void;
}>;
/**
 * Creates a minimal test app with custom config
 */
export declare function createMockApp(config?: Partial<SumiConfig>): {
    request: (path: string, init?: RequestInit) => Response | Promise<Response>;
    app: Sumi;
    hono: import("hono").Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
};
