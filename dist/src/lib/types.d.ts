import { Context, HonoRequest } from 'hono';
import { z, ZodSchema, ZodObject } from 'zod';
export type ValidationTarget = 'json' | 'form' | 'query' | 'param' | 'header' | 'cookie';
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
export interface SumiContext extends Context {
    var: {};
}
export type TypedValid<T extends Record<string, ZodSchema | ZodObject<{}>>> = {
    <K extends keyof T & ValidationTarget>(target: K): z.infer<T[K]>;
};
export interface TypedRequest<T extends Record<string, ZodSchema | ZodObject<{}>>> extends HonoRequest {
    valid: TypedValid<T>;
}
