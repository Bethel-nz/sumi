import type { RouteDefinition } from './router';
import type { SumiConfig } from './types';
/** One entry per route file discovered at build time. */
export interface WorkerRouteEntry {
    /** Hono path string, e.g. '/users/:id' */
    path: string;
    /** The default export of the route file */
    module: {
        default: RouteDefinition;
    };
}
/** Pre-built manifest produced by the CLI codegen step. */
export interface WorkerManifest {
    routes: WorkerRouteEntry[];
    /**
     * Middleware by name, matching the string keys in route config's `middleware` array.
     * e.g. { 'auth': authHandlerFn }
     */
    middleware?: Record<string, (c: any, next: any) => any>;
}
export type WorkerConfig = Pick<SumiConfig, 'basePath' | 'openapi' | 'docs' | 'hooks'>;
/**
 * Creates a Hono app from a pre-built route manifest.
 * Safe to use in Cloudflare Workers — no filesystem access or dynamic imports.
 */
export declare function createWorkerApp(manifest: WorkerManifest, config?: WorkerConfig): {
    fetch: (req: Request, env?: any, ctx?: any) => Response | Promise<Response>;
};
