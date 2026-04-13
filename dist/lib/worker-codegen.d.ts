export interface CodegenOptions {
    /** Absolute or cwd-relative path to routes directory */
    routesDir: string;
    /** Absolute or cwd-relative path to middleware directory */
    middlewareDir: string;
    /** Path to sumi.config.ts (for the import statement) */
    configPath: string;
    /** Output file path (written by the CLI, not this function) */
    outFile: string;
}
export declare function generateWorkerEntry(opts: CodegenOptions): Promise<string>;
