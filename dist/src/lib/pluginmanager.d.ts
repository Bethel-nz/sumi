import { Hono, Next } from 'hono';
import { SumiContext } from './types';
export declare class PluginManager {
    private app;
    private plugins;
    constructor(app: Hono);
    set<T>(key: string, value: T): void;
    use<T>(key: string): T;
    register(handler: (c: SumiContext, next: Next) => Promise<void | Response>): void;
}
