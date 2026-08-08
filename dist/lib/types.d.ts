import { Context, HonoRequest } from 'hono';
import { z, ZodSchema, ZodObject } from 'zod';
import { ApiReferenceConfiguration } from '@scalar/hono-api-reference';
import { OpenApiSpecsOptions } from 'hono-openapi';
type CorsOptions = any;
export type ValidationTarget = 'json' | 'form' | 'query' | 'param' | 'header' | 'cookie';
export type StaticRouteConfig = {
    path: string;
    root: string;
};
export interface EnvConfig<T extends Record<string, ZodSchema>> {
    schema: T;
    required?: (keyof T)[];
}
export type ValidatedEnv<T extends Record<string, ZodSchema>> = {
    [K in keyof T]: T[K] extends z.ZodType<infer U> ? U : any;
};
/**
 * Return type for hooks that can take over the response.
 *
 * Return nothing to let the request continue as normal, or return a `Response`
 * to short-circuit: `onRequest` skips the route handler, `onResponse` replaces
 * the handler's response, and `onError` replaces the default 500 body.
 */
export type HookResponse = Promise<Response | void> | Response | void;
export interface SumiHooks {
    onReady?: () => Promise<void> | void;
    onShutdown?: () => Promise<void> | void;
    onRequest?: (c: Context) => HookResponse;
    onResponse?: (c: Context) => HookResponse;
    onError?: (error: Error, c: Context) => HookResponse;
    onFileChange?: (filePath: string, eventType: 'add' | 'change' | 'unlink') => Promise<void> | void;
    onReload?: () => Promise<void> | void;
    onReloadComplete?: () => Promise<void> | void;
    onRouteRegistered?: (method: string, path: string) => Promise<void> | void;
    onMiddlewareRegistered?: (path: string) => Promise<void> | void;
    onBuild?: () => Promise<void> | void;
    onTest?: () => Promise<void> | void;
}
export type DocsConfig = Omit<Partial<ApiReferenceConfiguration>, 'url'> & {
    path?: string;
};
export type OpenApiConfig = OpenApiSpecsOptions;
export type SumiConfig = {
    app?: import('hono').Hono;
    /** Enable Hono request logger. Defaults to false. */
    logger?: boolean;
    basePath?: string;
    middlewareDir?: string;
    routesDir?: string;
    /** Server port. Defaults to 3000. */
    port?: number;
    static?: StaticRouteConfig[];
    openapi?: OpenApiConfig;
    docs?: DocsConfig;
    hooks?: SumiHooks;
    env?: EnvConfig<any>;
    /** CORS options forwarded to hono/cors. Set to `true` for permissive defaults. */
    cors?: CorsOptions | true;
    /** Attach a unique x-request-id header to every request. */
    requestId?: boolean;
    /**
     * Auto-mount a health check endpoint.
     * Defaults to path '/healthz'. Override with `{ path: '/health' }`.
     */
    healthCheck?: boolean | {
        path?: string;
        metadata?: Record<string, unknown>;
    };
    /** Global rate limiting via hono-rate-limiter. */
    rateLimit?: {
        windowMs: number;
        limit: number;
        keyGenerator?: (c: import('hono').Context) => string;
    };
    /**
     * When true, Sumi will throw an error at startup if a route references
     * a middleware file that does not exist. Defaults to false (warns and skips).
     */
    strict?: boolean;
};
export type SumiContext = Context & {
    env: any;
    validatedEnv: any;
};
export type TypedValid<T extends Record<string, ZodSchema | ZodObject<{}>>> = {
    <K extends keyof T & ValidationTarget>(target: K): z.infer<T[K]>;
};
export type TypedRequest<T extends Record<string, ZodSchema | ZodObject<{}>>> = {
    valid: TypedValid<T>;
} & HonoRequest;
export {};
