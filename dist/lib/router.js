/**
 * A helper function that provides type-safety for route definitions.
 * It doesn't modify the configuration.
 */
export function createRoute(config) {
    return config;
}
/**
 * A helper function for defining middleware with typed context and next.
 * The generic C lets callers annotate `c` as SumiContext (or any Context
 * subtype) while still getting `next: Next` inferred automatically.
 */
export function createMiddleware(config) {
    return config;
}
/**
 * A helper function for defining WebSockets in +ws.ts files.
 */
export function createWS(config) {
    return config;
}
