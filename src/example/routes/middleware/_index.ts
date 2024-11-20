import { Context, Next } from 'hono';

/**
 * Middleware that logs request and response details.
 * Logs the HTTP method, request URL, and response status.
 */
export default {
  _: async (c: Context, next: Next) => {
    // Log request details
    const start = Date.now();
    const method = c.req.method;
    const url = c.req.url;
    // console.log(`[${method}] ${url} - Request started`);
    c.set('url', `google.com`);
    await next();

    const duration = Date.now() - start;
    const status = c.res.status;
    // console.log(
    //   `[${method}] ${url} - Response status: ${status} - Duration: ${duration}ms`
    // );

    
  },
};
