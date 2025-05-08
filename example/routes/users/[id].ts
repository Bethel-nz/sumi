import { z } from 'zod';
import { createRoute } from '../../../src/lib/router';

// Routes for /api/v1/users/:id
export default createRoute({
  // GET /api/v1/users/:id - Get a specific user
  get: {
    schema: {
      param: z.object({
        id: z.string(),
      }),
    },
    handler: (c) => {
      const { id } = c.valid.param!;

      // In a real app, fetch from database using the ID
      return c.json({
        id,
        name: `User ${id}`,
        email: `user${id}@example.com`,
        createdAt: new Date().toISOString(),
      });
    },
  },

  // PUT /api/v1/users/:id - Update a user
  put: {
    schema: {
      param: z.object({
        id: z.string(),
      }),
      json: z.object({
        name: z.string().min(3).max(50).optional(),
        email: z.string().email().optional(),
      }),
    },
    handler: (c) => {
      const { id } = c.valid.param!;
      const updates = c.valid.json!;

      // In a real app, update database record
      return c.json({
        id,
        ...updates,
        updatedAt: new Date().toISOString(),
        message: 'User updated successfully',
      });
    },
  },

  // DELETE /api/v1/users/:id - Delete a user
  delete: {
    schema: {
      param: z.object({
        id: z.string(),
      }),
    },
    handler: (c) => {
      const { id } = c.valid.param!;

      // In a real app, delete from database
      return c.json({
        id,
        message: `User ${id} deleted successfully`,
      });
    },
  },
});
