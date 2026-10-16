/* ==========================================================================
   现金流小富翁 v2 · WebAudio 程序合成音效
   零外部资源，全部用振荡器实时合成
   ========================================================================== */
(function (global) {
  'use strict';

  let ctx = null;
  let enabled = true;
  let master = null;

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, dur, type, vol, delay, slideTo) {
    if (!enabled || !ctx) return;
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol == null ? 0.6 : vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, delay) {
    if (!enabled || !ctx) return;
    const t0 = ctx.currentTime + (delay || 0);
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol == null ? 0.3 : vol;
    src.connect(g); g.connect(master);
    src.start(t0);
  }

  const SFX = {
    /* 基础 */
    click:   () => tone(660, 0.06, 'square', 0.25),
    dice:    () => { noise(0.18, 0.22); tone(320, 0.12, 'triangle', 0.3, 0.05); tone(480, 0.1, 'triangle', 0.25, 0.14); },
    step:    () => tone(520, 0.05, 'sine', 0.18),
    land:    () => { tone(300, 0.1, 'sine', 0.35); tone(200, 0.14, 'sine', 0.25, 0.06); },
    turn:    () => tone(440, 0.12, 'sine', 0.22),
    start:   () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.3, i * 0.11)); },

    /* 金钱 */
    income:  () => { tone(880, 0.09, 'sine', 0.3); tone(1174, 0.12, 'sine', 0.28, 0.08); },
    expense: () => { tone(400, 0.1, 'sine', 0.28, 0); tone(300, 0.14, 'sine', 0.24, 0.09); },
    buy:     () => { tone(520, 0.08, 'triangle', 0.28); tone(780, 0.1, 'triangle', 0.26, 0.07); },
    sell:    () => { tone(700, 0.08, 'triangle', 0.26); tone(520, 0.1, 'triangle', 0.24, 0.07); },
    rent:    () => { [660, 880, 1100].forEach((f, i) => tone(f, 0.1, 'square', 0.16, i * 0.07)); },

    /* 建造 */
    build:   () => { noise(0.1, 0.2); tone(300, 0.1, 'square', 0.2, 0.04); tone(450, 0.1, 'square', 0.2, 0.12); tone(600, 0.14, 'triangle', 0.24, 0.2); },

    /* 卡片 / 事件 */
    card:    () => { tone(900, 0.07, 'square', 0.2); tone(1200, 0.09, 'square', 0.18, 0.06); },
    info:    () => tone(700, 0.1, 'sine', 0.24),
    alert:   () => { tone(300, 0.16, 'sawtooth', 0.22); tone(240, 0.2, 'sawtooth', 0.2, 0.12); },
    lucky:   () => { [784, 988, 1319].forEach((f, i) => tone(f, 0.14, 'triangle', 0.26, i * 0.08)); },
    badge:   () => { [880, 1108, 1318, 1760].forEach((f, i) => tone(f, 0.13, 'sine', 0.24, i * 0.07)); },

    /* 股票 */
    stockUp:   () => { tone(700, 0.09, 'sine', 0.24); tone(1000, 0.12, 'sine', 0.22, 0.08); },
    stockDown: () => { tone(500, 0.1, 'sine', 0.24); tone(330, 0.14, 'sine', 0.22, 0.09); },

    /* 神明 */
    god:     () => { [523, 659, 880].forEach((f, i) => tone(f, 0.3, 'sine', 0.2, i * 0.1)); },

    /* 特殊 */
    jail:    () => { tone(180, 0.25, 'square', 0.22); tone(140, 0.3, 'square', 0.2, 0.18); },
    lottery: () => { for (let i = 0; i < 5; i++) tone(600 + i * 120, 0.08, 'triangle', 0.2, i * 0.06); },

    /* 结局 */
    win:     () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.3, i * 0.13)); },
    fail:    () => { tone(300, 0.3, 'sawtooth', 0.24); tone(200, 0.4, 'sawtooth', 0.2, 0.2); tone(140, 0.5, 'sawtooth', 0.18, 0.4); },
  };

  function play(name) {
    if (!enabled) return;
    unlock();
    const fn = SFX[name];
    if (fn) { try { fn(); } catch (e) {} }
  }

  function setEnabled(v) { enabled = !!v; if (v) unlock(); }
  function isEnabled() { return enabled; }

  global.SFX = { play, setEnabled, isEnabled, unlock };
})(window);
