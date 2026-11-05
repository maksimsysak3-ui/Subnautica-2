// Real club kits from English Wikipedia: npx tsx fc/tools/import-kits.ts [slug ...]
//
// For every club in logos.json this finds the club's Wikipedia article (via Wikidata search),
// reads the infobox kit parameters (body / sleeve / shorts / socks colours for the home, away and
// third kits) and downloads the kit's body overlay image from Wikimedia Commons. The overlay is
// composited onto the body colour and measured, so stripes, hoops, halves and sashes that only
// exist in the image are detected, and the real dominant colours are used.
//
// Output: fc/src/data/kits.json (committed). Every HTTP response is cached under .cache/fc-kits,
// so re-runs are offline and only new or failed clubs touch the network. Pass slugs to redo only
// those clubs (their cached responses are reused; delete .cache/fc-kits to force a refetch).
// Behind an HTTPS proxy, run with NODE_USE_ENV_PROXY=1 (Node >= 22.21) so fetch uses it.
//
// Kit colours are facts and the generated data holds no images, so nothing copyrighted lands in
// the repository; only colours, a pattern name and the source article title are stored.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { CLUB_META, type KitPattern } from '../src/data/clubs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOGOS = JSON.parse(readFileSync(join(HERE, '../src/data/logos.json'), 'utf8')) as { clubs: Record<string, [string, string, string, string]> };
const OUT = join(HERE, '../src/data/kits.json');
const CACHE = join(HERE, '../../.cache/fc-kits');
const UA = 'FCSimKitTool/0.1 (https://github.com/maksimsysak3-ui/Subnautica-2; hobby game kit-colour import)';

/** Articles Wikidata search gets wrong or cannot find. Checked by hand. */
const TITLE_OVERRIDES: Record<string, string> = {
  'river-plate': 'Club Atlético River Plate',
  'boca-juniors': 'Boca Juniors',
  'celta': 'RC Celta de Vigo',
  'deportivo-la-coruna': 'Deportivo de La Coruña',
  'elche': 'Elche CF',
  'juventus': 'Juventus FC',
  'st-pauli': 'FC St. Pauli',
};

type Kit = [body: string, trim: string, pattern: KitPattern, sleeve: string, shorts: string, socks: string];
interface ClubKits { wp: string; h: Kit; a?: Kit; t?: Kit }

// ---- network with cache, pacing and 429 back-off ----------------------------------------------
const lastHit: Record<string, number> = {};
const GAP: Record<string, number> = { 'en.wikipedia.org': 800, 'upload.wikimedia.org': 1500, 'query.wikidata.org': 1000 };
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
/** Hosts that answered with a long penalty; skipped for the rest of the run. */
const blocked = new Set<string>();
/** Overlay patterns that were actually measured from their image this run. */
const measured = new Set<string>();

async function get(url: string, binary = false): Promise<{ status: number; body: Buffer }> {
  const key = createHash('sha1').update(url).digest('hex');
  const file = join(CACHE, key);
  if (existsSync(file)) {
    const raw = readFileSync(file);
    return { status: raw.readUInt16BE(0), body: raw.subarray(2) };
  }
  const host = new URL(url).host;
  if (blocked.has(host)) return { status: 429, body: Buffer.alloc(0) };
  for (let attempt = 0; attempt < 7; attempt++) {
    const gap = (GAP[host] ?? 1000) - (Date.now() - (lastHit[host] ?? 0));
    if (gap > 0) await wait(gap);
    lastHit[host] = Date.now();
    let res: Response;
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA, Accept: binary ? 'image/png' : 'application/json, text/plain, */*' }, signal: AbortSignal.timeout(30_000) });
    } catch (e) {
      console.error(`  network error on ${host}: ${(e as Error).message}`);
      await wait(2000 * 2 ** attempt);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      const ra = Number(res.headers.get('retry-after'));
      console.error(`  ${res.status} from ${host}, retry ${attempt + 1} (retry-after ${res.headers.get('retry-after') ?? '-'})`);
      if (ra > 300) { blocked.add(host); console.error(`  ${host} is rate-limiting this address for ${ra}s: skipping it this run`); return { status: 429, body: Buffer.alloc(0) }; }
      await wait(Math.max(Number.isFinite(ra) ? ra * 1000 : 0, 3000 * 2 ** attempt));
      continue;
    }
    const body = Buffer.from(await res.arrayBuffer());
    // Cache only definitive answers: content and genuine "not found".
    if (res.ok || res.status === 404) {
      mkdirSync(CACHE, { recursive: true });
      const head = Buffer.alloc(2); head.writeUInt16BE(res.status);
      writeFileSync(file, Buffer.concat([head, body]));
    }
    return { status: res.status, body };
  }
  return { status: 0, body: Buffer.alloc(0) };
}

