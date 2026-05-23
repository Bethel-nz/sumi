import { z } from 'zod';
import { createRoute } from '@bethel-nz/sumi/router';

// In-memory job store. In production, use Redis, Durable Objects, or a database.
interface Job {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();

export function getJobStore() {
  return jobs;
}

export function runJob(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'running';

  // Simulate async work
  setTimeout(() => {
    job.status = 'completed';
    job.result = `Processed job ${jobId}`;
  }, 3000);
}

export default createRoute({
  post: {
    schema: {
      json: z.object({ task: z.string().optional() }),
    },
    handler: async (c) => {
      const id = crypto.randomUUID();
      const job: Job = {
        id,
        status: 'pending',
        createdAt: Date.now(),
      };
      jobs.set(id, job);
      runJob(id);
      return c.json({ jobId: id, status: 'pending' }, 202);
    },
  },
});
