import { defineConfig } from '@bethel-nz/sumi';

export default defineConfig({
  logger: true,
  port: 3000,
  routesDir: 'routes',
  middlewareDir: 'middleware',
  basePath: '/api',
  openapi: {
    documentation: {
      info: {
        title: 'Bethel Portfolio AI API',
        version: '1.0.0',
        description: 'AI-powered portfolio API using Sumi and Groq',
      },
      servers: [{ url: 'http://localhost:3000/api', description: 'Local server' }],
    },
  },
  docs: {
    path: '/docs',
  },
});