// ---- finding the article ------------------------------------------------------------------------
const NOT_FIRST_TEAM = { test: (t: string) => /women|femen|féminin|frauen|femminile|ladies|reserves|academy|youth|under-\d+|\bU-?\d\d\b|\bW\.?F\.?C\b|\bL\.?F\.?C\b|futsal|basketball|rugby/i.test(t) || /\s(B|C|II|III)(\s|$)/.test(t) };

async function searchTitles(name: string): Promise<string[]> {
  const q = `SELECT ?title WHERE {
    SERVICE wikibase:mwapi { bd:serviceParam wikibase:api "EntitySearch"; wikibase:endpoint "www.wikidata.org";
      mwapi:search ${JSON.stringify(name)}; mwapi:language "en". ?item wikibase:apiOutputItem mwapi:item. ?num wikibase:apiOrdinal true. }
    ?item wdt:P31/wdt:P279* wd:Q476028.
    ?a schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?title.
  } ORDER BY ?num LIMIT 6`;
  const { status, body } = await get(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`);
  if (status !== 200) return [];
  const rows = (JSON.parse(body.toString()) as { results: { bindings: { title: { value: string } }[] } }).results.bindings;
  return [...new Set(rows.map(r => r.title.value))].filter(t => !NOT_FIRST_TEAM.test(t));
}

async function wikitext(title: string): Promise<{ title: string; text: string } | null> {
  for (let hop = 0; hop < 3; hop++) {
    const { status, body } = await get(`https://en.wikipedia.org/w/index.php?action=raw&title=${encodeURIComponent(title.replace(/ /g, '_'))}`);
    if (status !== 200) return null;
    const text = body.toString();
    const redirect = /^#REDIRECT\s*\[\[([^\]|#]+)/i.exec(text);
    if (!redirect) return { title, text };
    title = redirect[1].trim();
  }
  return null;
}

// ---- infobox parsing ----------------------------------------------------------------------------
function param(text: string, name: string): string | undefined {
  const m = new RegExp(`^\\s*\\|\\s*${name}\\s*=([^\\n|]*)`, 'm').exec(text);
  return m?.[1].trim();
}
function hex(v: string | undefined): string | undefined {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})\b/i.exec(v ?? '');
  if (!m) return undefined;
  const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1];
  return '#' + h.toUpperCase();
}

