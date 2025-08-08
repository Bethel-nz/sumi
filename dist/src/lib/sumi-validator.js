/**
 * Create validators for different request targets
 */
export class SumiValidator {
    /**
     * Creates middleware functions that validate request data
     */
    static createValidators(schemaMap) {
        const validators = [];
        for (const [target, schema] of Object.entries(schemaMap)) {
            if (!schema)
                continue;
            validators.push(this.createMiddleware(target, schema));
        }
        return validators;
    }
    /**
     * Create a middleware function for a specific validation target
     */
    static createMiddleware(target, schema) {
        return async (c, next) => {
            try {
                // Ensure valid object exists
                if (!c.valid) {
                    c.valid = {};
                }
                // Extract data based on target
                let data;
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
                            const formObj = {};
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
                // Validate data with proper error handling
                const result = await schema.safeParseAsync(data);
                if (!result.success) {
                    // Return detailed validation errors
                    const formattedErrors = result.error.issues.map((err) => ({
                        path: err.path.join('.'),
                        message: err.message,
                    }));
                    return c.json({
                        success: false,
                        message: 'Validation failed',
                        errors: formattedErrors,
                    }, 400);
                }
                // Attach validated data to make it accessible with proper typing
                c.valid[target] = result.data;
                // Add to request object for backward compatibility
                if (!c.req.valid) {
                    c.req.valid = function (t) {
                        return c.valid[t];
                    };
                }
                // Continue
                await next();
            }
            catch (error) {
                return c.json({
                    success: false,
                    message: 'Validation error',
                    error: error instanceof Error
                        ? error.message
                        : 'Unknown validation error',
                }, 400);
            }
        };
    }
}
