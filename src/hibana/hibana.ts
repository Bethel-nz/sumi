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

    // Default rootDir to the urlPath relative to current directory if not provided
    // e.g. /static/images/* -> ./static/images
    const rootDir = root || urlPath.replace(/^\//, './').replace(/\/\*$/, '');
    const absoluteRoot = path.resolve(process.cwd(), rootDir);

    if (!fs.existsSync(absoluteRoot)) {
      fs.mkdirSync(absoluteRoot, { recursive: true });
    }

    const pathPrefix = urlPath.replace(/\*$/, '');

    // Register a GET handler for the path pattern
    honoApp.get(urlPath, async (c) => {
      const requestPath = c.req.path;
      // Get the relative path after the prefix
      const relativePath = requestPath.startsWith(pathPrefix) 
        ? requestPath.slice(pathPrefix.length) 
        : requestPath;
        
      const filePath = path.join(absoluteRoot, relativePath);

      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          return new Response(Bun.file(filePath));
        }
      }
      
      return c.notFound();
    });
  });
}