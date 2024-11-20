import fs from 'fs';
import path,{join} from 'path';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';

export class MiddlewareHandler {
  private app: Hono;
  private logger: boolean;
  private middlewareDir: string;
  private basePath: string;
  private staticRoutes: Map<string, string> = new Map();

  constructor(
    app: Hono,
    logger: boolean,
    middlewareDir: string,
    basePath: string
  ) {
    this.app = app;
    this.logger = logger;
    this.middlewareDir = middlewareDir;
    this.basePath = basePath;
  }

  applyMiddleware(directory: string, basePath: string = '/'): void {
    const middlewareFiles = [
      path.join(directory, '_middleware.ts'),
      path.join(directory, '_index.ts'),
    ];

    middlewareFiles.forEach((filePath) => {
      if (
        fs.existsSync(filePath) &&
        this.isValidFile(filePath) &&
        fs.statSync(filePath).size > 0
      ) {
        const middleware = require(filePath).default._;
        if (typeof middleware === 'function') {
          this.app.use(`${basePath}/*`, middleware);
        }
      }
    });
  }

  applyGlobalMiddleware(): void {
    // Apply static file middleware first
    this.applyStaticMiddleware();

    if (fs.existsSync(this.middlewareDir)) {
      fs.readdirSync(this.middlewareDir).forEach((file) => {
        const filePath = path.join(this.middlewareDir, file);
        if (
          this.isValidFile(filePath) &&
          this.isMiddlewareFile(file, this.middlewareDir) &&
          fs.statSync(filePath).size > 0
        ) {
          const middleware = require(filePath).default._;
          if (typeof middleware === 'function') {
            this.app.use('*', middleware);
          }
        }
      });
    }

    if (this.logger) this.app.use('*', logger());
  }



  private applyStaticMiddleware(): void {
    if (this.staticRoutes.size > 0) {
      this.app.use('*', async (c, next) => {
        const path = new URL(c.req.url).pathname;
        const staticRoot = this.findStaticRoot(path);
        
        if (staticRoot) {
          const filePath = path.replace(this.getBasePath(path), '');
          const fullPath = join(staticRoot, filePath);
          
          if (fs.existsSync(fullPath)) {
            const staticMiddleware = serveStatic({ root: staticRoot });
            return staticMiddleware(c, next);
          }
        }
        
        await next();
      });
    }
  }

  private findStaticRoot(requestPath: string): string | undefined {
    for (const [basePath, root] of this.staticRoutes) {
      if (requestPath.startsWith(basePath)) {
        return root;
      }
    }
    return undefined;
  }

  private getBasePath(path: string): string {
    for (const basePath of this.staticRoutes.keys()) {
      if (path.startsWith(basePath)) {
        return basePath;
      }
    }
    return '';
  }

  reset(): void {
    // Reinitialize the Hono app with the base path
    this.app = this.app || new Hono().basePath(this.basePath);
    this.applyGlobalMiddleware();
  }

  private isValidFile(filePath: string): boolean {
    return ['.js', '.ts'].includes(path.extname(filePath));
  }

  private isMiddlewareFile(fileName: string, directory: string): boolean {
    return (
      (fileName.includes('_middleware') ||
        fileName.includes('_index') ||
        fileName.startsWith('_')) &&
      directory === this.middlewareDir
    );
  }
}
