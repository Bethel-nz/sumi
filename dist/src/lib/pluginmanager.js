export class PluginManager {
    app;
    plugins = new Map();
    constructor(app) {
        this.app = app;
        this.app.use('*', async (c, next) => {
            if (!c.plugin) {
                c.plugin = {
                    set: (key, value) => this.set(key, value),
                    use: (key) => this.use(key),
                };
            }
            await next();
        });
    }
    set(key, value) {
        this.plugins.set(key, value);
    }
    use(key) {
        const plugin = this.plugins.get(key);
        if (!plugin) {
            throw new Error(`Plugin "${key}" not found`);
        }
        return plugin;
    }
    register(handler) {
        this.app.use('*', handler);
    }
}
