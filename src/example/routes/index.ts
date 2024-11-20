import { Context } from 'hono';

interface DB {
  query: (sql: string) => Promise<any[]>;
}

type Logger = (msg: string) => void;

export default {
  get: async (c: Context) => {
    const logger = c.plugin.use<Logger>('logger');
    const db = c.plugin.use<DB>('db');
    
    logger('Fetching users from database...');
    const users = await db.query('SELECT * FROM users');
    
    return c.json({
      message: `Hello 👋 from root route 😂`,
      users,
      requestId: c.plugin.use<string>('requestId')
    });
  }
};
