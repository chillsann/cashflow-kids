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
      const empties = G.map.filter(c => c.type === 'estate' && c.owner == null && p.cash >= c.price);
      if (!empties.length) {
        await U.modal({ icon: card.icon, title: '没有可买的空地', desc: '（或现金不足）', auto: 0 });
        return;
      }
      const pickV = await U.modal({
        icon: card.icon, title: '购地卡：买哪块？',
        cards: empties.map(c => ({ value: 'e:' + c.i, icon: c.icon, name: c.name, price: c.price,
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
      case 'self': return null;
      case 'enemy': return enemies[0] || null;
      case 'estate-empty':
        return G.map.filter(c => c.type === 'estate' && c.owner == null && p.cash >= c.price)[0] || null;
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
        /* AI 直接随机锁点（绝不能走进「选点数」的人类弹窗） */
        if (p.isAI) {
          p.fixedDice = 3 + Math.floor(Math.random() * 3);
          U.log('🎛️ <b>' + U.esc(p.name) + '</b> 锁定下次骰子为 ' + p.fixedDice + ' 点', 'info');
          return true;
        }
        const v = await U.modal({
          icon: card.icon, title: '遥控骰子：选点数',
          cards: [1, 2, 3, 4, 5, 6].map(n => ({ value: 'd:' + n, icon: '🎲', name: '掷出 ' + n + ' 点', price: '' })),
          options: [{ label: '取消', value: 'cancel', soft: true }],
        });
        if (!v || v === 'cancel') return false;
        p.fixedDice = +v.split(':')[1];
        await U.modal({ icon: '🎛️', title: '骰子已锁定！', desc: '下次掷骰必定是 ' + p.fixedDice + ' 点。', auto: 1400 });
        return true;
      }
      case 'buyLand': {
        const cell = target;
        if (cell.owner != null || p.cash < cell.price) return false;
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

    /* 福神挡厄运 */
    if (!card.good && p.god && p.god.id === 'bless') {
      U.log('🛡️ 福神庇护！' + U.esc(p.name) + ' 免除了厄运「' + card.text + '」', 'up');
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
    switch (e.kind) {
      case 'cash':
        if (e.value > 0) await E().giveCash(p, e.value, '命运好运');
        else await E().chargeCash(p, -e.value, null, '命运厄运');
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
      case 'god': await attachGod(p, null); break;
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
        G.players.forEach(x => { if (!x.bankrupt) x.cash += ev.effect.value; });
        rows.push({ label: '每人现金', value: (ev.effect.value > 0 ? '+' : '') + fmt(ev.effect.value),
          cls: ev.effect.value > 0 ? 'up' : 'down' });
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
        G.players.forEach(x => {
          if (x.bankrupt) return;
          const tax = x.estateIds.length * ev.effect.value;
          if (tax > 0) x.cash = Math.max(0, x.cash - tax);
        });
        rows.push({ label: '房产税', value: fmt(ev.effect.value) + ' / 块', cls: 'down' });
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

    /* 已有神明：好换坏 / 坏换好 或直接替换 */
    if (p.god) {
      const old = C.GODS[p.god.id];
      if (old.id === godId) {
        p.god.turns = BAL.godTurns[godId];   // 续期
        U.log('✨ ' + U.esc(p.name) + ' 的' + god.name + '续期了', 'gold');
        await U.modal({ icon: god.icon, title: god.name + ' 续期！', desc: god.desc, auto: p.isAI ? 1500 : 0 });
        return;
      }
      U.log('✨ ' + U.esc(p.name) + ' 送走了' + old.name + '，迎来了' + god.name, 'gold');
    } else {
      U.log('✨ <b>' + U.esc(p.name) + '</b> 被' + god.name + '附身！', 'gold');
    }

    p.god = { id: godId, turns: BAL.godTurns[godId] };
    global.SFX.play(god.good ? 'lucky' : 'alert');

    await U.modal({
      icon: god.icon, title: (god.good ? '🙏 好运！' : '⚡ 麻烦了！') + god.name + '附身',
      desc: god.desc + '（持续 ' + BAL.godTurns[godId] + ' 个你的回合）',
      teach: god.teach || '',
      auto: p.isAI ? 1800 : 0,
    });
    E().render();
  }

  /* 回合末神明 tick（engine.turnEndSettle 调用） */
  function turnEndTick(p) {
    if (!p.god) return;
    const god = C.GODS[p.god.id];
    if (p.god.id === 'decay') {
      p.cash = Math.max(0, p.cash - 500);
      U.log('🌩️ 衰神作祟，' + U.esc(p.name) + ' 损失 500 元', 'down');
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

    p.jailTurns--;
    U.log('🔒 <b>' + U.esc(p.name) + '</b> 蹲监狱中……（剩 ' + Math.max(0, p.jailTurns) + ' 回合）', 'info');
    await U.modal({ icon: '🔒', title: '蹲监狱……', desc: '还剩 ' + Math.max(0, p.jailTurns) + ' 个回合出狱。', auto: 1400 });
    return 'stay';
  }

  global.CardSys = {
    giveCard, cardDef, useCard,
    onShop, onCardCell, onChance, onNews,
    onGodCell, attachGod, turnEndTick, jailPhase,
  };
})(window);
