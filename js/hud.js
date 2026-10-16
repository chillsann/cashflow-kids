/* ==========================================================================
   现金流小富翁 v2 · HUD 层
   棋盘中心操作台（掷骰/盖房/用卡/股市/银行）· 玩家卡 · 手牌栏 · 顶部状态
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.UI;
  const W = global.CFWorld;
  const fmt = U.fmt;
  const esc = U.esc;

  /* ======================================================================
     顶部状态
     ====================================================================== */
  function render(G, p) {
    renderTop(G);
    renderConsole(G, p);
    renderPlayers(G, p);
    renderHand(G, p);
  }

  function renderTop(G) {
    const mode = W.GAME_MODES[G.mode];
    const left = Math.max(0, mode.rounds - G.round + 1);
    const el = document.getElementById('roundInfo');
    if (el) {
      el.innerHTML =
        '<span class="ri-item">第 <b>' + Math.min(G.round, mode.rounds) + '</b> / ' + mode.rounds + ' 轮</span>' +
        '<span class="ri-item">剩余 <b>' + left + '</b> 轮</span>' +
        '<span class="ri-item">' + mode.icon + ' ' + mode.name + '</span>';
    }
  }

  /* ======================================================================
     操作台（棋盘中心）
     ====================================================================== */
  function renderConsole(G, p) {
    const box = document.getElementById('boardCenter');
    if (!box) return;

    if (!p) { box.innerHTML = '<div class="cc-title">准备中…</div>'; return; }

    const isHuman = !p.isAI;
    const canAct = (isHuman && !G.over && (G.phase === 'idle' || G.phase === 'idle-post'));
    const canRoll = (isHuman && !G.over && G.phase === 'idle');
    const canEnd = (isHuman && !G.over && G.phase === 'idle-post');

    /* 状态徽章 */
    const badges = [];
    if (p.god) {
      const g = global.CFContent.GODS[p.god.id];
      badges.push('<span class="cc-badge god" style="--gc:' + g.color + '">' + g.icon + ' ' + g.name + ' ' + p.god.turns + '</span>');
    }
    if (p.jailTurns > 0) badges.push('<span class="cc-badge bad">🔒 监狱 ' + p.jailTurns + '</span>');
    if (p.hospitalTurns > 0) badges.push('<span class="cc-badge bad">🏥 医院 ' + p.hospitalTurns + '</span>');
    if (p.skipTurns > 0) badges.push('<span class="cc-badge bad">💤 梦游</span>');
    if (p.freePassReady) badges.push('<span class="cc-badge good">🛡️ 免费卡</span>');

    box.innerHTML =
      '<div class="cc-head">' +
        '<span class="cc-avatar" style="--tc:' + p.color + '">' + U.av(p, 'av-console') + '</span>' +
        '<div class="cc-name">' + esc(p.name) +
          '<span class="cc-career">' + esc(p.char.name) + (p.isAI ? ' · AI' : '') + '</span></div>' +
        '<div class="cc-badges">' + badges.join('') + '</div>' +
      '</div>' +

      '<div class="cc-dice">' +
        '<div class="dice-stage" id="diceStage"></div>' +
        '<div class="dice-value" id="diceValue">?</div>' +
      '</div>' +

      '<div class="cc-stats">' +
        '<div class="ccs"><b>' + fmt(p.cash) + '</b><span>现金</span></div>' +
        '<div class="ccs"><b>' + p.estateIds.length + '</b><span>地产</span></div>' +
        '<div class="ccs"><b>' + fmt(global.Engine.stockValue(p)) + '</b><span>股票</span></div>' +
        '<div class="ccs"><b>' + fmt(p.netWorth) + '</b><span>总资产</span></div>' +
      '</div>' +

      (isHuman ?
        '<div class="cc-actions" id="consoleActions">' +
          '<button class="cc-btn primary" data-act="roll" ' + (canRoll ? '' : 'disabled') + '>🎲<span>掷骰子</span></button>' +
          '<button class="cc-btn" data-act="build" ' + (canAct ? '' : 'disabled') + '>🏗️<span>盖房</span></button>' +
          '<button class="cc-btn" data-act="cards" ' + (canAct ? '' : 'disabled') + '>🃏<span>用卡' + (p.cards.length ? ' (' + p.cards.length + ')' : '') + '</span></button>' +
          '<button class="cc-btn" data-act="stock" ' + (canAct ? '' : 'disabled') + ' id="btnStock">📈<span>股市</span></button>' +
          '<button class="cc-btn" data-act="bank" ' + (canAct ? '' : 'disabled') + ' id="btnBank">🏦<span>银行</span></button>' +
        '</div>' +
        '<div class="cc-end"><button class="btn btn-primary btn-block" data-act="end" ' +
          (canEnd ? '' : 'disabled') + '>结束回合 →</button></div>'
        :
        '<div class="cc-ai"><span class="dot"></span>' + esc(p.persona.name) + ' 正在思考…</div>');

    /* 操作台重建会清掉骰子舞台，必须重新挂载 3D 骰子 */
    global.Board.buildDice();
  }

  /* ======================================================================
     玩家卡
     ====================================================================== */
  function renderPlayers(G, p) {
    const deck = document.getElementById('playersDeck');
    if (!deck) return;

    deck.innerHTML = G.players.map(q => {
      const bs = global.Report.balanceRows(q);
      const cf = global.Report.cashflowRows(q);
      const pct = cf.passive > 0 ? Math.min(100, Math.round(cf.passive / W.BALANCE.livingCost * 100)) : 0;
      const isCur = p && q.id === p.id;
      const god = q.god ? global.CFContent.GODS[q.god.id] : null;

      return '<div class="pcard' + (isCur ? ' active' : '') + (q.bankrupt ? ' out' : '') + '" style="--pc:' + q.color + '" data-pid="' + q.id + '">' +
        '<div class="pc-head">' +
          '<span class="pc-av">' + U.av(q, 'av-card') + '</span>' +
          '<div class="pc-id"><b>' + esc(q.name) + '</b><span>' + esc(q.char.name) + (q.isAI ? ' · ' + esc(q.persona.name) : '') + '</span></div>' +
          (q.bankrupt ? '<span class="pc-tag bad">💔 破产</span>' :
            (god ? '<span class="pc-tag" style="background:' + god.color + '22;color:' + god.color + '">' + god.icon + ' ' + god.name + '</span>' : '')) +
        '</div>' +
        '<div class="pc-nums">' +
          '<div><b>' + fmt(q.cash) + '</b><span>现金</span></div>' +
          '<div><b>' + q.estateIds.length + '</b><span>地产</span></div>' +
          '<div><b>' + fmt(bs.netWorth) + '</b><span>总资产</span></div>' +
        '</div>' +
        '<div class="pc-freedom">' +
          '<div class="pf-label">被动收入 <b>' + fmt(cf.passive) + '</b> / 生活开销 ' + fmt(W.BALANCE.livingCost) +
            (pct >= 100 ? ' <span class="up">🏆 财务自由</span>' : '') + '</div>' +
          '<div class="pf-bar"><i style="width:' + pct + '%"></i></div>' +
        '</div>' +
        '<div class="pc-tags">' +
          (q.deposit ? '<span class="pct">🏦 ' + fmt(q.deposit) + '</span>' : '') +
          (q.loan ? '<span class="pct down">🏦 欠 ' + fmt(q.loan) + '</span>' : '') +
          (q.jailTurns > 0 ? '<span class="pct bad">🔒 ' + q.jailTurns + '</span>' : '') +
          (q.hospitalTurns > 0 ? '<span class="pct bad">🏥 ' + q.hospitalTurns + '</span>' : '') +
          (q.cards.length ? '<span class="pct">🃏 ' + q.cards.length + '</span>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ======================================================================
     手牌栏（当前人类玩家）
     ====================================================================== */
  function renderHand(G, p) {
    const bar = document.getElementById('handBar');
    if (!bar) return;

    /* 热座制：优先显示当前行动玩家的手牌；轮不到人类时显示第一位真人 */
    const me = (p && !p.isAI && !p.bankrupt) ? p
      : (G.players.find(x => !x.isAI && !x.bankrupt) || null);
    if (!me || G.over) {
      bar.innerHTML = '<div class="hand-empty">（暂无手牌）</div>';
      return;
    }
    if (!me.cards.length) {
      bar.innerHTML = '<div class="hand-empty">🃏 还没有卡片 —— 路过道具店 / 卡片格就能收集</div>';
      return;
    }

    bar.innerHTML = '<div class="hand-title">🎴 ' + esc(me.name) + ' 的手牌（点击使用）</div>' +
      '<div class="hand-list">' + me.cards.map(c => {
        const def = global.CardSys.cardDef(c.id);
        return '<button class="hcard" data-uid="' + c.uid + '" title="' + esc(def.desc) + '">' +
          '<span class="hc-icon">' + def.icon + '</span>' +
          '<span class="hc-name">' + esc(def.name) + '</span></button>';
      }).join('') + '</div>';
  }

  global.HUD = { render, renderTop, renderConsole, renderPlayers, renderHand };
})(window);
