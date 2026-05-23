import { z } from 'zod';
import { createRoute } from '@bethel-nz/sumi/router';
import { getJobStore } from '../index';

export default createRoute({
  get: {
    schema: {
      param: z.object({ id: z.string().uuid() }),
    },
    stream: async (stream, c) => {
      const { id } = c.req.valid('param');
      const jobs = getJobStore();

      // Poll every 500ms for up to 10 seconds
      const start = Date.now();
      while (Date.now() - start < 10_000) {
        const job = jobs.get(id);
        if (!job) {
          await stream.writeSSE({ event: 'error', data: 'Job not found' });
          return;
        }

        await stream.writeSSE({
          event: 'status',
          data: JSON.stringify({ status: job.status, result: job.result }),
        });

        if (job.status === 'completed' || job.status === 'failed') {
          await stream.writeSSE({ event: 'done', data: '' });
          return;
        }

        await stream.sleep(500);
      }

      await stream.writeSSE({ event: 'timeout', data: '' });
    },
  },
});
