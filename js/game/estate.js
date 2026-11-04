/* ==========================================================================
   现金流小富翁 v3 · 地产系统（对齐大富翁4Fun）
   买地 → 盖房 L0-L5 → 收租（同街连锁 + 垄断×2）· 大型建地 5 种
   空地不买 → 银行拍卖 · 玩家间交易 · 物价指数联动 · 抵押 · 破产清算链
   ====================================================================== */
(function (global) {
  'use strict';

  const U = global.UI;
  const B = global.Board;
  const W = global.CFWorld;
  const BAL = W.BALANCE;
  const E = () => global.Engine;
  const CAL = () => global.Calendar;
  const fmt = U.fmt;
  const MAX_LV = W.MAX_LEVEL;

  /* 物价指数联动后的实际价格 */
  const landPrice = cell => CAL().scaled(cell.price, 'land');
  const buildPrice = cell => CAL().scaled(cell.buildCost, 'build');

  /* ======================================================================
     垄断与租金
     ====================================================================== */
  function ownedInDistrict(p, district) {
    return p.estateIds.filter(i => E().G.map[i].district === district);
  }

  function hasMonopoly(p, district) {
    return ownedInDistrict(p, district).length >= W.DISTRICT_SIZE[district];
  }

  /* 连锁倍率：垄断 ×2；未满垄断时，同街每多持有一块 +15% */
  function chainFactor(owner, cell) {
    if (!owner) return 1;
    const n = ownedInDistrict(owner, cell.district).length;
    if (n >= W.DISTRICT_SIZE[cell.district]) return 2;
    return 1 + 0.15 * Math.max(0, n - 1);
  }

  function rentOf(cell) {
    const G = E().G;
    /* 查封卡：期间该地无法收租 */
    if (cell.sealedUntil && G.round <= cell.sealedUntil) return 0;
    let rent = cell.rent[cell.level];
    const owner = cell.owner != null ? G.players[cell.owner] : null;
    rent *= chainFactor(owner, cell);
    if (G.rentMod) rent *= G.rentMod.rate;
    /* 原版物价指数：全镇资产涨，过路费同步涨 */
    rent *= CAL().scale('rent');
    /* 涨价卡 / 加倍卡 */
    if (owner) {
      if (owner.doubleRentUntil && G.round <= owner.doubleRentUntil) rent *= 2;
      if (owner.rentBoostUntil && G.round <= owner.rentBoostUntil) rent *= (owner.rentBoostRate || 1.5);
    }
    return Math.round(rent);
  }

  /* ======================================================================
     落在地产格
     ====================================================================== */
  async function onEstate(p, cell) {
    const G = E().G;

    if (cell.mortgaged && cell.owner !== p.id) {
      await U.modal({ icon: '🔒', title: cell.name + '（已抵押）',
        desc: '这块地被抵押给了银行，暂时不用交租。', auto: p.isAI ? 1200 : 0 });
      return;
    }

    /* 无主 → 购地 */
    if (cell.owner == null) return buyFlow(p, cell);

    /* 自己 → 盖房 */
    if (cell.owner === p.id) {
      if (cell.level >= MAX_LV) {
        U.log('🏨 <b>' + U.esc(p.name) + '</b> 回到自己的 ' + cell.name + '（已满级 L' + MAX_LV + '）', 'info');
        return;
      }
      return buildFlow(p, cell);
    }

    /* 他人 → 付租 */
    const owner = G.players[cell.owner];
    const rent = rentOf(cell);
    const mono = hasMonopoly(owner, cell.district);
    const chain = chainFactor(owner, cell);
    global.SFX.play('alert');

    await U.modal({
      icon: owner.emoji, title: '踩到 ' + owner.name + ' 的地了！',
      desc: cell.icon + ' ' + cell.name + '（L' + cell.level + '）' +
        (mono ? ' · ⚡垄断街区，租金 ×2' : chain > 1 ? ' · 🔗同街连锁 ×' + chain.toFixed(2) : ''),
      rows: [
        { label: '应付过路费', value: '−' + fmt(rent), cls: 'down', emphasis: true },
        { label: '物价指数', value: '×' + CAL().index().toFixed(1) + '（已计入）' },
        { label: '你的现金', value: fmt(p.cash) },
        { label: '对方现金', value: fmt(owner.cash) },
      ],
      auto: p.isAI ? 1500 : 0,
      teach: '你交的每一分租金，都是对方的<b>被动收入</b>。想不通为什么他越来越有钱？这就是答案。',
    });

    const paid = await E().chargeCash(p, rent, owner.id, '支付「' + cell.name + '」过路费');
    if (paid && !owner.bankrupt) {
      owner.stats.rentEarned += rent;
      p.stats.rentPaid += rent;
      /* 收租方的财神/穷神已在 chargeCash 转账侧？——转账不走 giveCash，这里补挂神明 */
      let extra = 0, note = '';
      if (owner.god && owner.god.id === 'fortune') { extra = rent; note = '（财神 ×2）'; }
      if (owner.god && owner.god.id === 'poor') { /* 穷神：退回一半 */ }
      if (extra) {
        owner.cash += extra;
        U.log('🧧 ' + U.esc(owner.name) + ' 财神加持，租金再 + ' + fmt(extra) + note, 'up');
      }
    }
  }

  /* 购地流程（human 弹窗 / AI 决策） */
  async function buyFlow(p, cell) {
    const G = E().G;
    const D = W.DISTRICTS[cell.district];
    const price = landPrice(cell);
    const cost = buildPrice(cell);
    const afford = p.cash >= price;

    if (p.isAI) {
      if (!afford || !global.AISys.wantsEstate(p, cell)) {
        U.log('💭 AI ' + U.esc(p.name) + ' 放弃购买 ' + cell.name, 'info');
        /* 原版：无人购买的土地由银行公开拍卖（AI 之间自动竞价，不打断流程） */
        if (Math.random() < 0.35) await bankAuction(cell, { humanMayBid: false });
        return;
      }
      return doBuy(p, cell);
    }

    const sameDistrict = ownedInDistrict(p, cell.district).length;
    const choice = await U.modal({
      icon: cell.icon, title: '购买「' + cell.name + '」？',
      desc: D.icon + ' ' + D.name + ' 街区 · 无主地块',
      rows: [
        { label: '地价', value: '−' + fmt(price), cls: 'down', emphasis: true },
        { label: '物价指数', value: '×' + CAL().index().toFixed(1) + '（地价已同步）' },
        { label: '空地租金（搭棚）', value: fmt(Math.round(cell.rent[0] * CAL().scale('rent'))) + ' /次' },
        { label: 'L5 酒店租金', value: fmt(Math.round(cell.rent[MAX_LV] * CAL().scale('rent'))) + ' /次' },
        { label: '盖房费（每级）', value: fmt(cost) },
        { label: '你在本街区已有', value: sameDistrict + ' / ' + W.DISTRICT_SIZE[cell.district] + ' 块',
          cls: sameDistrict ? 'up' : '' },
        { label: '集齐整条街 → 租金 ×2', value: sameDistrict + 1 >= W.DISTRICT_SIZE[cell.district] ? '⚡差这一块！' : '尚未垄断' },
        { label: '你的现金', value: fmt(p.cash) },
      ],
      options: [
        { label: afford ? '✅ 买下它' : '❌ 现金不足', value: 'buy', primary: true, disabled: !afford },
        { label: '再想想', value: 'skip' },
      ],
      teach: '买地前先看两件事：这块地的<b>租金回报</b>，和它在<b>你整体版图</b>里的位置——能不能凑成垄断，比单块地便宜更重要。',
    });
    if (choice === 'buy') await doBuy(p, cell);
    else {
      U.log('💭 <b>' + U.esc(p.name) + '</b> 放弃购买 ' + cell.name, 'info');
      await bankAuction(cell, { humanMayBid: true, declinedBy: p });
    }
  }

  async function doBuy(p, cell) {
    const G = E().G;
    const paid = await E().chargeCash(p, landPrice(cell), null, '购买地产「' + cell.name + '」');
    if (!paid) return;
    cell.owner = p.id;
    p.estateIds.push(cell.i);
    global.SFX.play('buy');
    B.updateCell(cell, G.players);
    U.log('✅ <b>' + U.esc(p.name) + '</b> 买下 ' + cell.icon + ' <b>' + cell.name + '</b>（' +
      (ownedInDistrict(p, cell.district).length >= W.DISTRICT_SIZE[cell.district] ? '⚡垄断达成！' + W.DISTRICTS[cell.district].name : '') + '）', 'up');

    if (!p.isAI) {
      await U.modal({
        icon: '🎉', title: '成为 ' + cell.name + ' 的主人！',
        desc: '从现在起，对手踩到这块地都要给你交过路费。',
        rows: [
          { label: '下次路过这里可以', value: '加盖房屋（最高 L' + MAX_LV + ' 酒店）' },
          { label: '集齐 ' + W.DISTRICTS[cell.district].name + ' 全部 ' + W.DISTRICT_SIZE[cell.district] + ' 块', value: '租金 ×2 ⚡' },
        ],
        auto: 0,
        teach: '恭喜拥有第一块「会下蛋的鹅」！注意：资产本身不让你变富，<b>别人付给你的租金</b>才让你变富。',
      });
    }
    E().render();
  }

  /* 盖房流程（踩到自己地 / 操作台盖房按钮） */
  async function buildFlow(p, cell) {
    const G = E().G;
    if (cell.level >= MAX_LV) return;
    const cost = buildPrice(cell);
    const afford = p.cash >= cost;
    const chain = chainFactor(p, cell);
    const nextRent = Math.round(cell.rent[cell.level + 1] * chain * CAL().scale('rent') * (G.rentMod ? G.rentMod.rate : 1));
    const mono = hasMonopoly(p, cell.district);

    if (p.isAI) {
      if (!afford || !global.AISys.wantsBuild(p, cell)) return;
      return doBuild(p, cell);
    }

    const choice = await U.modal({
      icon: '🏗️', title: '在 ' + cell.name + ' 盖房？（L' + cell.level + ' → L' + (cell.level + 1) + '）',
      desc: mono ? '⚡你垄断了本街区，租金已 ×2' : W.DISTRICTS[cell.district].icon + ' ' + W.DISTRICTS[cell.district].name,
      rows: [
        { label: '本次盖房费', value: '−' + fmt(cost), cls: 'down', emphasis: true },
        { label: '当前租金', value: fmt(rentOf(cell)) + ' /次' },
        { label: '盖后租金', value: fmt(nextRent) + ' /次', cls: 'up' },
        { label: '你的现金', value: fmt(p.cash) },
      ],
      options: [
        { label: afford ? '✅ 开工' : '❌ 现金不足', value: 'build', primary: true, disabled: !afford },
        { label: '先不盖', value: 'skip' },
      ],
      teach: '盖房是「加仓」自己看对的资产：投入越多单次回报越高，但现金垫也会变薄——别忘了给自己留过路费。',
    });
    if (choice === 'build') await doBuild(p, cell);
  }

  async function doBuild(p, cell) {
    const paid = await E().chargeCash(p, buildPrice(cell), null, '在「' + cell.name + '」盖房');
    if (!paid) return;
    cell.level++;
    p.stats.buildCount++;
    global.SFX.play('build');
    B.updateCell(cell, E().G.players);
    U.log('🏗️ <b>' + U.esc(p.name) + '</b> 把 ' + cell.name + ' 升到 <b>L' + cell.level + '</b>，租金 <span class="n up">' + fmt(rentOf(cell)) + '</span>/次', 'up');
    E().render();
  }

  /* ======================================================================
     大型建地
     ====================================================================== */
  async function onSpecial(p, cell) {
    const G = E().G;

    if (cell.owner == null) return buySpecialFlow(p, cell);

    if (cell.owner === p.id) {
      if (!cell.building) return buildSpecialFlow(p, cell);
      const b = W.SPECIAL_BUILDINGS[cell.building];
      await U.modal({ icon: b.icon, title: '你的 ' + b.name, desc: b.desc, auto: p.isAI ? 1200 : 0 });
      return;
    }

    const owner = G.players[cell.owner];
    const idxMul = CAL().scale('rent');

    /* 度假旅馆：住宿费 + 强制停留 1 回合 */
    if (cell.building === 'resort') {
      const rent = Math.round(3000 * idxMul * (G.rentMod ? G.rentMod.rate : 1));
      await U.modal({
        icon: '🏝️', title: '住进了 ' + owner.name + ' 的度假旅馆',
        desc: '一晚好眠——但账单不便宜，而且要住满一天才能走。',
        rows: [{ label: '住宿费', value: '−' + fmt(rent), cls: 'down', emphasis: true },
               { label: '额外停留', value: '1 个回合' }],
        auto: p.isAI ? 1400 : 0,
      });
      const paid = await E().chargeCash(p, rent, owner.id, '支付度假旅馆住宿费');
      if (paid) { owner.stats.rentEarned += rent; p.stats.rentPaid += rent; p.skipTurns = 1; }
      return;
    }

    /* 购物中心：按业主持有地产数收费（协同效应） */
    if (cell.building === 'mall') {
      const rent = Math.round(400 * owner.estateIds.length * idxMul);
      await U.modal({
        icon: '🏬', title: '逛了 ' + owner.name + ' 的购物中心',
        desc: '商铺越多，你越难空手走出去。',
        rows: [{ label: '业主持有地产', value: owner.estateIds.length + ' 块' },
               { label: '购物费', value: '−' + fmt(rent), cls: 'down', emphasis: true }],
        auto: p.isAI ? 1400 : 0,
      });
      const paid = await E().chargeCash(p, rent, owner.id, '支付购物中心消费');
      if (paid) { owner.stats.rentEarned += rent; p.stats.rentPaid += rent; }
      return;
    }

    const b = W.SPECIAL_BUILDINGS[cell.building];
    await U.modal({ icon: b.icon, title: owner.name + ' 的 ' + b.name,
      desc: b.desc + '（对你免费）', auto: p.isAI ? 1200 : 0 });
  }

  const specialPrice = () => CAL().scaled(8000, 'land');

  async function buySpecialFlow(p, cell) {
    const price = specialPrice();
    const afford = p.cash >= price;
    if (p.isAI) {
      if (!afford || !global.AISys.wantsSpecial(p, cell)) return;
      return doBuySpecial(p, cell, global.AISys.pickSpecialBuilding(p));
    }
    const choice = await U.modal({
      icon: '🏗️', title: '竞拍「' + cell.name + '」？',
      desc: '大型建地：买下后可从 5 种特殊建筑里选一种来盖。',
      rows: [
        { label: '地价', value: '−' + fmt(price), cls: 'down', emphasis: true },
        { label: '物价指数', value: '×' + CAL().index().toFixed(1) },
        ...Object.values(W.SPECIAL_BUILDINGS).map(b => ({
          label: b.icon + ' ' + b.name + '（另付 ' + fmt(b.cost) + '）', value: b.desc })),
        { label: '你的现金', value: fmt(p.cash) },
      ],
      options: [
        { label: afford ? '✅ 竞拍这块地' : '❌ 现金不足', value: 'buy', primary: true, disabled: !afford },
        { label: '再想想', value: 'skip' },
      ],
    });
    if (choice === 'buy') {
      await doBuySpecial(p, cell, null);
      if (cell.owner === p.id) await buildSpecialFlow(p, cell);
    }
  }

  async function doBuySpecial(p, cell, buildingId) {
    const paid = await E().chargeCash(p, specialPrice(), null, '竞拍「' + cell.name + '」');
    if (!paid) return;
    cell.owner = p.id;
    p.estateIds.push(cell.i);
    B.updateCell(cell, E().G.players);
    U.log('✅ <b>' + U.esc(p.name) + '</b> 竞得大型建地「' + cell.name + '」', 'up');
    if (buildingId) await doBuildSpecial(p, cell, buildingId);
    E().render();
  }

  async function buildSpecialFlow(p, cell) {
    const opts = Object.values(W.SPECIAL_BUILDINGS).map(b => ({
      value: b.id, icon: b.icon, name: b.name, desc: b.desc, price: b.cost,
      disabled: p.cash < b.cost,
    }));
    const pick = await U.modal({
      icon: '🏗️', title: '在 ' + cell.name + ' 盖什么？',
      desc: '选一种特殊建筑（费用一次性支付）：',
      cards: opts, wide: true,
      options: [{ label: '先不盖', value: 'skip', soft: true }],
    });
    if (pick && pick !== 'skip') await doBuildSpecial(p, cell, pick);
  }

  async function doBuildSpecial(p, cell, buildingId) {
    const b = W.SPECIAL_BUILDINGS[buildingId];
    if (!b) return;
    const paid = await E().chargeCash(p, b.cost, null, '建造「' + b.name + '」');
    if (!paid) return;
    cell.building = buildingId;
    global.SFX.play('build');
    B.updateCell(cell, E().G.players);
    U.log('🏗️ <b>' + U.esc(p.name) + '</b> 在 ' + cell.name + ' 建成 ' + b.icon + ' <b>' + b.name + '</b>', 'up');
    if (!p.isAI) {
      await U.modal({ icon: b.icon, title: b.name + ' 开业！', desc: b.desc, teach: b.teach });
    }
    E().render();
  }

  /* ======================================================================
     操作台：盖房面板（列出自己全部地产）
     ====================================================================== */
  async function openBuildPanel(p) {
    const G = E().G;
    const mine = p.estateIds.map(i => G.map[i]).filter(c => c.type === 'estate' && c.level < MAX_LV && !c.mortgaged);
    const specials = p.estateIds.map(i => G.map[i]).filter(c => c.type === 'special' && !c.building);

    if (!mine.length && !specials.length) {
      return U.modal({ icon: '🏗️', title: '暂时没地方盖房',
        desc: '你所有的地产都满级了（或者还没有地产）。去买一块地吧！', auto: 0 });
    }

    const cards = [];
    mine.forEach(c => {
      const chain = chainFactor(p, c);
      const nextRent = Math.round(c.rent[c.level + 1] * chain * CAL().scale('rent') * (G.rentMod ? G.rentMod.rate : 1));
      const cost = buildPrice(c);
      cards.push({
        value: 'estate:' + c.i, icon: c.icon,
        name: c.name + ' L' + c.level + '→L' + (c.level + 1),
        desc: '租金 ' + fmt(rentOf(c)) + ' → ' + fmt(nextRent),
        price: cost, disabled: p.cash < cost,
      });
    });
    specials.forEach(c => {
      const sp = specialPrice();
      cards.push({ value: 'special:' + c.i, icon: '🏗️', name: c.name + '（建地）',
        desc: '选择特殊建筑', price: sp, disabled: p.cash < sp });
    });

    const pick = await U.modal({
      icon: '🏗️', title: '盖房面板', desc: '选择要升级的地产（价格已含物价指数 ×' + CAL().index().toFixed(1) + '）：',
      cards, wide: true,
      options: [{ label: '关闭', value: 'close', soft: true }],
    });
    if (!pick || pick === 'close' || pick === 'skip') return;
    const [kind, idxStr] = pick.split(':');
    const cell = G.map[+idxStr];
    if (kind === 'estate') await buildFlow(p, cell);
    else await buildSpecialFlow(p, cell);
  }

  /* ======================================================================
     银行拍卖（原版：走到空地不买，银行立刻公开拍卖）
     AI 之间自动竞价，全程不弹交互窗，避免打断 AI 回合。
     ====================================================================== */
  async function bankAuction(cell, opts) {
    opts = opts || {};
    const G = E().G;
    if (G.over || cell.owner != null) return;
    const bidders = G.players.filter(p => !p.bankrupt && p.cash > BAL.auctionMinIncrement);
    if (bidders.length < 2) return;

    const base = Math.round(landPrice(cell) * 0.5 / 500) * 500;
    let humanMax = 0;
    if (opts.humanMayBid) {
      const human = G.players.find(p => !p.isAI && !p.bankrupt);
      if (human) {
        const tiers = [1, 1.5, 2].map(k => Math.round(base * k / 500) * 500);
        const choice = await U.modal({
          icon: '🔨', title: '银行拍卖 · ' + cell.name,
          desc: '你放弃了购买，银行把这块地公开拍卖，价高者得——你也可以参与竞拍。',
          rows: [
            { label: '起拍价', value: fmt(base) },
            { label: '公定价（含物价指数）', value: fmt(landPrice(cell)) },
            { label: '参与竞拍', value: bidders.length + ' 人' },
          ],
          options: [{ label: '我不参与', value: 'skip', soft: true }].concat(
            tiers.map((t, i) => ({ label: '最高出价 ' + fmt(t), value: 'bid:' + t,
              primary: i === 1, disabled: human.cash < t }))),
          teach: '拍卖里最危险的是「赢家的诅咒」：赢下竞价的人，往往是出价高过它真实价值的那个人。',
        });
        if (choice && choice.indexOf('bid:') === 0) humanMax = +choice.split(':')[1];
      }
    }

    const maxOf = p => p.isAI
      ? Math.round(landPrice(cell) * BAL.auctionAIFactor * (0.7 + (p.persona ? p.persona.riskTol : 0.5) * 0.6))
      : humanMax;

    let price = base, leader = null, turn = 0;
    for (let k = 0; k < 12; k++) {
      const next = price + BAL.auctionMinIncrement;
      const pool = bidders.filter(p => p !== leader && p.cash >= next && maxOf(p) >= next);
      if (!pool.length) break;
      leader = pool[turn % pool.length];
      turn++;
      price = next;
    }
    if (!leader) {
      U.log('🔨 银行拍卖「' + cell.name + '」无人应价，流拍，地块继续无主', 'info');
      return;
    }
    const paid = await E().chargeCash(leader, price, null, '拍卖竞得「' + cell.name + '」');
    if (!paid) return;
    cell.owner = leader.id;
    leader.estateIds.push(cell.i);
    B.updateCell(cell, G.players);
    U.log('🔨 <b>' + U.esc(leader.name) + '</b> 以 <span class="n up">' + fmt(price) +
      '</span> 拍下 ' + cell.icon + ' <b>' + cell.name + '</b>（公定价 ' + fmt(landPrice(cell)) + '）', 'up');
    E().render();
  }

  /* ======================================================================
     玩家间交易（原版：任何时间可与对手交易无建筑的地皮）
     人类发起 → 选对手一块地 → 选自己一块地 → 可选现金补偿 → AI 估值决定
     ====================================================================== */
  const valueOf = (c, owner) => {
    let v = landPrice(c) + (c.level || 0) * buildPrice(c) * 0.8;
    if (owner && ownedInDistrict(owner, c.district).length >= W.DISTRICT_SIZE[c.district] - 1) v *= 1.3;
    return Math.round(v);
  };

  async function tradePanel(p) {
    const G = E().G;
    const mine = p.estateIds.map(i => G.map[i]).filter(c => c.type === 'estate' && c.level === 0 && !c.mortgaged);
    const others = [];
    G.players.forEach(q => {
      if (q.id === p.id || q.bankrupt) return;
      q.estateIds.forEach(i => {
        const c = G.map[i];
        if (c.type === 'estate' && c.level === 0 && !c.mortgaged) others.push({ q, c });
      });
    });
    if (!mine.length || !others.length) {
      return U.modal({ icon: '🤝', title: '暂时没法交易', auto: 0,
        desc: '交易需要双方都有「无建筑的空地」。先去多买几块地吧！',
        teach: '原版规定：盖了房子的地不能交易。因为建筑属于土地，拆不干净就容易扯皮。' });
    }

    const pick = await U.modal({
      icon: '🤝', title: '地产交易 · 第 1 步',
      desc: '挑一块你想从对手手里换过来的空地：',
      cards: others.map(o => ({ value: 'take:' + o.q.id + ':' + o.c.i, icon: o.c.icon,
        name: o.c.name + '（' + o.q.name + '）', desc: W.DISTRICTS[o.c.district].name + ' · 地价 ' + fmt(landPrice(o.c)),
        price: landPrice(o.c) })),
      wide: true,
      options: [{ label: '取消', value: 'close', soft: true }],
    });
    if (!pick || pick === 'close') return;
    const parts = pick.split(':');
    const other = G.players[+parts[1]], target = G.map[+parts[2]];

    const give = await U.modal({
      icon: '🤝', title: '地产交易 · 第 2 步',
      desc: '用你的哪块空地来换？还可以加一笔现金补偿，提高对方接受概率。',
      cards: mine.map(c => ({ value: 'give:' + c.i, icon: c.icon, name: c.name,
        desc: W.DISTRICTS[c.district].name + ' · 地价 ' + fmt(landPrice(c)), price: landPrice(c) })),
      wide: true,
      options: [{ label: '取消', value: 'close', soft: true }],
    });
    if (!give || give === 'close') return;
    const myCell = G.map[+give.split(':')[1]];

    const cashChoice = await U.modal({
      icon: '💰', title: '地产交易 · 第 3 步',
      desc: '额外补多少现金给 ' + other.name + '？',
      options: [
        { label: '不加钱', value: 'cash:0' },
        { label: '补 ' + fmt(2000), value: 'cash:2000', disabled: p.cash < 2000 },
        { label: '补 ' + fmt(5000), value: 'cash:5000', primary: true, disabled: p.cash < 5000 },
        { label: '取消', value: 'cancel', soft: true },
      ],
    });
    if (!cashChoice || cashChoice === 'cancel') return;
    const extra = +cashChoice.split(':')[1];

    const want = valueOf(target, other);
    const offer = valueOf(myCell, p) + extra;
    const accepted = offer >= want * (0.85 + (other.persona ? other.persona.aggression * 0.1 : 0.05));
    if (!accepted) {
      await U.modal({ icon: '🙅', title: other.name + ' 拒绝了', auto: 0,
        desc: '对方觉得这笔买卖不划算（你的报价 ' + fmt(offer) + '，他的心理价位约 ' + fmt(want) + '）。',
        teach: '交易谈不拢，通常不是因为「谁更想赢」，而是双方对同一块地的估值不一样——能凑成垄断的那块地，对它的主人格外值钱。' });
      return;
    }

    /* 成交：交换产权 + 支付补偿 */
    target.owner = p.id; myCell.owner = other.id;
    p.estateIds = p.estateIds.filter(i => i !== myCell.i).concat([target.i]);
    other.estateIds = other.estateIds.filter(i => i !== target.i).concat([myCell.i]);
    if (extra > 0) { p.cash -= extra; other.cash += extra; }
    B.updateCell(target, G.players); B.updateCell(myCell, G.players);
    global.SFX.play('buy');
    U.log('🤝 <b>' + U.esc(p.name) + '</b> 用 ' + myCell.name +
      (extra ? ' + ' + fmt(extra) + ' 现金' : '') + ' 换到了 <b>' + U.esc(other.name) + '</b> 的 ' + target.name, 'up');
    E().render();
    await U.modal({ icon: '🤝', title: '成交！', auto: 0,
      desc: '交易完成。看看右侧的资产负债表——你的资产结构变了，但总资产未必变多。',
      teach: '交易本身不创造财富，它只是把资产换到「更能发挥作用的人」手里。这就是市场存在的意义。' });
  }

  /* ======================================================================
     清算链：现金不足支付时依次变现
     返回 true = 凑够了钱；false = 彻底破产（engine.chargeCash 会接管）
     ====================================================================== */
  async function liquidate(p, need, reason) {
    const G = E().G;
    U.log('⚠️ <b>' + U.esc(p.name) + '</b> 现金不足（需 ' + fmt(need) + '），开始变卖资产……', 'warn');

    /* 1. 拆房：回收建造费 50%（保留产权） */
    for (const i of p.estateIds.slice()) {
      if (p.cash >= need) break;
      const c = G.map[i];
      if (c.type === 'estate' && c.level > 0) {
        const back = Math.round(c.buildCost * BAL.sellBuildingRate);
        c.level--;
        p.cash += back;
        B.updateCell(c, G.players);
        U.log('🔨 拆除 ' + c.name + ' 一层建筑，回收 <span class="n">+' + fmt(back) + '</span>', 'down');
        await U.sleep(p.isAI ? 60 : 350);
      }
    }

    /* 2. 卖股票（按现价） */
    for (const id of Object.keys(p.stocks)) {
      if (p.cash >= need) break;
      const h = p.stocks[id];
      if (h.shares > 0 && G.market[id]) {
        const back = Math.round(h.shares * G.market[id].price);
        const profit = back - h.cost;
        p.stats.stockProfit += profit;
        p.cash += back;
        U.log('📈 清仓 ' + global.CFContent.STOCKS.find(s => s.id === id).name +
          '，回收 <span class="n">+' + fmt(back) + '</span>（' + (profit >= 0 ? '盈' : '亏') + fmt(Math.abs(profit)) + '）', profit >= 0 ? 'up' : 'down');
        h.shares = 0; h.cost = 0;
        await U.sleep(p.isAI ? 60 : 350);
      }
    }

    /* 3. 抵押：地价 60%，保留产权（赎回需 70%） */
    for (const i of p.estateIds.slice()) {
      if (p.cash >= need) break;
      const c = G.map[i];
      if (c.type === 'estate' && !c.mortgaged) {
        const back = Math.round(c.price * BAL.mortgageRate);
        c.mortgaged = true;
        p.cash += back;
        B.updateCell(c, G.players);
        U.log('🔒 抵押 ' + c.name + '，获得 <span class="n">+' + fmt(back) + '</span>', 'down');
        await U.sleep(p.isAI ? 60 : 350);
      }
    }

    /* 4. 卖地：地价 40%，产权移交银行 */
    for (const i of p.estateIds.slice()) {
      if (p.cash >= need) break;
      const c = G.map[i];
      const back = c.type === 'estate' ? Math.round(c.price * BAL.sellLandRate) : 4000;
      p.cash += back;
      c.owner = null;
      if (c.type === 'estate') { c.level = 0; c.mortgaged = false; }
      else c.building = null;
      p.estateIds = p.estateIds.filter(x => x !== i);
      B.updateCell(c, G.players);
      U.log('🏚️ 贱卖 ' + c.name + '，回收 <span class="n">+' + fmt(back) + '</span>', 'down');
      await U.sleep(p.isAI ? 60 : 350);
    }

    if (p.cash >= need) {
      if (!p.isAI) {
        await U.modal({ icon: '🩹', title: '资产变现完成',
          desc: '勉强凑够了这次支付。但注意：变卖资产都是打折卖的，这就是「现金垫」薄的真实代价。',
          rows: [{ label: '当前现金', value: fmt(p.cash) }],
          teach: '急用钱的时候，资产要打 4-6 折才能马上变现金。留足现金垫 = 省下这笔折价。' });
      }
      return true;
    }
    return false;
  }

  /* ======================================================================
     银行面板里的抵押/赎回（由 finance.js 调）
     ====================================================================== */
  async function mortgageFlow(p) {
    const G = E().G;
    const can = p.estateIds.map(i => G.map[i])
      .filter(c => c.type === 'estate' && !c.mortgaged);
    const canRedeem = p.estateIds.map(i => G.map[i])
      .filter(c => c.type === 'estate' && c.mortgaged);

    if (!can.length && !canRedeem.length) {
      return U.modal({ icon: '🔒', title: '没有可抵押的地产', auto: 0 });
    }

    const cards = [];
    can.forEach(c => cards.push({
      value: 'm:' + c.i, icon: '🔒', name: '抵押 ' + c.name,
      desc: '租金照收（若有人踩到）', price: '+' + fmt(Math.round(c.price * BAL.mortgageRate)),
    }));
    canRedeem.forEach(c => cards.push({
      value: 'r:' + c.i, icon: '🔓', name: '赎回 ' + c.name,
      desc: '解除抵押状态', price: '−' + fmt(Math.round(c.price * BAL.redeemRate)),
      disabled: p.cash < Math.round(c.price * BAL.redeemRate),
    }));
    const pick = await U.modal({
      icon: '🏦', title: '抵押 / 赎回', desc: '抵押拿地价 60%，赎回付地价 70%：', cards, wide: true,
      options: [{ label: '关闭', value: 'close', soft: true }],
    });
    if (!pick || pick === 'close') return;
    const [op, idxStr] = pick.split(':');
    const c = G.map[+idxStr];
    if (op === 'm') {
      const back = Math.round(c.price * BAL.mortgageRate);
      c.mortgaged = true; p.cash += back;
      U.log('🔒 <b>' + U.esc(p.name) + '</b> 抵押 ' + c.name + ' <span class="n">+' + fmt(back) + '</span>', 'down');
    } else {
      const pay = Math.round(c.price * BAL.redeemRate);
      c.mortgaged = false; p.cash -= pay;
      U.log('🔓 <b>' + U.esc(p.name) + '</b> 赎回 ' + c.name + ' <span class="n down">−' + fmt(pay) + '</span>', 'up');
    }
    B.updateCell(c, G.players);
    E().render();
  }

  global.Estate = {
    onEstate, onSpecial, buyFlow, doBuy, buildFlow, doBuild,
    buySpecialFlow, doBuySpecial, buildSpecialFlow, doBuildSpecial,
    openBuildPanel, liquidate, mortgageFlow, bankAuction, tradePanel,
    rentOf, hasMonopoly, ownedInDistrict, chainFactor, landPrice, buildPrice,
  };
})(window);
