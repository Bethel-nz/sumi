// src/lib/vercel-codegen.ts
// Generates a Vercel Edge Function entry file from Sumi routes/middleware.
// Reuses the scanning logic from worker-codegen.ts.

import { generateWorkerEntry } from './worker-codegen';

export interface VercelCodegenOptions {
  routesDir: string;
  middlewareDir: string;
  configPath: string;
  outFile: string;
}

export async function generateVercelEntry(
  opts: VercelCodegenOptions
): Promise<string> {
  const workerSource = await generateWorkerEntry({
    routesDir: opts.routesDir,
    middlewareDir: opts.middlewareDir,
    configPath: opts.configPath,
    outFile: opts.outFile,
  });

  // Replace the CF-specific export with a Vercel Edge-compatible handler
  const vercelSource = workerSource
    .replace('export default { fetch };', '')
    .trim() +
    '\n\nexport default function handler(request: Request) {\n  return fetch(request);\n}\n';

  return vercelSource;
}
