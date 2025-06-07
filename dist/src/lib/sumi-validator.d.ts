import { Context, Next } from 'hono';
import { ZodSchema } from 'zod';
import { ValidationSchemaMap } from './router';
import type { ValidationTarget } from './types';
/**
 * Create validators for different request targets
 */
export declare class SumiValidator {
    /**
     * Creates middleware functions that validate request data
     */
    static createValidators(schemaMap: ValidationSchemaMap): Array<any>;
    /**
     * Create a middleware function for a specific validation target
     */
    static createMiddleware(target: ValidationTarget, schema: ZodSchema): (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
        success: false;
        message: string;
        errors: {
            path: string;
            message: string;
        }[];
    }, 400, "json">) | (Response & import("hono").TypedResponse<{
        success: false;
        message: string;
        error: string;
    }, 400, "json">) | undefined>;
}
