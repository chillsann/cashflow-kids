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
      v: 2, mode: G.mode, cur: G.cur, round: G.round, turnCount: G.turnCount,
      cfg: G.cfg, startedAt: G.startedAt,
      map: G.map.map(c => ({
        i: c.i, owner: c.owner, level: c.level, mortgaged: c.mortgaged,
        building: c.building || null, roadblock: !!c.roadblock,
      })),
      market: G.market,
      lottery: { pot: G.lottery.pot, tickets: G.lottery.tickets, nextDrawRound: G.lottery.nextDrawRound },
      rentMod: G.rentMod,
      shopStock: G.shopStock,
      players: G.players.map(p => ({
        id: p.id, name: p.name, isAI: p.isAI, personaId: p.persona.id, charId: p.charId,
        cash: p.cash, deposit: p.deposit, loan: p.loan, pos: p.pos, laps: p.laps,
        estateIds: p.estateIds, stocks: p.stocks, cards: p.cards, tickets: p.tickets,
        jailTurns: p.jailTurns, hospitalTurns: p.hospitalTurns, skipTurns: p.skipTurns,
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
    if (!s || s.v !== 2) return false;

    /* 用原配置重建（保证对象方法如 netWorth getter 存在） */
    const cfg = Object.assign({}, s.cfg, { coach: false });
    E().startGame(cfg);

    /* 覆盖状态 */
    G.cur = s.cur; G.round = s.round; G.turnCount = s.turnCount;
    G.startedAt = s.startedAt || Date.now();
    G.market = s.market;
    G.lottery = s.lottery;
    G.rentMod = s.rentMod;
    G.shopStock = s.shopStock || {};

    s.map.forEach(mc => {
      const cell = G.map[mc.i];
      if (!cell) return;
      cell.owner = mc.owner; cell.level = mc.level || 0;
      cell.mortgaged = !!mc.mortgaged;
      cell.building = mc.building || null;
      cell.roadblock = !!mc.roadblock;
    });

    G.players.forEach((p, i) => {
      const sp = s.players[i];
      if (!sp) return;
      Object.assign(p, {
        cash: sp.cash, deposit: sp.deposit, loan: sp.loan, pos: sp.pos, laps: sp.laps,
        estateIds: sp.estateIds || [], stocks: sp.stocks || {}, cards: sp.cards || [],
        tickets: sp.tickets, jailTurns: sp.jailTurns || 0, hospitalTurns: sp.hospitalTurns || 0,
        skipTurns: sp.skipTurns || 0, god: sp.god || null, freePassReady: !!sp.freePassReady,
        fixedDice: sp.fixedDice, bankrupt: !!sp.bankrupt, outRank: sp.outRank,
        freedomBadge: !!sp.freedomBadge, stats: sp.stats || p.stats,
      });
    });

    U_log('📂 已恢复上次存档（第 ' + G.round + ' 轮）', 'gold');
    G.phase = 'idle';
    E().render();
    E().beginTurn();
    return true;
  }

  function U_log() { global.UI.log.apply(global.UI, arguments); }

  global.SaveSys = { save, hasSave, clear, load, serialize, SAVE_KEY };
})(window);
