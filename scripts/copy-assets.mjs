import fs from 'fs';
import path from 'path'
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename)

const src = path.resolve(__dirname, '../src/lib/public/favicon.ico');
const dest = path.resolve(__dirname, '../dist/lib/public/favicon.ico');


fs.mkdirSync(path.dirname(dest), {recursive: true})

if(fs.existsSync(src)){
    fs.copyFileSync(src, dest)
    console.log('Copied favicon ->', dest);
} else {
    console.log('No src favicon at', src, '(nothing copied)')
}