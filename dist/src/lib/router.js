/**
 * Type helper for defining Sumi routes with optional schema validation.
 * Enforces the structure for route definitions and provides type checking.
 * @param definition The route definition object.
 * @returns The same definition object, used for type inference.
 */
export function createRoute(definition) {
    // This is primarily a type utility; the actual processing happens in Sumi core.
    return definition;
}
/**
 * Type helper for defining Sumi middleware.
 * Enforces the structure for middleware definitions.
 * @param definition The middleware definition object.
 * @returns The same definition object, used for type inference.
 */
export function createMiddleware(definition) {
    // Primarily a type utility.
    if (typeof definition._ !== 'function') {
        // Basic runtime check for safety, could be enhanced
        throw new Error("Middleware definition must include a handler function under the '_' key.");
    }
    return definition;
}
// Potentially re-export SumiContext if it makes sense here
// export type { SumiContext } from './types';
