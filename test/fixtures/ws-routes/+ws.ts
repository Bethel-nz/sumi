// test/fixtures/ws-routes/+ws.ts
import { createWS } from '../../../src/lib/router';

export default createWS({
  handler: (_c) => ({
    onMessage(evt, ws) {
      ws.send(`echo: ${evt.data}`);
    },
  }),
});
