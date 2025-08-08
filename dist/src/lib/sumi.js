// sumi.ts
import fs from 'fs';
import path from 'path';
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
// NEW OpenAPI imports
import { generateSpecs, describeRoute } from 'hono-openapi';
import { validator as zValidator } from 'hono-openapi/zod';
import { Scalar } from '@scalar/hono-api-reference';
import { RouteParser } from './RouteParser';
import { MiddlewareHandler } from './middlewarehandler';
import { ErrorHandler } from './errorHandler';
export class Sumi {
    app;
    default_dir;
    default_middleware_dir;
    middlewareHandler;
    app_base_path;
    logger;
    processedPaths = new Set();
    uniqueRoutes = new Set();
    staticConfig = [];
    server = null;
    config_port;
    openapiConfig;
    docsConfig;
    hooks;
    validatedEnv = {};
    openApiSetup = false; // Add this to track OpenAPI setup
    constructor(default_args) {
        this.app = default_args.app || new Hono();
        this.config_port = default_args.port;
        this.openapiConfig = default_args.openapi;
        this.docsConfig = default_args.docs || {};
        this.hooks = default_args.hooks || {};
        if (default_args.basePath) {
            this.app_base_path = default_args.basePath;
            this.app = this.app.basePath(this.app_base_path);
        }
        this.logger = default_args.logger;
        this.staticConfig = default_args.static || [];
        this.default_middleware_dir = default_args.middlewareDir
            ? path.resolve(default_args.middlewareDir)
            : path.resolve('middleware'); // FIX: Remove 'routes/' prefix
        this.default_dir = default_args.routesDir
            ? path.resolve(default_args.routesDir)
            : path.resolve('routes');
        this.middlewareHandler = new MiddlewareHandler(this.app, this.logger, this.default_middleware_dir, this.app_base_path);
        // FIX: Don't apply global middleware in constructor
        // this.middlewareHandler.applyGlobalMiddleware();
        this.staticConfig.forEach((config) => {
            if (config.path && config.root) {
                this.app.use(config.path, serveStatic({ root: config.root }));
            }
        });
        // Validate environment variables if config provided
        if (default_args.env) {
            this.validatedEnv = this.validateEnvironment(default_args.env);
        }
        // Add env middleware to make validated env available in context
        this.app.use('*', async (c, next) => {
            // Use c.var to store custom variables
            c.env = this.validatedEnv;
            await next();
        });
        // OpenAPI endpoints will be added after routes are built
        // Set up global request/response hooks
        if (this.hooks.onRequest) {
            this.app.use('*', async (c, next) => {
                await this.hooks.onRequest?.(c);
                await next();
            });
        }
        if (this.hooks.onResponse) {
            this.app.use('*', async (c, next) => {
                await next();
                await this.hooks.onResponse?.(c);
            });
        }
        // Enhanced error handler with hook
        this.app.onError(async (err, c) => {
            if (this.hooks.onError) {
                await this.hooks.onError(err, c);
            }
            ErrorHandler.handleError(err, `Request to ${c.req.path} by ${c.req.method}`);
            return c.json({ error: 'Internal Server Error', message: err.message }, 500);
        });
    }
    is_valid_file(file_path) {
        return ['.js', '.ts'].includes(path.extname(file_path));
    }
    convertToHonoRoute(filePath) {
        const routeName = path.basename(filePath, path.extname(filePath));
        if (routeName.startsWith('_'))
            return '';
        const isIndexFile = routeName === 'index';
        const relativePath = path.relative(this.default_dir, filePath);
        const dirPath = path.dirname(relativePath);
        // Split path and parse segments, filtering out '.' for current directory
        const pathSegments = dirPath
            .split(path.sep)
            .filter((segment) => segment !== '.' && segment !== '')
            .map(RouteParser.parseSegment);
        // For index files, don't add the filename to the route
        // For other files, add the filename as the last segment
        const finalRouteNamePart = isIndexFile
            ? ''
            : RouteParser.parseSegment(routeName);
        // Build the route path
        const allSegments = [...pathSegments, finalRouteNamePart].filter(Boolean);
        let routePath = allSegments.length > 0 ? `/${allSegments.join('/')}` : '/';
        // Special case for root index file
        if (filePath === path.join(this.default_dir, 'index.ts') ||
            filePath === path.join(this.default_dir, 'index.js')) {
            routePath = '/';
        }
        return routePath.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    }
    async build_routes(directory = this.default_dir) {
        const ignoredDirs = ['dist', 'static', 'public', 'node_modules'];
        if (ignoredDirs.some((dir) => directory.includes(dir)) ||
            path.basename(directory).startsWith('.')) {
            return;
        }
        if (!fs.existsSync(directory)) {
            return;
        }
        if (directory === this.default_dir && !fs.existsSync(this.default_dir)) {
            console.log(`Creating routes directory: ${this.default_dir}`);
            fs.mkdirSync(this.default_dir, { recursive: true });
        }
        if (directory === this.default_dir &&
            !fs.existsSync(this.default_middleware_dir)) {
            console.log(`Creating middleware directory: ${this.default_middleware_dir}`);
            fs.mkdirSync(this.default_middleware_dir, { recursive: true });
        }
        const files = fs.readdirSync(directory);
        // First, process all directories recursively
        for (const file of files) {
            const file_path = path.join(directory, file);
            try {
                const stat = fs.statSync(file_path);
                if (stat.isDirectory()) {
                    await this.build_routes(file_path);
                }
            }
            catch (error) {
                // Silently skip problematic directories
            }
        }
        // Then, process all files in current directory
        for (const file of files) {
            const file_path = path.join(directory, file);
            try {
                const stat = fs.statSync(file_path);
                if (!stat.isDirectory() &&
                    this.is_valid_file(file_path) &&
                    stat.size > 0) {
                    await this.handleFile(file_path);
                }
            }
            catch (error) {
                // Silently skip problematic files
            }
        }
    }
    async handleFile(filePath) {
        const baseName = path.basename(filePath);
        // Skip middleware files
        if (baseName.startsWith('_')) {
            return;
        }
        await this.processRouteFile(filePath);
    }
    async resolveMiddleware(middlewareName) {
        // Look for middleware in the middleware directory
        const middlewarePath = path.join(this.default_middleware_dir, `${middlewareName}.ts`);
        const jsMiddlewarePath = path.join(this.default_middleware_dir, `${middlewareName}.js`);
        let finalPath = middlewarePath;
        if (!fs.existsSync(middlewarePath) && fs.existsSync(jsMiddlewarePath)) {
            finalPath = jsMiddlewarePath;
        }
        if (!fs.existsSync(finalPath)) {
            console.warn(`[Sumi Router] Middleware "${middlewareName}" not found at ${finalPath}`);
            return null;
        }
        try {
            const middlewareModule = await import(`${finalPath}?v=${Date.now()}`);
            if (middlewareModule.default &&
                typeof middlewareModule.default === 'function') {
                return middlewareModule.default;
            }
            else if (middlewareModule.default &&
                typeof middlewareModule.default._ === 'function') {
                // Handle createMiddleware format
                return middlewareModule.default._;
            }
            else {
                console.warn(`[Sumi Router] Invalid middleware structure in ${middlewareName}. Expected function or { _: function }.`);
                return null;
            }
        }
        catch (error) {
            console.error(`[Sumi Router] Error loading middleware "${middlewareName}":`, error);
            return null;
        }
    }
    async processRouteFile(filePath) {
        let routeModule;
        const relativeFilePath = path.relative(process.cwd(), filePath);
        try {
            routeModule = await import(`${filePath}?v=${Date.now()}`);
            if (!routeModule.default) {
                console.warn(`[Sumi Router] No default export: ${relativeFilePath}.`);
                return;
            }
        }
        catch (error) {
            console.error(`[Sumi Router] Error loading ${relativeFilePath}:`, error);
            return;
        }
        const routeDefinition = routeModule.default;
        const route_path = this.convertToHonoRoute(filePath);
        if (!route_path)
            return;
        // Apply directory-based middleware only once per directory
        const currentFileDir = path.dirname(filePath);
        if (!this.processedPaths.has(currentFileDir)) {
            await this.middlewareHandler.applyMiddleware(currentFileDir, route_path);
            this.processedPaths.add(currentFileDir);
        }
        for (const [method, methodConfig] of Object.entries(routeDefinition)) {
            if (!methodConfig)
                continue;
            const routeKey = `${method.toUpperCase()}:${route_path}`;
            // Prevent duplicate route registration
            if (this.uniqueRoutes.has(routeKey)) {
                console.warn(`[Sumi Router] Duplicate route detected: ${routeKey}, skipping...`);
                continue;
            }
            this.uniqueRoutes.add(routeKey);
            const middlewareChain = [];
            let userHandler;
            if (typeof methodConfig === 'function') {
                userHandler = methodConfig;
            }
            else if (typeof methodConfig === 'object' && methodConfig.handler) {
                userHandler = methodConfig.handler;
                // Add OpenAPI Description Middleware
                if (methodConfig.openapi) {
                    middlewareChain.push(describeRoute(methodConfig.openapi));
                }
                // Add Route-Specific Middleware
                if (methodConfig.middleware && Array.isArray(methodConfig.middleware)) {
                    for (const middlewareName of methodConfig.middleware) {
                        const middleware = await this.resolveMiddleware(middlewareName);
                        if (middleware) {
                            middlewareChain.push(middleware);
                        }
                    }
                }
                // Add validation middleware
                if (methodConfig.schema) {
                    for (const [target, schema] of Object.entries(methodConfig.schema)) {
                        if (schema && typeof schema === 'object' && '_def' in schema) {
                            middlewareChain.push(zValidator(target, schema));
                        }
                    }
                }
            }
            else {
                continue; // Invalid config for this method
            }
            // Add the User's Handler at the end of the chain
            middlewareChain.push(userHandler);
            // Apply the entire chain to the Hono app
            this.applyRouteMethod(method, route_path, ...middlewareChain);
            // Call route registered hook for each method
            if (method !== '_' && this.hooks.onRouteRegistered) {
                this.hooks.onRouteRegistered(method, route_path);
            }
        }
    }
    applyRouteMethod(method, routePath, ...handlers) {
        const honoMethod = method.toLowerCase();
        // Remove debug logging
        // console.log(`[DEBUG] Registering ${method.toUpperCase()} ${routePath}`);
        if (typeof this.app[honoMethod] === 'function') {
            this.app[honoMethod](routePath, ...handlers);
        }
        else if (method === '_') {
            this.app.use(routePath, ...handlers);
        }
        else {
            console.warn(`[Sumi Router] Unknown Hono method "${method}" for route "${routePath}".`);
        }
    }
    clearRoutesAndMiddleware() {
        // Create a new Hono instance to effectively clear routes
        const newApp = new Hono();
        if (this.app_base_path) {
            this.app = newApp.basePath(this.app_base_path);
        }
        else {
            this.app = newApp;
        }
        // Reset middleware handler with the new app instance
        this.middlewareHandler.reset(this.app);
        // Re-apply static routes
        this.staticConfig.forEach((config) => {
            if (config.path && config.root) {
                this.app.use(config.path, serveStatic({ root: config.root }));
            }
        });
        // Re-apply environment middleware
        this.app.use('*', async (c, next) => {
            c.env = this.validatedEnv;
            await next();
        });
        // Re-apply hooks
        if (this.hooks.onRequest) {
            this.app.use('*', async (c, next) => {
                await this.hooks.onRequest?.(c);
                await next();
            });
        }
        if (this.hooks.onResponse) {
            this.app.use('*', async (c, next) => {
                await next();
                await this.hooks.onResponse?.(c);
            });
        }
        // Re-apply error handler to the new app instance
        this.app.onError(async (err, c) => {
            if (this.hooks.onError) {
                await this.hooks.onError(err, c);
            }
            ErrorHandler.handleError(err, `Request to ${c.req.path} by ${c.req.method}`);
            return c.json({ error: 'Internal Server Error', message: err.message }, 500);
        });
        // Clear tracking sets
        this.processedPaths.clear();
        this.uniqueRoutes.clear();
        this.openApiSetup = false; // Reset OpenAPI setup flag
    }
    generateServerInfo() {
        const baseUrl = `http://localhost:${this.config_port}${this.app_base_path || ''}`;
        let info = `
🔥 Sumi v1.0 is burning hot and ready to serve! Routes: ${this.uniqueRoutes.size} route(s) registered

Server running on port ${this.config_port}
usage: curl -X GET ${baseUrl}`;
        // Add documentation endpoints if available
        if (this.openapiConfig || this.docsConfig) {
            info += `\n\n📚 Documentation:`;
            // Add docs endpoint
            const docsPath = this.docsConfig?.path || '/docs';
            info += `\n  • API Docs: ${baseUrl}${docsPath}`;
            // Add OpenAPI JSON endpoint
            info += `\n  • OpenAPI Spec: ${baseUrl}/openapi.json`;
        }
        return info + '\n';
    }
    setupOpenAPIEndpoints() {
        // Prevent double setup
        if (this.openApiSetup) {
            return;
        }
        if (!this.openapiConfig && !this.docsConfig)
            return;
        const docOptions = {
            documentation: this.openapiConfig || {
                info: {
                    title: 'Sumi API',
                    version: '1.0.0',
                    description: 'API built with Sumi 🔥',
                },
                openapi: '3.1.0',
            },
        };
        // Register OpenAPI JSON endpoint
        this.app.get('/openapi.json', async (c) => {
            try {
                const spec = await generateSpecs(this.app, docOptions);
                return c.json(spec);
            }
            catch (error) {
                console.error('Error generating OpenAPI specs:', error);
                return c.json({ error: 'Failed to generate OpenAPI specs' }, 500);
            }
        });
        // Register Scalar documentation endpoint
        const docsPath = this.docsConfig?.path || '/docs';
        const theme = this.docsConfig?.theme || 'purple';
        const pageTitle = this.docsConfig?.pageTitle || 'Sumi API Documentation';
        this.app.get(docsPath, Scalar({
            url: this.app_base_path
                ? `${this.app_base_path}/openapi.json`
                : '/openapi.json',
            theme,
            pageTitle,
        }));
        this.openApiSetup = true; // Mark as setup
    }
    async burn(port) {
        try {
            // Use provided port or fall back to config port
            const serverPort = port || this.config_port;
            if (process.env.NODE_ENV !== 'test') {
                // Only clear console on first run, not on hot reloads
                if (!global.__SUMI_STARTED) {
                    console.clear();
                    global.__SUMI_STARTED = true;
                }
                // Clear and rebuild routes
                this.clearRoutesAndMiddleware();
                await this.middlewareHandler.applyGlobalMiddleware(); // Apply global middleware once here
                await this.build_routes();
                this.setupOpenAPIEndpoints();
                // Call onReady hook before starting server
                if (this.hooks.onReady) {
                    await this.hooks.onReady();
                }
                // Stop existing server before starting new one
                if (this.server) {
                    this.server.stop(true);
                    this.server = null;
                }
                // Start server if port is provided
                if (serverPort) {
                    this.server = Bun.serve({
                        port: serverPort,
                        fetch: this.fetch(),
                        development: true,
                    });
                }
            }
            else {
                // For test environment, just build routes without starting a server
                this.clearRoutesAndMiddleware();
                await this.middlewareHandler.applyGlobalMiddleware(); // Apply global middleware once here
                await this.build_routes();
                this.setupOpenAPIEndpoints();
            }
            // Log server info
            console.log(this.generateServerInfo());
        }
        catch (error) {
            console.error('Error during burn():', error);
            throw error;
        }
    }
    fetch() {
        if (!this.app) {
            console.error('[Sumi Fetch] Hono app instance not found.');
            return async (_req) => new Response('Sumi app not initialized', { status: 500 });
        }
        return this.app.fetch.bind(this.app);
    }
    validateEnvironment(envConfig) {
        const { schema, required = [] } = envConfig;
        const result = {};
        const errors = [];
        for (const [key, zodSchema] of Object.entries(schema)) {
            const envValue = process.env[key];
            if (required.includes(key) &&
                process.env.NODE_ENV === 'production' &&
                !envValue) {
                errors.push(`Environment variable ${key} is required in production`);
                continue;
            }
            try {
                result[key] = zodSchema.parse(envValue);
            }
            catch (error) {
                if (envValue !== undefined) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    errors.push(`Invalid environment variable ${key}: ${errorMessage}`);
                }
                else if (required.includes(key)) {
                    errors.push(`Missing required environment variable: ${key}`);
                }
                try {
                    result[key] = zodSchema.parse(undefined);
                }
                catch {
                    // No default available
                }
            }
        }
        if (errors.length > 0) {
            console.error('🚨 Environment validation errors:');
            errors.forEach((error) => console.error(`  - ${error}`));
            if (process.env.NODE_ENV === 'production') {
                process.exit(1);
            }
        }
        return result;
    }
    async shutdown() {
        if (this.hooks.onShutdown) {
            await this.hooks.onShutdown();
        }
        if (this.server) {
            this.server.stop();
        }
    }
}
export function defineConfig(config) {
    return config;
}
