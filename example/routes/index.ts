import { z } from 'zod';
import { createRoute, ValidationContext } from '../../src/lib/router';

// Define schema with proper type handling for URL query parameters
const querySchema = z.object({
  name: z.string().optional().default('Example User'),
  age: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(parseInt(val, 10)), {
      message: 'Age must be a valid number',
    })
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
});

const paramSchema = z.object({
  id: z.string().optional().default('123'),
});

// Define the schema map type for this route
type RouteSchema = {
  query: typeof querySchema;
};

// Use the type-safe approach with a type assertion for the handler
export default createRoute({
  get: {
    schema: { query: querySchema, param: paramSchema },
    handler: (c: ValidationContext<RouteSchema>) => {
      const query = c.valid.query!;
      const currentId = c.get('id');
      console.log('[INDEX ROUTE] Route handler received query:', query);

      console.log('[INDEX ROUTE] Processing request to root path');

      return c.json({
        message: `Hello, ${query.name}! This is the example route.`,
        age: query.age ?? 'not provided',
        query,
        currentId,
      });
    },
  },
  post: (c) => {
    return c.json({
      message: 'Hello, World!',
    });
  },
});
