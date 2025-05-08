import { Next, Context } from 'hono';
// Import directly from the local router file
import { createMiddleware } from '../../src/lib/router';

// Create a unique ID generator
let requestId = 0;

export default createMiddleware({
  _: async (c: Context, next: Next) => {
    // Generate a unique ID for this execution
    const currentId = ++requestId;

    // Use base Hono Context for example
    console.log(
      `[Example Middleware ${currentId}] Request received for: ${c.req.url}`
    );
    await next();
    console.log(`[Example Middleware ${currentId}] Response sent`);
  },
});
