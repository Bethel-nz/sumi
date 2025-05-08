import { Hono } from 'hono';
export declare class MiddlewareHandler {
    private app;
    private logger;
    private middlewareDir;
    private basePath;
    constructor(app: Hono, logger: boolean, middlewareDir: string, basePath: string);
    applyMiddleware(directory: string, basePath?: string): void;
    applyGlobalMiddleware(): void;
    reset(newApp: Hono): void;
    private isValidFile;
    private isMiddlewareFile;
}
