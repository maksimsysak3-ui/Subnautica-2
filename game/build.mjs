// Stitches game/src/* (sorted by name) into the single-file game ../night-range.html
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('./src/', import.meta.url);
const files = readdirSync(dir).filter((f) => /\.(js|html)$/.test(f)).sort();
const out = files.map((f) => readFileSync(new URL(f, dir), 'utf8').replace(/\n?$/, '\n')).join('');
writeFileSync(new URL('../night-range.html', import.meta.url), out);
console.log(`night-range.html: ${files.length} parts, ${out.split('\n').length} lines`);
