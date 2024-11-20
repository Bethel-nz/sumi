import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import path from 'path';
import fs from 'fs';

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
export function hibana(app: Hono | { app: Hono }, configs: HibanaConfig[]){
  const honoApp = 'app' in app ? app.app : app;
  
  configs.forEach(config => {
    const { path: urlPath, root } = config;
    const rootDir = root || urlPath.replace(/^\//, './');
    const absoluteRoot = path.resolve(process.cwd(), rootDir);
    
    if (!fs.existsSync(absoluteRoot)) {
      fs.mkdirSync(absoluteRoot, { recursive: true });
    }

    // Single route handler for the specific path
    return honoApp.get(urlPath, serveStatic({ root: absoluteRoot }));
  });
}