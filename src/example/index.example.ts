import { Hono } from 'hono';
import Sumi from '../lib/sumi';
import { logger } from 'hono/logger';
import { Context, Next } from 'hono';
import path from 'path';
import { serveStatic } from 'hono/bun';
const app = new Hono();

app.use('*', logger());

const sumi = new Sumi({
  app,
  logger: false,
  middlewareDir: './routes/middleware',
  routesDir: './routes',
  port: 5790,
});


// Example Database
const db = {
  query: async (sql: string) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];
  }
};

// Register plugins
sumi.plugin(async (c: Context, next: Next) => {
  // Set plugins in context
  c.plugin.set('db', db);
  c.plugin.set('logger', (msg: string) => console.log(`[${Date.now()}] ${msg}`));
  c.plugin.set('requestId', crypto.randomUUID());

  await next();
});

sumi.burn()
const fetch = sumi.fetch()

export default {
  port: 5790,
  fetch
};
