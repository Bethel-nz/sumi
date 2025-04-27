import fs from 'fs';
import path, { join } from 'path';
import { Context, ExecutionContext, Hono, Next } from 'hono';
import { serveStatic } from 'hono/bun';

import { RouteParser } from './RouteParser';
import { startFileWatcher } from './filewatcher';
import { MiddlewareHandler } from './middlewarehandler';
import { ErrorHandler } from './errorHandler';
import { PluginManager } from './pluginmanager';
import { SumiConfig, StaticRouteConfig, SumiContext } from './types';

/**
 * Sumi - A lightweight file based routing web framework built on top of Hono
 */
class Sumi {
  public app: Hono;
  private default_dir: string;
  private default_middleware_dir: string;
  private middlewareHandler: MiddlewareHandler;
  private app_base_path: string | undefined;
  private logger: boolean;
  private pluginManager: PluginManager;
  private processedPaths: Set<string> = new Set();
  private uniqueRoutes: Set<string> = new Set();
  private staticConfig: StaticRouteConfig[] = [];

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
  constructor(default_args: SumiConfig) {
    this.app = default_args.app || new Hono();

    if (default_args.basePath) {
      this.app_base_path = default_args.basePath;
      this.app = this.app.basePath(this.app_base_path);
    }

    this.logger = default_args.logger;
    this.staticConfig = default_args.static || [];

    this.default_middleware_dir = default_args.middlewareDir
      ? path.resolve(default_args.middlewareDir)
      : path.resolve('routes/middleware');
    this.default_dir = default_args.routesDir
      ? path.resolve(default_args.routesDir)
      : path.resolve('routes');
    // Apply global middleware once
    this.middlewareHandler = new MiddlewareHandler(
      this.app,
      this.logger,
      this.default_middleware_dir,
      this.app_base_path!
    );

    this.middlewareHandler.applyGlobalMiddleware();

    this.pluginManager = new PluginManager(this.app);
  }

  /**
   * Validates if a file has a supported extension.
   * @param file_path The path of the file to validate.
   * @returns True if valid, else false.
   */
  private is_valid_file(file_path: string): boolean {
    return ['.js', '.ts'].includes(path.extname(file_path));
  }

  /**
   * Converts a file path to a Hono-compatible route.
   * @param filePath The file path to convert.
   * @returns The Hono route path.
   */
  private convertToHonoRoute(filePath: string): string {
    const routeName = path.basename(filePath, path.extname(filePath));

    // Skip hibana and files starting with underscore
    if (routeName === 'hibana' || routeName.startsWith('_')) return '';

    const isIndexFile = routeName === 'index';
    const relativePath = path.relative(this.default_dir, filePath);
    const dirPath = path.dirname(relativePath);
    const pathSegments = dirPath
      .split(path.sep)
      .map(RouteParser.parseSegment)
      .filter(Boolean);

    const finalRouteName = isIndexFile ? '' : `/${routeName}`;
    const routePath = `/${[...pathSegments, finalRouteName].join('/')}`
      .replace(/\/+/g, '/')
      .replace(/\/$/, '');

    // Handle root index file
    if (routePath === '/' || routePath === '/.' || routePath === '') return '/';

    return routePath.replace(/\[(\w+)\]/g, ':$1');
  }

  /**
   * Builds routes by scanning the specified directory.
   * @param directory The directory to scan.
   * @param base_path The base path for the routes.
   */
  private build_routes(
    directory: string = this.default_dir,
    base_path: string = ''
  ): void {
    // Skip certain directories
    const ignoredDirs = ['dist', 'static', 'public'];
    if (ignoredDirs.some((dir) => directory.includes(dir))) return;

    // Create initial directories if they don't exist
    if (!fs.existsSync(this.default_dir)) {
      console.log(`Creating routes directory: ${this.default_dir}`);
      fs.mkdirSync(this.default_dir, { recursive: true });

      // Create a sample index.ts if it doesn't exist
      const indexPath = path.join(this.default_dir, 'index.ts');
      if (!fs.existsSync(indexPath)) {
        return;
      }

      if (!fs.existsSync(this.default_middleware_dir)) {
        console.log(
          `Creating middleware directory: ${this.default_middleware_dir}`
        );
        fs.mkdirSync(this.default_middleware_dir, { recursive: true });

        // Create a sample middleware if it doesn't exist
        const middlewarePath = path.join(
          this.default_middleware_dir,
          '_middleware.ts'
        );
        if (!fs.existsSync(middlewarePath)) {
          return;
        }
      }
    }

    // Continue with existing route building logic
    if (directory.includes('dist')) return;

    const files = fs.readdirSync(directory);
    files.forEach((file) => {
      const file_path = path.join(directory, file);
      const stat = fs.statSync(file_path);

      if (stat.isDirectory()) {
        this.handleDirectory(file_path, base_path);
      } else if (this.is_valid_file(file_path) && stat.size > 0) {
        this.handleFile(file_path, directory);
      }
    });
  }

