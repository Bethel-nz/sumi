import { createRoute } from '../../../src/lib/router';

// This creates the same route path as index.ts (both map to /)
// Sumi should skip the duplicate and warn.
export default createRoute({
  get: (c) => c.json({ route: 'duplicate' }),
});
