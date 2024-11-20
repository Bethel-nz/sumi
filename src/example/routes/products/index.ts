import { Context } from 'hono';

export default {
  get: async (c: Context) => {
    const exampleVariable = c.get('exampleVariable');
    const url = c.get('url');
    return c.json({
      message: `detail route ${exampleVariable}, ${url}`,
    });
  },
  post: async (c: Context) => {
    const body = await c.req.json();
    return c.json({
      message: body,
    });
  },
};
