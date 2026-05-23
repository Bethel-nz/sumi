import { createWS } from '@bethel-nz/sumi/router';

/**
 * WebSocket agent backend.
 * In production, replace the echo with real LLM/agent orchestration.
 */
export default createWS({
  handler: (c) => ({
    onOpen(_evt, ws) {
      ws.send(JSON.stringify({ type: 'system', content: 'Agent connected' }));
    },
    onMessage(evt, ws) {
      try {
        const data = JSON.parse(evt.data as string);
        const userMessage = data.message || String(evt.data);

        // Simulated agent response
        ws.send(
          JSON.stringify({
            type: 'agent',
            content: `Agent received: "${userMessage}"`,
            timestamp: new Date().toISOString(),
          })
        );
      } catch {
        ws.send(
          JSON.stringify({
            type: 'error',
            content: 'Invalid message format. Expected JSON.',
          })
        );
      }
    },
    onClose() {
      console.log('Agent WebSocket closed');
    },
  }),
});
