// sumi.ts
import fs from 'fs';
import path from 'path';
import { Hono, Next, Context as HonoContext } from 'hono';
import { serveStatic } from 'hono/bun';

import { RouteParser } from './RouteParser';
import { startFileWatcher } from './filewatcher';
import { MiddlewareHandler } from './middlewarehandler';
import { ErrorHandler } from './errorHandler';

import {
  ValidationSchemaMap,
  RouteHandler,
  RouteDefinition,
  RouteConfig,
  MiddlewareHandler as MiddlewareHandlerFunction,
  ValidationContext,
} from './router';
import {
  StaticRouteConfig,
  SumiContext,
  SumiConfig as SumiConfigType,
} from './types';
import { SumiValidator } from './sumi-validator';

export class Sumi {
  public app: Hono;
  private default_dir: string;
  private default_middleware_dir: string;
  private middlewareHandler: MiddlewareHandler;
  private app_base_path: string | undefined;
  private logger: boolean;
  private processedPaths: Set<string> = new Set();
  private uniqueRoutes: Set<string> = new Set();
  private staticConfig: StaticRouteConfig[] = [];
  private server: any = null; // Store server reference for reloading
  private config_port: number;

  constructor(default_args: SumiConfigType) {
    this.app = default_args.app || new Hono();
    this.config_port = default_args.port;

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

    this.middlewareHandler = new MiddlewareHandler(
      this.app,
      this.logger,
      this.default_middleware_dir,
      this.app_base_path!
    );
    this.middlewareHandler.applyGlobalMiddleware();

    this.staticConfig.forEach((config) => {
      if (config.path && config.root) {
        this.app.use(config.path, serveStatic({ root: config.root }));
      }
    });

    // Error Handler
    this.app.onError((err, c: HonoContext) => {
      ErrorHandler.handleError(
        err,
        `Request to ${c.req.path} by ${c.req.method}`
      );
      return c.json(
        { error: 'Internal Server Error', message: err.message },
        500
      );
    });
  }

  private is_valid_file(file_path: string): boolean {
    return ['.js', '.ts'].includes(path.extname(file_path));
  }

  private convertToHonoRoute(filePath: string): string {
    const routeName = path.basename(filePath, path.extname(filePath));
    if (routeName === 'hibana' || routeName.startsWith('_')) return '';
    const isIndexFile = routeName === 'index';
    const relativePath = path.relative(this.default_dir, filePath);
    const dirPath = path.dirname(relativePath);
    const pathSegments = dirPath
      .split(path.sep)
      .map(RouteParser.parseSegment)
      .filter(Boolean);

    let finalRouteNamePart = isIndexFile ? '' : routeName;
    if (finalRouteNamePart && !finalRouteNamePart.startsWith('/')) {
      finalRouteNamePart = `/${finalRouteNamePart}`;
    }

    let routePath = `/${pathSegments.join('/')}${finalRouteNamePart}`
      .replace(/\/+/g, '/')
      .replace(/\/$/, '');

    if (
      filePath === path.join(this.default_dir, 'index.ts') ||
      filePath === path.join(this.default_dir, 'index.js')
    ) {
      routePath = '/';
    } else if (routePath === '') {
      routePath = '/';
    }
    return routePath.replace(/\[(\w+)\]/g, ':$1');
  }

  private async build_routes(
    directory: string = this.default_dir
  ): Promise<void> {
    const ignoredDirs = ['dist', 'static', 'public', 'node_modules'];
    if (
      ignoredDirs.some((dir) => directory.includes(dir)) ||
      path.basename(directory).startsWith('.')
    ) {
      return;
    }

    if (!fs.existsSync(directory)) {
      return;
    }
    if (directory === this.default_dir && !fs.existsSync(this.default_dir)) {
      console.log(`Creating routes directory: ${this.default_dir}`);
      fs.mkdirSync(this.default_dir, { recursive: true });
    }
    if (
      directory === this.default_dir &&
      !fs.existsSync(this.default_middleware_dir)
    ) {
      console.log(
        `Creating middleware directory: ${this.default_middleware_dir}`
      );
      fs.mkdirSync(this.default_middleware_dir, { recursive: true });
    }

    const files = fs.readdirSync(directory);
    for (const file of files) {
      const file_path = path.join(directory, file);
      try {
        const stat = fs.statSync(file_path);
        if (stat.isDirectory()) {
          await this.handleDirectory(file_path);
        } else if (this.is_valid_file(file_path) && stat.size > 0) {
          await this.handleFile(file_path);
        }
      } catch (error: any) {
        // console.warn(`[Sumi Router] Warning processing ${file_path}: ${error.message}`);
      }
    }
  }

