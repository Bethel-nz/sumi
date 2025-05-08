import fs from 'fs';
import path from 'path';
import { logger } from 'hono/logger';
export class MiddlewareHandler {
    app;
    logger;
    middlewareDir;
    basePath;
    constructor(app, logger, middlewareDir, basePath) {
        this.app = app;
        this.logger = logger;
        this.middlewareDir = middlewareDir;
        this.basePath = basePath;
    }
    async applyMiddleware(directory, basePath = '/') {
        const middlewareFiles = [
            path.join(directory, '_middleware.ts'),
            path.join(directory, '_index.ts'),
        ];
        await Promise.all(middlewareFiles.map(async (filePath) => {
            if (fs.existsSync(filePath) &&
                this.isValidFile(filePath) &&
                fs.statSync(filePath).size > 0) {
                try {
                    console.log(`[Sumi Middleware] Importing middleware: ${filePath}`);
                    const middlewareModule = await import(filePath);
                    if (middlewareModule.default &&
                        typeof middlewareModule.default._ === 'function') {
                        const middlewareDef = middlewareModule.default;
                        const handler = middlewareDef._;
                        console.log(`[Sumi Middleware] Applying route middleware from ${filePath} to ${basePath}/*`);
                        this.app.use(`${basePath}/*`, handler);
                    }
                    else {
                        console.warn(`[Sumi Middleware] Invalid export structure in ${filePath}. Expected export default { _: function }. Skipping.`);
                    }
                }
                catch (error) {
                    console.error(`[Sumi Middleware] Error loading middleware file ${filePath}:`, error);
                }
            }
        }));
    }
    async applyGlobalMiddleware() {
        if (fs.existsSync(this.middlewareDir)) {
            const files = fs.readdirSync(this.middlewareDir);
            await Promise.all(files.map(async (file) => {
                const filePath = path.join(this.middlewareDir, file);
                if (this.isValidFile(filePath) &&
                    this.isMiddlewareFile(file, this.middlewareDir) &&
                    fs.statSync(filePath).size > 0) {
                    try {
                        console.log(`[Sumi Middleware] Importing global middleware: ${filePath}`);
                        const middlewareModule = await import(filePath);
                        if (middlewareModule.default &&
                            typeof middlewareModule.default._ === 'function') {
                            const middlewareDef = middlewareModule.default;
                            const handler = middlewareDef._;
                            console.log(`[Sumi Middleware] Applying global middleware from ${filePath}`);
                            this.app.use('*', handler);
                        }
                        else {
                            console.warn(`[Sumi Middleware] Invalid export structure in ${filePath}. Expected export default { _: function }. Skipping.`);
                        }
                    }
                    catch (error) {
                        console.error(`[Sumi Middleware] Error loading global middleware file ${filePath}:`, error);
                    }
                }
            }));
        }
        if (this.logger) {
            console.log(`[Sumi Middleware] Applying Hono logger globally.`);
            this.app.use('*', logger());
        }
    }
    async reset(newApp) {
        this.app = newApp;
        await this.applyGlobalMiddleware();
        console.log('[Sumi Reloader] MiddlewareHandler reset with new app instance.');
    }
    isValidFile(filePath) {
        return ['.js', '.ts'].includes(path.extname(filePath));
    }
    isMiddlewareFile(fileName, directory) {
        return ((fileName.includes('_middleware') ||
            fileName.includes('_index') ||
            fileName.startsWith('_')) &&
            directory === this.middlewareDir);
    }
}
