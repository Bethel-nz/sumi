import fs from 'fs';
import path from 'path';
function parse_route_segment(segment) {
    if (segment.startsWith('[') && segment.endsWith(']')) {
        if (segment.startsWith('[...') && segment.endsWith(']')) {
            return `:${segment.slice(4, -1)}*`;
        }
        else {
            return `:${segment.slice(1, -1)}`;
        }
    }
    return segment;
}
async function generate_types(directory, base_path = '') {
    const files = fs.readdirSync(directory);
    let type_defs = `import { Context } from 'hono';\n\n`;
    files.forEach((file) => {
        const file_path = path.join(directory, file);
        const stat = fs.statSync(file_path);
        if (stat.isDirectory()) {
            const segment = parse_route_segment(file);
            generate_types(file_path, `${base_path}/${segment}`);
        }
        else {
            const route_name = path.basename(file, path.extname(file));
            const route_path = route_name === 'index' ? base_path : `${base_path}/${route_name}`;
            route_path.replace(/\[(\.\.\.)?(\w+)\]/g, (_, spread, param) => {
                return spread ? `:${param}*` : `:${param}`;
            });
            type_defs += `declare module '${file_path}' {
        export function get(c: Context): any;
        export function post(c: Context): any;
        export function put(c: Context): any;
        export function del(c: Context): any;
        export function patch(c: Context): any;
      }\n`;
        }
    });
    fs.writeFileSync(path.join(__dirname, 'routes.d.ts'), type_defs);
}
export default generate_types;
