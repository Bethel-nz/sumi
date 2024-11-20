import { Context } from 'hono';
import { fetchProductById, modifyProduct, removeProduct } from '../../data';

export default {
  get: async (c: Context) => {
    const { id } = c.req.param();
    const product = await fetchProductById(id);
    if (product) {
      return c.json(product);
    }
    return c.text('Product not found', 404);
  },
  put: async (c: Context) => {
    const { id } = c.req.param();
    const updates = await c.req.json();
    const updatedProduct = await modifyProduct(id, updates);

    return c.json(updatedProduct);
  },
  delete: async (c: Context) => {
    const { id } = c.req.param();
    await removeProduct(id);
    return c.text('Product deleted', 200);
  },
};
