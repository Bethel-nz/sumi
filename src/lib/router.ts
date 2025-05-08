// router.ts
import { Context, Next } from 'hono';
import { z, ZodSchema } from 'zod';
import { SumiValidator } from './sumi-validator';
import { ValidationTarget } from './types';

// Schema map for validation
export interface ValidationSchemaMap {
  json?: ZodSchema;
  form?: ZodSchema;
  query?: ZodSchema;
  param?: ZodSchema;
  header?: ZodSchema;
  cookie?: ZodSchema;
}

// Type helper to infer validation results
export type ValidatedData<T extends ValidationSchemaMap> = {
  [K in keyof T]?: T[K] extends ZodSchema ? z.infer<T[K]> : unknown;
};

// Context with validation data
export type ValidationContext<
  T extends ValidationSchemaMap = ValidationSchemaMap
> = Context & {
  valid: ValidatedData<T>;
};

// Basic route definition with methods
export interface RouteDefinition {
  get?:
    | RouteHandler
    | ((c: ValidationContext<any>) => Response | Promise<Response>)
    | RouteConfig<any>;
  post?:
    | RouteHandler
    | ((c: ValidationContext<any>) => Response | Promise<Response>)
    | RouteConfig<any>;
  put?:
    | RouteHandler
    | ((c: ValidationContext<any>) => Response | Promise<Response>)
    | RouteConfig<any>;
  delete?:
    | RouteHandler
    | ((c: ValidationContext<any>) => Response | Promise<Response>)
    | RouteConfig<any>;
  patch?:
    | RouteHandler
    | ((c: ValidationContext<any>) => Response | Promise<Response>)
    | RouteConfig<any>;
  _?:
    | MiddlewareHandler
    | ((c: ValidationContext<any>, next: Next) => Promise<void | Response>)
    | RouteConfig<any>;
}

// Standard handler types
export type RouteHandler = (c: Context) => Response | Promise<Response>;
export type MiddlewareHandler = (
  c: Context,
  next: Next
) => Promise<void | Response>;

// Typed handler with validation
export type TypedRouteHandler<T extends ValidationSchemaMap> = (
  c: ValidationContext<T>
) => Response | Promise<Response>;

// Route with validation schema
export interface RouteConfig<T extends ValidationSchemaMap> {
  schema: T;
  handler: TypedRouteHandler<T>;
}

// Type-safe route config
export interface TypedRouteConfig<T extends ValidationSchemaMap> {
  schema: T;
  handler: TypedRouteHandler<T>;
}

// Middleware with validation schema
export interface MiddlewareConfig {
  schema: ValidationSchemaMap;
  handler: MiddlewareHandler;
}

/**
 * Creates a route definition with optional validation and type safety
 */
export function createRoute<T extends RouteDefinition>(config: T): any {
  const processedConfig: any = {};

  // Process each method
  Object.entries(config).forEach(([method, handlerOrConfig]) => {
    if (typeof handlerOrConfig === 'function') {
      processedConfig[method] = handlerOrConfig; // TypeScript will be satisfied with this
    } else if (
      handlerOrConfig &&
      'schema' in handlerOrConfig &&
      'handler' in handlerOrConfig
    ) {
      // Handler with schema validation
      const { schema, handler } = handlerOrConfig as any;

      // Create validators
      const validators = SumiValidator.createValidators(schema);

      if (method === '_') {
        // Middleware handling
        processedConfig[method] = async (c: Context, next: Next) => {
          // Apply each validator in sequence
          let currentIndex = -1;

          const runNextValidator = async () => {
            currentIndex++;
            if (currentIndex < validators.length) {
              return validators[currentIndex](c, runNextValidator);
            } else {
              // All validators passed, run the original handler
              return (handlerOrConfig as any).handler(c as any, next);
            }
          };

          return runNextValidator();
        };
      } else {
        // Route handling
        processedConfig[method] = async (c: Context) => {
          (c as any).valid = {};

          // Apply each validator in sequence
          for (const validator of validators) {
            let canContinue = true;
            const response = await validator(c, () => {
              canContinue = true;
            });

            // If validator returned a response, return it (validation failed)
            if (response) return response;

            // If validator indicated not to continue, stop
            if (!canContinue)
              return new Response('Validation error', { status: 400 });
          }

          return handler(c);
        };
      }
    }
  });

  return processedConfig;
}

/**
 * Creates middleware with optional validation
 */
export function createMiddleware(config: { _: any }): any {
  return createRoute(config);
}
