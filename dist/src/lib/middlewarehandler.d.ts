import { Hono } from 'hono';
export declare class MiddlewareHandler {
    private app;
    private logger;
    private middlewareDir;
    private basePath;
    private appliedMiddleware;
    constructor(app: Hono, logger: boolean, middlewareDir: string, basePath: string);
    applyMiddleware(directory: string, basePath?: string): Promise<void>;
    applyGlobalMiddleware(): Promise<void>;
    reset(newApp: Hono): Promise<void>;
    private isValidFile;
    private isMiddlewareFile;
}
