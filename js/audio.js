/* ==========================================================================
   现金流小富翁 · 音效层
   使用 WebAudio 现场合成，无外部资源依赖。
   ========================================================================== */
(function (global) {
  'use strict';

  let ctx = null;
  let enabled = true;
  let master = null;

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.22;
        master.connect(ctx.destination);
      } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  /* 播放一个音符 */
  function tone(freq, dur, type, gainMul, delay, freqEnd) {
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    }
    const peak = (gainMul == null ? 1 : gainMul);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /* 噪声（用于骰子滚动 / 卡片） */
  function noise(dur, gainMul, delay, filterFreq) {
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = filterFreq || 1800;
    f.Q.value = 0.9;
    const g = c.createGain();
    g.gain.value = gainMul == null ? 0.6 : gainMul;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  const SFX = {
    /* 骰子滚动 */
    dice() {
      for (let i = 0; i < 6; i++) {
        noise(0.05, 0.35, i * 0.075, 1400 + Math.random() * 1600);
      }
    },
    /* 落格 */
    land() {
      tone(520, 0.09, 'triangle', 0.5);
      tone(780, 0.13, 'triangle', 0.35, 0.06);
    },
    /* 移动一步 */
    step() {
      tone(660, 0.035, 'square', 0.12);
    },
    /* 收钱 / 收入（上行三音） */
    income() {
      tone(523.25, 0.11, 'sine', 0.7, 0);
      tone(659.25, 0.11, 'sine', 0.7, 0.085);
      tone(783.99, 0.20, 'sine', 0.75, 0.17);
    },
    /* 花钱 / 支出（下行双音） */
    expense() {
      tone(392.00, 0.13, 'sine', 0.65, 0);
      tone(293.66, 0.24, 'sine', 0.6, 0.10);
    },
    /* 买入资产（清脆） */
    buy() {
      tone(880, 0.08, 'triangle', 0.6, 0);
      tone(1174.66, 0.16, 'triangle', 0.55, 0.07);
      tone(1567.98, 0.20, 'sine', 0.4, 0.14);
    },
    /* 出售 / 变现 */
    sell() {
      tone(1046.5, 0.09, 'triangle', 0.5, 0);
      tone(783.99, 0.14, 'triangle', 0.5, 0.07);
    },
    /* 按钮 */
    click() { tone(1200, 0.03, 'square', 0.1); },
    /* 提示 / 信息 */
    info() { tone(880, 0.09, 'sine', 0.32); tone(1108.73, 0.11, 'sine', 0.28, 0.07); },
    /* 警告 / 意外 */
    alert() {
      tone(340, 0.13, 'sawtooth', 0.35, 0);
      tone(300, 0.16, 'sawtooth', 0.32, 0.13);
    },
    /* 转机 / 好运 */
    lucky() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(f, 0.16, 'sine', 0.6, i * 0.075));
    },
    /* 成就解锁 */
    badge() {
      [659.25, 830.61, 987.77, 1318.51].forEach((f, i) =>
        tone(f, 0.22, 'triangle', 0.5, i * 0.09));
    },
    /* 胜利 */
    win() {
      const seq = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      seq.forEach((f, i) => {
        tone(f, 0.30, 'sine', 0.62, i * 0.15);
        tone(f / 2, 0.30, 'triangle', 0.24, i * 0.15);
      });
      tone(1567.98, 0.9, 'sine', 0.5, 0.78);
    },
    /* 失败 / 亏损 */
    fail() {
      tone(392, 0.24, 'sawtooth', 0.32, 0);
      tone(311.13, 0.30, 'sawtooth', 0.3, 0.18);
      tone(233.08, 0.55, 'sine', 0.34, 0.36);
    },
    /* 回合切换 */
    turn() { tone(587.33, 0.07, 'sine', 0.28); tone(880, 0.09, 'sine', 0.22, 0.06); },
  };

  global.SFX = {
    play(name) {
      if (!enabled) return;
      const fn = SFX[name];
      if (fn) { try { fn(); } catch (e) {} }
    },
    setEnabled(v) {
      enabled = !!v;
      if (enabled) ensure();
    },
    isEnabled() { return enabled; },
    unlock() { ensure(); },
  };

})(window);