// ---- colour maths -------------------------------------------------------------------------------
type RGB = [number, number, number];
const toRgb = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (c: RGB) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
/** "Redmean" weighted RGB distance: cheap and close enough to perceived difference. */
function dist(a: RGB, b: RGB) {
  const r = (a[0] + b[0]) / 2, dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt((2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db);
}

/** Composite the overlay onto the base colour and measure the torso. */
function analyse(png: PNG, base: RGB): { body: RGB; trim?: RGB; pattern: KitPattern } {
  const { width: w, height: h, data } = png;
  // Torso only: skip the collar and shoulder trim rows and the hem, and a column at each edge.
  const x0 = Math.round(w * 0.08), x1 = Math.round(w * 0.92), y0 = Math.round(h * 0.22), y1 = Math.round(h * 0.95);
  const W = x1 - x0, H = y1 - y0;
  const px: RGB[] = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * w + x) * 4, a = data[i + 3] / 255;
    px.push([data[i] * a + base[0] * (1 - a), data[i + 1] * a + base[1] * (1 - a), data[i + 2] * a + base[2] * (1 - a)]);
  }
  // Greedy clustering: biggest colour absorbs everything near it, repeat.
  const hist = new Map<string, { c: RGB; n: number }>();
  for (const c of px) {
    const k = c.map(v => v >> 4).join(',');
    const e = hist.get(k); if (e) e.n++; else hist.set(k, { c, n: 1 });
  }
  let pool = [...hist.values()].sort((a, b) => b.n - a.n);
  const clusters: { c: RGB; n: number }[] = [];
  while (pool.length && clusters.length < 6) {
    const seed = pool[0].c;
    const near = pool.filter(e => dist(e.c, seed) < 90);
    pool = pool.filter(e => dist(e.c, seed) >= 90);
    const n = near.reduce((s, e) => s + e.n, 0);
    clusters.push({ c: near.reduce((s, e) => [s[0] + e.c[0] * e.n / n, s[1] + e.c[1] * e.n / n, s[2] + e.c[2] * e.n / n] as RGB, [0, 0, 0] as RGB), n });
  }
  const total = px.length;
  const body = clusters[0].c;
  const second = clusters.slice(1).find(c => c.n / total >= 0.06 && dist(c.c, body) >= 120);
  if (!second) {
    const accent = clusters.slice(1).find(c => c.n / total >= 0.03 && dist(c.c, body) >= 120);
    return { body, trim: accent?.c, pattern: 'plain' };
  }
  // Pattern from where the second colour sits.
  const m = px.map(c => dist(c, second.c) < dist(c, body));
  const col = Array.from({ length: W }, (_, x) => { let s = 0; for (let y = 0; y < H; y++) s += +m[y * W + x]; return s / H; });
  const row = Array.from({ length: H }, (_, y) => { let s = 0; for (let x = 0; x < W; x++) s += +m[y * W + x]; return s / W; });
  const variance = (v: number[]) => { const mu = v.reduce((a, b) => a + b, 0) / v.length; return v.reduce((a, b) => a + (b - mu) ** 2, 0) / v.length; };
  const flips = (v: number[]) => v.slice(1).reduce((n, x, i) => n + +((x > 0.5) !== (v[i] > 0.5)), 0);
  const cv = variance(col), rv = variance(row), cf = flips(col), rf = flips(row), share = second.n / total;
  let inDiag = 0, nDiag = 0, outDiag = 0, nOut = 0, inDiag2 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, t = y / H, on = +m[y * W + x];
    if (Math.abs(u - t) < 0.2) { inDiag += on; nDiag++; } else { outDiag += on; nOut++; }
    if (Math.abs(u - (1 - t)) < 0.2) inDiag2 += on;
  }
  const leftShare = col.slice(0, W >> 1).reduce((a, b) => a + b, 0) / (W >> 1), rightShare = col.slice(W >> 1).reduce((a, b) => a + b, 0) / (W - (W >> 1));
  const centre = col.slice(Math.round(W * 0.4), Math.round(W * 0.6)).reduce((a, b) => a + b, 0) / Math.max(1, Math.round(W * 0.6) - Math.round(W * 0.4));

  let pattern: KitPattern = 'plain';
  if (cv > rv * 2 && cf >= 4) pattern = share < 0.2 && cf >= 6 ? 'pinstripe' : 'stripes';
  else if (rv > cv * 2 && rf >= 4) pattern = 'hoops';
  else if (cv > rv * 2 && Math.abs(leftShare - rightShare) > 0.7) pattern = 'halves';
  else if (cv > rv * 2 && cf === 2 && centre > 0.7) pattern = 'band';
  else if (rv > cv * 2 && rf === 2) pattern = 'hband';
  else if (Math.max(inDiag, inDiag2) / nDiag > 0.6 && outDiag / nOut < 0.25) pattern = 'sash';
  // Two colours of similar size: the body is whichever is not the pattern. For halves and
  // stripes either reading is valid, so keep the more common colour as the body.
  return { body, trim: second.c, pattern };
}

async function overlay(pattern: string): Promise<PNG | null> {
  const file = `Kit_body${pattern.replace(/ /g, '_')}.png`;
  const md5 = createHash('md5').update(file).digest('hex');
  for (const wiki of ['commons', 'en']) {
    const { status, body } = await get(`https://upload.wikimedia.org/wikipedia/${wiki}/${md5[0]}/${md5.slice(0, 2)}/${encodeURIComponent(file)}`, true);
    if (status === 200) { try { return PNG.sync.read(body); } catch { return null; } }
  }
  return null;
}

/** Generic Wikipedia patterns are named after what they draw (_thinstripes, _hoops_white...). */
function patternFromName(p: string): KitPattern {
  if (/pinstripe|thinstripe|thinsidestripe/i.test(p)) return 'pinstripe';
  if (/stripe/i.test(p) && !/side|shoulder|sleeve|collar/i.test(p)) return 'stripes';
  if (/hoop/i.test(p)) return 'hoops';
  if (/sash/i.test(p)) return 'sash';
  if (/halves|half/i.test(p)) return 'halves';
  if (/quarter/i.test(p)) return 'quarters';
  return 'plain';
}

