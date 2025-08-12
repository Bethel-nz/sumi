import { Context, HonoRequest } from 'hono';
import { z, ZodSchema, ZodObject } from 'zod';
import { ApiReferenceConfiguration } from '@scalar/hono-api-reference';
import { OpenApiSpecsOptions } from 'hono-openapi';
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
export interface SumiHooks {
    onReady?: () => Promise<void> | void;
    onShutdown?: () => Promise<void> | void;
    onRequest?: (c: Context) => Promise<void> | void;
    onResponse?: (c: Context) => Promise<void> | void;
    onError?: (error: Error, c: Context) => Promise<void> | void;
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
export interface SumiContext extends Context {
    env: any;
}
export type TypedValid<T extends Record<string, ZodSchema | ZodObject<{}>>> = {
    <K extends keyof T & ValidationTarget>(target: K): z.infer<T[K]>;
};
export type TypedRequest<T extends Record<string, ZodSchema | ZodObject<{}>>> = {
    valid: TypedValid<T>;
} & HonoRequest;
