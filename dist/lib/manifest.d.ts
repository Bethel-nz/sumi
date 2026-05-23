export interface ManifestRoute {
    filePath: string;
    routePath: string;
    isWebSocket: boolean;
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
export declare function generateManifest(routesDir: string, middlewareDir: string): RouteManifest;
export declare function writeManifest(manifest: RouteManifest): void;
export declare function loadManifest(): RouteManifest | null;
export declare function clearManifest(): void;
