import fs from 'fs';
import path, { join } from 'path';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import { SumiConfig } from './types';
import {
  RouteDefinition,
  MiddlewareHandler as RouterMiddlewareHandler,
} from './router';

export class MiddlewareHandler {
  private app: Hono;
  private logger: boolean;
  private middlewareDir: string;
  private basePath: string;
  private appliedMiddleware: Set<string> = new Set();

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

  async applyMiddleware(
    directory: string,
    basePath: string = '/'
  ): Promise<void> {
    const middlewareFiles = [
      path.join(directory, '_middleware.ts'),
      path.join(directory, '_index.ts'),
    ];

    await Promise.all(
      middlewareFiles.map(async (filePath) => {
        if (this.appliedMiddleware.has(filePath)) {
          console.log(
            `[Sumi Middleware] Skipping already applied middleware: ${filePath}`
          );
          return;
        }

        if (
          fs.existsSync(filePath) &&
          this.isValidFile(filePath) &&
          fs.statSync(filePath).size > 0
        ) {
          try {
            console.log(`[Sumi Middleware] Importing middleware: ${filePath}`);
            const middlewareModule = await import(filePath);

            if (
              middlewareModule.default &&
              typeof middlewareModule.default._ === 'function'
            ) {
              const middlewareDef: RouteDefinition = middlewareModule.default;
              const handler = middlewareDef._;
              console.log(
                `[Sumi Middleware] Applying route middleware from ${filePath} to ${basePath}/*`
              );
              this.app.use(`${basePath}/*`, handler as any);
              this.appliedMiddleware.add(filePath);
            } else {
              console.warn(
                `[Sumi Middleware] Invalid export structure in ${filePath}. Expected export default { _: function }. Skipping.`
              );
            }
          } catch (error) {
            console.error(
              `[Sumi Middleware] Error loading middleware file ${filePath}:`,
              error
            );
          }
        }
      })
    );
  }

  async applyGlobalMiddleware(): Promise<void> {
    if (fs.existsSync(this.middlewareDir)) {
      const files = fs.readdirSync(this.middlewareDir);
      await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(this.middlewareDir, file);

          if (this.appliedMiddleware.has(filePath)) {
            console.log(
              `[Sumi Middleware] Skipping already applied global middleware: ${filePath}`
            );
            return;
          }

          if (
            this.isValidFile(filePath) &&
            this.isMiddlewareFile(file, this.middlewareDir) &&
            fs.statSync(filePath).size > 0
          ) {
            try {
              const middlewareModule = await import(filePath);

              if (
                middlewareModule.default &&
                typeof middlewareModule.default._ === 'function'
              ) {
                const middlewareDef: RouteDefinition = middlewareModule.default;
                const handler = middlewareDef._;

                this.app.use('*', handler as any);
                this.appliedMiddleware.add(filePath);
              } else {
                console.warn(
                  `[Sumi Middleware] Invalid export structure in ${filePath}. Expected export default { _: function }. Skipping.`
                );
              }
            } catch (error) {
              console.error(
                `[Sumi Middleware] Error loading global middleware file ${filePath}:`,
                error
              );
            }
          }
        })
      );
    }

    if (this.logger) {
      this.app.use('*', logger());
    }
  }

  async reset(newApp: Hono): Promise<void> {
    this.app = newApp;
    this.appliedMiddleware.clear();
    await this.applyGlobalMiddleware();
    console.log(
      '[Sumi Reloader] MiddlewareHandler reset with new app instance.'
    );
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
