// router.ts (Final, Corrected Version)
import { Context, Next } from 'hono';
import { z, ZodObject, ZodSchema } from 'zod';
import { SumiContext, ValidationTarget } from './types';
import { DescribeRouteOptions } from 'hono-openapi';

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

export type ValidationContext<
  T extends Record<string, ZodSchema | ZodObject<{}>>
> = SumiContext & {
  req: SumiContext['req'] & {
    valid: <K extends keyof T & ValidationTarget>(target: K) => z.infer<T[K]>;
  };
};

export type RouteHandler = (c: Context) => Response | Promise<Response>;
export type MiddlewareHandler = (
  c: Context,
  next: Next
) => Promise<void | Response>;

export type TypedRouteHandler<T extends ValidationSchemaMap> = (
  c: SumiContext & {
    req: SumiContext['req'] & {
      valid: <K extends keyof T & ValidationTarget>(
        target: K
      ) => T[K] extends ZodSchema ? z.infer<T[K]> : any;
    };
  }
) => Response | Promise<Response>;

// --- The SINGLE FIX is inside this type definition ---
export type OpenApiConfig = Omit<DescribeRouteOptions, 'responses'> & {
  responses?: {
    [statusCode: string]: {
      description: string;
      content?: {
        'application/json': {
          // THIS IS THE ONLY CHANGE: Changed from 'ZodSchema' to 'any'.
          // This allows the object returned by the resolver() function to be accepted.
          schema: any;
        };
      };
    };
  };
};

export interface RouteConfig<T extends ValidationSchemaMap> {
  schema?: T;
  handler: TypedRouteHandler<T>;
  openapi?: OpenApiConfig;
  middleware?: string[];
}

export interface RouteDefinition {
  get?: RouteConfig<any> | RouteHandler;
  post?: RouteConfig<any> | RouteHandler;
  put?: RouteConfig<any> | RouteHandler;
  delete?: RouteConfig<any> | RouteHandler;
  patch?: RouteConfig<any> | RouteHandler;
  _?: RouteConfig<any> | MiddlewareHandler;
}

/**
 * A helper function that provides type-safety for route definitions.
 * It doesn't modify the configuration.
 */
export function createRoute<T extends RouteDefinition>(config: T): T {
  return config;
}

/**
 * A helper function for defining middleware.
 * It's a convenient alias for createRoute, ensuring consistency.
 */
export function createMiddleware(config: { _: any }): any {
  return createRoute(config);
}
