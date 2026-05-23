import { createMiddleware } from '@bethel-nz/sumi/router';

export default createMiddleware({
  _: async (c, next) => {
    c.set('adminMw', true);
    await next();
  },
});
