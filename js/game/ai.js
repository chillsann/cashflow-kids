/* ==========================================================================
   现金流小富翁 v2 · AI 对手
   三层决策：地产（垄断优先）→ 股票（均值回归）→ 卡片（情境触发）
   persona 参数化：reserve 现金垫 / riskTol 风险偏好 / aggression 进攻性
   AI 路径零阻塞弹窗（auto 模式）
   ====================================================================== */
(function (global) {
  'use strict';

  const U = global.UI;
  const W = global.CFWorld;
  const C = global.CFContent;
  const BAL = W.BALANCE;
  const E = () => global.Engine;
  const ES = () => global.Estate;
  const fmt = U.fmt;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ======================================================================
     回合入口（engine.beginTurn 在 idle 时调用）
     ====================================================================== */
  async function playTurn(p) {
    await sleep(600);
    if (E().G.over) return;
    /* 已经在自己回合中破产了 → 必须把回合交出去，否则整局停摆 */
    if (p.bankrupt) { await E().endTurn(); return; }

    /* 掷骰前：清牌阶段（手牌满时用掉低价值卡） */
    await preCardPhase(p);
    if (E().G.phase !== 'idle') return;
    if (p.bankrupt) { await E().endTurn(); return; }

    await E().doRoll(p.fixedDice || null);
    if (p.fixedDice) p.fixedDice = null;
    /* doRoll 内落格后自动调 postLanding */
  }

  async function postLanding(p) {
    await sleep(500);
    if (E().G.over) return;
    /* 落格结算中破产 → 一样要把回合交出去 */
    if (p.bankrupt) { await E().endTurn(); return; }

    /* 1. 卡片（情境触发，进攻优先） */
    await cardPhase(p);
    /* 2. 盖房 */
    await buildPhase(p);
    /* 3. 股票 */
    await stockPhase(p);
    /* 4. 银行（还款/存款） */
    global.Finance.aiBank(p);

    await sleep(300);
    if (!E().G.over) await E().endTurn();
  }

  /* ======================================================================
     层 1：地产决策
     ====================================================================== */
  /* 现金安全垫：persona.reserve 档位 × 1,500（够付 1-2 次过路费即可，大富翁不靠囤现金） */
  const cashFloor = p => Math.max(1500, p.persona.reserve * 1500);

  function wantsEstate(p, cell) {
    const floor = cashFloor(p);
    const owned = ES().ownedInDistrict(p, cell.district).length;
    const need = W.DISTRICT_SIZE[cell.district];
    const after = p.cash - cell.price;
    const mono = owned + 1 >= need;

    /* 差最后一块就垄断 → 只要不至于破产就拿下 */
    if (mono && after >= floor * 0.25) return true;
    /* 连第一块地都没买过 → 放宽标准，先上车（资产才是一切的前提） */
    if (p.estateIds.length === 0) return after >= floor * 0.4;
    /* 现金极充裕 → 扩张 */
    if (after > floor * 3) return true;
    /* 常规判断 */
    if (after < floor) return false;
    if (p.persona.id === 'cautious') return cell.price <= 14000 || owned > 0;
    if (p.persona.id === 'aggressive') return true;
    /* 平衡/机会猎手/老师：优先本街区的地，其次中等价位 */
    return owned > 0 || cell.price <= 16000;
  }

  function wantsBuild(p, cell) {
    const floor = cashFloor(p);
    const mono = ES().hasMonopoly(p, cell.district);
    /* 垄断街区：激进加盖；非垄断：L2 封顶（保守） */
    const cap = mono ? 4 : (p.persona.aggression > 0.5 ? 3 : 2);
    if (cell.level >= cap) return false;
    /* 留足现金垫；垄断地优先 */
    const keep = mono ? floor * 0.3 : floor * 0.8;
    return p.cash - cell.buildCost >= keep;
  }

  function wantsSpecial(p, cell) {
    return p.cash - 8000 > cashFloor(p) && p.persona.aggression > 0.25;
  }

  function pickSpecialBuilding(p) {
    /* 进攻型度假饭店，防御型研究中心，中间加油站 */
    if (p.persona.aggression > 0.7) return 'resort';
    if (p.persona.aggression < 0.35) return 'lab';
    return 'station';
  }

  async function buildPhase(p) {
    const G = E().G;
    let built = 0;
    /* 排序：垄断街区优先，等级低的优先（拉齐） */
    const mine = p.estateIds.map(i => G.map[i]).filter(c => c.type === 'estate' && c.level < 4 && !c.mortgaged)
      .sort((a, b) => {
        const ma = ES().hasMonopoly(p, a.district) ? 0 : 1;
        const mb = ES().hasMonopoly(p, b.district) ? 0 : 1;
        return ma - mb || a.level - b.level;
      });
    for (const cell of mine) {
      if (built >= 3) break;              /* 每回合最多盖 3 次 */
      if (wantsBuild(p, cell)) {
        await ES().doBuild(p, cell);
        built++;
        await sleep(200);
      }
    }
  }

  /* ======================================================================
     层 2：股票决策（均值回归）
     ====================================================================== */
  function stockTargetValue(p) {
    /* 股票仓位：风险偏好 × 可投资现金 */
    const investable = Math.max(0, p.cash - cashFloor(p));
    return Math.round(investable * (0.3 + p.persona.riskTol * 0.4));
  }

  async function stockPhase(p) {
    const G = E().G;
    /* 卖：价格显著高于基准且有浮盈 */
    Object.keys(p.stocks).forEach(id => {
      const h = p.stocks[id];
      const m = G.market[id];
      if (!h || h.shares <= 0 || !m) return;
      const profitPct = (m.price * h.shares - h.cost) / Math.max(1, h.cost);
      if (m.price > C.STOCKS.find(s => s.id === id).base * 1.25 && profitPct > 0.25) {
        global.Finance.sellStock(p, id, 'all');
      }
    });
    /* 买：价格低于基准 85%，用目标仓位的一部分 */
    C.STOCKS.forEach(s => {
      const m = G.market[s.id];
      if (m.price > s.base * 0.85) return;
      const target = stockTargetValue(p);
      if (target < 2000) return;
      const budget = Math.min(target, Math.round(p.cash * 0.4));
      const shares = Math.floor(budget / m.price / 100) * 100;
      if (shares >= 100) global.Finance.buyStock(p, s.id, shares);
    });
  }

  /* ======================================================================
     层 3：卡片决策（情境触发）
     ====================================================================== */
  async function preCardPhase(p) {
    /* 手牌满 → 丢弃（用掉）最低价值的 */
    if (p.cards.length < BAL.cardHandMax) return;
    await cardPhase(p, true);
  }

  async function cardPhase(p, forceUse) {
    const G = E().G;
    const enemies = G.players.filter(x => x.id !== p.id && !x.bankrupt);
    if (!enemies.length) return;

    const has = id => p.cards.find(c => c.id === id);

    /* ⚠️ AI 一律走 execDirect（无声、无交互弹窗）。
       绝不能调 CardSys.useCard —— 那里面有「选目标 / 选点数」的人类交互弹窗，
       AI 调用会永久挂起，整局停摆。 */

    /* 优先级 1：现金危机 → 免费卡挂起 */
    const fc = has('freecard');
    if (fc && p.cash < 2500 && !p.freePassReady) {
      await execDirect(p, fc, null);
      return;
    }

    /* 优先级 2：坏神缠身 → 天使卡 */
    const angel = has('angel');
    if (angel && p.god && !C.GODS[p.god.id].good) {
      await execDirect(p, angel, null);
      return;
    }

    /* 优先级 3：对手有高威胁地产 → 怪兽/炸弹（仅进攻型） */
    if (p.persona.aggression > 0.4 || forceUse) {
      const threat = G.map.filter(c => c.type === 'estate' && c.owner != null && c.owner !== p.id && c.level >= 1)
        .sort((a, b) => b.level - a.level)[0];
      const monster = has('monster');
      if (threat && monster && (threat.level >= 2 || forceUse)) {
        await useOn(p, monster, threat);
        return;
      }
      const bomb = has('bomb');
      if (threat && threat.level >= 2 && bomb && p.persona.aggression > 0.55) {
        await useOn(p, bomb, threat);
        return;
      }
    }

    /* 优先级 4：领先对手 → 梦游卡骚扰 */
    const sleepy = has('sleepy');
    const leader = enemies.slice().sort((a, b) => b.netWorth - a.netWorth)[0];
    if (sleepy && leader && leader.netWorth > p.netWorth * 1.1 && p.persona.aggression > 0.3) {
      await useOnPlayer(p, sleepy, leader);
      return;
    }

    /* 优先级 5：领先时囤路障（防御） */
    const rb = has('roadblock');
    if (rb && p.estateIds.length > 2) {
      /* 放在自己的高级地产前 3 格 */
      const best = G.map.filter(c => c.type === 'estate' && c.owner === p.id && c.level >= 2)
        .sort((a, b) => b.level - a.level)[0];
      if (best) {
        const target = G.map[(best.i + 40 - 2) % 40];
        await useOn(p, rb, target);
        return;
      }
    }

    /* 优先级 6：遥控骰子（机会猎手偶尔用，随机锁一个偏大的点数） */
    const dice = has('tele_dice');
    if (dice && p.persona.id === 'opportunist' && Math.random() < 0.3) {
      await execDirect(p, dice, null);
      return;
    }
  }

  /* AI 定向用卡（跳过目标选择界面，直接构造目标） */
  async function useOn(p, card, cell) {
    /* 直接调内部：构造与 useCard 相同的执行路径 */
    const G = E().G;
    U.log('🃏 AI <b>' + U.esc(p.name) + '</b> 使用「' + global.CardSys.cardDef(card.id).name + '」→ ' + cell.name, 'gold');
    await execDirect(p, card, cell);
  }

  async function useOnPlayer(p, card, target) {
    U.log('🃏 AI <b>' + U.esc(p.name) + '</b> 使用「' + global.CardSys.cardDef(card.id).name + '」→ ' + target.name, 'gold');
    await execDirect(p, card, null, target);
  }

  /* 简化执行：复用 CardSys 逻辑但指定目标 */
  async function execDirect(p, card, cell, targetPlayer) {
    const G = E().G;
    const def = global.CardSys.cardDef(card.id);
    p.cards = p.cards.filter(c => c.uid !== card.uid);
    p.stats.cardUsed++;
    /* 直接调用 useCard 的效果执行（传 target 上下文） */
    await execCardDirect(p, def, cell, targetPlayer);
    E().render();
  }

  async function execCardDirect(p, card, cell, targetPlayer) {
    /* 复用 cardsys.execCard 的核心 switch——此处通过 useCard 的公开接口难以传 target，
       因此直接内联关键效果 */
    const G = E().G;
    switch (card.effect.kind) {
      case 'freecard': p.freePassReady = true; break;
      case 'cleanse': if (p.god && !C.GODS[p.god.id].good) p.god = null; break;
      case 'demolish':
        if (cell) {
          cell.level = Math.max(0, cell.level - 1);
          global.Board.updateCell(cell, G.players);
          U.log('🦖 怪兽拆毁了 ' + cell.name + '（降到 L' + cell.level + '）', 'down');
        }
        break;
      case 'bomb':
        if (cell) {
          const owner = G.players[cell.owner];
          cell.level = 0;
          owner.hospitalTurns = BAL.hospitalTurns;
          global.Board.updateCell(cell, G.players);
          global.Board.placeTokens(G.players);
          U.log('💣 炸毁了 ' + cell.name + '！' + owner.name + ' 进医院', 'down');
        }
        break;
      case 'skipTurn':
        if (targetPlayer) { targetPlayer.skipTurns++; U.log('💤 ' + targetPlayer.name + ' 被梦游卡击中', 'warn'); }
        break;
      case 'roadblock':
        if (cell) { cell.roadblock = true; global.Board.updateCell(cell, G.players); U.log('🚧 ' + cell.name + ' 被放置路障', 'warn'); }
        break;
      case 'fixedDice':
        /* AI 掷骰前直接用 */
        p.fixedDice = 2 + Math.floor(Math.random() * 4);
        U.log('🎛️ ' + p.name + ' 用遥控骰子锁定了 ' + p.fixedDice + ' 点', 'info');
        break;
    }
  }

  global.AISys = {
    playTurn, postLanding,
    wantsEstate, wantsBuild, wantsSpecial, pickSpecialBuilding,
    cardPhase,
  };
})(window);
