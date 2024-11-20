import chokidar, {FSWatcher} from 'chokidar';
import type { Hono } from 'hono';
import path from 'path';

export function startFileWatcher(
  default_dir: string,
  default_middleware_dir: string,
  func: () => void
): FSWatcher {
   const watchOptions = {
    ignored: [
      '**/node_modules/**',
      '**/lib/**',         // Ignore lib directory
      '**/dist/**',        // Ignore dist directory if you have one
      '**/.git/**'         // Ignore git directory
    ],
    persistent: true,
    ignoreInitial: true
  };
  const watcher = chokidar.watch([
   path.join(default_middleware_dir, '**/*.ts'), // Watch .ts files in middleware
    path.join(default_dir, '**/*.ts')  
  ], watchOptions);

  watcher.on('all', (event, path) => {
    if (['add', 'change', 'unlink', 'ready'].includes(event) && (path.startsWith(default_dir) || path.startsWith(default_middleware_dir))) {
       func()
    }
  });

  return watcher;
}