  private async handleDirectory(dirPath: string): Promise<void> {
    await this.build_routes(dirPath); // Await the recursive call
    const indexExtensions = ['.ts', '.js'];
    for (const ext of indexExtensions) {
      const indexPath = path.join(dirPath, `index${ext}`);
      if (fs.existsSync(indexPath) && this.is_valid_file(indexPath)) {
        // Check if file has content before processing
        const stat = fs.statSync(indexPath);
        if (stat.size > 0) {
          await this.processRouteFile(indexPath);
        }
        break;
      }
    }
  }

  private async handleFile(filePath: string): Promise<void> {
    const baseName = path.basename(filePath);

    // Middleware files (e.g., _index.ts, _middleware.ts) are not routes
    // and are handled by the MiddlewareHandler.
    if (baseName.startsWith('_')) {
      return;
    }

    // Index files within subdirectories (e.g., routes/api/index.ts)
    // are handled by the handleDirectory method for that subdirectory.
    // The root index file (e.g., routes/index.ts) should be processed by this method.
    const isIndexInSubdirectory =
      baseName.startsWith('index.') &&
      path.dirname(filePath) !== this.default_dir;

    if (isIndexInSubdirectory) {
      return;
    }

    await this.processRouteFile(filePath);
  }

  private async processRouteFile(filePath: string): Promise<void> {
    let routeModule;
    const relativeFilePath = path.relative(process.cwd(), filePath);
    try {
      routeModule = await import(`${filePath}?v=${Date.now()}`);
      if (!routeModule.default) {
        console.warn(`[Sumi Router] No default export: ${relativeFilePath}.`);
        return;
      }
    } catch (error) {
      console.error(`[Sumi Router] Error loading ${relativeFilePath}:`, error);
      return;
    }

    const routeDefinition: RouteDefinition = routeModule.default;
    const route_path = this.convertToHonoRoute(filePath);
    if (!route_path) return; // Skips if convertToHonoRoute decided it (e.g. for _ files if they ever got here)

    const currentFileDir = path.dirname(filePath);
    if (!this.processedPaths.has(currentFileDir)) {
      this.middlewareHandler.applyMiddleware(currentFileDir, route_path);
      this.processedPaths.add(currentFileDir);
    }

    Object.keys(routeDefinition).forEach((method) => {
      const methodKey = method as keyof RouteDefinition;
      const methodDefinition = routeDefinition[methodKey];
      let userHandler:
        | RouteHandler
        | MiddlewareHandlerFunction
        | ((c: ValidationContext<any>) => Response | Promise<Response>)
        | ((c: ValidationContext<any>, next: Next) => Promise<void | Response>);
      let validationSchemas: ValidationSchemaMap | undefined;

      if (!methodDefinition) return;

      if (typeof methodDefinition === 'function') {
        userHandler = methodDefinition;
        validationSchemas = undefined;
      } else if (
        typeof methodDefinition === 'object' &&
        methodDefinition.handler &&
        typeof methodDefinition.handler === 'function'
      ) {
        // This now uses RouteConfig instead of ProcessedRouteMethodConfig
        const processedConfig = methodDefinition as RouteConfig<any>;
        userHandler = processedConfig.handler;
        validationSchemas = processedConfig.schema;
      } else {
        if (method !== '_') {
          console.warn(
            `[Sumi Router] Invalid route structure for method "${String(
              method
            )}" in ${relativeFilePath}. Ensure it's a function or an object with a handler.`
          );
        }
        return;
      }

      const routeKey = `${method.toUpperCase()}:${route_path}`;
      if (this.uniqueRoutes.has(routeKey) && method !== '_') {
        return;
      }
      this.uniqueRoutes.add(routeKey);

      const middlewaresToApply: any[] = [];
      if (validationSchemas) {
        const validators = SumiValidator.createValidators(validationSchemas);
        if (validators.length > 0) middlewaresToApply.push(...validators);
      }

      try {
        // Pass the original method string here
        this.applyRouteMethod(
          method,
          route_path,
          ...middlewaresToApply,
          userHandler
        );
      } catch (error) {
        console.error(
          `[Sumi Router] Error applying ${method.toUpperCase()} for ${route_path} from ${relativeFilePath}:`,
          error
        );
      }
    });
  }

