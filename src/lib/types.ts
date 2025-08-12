import { Context, HonoRequest } from 'hono';
import { z, ZodSchema, ZodObject } from 'zod';
import { ApiReferenceConfiguration } from '@scalar/hono-api-reference';
import { OpenApiSpecsOptions, generateSpecs } from 'hono-openapi';

// Validation target types
export type ValidationTarget =
  | 'json'
  | 'form'
  | 'query'
  | 'param'
  | 'header'
  | 'cookie';

// Static route config
export type StaticRouteConfig = {
  path: string;
  root: string;
};

// Environment configuration
export interface EnvConfig<T extends Record<string, ZodSchema>> {
  schema: T;
  required?: (keyof T)[];
}

export type ValidatedEnv<T extends Record<string, ZodSchema>> = {
  [K in keyof T]: T[K] extends z.ZodType<infer U> ? U : any;
};

// Hooks interface
export interface SumiHooks {
  // === Server Lifecycle ===
  onReady?: () => Promise<void> | void;
  onShutdown?: () => Promise<void> | void;

  // === Request Lifecycle ===
  onRequest?: (c: Context) => Promise<void> | void;
  onResponse?: (c: Context) => Promise<void> | void;
  onError?: (error: Error, c: Context) => Promise<void> | void;

  // === Development Lifecycle ===
  onFileChange?: (
    filePath: string,
    eventType: 'add' | 'change' | 'unlink'
  ) => Promise<void> | void;
  onReload?: () => Promise<void> | void;
  onReloadComplete?: () => Promise<void> | void;

  // === Route Building ===
  onRouteRegistered?: (method: string, path: string) => Promise<void> | void;
  onMiddlewareRegistered?: (path: string) => Promise<void> | void;

  // === Custom Events ===
  onBuild?: () => Promise<void> | void;
  onTest?: () => Promise<void> | void;
}

// Docs configuration
export type DocsConfig = Omit<Partial<ApiReferenceConfiguration>, 'url'> & {
  path?: string;
};
export type OpenApiConfig = OpenApiSpecsOptions;

// Main Sumi configuration
export type SumiConfig = {
  app?: import('hono').Hono;
  logger: boolean;
  basePath?: string;
  middlewareDir?: string;
  routesDir?: string;
  port: number;
  static?: StaticRouteConfig[];
  openapi?: OpenApiConfig;
  docs?: DocsConfig;
  hooks?: SumiHooks;
  env?: EnvConfig<any>;
};

// SumiContext extending Hono's Context
export interface SumiContext extends Context {
  env: any; // Will hold validated environment variables
}

// Generic type for the c.req.valid(...) function
export type TypedValid<T extends Record<string, ZodSchema | ZodObject<{}>>> = {
  <K extends keyof T & ValidationTarget>(target: K): z.infer<T[K]>;
};

// Generic type for Hono's request object augmented with the .valid() method
export type TypedRequest<T extends Record<string, ZodSchema | ZodObject<{}>>> =
  {
    valid: TypedValid<T>;
  } & HonoRequest;
