/* ==========================================================================
   现金流小富翁 v3 · 日历与物价指数
   参照大富翁4Fun 的「日期系统 + 物价指数」：
   - 每位玩家各行动一次 = 1 天；小镇历 15 天 = 1 月（为网页节奏压缩）
   - 周末(周六/周日) + 每月 1 号：股市 / 银行休业
   - 每月 15 号：乐透开奖、存款结息、贷款到期、公布物价指数
   - 物价指数 = 全员平均「基础净资产」/ 开局平均，上限 6
     联动地价、过路费、事件金额、盖房费 —— 通胀会吃掉现金，这就是原版的后期压力
   纯逻辑层，不碰 DOM，方便被各系统以钩子方式调用。
   ========================================================================== */
(function (global) {
  'use strict';

  const W = global.CFWorld;
  const BAL = W.BALANCE;
  const CAL = BAL.calendar;

  const S = { G: null, initialAvg: 1 };

  /* 基础净资产：刻意不含物价指数，避免「指数↑→资产↑→指数↑」的正反馈失控 */
  function baseNetWorth(p) {
    const G = S.G;
    let v = p.cash + p.deposit - p.loan;
    if (!G || !G.map) return Math.round(v);
    p.estateIds.forEach(i => {
      const c = G.map[i];
      if (!c) return;
      if (c.type === 'estate') v += c.price + c.level * c.buildCost * 0.8;
      if (c.type === 'special' && c.building) {
        const b = W.SPECIAL_BUILDINGS[c.building];
        if (b) v += b.cost * 0.8;
      }
    });
    Object.keys(p.stocks || {}).forEach(id => {
      const h = p.stocks[id];
      if (h && h.shares > 0 && G.market[id]) v += h.shares * G.market[id].price;
    });
    return Math.round(v);
  }

  function avgBase() {
    const alive = S.G.players.filter(p => !p.bankrupt);
    if (!alive.length) return 0;
    return alive.reduce((s, p) => s + baseNetWorth(p), 0) / alive.length;
  }

  function sync() {
    const c = S.G.calendar;
    const d = Math.max(1, S.G.round);
    c.day = d;
    c.dom = ((d - 1) % CAL.monthDays) + 1;
    c.month = Math.floor((d - 1) / CAL.monthDays) + 1;
    c.weekday = ((d - 1) % CAL.weekDays) + 1;
    c.holiday = CAL.weekend.indexOf(c.weekday) >= 0 || CAL.holidayDays.indexOf(c.dom) >= 0;
    return c;
  }

  function init(G) {
    S.G = G;
    G.calendar = {
      day: 1, month: 1, dom: 1, weekday: 1, holiday: false,
      index: 1, indexRaw: 1, lastIndex: 1,
      drawCount: 0, monthEndCount: 0, history: [],
    };
    sync();
    /* 开局基准：全员初始平均净资产 */
    S.initialAvg = avgBase() || 1;
    G.calendar.startAvg = Math.round(S.initialAvg);
    return G.calendar;
  }

  function restore(G) {
    /* 读档时补齐字段（老存档没有 calendar） */
    S.G = G;
    if (!G.calendar) return init(G);
    const c = G.calendar;
    c.history = c.history || [];
    c.index = c.index || 1;
    c.lastIndex = c.lastIndex || c.index;
    c.drawCount = c.drawCount || 0;
    c.monthEndCount = c.monthEndCount || 0;
    S.initialAvg = c.startAvg || avgBase() || 1;
    sync();
    return c;
  }

  const c = () => (S.G && S.G.calendar) || { index: 1, holiday: false, dom: 1, month: 1, weekday: 1 };
  const isHoliday = () => !!c().holiday;
  const isMarketOpen = () => !isHoliday();
  const isBankOpen = () => !isHoliday();
  const isDrawDay = () => c().dom === CAL.drawDay;
  const index = () => c().index;

  /* 物价乘数：kind ∈ land / rent / event / build */
  function scale(kind) {
    if (BAL.priceIndex.affects.indexOf(kind) < 0) return 1;
    return index();
  }
  function scaled(amount, kind) { return Math.round(amount * scale(kind)); }

  function recomputeIndex() {
    const cal = c();
    const avg = avgBase();
    const raw = S.initialAvg > 0 ? avg / S.initialAvg : 1;
    let idx = Math.round(raw * 10) / 10;
    idx = Math.max(BAL.priceIndex.min, Math.min(BAL.priceIndex.max, idx));
    cal.indexRaw = Math.round(raw * 100) / 100;
    cal.lastIndex = cal.index;
    cal.index = idx;
    cal.history.push({ day: cal.day, index: idx });
    if (cal.history.length > 30) cal.history.shift();
    return { from: cal.lastIndex, to: idx, raw: cal.indexRaw };
  }

  /* 每轮（= 每天）推进一次，由 Engine.roundTick 调用，返回当天该触发的事件 */
  function advance() {
    const cal = sync();
    const ev = {
      holiday: cal.holiday,
      draw: isDrawDay(),
      monthEnd: isDrawDay(),
      indexChange: null,
      label: label(),
    };
    if (ev.monthEnd) {
      ev.indexChange = recomputeIndex();
      cal.monthEndCount++;
    }
    return ev;
  }

  const WEEK_CN = ['一', '二', '三', '四', '五', '六', '日'];
  function label() {
    const x = c();
    return '第 ' + x.month + ' 月 ' + x.dom + ' 日 · 周' + WEEK_CN[(x.weekday - 1) % 7] +
      (x.holiday ? ' · 休市' : '');
  }
  function shortLabel() {
    const x = c();
    return x.month + '/' + x.dom + (x.holiday ? ' 休' : '');
  }
  function nextDrawDays() {
    const x = c();
    return CAL.drawDay - x.dom;
  }

  function teachText() {
    const x = c();
    return '物价指数 ' + x.index.toFixed(1) + '：全镇平均资产每涨一倍，地价、过路费、事件金额就跟着涨。' +
      '账面资产变多不等于更安全——通胀会悄悄抬高你的支出。';
  }

  global.Calendar = {
    init, restore, advance, sync,
    isHoliday, isMarketOpen, isBankOpen, isDrawDay,
    index, scale, scaled, recomputeIndex,
    baseNetWorth, avgBase, label, shortLabel, nextDrawDays, teachText,
    get config() { return CAL; },
  };
})(window);
