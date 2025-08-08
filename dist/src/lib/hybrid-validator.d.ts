import { ValidationSchemaMap } from './router';
/**
 * Creates validators using zValidator from hono-openapi for OpenAPI integration
 */
export declare class HybridValidator {
    static createValidators(schemaMap: ValidationSchemaMap): Array<any>;
}
