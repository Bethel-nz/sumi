import { z } from 'zod';
import { createRoute } from '../../../../../src/lib/router';

// Routes for /api/v1/users/:id/projects
export default createRoute({
  // GET /api/v1/users/:id/projects - List all projects for a user
  get: {
    schema: {
      param: z.object({
        id: z.string(),
      }),
      query: z.object({
        status: z.string().optional(),
      }),
    },
    handler: (c) => {
      const { id } = c.valid.param!;
      const { status } = c.valid.query || {};

      // In a real app, fetch from database using user ID and filter by status
      const projects = Array.from({ length: 3 }, (_, i) => ({
        id: `project_${i + 1}`,
        name: `Project ${i + 1}`,
        userId: id,
        status: status || ['active', 'completed', 'pending'][i % 3],
        createdAt: new Date().toISOString(),
      }));

      return c.json({
        userId: id,
        status: status || 'all',
        projects,
      });
    },
  },

  // POST /api/v1/users/:id/projects - Create a new project for a user
  post: {
    schema: {
      param: z.object({
        id: z.string(),
      }),
      json: z.object({
        name: z.string().min(3).max(100),
        description: z.string().optional(),
        status: z.enum(['active', 'pending', 'completed']).default('pending'),
      }),
    },
    handler: (c) => {
      const { id } = c.valid.param!;
      const projectData = c.valid.json!;

      // In a real app, save to database
      return c.json(
        {
          id: 'new_project_id',
          userId: id,
          ...projectData,
          createdAt: new Date().toISOString(),
          message: 'Project created successfully',
        },
        201
      );
    },
  },
});
