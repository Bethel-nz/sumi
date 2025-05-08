import chokidar, { FSWatcher } from 'chokidar';
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
      '**/lib/**', // Ignore lib directory
      '**/dist/**', // Ignore dist directory if you have one
      '**/.git/**', // Ignore git directory
    ],
    persistent: true,
    ignoreInitial: true,
  };
  const watcher = chokidar.watch(
    [
      path.join(default_middleware_dir, '**/*.ts'), // Watch .ts files in middleware
      path.join(default_dir, '**/*.ts'),
    ],
    watchOptions
  );

  watcher.on('all', (event, filePath) => {
    // Log detected events and paths
    console.log(`[FileWatcher] Event detected: ${event} on path: ${filePath}`);

    if (
      ['add', 'change', 'unlink'].includes(event) &&
      (filePath.startsWith(default_dir) ||
        filePath.startsWith(default_middleware_dir))
    ) {
      console.log(
        `[FileWatcher] Triggering reload due to event: ${event} on path: ${filePath}`
      );
      func();
    }
  });

  // Add an error event listener
  watcher.on('error', (error) => {
    console.error(`[FileWatcher] Error: ${error}`);
  });

  return watcher;
}
