import { Context, Hono, Next } from 'hono';

export class PluginManager {
  private plugins: Map<string, unknown> = new Map();

  constructor(private app: Hono) {
    this.app.use('*', async (c: Context, next: Next) => {
      if (!c.plugin) {
        c.plugin = {
          set: <T>(key: string, value: T): void => this.set(key, value),
          use: <T>(key: string): T => this.use<T>(key)
        };
      }
      await next();
    });
  }

  set<T>(key: string, value: T): void {
    this.plugins.set(key, value);
  }

  use<T>(key: string): T {
    const plugin = this.plugins.get(key);
    if (!plugin) {
      throw new Error(`Plugin "${key}" not found`);
    }
    return plugin as T;
  }

  register(handler: (c: Context, next: Next) => Promise<void | Response>): void {
    this.app.use('*', handler);
  }
}