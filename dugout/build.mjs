// Stitches dugout/src/* (sorted by name) into the single-file page ../dugout-manager.html
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('./src/', import.meta.url);
const files = readdirSync(dir).filter((f) => /\.(js|html)$/.test(f)).sort();
const out = files.map((f) => readFileSync(new URL(f, dir), 'utf8').replace(/\n?$/, '\n')).join('');
writeFileSync(new URL('../dugout-manager.html', import.meta.url), out);
console.log(`dugout-manager.html: ${files.length} parts, ${out.split('\n').length} lines, ${(out.length / 1024).toFixed(0)} KB`);
