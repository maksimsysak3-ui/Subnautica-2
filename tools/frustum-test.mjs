/**
 * Frustum culling test.
 *
 * Culling fails in two directions and both are quiet: cull nothing and you
 * lose the optimisation without noticing, cull everything and the world
 * vanishes only at angles you did not happen to try. Neither shows up in a
 * screenshot from the default camera, so assert it directly.
 *
 *   node tools/frustum-test.mjs
 */

import * as esbuild from 'esbuild';

const bundle = (
  await esbuild.build({
    stdin: {
      contents: `
        export { Frustum } from './src/gfx/frustum';
        export { perspective, lookAt, multiply, mat4 } from './src/math/m4';
      `,
      resolveDir: new URL('..', import.meta.url).pathname,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, target: 'es2022',
  })
).outputFiles[0].text;

const { Frustum, perspective, lookAt, multiply, mat4 } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundle).toString('base64')
);

// Camera at (0, 200, 400) looking at the origin, 50 degrees vertical.
const view = lookAt(mat4(), [0, 200, 400], [0, 0, 0], [0, 1, 0]);
const proj = perspective(mat4(), (50 * Math.PI) / 180, 16 / 9, 1, 3000);
const viewProj = multiply(mat4(), proj, view);

const f = new Frustum();
f.update(viewProj);

const box = (x, y, z, r = 40) => [[x - r, y - r, z - r], [x + r, y + r, z + r]];

const cases = [
  ['box at the focus point is visible', box(0, 0, 0), true],
  ['box just in front of the camera is visible', box(0, 150, 300), true],
  ['box behind the camera is culled', box(0, 200, 900), false],
  ['box far to the left is culled', box(-3000, 0, 0), false],
  ['box far to the right is culled', box(3000, 0, 0), false],
  ['box beyond the far plane is culled', box(0, 0, -4000), false],
  ['box high above the view is culled', box(0, 4000, 0), false],
  ['huge box containing the camera is visible', box(0, 0, 0, 5000), true],
];

const fails = [];
for (const [name, [min, max], want] of cases) {
  const got = f.containsBox(min, max);
  console.log(`${got === want ? 'PASS' : 'FAIL'}  ${name}`);
  if (got !== want) fails.push(`${name}: expected ${want}, got ${got}`);
}

if (fails.length) {
  console.error('\nFAIL\n' + fails.map((s) => '  - ' + s).join('\n'));
  process.exitCode = 1;
} else {
  console.log('\nPASS  frustum culls in every direction and keeps what is visible');
}
