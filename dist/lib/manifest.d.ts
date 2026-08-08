export interface ManifestRoute {
    filePath: string;
    routePath: string;
    isWebSocket: boolean;
    /** HTTP verbs the route file defines, uppercased. `_` is reported as MIDDLEWARE. */
    methods: string[];
    /** The subset of `methods` served as Server-Sent Events. */
    sse: string[];
}
export interface ManifestMiddleware {
    name: string;
    filePath: string;
    isGlobal: boolean;
}
export interface RouteManifest {
    routes: ManifestRoute[];
    middleware: ManifestMiddleware[];
}
export interface RouteShape {
    /** HTTP verbs the route file defines, uppercased. `_` is reported as MIDDLEWARE. */
    methods: string[];
    /** The subset of `methods` whose config supplies an SSE `stream` handler. */
    sse: string[];
}
/**
 * Reads the shape of the route definition object without executing the module,
 * so tooling can report verbs for a route whose imports would otherwise have to
 * be loaded. A method is streaming when its config carries a `stream` key,
 * matching how the router decides to wrap a handler with `streamSSE`.
 */
export declare function extractRouteShape(source: string): RouteShape;
export declare function readRouteShape(filePath: string): RouteShape;
export declare function generateManifest(routesDir: string, middlewareDir: string): RouteManifest;
export declare function writeManifest(manifest: RouteManifest): void;
export declare function loadManifest(): RouteManifest | null;
export declare function clearManifest(): void;
