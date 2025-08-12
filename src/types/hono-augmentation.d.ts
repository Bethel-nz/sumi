import 'hono';

declare module 'hono' {
  interface Context {
    plugin: {
      set<T>(key: string, value: T): void;
      use<T>(key: string): T;
    };
  }
}
