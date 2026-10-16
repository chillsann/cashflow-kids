/* ==========================================================================
   现金流小富翁 v2 · 地产系统
   买地 · 盖房（L0-L4）· 收租（垄断×2）· 大型建地 · 抵押 · 破产清算链
   ====================================================================== */
(function (global) {
  'use strict';

  const U = global.UI;
  const B = global.Board;
  const W = global.CFWorld;
  const BAL = W.BALANCE;
  const E = () => global.Engine;
  const fmt = U.fmt;

  /* ======================================================================
     垄断与租金
     ====================================================================== */
  function ownedInDistrict(p, district) {
    return p.estateIds.filter(i => E().G.map[i].district === district);
  }

  function hasMonopoly(p, district) {
    return ownedInDistrict(p, district).length >= W.DISTRICT_SIZE[district];
  }

  function rentOf(cell) {
    const G = E().G;
    let rent = cell.rent[cell.level];
    const owner = cell.owner != null ? G.players[cell.owner] : null;
    if (owner && hasMonopoly(owner, cell.district)) rent *= 2;
    if (G.rentMod) rent = Math.round(rent * G.rentMod.rate);
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
      if (cell.level >= 4) {
        U.log('🏨 <b>' + U.esc(p.name) + '</b> 回到自己的 ' + cell.name + '（已满级 L4）', 'info');
        return;
      }
      return buildFlow(p, cell);
    }

    /* 他人 → 付租 */
    const owner = G.players[cell.owner];
    const rent = rentOf(cell);
    const mono = hasMonopoly(owner, cell.district);
    global.SFX.play('alert');

    await U.modal({
      icon: owner.emoji, title: '踩到 ' + owner.name + ' 的地了！',
      desc: cell.icon + ' ' + cell.name + '（L' + cell.level + '）' + (mono ? ' · ⚡垄断街区，租金 ×2' : ''),
      rows: [
        { label: '应付过路费', value: '−' + fmt(rent), cls: 'down', emphasis: true },
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
    const afford = p.cash >= cell.price;

    if (p.isAI) {
      if (!afford || !global.AISys.wantsEstate(p, cell)) {
        U.log('💭 AI ' + U.esc(p.name) + ' 放弃购买 ' + cell.name, 'info');
        return;
      }
      return doBuy(p, cell);
    }

    const sameDistrict = ownedInDistrict(p, cell.district).length;
    const choice = await U.modal({
      icon: cell.icon, title: '购买「' + cell.name + '」？',
      desc: D.icon + ' ' + D.name + ' 街区 · 无主地块',
      rows: [
        { label: '地价', value: '−' + fmt(cell.price), cls: 'down', emphasis: true },
        { label: '空地租金（搭棚）', value: fmt(cell.rent[0]) + ' /次' },
        { label: 'L4 酒店租金', value: fmt(cell.rent[4]) + ' /次' + (sameDistrict ? '' : '') },
        { label: '盖房费（每级）', value: fmt(cell.buildCost) },
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
    else U.log('💭 <b>' + U.esc(p.name) + '</b> 放弃购买 ' + cell.name, 'info');
  }

  async function doBuy(p, cell) {
    const G = E().G;
    const paid = await E().chargeCash(p, cell.price, null, '购买地产「' + cell.name + '」');
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
          { label: '下次路过这里可以', value: '加盖房屋（最高 L4）' },
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
    if (cell.level >= 4) return;
    const cost = cell.buildCost;
    const afford = p.cash >= cost;
    const nextRent = cell.rent[cell.level + 1];
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
        { label: '盖后租金', value: fmt(nextRent * (mono ? 2 : 1) * (G.rentMod ? G.rentMod.rate : 1)) + ' /次', cls: 'up' },
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
    const paid = await E().chargeCash(p, cell.buildCost, null, '在「' + cell.name + '」盖房');
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
    if (cell.building === 'resort') {
      const rent = G.rentMod ? Math.round(3000 * G.rentMod.rate) : 3000;
      await U.modal({
        icon: '🏝️', title: '住进了 ' + owner.name + ' 的度假饭店',
        desc: '一晚好眠——但账单不便宜。',
        rows: [{ label: '住宿费', value: '−' + fmt(rent), cls: 'down', emphasis: true }],
        auto: p.isAI ? 1400 : 0,
      });
      const paid = await E().chargeCash(p, rent, owner.id, '支付度假饭店住宿费');
      if (paid) { owner.stats.rentEarned += rent; p.stats.rentPaid += rent; }
      return;
    }

    const b = W.SPECIAL_BUILDINGS[cell.building];
    await U.modal({ icon: b.icon, title: owner.name + ' 的 ' + b.name,
      desc: b.desc + '（对你免费）', auto: p.isAI ? 1200 : 0 });
  }

  async function buySpecialFlow(p, cell) {
    const afford = p.cash >= 8000;
    if (p.isAI) {
      if (!afford || !global.AISys.wantsSpecial(p, cell)) return;
      return doBuySpecial(p, cell, global.AISys.pickSpecialBuilding(p));
    }
    const choice = await U.modal({
      icon: '🏗️', title: '竞拍「' + cell.name + '」？',
      desc: '大型建地：买下后可以盖 4 种特殊建筑之一。',
      rows: [
        { label: '地价', value: '−' + fmt(8000), cls: 'down', emphasis: true },
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
    const paid = await E().chargeCash(p, 8000, null, '竞拍「' + cell.name + '」');
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
    const mine = p.estateIds.map(i => G.map[i]).filter(c => c.type === 'estate' && c.level < 4 && !c.mortgaged);
    const specials = p.estateIds.map(i => G.map[i]).filter(c => c.type === 'special' && !c.building);

    if (!mine.length && !specials.length) {
      return U.modal({ icon: '🏗️', title: '暂时没地方盖房',
        desc: '你所有的地产都满级了（或者还没有地产）。去买一块地吧！', auto: 0 });
    }

    const cards = [];
    mine.forEach(c => {
      cards.push({
        value: 'estate:' + c.i, icon: c.icon,
        name: c.name + ' L' + c.level + '→L' + (c.level + 1),
        desc: '租金 ' + fmt(rentOf(c)) + ' → ' + fmt(c.rent[c.level + 1] * (hasMonopoly(p, c.district) ? 2 : 1)),
        price: c.buildCost, disabled: p.cash < c.buildCost,
      });
    });
    specials.forEach(c => {
      cards.push({ value: 'special:' + c.i, icon: '🏗️', name: c.name + '（建地）', desc: '选择特殊建筑', price: 8000 });
    });

    const pick = await U.modal({
      icon: '🏗️', title: '盖房面板', desc: '选择要升级的地产：', cards, wide: true,
      options: [{ label: '关闭', value: 'close', soft: true }],
    });
    if (!pick || pick === 'close' || pick === 'skip') return;
    const [kind, idxStr] = pick.split(':');
    const cell = G.map[+idxStr];
    if (kind === 'estate') await buildFlow(p, cell);
    else await buildSpecialFlow(p, cell);
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
    openBuildPanel, liquidate, mortgageFlow,
    rentOf, hasMonopoly, ownedInDistrict,
  };
})(window);
