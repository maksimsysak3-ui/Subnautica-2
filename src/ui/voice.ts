// Commentary voice: the browser's own speech synthesis, so it costs nothing and needs no
// downloads. The best English voice on the machine is used; lines never queue up. It is
// on by default where the browser supports it (Chrome, Edge, Safari, Firefox), and can be
// switched off in Options → Broadcast or in a game's control panel.
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

let voice: SpeechSynthesisVoice | null = null;
function pickVoice(): SpeechSynthesisVoice | null {
  if (voice) return voice;
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return null;
  const en = vs.filter(v => /^en(-|_)/i.test(v.lang));
  // A natural-sounding US English voice if there is one, preferring male broadcast-style voices.
  voice = en.find(v => /natural|neural|premium|enhanced|online/i.test(v.name) && /en-US/i.test(v.lang)) ?? en.find(v => /(guy|davis|tony|aaron|alex|daniel|fred|male|christopher|eric)/i.test(v.name)) ?? en.find(v => /en-US/i.test(v.lang)) ?? en[0] ?? null;
  return voice;
}
// Chrome loads its voice list late; pick again once it arrives.
if (canSpeak) try { speechSynthesis.addEventListener?.('voiceschanged', () => { voice = null; pickVoice(); }); } catch { /* old browser */ }

export function speak(text: string) {
  if (!canSpeak) return;
  try {
    speechSynthesis.cancel();   // never queue up stale lines behind the play
    const u = new SpeechSynthesisUtterance(text.replace(/([A-Z])\. /g, '$1 '));
    const v = pickVoice(); if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-US'; u.rate = 1.07; u.pitch = 0.92; u.volume = 1;
    speechSynthesis.resume();   // Chrome can leave the queue paused
    speechSynthesis.speak(u);
  } catch { /* speech unavailable */ }
}
export const stopSpeaking = () => { try { speechSynthesis.cancel(); } catch { /* none */ } };

const KEY = 'gg-voice';
/** On unless the player switched it off. */
export const voiceOn = () => { if (!canSpeak) return false; try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } };
export const setVoice = (on: boolean) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage blocked */ } if (!on) stopSpeaking(); };
