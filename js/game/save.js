/* ==========================================================================
   现金流小富翁 v2 · 存档
   localStorage 自动保存 / 恢复 / 清除
   ====================================================================== */
(function (global) {
  'use strict';

  const SAVE_KEY = 'cashflow_kids_save_v2';

  const E = () => global.Engine;

  function serialize() {
    const G = E().G;
    return {
      v: 3, mode: G.mode, cur: G.cur, round: G.round, turnCount: G.turnCount,
      cfg: G.cfg, startedAt: G.startedAt,
      calendar: G.calendar, extraTurn: G.extraTurn,
      map: G.map.map(c => ({
        i: c.i, owner: c.owner, level: c.level, mortgaged: c.mortgaged,
        building: c.building || null, roadblock: !!c.roadblock,
        sealedUntil: c.sealedUntil || 0,
      })),
      market: G.market,
      lottery: {
        pot: G.lottery.pot, tickets: G.lottery.tickets, picks: G.lottery.picks,
        lastDraw: G.lottery.lastDraw, lastWin: G.lottery.lastWin,
        nextDrawRound: G.lottery.nextDrawRound,
      },
      rentMod: G.rentMod,
      shopStock: G.shopStock,
      players: G.players.map(p => ({
        id: p.id, name: p.name, isAI: p.isAI, personaId: p.persona.id, charId: p.charId,
        cash: p.cash, deposit: p.deposit, loan: p.loan, loanDueDay: p.loanDueDay,
        pos: p.pos, laps: p.laps,
        estateIds: p.estateIds, stocks: p.stocks, cards: p.cards, tickets: p.tickets,
        jailTurns: p.jailTurns, hospitalTurns: p.hospitalTurns, skipTurns: p.skipTurns,
        doubleStreak: p.doubleStreak, bonusSteps: p.bonusSteps, bombDay: p.bombDay,
        shieldUntil: p.shieldUntil, doubleRentUntil: p.doubleRentUntil,
        rentBoostUntil: p.rentBoostUntil, rentBoostRate: p.rentBoostRate,
        god: p.god, freePassReady: p.freePassReady, fixedDice: p.fixedDice || null,
        bankrupt: p.bankrupt, outRank: p.outRank, freedomBadge: p.freedomBadge,
        stats: p.stats,
      })),
    };
  }

  function save() {
    const G = E().G;
    if (!G.players.length || G.over) return false;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(serialize()));
      return true;
    } catch (e) { return false; }
  }

  function hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }

  function clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }

  /* 恢复：读档重建局面（简单方案：用保存的 cfg 重启并回放状态） */
  function load() {
    const G = E().G;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
    if (!s || s.v < 2) return false;   // 兼容 v2 旧档（缺字段走默认值）

    /* 用原配置重建（保证对象方法如 netWorth getter 存在） */
    const cfg = Object.assign({}, s.cfg, { coach: false });
    E().startGame(cfg);

    /* 覆盖状态 */
    G.cur = s.cur; G.round = s.round; G.turnCount = s.turnCount;
    G.startedAt = s.startedAt || Date.now();
    G.market = s.market || {};
    /* 旧存档（v3.0 / v3.1）只有收盘序列、没有成交量与引擎状态：
       读档时补齐 OHLCV + 量价引擎状态，保证老存档也能画出完整 K 线 */
    Object.keys(G.market).forEach(id => {
      const def = (global.CFContent.STOCKS || []).find(s => s.id === id);
      global.MarketEngine.normalize(G.market[id], def, id);
    });
    G.lottery = Object.assign({ pot: 10000, tickets: {}, picks: {}, lastDraw: null, lastWin: null, nextDrawRound: 15 }, s.lottery || {});
    G.rentMod = s.rentMod;
    G.shopStock = s.shopStock || {};
    G.extraTurn = !!s.extraTurn;
    G.calendar = s.calendar || null;
    global.Calendar.restore(G);

    s.map.forEach(mc => {
      const cell = G.map[mc.i];
      if (!cell) return;
      cell.owner = mc.owner; cell.level = mc.level || 0;
      cell.mortgaged = !!mc.mortgaged;
      cell.building = mc.building || null;
      cell.roadblock = !!mc.roadblock;
      cell.sealedUntil = mc.sealedUntil || 0;
    });

    G.players.forEach((p, i) => {
      const sp = s.players[i];
      if (!sp) return;
      Object.assign(p, {
        cash: sp.cash, deposit: sp.deposit, loan: sp.loan, loanDueDay: sp.loanDueDay || 0,
        pos: sp.pos, laps: sp.laps,
        estateIds: sp.estateIds || [], stocks: sp.stocks || {}, cards: sp.cards || [],
        tickets: sp.tickets, jailTurns: sp.jailTurns || 0, hospitalTurns: sp.hospitalTurns || 0,
        skipTurns: sp.skipTurns || 0, doubleStreak: sp.doubleStreak || 0,
        bonusSteps: sp.bonusSteps || 0, bombDay: sp.bombDay || 0,
        shieldUntil: sp.shieldUntil || 0, doubleRentUntil: sp.doubleRentUntil || 0,
        rentBoostUntil: sp.rentBoostUntil || 0, rentBoostRate: sp.rentBoostRate || 1.5,
        god: sp.god || null, freePassReady: !!sp.freePassReady,
        fixedDice: sp.fixedDice, bankrupt: !!sp.bankrupt, outRank: sp.outRank,
        freedomBadge: !!sp.freedomBadge, stats: sp.stats || p.stats,
      });
    });

    U_log('📂 已恢复上次存档（第 ' + G.round + ' 天 · ' + global.Calendar.label() + '）', 'gold');
    G.phase = 'idle';
    E().render();
    E().beginTurn();
    return true;
  }

  function U_log() { global.UI.log.apply(global.UI, arguments); }

  global.SaveSys = { save, hasSave, clear, load, serialize, SAVE_KEY };
})(window);
