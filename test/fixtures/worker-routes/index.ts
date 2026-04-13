import { createRoute } from '../../../src/lib/router';
export default createRoute({
  get: (c) => c.json({ route: 'index' }),
});
