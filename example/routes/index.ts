import { z } from 'zod';
import { createRoute, ValidationContext } from '../../src/lib/router';

// Define schema with proper type handling for URL query parameters
const querySchema = z.object({
  name: z.string().optional().default('Example User'),
  age: z
    .string()
    .optional()
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
      console.log('Route handler received query:', query);

      return c.json({
        message: `Hello, ${query.name}! This is the example route.`,
        age: query.age ?? 'not provided',
        query,
      });
    },
  },
  post: (c) => {
    return c.json({
      message: 'Hello, World!',
    });
  },
});
