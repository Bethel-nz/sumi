import { createRoute } from '@bethel-nz/sumi/router';

export default createRoute({
  get: (c) => {
    return c.json({
      globalMw: c.get('globalMw') ?? false,
      adminMw: c.get('adminMw') ?? false,
    });
  },
});
