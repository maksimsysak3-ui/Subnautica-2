# Team radio & commentary voices

The game speaks race-engineer and commentator lines during a Grand Prix.

- **Out of the box** it uses the browser's built-in speech engine, so it works
  with no setup.
- For the real ElevenLabs voices, bake the clips once:

```bash
ELEVENLABS_API_KEY=sk_your_key node tools/generate_radio.mjs
```

That reads `lines.json` (voice ids + line variants) and writes one mp3 per
variant into `engineer/` and `commentator/`, named `<event>_<index>.mp3` — the
exact paths the game loads. When a clip is present the game plays it; when it
isn't, it falls back to browser speech. Re-run after editing `lines.json`
(pass `FORCE=1` to overwrite existing clips).

Voice ids live in `lines.json` under `"voices"`.
