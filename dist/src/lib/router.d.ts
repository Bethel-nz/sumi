import { Context, Next } from 'hono';
import { z, ZodSchema } from 'zod';
export interface ValidationSchemaMap {
    json?: ZodSchema;
    form?: ZodSchema;
    query?: ZodSchema;
    param?: ZodSchema;
    header?: ZodSchema;
    cookie?: ZodSchema;
}
export type ValidatedData<T extends ValidationSchemaMap> = {
    [K in keyof T]?: T[K] extends ZodSchema ? z.infer<T[K]> : unknown;
};
export type ValidationContext<T extends ValidationSchemaMap = ValidationSchemaMap> = Context & {
    valid: ValidatedData<T>;
};
export interface RouteDefinition {
    get?: RouteHandler | ((c: ValidationContext<any>) => Response | Promise<Response>) | RouteConfig<any>;
    post?: RouteHandler | ((c: ValidationContext<any>) => Response | Promise<Response>) | RouteConfig<any>;
    put?: RouteHandler | ((c: ValidationContext<any>) => Response | Promise<Response>) | RouteConfig<any>;
    delete?: RouteHandler | ((c: ValidationContext<any>) => Response | Promise<Response>) | RouteConfig<any>;
    patch?: RouteHandler | ((c: ValidationContext<any>) => Response | Promise<Response>) | RouteConfig<any>;
    _?: MiddlewareHandler | ((c: ValidationContext<any>, next: Next) => Promise<void | Response>) | RouteConfig<any>;
}
export type RouteHandler = (c: Context) => Response | Promise<Response>;
export type MiddlewareHandler = (c: Context, next: Next) => Promise<void | Response>;
export type TypedRouteHandler<T extends ValidationSchemaMap> = (c: ValidationContext<T>) => Response | Promise<Response>;
export interface RouteConfig<T extends ValidationSchemaMap> {
    schema: T;
    handler: TypedRouteHandler<T>;
}
export interface TypedRouteConfig<T extends ValidationSchemaMap> {
    schema: T;
    handler: TypedRouteHandler<T>;
}
export interface MiddlewareConfig {
    schema: ValidationSchemaMap;
    handler: MiddlewareHandler;
}
/**
 * Creates a route definition with optional validation and type safety
 */
export declare function createRoute<T extends RouteDefinition>(config: T): T;
/**
 * Creates middleware with optional validation
 */
export declare function createMiddleware(config: {
    _: any;
}): any;
