import { Context } from 'hono';

export default {
  get: (c: Context) => {
    const id = c.req.param('id');
    return c.json({ message: `User ID: ${id}` });
  },
};
