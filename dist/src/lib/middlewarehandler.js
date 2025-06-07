import fs from 'fs';
import path from 'path';
import { logger } from 'hono/logger';
export class MiddlewareHandler {
    app;
    logger;
    middlewareDir;
    basePath;
    appliedMiddleware = new Map();
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
            // Check if middleware is already applied to this route pattern
            if (!this.appliedMiddleware.has(filePath)) {
                this.appliedMiddleware.set(filePath, new Set());
            }
            const routePattern = `${basePath}/*`;
            if (this.appliedMiddleware.get(filePath)?.has(routePattern)) {
                // Skip silently
                return;
            }
            if (fs.existsSync(filePath) &&
                this.isValidFile(filePath) &&
                fs.statSync(filePath).size > 0) {
                try {
                    const middlewareModule = await import(filePath);
                    if (middlewareModule.default &&
                        typeof middlewareModule.default._ === 'function') {
                        const middlewareDef = middlewareModule.default;
                        const handler = middlewareDef._;
                        this.app.use(routePattern, handler);
                        this.appliedMiddleware.get(filePath)?.add(routePattern);
                    }
                    else {
                        console.warn(`Invalid middleware structure in ${path.basename(filePath)}. Expected { _: function }.`);
                    }
                }
                catch (error) {
                    console.error(`Error loading middleware: ${path.basename(filePath)}:`, error);
                }
            }
        }));
    }
    async applyGlobalMiddleware() {
        if (fs.existsSync(this.middlewareDir)) {
            const files = fs.readdirSync(this.middlewareDir);
            await Promise.all(files.map(async (file) => {
                const filePath = path.join(this.middlewareDir, file);
                const routePattern = '*';
                // Check if middleware is already applied to this route pattern
                if (!this.appliedMiddleware.has(filePath)) {
                    this.appliedMiddleware.set(filePath, new Set());
                }
                if (this.appliedMiddleware.get(filePath)?.has(routePattern)) {
                    // Skip silently
                    return;
                }
                if (this.isValidFile(filePath) &&
                    this.isMiddlewareFile(file, this.middlewareDir) &&
                    fs.statSync(filePath).size > 0) {
                    try {
                        const middlewareModule = await import(filePath);
                        if (middlewareModule.default &&
                            typeof middlewareModule.default._ === 'function') {
                            const middlewareDef = middlewareModule.default;
                            const handler = middlewareDef._;
                            this.app.use(routePattern, handler);
                            this.appliedMiddleware.get(filePath)?.add(routePattern);
                        }
                        else {
                            console.warn(`Invalid middleware structure in ${file}. Expected { _: function }.`);
                        }
                    }
                    catch (error) {
                        console.error(`Error loading global middleware: ${file}:`, error);
                    }
                }
            }));
        }
        if (this.logger) {
            this.app.use('*', logger());
        }
    }
    async reset(newApp) {
        this.app = newApp;
        this.appliedMiddleware.clear();
        await this.applyGlobalMiddleware();
        console.log('MiddlewareHandler reset with new app instance.');
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
