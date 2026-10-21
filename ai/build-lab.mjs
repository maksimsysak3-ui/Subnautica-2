// Inlines ai/core.mjs into the lab page so ai-lab.html works as a single file (file:// can't import modules).
import { readFileSync, writeFileSync } from 'node:fs';
const core = readFileSync(new URL('./core.mjs', import.meta.url), 'utf8').replace(/^export /gm, '');
const page = readFileSync(new URL('./lab.template.html', import.meta.url), 'utf8').replace('/*__CORE__*/', () => core);
writeFileSync(new URL('../ai-lab.html', import.meta.url), page);
console.log('wrote ai-lab.html');