  private applyRouteMethod(
    method: string,
    routePath: string,
    ...handlers: any[]
  ): void {
    const honoMethod = method.toLowerCase() as keyof Hono;
    if (typeof this.app[honoMethod] === 'function') {
      (this.app[honoMethod] as Function)(routePath, ...handlers);
    } else if (method === '_') {
      this.app.use(routePath, ...handlers);
    } else {
      console.warn(
        `[Sumi Router] Unknown Hono method "${method}" for route "${routePath}".`
      );
    }
  }

  private clearRoutesAndMiddleware(): void {
    // Create a new Hono instance to effectively clear routes
    const newApp = new Hono();
    if (this.app_base_path) {
      this.app = newApp.basePath(this.app_base_path);
    } else {
      this.app = newApp;
    }

    // Reset middleware handler with the new app instance
    this.middlewareHandler.reset(this.app);

    this.staticConfig.forEach((config) => {
      if (config.path && config.root) {
        this.app.use(config.path, serveStatic({ root: config.root }));
      }
    });

    // Re-apply error handler to the new app instance
    this.app.onError((err, c: HonoContext) => {
      ErrorHandler.handleError(
        err,
        `Request to ${c.req.path} by ${c.req.method}`
      );
      return c.json(
        { error: 'Internal Server Error', message: err.message },
        500
      );
    });

    this.processedPaths.clear();
    this.uniqueRoutes.clear();
  }

  private generateServerInfo(): string {
    return `
🔥 Sumi v1.0 is burning hot and ready to serve! Routes: ${
      this.uniqueRoutes.size
    } route(s) registered\n
Server running on port ${this.config_port}
usage: curl -X GET http://localhost:${this.config_port}${
      this.app_base_path && this.app_base_path
    }
    `;
  }

  async burn(port?: number): Promise<void> {
    try {
      // Use provided port or fall back to config port
      const serverPort = port || this.config_port;

      if (process.env.NODE_ENV !== 'test') {
        console.clear();

        await this.build_routes();
        // Setup hot reload watcher
        startFileWatcher(
          this.default_middleware_dir,
          this.default_dir,
          async () => {
            // Kill current server if it exists
            if (this.server) {
              try {
                this.server.stop();
                this.server = null;
              } catch (err) {
                console.error('[Sumi Reloader] Error stopping server:', err);
              }
            }

            console.log(this.generateServerInfo());
          }
        );

        // Start server if port is provided
        if (serverPort) {
          this.server = Bun.serve({
            port: serverPort,
            fetch: this.fetch(),
          });
        }
      } else {
        // For test environment, just build routes without starting a server
        this.clearRoutesAndMiddleware();
        this.middlewareHandler.applyGlobalMiddleware();
        await this.build_routes();
      }

      console.log(this.generateServerInfo());
    } catch (error) {
      console.error('Error during burn():', error);
      throw error;
    }
  }

  fetch() {
    if (!this.app) {
      console.error('[Sumi Fetch] Hono app instance not found.');
      return async (_req: Request) =>
        new Response('Sumi app not initialized', { status: 500 });
    }
    return this.app.fetch.bind(this.app);
  }
}

// --- Configuration Helper ---
import { SumiConfig } from './types';

export function defineConfig(config: SumiConfig): SumiConfig {
  return config;
}

export type {
  SumiConfig as SumiAppConfig,
  StaticRouteConfig,
  SumiContext,
} from './types';
export type { Context as HonoContext, Next as HonoNext } from 'hono';