  private async handleDirectory(
    dirPath: string,
    basePath: string
  ): Promise<void> {
    const segment = RouteParser.parseSegment(path.basename(dirPath));
    // Note: build_routes itself isn't awaited here, might process in parallel
    this.build_routes(dirPath, `${basePath}/${segment}`);

    const indexPath = path.join(dirPath, 'index.ts');
    if (fs.existsSync(indexPath) && this.is_valid_file(indexPath)) {
      await this.processRouteFile(indexPath, basePath); // Await the async processing
    }
  }

  private async handleFile(filePath: string, baseDir: string): Promise<void> {
    await this.processRouteFile(filePath, baseDir); // Await the async processing
  }

  private async processRouteFile(
    filePath: string,
    baseDir: string
  ): Promise<void> {
    let routeModule;
    try {
      // Use dynamic import without cache-busting query parameter
      console.log(`[Sumi Router] Importing route: ${filePath}`);
      routeModule = await import(filePath);

      if (!routeModule.default) {
        // Check for default export on the imported module
        console.warn(
          `[Sumi Router] No default export found in route file: ${filePath}. Skipping.`
        );
        return;
      }
      // Get the default export
      const route = routeModule.default;
    } catch (error) {
      console.error(
        `[Sumi Router] Error loading route file ${filePath}:`,
        error
      );
      return; // Stop processing this file if loading fails
    }

    // --- Route processing logic remains largely the same ---
    const route_path = this.convertToHonoRoute(filePath);
    if (!route_path) return;

    // Apply middleware (assuming applyMiddleware is synchronous)
    if (!this.processedPaths.has(route_path)) {
      this.middlewareHandler.applyMiddleware(baseDir, route_path);
      this.processedPaths.add(route_path);
    }

    // Get the default export again for processing methods
    const route = routeModule.default;
    Object.keys(route).forEach((method) => {
      const handler = route[method];
      if (typeof handler === 'function') {
        const routeKey = `${method.toUpperCase()}:${route_path}`;

        // Only register if it's a new unique route

        // Only register if it's a new unique route
        if (!this.uniqueRoutes.has(routeKey)) {
          this.uniqueRoutes.add(routeKey);
          try {
            // applyRouteMethod remains synchronous
            this.applyRouteMethod(method, route_path, handler);
          } catch (error) {
            console.error(
              `[Sumi Router] Error applying route method ${method.toUpperCase()} for path ${route_path} from file ${filePath}:`,
              error
            );
          }
        }
      }
    });
  }

  private applyRouteMethod(
    method: string,
    routePath: string,
    handler: any
  ): void {
    // Regular route handling
    switch (method.toLowerCase()) {
      case 'get':
        this.app.get(routePath, handler);
        break;
      case 'post':
        this.app.post(routePath, handler);
        break;
      case 'put':
        this.app.put(routePath, handler);
        break;
      case 'delete':
        this.app.delete(routePath, handler);
        break;
      case 'patch':
        this.app.patch(routePath, handler);
        break;
      case '_':
        this.app.use(routePath, handler);
        break;
      default:
        console.log(`Unknown method ${method}`);
    }
  }

  private clearRoutesAndMiddleware(): void {
    // Create a new Hono instance to effectively clear routes
    const newApp = new Hono();
    // Re-apply base path if it exists
    if (this.app_base_path) {
      this.app = newApp.basePath(this.app_base_path);
    } else {
      this.app = newApp;
    }

    // Reset middleware handler with the new app instance
    this.middlewareHandler.reset(this.app);
    // Clear tracking sets
    this.processedPaths.clear();
    this.uniqueRoutes.clear();
    console.log('[Sumi Reloader] Cleared routes and internal state.');
  }

  private generateServerInfo(): string {
    return `
🔥 Sumi v1.0 is burning hot and ready to serve!
🛣️  Routes: ${this.uniqueRoutes.size} route(s) registered
  `;
  }

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
  plugin(
    handler: (c: SumiContext, next: Next) => Promise<void | Response>
  ): void {
    this.pluginManager.register(handler);
  }

  /**
   * Initializes the server and starts watching for file changes
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails
   * @example
   * sumi.burn();
   */
  burn(): void {
    try {
      this.processedPaths.clear();
      this.build_routes();

      // Clear console after initial setup and watcher start
      console.clear();
      startFileWatcher(this.default_middleware_dir, this.default_dir, () => {
        this.middlewareHandler.applyGlobalMiddleware();
        this.build_routes();
        this.clearRoutesAndMiddleware();
      });
    } catch (error) {
      console.error('Error during burn():', error);
      throw error;
    }
  }

  /**
   * Returns the fetch handler for the Hono app
   * @returns {Function} Bound fetch handler for the application
   * @throws {Error} If app instance is not found
   * @example
   * const fetch = sumi.fetch();
   * const response = await fetch('/api/users');
   */
  fetch() {
    try {
      if (!this.app) {
        console.log('no app instance found');
        return;
      }
      return this.app.fetch.bind(this.app);
    } catch (error) {
      console.error('Error getting fetch instance:', error);
      throw error;
    }
  }
}

export default Sumi;
