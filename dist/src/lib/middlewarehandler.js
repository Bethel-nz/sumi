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
    applyMiddleware(directory, basePath = '/') {
        const middlewareFiles = [
            path.join(directory, '_middleware.ts'),
            path.join(directory, '_index.ts'),
        ];
        middlewareFiles.forEach((filePath) => {
            if (fs.existsSync(filePath) &&
                this.isValidFile(filePath) &&
                fs.statSync(filePath).size > 0) {
                const middleware = require(filePath).default._;
                if (typeof middleware === 'function') {
                    this.app.use(`${basePath}/*`, middleware);
                }
            }
        });
    }
    applyGlobalMiddleware() {
        if (fs.existsSync(this.middlewareDir)) {
            fs.readdirSync(this.middlewareDir).forEach((file) => {
                const filePath = path.join(this.middlewareDir, file);
                if (this.isValidFile(filePath) &&
                    this.isMiddlewareFile(file, this.middlewareDir) &&
                    fs.statSync(filePath).size > 0) {
                    const middleware = require(filePath).default._;
                    if (typeof middleware === 'function') {
                        this.app.use('*', middleware);
                    }
                }
            });
        }
        if (this.logger)
            this.app.use('*', logger());
    }
    reset(newApp) {
        // Update the internal app instance
        this.app = newApp;
        // Re-apply global middleware to the new app instance
        this.applyGlobalMiddleware();
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
