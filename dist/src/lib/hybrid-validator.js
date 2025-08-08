import { validator as zValidator } from 'hono-openapi/zod';
/**
 * Creates validators using zValidator from hono-openapi for OpenAPI integration
 */
export class HybridValidator {
    static createValidators(schemaMap) {
        const validators = [];
        for (const [target, schema] of Object.entries(schemaMap)) {
            if (!schema || typeof schema !== 'object' || !('_def' in schema))
                continue;
            // Use zValidator for OpenAPI integration
            validators.push(zValidator(target, schema));
        }
        return validators;
    }
}
