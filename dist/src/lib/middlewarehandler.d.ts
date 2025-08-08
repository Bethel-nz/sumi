import { Hono } from 'hono';
export declare class MiddlewareHandler {
    private app;
    private loggerEnabled;
    private middlewareDir;
    private appliedMiddleware;
    constructor(app: Hono, loggerEnabled: boolean, middlewareDir: string, basePath: string);
    applyMiddleware(directory: string, routePath?: string): Promise<void>;
    applyGlobalMiddleware(): Promise<void>;
    reset(newApp: Hono): Promise<void>;
    private isValidFile;
}
