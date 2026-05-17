/* OpeningOS — sound effects via Web Audio
 * Tiny synthesised tones, no external assets. Off by default; respects the
 * Settings.sound toggle.
 */
(function (global) {
  'use strict';

  let ctx = null;
  let enabled = false;

  function ensureCtx() {
    if (!ctx) {
      try { ctx = new (global.AudioContext || global.webkitAudioContext)(); }
      catch (_) { ctx = null; }
    }
    return ctx;
  }

  function tone({ freq = 440, duration = 0.06, type = 'sine', gain = 0.05, slide = 0 }) {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t0 + duration);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + duration + 0.02);
  }

  const Audio = {
    setEnabled(on) { enabled = !!on; if (on) ensureCtx(); },
    move()    { tone({ freq: 480, duration: 0.05 }); },
    capture() { tone({ freq: 320, duration: 0.08, type: 'triangle' }); },
    check()   { tone({ freq: 660, duration: 0.10, type: 'square', slide: -120, gain: 0.04 }); },
    correct() { tone({ freq: 660, duration: 0.06, slide: 240 }); },
    wrong()   { tone({ freq: 220, duration: 0.14, type: 'sawtooth', gain: 0.04, slide: -80 }); },
    click()   { tone({ freq: 900, duration: 0.02, gain: 0.02 }); },
  };

  global.OOSAudio = Audio;
})(window);
