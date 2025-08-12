import { Hono } from 'hono';
interface HibanaConfig {
    path: string;
    root?: string;
}
/**
 * Hibana (火花) - Static file server for Hono/Sumi
 * Serves static files for specific routes
 * @param app Hono/Sumi app instance
 * @param configs Array of Hibana configurations
 * @example
 * hibana(app, [{
 *   path: '/static/images/*',  // Specific route pattern
 *   root: './assets/images'    // Directory to serve from
 * }]);
 */
export declare function hibana(app: Hono | {
    app: Hono;
}, configs: HibanaConfig[]): void;
export {};
