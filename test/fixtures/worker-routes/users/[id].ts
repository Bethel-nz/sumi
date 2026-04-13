import { createRoute } from '../../../../src/lib/router';
export default createRoute({
  get: (c) => c.json({ id: c.req.param('id') }),
});
