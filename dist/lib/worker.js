// src/lib/worker.ts
// ⚠️  This file must NOT import 'fs', 'path', or any Bun-specific APIs.
// It is bundled into Cloudflare Workers where those APIs don't exist.
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { describeRoute } from 'hono-openapi';
import { validator as zValidator } from 'hono-openapi/zod';
import { generateSpecs } from 'hono-openapi';
import { Scalar } from '@scalar/hono-api-reference';
/**
 * Creates a Hono app from a pre-built route manifest.
 * Safe to use in Cloudflare Workers — no filesystem access or dynamic imports.
 */
export function createWorkerApp(manifest, config = {}) {
    let app = new Hono();
    if (config.basePath) {
        const normalized = '/' + config.basePath.replace(/^\/*|\/*$/g, '');
        app = app.basePath(normalized);
    }
    // Apply onRequest hook
    if (config.hooks?.onRequest) {
        app.use('*', async (c, next) => {
            await config.hooks.onRequest(c);
            await next();
        });
    }
    // Register all routes from manifest
    for (const { path: routePath, module: routeModule } of manifest.routes) {
        const routeDefinition = routeModule.default;
        for (const [method, methodConfig] of Object.entries(routeDefinition)) {
            if (!methodConfig)
                continue;
            const chain = [];
            let userHandler;
            if (typeof methodConfig === 'function') {
                userHandler = methodConfig;
            }
            else if (typeof methodConfig === 'object' &&
                'stream' in methodConfig &&
                typeof methodConfig.stream === 'function') {
                // SSE route — import streamSSE lazily to keep CF compat
                // (hono/streaming is CF-compatible)
                const sseCallback = methodConfig.stream;
                userHandler = (c) => streamSSE(c, sseCallback);
            }
            else if (typeof methodConfig === 'object' &&
                methodConfig.handler) {
                const cfg = methodConfig;
                userHandler = cfg.handler;
                if (cfg.openapi) {
                    chain.push(describeRoute(cfg.openapi));
                }
                if (cfg.middleware && manifest.middleware) {
                    for (const name of cfg.middleware) {
                        const mw = manifest.middleware[name];
                        if (mw)
                            chain.push(mw);
                    }
                }
                if (cfg.schema) {
                    for (const [target, schema] of Object.entries(cfg.schema)) {
                        if (schema && typeof schema === 'object' && '_def' in schema) {
                            chain.push(zValidator(target, schema));
                        }
                    }
                }
            }
            else {
                continue;
            }
            chain.push(userHandler);
            const honoMethod = method.toLowerCase();
            if (method === '_') {
                app.use(routePath, ...chain);
            }
            else if (typeof app[honoMethod] === 'function') {
                app[honoMethod](routePath, ...chain);
            }
        }
    }
    // OpenAPI endpoints
    if (config.openapi) {
        app.get('/openapi.json', async (c) => {
            const spec = await generateSpecs(app, config.openapi);
            return c.json(spec);
        });
        if (config.docs) {
            const { path: docsPath = '/docs', ...scalarConfig } = config.docs;
            app.get(docsPath, Scalar({
                url: '/openapi.json',
                ...scalarConfig,
                pageTitle: scalarConfig.pageTitle || 'API Documentation',
            }));
        }
    }
    // Apply onResponse hook
    if (config.hooks?.onResponse) {
        app.use('*', async (c, next) => {
            await next();
            await config.hooks.onResponse(c);
        });
    }
    app.onError(async (err, c) => {
        if (config.hooks?.onError)
            await config.hooks.onError(err, c);
        return c.json({ error: 'Internal Server Error', message: err.message }, 500);
    });
    return { fetch: app.fetch.bind(app) };
}
