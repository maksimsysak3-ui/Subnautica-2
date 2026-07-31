#!/usr/bin/env node
/*
 * Bake the race-engineer + commentator radio clips with ElevenLabs.
 *
 *   ELEVENLABS_API_KEY=sk_xxx node tools/generate_radio.mjs
 *
 * Reads assets/radio/lines.json (voice ids + line variants) and writes one
 * mp3 per line variant to  assets/radio/engineer/<event>_<i>.mp3  and
 * assets/radio/commentator/<event>_<i>.mp3 — exactly the paths the game loads.
 * Re-run any time you edit lines.json; existing files are overwritten.
 *
 * Options (env):
 *   ELEVEN_MODEL   default "eleven_multilingual_v2"
 *   FORCE=1        re-render even if the mp3 already exists
 */
import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY;
if (!KEY) { console.error('Set ELEVENLABS_API_KEY first.'); process.exit(1); }
const MODEL = process.env.ELEVEN_MODEL || 'eleven_multilingual_v2';
const FORCE = !!process.env.FORCE;

const root = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const radioDir = path.join(root, 'assets', 'radio');
let lines;
try {
  lines = JSON.parse(await readFile(path.join(radioDir, 'lines.json'), 'utf8'));
} catch (e) {
  console.error(`Could not read assets/radio/lines.json: ${e.message}`);
  process.exit(1);
}
const problems = validate(lines);
if (problems.length) {
  console.error('lines.json is malformed:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
const voices = lines.voices;

// per-voice delivery: engineer calm & clear, commentator brighter & hyped
const settings = {
  engineer:    { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
  commentator: { stability: 0.35, similarity_boost: 0.8, style: 0.65, use_speaker_boost: true },
};

const exists = async (p) => { try { await access(p, constants.F_OK); return true; } catch { return false; } };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* One rate-limit blip used to permanently skip a line for the whole run, and you
   only found out by reading the log. Retry the failures that are worth retrying
   (429 and 5xx) with a backoff; a 4xx that is not 429 is a bad request or a bad
   key and will fail identically every time, so it fails fast. */
async function tts(voiceId, text, voiceSettings, tries = 4) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    if (attempt) await sleep(800 * 2 ** (attempt - 1));
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: MODEL, voice_settings: voiceSettings }),
      });
    } catch (e) { lastErr = e; continue; }        // network blip — worth another go
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const body = (await res.text()).slice(0, 200);
    lastErr = new Error(`${res.status} ${res.statusText}: ${body}`);
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable) break;
  }
  throw lastErr;
}

/* Fail loudly on a malformed lines.json rather than throwing a bare TypeError
   from somewhere deep in the loop. */
function validate(lines) {
  const problems = [];
  if (!lines || typeof lines !== 'object') return ['lines.json is not an object'];
  if (!lines.voices || typeof lines.voices !== 'object') problems.push('missing "voices" object');
  for (const kind of ['engineer', 'commentator']) {
    const block = lines[kind];
    if (block === undefined) continue;
    if (typeof block !== 'object' || Array.isArray(block)) { problems.push(`"${kind}" must be an object of event -> array`); continue; }
    for (const [event, variants] of Object.entries(block)) {
      if (!Array.isArray(variants)) { problems.push(`${kind}.${event} must be an array of strings`); continue; }
      variants.forEach((v, i) => {
        if (typeof v !== 'string' || !v.trim()) problems.push(`${kind}.${event}[${i}] must be a non-empty string`);
      });
    }
  }
  return problems;
}

let made = 0, skipped = 0, failed = 0;
for (const kind of ['engineer', 'commentator']) {
  const voiceId = voices[kind];
  if (!voiceId) { console.warn(`No voice id for ${kind}, skipping.`); continue; }
  const outDir = path.join(radioDir, kind);
  await mkdir(outDir, { recursive: true });
  for (const [event, variants] of Object.entries(lines[kind] || {})) {
    for (let i = 0; i < variants.length; i++) {
      const out = path.join(outDir, `${event}_${i}.mp3`);
      if (!FORCE && await exists(out)) { skipped++; continue; }
      try {
        const buf = await tts(voiceId, variants[i], settings[kind]);
        await writeFile(out, buf);
        made++; console.log(`✓ ${kind}/${event}_${i}.mp3`);
        await sleep(350);                             // gentle rate limit
      } catch (e) { failed++; console.error(`✗ ${kind}/${event}_${i}: ${e.message}`); }
    }
  }
}
console.log(`\nDone — ${made} rendered, ${skipped} skipped, ${failed} failed.`);
/* Exit non-zero when anything failed. This used to always exit 0, so a run that
   silently produced half the clips looked exactly like a clean one to CI or to
   any script chaining off it. */
if (failed) {
  console.error(`\n${failed} clip(s) did not render — re-run to retry just those.`);
  process.exitCode = 1;
}
