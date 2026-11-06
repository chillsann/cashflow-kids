/* ==========================================================================
   现金流小富翁 v3.2 · 量价行情引擎 MarketEngine
   --------------------------------------------------------------------------
   为什么要有这个模块：v3.1 的股价是「随机游走 + 均值回归」，开高低收由收盘
   价反推，没有成交量 —— 既画不出真实行情软件那样的图，也走不出任何技术形态。

   本模块把行情改成「阶段状态机 + 量价耦合」：
     吸筹(accumulate) → 放量突破(breakout) → 趋势(trend) → 派发(distribute)
       → 下跌(downtrend) → 整理(box) → 放量突破 … 循环
   每根 K 线同时决定价格与成交量，遵守量价体系的基本规律：
     · 价涨量增、价跌量缩（趋势健康）
     · 突破必须放量（量比 ≥ 1.8），且常伴跳空缺口
     · 缩量回踩不破均线（洗盘，趋势未坏）
     · 顶部价创新高而量萎缩（量价背离 / 放量滞涨 → 见顶）
     · 底部地量地价 + 长下影 / 锤子线 / 十字星（变盘前兆）
     · 放量长阴杀跌（恐慌）后缩量阴跌，反弹无量
   并生成可识别的 K 线组合：锤子线、射击之星、十字星、吞没、红三兵、
   跳空突破、光头光脚长阳等。最后用 MA / MACD / 量比做形态识别，输出
   给面板的技术信号（教学 + 决策参考）。

   K 线结构：{ o, h, l, c, v, day, form }
     v = 成交量（手）；day = 第 N 个营业日；form = 该根生成的形态标记
   ========================================================================== */
