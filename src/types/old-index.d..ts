// src/types/sumi.d.ts
declare module 'sumi' {
  import { Hono } from 'hono';
  import { Context, Next } from 'hono';

  /**
   * Sumi - A lightweight web framework built on top of Hono
   */
  export class Sumi {
    /**
     * Initializes a new instance of the Sumi class.
     * @param {Object} default_args - Configuration options for Sumi
     */
    constructor(default_args: {
      app?: Hono;
      logger: boolean;
      basePath?: string;
      middlewareDir?: string;
      routesDir?: string;
      files?: Set<{ path: string; root: string }>;
    });

    /**
     * Registers a plugin to be used across the application
     * @param handler Plugin handler function
     */
    plugin(handler: (c: Context, next: Next) => Promise<void | Response>): void;

    /**
     * Initializes the server and starts watching for file changes
     */
    burn(): Promise<void>;

    /**
     * Returns the fetch handler for the Hono app
     * @returns Bound fetch handler for the application
     */
    fetch(): ((request: Request) => Promise<Response>) | undefined;
  }
}

import { Context as HonoContext } from 'hono';

declare module 'hono' {
  interface Context extends HonoContext {
    plugin: {
      set<T>(key: string, value: T): void;
      use<T>(key: string): T;
    };
  }
}
