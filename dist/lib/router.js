/**
 * A helper function that provides type-safety for route definitions.
 * It doesn't modify the configuration.
 */
export function createRoute(config) {
    return config;
}
/**
 * A helper function for defining middleware.
 * It's a convenient alias for createRoute, ensuring consistency.
 */
export function createMiddleware(config) {
    return createRoute(config);
}
