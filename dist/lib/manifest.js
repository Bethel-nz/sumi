// src/lib/manifest.ts
// Build-time route manifest for Bun runtime.
// Eliminates recursive fs scanning on every server start / hot reload.
import fs from 'fs';
import path from 'path';
import { RouteParser } from './RouteParser';
const MANIFEST_PATH = path.resolve('.sumi/manifest.json');
const ROUTE_METHODS = ['get', 'post', 'put', 'patch', 'delete', '_'];
/**
 * Replaces the interior of comments and string literals with spaces, keeping
 * every other character at its original index. Lets the key scanner walk
 * brace depth without tripping over punctuation inside strings or comments.
 */
function blankNonCode(source) {
    const out = source.split('');
    let i = 0;
    while (i < source.length) {
        const ch = source[i];
        const next = source[i + 1];
        if (ch === '/' && next === '/') {
            while (i < source.length && source[i] !== '\n')
                out[i++] = ' ';
            continue;
        }
        if (ch === '/' && next === '*') {
            const end = source.indexOf('*/', i + 2);
            const stop = end === -1 ? source.length : end + 2;
            while (i < stop)
                out[i++] = ' ';
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') {
            const quote = ch;
            i++;
            while (i < source.length && source[i] !== quote) {
                if (source[i] === '\\')
                    out[i++] = ' ';
                out[i++] = ' ';
            }
            i++;
            continue;
        }
        i++;
    }
    return out.join('');
}
function objectLiteralStart(code) {
    const call = /createRoute\s*(?:<[^>]*>)?\s*\(\s*\{/.exec(code);
    if (call)
        return code.indexOf('{', call.index);
    const fallback = code.search(/export\s+default\s*\{/);
    return fallback === -1 ? -1 : code.indexOf('{', fallback);
}
/**
 * Collects the keys of the object literal opening at `start`, ignoring keys of
 * any object, call, or array nested inside it.
 */
function topLevelKeys(code, start) {
    const hits = [];
    let depth = 0;
    let parens = 0;
    let brackets = 0;
    let expectKey = false;
    for (let i = start; i < code.length; i++) {
        const ch = code[i];
        if (ch === '{') {
            depth++;
            expectKey = depth === 1;
            continue;
        }
        if (ch === '}') {
            depth--;
            expectKey = false;
            if (depth === 0)
                break;
            continue;
        }
        if (ch === '(')
            parens++;
        else if (ch === ')')
            parens--;
        else if (ch === '[')
            brackets++;
        else if (ch === ']')
            brackets--;
        const atTopLevel = depth === 1 && parens === 0 && brackets === 0;
        if (ch === ',' && atTopLevel) {
            expectKey = true;
            continue;
        }
        if (!expectKey || !atTopLevel)
            continue;
        if (/\s/.test(ch))
            continue;
        const match = /^([A-Za-z_$][\w$]*)\s*:\s*/.exec(code.slice(i));
        expectKey = false;
        if (!match)
            continue;
        hits.push({ name: match[1], valueStart: i + match[0].length });
        i += match[1].length;
    }
    return hits;
}
/**
 * Reads the shape of the route definition object without executing the module,
 * so tooling can report verbs for a route whose imports would otherwise have to
 * be loaded. A method is streaming when its config carries a `stream` key,
 * matching how the router decides to wrap a handler with `streamSSE`.
 */
export function extractRouteShape(source) {
    const code = blankNonCode(source);
    const start = objectLiteralStart(code);
    if (start === -1)
        return { methods: [], sse: [] };
    const label = (name) => (name === '_' ? 'MIDDLEWARE' : name.toUpperCase());
    const hits = new Map(topLevelKeys(code, start)
        .filter((hit) => ROUTE_METHODS.includes(hit.name))
        .map((hit) => [hit.name, hit]));
    const ordered = ROUTE_METHODS.filter((m) => hits.has(m));
    const sse = ordered.filter((m) => {
        const { valueStart } = hits.get(m);
        return (code[valueStart] === '{' &&
            topLevelKeys(code, valueStart).some((key) => key.name === 'stream'));
    });
    return { methods: ordered.map(label), sse: sse.map(label) };
}
export function readRouteShape(filePath) {
    try {
        return extractRouteShape(fs.readFileSync(filePath, 'utf8'));
    }
    catch {
        return { methods: [], sse: [] };
    }
}
function fileToHonoPath(filePath, routesDir) {
    const routeName = path.basename(filePath, path.extname(filePath));
    if (routeName.startsWith('_'))
        return '';
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
function scanRoutes(dir, baseDir, out = []) {
    if (!fs.existsSync(dir))
        return out;
    const ignored = ['dist', 'static', 'public', 'node_modules'];
    if (ignored.some((d) => dir.includes(d)) || path.basename(dir).startsWith('.'))
        return out;
    for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            scanRoutes(full, baseDir, out);
        }
        else if ((entry.endsWith('.ts') || entry.endsWith('.js')) &&
            !entry.startsWith('_') &&
            stat.size > 0) {
            const routePath = fileToHonoPath(full, baseDir);
            if (!routePath)
                continue;
            const isWebSocket = path.basename(full, path.extname(full)) === '+ws';
            const shape = isWebSocket ? { methods: ['WS'], sse: [] } : readRouteShape(full);
            out.push({ filePath: full, routePath, isWebSocket, ...shape });
        }
    }
    return out;
}
function scanMiddleware(dir) {
    if (!fs.existsSync(dir))
        return [];
    return fs
        .readdirSync(dir)
        .filter((f) => (f.endsWith('.ts') || f.endsWith('.js')) &&
        fs.statSync(path.join(dir, f)).size > 0)
        .map((f) => {
        const name = path.basename(f, path.extname(f));
        return {
            name,
            filePath: path.join(dir, f),
            isGlobal: name.startsWith('_'),
        };
    });
}
export function generateManifest(routesDir, middlewareDir) {
    const routes = scanRoutes(path.resolve(routesDir), path.resolve(routesDir));
    const middleware = scanMiddleware(path.resolve(middlewareDir));
    return { routes, middleware };
}
export function writeManifest(manifest) {
    const outDir = path.dirname(MANIFEST_PATH);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
}
export function loadManifest() {
    if (!fs.existsSync(MANIFEST_PATH))
        return null;
    try {
        const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export function clearManifest() {
    if (fs.existsSync(MANIFEST_PATH)) {
        fs.unlinkSync(MANIFEST_PATH);
    }
}
