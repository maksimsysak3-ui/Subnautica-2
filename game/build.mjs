// Stitches game/src/* (sorted by name) into the single-file game ../night-range.html.
// The combat AI lives in ../ai/core.mjs (shared with its test harness); it is wrapped into a
// namespace and injected as part "61-ai-core" so the game and the tests run the same code.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('./src/', import.meta.url);
const parts = readdirSync(dir).filter((f) => /\.(js|html)$/.test(f)).map((f) => [f, readFileSync(new URL(f, dir), 'utf8')]);
const core = readFileSync(new URL('../ai/core.mjs', import.meta.url), 'utf8').replace(/^export /gm, '');
parts.push(['61-ai-core.js', `// ===== combat AI core (generated from ai/core.mjs) =====\nconst AICORE = (() => {\n${core}\nreturn { World, Agent, TUNE, PROFILES, util, rng };\n})();\n`]);
parts.sort((a, b) => (a[0] < b[0] ? -1 : 1));
const out = parts.map(([, s]) => s.replace(/\n?$/, '\n')).join('');
writeFileSync(new URL('../night-range.html', import.meta.url), out);
console.log(`night-range.html: ${parts.length} parts, ${out.split('\n').length} lines`);