(function (global) {
  'use strict';

  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /* 股价保留 2 位小数：真实股市本就如此，也避免 8 元低价股被整数取整抹平波动 */
  const r2 = v => Math.max(0.01, Math.round(v * 100) / 100);
  const r1 = v => Math.max(1, Math.round(v));

  /* 流通盘 / 基准成交量：决定换手率与量比的量级，按股票性格区分 */
  const PROFILE = {
    bread: { volBase: 900, floatShares: 120000 },
    candy: { volBase: 1600, floatShares: 100000 },
    tech: { volBase: 2800, floatShares: 90000 },
    ocean: { volBase: 3600, floatShares: 70000 },
  };
  const profile = id => PROFILE[id] || { volBase: 1500, floatShares: 100000 };

  /* 保留 80 根、图上显示 40 根、开局预置 40 根 —— MA20 / MACD / 形态才成立 */
  const MAX_K = 80, SHOW_K = 40, SEED_K = 40;

  /* ======================================================================
     一、技术指标
     ====================================================================== */
  function ma(values, n) {
    return values.map((_, i) => {
      if (i < n - 1) return null;
      let s = 0;
      for (let k = 0; k < n; k++) s += values[i - k];
      return s / n;
    });
  }
  function ema(values, n) {
    const k = 2 / (n + 1);
    let prev = values.length ? values[0] : 0;
    return values.map((v, i) => {
      prev = i === 0 ? v : v * k + prev * (1 - k);
      return prev;
    });
  }
  /* MACD(12,26,9)：DIF = EMA12-EMA26，DEA = EMA9(DIF)，柱 = 2×(DIF-DEA) */
  function macd(closes) {
    const e12 = ema(closes, 12), e26 = ema(closes, 26);
    const dif = closes.map((_, i) => e12[i] - e26[i]);
    const dea = ema(dif, 9);
    return { dif: dif, dea: dea, hist: dif.map((d, i) => 2 * (d - dea[i])) };
  }
  function indicators(ks) {
    const closes = ks.map(k => k.c), vols = ks.map(k => k.v || 0);
    return {
      ma5: ma(closes, 5), ma10: ma(closes, 10), ma20: ma(closes, 20),
      vma5: ma(vols, 5), vma10: ma(vols, 10),
      macd: macd(closes),
      closes: closes, vols: vols,
    };
  }
  /* 量比 = 本根量 / 前 5 根均量 */
  function volumeRatio(ks, i) {
    const prev = ks.slice(Math.max(0, i - 5), i).map(k => k.v || 0);
    const avg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : (ks[i].v || 1);
    return avg > 0 ? (ks[i].v || 0) / avg : 1;
  }

  /* ======================================================================
     二、阶段状态机
     ====================================================================== */
  function ensureState(m, def, id) {
    if (m.st && m.st.phase) return m.st;
    const pf = profile(id);
    m.st = {
      phase: 'accumulate',   /* 开局从底部吸筹起手，一打开就能看到完整形态 */
      dir: 1,                /* 1 上升 / -1 下降 */
      left: rint(5, 7),      /* 当前阶段剩余根数 */
      streak: 0,             /* 阶段内已生成根数 */
      anchor: m.price || (def && def.base) || 50,
      boxLo: (m.price || 50) * 0.95,
      boxHi: (m.price || 50) * 1.05,
      volBase: pf.volBase,
      floatShares: pf.floatShares,
      volScale: clamp(((def && def.vol) || 0.10) / 0.10, 0.6, 2.2),
      formed: [],
    };
    return m.st;
  }

  /* 阶段切换。一个完整周期约 30~45 根，涵盖底部→突破→趋势→顶部→下跌→整理 */
  function advancePhase(st, k) {
    st.left--;
    st.streak++;
    if (st.left > 0) return;
    st.streak = 0;
    switch (st.phase) {
      case 'accumulate':
        st.phase = 'breakout';
        st.dir = Math.random() < 0.8 ? 1 : -1;   /* 底部多数向上突破，少数破位 */
        st.left = 1;
        break;
      case 'breakout':
        st.phase = 'trend';
        st.left = rint(6, 11);
        st.anchor = k.c;
        break;
      case 'trend':
        if (st.dir > 0) { st.phase = 'distribute'; st.left = rint(3, 5); }
        else { st.phase = 'accumulate'; st.dir = 1; st.left = rint(5, 7); }
        break;
      case 'distribute':
        st.dir = -1; st.phase = 'downtrend'; st.left = rint(5, 9);
        break;
      case 'downtrend':
        st.phase = 'accumulate'; st.dir = 1; st.left = rint(5, 7);
        break;
      case 'box':
        st.phase = 'breakout';
        st.dir = Math.random() < 0.65 ? 1 : -1;
        st.left = 1;
        break;
      default:
        st.phase = 'accumulate'; st.dir = 1; st.left = rint(5, 7);
    }
    st.formed.push(st.phase);
    if (st.formed.length > 12) st.formed.shift();
  }

  /* 每一阶段对「本根 K 线」的意图：
     d=实体涨跌幅 gap=跳空 vm=量能倍数 us/ds=上下影幅度 tiny=实体压缩 */
  function plan(st) {
    /* 幅度系数封顶 1.6：波动率高的股票更刺激，但不能几根就撞到价格上下限 */
    const A = clamp(st.volScale, 0.65, 1.6);
    let d = 0, gap = 0, vm = 1, us = 0.004, ds = 0.004, tiny = 1, form = '';
    switch (st.phase) {
      case 'accumulate': {
        /* 横盘小阴小阳；量能逐根萎缩到地量；下影线长（承接） */
        const prog = clamp(1 - st.left / 8, 0, 1);
        d = rnd(-0.006, 0.008) * A;
        vm = (1.02 - prog * 0.66) * rnd(0.88, 1.12);
        ds = rnd(0.004, 0.015) * A;
        us = rnd(0.002, 0.006) * A;
        if (st.left === 1) {
          if (Math.random() < 0.55) { tiny = 0.10; d *= 0.2; vm = 0.36; form = 'doji'; }
          else { ds = rnd(0.014, 0.024) * A; form = 'hammer'; vm = 0.42; }
        } else if (ds > 0.011 * A && Math.random() < 0.3) form = 'hammer';
        break;
      }
      case 'breakout': {
        /* 放量长阳/长阴 + 跳空缺口，实体饱满、影线极短 */
        d = st.dir * rnd(0.022, 0.040) * A;
        gap = st.dir * rnd(0.002, 0.009) * A;
        vm = rnd(1.9, 2.7);
        us = rnd(0.001, 0.004) * A;
        ds = rnd(0.001, 0.005) * A;
        form = st.dir > 0 ? 'breakout-up' : 'breakout-down';
        break;
      }
      case 'trend': {
        /* 顺趋势推进，约 1/4 概率缩量回调（洗盘） */
        const pullback = Math.random() < 0.24;
        if (pullback) {
          d = -st.dir * rnd(0.003, 0.011) * A;
          vm = rnd(0.50, 0.78);
          form = 'pullback';
        } else {
          d = st.dir * rnd(0.005, 0.017) * A;
          vm = rnd(1.08, 1.52);
        }
        gap = st.dir * rnd(-0.002, 0.004) * A;
        us = rnd(0.002, 0.008) * A;
        ds = rnd(0.002, 0.009) * A;
        break;
      }
      case 'distribute': {
        /* 顶部：价格横在高位但量能萎缩 → 量价背离；长上影=冲高回落 */
        d = rnd(-0.009, 0.007) * A;
        vm = rnd(0.55, 0.86);
        us = rnd(0.010, 0.025) * A;
        ds = rnd(0.002, 0.007) * A;
        form = 'shooting-star';
        if (Math.random() < 0.28) { vm = rnd(1.6, 2.1); d = rnd(-0.003, 0.003); form = 'stagnation'; }
        break;
      }
      case 'downtrend': {
        if (st.streak === 0) {
          /* 首根放量长阴：恐慌杀跌 */
          d = -rnd(0.020, 0.034) * A;
          vm = rnd(1.9, 2.7);
          form = 'panic-sell';
        } else {
          const bounce = Math.random() < 0.26;
          d = (bounce ? 1 : -1) * rnd(0.003, 0.014) * A;
          vm = bounce ? rnd(0.48, 0.74) : rnd(0.60, 0.92);
          if (bounce) form = 'weak-bounce';
        }
        gap = -rnd(0, 0.004) * A;
        us = rnd(0.002, 0.007) * A;
        ds = rnd(0.003, 0.013) * A;
        break;
      }
      case 'box': {
        /* 整理平台：振幅与量能同步收敛，末端十字星 → 变盘 */
        const prog = clamp(1 - st.left / 7, 0, 1);
        d = rnd(-0.013, 0.013) * A * (1 - prog * 0.72);
        vm = rnd(0.45, 0.82) * (1 - prog * 0.28);
        us = ds = rnd(0.003, 0.010) * A;
        if (st.left === 1) { tiny = 0.16; d *= 0.3; form = 'doji'; }
        break;
      }
    }
    return { d: d, gap: gap, vm: vm, us: us, ds: ds, tiny: tiny, form: form };
  }

  /* ======================================================================
     三、K 线生成（价格与成交量同源）
     ====================================================================== */
  function makeCandle(m, def) {
    const st = m.st;
    const ks = m.candles;
    const prev = ks[ks.length - 1];
    const prevC = prev ? prev.c : m.price;
    const P = plan(st);
    const base = (def && def.base) || prevC;
    const floorP = Math.max(0.02, base * 0.45);
    const ceilP = base * 2.2;

    let o = r2(prevC * (1 + P.gap));
    let c = r2(o * (1 + P.d * P.tiny));
    /* 软回归：偏离基准 30% 后给一点向心力，避免长期单边跑飞、价格钉死在边界 */
    const dev = (c - base) / base;
    if (Math.abs(dev) > 0.30) c = r2(c * (1 - dev * 0.035));
    c = clamp(c, floorP, ceilP);
    o = clamp(o, floorP, ceilP);

    /* 接近涨跌边界时强制转向（保留已生成形态，只改后续阶段） */
    if (c > ceilP * 0.94 && st.dir > 0) { st.phase = 'distribute'; st.left = rint(2, 4); st.streak = 0; }
    if (c < floorP * 1.08 && st.dir < 0) { st.phase = 'accumulate'; st.dir = 1; st.left = rint(5, 7); st.streak = 0; }

    let h = r2(Math.max(o, c) * (1 + P.us * rnd(0.6, 1.35)));
    let l = r2(Math.min(o, c) * (1 - P.ds * rnd(0.6, 1.35)));
    h = Math.max(h, o, c);
    l = Math.max(0.01, Math.min(l, o, c));
    if (l >= h) l = Math.max(0.01, r2(h - 0.01));

    /* 成交量：基准量 × 阶段倍数 × 波动加成；突破强制放量、顶部强制缩量 */
    const recent = ks.slice(-5).map(k => k.v || st.volBase);
    const avg5 = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : st.volBase;
    let v = st.volBase * P.vm * (1 + Math.abs(P.d) * 7) * rnd(0.88, 1.12);
    if (st.phase === 'breakout') v = Math.max(v, avg5 * rnd(1.85, 2.45));
    if (st.phase === 'distribute') v = Math.min(v, avg5 * rnd(0.60, 0.88));
    if (st.phase === 'accumulate' && st.left <= 1) v = Math.min(v, avg5 * rnd(0.50, 0.72));

    /* 量价二次耦合：以「收盘相对前收」为准，涨要放量、跌要缩量。
       只有恐慌杀跌 / 放量破位 / 放量滞涨 / 利空消息才允许放量下跌。 */
    const vsPrev = (c - prevC) / Math.max(0.01, prevC);
    const heavyDown = ['panic-sell', 'breakout-down', 'news-down', 'stagnation'].indexOf(P.form) >= 0;
    if (vsPrev > 0) v *= rnd(1.12, 1.30);
    else if (vsPrev < 0 && !heavyDown) v *= rnd(0.68, 0.84);
    v = Math.round(clamp(v, st.volBase * 0.22, st.volBase * 4.5));
    /* 突破量直接按「前 5 日均量的 2.1~3.8 倍」定价：底部地量后突然放量，
       量比落在真实市场常见的 2~4 倍区间，而不是一律贴着上限 */
    if (st.phase === 'breakout')
      v = Math.round(clamp(avg5 * rnd(2.1, 3.8), st.volBase * 0.5, st.volBase * 4.5));

    /* 红三兵：上升趋势里连续三根阳线且收盘依次抬高（按实际 K 线判定） */
    let form = P.form;
    const a = ks[ks.length - 1], b = ks[ks.length - 2];
    if (st.phase === 'trend' && st.dir > 0 && a && b &&
      c > o && a.c > a.o && b.c > b.o && a.c > b.c && c > a.c) form = 'three-soldiers';

    const k = {
      o: o, h: h, l: l, c: c, v: v,
      day: (m.quoteSeq || 0) + 1,
      form: form,
      phase: st.phase, dir: st.dir,   /* 阶段标记：供形态教学与量价规则校验 */
    };
    advancePhase(st, k);
    return k;
  }

  function pushK(m, k) {
    m.price = k.c;
    m.history = m.history || [];
    m.candles = m.candles || [];
    m.history.push(k.c);
    m.candles.push(k);
    m.quoteSeq = (m.quoteSeq || 0) + 1;
    if (m.candles.length > MAX_K) m.candles.shift();
    if (m.history.length > MAX_K) m.history.shift();
    return k;
  }

  /* 营业日推进：由 finance.marketTick 调用 */
  function tick(m, def, id) {
    ensureState(m, def, id);
    return pushK(m, makeCandle(m, def));
  }

  /* 开局预置：生成一段完整行情，等比缩放让末根严格收在基准价。
     缩放而非硬改最后一根 —— 形态完整保留，且开局平衡与 v3.0 完全一致。 */
  function seed(def, id) {
    const m = { id: id, price: r2(def.base), history: [], candles: [], quoteSeq: 0 };
    ensureState(m, def, id);
    m.price = r2(def.base * rnd(0.84, 0.94));
    for (let i = 0; i < SEED_K; i++) tick(m, def, id);

    const last = m.candles[m.candles.length - 1];
    const scale = def.base / last.c;
    m.candles.forEach(k => {
      k.o = r2(k.o * scale); k.c = r2(k.c * scale);
      k.h = r2(k.h * scale); k.l = r2(k.l * scale);
      k.h = Math.max(k.h, k.o, k.c);
      k.l = Math.max(0.01, Math.min(k.l, k.o, k.c));
      if (k.l >= k.h) k.l = Math.max(0.01, r2(k.h - 0.01));
    });
    const L = m.candles[m.candles.length - 1];
    L.c = def.base;
    L.h = Math.max(L.h, L.o, L.c);
    L.l = Math.max(0.01, Math.min(L.l, L.o, L.c));
    m.price = def.base;
    m.history = m.candles.map(k => k.c);
    m.quoteSeq = m.candles.length;
    m.st.anchor = r2(m.st.anchor * scale);
    m.st.boxHi = r2(m.st.boxHi * scale);
    m.st.boxLo = r2(m.st.boxLo * scale);
    return m;
  }

  /* 消息面冲击（内线卡 / 新闻事件）：必然放量，方向由 rate 决定，之后进入整理 */
  function shock(m, def, id, rate) {
    ensureState(m, def, id);
    const prevC = m.price;
    const base = (def && def.base) || prevC;
    const floorP = Math.max(0.02, base * 0.45);
    const ceilP = base * 2.2;
    const up = rate >= 0;
    const o = clamp(r2(prevC * (1 + rnd(-0.002, 0.004))), floorP, ceilP);
    const c = clamp(r2(o * (1 + rate)), floorP, ceilP);
    const h = Math.max(o, c, r2(Math.max(o, c) * (1 + rnd(0.002, up ? 0.008 : 0.016))));
    const l = Math.max(0.01, Math.min(o, c, r2(Math.min(o, c) * (1 - rnd(0.002, up ? 0.013 : 0.007)))));
    const recent = m.candles.slice(-5).map(k => k.v || m.st.volBase);
    const avg5 = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : m.st.volBase;
    const v = Math.round(clamp(avg5 * (up ? rnd(1.7, 2.5) : rnd(1.9, 2.9)),
      m.st.volBase * 0.3, m.st.volBase * 5));
    const k = { o: o, h: h, l: l, c: c, v: v, day: (m.quoteSeq || 0) + 1, form: up ? 'news-up' : 'news-down' };
    pushK(m, k);
    m.st.phase = 'box'; m.st.left = rint(3, 5); m.st.dir = up ? 1 : -1; m.st.streak = 0;
    return k;
  }

  /* 旧存档兼容：补 OHLC / 成交量 / 引擎状态，保证 v3.0、v3.1 存档也能出图 */
  function normalize(m, def, id) {
    if (!m) return m;
    const st = ensureState(m, def, id);
    if (!m.candles || !m.candles.length) {
      const hs = (m.history && m.history.length) ? m.history : [m.price];
      m.candles = hs.map((c, i) => {
        const o = i ? hs[i - 1] : c;
        return { o: o, h: Math.max(o, c), l: Math.min(o, c), c: c, day: i + 1 };
      });
    }
    m.candles.forEach((k, i) => {
      if (!(k.v > 0)) {
        const chg = k.o ? Math.abs(k.c - k.o) / k.o : 0;
        k.v = Math.round(st.volBase * (0.55 + chg * 7) * (0.82 + (i % 5) * 0.07));
      }
      k.h = Math.max(k.h, k.o, k.c);
      k.l = Math.max(0.01, Math.min(k.l, k.o, k.c));
      if (k.l >= k.h) k.l = Math.max(0.01, r2(k.h - 0.01));
      if (!k.day) k.day = i + 1;
    });
    if (!m.quoteSeq) m.quoteSeq = m.candles.length;
    if (!m.history || m.history.length !== m.candles.length) m.history = m.candles.map(k => k.c);
    if (m.price !== m.candles[m.candles.length - 1].c) m.price = m.candles[m.candles.length - 1].c;
    return m;
  }

  /* 日 K → 周 K（每 5 个营业日聚合：开=首开 收=末收 高=最高 低=最低 量=求和） */
  function aggregateWeeks(ks, size) {
    const n = size || 5, out = [];
    for (let i = 0; i < ks.length; i += n) {
      const g = ks.slice(i, i + n);
      out.push({
        o: g[0].o, c: g[g.length - 1].c,
        h: Math.max.apply(null, g.map(k => k.h)),
        l: Math.min.apply(null, g.map(k => k.l)),
        v: g.reduce((a, k) => a + (k.v || 0), 0),
        day: g[g.length - 1].day,
        form: g[g.length - 1].form,
      });
    }
    return out;
  }

  /* ======================================================================
     四、技术形态识别（量价体系）
     ====================================================================== */
  const FORM_NAME = {
    'breakout-up': '放量突破长阳', 'breakout-down': '放量破位长阴',
    'doji': '十字星（变盘信号）', 'hammer': '锤子线（探底回升）',
    'shooting-star': '射击之星（冲高回落）', 'stagnation': '放量滞涨',
    'panic-sell': '放量杀跌', 'weak-bounce': '无量反弹',
    'pullback': '缩量回调', 'three-soldiers': '红三兵',
    'news-up': '利好放量长阳', 'news-down': '利空放量长阴',
  };

  function signal(ks) {
    const n = ks.length;
    if (!n) return { tone: 'neutral', title: '等待行情', detail: '还没有 K 线数据。', form: '' };
    const k = ks[n - 1], prev = ks[n - 2] || k;
    const ind = indicators(ks);
    const vr = volumeRatio(ks, n - 1);
    const chg = prev.c ? (k.c - prev.c) / prev.c * 100 : 0;
    const body = Math.abs(k.c - k.o) || 1;
    const upShadow = (k.h - Math.max(k.o, k.c)) / body;
    const dnShadow = (Math.min(k.o, k.c) - k.l) / body;
    const hi10 = Math.max.apply(null, ks.slice(-10).map(x => x.h));
    const ma5 = ind.ma5[n - 1], ma10 = ind.ma10[n - 1], ma20 = ind.ma20[n - 1];
    const pma5 = ind.ma5[n - 2], pma10 = ind.ma10[n - 2];
    const form = FORM_NAME[k.form] || '';

    let out = null;
    /* 1. 突破 / 破位：最优先，必须伴随量能确认 */
    if (k.form === 'breakout-up' && vr >= 1.8)
      out = { tone: 'bull', title: '放量突破 · 趋势启动',
        detail: '一根放量长阳脱离整理平台，量比 ' + vr.toFixed(2) + '（≥1.8 才算有效突破）。' +
          '量在价先：资金进场推动价格，回踩不破突破位可视为确认。' };
    else if (k.form === 'breakout-down' && vr >= 1.8)
      out = { tone: 'bear', title: '放量破位 · 趋势转弱',
        detail: '放量长阴跌破平台，量比 ' + vr.toFixed(2) + '，说明是真实抛压而非无量阴跌，宜先避让。' };
    /* 2. 量价背离：价创新高但量能跟不上 */
    else if (k.h >= hi10 && vr < 0.9 && chg >= 0)
      out = { tone: 'bear', title: '量价背离 · 警惕见顶',
        detail: '价格创近 10 日新高，量比却只有 ' + vr.toFixed(2) + '。上涨没有成交量配合，' +
          '多半是买盘衰竭，后续容易回落。' };
    /* 3. 放量滞涨 / 长上影：上方抛压 */
    else if (k.form === 'stagnation' || (upShadow > 2 && vr > 1.3))
      out = { tone: 'bear', title: '冲高回落 · 上方抛压',
        detail: '盘中冲高但收不住，留下长上影 / 放量滞涨，说明高位有人卖出。量增价不涨，是派发特征。' };
    /* 4. 均线金叉 / 死叉 */
    else if (pma5 != null && pma10 != null && ma5 != null && ma10 != null && pma5 <= pma10 && ma5 > ma10)
      out = { tone: 'bull', title: '均线金叉 · MA5 上穿 MA10',
        detail: '短期均价上穿中期均价，说明近期买盘成本抬升，趋势由弱转强。' };
    else if (pma5 != null && pma10 != null && ma5 != null && ma10 != null && pma5 >= pma10 && ma5 < ma10)
      out = { tone: 'bear', title: '均线死叉 · MA5 下穿 MA10',
        detail: '短期均价跌破中期均价，近期买入者开始浮亏，趋势转弱。' };
    /* 5. 地量地价 */
    else if (vr < 0.62 && body / k.c < 0.012)
      out = { tone: 'neutral', title: '地量地价 · 变盘临近',
        detail: '量比仅 ' + vr.toFixed(2) + '，实体极小，买卖双方都不愿动手。' +
          '地量之后往往选择方向，放量突破再跟进更稳妥。' };
    /* 6. 缩量回踩 */
    else if (chg < 0 && vr < 0.82 && ma10 != null && k.c >= ma10 * 0.99)
      out = { tone: 'bull', title: '缩量回踩 · 趋势未破',
        detail: '价跌但量比只有 ' + vr.toFixed(2) + '，且守住 MA10，属于洗盘而非出货，上升趋势仍完整。' };
    /* 7. 底部承接形态 */
    else if (k.form === 'hammer' || dnShadow > 2)
      out = { tone: 'bull', title: '探底回升 · 下方有承接',
        detail: '盘中下探被买盘拉回，留下长下影 / 锤子线。低位出现，常是止跌信号。' };
    /* 8. 恐慌杀跌 */
    else if (k.form === 'panic-sell' || (chg < -2 && vr > 1.7))
      out = { tone: 'bear', title: '放量杀跌 · 恐慌抛售',
        detail: '量比 ' + vr.toFixed(2) + ' 的长阴线，是集中卖出。放量下跌后通常还有缩量阴跌，别急着抄底。' };
    /* 9. 均线排列 */
    else if (ma5 != null && ma10 != null && ma20 != null && ma5 > ma10 && ma10 > ma20)
      out = { tone: 'bull', title: '均线多头排列',
        detail: 'MA5 > MA10 > MA20，短中长期成本依次抬高，是健康上升趋势；价涨量增时更可靠。' };
    else if (ma5 != null && ma10 != null && ma20 != null && ma5 < ma10 && ma10 < ma20)
      out = { tone: 'bear', title: '均线空头排列',
        detail: 'MA5 < MA10 < MA20，成本层层下移，反弹多是无量反抽，宜等放量止跌。' };
    else
      out = { tone: 'neutral', title: '震荡整理 · 方向未明',
        detail: '均线纠缠、量能平稳，属于多空平衡区。等放量突破平台再顺势操作，比猜方向更划算。' };

    out.form = form;
    out.vr = vr;
    out.chg = chg;
    out.ma = { ma5: ma5, ma10: ma10, ma20: ma20 };
    return out;
  }

  global.MarketEngine = {
    PROFILE: PROFILE, MAX_K: MAX_K, SHOW_K: SHOW_K, SEED_K: SEED_K,
    FORM_NAME: FORM_NAME,
    profile: profile, ma: ma, ema: ema, macd: macd,
    indicators: indicators, volumeRatio: volumeRatio,
    ensureState: ensureState, seed: seed, tick: tick, shock: shock,
    normalize: normalize, aggregateWeeks: aggregateWeeks, signal: signal,
  };
})(window);
