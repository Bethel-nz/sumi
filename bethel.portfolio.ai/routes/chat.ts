import { createRoute } from '@bethel-nz/sumi/router';
import { z } from 'zod';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export default createRoute({
  get: {
    openapi: {
      summary: 'Chat with Portfolio AI',
      description: 'Stream responses from Groq using SSE',
    },
    stream: async (stream) => {
      if (!process.env.GROQ_API_KEY) {
        await stream.writeSSE({
          data: 'Error: GROQ_API_KEY is not set',
          event: 'error',
        });
        return;
      }

      try {
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'You are an AI assistant for Bethel\'s portfolio. Be professional and helpful.',
            },
            {
              role: 'user',
              content: 'Tell me about Bethel\'s work.',
            },
          ],
          model: 'llama3-8b-8192',
          stream: true,
        });

        for await (const chunk of chatCompletion) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            await stream.writeSSE({
              data: JSON.stringify({ text: content }),
              event: 'message',
            });
          }
        }

        await stream.writeSSE({
          data: '[DONE]',
          event: 'end',
        });
      } catch (error: any) {
        await stream.writeSSE({
          data: `Error: ${error.message}`,
          event: 'error',
        });
      }
    },
  },
});
