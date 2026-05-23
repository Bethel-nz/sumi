import { Context, Next } from 'hono';
import { z, ZodObject, ZodSchema } from 'zod';
import { SumiContext, ValidationTarget } from './types';
import { DescribeRouteOptions } from 'hono-openapi';
import type { SSEStreamingApi } from 'hono/streaming';
import type { WSContext } from 'hono/ws';
export interface ValidationSchemaMap {
    json?: ZodSchema;
    form?: ZodSchema;
    query?: ZodSchema;
    param?: ZodSchema;
    header?: ZodSchema;
    cookie?: ZodSchema;
    [key: string]: ZodSchema | undefined;
}
export type ValidatedData<T extends ValidationSchemaMap> = {
    [K in keyof T]?: T[K] extends ZodSchema ? z.infer<T[K]> : unknown;
};
export type ValidationContext<T extends Record<string, ZodSchema | ZodObject<{}>>> = Context & {
    validatedEnv: any;
    req: Context['req'] & {
        valid: <K extends keyof T & ValidationTarget>(target: K) => z.infer<T[K]>;
    };
};
export type RouteHandler = (c: Context) => Response | Promise<Response>;
export type MiddlewareHandler = (c: Context, next: Next) => Promise<void | Response>;
export type TypedRouteHandler<T extends ValidationSchemaMap> = (c: Context & {
    validatedEnv: any;
    req: Context['req'] & {
        valid: <K extends keyof T & ValidationTarget>(target: K) => T[K] extends ZodSchema ? z.infer<T[K]> : any;
    };
}) => Response | Promise<Response>;
export type OpenApiConfig = DescribeRouteOptions;
export type SSEStreamHandler = (stream: SSEStreamingApi, c: Context) => Promise<void>;
export interface SSERouteConfig {
    stream: SSEStreamHandler;
    schema?: ValidationSchemaMap;
    middleware?: MiddlewareName[];
    openapi?: OpenApiConfig;
}
export interface WSHandler {
    onOpen?: (evt: Event, ws: WSContext<unknown>) => void | Promise<void>;
    onMessage?: (evt: MessageEvent<any>, ws: WSContext<unknown>) => void | Promise<void>;
    onClose?: (evt: CloseEvent, ws: WSContext<unknown>) => void | Promise<void>;
    onError?: (evt: Event, ws: WSContext<unknown>) => void | Promise<void>;
}
export interface WebSocketDefinition {
    /** Factory called per-connection to return the WebSocket event handlers. */
    handler: (c: Context) => WSHandler;
    middleware?: MiddlewareName[];
}
export interface RouteConfig<T extends ValidationSchemaMap> {
    schema?: T;
    handler: TypedRouteHandler<T>;
    openapi?: OpenApiConfig;
    middleware?: MiddlewareName[];
}
export interface RouteDefinition {
    get?: RouteConfig<any> | RouteHandler | SSERouteConfig;
    post?: RouteConfig<any> | RouteHandler | SSERouteConfig;
    put?: RouteConfig<any> | RouteHandler | SSERouteConfig;
    delete?: RouteConfig<any> | RouteHandler | SSERouteConfig;
    patch?: RouteConfig<any> | RouteHandler | SSERouteConfig;
    _?: RouteConfig<any> | MiddlewareHandler;
}
/**
 * A helper function that provides type-safety for route definitions.
 * It doesn't modify the configuration.
 */
export declare function createRoute<T extends RouteDefinition>(config: T): T;
export interface MiddlewareMeta {
    /** Human-readable name for debugging and tooling */
    name?: string;
    /** Optional description for documentation */
    description?: string;
}
/**
 * Helper type for declaring what context variables a middleware sets.
 * Use this to get full type safety when a middleware calls `c.set('key', value)`.
 *
 * @example
 * ```ts
 * // types.d.ts
 * declare module 'hono' {
 *   interface ContextVariableMap {
 *     userId: string;
 *     orgId: number;
 *   }
 * }
 *
 * // middleware/auth.ts
 * export default createMiddleware({
 *   _: async (c, next) => {
 *     c.set('userId', '123'); // fully typed
 *     await next();
 *   },
 * });
 * ```
 */
export type MiddlewareContext<Vars extends Record<string, unknown> = {}> = Context & {
    set: <K extends keyof Vars | string>(key: K, value: K extends keyof Vars ? Vars[K] : unknown) => void;
    get: <K extends keyof Vars | string>(key: K) => K extends keyof Vars ? Vars[K] : unknown;
};
/**
 * A helper function for defining middleware with typed context and next.
 * The generic C lets callers annotate `c` as SumiContext (or any Context
 * subtype) while still getting `next: Next` inferred automatically.
 */
export declare function createMiddleware<C extends Context = SumiContext>(config: {
    _: (c: C, next: Next) => Promise<void | Response>;
    meta?: MiddlewareMeta;
}): typeof config;
/**
 * A helper function for defining WebSockets in +ws.ts files.
 */
export declare function createWS(config: WebSocketDefinition): WebSocketDefinition;
