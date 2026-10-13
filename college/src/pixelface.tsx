// Pixel-art coach portraits: a 20x20 sprite assembled from the coach's name (skin tone, hair,
// beard, glasses, a visor or cap in the school's colours, a polo and a headset).
const h = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };
const SKIN = ['#f1c7a3', '#e0ac7e', '#c68a5c', '#a86b42', '#7d4a2b', '#5a3420'];
const HAIR = ['#1c1410', '#3b2414', '#6b4423', '#a5793f', '#d9c38a', '#8e8e8e', '#d9d9d9'];

export function PixelCoach({ seed, c1, c2, size = 64 }: { seed: string; c1: string; c2: string; size?: number }) {
  const k = h(seed);
  const skin = SKIN[k % SKIN.length], hair = HAIR[(k >>> 4) % HAIR.length], dark = '#0b0d12';
  const hat = (k >>> 8) % 3;                 // 0 bare, 1 visor, 2 cap
  const beard = (k >>> 10) % 4 === 0, mustache = (k >>> 12) % 5 === 0, glasses = (k >>> 14) % 4 === 0, bald = (k >>> 16) % 6 === 0;
  const px: [number, number, string][] = [];
  const rect = (x: number, y: number, w: number, hh: number, c: string) => { for (let i = 0; i < w; i++) for (let j = 0; j < hh; j++) px.push([x + i, y + j, c]); };
  rect(0, 0, 20, 20, '#1a2130');
  rect(3, 15, 14, 5, c1); rect(8, 15, 4, 2, '#f3f1e8'); rect(9, 16, 2, 2, c1);   // polo with collar
  rect(8, 13, 4, 3, skin);                                                       // neck
  rect(5, 4, 10, 10, skin); rect(4, 7, 1, 3, skin); rect(15, 7, 1, 3, skin);       // head, ears
  if (!bald || hat) rect(5, 3, 10, 2, hair), rect(5, 5, 1, 2, hair), rect(14, 5, 1, 2, hair);
  if (hat === 1) { rect(4, 3, 12, 2, c1); rect(3, 5, 14, 1, c2); }
  if (hat === 2) { rect(5, 1, 10, 4, c1); rect(4, 5, 13, 1, c1); rect(9, 2, 2, 2, c2); }
  rect(7, 8, 2, 1, dark); rect(11, 8, 2, 1, dark);                                // eyes
  rect(7, 7, 2, 1, hair); rect(11, 7, 2, 1, hair);                                // brows
  if (glasses) { rect(6, 8, 4, 1, '#222'); rect(10, 8, 4, 1, '#222'); rect(7, 8, 2, 1, '#9fd3ff'); rect(11, 8, 2, 1, '#9fd3ff'); }
  rect(9, 9, 2, 2, shade(skin)); rect(8, 11, 4, 1, '#7a3b2e');                     // nose, mouth
  if (mustache) rect(8, 10, 4, 1, hair);
  if (beard) { rect(5, 10, 1, 3, hair); rect(14, 10, 1, 3, hair); rect(6, 12, 8, 2, hair); rect(8, 11, 4, 1, '#7a3b2e'); }
  rect(3, 6, 1, 5, dark); rect(2, 8, 2, 3, '#333'); rect(4, 11, 3, 1, '#333');      // headset
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" shapeRendering="crispEdges" className="pxface">
      {px.map(([x, y, c], i) => <rect key={i} x={x} y={y} width="1" height="1" fill={c} />)}
    </svg>
  );
}
function shade(hex: string) { const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.round(v * 0.82); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
