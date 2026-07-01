// Tiny sound effects synthesised with the Web Audio API — no audio files to
// bundle/cache, works offline, and always plays inside a user gesture (button
// taps) so autoplay policies allow it. Fully best-effort: any failure (no
// AudioContext, muted, etc.) is swallowed silently.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/**
 * A short, cheerful rising three-note chime (~0.5s) — played on a habit/proof
 * "marked done" success. Soft triangle tone so it feels like a friendly ding,
 * not a system beep.
 */
export function playSuccessChime() {
  try {
    const ac = getCtx();
    if (!ac) return;
    const now = ac.currentTime;
    // C6 → E6 → G6, each a beat after the last.
    const notes: Array<[number, number]> = [
      [1046.5, 0],
      [1318.5, 0.09],
      [1567.98, 0.18],
    ];
    for (const [freq, at] of notes) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t0 = now + at;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.32);
    }
  } catch {
    /* best-effort — never let a sound break the action */
  }
}
