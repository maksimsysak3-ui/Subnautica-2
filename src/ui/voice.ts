// Commentary voice: the browser's own speech synthesis, so it costs nothing and needs no
// downloads. The best English voice on the machine is used; lines never queue up.

// ---- commentary voice (browser speech synthesis) ----------------------------------------------
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
let voice: SpeechSynthesisVoice | null | undefined;
function pickVoice() {
  if (voice !== undefined) return voice;
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return null;
  const en = vs.filter(v => /^en(-|_)/i.test(v.lang));
  // A natural-sounding US English voice if there is one, preferring male broadcast-style voices.
  voice = en.find(v => /natural|neural|premium|enhanced/i.test(v.name) && /en-US/i.test(v.lang)) ?? en.find(v => /(guy|davis|tony|aaron|alex|daniel|fred|male)/i.test(v.name)) ?? en.find(v => /en-US/i.test(v.lang)) ?? en[0] ?? null;
  return voice;
}
export function speak(text: string) {
  if (!canSpeak) return;
  try {
    speechSynthesis.cancel();   // never queue up stale lines behind the play
    const u = new SpeechSynthesisUtterance(text.replace(/([A-Z])\. /g, '$1 '));
    const v = pickVoice(); if (v) u.voice = v;
    u.rate = 1.07; u.pitch = 0.92; u.volume = 1;
    speechSynthesis.speak(u);
  } catch { /* speech unavailable */ }
}

export const voiceOn = () => { try { return localStorage.getItem('gg-voice') === '1'; } catch { return false; } };
