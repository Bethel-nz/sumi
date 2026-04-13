// example/routes/events.ts
// Accessible at GET /api/v1/events (with basePath from example config)
import { createRoute } from '../../src/lib/router';

export default createRoute({
  get: {
    stream: async (stream) => {
      let count = 0;
      while (count < 5) {
        await stream.writeSSE({
          data: JSON.stringify({ tick: count, ts: Date.now() }),
          event: 'tick',
          id: String(count),
        });
        await stream.sleep(1000);
        count++;
      }
      await stream.writeSSE({ data: 'stream closed', event: 'done' });
    },
  },
});
