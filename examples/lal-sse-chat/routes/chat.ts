import { z } from 'zod';
import { createRoute } from '@bethel-nz/sumi/router';

/**
 * Simulated LLM token stream.
 * In production, replace this with a real SDK call (e.g., Groq, OpenAI).
 */
async function* fakeTokenStream(prompt: string) {
  const words = `You said: "${prompt}". Here is a simulated response with multiple tokens.`;
  for (const word of words.split(' ')) {
    yield word + ' ';
    await new Promise((r) => setTimeout(r, 50));
  }
}

export default createRoute({
  post: {
    schema: {
      json: z.object({ prompt: z.string().min(1) }),
    },
    stream: async (stream, c) => {
      const { prompt } = c.req.valid('json');

      for await (const token of fakeTokenStream(prompt)) {
        await stream.writeSSE({
          event: 'token',
          data: JSON.stringify({ token }),
        });
      }

      await stream.writeSSE({ event: 'done', data: '' });
    },
  },
});
