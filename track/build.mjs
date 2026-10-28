// Stitches track/src/* (sorted by name) into the single-file page ../track-builder.html
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('./src/', import.meta.url);
const files = readdirSync(dir).filter((f) => /\.(js|html)$/.test(f)).sort();
import { execSync } from 'node:child_process';
// Build stamp (date + source commit) shown in the top bar, so a stale cached copy is easy to spot.
let rev = '';
try { rev = execSync('git rev-parse --short HEAD', { cwd: new URL('.', import.meta.url) }).toString().trim(); } catch {}
const stamp = `v${new Date().toISOString().slice(0, 16).replace('T', ' ')}${rev ? ' · ' + rev : ''}`;
const out = files.map((f) => readFileSync(new URL(f, dir), 'utf8').replace(/\n?$/, '\n')).join('').replace('__BUILD__', stamp);
writeFileSync(new URL('../track-builder.html', import.meta.url), out);
console.log(`track-builder.html: ${files.length} parts, ${out.split('\n').length} lines`);
