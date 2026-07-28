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
const lines = JSON.parse(await readFile(path.join(radioDir, 'lines.json'), 'utf8'));
const voices = lines.voices;

// per-voice delivery: engineer calm & clear, commentator brighter & hyped
const settings = {
  engineer:    { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
  commentator: { stability: 0.35, similarity_boost: 0.8, style: 0.65, use_speaker_boost: true },
};

const exists = async (p) => { try { await access(p, constants.F_OK); return true; } catch { return false; } };

async function tts(voiceId, text, voiceSettings) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: voiceSettings }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
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
        await new Promise(r => setTimeout(r, 350));   // gentle rate limit
      } catch (e) { failed++; console.error(`✗ ${kind}/${event}_${i}: ${e.message}`); }
    }
  }
}
console.log(`\nDone — ${made} rendered, ${skipped} skipped, ${failed} failed.`);
