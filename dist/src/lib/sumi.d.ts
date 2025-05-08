import { ExecutionContext, Hono, Next } from 'hono';
import { SumiConfig, SumiContext } from './types';
/**
 * Sumi - A lightweight file based routing web framework built on top of Hono
 */
declare class Sumi {
    app: Hono;
    private default_dir;
    private default_middleware_dir;
    private middlewareHandler;
    private app_base_path;
    private logger;
    private pluginManager;
    private processedPaths;
    private uniqueRoutes;
    private staticConfig;
    /**
     * Initializes a new instance of the Sumi class.
     * @param {Object} default_args - Configuration options for Sumi
     * @param {Hono} [default_args.app] - Optional Hono instance to use
     * @param {boolean} default_args.logger - Enable/disable logging
     * @param {string} [default_args.basePath] - Base path for all routes (e.g., '/api/v1')
     * @param {string} [default_args.middlewareDir] - Directory for middleware files
     * @param {string} [default_args.routesDir] - Directory for route files
     * @param {number} default_args.port - Port number for the server
     * @param {StaticRouteConfig[]} [default_args.static] - Static route configurations
     */
    constructor(default_args: SumiConfig);
    /**
     * Validates if a file has a supported extension.
     * @param file_path The path of the file to validate.
     * @returns True if valid, else false.
     */
    private is_valid_file;
    /**
     * Converts a file path to a Hono-compatible route.
     * @param filePath The file path to convert.
     * @returns The Hono route path.
     */
    private convertToHonoRoute;
    /**
     * Builds routes by scanning the specified directory.
     * @param directory The directory to scan.
     * @param base_path The base path for the routes.
     */
    private build_routes;
    private handleDirectory;
    private handleFile;
    private processRouteFile;
    private applyRouteMethod;
    private clearRoutesAndMiddleware;
    private generateServerInfo;
    /**
     * Registers a plugin to be used across the application
     * @param {Function} handler - Plugin handler function
     * @param {Context} handler.c - Hono context
     * @param {Next} handler.next - Next function for middleware chain
     * @returns {void}
     * @example
     * sumi.plugin(async (c, next) => {
     *   c.plugin.set('db', database);
     *   await next();
     * });
     */
    plugin(handler: (c: SumiContext, next: Next) => Promise<void | Response>): void;
    /**
     * Initializes the server and starts watching for file changes
     * @returns {Promise<void>}
     * @throws {Error} If initialization fails
     * @example
     * sumi.burn();
     */
    burn(): void;
    /**
     * Returns the fetch handler for the Hono app
     * @returns {Function} Bound fetch handler for the application
     * @throws {Error} If app instance is not found
     * @example
     * const fetch = sumi.fetch();
     * const response = await fetch('/api/users');
     */
    fetch(): ((request: Request, Env?: unknown, executionCtx?: ExecutionContext) => Response | Promise<Response>) | undefined;
}
export default Sumi;
