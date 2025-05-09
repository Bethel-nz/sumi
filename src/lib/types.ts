import { Context, Next as HonoNext, HonoRequest } from 'hono';
import { z, ZodSchema, ZodObject } from 'zod';
import { PluginManager } from './pluginmanager'; // Assuming this is defined elsewhere

// Validation target types (already in your router.ts, ensure it's consistent or imported)
export type ValidationTarget =
  | 'json'
  | 'form'
  | 'query'
  | 'param'
  | 'header'
  | 'cookie';

// SumiConfig and StaticRouteConfig (from your original types.ts)
export type StaticRouteConfig = {
  path: string;
  root: string;
};

export type SumiConfig = {
  app?: import('hono').Hono;
  logger: boolean;
  basePath?: string;
  middlewareDir?: string;
  routesDir?: string;
  port: number;
  static?: StaticRouteConfig[];
};

// SumiContext extending Hono's Context
export interface SumiContext extends Context {
  var: {
    // plugin: PluginManager;
  };
}

// Generic type for the c.req.valid(...) function
export type TypedValid<T extends Record<string, ZodSchema | ZodObject<{}>>> = {
  <K extends keyof T & ValidationTarget>(target: K): z.infer<T[K]>;
};

// Generic type for Hono's request object augmented with the .valid() method
export interface TypedRequest<
  T extends Record<string, ZodSchema | ZodObject<{}>>
> extends HonoRequest {
  valid: TypedValid<T>;
}
