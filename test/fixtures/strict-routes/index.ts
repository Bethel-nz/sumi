import { createRoute } from '../../../src/lib/router';

export default createRoute({
  get: {
    middleware: ['nonexistent'],
    handler: (c) => c.json({ ok: true }),
  },
});