async function readKit(text: string, n: 1 | 2 | 3): Promise<Kit | undefined> {
  // Some clubs leave body blank and rely on the image alone; their sleeves carry the colour.
  // Others leave every colour blank: then only the image knows, so it must be measured.
  const given = hex(param(text, `body${n}`)) ?? hex(param(text, `leftarm${n}`)) ?? hex(param(text, `rightarm${n}`));
  const pat = param(text, `pattern_b${n}`);
  const png = pat && pat.startsWith('_') ? await overlay(pat) : null;
  if (!given && !png) return undefined;
  let main: RGB = toRgb(given ?? '#FFFFFF'), trim: RGB | undefined, pattern: KitPattern = 'plain';
  if (png) { measured.add(pat!); ({ body: main, trim, pattern } = analyse(png, main)); }
  else if (pat) pattern = patternFromName(pat);
  const bodyHex = toHex(main);
  const sleeve = hex(param(text, `leftarm${n}`)) ?? bodyHex;
  const shorts = hex(param(text, `shorts${n}`)) ?? bodyHex;
  const socks = hex(param(text, `socks${n}`)) ?? shorts;
  // A plain shirt with contrasting sleeves keeps the old 'sleeves' look.
  if (pattern === 'plain' && dist(toRgb(sleeve), main) >= 120) { pattern = 'sleeves'; trim ??= toRgb(sleeve); }
  // Trim colour for collars and numbers: the pattern colour, else the sleeves, shorts or socks
  // when they contrast, else plain white or black.
  const trimHex = trim ? toHex(trim)
    : [sleeve, shorts, socks].find(c => dist(toRgb(c), main) >= 120) ?? ((main[0] * 0.299 + main[1] * 0.587 + main[2] * 0.114) > 150 ? '#111111' : '#FFFFFF');
  return [bodyHex, trimHex, pattern, sleeve, shorts, socks];
}

// ---- main ---------------------------------------------------------------------------------------
async function main() {
  const only = new Set(process.argv.slice(2));
  const prev: { clubs: Record<string, ClubKits> } = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { clubs: {} };
  const clubs: Record<string, ClubKits> = only.size ? { ...prev.clubs } : {};
  const missed: string[] = [];
  const slugs = Object.keys(LOGOS.clubs).filter(s => !only.size || only.has(s));
  let i = 0;
  for (const slug of slugs) {
    i++;
    const name = CLUB_META[slug]?.name ?? LOGOS.clubs[slug][2];
    const tried: string[] = [];
    // Cheap guesses on Wikipedia first (redirects resolve most names); Wikidata search after.
    const names = [...new Set([name, LOGOS.clubs[slug][2]])];
    const guesses = names.flatMap(n => [`${n} F.C.`, `${n} FC`, n]);
    const candidates = TITLE_OVERRIDES[slug] ? [TITLE_OVERRIDES[slug]] : [
      ...(prev.clubs[slug] && !NOT_FIRST_TEAM.test(prev.clubs[slug].wp) ? [prev.clubs[slug].wp] : []),
      ...guesses,
      async () => (await Promise.all(names.map(searchTitles))).flat(),
    ];
    let done = false;
    const queue = [...candidates];
    while (queue.length && !done) {
      const next = queue.shift()!;
      if (typeof next === 'function') { queue.push(...await next()); continue; }
      const cand = next;
      if (tried.includes(cand)) continue;
      tried.push(cand);
      const page = await wikitext(cand);
      if (!page || NOT_FIRST_TEAM.test(page.title) || !/\{\{\s*Infobox football club/i.test(page.text)) continue;
      const h = await readKit(page.text, 1);
      if (!h) continue;
      const meta = CLUB_META[slug];
      if (meta && meta.kit !== 'plain' && meta.kit !== 'sleeves' && (h[2] === 'plain' || h[2] === 'sleeves') && !measured.has(param(page.text, 'pattern_b1') ?? '')) {
        // Image unavailable: trust the hand-entered pattern, oriented to the colours Wikipedia gives.
        const c1 = toRgb(meta.c1), c2 = toRgb(meta.c2), b = toRgb(h[0]);
        h[2] = meta.kit;
        if (dist(b, c2) < dist(b, c1)) { h[0] = meta.c2.toUpperCase(); h[1] = meta.c1.toUpperCase(); } else { h[0] = meta.c1.toUpperCase(); h[1] = meta.c2.toUpperCase(); }
      }
      clubs[slug] = { wp: page.title, h, a: await readKit(page.text, 2), t: await readKit(page.text, 3) };
      const k = clubs[slug];
      console.log(`${String(i).padStart(3)}/${slugs.length} ${slug.padEnd(26)} ${page.title.padEnd(34)} H ${k.h.slice(0, 3).join(' ')}  A ${k.a?.slice(0, 3).join(' ') ?? '-'}`);
      done = true;
    }
    if (!done) { missed.push(`${slug} (${name}) tried: ${tried.join(' | ') || 'no search results'}`); console.log(`${String(i).padStart(3)}/${slugs.length} ${slug.padEnd(26)} MISSING`); }
  }
  const sorted = Object.fromEntries(Object.entries(clubs).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUT, JSON.stringify({
    source: 'English Wikipedia club infoboxes; patterns measured from Wikimedia Commons kit images',
    generated: new Date().toISOString().slice(0, 10),
    clubs: sorted,
  }) + '\n');
  console.log(`\n${Object.keys(sorted).length}/${Object.keys(LOGOS.clubs).length} clubs written to ${OUT}`);
  if (missed.length) console.log(`Missing ${missed.length}:\n  ${missed.join('\n  ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
