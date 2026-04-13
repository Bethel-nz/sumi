// test/fixtures/sse-routes/events.ts
import { createRoute } from '../../../src/lib/router';

export default createRoute({
  get: {
    stream: async (stream) => {
      await stream.writeSSE({ data: 'ping', event: 'heartbeat', id: '1' });
      await stream.writeSSE({ data: 'done', event: 'end', id: '2' });
    },
  },
});
