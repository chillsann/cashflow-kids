/* ==========================================================================
   现金流小富翁 v2 · 卡片 · 神明 · 命运与新闻
   CARD_EFFECTS 注册表（声明式执行）· 道具店 · 神明 hooks · 监狱流程
   ====================================================================== */
(function (global) {
  'use strict';

  const U = global.UI;
  const B = global.Board;
  const W = global.CFWorld;
  const C = global.CFContent;
  const BAL = W.BALANCE;
  const E = () => global.Engine;
  const fmt = U.fmt;

  let cardUid = 0;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  /* ======================================================================
     手牌管理
     ====================================================================== */
  function giveCard(p, cardId, silent) {
    if (!cardId) cardId = pick(C.CARDS).id;
    if (p.cards.length >= BAL.cardHandMax) {
      if (!silent) U.log('🃏 <b>' + U.esc(p.name) + '</b> 手牌已满，错过了 ' + cardName(cardId), 'warn');
      return false;
    }
    p.cards.push({ id: cardId, uid: ++cardUid });
    const card = cardDef(cardId);
    if (!silent) {
      U.log('🃏 <b>' + U.esc(p.name) + '</b> 获得「' + card.icon + ' ' + card.name + '」', 'up');
      global.SFX.play('lucky');
      if (!p.isAI) U.toast(card.icon, '获得卡片：' + card.name, card.desc);
    }
    return true;
  }

  function cardDef(id) { return C.CARDS.find(c => c.id === id); }
  function cardName(id) { const c = cardDef(id); return c ? c.icon + c.name : id; }

  /* ======================================================================
     使用卡片（操作台/手牌点击）
     ====================================================================== */
  async function useCard(p, uid) {
    const G = E().G;
    const idx = p.cards.findIndex(c => c.uid === uid);
    if (idx < 0) return;
    const card = cardDef(p.cards[idx].id);
    if (!card) return;

    /* 安全网：AI 永远不该进入交互式选目标流程（会永久挂起）。
       这里改为自动挑一个合法目标；没有合法目标就放弃使用。 */
    if (p.isAI) {
      const auto = autoTarget(p, card);
      if (auto === null) return;
      await execCard(p, card, auto);
      p.cards.splice(idx, 1);
      p.stats.cardUsed++;
      E().render();
      return;
    }

    /* 二级目标选择 */
    let target = null;

    if (card.target === 'enemy') {
      const enemies = G.players.filter(x => x.id !== p.id && !x.bankrupt);
      if (!enemies.length) return;
      const pickV = await U.modal({
        icon: card.icon, title: '对谁使用「' + card.name + '」？',
        cards: enemies.map(x => ({ value: 'p:' + x.id, icon: x.emoji, name: x.name,
          desc: '现金 ' + fmt(x.cash) + ' · 地产 ' + x.estateIds.length + ' 块' + (x.cards.length ? ' · 手牌 ' + x.cards.length + ' 张' : '') })),
        options: [{ label: '取消', value: 'cancel', soft: true }],
      });
      if (!pickV || pickV === 'cancel') return;
      target = G.players[+pickV.split(':')[1]];
    } else if (card.target === 'estate-empty') {
      const empties = G.map.filter(c => c.type === 'estate' && c.owner == null && p.cash >= global.Estate.landPrice(c));
      if (!empties.length) {
        await U.modal({ icon: card.icon, title: '没有可买的空地', desc: '（或现金不足，价格已含物价指数）', auto: 0 });
        return;
      }
      const pickV = await U.modal({
        icon: card.icon, title: '购地卡：买哪块？',
        cards: empties.map(c => ({ value: 'e:' + c.i, icon: c.icon, name: c.name,
          price: global.Estate.landPrice(c),
          desc: W.DISTRICTS[c.district].name + ' · 租金 ' + fmt(c.rent[0]) + '+' })),
        wide: true,
        options: [{ label: '取消', value: 'cancel', soft: true }],
      });
      if (!pickV || pickV === 'cancel') return;
      target = G.map[+pickV.split(':')[1]];
    } else if (card.target === 'estate-built') {
      const built = G.map.filter(c => c.type === 'estate' && c.level > 0 && c.owner !== p.id);
      if (!built.length) { await U.modal({ icon: card.icon, title: '没有可攻击的建筑', auto: 0 }); return; }
      const pickV = await U.modal({
        icon: card.icon, title: card.name + '：选一块有建筑的地',
        cards: built.map(c => ({ value: 'e:' + c.i, icon: c.icon,
          name: c.name + '（L' + c.level + '）',
          desc: '主人：' + (c.owner != null ? G.players[c.owner].name : '？'), price: '' })),
        wide: true,
        options: [{ label: '取消', value: 'cancel', soft: true }],
      });
      if (!pickV || pickV === 'cancel') return;
      target = G.map[+pickV.split(':')[1]];
    } else if (card.target === 'cell') {
      /* 路障：选任意格（排除功能角） */
      const cells = G.map.filter(c => !['start', 'jail', 'hospital', 'park'].includes(c.type));
      const pickV = await U.modal({
        icon: card.icon, title: '路障放在哪一格？',
        desc: '对手踩到路障会被迫停下——放在你的高租金地段前效果最好。',
        cards: cells.slice(0, 12).map(c => ({ value: 'c:' + c.i, icon: c.icon, name: c.name, price: '' })),
        wide: true,
        options: [{ label: '取消', value: 'cancel', soft: true }],
      });
      if (!pickV || pickV === 'cancel') return;
      target = G.map[+pickV.split(':')[1]];
    } else if (card.target === 'swap') {
      /* 换地：两步 */
      const mine = p.estateIds.map(i => G.map[i]).filter(c => c.type === 'estate');
      if (!mine.length) { await U.modal({ icon: card.icon, title: '你没有可交换的地产', auto: 0 }); return; }
      const p1 = await U.modal({
        icon: card.icon, title: '换地卡：先选自己的一块',
        cards: mine.map(c => ({ value: 'e:' + c.i, icon: c.icon, name: c.name + '（L' + c.level + '）', price: '' })),
        wide: true, options: [{ label: '取消', value: 'cancel', soft: true }],
      });
      if (!p1 || p1 === 'cancel') return;
      const myCell = G.map[+p1.split(':')[1]];
      const theirs = G.map.filter(c => c.type === 'estate' && c.owner != null && c.owner !== p.id);
      if (!theirs.length) { await U.modal({ icon: card.icon, title: '对手没有地产', auto: 0 }); return; }
      const p2 = await U.modal({
        icon: card.icon, title: '再选对手的一块（换给你的）',
        cards: theirs.map(c => ({ value: 'e:' + c.i, icon: c.icon, name: c.name + '（L' + c.level + '）',
          desc: '主人：' + G.players[c.owner].name, price: '' })),
        wide: true, options: [{ label: '取消', value: 'cancel', soft: true }],
      });
      if (!p2 || p2 === 'cancel') return;
      target = { mine: myCell, theirs: G.map[+p2.split(':')[1]] };
    }

    /* 确认执行 */
    const done = await execCard(p, card, target);
    if (done) {
      p.cards.splice(idx, 1);
      p.stats.cardUsed++;
      E().render();
    }
  }

  /* AI 自动选目标（不弹窗）：挑不出合法目标就返回 null */
  function autoTarget(p, card) {
    const G = E().G;
    const enemies = G.players.filter(x => x.id !== p.id && !x.bankrupt);
    switch (card.target) {
      /* self 类卡不需要目标，但不能返回 null（useCard 会把 null 当作「无法使用」）。
         返回 true 作为哨兵，让 AI 也能正常使用自身增益卡。 */
      case 'self': return true;
      case 'enemy': return enemies[0] || null;
      case 'estate-empty':
        return G.map.filter(c => c.type === 'estate' && c.owner == null && p.cash >= global.Estate.landPrice(c))[0] || null;
      case 'estate-built':
        return G.map.filter(c => c.type === 'estate' && c.level > 0 && c.owner !== p.id)[0] || null;
      case 'cell':
        return G.map[(p.pos + 5) % G.map.length];
      case 'swap': {
        const mine = p.estateIds.map(i => G.map[i]).filter(c => c.type === 'estate')[0];
        const theirs = G.map.filter(c => c.type === 'estate' && c.owner != null && c.owner !== p.id)[0];
        return (mine && theirs) ? { mine, theirs } : null;
      }
      default: return null;
    }
  }

  /* ======================================================================
     效果注册表
     ====================================================================== */
  async function execCard(p, card, target) {
    const G = E().G;
    const k = card.effect.kind;
    U.log('🃏 <b>' + U.esc(p.name) + '</b> 使用「' + card.icon + ' ' + card.name + '」', 'gold');
    global.SFX.play('card');

    switch (k) {
      case 'fixedDice': {
        /* 双骰规则下锁定的是「两颗骰子的总点数」2-12 */
        if (p.isAI) {
          p.fixedDice = 4 + Math.floor(Math.random() * 7);
          U.log('🎛️ <b>' + U.esc(p.name) + '</b> 锁定下次骰子总点数为 ' + p.fixedDice + ' 点', 'info');
          return true;
        }
        const v = await U.modal({
          icon: card.icon, title: '遥控骰子：选总点数',
          desc: '两颗骰子合计会走出这个步数（2-12）。',
          cards: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => ({
            value: 'd:' + n, icon: '🎲', name: n + ' 步', price: '',
          })),
          wide: true,
          options: [{ label: '取消', value: 'cancel', soft: true }],
        });
        if (!v || v === 'cancel') return false;
        p.fixedDice = +v.split(':')[1];
        await U.modal({ icon: '🎛️', title: '骰子已锁定！', desc: '下次掷骰总点数必定是 ' + p.fixedDice + '。', auto: 1400 });
        return true;
      }
      case 'buyLand': {
        const cell = target;
        if (!cell || cell.owner != null || p.cash < global.Estate.landPrice(cell)) return false;
        await global.Estate.doBuy(p, cell);
        return true;
      }
      case 'swapLand': {
        const a = target.mine, b = target.theirs;
        const ownerB = G.players[b.owner];
        a.owner = ownerB.id; b.owner = p.id;
        p.estateIds = p.estateIds.filter(x => x !== a.i); p.estateIds.push(b.i);
        ownerB.estateIds = ownerB.estateIds.filter(x => x !== b.i); ownerB.estateIds.push(a.i);
        B.updateCell(a, G.players); B.updateCell(b, G.players);
        U.log('🔄 ' + U.esc(p.name) + ' 用 ' + a.name + ' 换来了 ' + U.esc(ownerB.name) + ' 的 ' + b.name, 'gold');
        await U.modal({ icon: '🔄', title: '换地成功！', desc: a.name + ' ⇄ ' + b.name, auto: 1600 });
        return true;
      }
      case 'robCard': {
        if (!target.cards.length) {
          await U.modal({ icon: '🦝', title: '扑空了', desc: target.name + ' 手里没有卡片。', auto: 1400 });
          return false;
        }
        const stolen = target.cards.splice(Math.floor(Math.random() * target.cards.length), 1)[0];
        giveCard(p, stolen.id, true);
        U.log('🦝 <b>' + U.esc(p.name) + '</b> 抢走了 ' + U.esc(target.name) + ' 的「' + cardName(stolen.id) + '」', 'warn');
        await U.modal({ icon: '🦝', title: '抢到了！', desc: '你抢走了 ' + target.name + ' 的「' + cardName(stolen.id) + '」', auto: 1600 });
        return true;
      }
      case 'skipTurn': {
        target.skipTurns++;
        U.log('💤 <b>' + U.esc(target.name) + '</b> 被梦游卡击中，下回合无法行动', 'warn');
        await U.modal({ icon: '💤', title: '梦游卡生效！', desc: target.name + ' 将昏睡 1 个回合。', auto: 1600 });
        return true;
      }
      case 'demolish': {
        const cell = target;
        const owner = G.players[cell.owner];
        cell.level--;
        B.updateCell(cell, G.players);
        global.SFX.play('alert');
        U.log('🦖 怪兽拆毁了 ' + U.esc(owner.name) + ' 的 ' + cell.name + '（降到 L' + cell.level + '）', 'down');
        await U.modal({ icon: '🦖', title: '怪兽出没！', desc: cell.name + ' 被拆掉一层（L' + (cell.level + 1) + ' → L' + cell.level + '）。', auto: 1600 });
        return true;
      }
      case 'roadblock': {
        const cell = target;
        cell.roadblock = true;
        B.updateCell(cell, G.players);
        U.log('🚧 <b>' + U.esc(p.name) + '</b> 在 ' + cell.name + ' 放置了路障', 'warn');
        await U.modal({ icon: '🚧', title: '路障已放置', desc: cell.name + ' 现在谁踩谁停。', auto: 1400 });
        return true;
      }
      case 'bomb': {
        const cell = target;
        const owner = G.players[cell.owner];
        cell.level = 0;
        B.updateCell(cell, G.players);
        owner.hospitalTurns = BAL.hospitalTurns;
        B.placeTokens(G.players);
        global.SFX.play('fail');
        U.log('💣 炸弹摧毁了 ' + U.esc(owner.name) + ' 的 ' + cell.name + ' 全部建筑！主人被送进医院', 'down');
        await U.modal({ icon: '💣', title: '轰！！', desc: cell.name + ' 变成平地，' + owner.name + ' 被送进医院（' + BAL.hospitalTurns + ' 回合）。', auto: 1800 });
        return true;
      }
      case 'freePass': {
        p.freePassReady = true;
        await U.modal({ icon: '🛡️', title: '免费卡已装备', desc: '下一次需要支付的钱（租金/罚金）将被免除。', auto: 1500 });
        return true;
      }
      case 'clearRoadblock': {
        let n = 0;
        G.map.forEach(c => { if (c.roadblock) { c.roadblock = false; n++; B.updateCell(c, G.players); } });
        await U.modal({ icon: '🤖', title: '清扫完成', desc: '清除了 ' + n + ' 个路障。', auto: 1400 });
        return true;
      }
      case 'cleanse': {
        if (!p.god || p.god.id === 'fortune' || p.god.id === 'bless') {
          await U.modal({ icon: '😇', title: '没有坏神缠身', desc: '你身上没有穷神/衰神。', auto: 1400 });
          return false;
        }
        const g = C.GODS[p.god.id];
        p.god = null;
        U.log('😇 <b>' + U.esc(p.name) + '</b> 驱散了' + g.name, 'up');
        await U.modal({ icon: '😇', title: g.name + ' 被驱散了！', auto: 1500 });
        return true;
      }
      case 'equalize': {
        const alive = G.players.filter(x => !x.bankrupt);
        const avg = Math.round(alive.reduce((s, x) => s + x.cash, 0) / alive.length);
        alive.forEach(x => x.cash = avg);
        U.log('⚖️ 均富卡！全体玩家现金平均为 ' + fmt(avg), 'gold');
        await U.modal({ icon: '⚖️', title: '均富卡生效！', desc: '所有人的现金都变成了 ' + fmt(avg) + ' 元。', auto: 1800 });
        return true;
      }
      /* ==================================================================
         v3 新增卡片效果（全部对 AI 安全：不弹交互式窗口）
         ================================================================== */
      case 'bonusSteps': {
        p.bonusSteps = (p.bonusSteps || 0) + (card.effect.value || 3);
        U.log('🏍️ <b>' + U.esc(p.name) + '</b> 装备机车，下次掷骰额外前进 ' + p.bonusSteps + ' 格', 'gold');
        U.toast(card.icon, '机车已就绪', '下次移动 +' + p.bonusSteps + ' 格');
        return true;
      }
      case 'extraTurn': {
        G.extraTurn = true;
        U.log('🔁 <b>' + U.esc(p.name) + '</b> 获得一个额外回合！', 'gold');
        U.toast(card.icon, '再来一次', '本回合结束后还是你');
        return true;
      }
      case 'moveTo': {
        const cell = target;
        if (!cell) return false;
        p.pos = cell.i;
        B.placeTokens(G.players, p.id);
        U.log('🌀 <b>' + U.esc(p.name) + '</b> 传送到 ' + cell.name + '（下回合从这里出发）', 'gold');
        U.toast(card.icon, '传送成功', '已移动到 ' + cell.name);
        return true;
      }
      case 'rentBoost': {
        p.rentBoostUntil = G.round + (card.effect.days || 3);
        p.rentBoostRate = card.effect.value || 1.5;
        U.log('📈 <b>' + U.esc(p.name) + '</b> 旗下地产租金 ×' + p.rentBoostRate + '，持续 ' + (card.effect.days || 3) + ' 天', 'up');
        U.toast(card.icon, '涨价生效', '租金 ×' + p.rentBoostRate);
        return true;
      }
      case 'doubleRent': {
        p.doubleRentUntil = G.round + (card.effect.days || 3);
        U.log('✖️ <b>' + U.esc(p.name) + '</b> 旗下地产租金 ×2，持续 ' + (card.effect.days || 3) + ' 天', 'up');
        U.toast(card.icon, '租金翻倍', '持续 3 天');
        return true;
      }
      case 'sealEstate': {
        const cell = target;
        if (!cell) return false;
        cell.sealedUntil = G.round + (card.effect.days || 3);
        U.log('⛔ <b>' + U.esc(p.name) + '</b> 查封了 ' + cell.name + '，3 天内无法收租', 'warn');
        U.toast(card.icon, '查封成功', cell.name + ' 暂时收不到租');
        return true;
      }
      case 'forceAuction': {
        const cell = target;
        if (!cell || cell.owner == null) return false;
        const prev = G.players[cell.owner];
        prev.estateIds = prev.estateIds.filter(i => i !== cell.i);
        cell.owner = null; cell.level = 0; cell.mortgaged = false;
        B.updateCell(cell, G.players);
        U.log('🔨 <b>' + U.esc(p.name) + '</b> 把 ' + prev.name + ' 的 ' + cell.name + ' 送上拍卖台', 'warn');
        await global.Estate.bankAuction(cell, { humanMayBid: !p.isAI });
        return true;
      }
      case 'timedBomb': {
        if (!target) return false;
        target.bombDay = G.round + (card.effect.days || 3);
        U.log('⏱️ <b>' + U.esc(p.name) + '</b> 给 ' + U.esc(target.name) + ' 挂上了定时炸弹（3 天后爆炸）', 'warn');
        U.toast(card.icon, '炸弹已安装', target.name + ' 3 天后会进医院');
        return true;
      }
      case 'sendJail': {
        if (!target) return false;
        const j = G.map.findIndex(c => c.type === 'jail');
        target.jailTurns = BAL.jailTurns;
        if (j >= 0) target.pos = j;
        B.placeTokens(G.players, p.id);
        U.log('🚓 <b>' + U.esc(target.name) + '</b> 被 ' + U.esc(p.name) + ' 送进了监狱', 'warn');
        U.toast(card.icon, '入狱！', target.name + ' 要蹲 ' + BAL.jailTurns + ' 回合');
        return true;
      }
      case 'sendHospital': {
        if (!target) return false;
        target.hospitalTurns = BAL.hospitalTurns;
        B.placeTokens(G.players, p.id);
        U.log('🏥 <b>' + U.esc(target.name) + '</b> 被送进医院休养 ' + BAL.hospitalTurns + ' 回合', 'warn');
        U.toast(card.icon, '住院！', target.name + ' 停摆 ' + BAL.hospitalTurns + ' 回合');
        return true;
      }
      case 'taxEnemy': {
        if (!target) return false;
        const mul = global.Calendar.scale('event');
        const amt = Math.round(target.estateIds.length * (card.effect.value || 600) * mul);
        const real = Math.min(amt, Math.max(0, target.cash));
        target.cash -= real;
        G.lottery.pot += Math.round(real * BAL.fineToPotRate);
        U.log('🧾 <b>' + U.esc(target.name) + '</b> 被查税，' + target.estateIds.length + ' 块地共缴 <span class="n down">−' + fmt(real) + '</span>（已计入乐透奖池）', 'down');
        U.toast(card.icon, '查税成功', '对方损失 ' + fmt(real));
        return true;
      }
      case 'stealCash': {
        if (!target) return false;
        const amt = Math.min(card.effect.value || 2000, Math.max(0, target.cash));
        target.cash -= amt; p.cash += amt;
        U.log('💸 <b>' + U.esc(p.name) + '</b> 从 ' + U.esc(target.name) + ' 手里拿走 <span class="n up">+' + fmt(amt) + '</span>', 'gold');
        U.toast(card.icon, '得手了', '+' + fmt(amt) + ' 现金');
        return true;
      }
      case 'cashGift': {
        await E().giveCash(p, card.effect.value || 2000, '红包卡');
        return true;
      }
      case 'shield': {
        p.shieldUntil = G.round + (card.effect.days || 3);
        U.log('🦉 <b>' + U.esc(p.name) + '</b> 获得 3 天厄运免疫', 'up');
        U.toast(card.icon, '免罪护盾', '3 天内不怕坏事件');
        return true;
      }
      case 'stockTip': {
        const s = pick(C.STOCKS);
        const m = G.market[s.id];
        m.price = Math.max(1, Math.round(m.price * (1 + (card.effect.rate || 0.2))));
        m.history.push(m.price);
        U.log('📊 <b>' + U.esc(p.name) + '</b> 的内线消息推高 ' + s.name + ' → ' + fmt(m.price), 'up');
        U.toast(card.icon, '内线消息', s.name + ' 上涨');
        return true;
      }
      case 'freeLottery': {
        const G2 = E().G;
        const n = BAL.lotteryNumberMin + Math.floor(Math.random() * (BAL.lotteryNumberMax - BAL.lotteryNumberMin + 1));
        const arr = G2.lottery.picks[p.id] = G2.lottery.picks[p.id] || [];
        if (arr.indexOf(n) < 0) arr.push(n);
        G2.lottery.tickets[p.id] = arr.length;
        U.log('🎟️ <b>' + U.esc(p.name) + '</b> 免费获得 ' + n + ' 号彩票', 'up');
        U.toast(card.icon, '免费彩票', '你持有 ' + n + ' 号');
        return true;
      }
      case 'summonGod': {
        await attachGod(p, card.effect.god);
        return true;
      }
      default:
        return false;
    }
  }

  /* ======================================================================
     道具店
     ====================================================================== */
  async function onShop(p, cell) {
    const G = E().G;
    const stock = G.shopStock[cell.i];

    if (p.isAI) {
      /* AI：现金充裕时买一张高性价比卡（商店价 8 折） */
      if (p.cash > 9000 && p.cards.length < BAL.cardHandMax - 1 && stock.cards.length && Math.random() < 0.5) {
        const id = stock.cards[0];
        const price = Math.round(cardDef(id).price * 0.8);
        if (p.cash > price + 3000) {
          p.cash -= price;
          stock.cards.shift();
          giveCard(p, id, true);
          U.log('🏪 AI ' + U.esc(p.name) + ' 在道具店买了「' + cardName(id) + '」', 'info');
        }
      }
      return;
    }

    /* 用点券换卡选项 */
    const cards = stock.cards.map(id => {
      const c = cardDef(id);
      return { value: id, icon: c.icon, name: c.name, desc: c.desc, price: Math.round(c.price * 0.8),
        disabled: p.cash < Math.round(c.price * 0.8) };
    });

    const pickV = await U.modal({
      icon: '🏪', title: '道具店（' + cell.name + '）',
      desc: '今日货架（商店价 8 折）。你还有 ' + p.tickets + ' 张点券' +
        (p.tickets >= BAL.ticketCardPrice ? '，可兑换随机卡片' : '') + '。',
      cards, wide: true,
      options: [
        { label: '🎫 ' + BAL.ticketCardPrice + ' 点券换随机卡', value: '__ticket', disabled: p.tickets < BAL.ticketCardPrice || p.cards.length >= BAL.cardHandMax },
        { label: '离开', value: 'close', soft: true },
      ],
    });

    if (pickV === '__ticket') {
      p.tickets -= BAL.ticketCardPrice;
      giveCard(p, null);
      return;
    }
    if (pickV && pickV !== 'close') {
      const c = cardDef(pickV);
      const price = Math.round(c.price * 0.8);
      if (p.cash >= price && p.cards.length < BAL.cardHandMax) {
        p.cash -= price;
        stock.cards = stock.cards.filter(x => x !== pickV);
        giveCard(p, pickV, true);
        await U.modal({ icon: c.icon, title: '买入「' + c.name + '」', desc: c.desc, teach: c.teach });
        /* 货架空了补货 */
        if (!stock.cards.length) {
          const pool = C.SHOP_POOL.slice();
          for (let k = 0; k < 3 && pool.length; k++) {
            stock.cards.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
          }
        }
      }
    }
  }

  /* 卡片格：免费抽卡 */
  async function onCardCell(p) {
    giveCard(p, null);
  }

  /* ======================================================================
     命运
     ====================================================================== */
  async function onChance(p) {
    const G = E().G;
    let card = pick(C.CHANCES);

    /* 福神 / 免罪卡挡厄运 */
    if (!card.good && ((p.god && p.god.id === 'bless') || (p.shieldUntil && p.shieldUntil >= G.round))) {
      U.log('🛡️ 庇护生效！' + U.esc(p.name) + ' 免除了厄运「' + card.text + '」', 'up');
      await U.modal({ icon: '🛡️', title: '福神庇护', desc: '厄运被福神挡下了：' + card.text, auto: 1600,
        teach: '这就是福神（保险）的价值：平时看不见，出事的时候才知道多值钱。' });
      return;
    }

    global.SFX.play(card.good ? 'lucky' : 'alert');
    await U.modal({
      icon: '🎴', title: '命运：' + (card.good ? '好事！' : '哎呀…'),
      desc: card.icon + ' ' + card.text,
      teach: card.teach || '',
      auto: p.isAI ? 1600 : 0,
    });

    await applyChance(p, card);
  }

  async function applyChance(p, card) {
    const G = E().G;
    const e = card.effect;
    /* 原版物价指数：事件金额随全镇资产水涨船高 */
    const mul = global.Calendar.scale('event');
    switch (e.kind) {
      case 'cash':
        if (e.value > 0) await E().giveCash(p, Math.round(e.value * mul), '命运好运');
        else await E().chargeCash(p, Math.round(-e.value * mul), null, '命运厄运');
        break;
      case 'cashPct': {
        const amt = Math.round(p.cash * Math.abs(e.value));
        if (amt > 0) await E().chargeCash(p, amt, null, '命运厄运');
        break;
      }
      case 'card': giveCard(p, null); break;
      case 'ticket': p.tickets += e.value; break;
      case 'move':
        await E().movePlayer(p, e.steps);
        if (!G.over) await E().resolveCell(p);
        break;
      case 'jail': p.jailTurns = BAL.jailTurns; B.placeTokens(G.players); break;
      case 'hospital': p.hospitalTurns = BAL.hospitalTurns; B.placeTokens(G.players); break;
      case 'god': await attachGod(p, e.force || null); break;
      case 'magic': {
        /* 误入魔法屋：女巫直接对当事人施一个随机小法术 */
        const bad = pick(C.MAGIC_PUNISHMENTS);
        if (bad.id === 'hospital') p.hospitalTurns = 2;
        else if (bad.id === 'jail') p.jailTurns = 2;
        else {
          const amt = Math.min(Math.round(1200 * mul), Math.max(0, p.cash));
          p.cash -= amt;
        }
        U.log('🔮 女巫对 <b>' + U.esc(p.name) + '</b> 施了「' + bad.name + '」', 'down');
        break;
      }
      case 'stockTip': {
        const s = pick(C.STOCKS);
        const m = G.market[s.id];
        m.price = Math.round(m.price * 1.15);
        m.history.push(m.price);
        U.log('📈 内线消息推高 ' + s.name + '！现价 ' + fmt(m.price), 'up');
        break;
      }
    }
    E().render();
  }

  /* ======================================================================
     新闻（全体事件）
     ====================================================================== */
  async function onNews(p) {
    const G = E().G;
    const ev = pick(C.NEWS);
    global.SFX.play(ev.effect.kind === 'stock' ? 'info' : 'alert');
    U.setNews(ev.icon + ' ' + ev.name + '：' + ev.text, '新闻');

    const rows = [];
    /* 立即执行全体效果 */
    switch (ev.effect.kind) {
      case 'stock': {
        const apply = id => {
          const m = G.market[id];
          m.price = Math.max(1, Math.round(m.price * (1 + ev.effect.rate)));
          m.history.push(m.price);
        };
        if (ev.effect.target === 'all') C.STOCKS.forEach(s => apply(s.id));
        else apply(ev.effect.target);
        rows.push({ label: '股价影响', value: (ev.effect.rate > 0 ? '+' : '') + Math.round(ev.effect.rate * 100) + '%' +
          (ev.effect.target === 'all' ? '（全体）' : ''), cls: ev.effect.rate > 0 ? 'up' : 'down' });
        break;
      }
      case 'cashAll': {
        const mul = global.Calendar.scale('event');
        const amt = Math.round(ev.effect.value * mul);
        G.players.forEach(x => {
          if (x.bankrupt) return;
          /* 负面事件：福神 / 免罪卡持有者免疫 */
          if (amt < 0 && ((x.god && x.god.id === 'bless') || (x.shieldUntil && x.shieldUntil >= G.round))) {
            U.log('🛡️ ' + U.esc(x.name) + ' 免除了本次全体损失', 'up');
            return;
          }
          x.cash = Math.max(0, x.cash + amt);
        });
        rows.push({ label: '每人现金', value: (amt > 0 ? '+' : '') + fmt(amt),
          cls: amt > 0 ? 'up' : 'down' });
        rows.push({ label: '物价指数', value: '×' + mul.toFixed(1) + '（已计入）' });
        break;
      }
      case 'cashAllSalary': {
        G.players.forEach(x => {
          if (!x.bankrupt) x.cash += Math.round(x.char.salary * ev.effect.rate);
        });
        rows.push({ label: '每人津贴补发', value: '+' + Math.round(ev.effect.rate * 100) + '%', cls: 'up' });
        break;
      }
      case 'taxEstate': {
        const mul = global.Calendar.scale('event');
        const per = Math.round(ev.effect.value * mul);
        G.players.forEach(x => {
          if (x.bankrupt) return;
          const tax = x.estateIds.length * per;
          if (tax > 0) x.cash = Math.max(0, x.cash - tax);
        });
        rows.push({ label: '房产税', value: fmt(per) + ' / 块（含物价指数）', cls: 'down' });
        break;
      }
      case 'indexUp': {
        const cal = G.calendar;
        const before = cal.index;
        cal.index = Math.min(BAL.priceIndex.max, Math.round((before + ev.effect.value) * 10) / 10);
        cal.lastIndex = before;
        rows.push({ label: '物价指数', value: before.toFixed(1) + ' → ' + cal.index.toFixed(1), cls: 'down' });
        U.log('🏗️ <b>建材涨价</b>：物价指数上调到 <b>' + cal.index.toFixed(1) + '</b>，全镇地价与租金同步上涨', 'warn');
        break;
      }
      case 'lotteryPot': {
        G.lottery.pot += ev.effect.value;
        rows.push({ label: '奖池增加', value: '+' + fmt(ev.effect.value), cls: 'up' });
        break;
      }
      case 'rentMod': {
        G.rentMod = { rate: ev.effect.rate, untilRound: G.round + ev.effect.rounds };
        rows.push({ label: '租金倍率', value: '×' + ev.effect.rate + '（' + ev.effect.rounds + ' 轮）',
          cls: ev.effect.rate > 1 ? 'up' : 'down' });
        break;
      }
    }

    U.log('📰 <b>' + ev.name + '</b>：' + ev.text, 'gold');
    await U.modal({
      icon: ev.icon, title: '新闻：' + ev.name, desc: ev.text,
      rows, teach: ev.teach || '', auto: p.isAI ? 2000 : 0,
    });
    E().render();
  }

  /* ======================================================================
     神明
     ====================================================================== */
  async function onGodCell(p) {
    await attachGod(p, null);
  }

  async function attachGod(p, forceId) {
    const G = E().G;
    const ids = Object.keys(C.GODS);
    const godId = forceId || pick(ids);
    const god = C.GODS[godId];

    /* 恶犬是「一次性事件神」：咬完立刻住院，不持续附身 */
    if (godId === 'dog') {
      p.hospitalTurns = BAL.hospitalTurns;
      B.placeTokens(G.players, p.id);
      global.SFX.play('alert');
      U.log('🐕 <b>' + U.esc(p.name) + '</b> 被恶犬咬伤，进医院休养 ' + BAL.hospitalTurns + ' 回合！', 'down');
      await U.modal({
        icon: '🐕', title: '被恶犬咬了！', auto: p.isAI ? 1600 : 0,
        desc: '恶犬把你送进了医院。若身上有机车卡（开车状态）本可免疫。',
        teach: god.teach,
      });
      E().render();
      return;
    }

    /* 大小神分级：大神持续更久 */
    const tier = Math.random() < (C.GOD_TIERS.big.chance) ? C.GOD_TIERS.big : C.GOD_TIERS.small;
    const turns = Math.round((god.turns || 6) * tier.multiplier);
    const displayName = tier.label + god.name;

    /* 已有神明：好换坏 / 坏换好 或直接替换 */
    if (p.god) {
      const old = C.GODS[p.god.id];
      if (old.id === godId) {
        p.god.turns = turns;   // 续期
        U.log('✨ ' + U.esc(p.name) + ' 的' + displayName + '续期了', 'gold');
        await U.modal({ icon: god.icon, title: displayName + ' 续期！', desc: god.desc, auto: p.isAI ? 1500 : 0 });
        return;
      }
      U.log('✨ ' + U.esc(p.name) + ' 送走了' + old.name + '，迎来了' + displayName, 'gold');
    } else {
      U.log('✨ <b>' + U.esc(p.name) + '</b> 被' + displayName + '附身！', 'gold');
    }

    p.god = { id: godId, turns, tier: tier.label };
    global.SFX.play(god.good ? 'lucky' : 'alert');

    await U.modal({
      icon: god.icon, title: (god.good ? '🙏 好运！' : '⚡ 麻烦了！') + displayName + '附身',
      desc: god.desc + '（持续 ' + turns + ' 个你的回合）',
      teach: god.teach || '',
      auto: p.isAI ? 1800 : 0,
    });
    E().render();
  }

  /* ======================================================================
     魔法屋（原版：女巫选人 → 玩家决定惩罚）
     ====================================================================== */
  async function onMagicHouse(p) {
    const G = E().G;
    const pool = G.players.filter(x => !x.bankrupt);
    if (!pool.length) return;
    const victim = p.isAI ? pool[Math.floor(Math.random() * pool.length)] : pick(pool);

    U.log('🔮 女巫在魔法屋选中了 <b>' + U.esc(victim.name) + '</b>，由 ' + U.esc(p.name) + ' 决定惩罚', 'gold');

    /* AI 施法者随机选一个；人类施法者自己挑 */
    let punish;
    if (p.isAI) {
      punish = pick(C.MAGIC_PUNISHMENTS);
    } else {
      const choice = await U.modal({
        icon: '🔮', title: '魔法屋 · 女巫的请求',
        desc: '女巫选中了 <b>' + U.esc(victim.name) + '</b>。你想对他施什么法？',
        cards: C.MAGIC_PUNISHMENTS.map(x => ({ value: x.id, icon: x.icon, name: x.name, desc: x.desc })),
        wide: true,
        options: [{ label: '放过他', value: 'mercy', soft: true }],
        teach: '魔法屋教的是「决策的后果」：你可以伤害别人，但每一次选择都在塑造这局游戏的走向。',
      });
      if (choice === 'mercy' || !choice) {
        U.log('🕊️ <b>' + U.esc(p.name) + '</b> 选择了宽恕，女巫悻悻而去', 'info');
        return;
      }
      punish = C.MAGIC_PUNISHMENTS.find(x => x.id === choice) || C.MAGIC_PUNISHMENTS[0];
    }

    const mul = global.Calendar.scale('event');
    let detail = '';
    switch (punish.id) {
      case 'cash': {
        const amt = Math.min(Math.round(2000 * mul), Math.max(0, victim.cash));
        victim.cash -= amt; G.lottery.pot += Math.round(amt * BAL.fineToPotRate);
        detail = '损失 ' + fmt(amt) + ' 元';
        break;
      }
      case 'jail': {
        victim.jailTurns = BAL.jailTurns;
        const j = G.map.findIndex(c => c.type === 'jail');
        if (j >= 0) victim.pos = j;
        B.placeTokens(G.players, p.id);
        detail = '入狱 ' + BAL.jailTurns + ' 回合';
        break;
      }
      case 'hospital': {
        victim.hospitalTurns = BAL.hospitalTurns;
        B.placeTokens(G.players, p.id);
        detail = '住院 ' + BAL.hospitalTurns + ' 回合';
        break;
      }
      case 'demolish': {
        const built = victim.estateIds.map(i => G.map[i]).filter(c => c.type === 'estate' && c.level > 0);
        if (built.length) {
          const c = pick(built); c.level--; B.updateCell(c, G.players);
          detail = c.name + ' 降到 L' + c.level;
        } else detail = '（没有可拆的建筑）';
        break;
      }
      case 'card': {
        if (victim.cards.length) {
          const lost = victim.cards.splice(Math.floor(Math.random() * victim.cards.length), 1)[0];
          detail = '失去「' + cardName(lost.id) + '」';
        } else detail = '（对方没有手牌）';
        break;
      }
      case 'tax': {
        const amt = Math.min(Math.round(victim.estateIds.length * 500 * mul), Math.max(0, victim.cash));
        victim.cash -= amt;
        detail = victim.estateIds.length + ' 块地共补税 ' + fmt(amt);
        break;
      }
    }
    global.SFX.play('alert');
    U.log('🔮 <b>' + U.esc(victim.name) + '</b> 受到「' + punish.name + '」：' + detail, 'down');
    await U.modal({
      icon: punish.icon, title: '女巫施法：' + punish.name,
      desc: U.esc(victim.name) + ' ' + detail,
      auto: p.isAI ? 1700 : 0,
      teach: punish.teach,
    });
    E().render();
  }

  /* 回合末 tick（engine.turnEndSettle 调用）：定时炸弹 + 神明效果 */
  function turnEndTick(p) {
    const G = E().G;
    const mul = global.Calendar.scale('event');

    /* 定时炸弹到期 */
    if (p.bombDay && G.round >= p.bombDay) {
      p.bombDay = 0;
      p.hospitalTurns = Math.max(p.hospitalTurns, 2);
      const fine = Math.min(Math.round(1500 * mul), Math.max(0, p.cash));
      p.cash -= fine;
      G.lottery.pot += Math.round(fine * BAL.fineToPotRate);
      global.SFX.play('fail');
      U.log('⏱️💥 <b>' + U.esc(p.name) + '</b> 身上的定时炸弹爆炸了！住院 2 回合，损失 ' + fmt(fine), 'down');
      B.placeTokens(G.players, p.id);
    }

    if (!p.god) return;
    const god = C.GODS[p.god.id];
    const cell = G.map[p.pos];

    if (p.god.id === 'decay') {
      const loss = Math.min(Math.round(500 * mul), Math.max(0, p.cash));
      p.cash -= loss;
      U.log('🌩️ 衰神作祟，' + U.esc(p.name) + ' 损失 ' + fmt(loss) + ' 元', 'down');
    }

    /* 「所到之处」类神明：以停留格结算（近似原版的路过触发） */
    if (cell && cell.type === 'estate') {
      if (p.god.id === 'angel' && cell.owner === p.id && cell.level < W.MAX_LEVEL) {
        cell.level++;
        B.updateCell(cell, G.players);
        U.log('👼 天使路过 ' + cell.name + '，免费加盖到 L' + cell.level + '！', 'up');
      } else if (p.god.id === 'devil' && cell.level > 0) {
        const owner = cell.owner != null ? G.players[cell.owner] : null;
        cell.level--;
        B.updateCell(cell, G.players);
        U.log('😈 恶魔拆掉 ' + cell.name + ' 一层（' + (owner ? owner.name + ' 受损' : '') + '）', 'down');
      } else if (p.god.id === 'landgod') {
        if (cell.owner == null) {
          cell.owner = p.id;
          p.estateIds.push(cell.i);
          B.updateCell(cell, G.players);
          U.log('🏡 土地公把无主地 ' + cell.name + ' 划给了 ' + U.esc(p.name) + '！', 'up');
        } else if (cell.owner !== p.id) {
          const prev = G.players[cell.owner];
          const price = global.Estate.landPrice(cell);
          if (p.cash >= price) {
            p.cash -= price; prev.cash += price;
            prev.estateIds = prev.estateIds.filter(i => i !== cell.i);
            cell.owner = p.id; p.estateIds.push(cell.i);
            B.updateCell(cell, G.players);
            U.log('🏡 土地公强行征收 ' + cell.name + '，' + U.esc(p.name) + ' 付给 ' + prev.name + ' ' + fmt(price), 'gold');
          }
        }
      }
    }

    p.god.turns--;
    if (p.god.turns <= 0) {
      U.log('✨ ' + god.name + '离开了 ' + U.esc(p.name), 'info');
      p.god = null;
      E().render();
    }
  }

  /* ======================================================================
     监狱阶段（engine.beginTurn 调用）
     ====================================================================== */
  async function jailPhase(p) {
    const G = E().G;
    const hasFreeCard = p.cards.some(c => c.id === 'freecard');
    const canBail = p.tickets >= BAL.jailBailTickets;

    if (!p.isAI && (hasFreeCard || canBail)) {
      const choice = await U.modal({
        icon: '🔒', title: p.emoji + ' ' + p.name + ' 在监狱里（剩 ' + p.jailTurns + ' 回合）',
        desc: '你可以想办法早点出去：',
        rows: [
          { label: '🎫 保释（点券）', value: BAL.jailBailTickets + ' 张（你有 ' + p.tickets + '）', cls: canBail ? 'up' : 'muted' },
          { label: '🛡️ 免费卡', value: hasFreeCard ? '手牌里有！' : '无', cls: hasFreeCard ? 'up' : 'muted' },
        ],
        options: [
          { label: '🎫 保释出狱', value: 'bail', primary: true, disabled: !canBail },
          { label: '🛡️ 用免费卡', value: 'card', disabled: !hasFreeCard },
          { label: '继续蹲着', value: 'stay', soft: true },
        ],
      });
      if (choice === 'bail') {
        p.tickets -= BAL.jailBailTickets;
        p.jailTurns = 0;
        U.log('🎫 <b>' + U.esc(p.name) + '</b> 花 ' + BAL.jailBailTickets + ' 张点券保释出狱', 'up');
        B.placeTokens(G.players);
        G.phase = 'idle';
        E().render();
        if (p.isAI) global.AISys.playTurn(p);
        return 'free';
      }
      if (choice === 'card') {
        const c = p.cards.find(x => x.id === 'freecard');
        p.cards = p.cards.filter(x => x.uid !== c.uid);
        p.jailTurns = 0;
        U.log('🛡️ <b>' + U.esc(p.name) + '</b> 使用免费卡出狱', 'up');
        B.placeTokens(G.players);
        G.phase = 'idle';
        E().render();
        if (p.isAI) global.AISys.playTurn(p);
        return 'free';
      }
    }

    /* AI 决策 */
    if (p.isAI && (canBail || hasFreeCard) && p.persona.aggression > 0.4) {
      if (canBail) {
        p.tickets -= BAL.jailBailTickets;
      } else {
        const c = p.cards.find(x => x.id === 'freecard');
        p.cards = p.cards.filter(x => x.uid !== c.uid);
      }
      p.jailTurns = 0;
      U.log('🎫 AI <b>' + U.esc(p.name) + '</b> 想办法出狱了', 'up');
      B.placeTokens(G.players);
      G.phase = 'idle';
      E().render();
      global.AISys.playTurn(p);
      return 'free';
    }

    /* 原版：入狱期间唯有掷出两颗相同点数才能出狱，且不产生额外回合 */
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    if (d1 === d2) {
      p.jailTurns = 0;
      U.log('🎲 <b>' + U.esc(p.name) + '</b> 在狱中掷出 ' + d1 + '+' + d2 + ' 同点，成功出狱！', 'up');
      await U.modal({ icon: '🔓', title: '掷出同点，出狱！', auto: 1600,
        desc: '按原版规则，监狱里只有两颗骰子同点才能离开（这次不额外多走一轮）。',
        teach: '有些限制不能靠蛮力突破，只能等条件满足。投资里叫「等待合适的时间」。' });
      B.placeTokens(G.players, p.id);
      G.phase = 'idle';
      E().render();
      if (p.isAI) global.AISys.playTurn(p);
      return 'free';
    }

    p.jailTurns--;
    U.log('🔒 <b>' + U.esc(p.name) + '</b> 掷出 ' + d1 + '+' + d2 + ' 未同点，继续蹲监狱（剩 ' + Math.max(0, p.jailTurns) + ' 回合）', 'info');
    await U.modal({ icon: '🔒', title: '蹲监狱……', desc: '掷出 ' + d1 + '+' + d2 + '，没同点。还剩 ' + Math.max(0, p.jailTurns) + ' 个回合。', auto: 1400 });
    return 'stay';
  }

  global.CardSys = {
    giveCard, cardDef, cardName, useCard, autoTarget, execCard,
    onShop, onCardCell, onChance, onNews, onMagicHouse,
    onGodCell, attachGod, turnEndTick, jailPhase,
  };
})(window);
