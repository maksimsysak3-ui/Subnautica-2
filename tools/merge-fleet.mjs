/**
 * Merges one pack's freshly imported vehicles into the shipped fleet data.
 *
 * `import-usdz.py` reads whatever packs it is given and writes a complete
 * fleet-data.ts. That is right the first time and wrong every time after: the
 * library was built from seven source files, only some of which are to hand on
 * any given day, and re-importing one of them must not delete the other six.
 *
 * So the importer is run on the pack that changed, into a scratch file, and
 * this merges it: every model in the incoming file replaces the model of the
 * same id, the shapes it needs come with it, and any shape the old models were
 * the last users of is dropped. Model order is preserved -- ids are stable and
 * the viewer lists them in file order, so a re-import should not reshuffle the
 * fleet.
 *
 *     node tools/merge-fleet.mjs <incoming.ts> [target.ts]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(new URL('.', import.meta.url)));
const incomingPath = process.argv[2];
const targetPath = process.argv[3] ?? path.join(root, 'src/assets/fleet-data.ts');
if (!incomingPath) throw new Error('usage: merge-fleet.mjs <incoming.ts> [target.ts]');

/** Pulls the one big object literal out of a generated fleet-data.ts. */
function read(file) {
  const text = fs.readFileSync(file, 'utf8');
  const at = text.indexOf('= {"shapes"');
  if (at < 0) throw new Error(`${file} does not look like a generated fleet-data.ts`);
  const end = text.lastIndexOf('};');
  return { head: text.slice(0, at + 2), data: JSON.parse(text.slice(at + 2, end + 1)) };
}

const target = read(targetPath);
const incoming = read(incomingPath);

const models = { ...target.data.models };
const shapes = { ...target.data.shapes };

// Replace in place, keeping insertion order for ids that already exist and
// appending the ones that do not.
const added = [], replaced = [];
for (const [id, model] of Object.entries(incoming.data.models)) {
  (id in models ? replaced : added).push(id);
  models[id] = model;
  shapes[model.shape] = incoming.data.shapes[model.shape];
}

// Drop shapes nothing points at any more. A shape is a quarter of a megabyte
// and the old ones are dead the moment their last livery is replaced.
const live = new Set(Object.values(models).map((m) => m.shape));
const orphans = Object.keys(shapes).filter((k) => !live.has(k));
for (const k of orphans) delete shapes[k];

const out = { shapes, models };
fs.writeFileSync(targetPath, `${target.head} ${JSON.stringify(out)};\n`);

const kb = (fs.statSync(targetPath).size / 1024) | 0;
console.log(`replaced ${replaced.length}: ${replaced.join(', ')}`);
if (added.length) console.log(`added ${added.length}: ${added.join(', ')}`);
console.log(`dropped ${orphans.length} orphaned shape(s)`);
console.log(`${Object.keys(models).length} models, ${Object.keys(shapes).length} shapes, ${kb} KB`);
