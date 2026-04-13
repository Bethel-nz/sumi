import { Context, Next } from 'hono';
import { z, ZodObject, ZodSchema } from 'zod';
import { ValidationTarget } from './types';
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

export type ValidationContext<
  T extends Record<string, ZodSchema | ZodObject<{}>>
> = Context & {
  validatedEnv: any;
  req: Context['req'] & {
    valid: <K extends keyof T & ValidationTarget>(target: K) => z.infer<T[K]>;
  };
};

export type RouteHandler = (c: Context) => Response | Promise<Response>;
export type MiddlewareHandler = (
  c: Context,
  next: Next
) => Promise<void | Response>;

export type TypedRouteHandler<T extends ValidationSchemaMap> = (
  c: Context & {
    validatedEnv: any;
    req: Context['req'] & {
      valid: <K extends keyof T & ValidationTarget>(
        target: K
      ) => T[K] extends ZodSchema ? z.infer<T[K]> : any;
    };
  }
) => Response | Promise<Response>;

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
  onMessage?: (
    evt: MessageEvent<any>,
    ws: WSContext<unknown>
  ) => void | Promise<void>;
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

/**
 * A helper function for defining WebSockets in +ws.ts files.
 */
export function createWS(config: WebSocketDefinition): WebSocketDefinition {
  return config;
}
