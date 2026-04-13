import fs from 'fs';
import path from 'path';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { RouteDefinition } from './router';

export class MiddlewareHandler {
  private app: Hono;
  private loggerEnabled: boolean;
  private middlewareDir: string;
  // RESTORED: Safety check to prevent applying the same middleware twice to the same path
  private appliedMiddleware: Map<string, Set<string>> = new Map();

  constructor(
    app: Hono,
    loggerEnabled: boolean,
    middlewareDir: string,
    _basePath: string
  ) {
    this.app = app;
    this.loggerEnabled = loggerEnabled;
    this.middlewareDir = middlewareDir;
  }

  async applyMiddleware(
    directory: string,
    routePath: string = '/'
  ): Promise<void> {
    // Correctly determine the pattern for directory-level middleware
    const parentDir = path.dirname(routePath);
    const pattern = parentDir === '/' ? '/*' : `${parentDir}/*`;

    const middlewareFiles = [
      path.join(directory, '_middleware.ts'),
      path.join(directory, '_middleware.js'),
      path.join(directory, '_index.ts'),
      path.join(directory, '_index.js'),
    ];

    for (const filePath of middlewareFiles) {
      if (
        !fs.existsSync(filePath) ||
        !this.isValidFile(filePath) ||
        fs.statSync(filePath).size <= 0
      ) {
        continue;
      }

      // RESTORED: Check if this middleware file has already been applied to this pattern
      if (!this.appliedMiddleware.has(filePath)) {
        this.appliedMiddleware.set(filePath, new Set());
      }
      if (this.appliedMiddleware.get(filePath)!.has(pattern)) {
        continue; // Already applied, skip
      }

      try {
        const middlewareModule = await import(`${filePath}?v=${Date.now()}`);
        const handler = middlewareModule.default?._;
        if (typeof handler === 'function') {
          this.app.use(pattern, handler);
          // RESTORED: Mark this middleware as applied for this pattern
          this.appliedMiddleware.get(filePath)!.add(pattern);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message.split('\n')[0].trim() : String(error);
        console.error(`[Sumi Router] Failed to load middleware ${path.basename(filePath)}\n  → ${msg}`);
      }
    }
  }

  async applyGlobalMiddleware(): Promise<void> {
    // Apply built-in Hono logger if enabled in config
    if (this.loggerEnabled) {
      this.app.use('*', logger());
    }

    // Apply custom global middleware from files like middleware/_index.ts
    if (fs.existsSync(this.middlewareDir)) {
      const files = fs.readdirSync(this.middlewareDir);
      for (const file of files) {
        if (file.startsWith('_')) {
          const filePath = path.join(this.middlewareDir, file);
          if (this.isValidFile(filePath) && fs.statSync(filePath).size > 0) {
            try {
              const middlewareModule = await import(
                `${filePath}?v=${Date.now()}`
              );
              const handler = middlewareModule.default?._;
              if (typeof handler === 'function') {
                this.app.use('*', handler);
              }
            } catch (error) {
              const msg = error instanceof Error ? error.message.split('\n')[0].trim() : String(error);
              console.error(`[Sumi Router] Failed to load global middleware ${file}\n  → ${msg}`);
            }
          }
        }
      }
    }
  }

  async reset(newApp: Hono): Promise<void> {
    this.app = newApp;
    // RESTORED: Clear the tracking map on reset
    this.appliedMiddleware.clear();
    // Don't call applyGlobalMiddleware here - let Sumi handle it
  }

  private isValidFile(filePath: string): boolean {
    return ['.js', '.ts'].includes(path.extname(filePath));
  }
}
