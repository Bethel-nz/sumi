import { Next, Context } from 'hono';
// Import directly from the local router file
import { createMiddleware } from '../../src/lib/router';

// Create a unique ID generator
let requestId = 0;

export default createMiddleware({
  _: async (c: Context, next: Next) => {
    const currentId = ++requestId;
    c.set('id', currentId);

    // Only log request URL (not full debug info)
    console.log(`Request received: ${c.req.method} ${c.req.path}`);
    await next();
  },
});
