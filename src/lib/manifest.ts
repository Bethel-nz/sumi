// src/lib/manifest.ts
// Build-time route manifest for Bun runtime.
// Eliminates recursive fs scanning on every server start / hot reload.

import fs from 'fs';
import path from 'path';
import { RouteParser } from './RouteParser';

export interface ManifestRoute {
  filePath: string;
  routePath: string;
  isWebSocket: boolean;
}

export interface ManifestMiddleware {
  name: string;
  filePath: string;
  isGlobal: boolean;
}

export interface RouteManifest {
  routes: ManifestRoute[];
  middleware: ManifestMiddleware[];
}

const MANIFEST_PATH = path.resolve('.sumi/manifest.json');

function fileToHonoPath(filePath: string, routesDir: string): string {
  const routeName = path.basename(filePath, path.extname(filePath));
  if (routeName.startsWith('_')) return '';

  const isIndex = routeName === 'index';
  const isWS = routeName === '+ws';
  const rel = path.relative(routesDir, filePath);
  const dir = path.dirname(rel);

  const segments = dir
    .split(path.sep)
    .filter((s) => s !== '.' && s !== '')
    .map(RouteParser.parseSegment);

  const filePart = isIndex || isWS ? '' : RouteParser.parseSegment(routeName);
  const all = [...segments, filePart].filter(Boolean);
  const p = all.length > 0 ? `/${all.join('/')}` : '/';
  return p.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function scanRoutes(dir: string, baseDir: string, out: ManifestRoute[] = []): ManifestRoute[] {
  if (!fs.existsSync(dir)) return out;
  const ignored = ['dist', 'static', 'public', 'node_modules'];
  if (ignored.some((d) => dir.includes(d)) || path.basename(dir).startsWith('.')) return out;

  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanRoutes(full, baseDir, out);
    } else if (
      (entry.endsWith('.ts') || entry.endsWith('.js')) &&
      !entry.startsWith('_') &&
      stat.size > 0
    ) {
      const routePath = fileToHonoPath(full, baseDir);
      if (!routePath) continue;
      const isWebSocket = path.basename(full, path.extname(full)) === '+ws';
      out.push({ filePath: full, routePath, isWebSocket });
    }
  }
  return out;
}

function scanMiddleware(dir: string): ManifestMiddleware[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(
      (f) =>
        (f.endsWith('.ts') || f.endsWith('.js')) &&
        fs.statSync(path.join(dir, f)).size > 0
    )
    .map((f) => {
      const name = path.basename(f, path.extname(f));
      return {
        name,
        filePath: path.join(dir, f),
        isGlobal: name.startsWith('_'),
      };
    });
}

export function generateManifest(
  routesDir: string,
  middlewareDir: string
): RouteManifest {
  const routes = scanRoutes(path.resolve(routesDir), path.resolve(routesDir));
  const middleware = scanMiddleware(path.resolve(middlewareDir));
  return { routes, middleware };
}

export function writeManifest(manifest: RouteManifest): void {
  const outDir = path.dirname(MANIFEST_PATH);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
}

export function loadManifest(): RouteManifest | null {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
    return JSON.parse(raw) as RouteManifest;
  } catch {
    return null;
  }
}

export function clearManifest(): void {
  if (fs.existsSync(MANIFEST_PATH)) {
    fs.unlinkSync(MANIFEST_PATH);
  }
}
