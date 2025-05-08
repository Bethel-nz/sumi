import { z } from 'zod';
import { createRoute } from '../../../src/lib/router';

// Define schemas
const userParamSchema = z.object({
  id: z.string(),
});

const userQuerySchema = z.object({
  includeDetails: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

const userBodySchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

// GET /api/v1/users - List all users
export default createRoute({
  get: {
    schema: {
      query: z.object({
        page: z
          .string()
          .optional()
          .transform((val) => (val ? parseInt(val, 10) : 1)),
        limit: z
          .string()
          .optional()
          .transform((val) => (val ? parseInt(val, 10) : 10)),
      }),
    },
    handler: (c) => {
      const { page, limit } = c.valid.query!;

      // Example users data - in a real app, this would come from a database
      const users = Array.from({ length: limit }, (_, i) => ({
        id: `user_${i + (page - 1) * limit + 1}`,
        name: `User ${i + (page - 1) * limit + 1}`,
        email: `user${i + (page - 1) * limit + 1}@example.com`,
      }));

      return c.json({
        page,
        limit,
        total: 100, // Example total count
        users,
      });
    },
  },

  post: {
    schema: {
      json: z.object({
        name: z.string().min(3).max(50),
        email: z.string().email(),
        password: z.string().min(8),
      }),
    },
    handler: (c) => {
      const userData = c.valid.json!;

      // In a real app, save to database here
      return c.json(
        {
          id: 'new_user_id',
          name: userData.name,
          email: userData.email,
          message: 'User created successfully',
        },
        201
      );
    },
  },

  // PUT - Update a user
  put: {
    schema: {
      param: userParamSchema,
      json: userBodySchema,
    },
    handler: (c) => {
      const { id } = c.valid.param;
      const userData = c.valid.json;

      return c.json({
        success: true,
        message: `User ${id} updated`,
        user: {
          id,
          ...userData,
        },
      });
    },
  },

  // DELETE - Remove a user
  delete: {
    schema: { param: userParamSchema },
    handler: (c) => {
      const { id } = c.valid.param;

      return c.json({
        success: true,
        message: `User ${id} deleted`,
      });
    },
  },
});
