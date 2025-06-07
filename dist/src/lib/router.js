import { SumiValidator } from './sumi-validator';
/**
 * Creates a route definition with optional validation and type safety
 */
export function createRoute(config) {
    const processedConfig = {};
    // Process each method
    Object.entries(config).forEach(([method, handlerOrConfig]) => {
        if (typeof handlerOrConfig === 'function') {
            processedConfig[method] = handlerOrConfig; // TypeScript will be satisfied with this
        }
        else if (handlerOrConfig &&
            'schema' in handlerOrConfig &&
            'handler' in handlerOrConfig) {
            // Handler with schema validation
            const { schema, handler } = handlerOrConfig;
            // Create validators
            const validators = SumiValidator.createValidators(schema);
            if (method === '_') {
                // Middleware handling
                processedConfig[method] = async (c, next) => {
                    // Apply each validator in sequence
                    let currentIndex = -1;
                    const runNextValidator = async () => {
                        currentIndex++;
                        if (currentIndex < validators.length) {
                            return validators[currentIndex](c, runNextValidator);
                        }
                        else {
                            // All validators passed, run the original handler
                            return handlerOrConfig.handler(c, next);
                        }
                    };
                    return runNextValidator();
                };
            }
            else {
                // Route handling
                processedConfig[method] = async (c) => {
                    c.valid = {};
                    // Apply each validator in sequence
                    for (const validator of validators) {
                        let canContinue = true;
                        const response = await validator(c, () => {
                            canContinue = true;
                        });
                        // If validator returned a response, return it (validation failed)
                        if (response)
                            return response;
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
export function createMiddleware(config) {
    return createRoute(config);
}
