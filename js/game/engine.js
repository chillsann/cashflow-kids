/* ==========================================================================
   现金流小富翁 v2 · 核心引擎
   G 状态机 · 回合循环 · 移动与路过结算 · 落格调度 · 胜负判定
   phase: idle(可掷骰+操作) → rolling → moving → landing → idle-post(可操作)
          → turnEnd → nextTurn
   ====================================================================== */
(function (global) {
  'use strict';

  const U = global.UI;
  const B = global.Board;
  const W = global.CFWorld;
  const C = global.CFContent;
  const BAL = W.BALANCE;

  /* ======================================================================
     游戏状态
     ====================================================================== */
  const G = {
    map: [], players: [], cur: 0, round: 1, turnCount: 0,
    phase: 'boot',            // idle / rolling / moving / landing / idle-post / turnEnd / over
    over: false, mode: 'standard', cfg: null,
    market: null,             // 股票行情 {id: {price, history[]}}
    lottery: null,            // {pot, tickets: Map(pid→count), nextDrawRound}
    rentMod: null,            // {rate, untilRound} 新闻：租金倍率
    shopStock: {},            // 道具店货架 {id: {cards[], used}}
    startedAt: 0, log: [],
  };

  const fmt = U.fmt;

  /* ======================================================================
     玩家工厂
     ====================================================================== */
  function createPlayer(cfg, index) {
    const ch = W.CHARACTERS.find(c => c.id === cfg.charId) || W.CHARACTERS[index % W.CHARACTERS.length];
    const persona = cfg.persona || W.AI_PERSONAS[index % W.AI_PERSONAS.length];
    const p = {
      id: index,
      name: cfg.name || ch.name,
      isAI: !!cfg.isAI,
      persona,
      charId: ch.id,
      emoji: ch.emoji,
      avatar: ch.avatar || '',
      color: W.PLAYER_COLORS[index % W.PLAYER_COLORS.length],
      char: ch,

      cash: ch.cash, deposit: 0, loan: 0,
      pos: 0, laps: 0,

      estateIds: [],           // 持有地块下标
      stocks: {},              // {id: {shares, cost}}
      cards: [],               // 手牌 [{id, uid}]
      tickets: 2,              // 初始送 2 张点券（教会用）

      jailTurns: 0, hospitalTurns: 0, skipTurns: 0,
      god: null,               // {id, turns}
      freePassReady: false,    // 免费卡挂起（下一次支付免除）
      bankrupt: false, outRank: null,
      freedomBadge: false,

      stats: { rentPaid: 0, rentEarned: 0, buildCount: 0, cardUsed: 0,
               stockProfit: 0, lotteryWon: 0, laps: 0 },

      get netWorth() {
        let v = this.cash + this.deposit - this.loan;
        this.estateIds.forEach(i => {
          const c = G.map[i];
          if (!c) return;
          if (c.type === 'estate') v += c.price + c.level * c.buildCost * 0.8;
          if (c.type === 'special' && c.building) v += W.SPECIAL_BUILDINGS[c.building].cost * 0.8;
        });
        Object.keys(this.stocks).forEach(id => {
          const h = this.stocks[id];
          if (h.shares > 0 && G.market[id]) v += h.shares * G.market[id].price;
        });
        return Math.round(v);
      },
    };
    return p;
  }

  /* ======================================================================
     启动
     ====================================================================== */
  function startGame(cfg) {
    G.map = W.buildMap();
    G.mode = cfg.mode || 'standard';
    G.cfg = cfg;
    G.cur = 0; G.round = 1; G.turnCount = 0;
    G.over = false; G.phase = 'idle';
    G.startedAt = Date.now();
    G.rentMod = null;
    G.shopStock = {};

    G.players = cfg.players.map((pc, i) => createPlayer(pc, i));

    /* 股票行情初始化 */
    G.market = {};
    C.STOCKS.forEach(s => {
      G.market[s.id] = { price: s.base, history: [s.base] };
    });

    /* 乐透 */
    G.lottery = { pot: BAL.lotteryInitPot, tickets: {}, nextDrawRound: BAL.lotteryDrawEvery };

    /* 道具店货架 */
    restockShop();

    /* UI */
    document.getElementById('setupScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    document.getElementById('resultScreen').classList.add('hidden');

    U.clearLog();
    B.buildDice();
    B.buildBoard(G.map, G.players, onCellClick);
    U.renderBadges && U.renderBadges([], new Set());

    const mode = W.GAME_MODES[G.mode];
    U.log('🎬 <b>梦想小镇开张！</b>' + mode.icon + ' ' + mode.name + '（' + mode.rounds + ' 轮）· 让对手破产，或坚持到最后成为<b>总资产第一</b>！', 'gold');
    G.players.forEach(p => {
      U.log(p.emoji + ' <b>' + U.esc(p.name) + '</b>（' + p.char.name + '）初始现金 <span class="n">' + fmt(p.cash) +
        '</span>，每月津贴 <span class="n">' + fmt(p.char.salary) + '</span>' +
        (p.isAI ? ' · AI' + '（' + p.persona.name + '）' : ''), 'info');
    });

    global.SFX.play('start');
    render();
    if (G.cfg.coach && G.players.some(p => !p.isAI)) U.startCoach();

    beginTurn();
  }

  function restockShop() {
    /* 每家道具店独立货架，3 张随机卡 */
    const shops = G.map.filter(c => c.type === 'shop');
    shops.forEach(s => {
      const pool = C.SHOP_POOL.slice();
      const cards = [];
      for (let k = 0; k < 3 && pool.length; k++) {
        cards.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
      G.shopStock[s.i] = { cards, sold: 0 };
    });
  }

  /* ======================================================================
     回合循环
     ====================================================================== */
  function cur() { return G.players[G.cur]; }

  async function beginTurn() {
    if (G.over) return;
    const p = cur();
    if (!p) return;

    /* 破产者跳过（保险起见） */
    if (p.bankrupt) return nextTurn();

    /* 梦游（跳过回合） */
    if (p.skipTurns > 0) {
      p.skipTurns--;
      U.log('💤 <b>' + U.esc(p.name) + '</b> 还在梦游，本回合无法行动', 'info');
      await U.modal({ icon: '💤', title: p.emoji + ' ' + p.name + ' 在梦游', desc: '被梦游卡击中，本回合无法行动。', auto: p.isAI ? 1200 : 0 });
      return endTurn();
    }

    /* 监狱 */
    if (p.jailTurns > 0) {
      const r = await global.CardSys.jailPhase(p);
      if (G.over) return;
      /* 成功保释出狱 → 本回合继续进行（jailPhase 内已启动 AI 或把控制权交回玩家） */
      if (r === 'free') return;
      return endTurn();
    }

    /* 医院 */
    if (p.hospitalTurns > 0) {
      p.hospitalTurns--;
      U.log('🏥 <b>' + U.esc(p.name) + '</b> 还在休养（剩 ' + (p.hospitalTurns + 1) + ' 回合）', 'info');
      await U.modal({ icon: '🏥', title: p.emoji + ' ' + p.name + ' 在医院休养',
        desc: '还需要休养 ' + (p.hospitalTurns + 1) + ' 个回合。', auto: p.isAI ? 1200 : 0 });
      return endTurn();
    }

    G.phase = 'idle';
    render();

    if (p.isAI) { global.AISys.playTurn(p); armWatch(); }
    /* 人类玩家：等待操作台按钮事件（main.js 绑定 → Engine.doRoll / Engine.endTurn） */
  }

  /* 掷骰（人类由按钮触发，AI 由 AISys 调用） */
  async function doRoll(fixedValue) {
    if (G.over) return;
    const p = cur();
    if (!p || G.phase !== 'idle') return;

    G.phase = 'rolling';
    render();
    global.SFX.play('dice');

    let v = fixedValue || (1 + Math.floor(Math.random() * 6));
    await B.rollDiceAnimation(v);
    await U.sleep(180);

    G.phase = 'moving';
    render();
    await movePlayer(p, v);

    if (G.over) return;
    G.phase = 'landing';
    render();
    await resolveCell(p);

    if (G.over) return;
    G.phase = 'idle-post';
    render();
    if (p.isAI) { global.AISys.postLanding(p); armWatch(); }
  }

  /* 结束回合
     关键：推进必须「脱离当前调用栈」。
     否则 AI 链会变成 postLanding→endTurn→nextTurn→beginTurn→playTurn 的层层嵌套，
     内层设置的 phase=turnEnd 会拦截外层的推进，最终整条链断掉、游戏停摆。 */
  let advanceScheduled = false;

  async function endTurn() {
    if (G.over) return;
    const p = cur();
    if (!p) return;
    if (G.phase === 'turnEnd' || G.phase === 'over') return;
    G.phase = 'turnEnd';

    await turnEndSettle(p);
    if (G.over) return;
    scheduleAdvance();
    armEndWatch();
  }

  /* 第二层兜底：若因任何异常停在 turnEnd 超过 6 秒，强制推进一次 */
  let endWatchTimer = null;
  function armEndWatch() {
    clearTimeout(endWatchTimer);
    endWatchTimer = setTimeout(() => {
      if (G.over) return;
      if (G.phase === 'turnEnd' && !advanceScheduled) {
        U.log('⏰ <b>自动推进</b>：回合结束阶段停滞，强制进入下一位', 'warn');
        nextTurn();
      }
    }, 6000);
  }

  function scheduleAdvance() {
    clearTimeout(watchTimer);
    clearTimeout(endWatchTimer);
    if (G.over) return;
    if (advanceScheduled) return;      // 已有一次推进在排队，不重复
    advanceScheduled = true;
    setTimeout(() => {
      advanceScheduled = false;
      if (G.over) return;
      nextTurn();
    }, 0);
  }

  /* 回合末结算：神明倒计时、研究中心 */
  async function turnEndSettle(p) {
    global.CardSys.turnEndTick(p);
  }

  function nextTurn() {
    if (G.over) return;
    G.turnCount++;

    /* 全员破产：没有赢家，直接结束（否则会陷入无限换手） */
    if (G.players.every(p => p.bankrupt)) {
      endGame(null, '全场无人幸免，一起破产了');
      return;
    }

    /* 找下一个存活玩家 */
    let guard = 0;
    do {
      G.cur = (G.cur + 1) % G.players.length;
      guard++;
      if (G.cur === 0) {
        G.round++;
        roundTick();
        if (G.over) return;
      }
    } while (G.players[G.cur].bankrupt && guard < G.players.length * 2);

    clearTimeout(endWatchTimer);
    render();
    beginTurn();
  }

  /* 每轮结算（全体）：股票行情、存贷利息、乐透开奖、租金新闻到期 */
  function roundTick() {
    global.Finance.marketTick();
    global.Finance.interestTick();

    if (G.round > G.lottery.nextDrawRound) {
      global.Finance.lotteryDraw();
      G.lottery.nextDrawRound += BAL.lotteryDrawEvery;
    }
    if (G.rentMod && G.round > G.rentMod.untilRound) {
      G.rentMod = null;
      U.log('📰 租金行情恢复正常', 'info');
    }
    if (!checkRoundLimit()) return;
  }

  function checkRoundLimit() {
    const limit = W.GAME_MODES[G.mode].rounds;
    if (G.round > limit) {
      endGameByAssets('轮数已满');
      return false;
    }
    return true;
  }

  /* ----------------------------------------------------------------------
     看门狗：AI 回合若因任何原因停在可操作阶段超过 9 秒，自动推进。
     这是兜底用的安全网——正常流程不会触发。
     ---------------------------------------------------------------------- */
  let watchTimer = null;

  function armWatch() {
    clearTimeout(watchTimer);
    if (G.over) return;
    const p = cur();
    if (!p || !p.isAI) return;
    watchTimer = setTimeout(() => {
      if (G.over) return;
      const q = cur();
      if (!q || !q.isAI) return;
      if (G.phase === 'idle') {
        U.log('⏰ <b>自动推进</b>：检测到回合停滞，代为掷骰', 'warn');
        doRoll(q.fixedDice || null);
      } else if (G.phase === 'idle-post') {
        U.log('⏰ <b>自动推进</b>：检测到回合停滞，代为结束回合', 'warn');
        endTurn();
      }
    }, 9000);
  }

  /* ======================================================================
     移动与路过结算
     ====================================================================== */
  async function movePlayer(p, steps) {
    const dir = steps >= 0 ? 1 : -1;
    let remaining = Math.abs(steps);
    const path = [];

    while (remaining > 0) {
      p.pos = (p.pos + dir + G.map.length) % G.map.length;
      path.push(p.pos);
      remaining--;

      /* 经过 / 停在起点：领津贴 */
      if (p.pos === 0) {
        p.laps++;
        p.stats.laps++;
        let bonus = p.char.salary;
        const hasStation = p.estateIds.some(i => G.map[i].building === 'station');
        if (hasStation) bonus = Math.round(bonus * 1.5);
        if (dir > 0 && remaining > 0) {
          /* 路过 */
          await giveCash(p, bonus, '路过起点津贴' + (hasStation ? '（加油站 ×1.5）' : ''));
        } else if (remaining === 0) {
          /* 停驻：翻倍 */
          await giveCash(p, bonus * 2 + BAL.startBonus, '停驻起点（津贴 ×2 + 奖励）');
        }
      }

      /* 路障：立即停下（起点停驻逻辑已保证 remaining===0 时不再走） */
      if (remaining > 0 && G.map[p.pos].roadblock) {
        G.map[p.pos].roadblock = false;
        B.updateCell(G.map[p.pos], G.players);
        global.SFX.play('alert');
        U.log('🚧 <b>' + U.esc(p.name) + '</b> 踩到路障，被迫停在 ' + G.map[p.pos].name, 'warn');
        await U.modal({ icon: '🚧', title: '踩到路障！', desc: '你在「' + G.map[p.pos].name + '」被路障拦下，只能停在这里。', auto: p.isAI ? 1400 : 0 });
        break;
      }
    }

    await B.moveTokenAlong(p, path);
    await B.landBounce(p);
    B.placeTokens(G.players, p.id);
    global.SFX.play('land');
  }

  /* 通用收入函数（财神/穷神在此挂钩） */
  async function giveCash(p, amount, reason) {
    if (!amount) return;
    let final = amount;
    let note = '';
    if (p.god) {
      if (p.god.id === 'fortune') { final = amount * 2; note = '（财神 ×2）'; }
      if (p.god.id === 'poor') { final = Math.round(amount / 2); note = '（穷神 ÷2）'; }
    }
    p.cash += final;
    U.floatText(p.pos, '+' + fmt(final), '#e0342b');
    if (reason) U.log('💰 <b>' + U.esc(p.name) + '</b> ' + reason + ' <span class="n up">+' + fmt(final) + '</span>' + note, 'up');
    render();
  }

  /* 通用支出（免费卡可抵；不足触发清算）返回 true=支付成功 */
  async function chargeCash(p, amount, toId, reason) {
    if (amount <= 0) return true;

    /* 免费卡 */
    if (p.freePassReady) {
      p.freePassReady = false;
      U.log('🛡️ <b>' + U.esc(p.name) + '</b> 的免费卡生效，免除本次 ' + fmt(amount) + ' 元支出', 'up');
      await U.modal({ icon: '🛡️', title: '免费卡生效！', desc: '本次支付 ' + fmt(amount) + ' 元已被免费卡免除。', auto: p.isAI ? 1500 : 0,
        teach: '这就是保险思维的具象化：平时花小钱备一张卡，关键时刻免掉一笔大支出。' });
      return true;
    }

    if (p.cash < amount) {
      const ok = await global.Estate.liquidate(p, amount, reason);
      if (!ok) {
        await bankrupt(p, toId);
        return false;
      }
    }

    p.cash -= amount;
    const to = toId != null ? G.players[toId] : null;
    if (to) to.cash += amount;

    U.floatText(p.pos, '−' + fmt(amount), '#0f9d58');
    if (to) await U.coinsFly(p.id, to.id, amount);
    else await U.coinsFly(p.id, 'bank', amount);

    const html = '💸 <b>' + U.esc(p.name) + '</b> ' + (reason || '支出') + ' <span class="n down">−' + fmt(amount) + '</span>' +
      (to ? '（→ ' + U.esc(to.name) + '）' : '');
    U.log(html, 'down');
    global.SFX.play('expense');
    render();
    return true;
  }

  /* ======================================================================
     破产
     ====================================================================== */
  async function bankrupt(p, creditorId) {
    if (p.bankrupt) return;
    p.bankrupt = true;
    p.outRank = G.players.filter(x => x.bankrupt).length;

    /* 地产处理：归债主（若债主也是玩家），否则归银行（复位） */
    const creditor = creditorId != null ? G.players[creditorId] : null;
    p.estateIds.slice().forEach(i => {
      const cell = G.map[i];
      if (creditor && !creditor.bankrupt) {
        cell.owner = creditor.id;
        creditor.estateIds.push(i);
      } else {
        cell.owner = null; cell.level = 0; cell.mortgaged = false;
        if (cell.type === 'special') cell.building = null;
      }
      B.updateCell(cell, G.players);
    });
    p.estateIds = [];

    global.SFX.play('fail');
    U.log('💔 <b>' + U.esc(p.name) + '</b> 现金耗尽、资产清算完毕，宣告破产离场！' +
      (creditor && !creditor.bankrupt ? '（全部地产移交 ' + U.esc(creditor.name) + '）' : ''), 'down');

    await U.modal({
      icon: '💔', title: p.emoji + ' ' + p.name + ' 破产了',
      desc: '现金不足以支付欠款，被迫清盘离场。',
      auto: p.isAI ? 1800 : 0,
      teach: '破产的真正原因往往不是运气差，而是：现金缓冲太薄 + 负债太重 + 资产变现太慢。',
    });
    render();

    /* 胜利检查：只剩一人 */
    const alive = G.players.filter(x => !x.bankrupt);
    if (alive.length === 1) endGame(alive[0], '全场唯一幸存');
  }

  /* ======================================================================
     胜负
     ====================================================================== */
  function rankPlayers() {
    return G.players.slice().sort((a, b) => {
      if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
      return b.netWorth - a.netWorth;
    });
  }

  function endGame(winner, reason) {
    if (G.over) return;
    G.over = true; G.phase = 'over';
    clearTimeout(watchTimer); clearTimeout(endWatchTimer);
    global.SaveSys && global.SaveSys.clear();
    showResult(winner, rankPlayers(), reason);
  }

  function endGameByAssets(reason) {
    const ranked = rankPlayers();
    endGame(ranked[0], reason);
  }

  function showResult(winner, ranked, reason) {
    const sc = document.getElementById('resultScreen');
    const card = document.getElementById('resultCard');
    const humans = G.players.filter(p => !p.isAI);
    const me = humans[0] || G.players[0];
    /* 全员破产时没有赢家，取排名第一作为展示对象 */
    if (!winner) winner = ranked[0];
    const iWon = winner === me && !winner.bankrupt;

    const ranks = ranked.map((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
      const sub = p.bankrupt ? '💔 第 ' + (p.outRank || '?') + ' 个破产离场'
        : '现金 ' + fmt(p.cash) + ' · 地产 ' + p.estateIds.length + ' 块 · 股票市值 ' + fmt(stockValue(p));
      return '<div class="rank-row' + (i === 0 ? ' first' : '') + '" style="--rc:' + p.color + '">' +
        '<div class="rr-pos">' + medal + '</div>' +
        '<div class="rr-name"><b>' + p.emoji + ' ' + U.esc(p.name) + (p.isAI ? ' <span style="font-size:10px;color:#94a3b8">（AI·' + U.esc(p.persona.name) + '）</span>' : '') + '</b>' +
        '<span>' + sub + '</span></div>' +
        '<div class="rr-val">' + fmt(p.netWorth) + '<small>总资产</small></div></div>';
    }).join('');

    /* 逐一点评（保留 v1 教育内核） */
    const advice = p => {
      if (p.bankrupt) return '💔 破产了。回顾一下：是不是现金垫太薄、又扩张太猛？';
      const rent = p.stats.rentEarned, stock = p.stats.stockProfit;
      if (p.freedomBadge) return '🏆 达成过「财务自由」：单圈租金盖过生活费。你已经体验了钱替你工作是什么感觉。';
      if (rent > 0 && rent > Math.abs(stock) * 2) return '🏠 租金是你最重要的收入（累计 ' + fmt(rent) + '）。这就是被动收入的力量。';
      if (stock > 2000) return '📈 股票赚了 ' + fmt(stock) + '。记住：落袋的才是利润，没卖的只是数字。';
      if (stock < -2000) return '📉 股票亏了 ' + fmt(-stock) + '。低买高卖说来简单，难的是控制仓位和情绪。';
      if (p.loan > 0) return '🏦 还背着 ' + fmt(p.loan) + ' 贷款。利息每轮都在吃你的现金流。';
      if (p.estateIds.length === 0) return '🏝️ 一块地都没买。观察力不错的你，下一局试试抢占一个街区？';
      return '💼 收入结构还可以更稳：地产打底，股票增强，留现金防守。';
    };
    const playerAdvice = G.players.map(p =>
      '<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px dashed var(--line)">' +
      '<div style="font-size:15px">' + p.emoji + '</div><div style="flex:1">' +
      '<div style="font-weight:800;font-size:12px">' + U.esc(p.name) + '</div>' +
      '<div style="font-size:11.5px;color:var(--text-2);line-height:1.55;margin-top:2px">' + advice(p) + '</div></div></div>').join('');

    const noWinner = G.players.every(p => p.bankrupt);
    card.innerHTML =
      '<div class="result-medal">' + (noWinner ? '💀' : iWon ? '🏆' : '📊') + '</div>' +
      '<h2 class="result-title">' + (noWinner ? '全场破产……小镇需要新主人'
        : (iWon ? '恭喜你，成为梦想小镇大亨！' : winner.emoji + ' ' + U.esc(winner.name) + ' 是本局大亨！')) + '</h2>' +
      '<p class="result-sub">' + U.esc(reason || '') + '。' +
        (noWinner ? '所有人都被过路费和利息拖垮了——这才是最生动的一课：现金流断了，资产再多也没用。'
          : iWon ? '你的每一笔买地、每一次盖楼都算数。' : '下一局，把他的街区抢过来！') + '</p>' +
      '<div class="result-stats">' +
        '<div class="rstat"><div class="k">共进行轮数</div><div class="v">' + (G.round - 1) + '</div></div>' +
        '<div class="rstat"><div class="k">你的总资产</div><div class="v ' + (me.netWorth >= 0 ? 'up' : 'down') + '">' + fmt(me.netWorth) + '</div></div>' +
        '<div class="rstat"><div class="k">你收的租金</div><div class="v up">' + fmt(me.stats.rentEarned) + '</div></div>' +
      '</div>' +
      '<div style="font-size:11px;font-weight:900;color:#94a3b8;letter-spacing:1.2px;text-align:left;margin-bottom:8px">最终排名（按总资产）</div>' +
      '<div class="rank-list">' + ranks + '</div>' +
      '<div class="teach" style="margin:12px 0"><div class="t-icon">🧭</div><div class="t-body">' +
        '<div class="t-title">逐一点评</div><div class="t-text">' + playerAdvice + '</div></div></div>' +
      '<div class="teach" style="margin-bottom:16px"><div class="t-icon">🎓</div><div class="t-body">' +
        '<div class="t-title">大亨的三条铁律</div><div class="t-text">' +
        '① 现金流是氧气：账面资产再大，付不起过路费照样破产；<br>' +
        '② 垄断是杠杆：集齐一个街区，租金翻倍，议价权翻倍；<br>' +
        '③ 分散是铠甲：地产打底、股票增强、现金防守，缺一不可。' +
      '</div></div></div>' +
      '<div class="result-actions">' +
        '<button class="btn btn-primary" id="btnPlayAgain">🔄 再来一局</button>' +
        '<button class="btn btn-soft" id="btnBackHome">🏠 返回设置</button></div>';

    sc.classList.remove('hidden');
    global.SFX.play(iWon ? 'win' : 'info');
    document.getElementById('btnPlayAgain').onclick = () => {
      sc.classList.add('hidden');
      restartSameConfig();
    };
    document.getElementById('btnBackHome').onclick = () => {
      sc.classList.add('hidden');
      backToSetup();
    };
  }

  function stockValue(p) {
    return Object.keys(p.stocks).reduce((s, id) => {
      const h = p.stocks[id];
      return s + (h.shares > 0 && G.market[id] ? h.shares * G.market[id].price : 0);
    }, 0);
  }

  function restartSameConfig() {
    const cfg = G.cfg ? Object.assign({}, G.cfg) : {};
    cfg.players = (G.cfg.players || []).map(pc => Object.assign({}, pc));
    startGame(cfg);
  }

  function backToSetup() {
    G.over = true; G.phase = 'over';
    document.getElementById('resultScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('setupScreen').classList.remove('hidden');
    global.App && global.App.renderSetup();
  }

  /* ======================================================================
     落格调度
     ====================================================================== */
  async function resolveCell(p) {
    const cell = G.map[p.pos];
    B.highlightCell(p.pos);
    try {
      switch (cell.type) {
        case 'estate':      return await global.Estate.onEstate(p, cell);
        case 'special':     return await global.Estate.onSpecial(p, cell);
        case 'bank':        return await global.Finance.onBank(p);
        case 'news':        return await global.CardSys.onNews(p);
        case 'chance':      return await global.CardSys.onChance(p);
        case 'lottery':     return await global.Finance.onLottery(p);
        case 'shop':        return await global.CardSys.onShop(p, cell);
        case 'card':        return await global.CardSys.onCardCell(p);
        case 'god':         return await global.CardSys.onGodCell(p);
        case 'park':        return await onPark(p, cell);
        case 'jail':        return await onJailVisit(p, cell);
        case 'hospital':    return await onHospitalVisit(p, cell);
        case 'start':       return;   // 移动时已处理
        default:            return;
      }
    } finally {
      B.clearHighlight();
    }
  }

  async function onPark(p, cell) {
    p.tickets += 2;
    global.SFX.play('lucky');
    U.log('🎡 <b>' + U.esc(p.name) + '</b> 在中央乐园休息，获得 2 张点券', 'up');
    await U.modal({
      icon: '🎡', title: '中央乐园',
      desc: '玩了一天，开心！获得 2 张点券（可在道具店换卡片）。',
      auto: p.isAI ? 1400 : 0,
      teach: '点券是「奖励型收入」——不花钱就能换到工具，游戏和现实里都要记得薅这类羊毛。',
    });
  }

  async function onJailVisit(p, cell) {
    const inmates = G.players.filter(x => x.jailTurns > 0);
    U.log('🔒 <b>' + U.esc(p.name) + '</b> 到监狱探视' + (inmates.length ? '（在押：' + inmates.map(x => x.name).join('、') + '）' : '（今天没人蹲号子）'), 'info');
  }

  async function onHospitalVisit(p, cell) {
    const patients = G.players.filter(x => x.hospitalTurns > 0);
    U.log('🏥 <b>' + U.esc(p.name) + '</b> 到医院探望病人' + (patients.length ? '（住院：' + patients.map(x => x.name).join('、') + '）' : '（病房空空）'), 'info');
  }

  /* ======================================================================
     点格查看（点击格子弹出信息）
     ====================================================================== */
  async function onCellClick(idx) {
    const cell = G.map[idx];
    if (!cell || G.over) return;
    const D = W.DISTRICTS[cell.district];
    const rows = [];
    if (cell.type === 'estate') {
      rows.push({ label: '地价', value: fmt(cell.price) });
      rows.push({ label: '盖房费（每级）', value: fmt(cell.buildCost) });
      rows.push({ label: '空地 / L1 / L2 / L3 / L4 租金', value: cell.rent.map(fmt).join(' / ') });
      if (D) rows.push({ label: '街区', value: D.icon + ' ' + D.name + '（集齐 ' + W.DISTRICT_SIZE[D.id] + ' 块 → 租金 ×2）' });
      const owner = cell.owner != null ? G.players[cell.owner] : null;
      rows.push({ label: '产权', value: owner ? owner.emoji + ' ' + owner.name + '（L' + cell.level + '）' : '无主', cls: owner ? '' : 'muted' });
      if (cell.mortgaged) rows.push({ label: '状态', value: '已抵押 🔒', cls: 'down' });
    } else if (cell.type === 'special') {
      rows.push({ label: '类型', value: '大型建地' });
      const owner = cell.owner != null ? G.players[cell.owner] : null;
      rows.push({ label: '产权', value: owner ? owner.emoji + ' ' + owner.name : '无主' });
      if (cell.building) {
        const b = W.SPECIAL_BUILDINGS[cell.building];
        rows.push({ label: '建筑', value: b.icon + ' ' + b.name });
        rows.push({ label: '效果', value: b.desc });
      } else rows.push({ label: '建筑', value: '尚未开建', cls: 'muted' });
    } else {
      rows.push({ label: '功能', value: cell.desc || cell.name });
    }
    await U.modal({ icon: cell.icon, title: cell.name, rows, teach: cell.i === undefined ? '' : (cell.teach || '') });
  }

  /* ======================================================================
     渲染协调
     ====================================================================== */
  function render() {
    const p = cur();
    B.refreshAll(G.map, G.players);
    B.placeTokens(G.players, p ? p.id : -1);
    global.HUD && global.HUD.render(G, p);
    global.Report && global.Report.renderTab(G);
  }

  global.Engine = {
    G, startGame, createPlayer, cur,
    beginTurn, doRoll, endTurn, movePlayer,
    giveCash, chargeCash, bankrupt,
    rankPlayers, endGame, endGameByAssets,
    resolveCell, onCellClick, render, restartSameConfig, backToSetup,
    restockShop, stockValue,
  };
})(window);
