import { Context, Hono, Next } from 'hono';
import { PluginManager } from './pluginmanager';

type StaticRouteConfig = {
  path: string;
  root: string;
};

type SumiConfig = {
  app?: Hono;
  logger: boolean;
  basePath?: string;
  middlewareDir?: string;
  routesDir?: string;
  port: number;
  static?: StaticRouteConfig[];
};

interface SumiContext extends Context {
  plugin: PluginManager;
}

export { SumiConfig, StaticRouteConfig, SumiContext };
