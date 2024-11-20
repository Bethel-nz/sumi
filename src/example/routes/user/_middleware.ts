import { Context, Next } from 'hono';

export default {
  _: (c: Context, next: Next) => {
    c.set('exampleVariable', 'Hello 👋');
    return next();
  },
};
