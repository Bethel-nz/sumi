import { FSWatcher } from 'chokidar';
export declare function startFileWatcher(default_dir: string, default_middleware_dir: string, func: () => void): FSWatcher;
