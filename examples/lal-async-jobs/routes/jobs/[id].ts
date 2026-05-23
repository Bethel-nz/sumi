import { z } from 'zod';
import { createRoute } from '@bethel-nz/sumi/router';
import { getJobStore } from './index';

export default createRoute({
  get: {
    schema: {
      param: z.object({ id: z.string().uuid() }),
    },
    handler: (c) => {
      const { id } = c.req.valid('param');
      const job = getJobStore().get(id);
      if (!job) {
        return c.json({ error: 'Job not found' }, 404);
      }
      return c.json(job);
    },
  },

  // SSE stream for real-time job updates
  // Accessible at GET /jobs/:id/stream
  // Note: this pattern requires a separate route file for the stream if you want
  // a different path. For simplicity, we attach it to the same param route.
});
