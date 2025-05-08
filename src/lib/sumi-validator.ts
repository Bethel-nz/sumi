import { Context, Next } from 'hono';
import { ZodSchema, z } from 'zod';
import { ValidationSchemaMap, ValidationContext } from './router';
import type { ValidationTarget } from './types';

/**
 * Create validators for different request targets
 */
export class SumiValidator {
  /**
   * Creates middleware functions that validate request data
   */
  static createValidators(schemaMap: ValidationSchemaMap): Array<any> {
    const validators = [];

    for (const [target, schema] of Object.entries(schemaMap)) {
      if (!schema) continue;

      validators.push(
        this.createMiddleware(target as ValidationTarget, schema)
      );
    }

    return validators;
  }

  /**
   * Create a middleware function for a specific validation target
   */
  static createMiddleware(target: ValidationTarget, schema: ZodSchema) {
    return async (c: Context, next: Next) => {
      try {
        // Ensure valid object exists
        if (!(c as any).valid) {
          (c as any).valid = {};
        }

        // Extract data based on target
        let data: any;
        switch (target) {
          case 'query':
            data = c.req.query();
            break;
          case 'param':
            data = c.req.param();
            break;
          case 'json':
            data = await c.req.json().catch(() => ({}));
            break;
          case 'form':
            data = await c.req.formData().catch(() => ({}));
            // Convert FormData to plain object
            if (data instanceof FormData) {
              const formObj: Record<string, string | File> = {};
              data.forEach((value, key) => {
                formObj[key] = value;
              });
              data = formObj;
            }
            break;
          case 'header':
            data = {};
            for (const [key, value] of Object.entries(c.req.raw.headers)) {
              data[key] = value;
            }
            break;
          case 'cookie':
            data = {};
            const cookieHeader = c.req.header('Cookie');
            if (cookieHeader) {
              cookieHeader.split(';').forEach((cookie) => {
                const parts = cookie.split('=');
                if (parts.length >= 2) {
                  const key = parts[0].trim();
                  const value = parts.slice(1).join('=').trim();
                  data[key] = value;
                }
              });
            }
            break;
          default:
            await next();
            return;
        }

        // Validate data
        const validatedData = await schema.parseAsync(data);

        // Attach validated data to make it accessible with proper typing
        (c as any).valid[target] = validatedData;

        // Add to request object for backward compatibility
        if (!(c.req as any).valid) {
          (c.req as any).valid = function (t: ValidationTarget) {
            return (c as any).valid[t];
          };
        }

        // Continue
        await next();
      } catch (error) {
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Validation error',
          },
          400
        );
      }
    };
  }
}
