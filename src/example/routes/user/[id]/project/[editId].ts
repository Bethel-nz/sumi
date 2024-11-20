import { Context } from 'hono';

export default {
  get: (c: Context) => {
    const id = c.req.param('editId');
    return c.json({ message: `Edit ID: ${id}` });
  },
};
