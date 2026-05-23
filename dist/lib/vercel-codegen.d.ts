export interface VercelCodegenOptions {
    routesDir: string;
    middlewareDir: string;
    configPath: string;
    outFile: string;
}
export declare function generateVercelEntry(opts: VercelCodegenOptions): Promise<string>;
