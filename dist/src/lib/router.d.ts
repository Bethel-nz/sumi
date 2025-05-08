import { ZodSchema } from 'zod';
import type { Next } from 'hono';
import type { SumiContext } from './types';
export type ValidationTarget = 'json' | 'form' | 'query' | 'param' | 'header' | 'cookie';
export type ValidationSchemaMap = {
    [key in ValidationTarget]?: ZodSchema;
};
export type RouteMethodConfig = {
    schema?: ValidationSchemaMap;
    handler: (c: SumiContext) => Response | Promise<Response>;
};
export interface RouteDefinition {
    get?: RouteMethodConfig | ((c: SumiContext) => Response | Promise<Response>);
    post?: RouteMethodConfig | ((c: SumiContext) => Response | Promise<Response>);
    put?: RouteMethodConfig | ((c: SumiContext) => Response | Promise<Response>);
    delete?: RouteMethodConfig | ((c: SumiContext) => Response | Promise<Response>);
    patch?: RouteMethodConfig | ((c: SumiContext) => Response | Promise<Response>);
    _?: RouteMethodConfig | ((c: SumiContext, next: Next) => Promise<void | Response>);
}
/**
 * Type helper for defining Sumi routes with optional schema validation.
 * Enforces the structure for route definitions and provides type checking.
 * @param definition The route definition object.
 * @returns The same definition object, used for type inference.
 */
export declare function createRoute<T extends RouteDefinition>(definition: T): T;
export type MiddlewareHandlerFunction = (c: SumiContext, next: Next) => Promise<void | Response>;
export interface MiddlewareDefinition {
    _: MiddlewareHandlerFunction;
}
/**
 * Type helper for defining Sumi middleware.
 * Enforces the structure for middleware definitions.
 * @param definition The middleware definition object.
 * @returns The same definition object, used for type inference.
 */
export declare function createMiddleware(definition: MiddlewareDefinition): MiddlewareDefinition;
