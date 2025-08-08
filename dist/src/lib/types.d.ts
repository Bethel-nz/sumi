import { Context, HonoRequest } from 'hono';
import { z, ZodSchema, ZodObject } from 'zod';
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
export interface DocsConfig {
    path?: string;
    theme?: 'alternate' | 'default' | 'moon' | 'purple' | 'solarized' | 'none';
    pageTitle?: string;
}
export type SumiConfig = {
    app?: import('hono').Hono;
    logger: boolean;
    basePath?: string;
    middlewareDir?: string;
    routesDir?: string;
    port: number;
    static?: StaticRouteConfig[];
    openapi?: {
        info: {
            title: string;
            version: string;
            description?: string;
        };
        servers?: {
            url: string;
            description?: string;
        }[];
    };
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
