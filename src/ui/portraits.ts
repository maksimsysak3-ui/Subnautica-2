/**
 * Hand-drawn people: the candidates' portraits and the crowd on election night.
 *
 * Drawn, not photographed, because a sketch is what a local paper's election
 * page looks like and because it costs nothing to ship: every face is a few
 * shapes chosen from a seed. Two tricks make vector shapes read as ink on
 * paper. The outlines are run through a turbulence displacement, so no line is
 * ruler-straight and no curve is perfect; and the flat colour is printed a
 * hair off the line, the way a cheap two-pass print misregisters. Both are one
 * SVG filter and one transform -- no bitmaps, no fonts.
 */

const INK = '#1f1b18';
const SKIN = ['#f3d2b5', '#e8b58f', '#c98e64', '#a86c45', '#7a4b2c', '#f0c7a0'];
const HAIR = ['#2b211c', '#5a3a22', '#a8703b', '#d8b26a', '#8f8a84', '#b8452f'];
const SUIT = ['#2d3a4f', '#3b3f46', '#4b3a5a', '#2f4a44', '#5a4632'];

function rand(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function pick<T>(r: () => number, list: readonly T[]): T {
  return list[Math.floor(r() * list.length) % list.length];
}

/** The wobble filter. One per SVG, named so several can share a page. */
function wobble(id: string, scale = 2.2): string {
  return `<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%">`
    + '<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="3"/>'
    + `<feDisplacementMap in="SourceGraphic" scale="${scale}"/></filter>`;
}

/**
 * One candidate's face, as SVG markup.
 *
 * @param seed decides everything about the face; the same seed is the same
 *   person every time, so a candidate looks the same on every screen.
 * @param colour the party colour, on the rosette and the background.
 */
export function portrait(seed: number, colour: string, size = 96): string {
  const r = rand(seed * 2654435761);
  const skin = pick(r, SKIN);
  const hair = pick(r, HAIR);
  const suit = pick(r, SUIT);
  // The seed's low bit says which pool the name came from (politics.ts), and
  // the hair and beard follow it so a name and its face agree.
  const a = seed % 2 === 0;
  const style = pick(r, a ? [1, 2, 3, 5, 1] : [0, 0, 3, 4, 0]);
  const fw = 18.5 + r() * 4.5;
  const glasses = r() < 0.28;
  const beard = !a && r() < 0.3;
  const mouth = Math.floor(r() * 4);
  const tilt = (r() - 0.5) * 4;
  const id = `hd${seed % 100000}`;

  const off = 'transform="translate(1.3 1.1)"';
  const line = `fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  const shape = (d: string, fill: string): string =>
    `<path d="${d}" fill="${fill}" ${off}/><path d="${d}" ${line}/>`;

  const head = `M${50 - fw} 47a${fw} 25 0 1 0 ${fw * 2} 0a${fw} 25 0 1 0 ${-fw * 2} 0z`;
  const hairBack = style === 5
    ? `M${50 - fw - 5} 80C${46 - fw} 40 38 15 50 15C62 15 ${54 + fw} 40 ${50 + fw + 5} 80Z`
    : style === 1
      ? `M${50 - fw - 3} 62C${48 - fw} 30 38 15 50 15C62 15 ${52 + fw} 30 ${50 + fw + 3} 62Z`
      : '';
  const hairTop = [
    `M${50 - fw} 44C${50 - fw - 1} 22 40 16 51 16C64 16 ${51 + fw} 24 ${50 + fw} 44`
      + `C${48 + fw} 34 62 28 50 28C40 28 ${52 - fw} 33 ${50 - fw} 44Z`,
    `M${50 - fw} 50C${50 - fw - 2} 26 38 17 50 17C62 17 ${52 + fw} 26 ${50 + fw} 50`
      + `C${49 + fw} 36 61 29 50 29C39 29 ${51 - fw} 36 ${50 - fw} 50Z`,
    `M${50 - fw + 1} 40C${50 - fw} 25 40 20 50 20C60 20 ${50 + fw} 25 ${50 + fw - 1} 40`
      + `C${47 + fw} 31 60 27 50 27C40 27 ${53 - fw} 31 ${50 - fw + 1} 40Z`,
    '',
    `M${51 - fw} 50C${50 - fw} 44 ${50 - fw} 38 ${53 - fw} 34L${54 - fw} 48Z`
      + `M${49 + fw} 50C${50 + fw} 44 ${50 + fw} 38 ${47 + fw} 34L${46 + fw} 48Z`,
    `M${50 - fw} 48C${50 - fw - 1} 24 40 16 50 16C60 16 ${50 + fw + 1} 24 ${50 + fw} 48`
      + `C${47 + fw} 33 60 27 50 27C40 27 ${53 - fw} 33 ${50 - fw} 48Z`,
  ][style];
  let curls = '';
  if (style === 3) {
    for (let a = 0; a <= 8; a++) {
      const t = Math.PI * (0.05 + a * 0.1125);
      const x = 50 - Math.cos(t) * (fw + 1);
      const y = 40 - Math.sin(t) * 22;
      curls += `M${(x - 5.2).toFixed(1)} ${y.toFixed(1)}a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0 -10.4 0z`;
    }
  }
  const bun = style === 2 ? 'M43 13a7 7 0 1 0 14 0a7 7 0 1 0 -14 0z' : '';

  const eyes = r() < 0.3
    ? `<path d="M39 47q2.5 -2.6 5 0M56 47q2.5 -2.6 5 0" ${line}/>`
    : `<circle cx="41.5" cy="47" r="1.9" fill="${INK}"/><circle cx="58.5" cy="47" r="1.9" fill="${INK}"/>`;
  const brows = `<path d="M37.5 ${41 - tilt / 2}l7.5 ${tilt}M62.5 ${41 - tilt / 2}l-7.5 ${tilt}" ${line}/>`;
  const nose = `<path d="M50.5 48q-3 6.5 .6 7.6" ${line} stroke-width="1.6"/>`;
  const mouths = [
    `<path d="M44 60q6 5.2 12 0" ${line}/>`,
    `<path d="M43 59q7 8 14 0z" fill="#fff" ${off}/><path d="M43 59q7 8 14 0z" ${line}/>`,
    `<path d="M45 61.5h10" ${line}/>`,
    `<path d="M45 61q6 2.6 11 -2" ${line}/>`,
  ];
  const specs = glasses
    ? `<path d="M36.3 47a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0 -10.4 0zM53.3 47a5.2 5.2 0 1 0 10.4 0`
      + `a5.2 5.2 0 1 0 -10.4 0zM46.7 46.5q3.3 -1.6 6.6 0" ${line} stroke-width="1.6"/>`
    : '';
  const beardPath = beard
    ? shape(`M${50 - fw + 1} 52C${51 - fw} 70 42 74 50 74C58 74 ${49 + fw} 70 ${49 + fw} 52`
      + 'C64 62 58 64.5 50 64.5C42 64.5 36 62 ' + `${50 - fw + 1} 52Z`, hair)
    : '';

  const body = shape('M12 104C14 84 30 77 50 77C70 77 86 84 88 104Z', suit)
    + shape('M42 78L50 93L58 78Z', '#f4efe6')
    + shape('M48 81h4l1.6 13-3.6 4-3.6-4z', colour)
    + `<circle cx="70" cy="89" r="4.6" fill="${colour}" ${off}/>`
    + `<circle cx="70" cy="89" r="4.6" ${line} stroke-width="1.6"/>`;

  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">`
    + `<defs>${wobble(id)}<clipPath id="${id}c"><circle cx="50" cy="50" r="49"/></clipPath></defs>`
    + `<g clip-path="url(#${id}c)">`
    + `<circle cx="50" cy="50" r="49" fill="#f4ecdc"/>`
    + `<circle cx="50" cy="50" r="49" fill="${colour}" fill-opacity=".28"/>`
    + `<path d="M8 30l30-30M8 50l50-50M8 70l70-70M20 78l58-58" stroke="${colour}" stroke-opacity=".35" stroke-width="1.2"/>`
    + `<g filter="url(#${id})">`
    + (hairBack !== '' ? shape(hairBack, hair) : '')
    + body
    + shape('M44 64h12v14H44z', skin)
    + shape(head, skin)
    + `<circle cx="37" cy="55" r="3.6" fill="#e0776a" fill-opacity=".28"/>`
    + `<circle cx="63" cy="55" r="3.6" fill="#e0776a" fill-opacity=".28"/>`
    + beardPath
    + (hairTop !== '' ? shape(hairTop, hair) : '')
    + (curls !== '' ? shape(curls, hair) : '')
    + (bun !== '' ? shape(bun, hair) : '')
    + brows + eyes + nose + mouths[mouth] + specs
    + '</g></g>'
    + `<circle cx="50" cy="50" r="48.5" fill="none" stroke="${INK}" stroke-width="2"/>`
    + '</svg>';
}

/**
 * The crowd on election night: a block of little people, each coloured in as
 * their vote is counted.
 *
 * `order` says which candidate each figure voted for, already shuffled; the
 * first `shown` are coloured and the rest wait in pencil.
 */
export function crowd(order: readonly number[], colours: readonly string[], shown: number,
  cols = 12): string {
  const rows = Math.ceil(order.length / cols);
  const w = cols * 16 + 4, h = rows * 22 + 4;
  let out = '';
  for (let i = 0; i < order.length; i++) {
    const x = 2 + (i % cols) * 16 + ((Math.floor(i / cols) % 2) * 4 - 2);
    const y = 2 + Math.floor(i / cols) * 22;
    const on = i < shown;
    const fill = on ? colours[order[i]] ?? '#888' : 'none';
    const stroke = on ? INK : '#8a857c';
    out += `<g transform="translate(${x} ${y})">`
      + `<path d="M3 21c0-5 2.6-8 6-8s6 3 6 8z" fill="${fill}" stroke="${stroke}" stroke-width="1.3" stroke-linejoin="round"/>`
      + `<circle cx="9" cy="8" r="3.8" fill="${on ? '#f3d9bf' : 'none'}" stroke="${stroke}" stroke-width="1.3"/>`
      + '</g>';
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" aria-hidden="true">`
    + `<defs>${wobble('crowdw', 1.4)}</defs><g filter="url(#crowdw)">${out}</g></svg>`;
}
