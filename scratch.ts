import { FLEET } from './src/assets/generators/vehicles';
const a = FLEET.find((x) => x.id === 'car.coupe')!;
const mesh = a.build(0).build({ occlusion: false });
const v = mesh.vertices;
const acc: Record<number, number[]> = {};
for (let i = 0; i < v.length; i += 12) {
  const mat = v[i + 6];
  const b = acc[mat] ?? (acc[mat] = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity]);
  b[0] = Math.min(b[0], v[i]); b[1] = Math.max(b[1], v[i]);
  b[2] = Math.min(b[2], v[i + 1]); b[3] = Math.max(b[3], v[i + 1]);
  b[4] = Math.min(b[4], v[i + 2]); b[5] = Math.max(b[5], v[i + 2]);
}
for (const k of Object.keys(acc)) console.log('mat', k, acc[Number(k)].map((n) => n.toFixed(2)).join(' '));
