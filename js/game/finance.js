/* ==========================================================================
   现金流小富翁 v2 · 金融系统
   银行存贷 · 股票行情与交易（SVG 走势图）· 乐透
   ====================================================================== */
(function (global) {
  'use strict';

  const U = global.UI;
  const W = global.CFWorld;
  const C = global.CFContent;
  const BAL = W.BALANCE;
  const E = () => global.Engine;
  const fmt = U.fmt;

  /* ======================================================================
     银行
     ====================================================================== */
  async function onBank(p) {
    if (p.isAI) { aiBank(p); return; }
    bankPanel(p);
  }

  async function bankPanel(p) {
    const G = E().G;
    const dep = BAL.depositStep;

    const html =
      '<div class="bank-grid">' +
      '<div class="bank-card"><div class="bc-title">💾 存款</div><div class="bc-val">' + fmt(p.deposit) +
        ' 元</div><div class="bc-note">利率 ' + (BAL.depositRate * 100) + '% / 轮</div>' +
        '<div class="bc-btns">' + dep.map(v =>
          '<button class="btn btn-soft btn-sm" data-bank="dep:' + v + '" ' + (p.cash < v ? 'disabled' : '') + '>存 ' + fmt(v) + '</button>').join('') +
        '<button class="btn btn-soft btn-sm" data-bank="wd" ' + (p.deposit <= 0 ? 'disabled' : '') + '>全部取出</button></div></div>' +
      '<div class="bank-card"><div class="bc-title">🏦 贷款</div><div class="bc-val">' + fmt(p.loan) +
        ' 元</div><div class="bc-note">利率 ' + (BAL.loanRate * 100) + '% / 轮 · 上限 ' + fmt(BAL.loanMax) + '</div>' +
        '<div class="bc-btns">' +
        '<button class="btn btn-soft btn-sm" data-bank="loan:5000" ' + (p.loan + 5000 > BAL.loanMax ? 'disabled' : '') + '>借 5,000</button>' +
        '<button class="btn btn-soft btn-sm" data-bank="loan:10000" ' + (p.loan + 10000 > BAL.loanMax ? 'disabled' : '') + '>借 10,000</button>' +
        '<button class="btn btn-soft btn-sm" data-bank="repay:5000" ' + (p.loan <= 0 || p.cash < Math.min(5000, p.loan) ? 'disabled' : '') + '>还 5,000</button>' +
        '<button class="btn btn-soft btn-sm" data-bank="repay:all" ' + (p.loan <= 0 || p.cash < p.loan ? 'disabled' : '') + '>全还</button></div></div>' +
      '</div>';

    await U.modal({
      icon: '🏦', title: '小镇银行',
      desc: '存款生利息，贷款付利息。贷款是杠杆：能放大收益，也能放大亏损。',
      html,
      keepOpen: true, wide: true,
      onCardSelect: async val => {
        if (val === 'wd') {
          p.cash += p.deposit;
          U.log('🏧 <b>' + U.esc(p.name) + '</b> 取出存款 <span class="n">+' + fmt(p.deposit) + '</span>', 'up');
          p.deposit = 0;
        } else if (val.startsWith('dep:')) {
          const v = +val.split(':')[1];
          p.cash -= v; p.deposit += v;
          U.log('💾 <b>' + U.esc(p.name) + '</b> 存入 <span class="n down">−' + fmt(v) + '</span>', 'info');
        } else if (val.startsWith('loan:')) {
          const v = Math.min(+val.split(':')[1], BAL.loanMax - p.loan);
          p.loan += v; p.cash += v;
          U.log('🏦 <b>' + U.esc(p.name) + '</b> 借入 <span class="n">+' + fmt(v) + '</span>（每轮利息 ' + fmt(Math.round(v * BAL.loanRate)) + '）', 'down');
        } else if (val.startsWith('repay:')) {
          const v = val === 'repay:all' ? p.loan : Math.min(5000, p.loan);
          const pay = Math.min(v, p.cash);
          p.loan -= pay; p.cash -= pay;
          U.log('🏦 <b>' + U.esc(p.name) + '</b> 还款 <span class="n down">−' + fmt(pay) + '</span>', 'up');
        } else if (val === 'mort') {
          U.closeModal('close');
          await global.Estate.mortgageFlow(p);
          return;
        }
        E().render();
        bankPanel(p);   // 刷新面板
      },
      options: [
        { label: '🔒 抵押 / 赎回地产', value: 'mort' },
        { label: '关闭', value: 'close', soft: true },
      ],
    });
  }

  function aiBank(p) {
    /* AI：现金过多 → 存款；贷款利率高于潜在收益 → 优先还款 */
    const reserve = p.persona.reserve * 4000;
    if (p.loan > 0 && p.cash > p.loan + reserve) {
      const pay = p.loan;
      p.loan = 0; p.cash -= pay;
      U.log('🏦 AI ' + U.esc(p.name) + ' 还清贷款 ' + fmt(pay), 'up');
    } else if (p.cash > reserve + 15000 && p.loan === 0) {
      const dep = Math.round((p.cash - reserve - 10000) / 2);
      p.cash -= dep; p.deposit += dep;
      U.log('💾 AI ' + U.esc(p.name) + ' 存入 ' + fmt(dep), 'info');
    }
  }

  /* ======================================================================
     每轮利息
     ====================================================================== */
  function interestTick() {
    const G = E().G;
    G.players.forEach(p => {
      if (p.bankrupt) return;
      if (p.deposit > 0) {
        const int = Math.round(p.deposit * BAL.depositRate);
        p.deposit += int;
      }
      if (p.loan > 0) {
        const int = Math.round(p.loan * BAL.loanRate);
        p.loan += int;          // 利滚利
        p.cash -= Math.min(int, Math.max(0, p.cash));
        if (int > 0) U.log('🏦 ' + U.esc(p.name) + ' 支付贷款利息 ' + fmt(int) + '（欠款 ' + fmt(p.loan) + '）', 'down');
      }
    });
  }

  /* ======================================================================
     股票行情
     ====================================================================== */
  function marketTick() {
    const G = E().G;
    C.STOCKS.forEach(s => {
      const m = G.market[s.id];
      /* 随机游走 + 均值回归：价格偏离基准越多，拉回力越强 */
      const revert = (s.base - m.price) / s.base * 0.15;
      const drift = 0.004;
      const noise = (Math.random() * 2 - 1) * s.vol;
      let next = m.price * (1 + drift + revert + noise);
      next = Math.max(Math.round(s.base * 0.3), Math.min(Math.round(s.base * 3), Math.round(next)));
      m.price = Math.max(1, next);
      m.history.push(m.price);
      if (m.history.length > 24) m.history.shift();
    });
    /* 分红 */
    G.players.forEach(p => {
      if (p.bankrupt) return;
      let div = 0;
      Object.keys(p.stocks).forEach(id => {
        const h = p.stocks[id];
        if (h.shares > 0 && G.market[id]) div += h.shares * G.market[id].price * BAL.stockDividend;
      });
      if (div >= 1) {
        div = Math.round(div);
        p.cash += div;
        U.log('📈 ' + U.esc(p.name) + ' 收到股票分红 <span class="n up">+' + fmt(div) + '</span>', 'up');
      }
    });
  }

  /* 走势 sparkline SVG */
  function sparkline(history, color) {
    const w = 120, h = 34;
    if (!history || history.length < 2) return '';
    const min = Math.min(...history), max = Math.max(...history);
    const span = max - min || 1;
    const pts = history.map((v, i) =>
      (i / (history.length - 1) * w).toFixed(1) + ',' + (h - 3 - (v - min) / span * (h - 6)).toFixed(1)).join(' ');
    const up = history[history.length - 1] >= history[0];
    const c = color || (up ? '#e0342b' : '#0f9d58');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="spark"><polyline points="' + pts + '" fill="none" stroke="' + c + '" stroke-width="2" stroke-linejoin="round"/></svg>';
  }

  /* 股票面板（keepOpen） */
  async function stockPanel(p) {
    const G = E().G;
    const rows = C.STOCKS.map(s => {
      const m = G.market[s.id];
      const h = p.stocks[s.id] || { shares: 0, cost: 0 };
      const chg = m.history.length > 1
        ? (m.price - m.history[m.history.length - 2]) / m.history[m.history.length - 2] * 100 : 0;
      return { s, m, h, chg };
    });

    const html = '<div class="stock-list">' + rows.map(r =>
      '<div class="stock-row" data-stock="' + r.s.id + '">' +
        '<div class="sr-head"><span class="sr-icon">' + r.s.icon + '</span>' +
          '<b>' + r.s.name + '</b>' +
          '<span class="sr-price">' + fmt(r.m.price) + '</span>' +
          '<span class="sr-chg ' + (r.chg >= 0 ? 'up' : 'down') + '">' +
            (r.chg >= 0 ? '▲' : '▼') + Math.abs(r.chg).toFixed(1) + '%</span></div>' +
        sparkline(r.m.history) +
        '<div class="sr-pos">持仓 ' + fmt(r.h.shares) + ' 股' +
          (r.h.shares > 0 ? ' · 市值 ' + fmt(r.h.shares * r.m.price) +
            '（' + (r.h.shares * r.m.price - r.h.cost >= 0 ? '<span class="up">浮盈 +' : '<span class="down">浮亏 −') +
            fmt(Math.abs(r.h.shares * r.m.price - r.h.cost)) + '</span>）' : '') + '</div>' +
        '<div class="sr-btns">' +
          '<button class="btn btn-soft btn-sm" data-stock-buy="' + r.s.id + ':100"' + (p.cash < r.m.price * 100 ? ' disabled' : '') + '>买100股</button>' +
          '<button class="btn btn-soft btn-sm" data-stock-buy="' + r.s.id + ':500"' + (p.cash < r.m.price * 500 ? ' disabled' : '') + '>买500股</button>' +
          '<button class="btn btn-soft btn-sm" data-stock-sell="' + r.s.id + ':half"' + (r.h.shares <= 0 ? ' disabled' : '') + '>卖一半</button>' +
          '<button class="btn btn-soft btn-sm" data-stock-sell="' + r.s.id + ':all"' + (r.h.shares <= 0 ? ' disabled' : '') + '>清仓</button>' +
        '</div>' +
      '</div>').join('') + '</div>';

    await U.modal({
      icon: '📈', title: '小镇证券交易所',
      desc: '低买高卖赚差价；持有还能每轮分红（市值 × 0.5%）。',
      html, keepOpen: true, wide: true,
      onCardSelect: async val => {
        if (val.startsWith('buy:')) {
          const [id, nStr] = val.slice(4).split(':');
          buyStock(p, id, +nStr);
        } else if (val.startsWith('sell:')) {
          const [id, mode] = val.slice(5).split(':');
          sellStock(p, id, mode);
        }
        E().render();
        stockPanel(p);   // 刷新
      },
      options: [{ label: '关闭', value: 'close', soft: true }],
    });
  }

  function buyStock(p, id, n) {
    const G = E().G;
    const m = G.market[id];
    const cost = m.price * n;
    if (p.cash < cost) return;
    const h = p.stocks[id] = p.stocks[id] || { shares: 0, cost: 0 };
    /* 加权平均成本 */
    h.cost = Math.round((h.cost + cost) / (h.shares + n) * (h.shares + n) / (h.shares + n) * (h.shares + n));
    h.cost = Math.round(((h.cost * h.shares + cost) / (h.shares + n)) * 1);
    h.shares += n;
    p.cash -= cost;
    global.SFX.play('buy');
    U.log('📈 <b>' + U.esc(p.name) + '</b> 买入 ' + stockName(id) + ' × ' + n + ' 股 <span class="n down">−' + fmt(cost) + '</span>（成本均价 ' + fmt(h.cost / h.shares) + '）', 'info');
  }

  function sellStock(p, id, mode) {
    const G = E().G;
    const m = G.market[id];
    const h = p.stocks[id];
    if (!h || h.shares <= 0) return;
    const n = mode === 'all' ? h.shares : Math.floor(h.shares / 2);
    if (n <= 0) return;
    const back = m.price * n;
    const costPart = Math.round(h.cost / h.shares * n);
    const profit = back - costPart;
    h.shares -= n;
    h.cost = Math.round(h.cost - costPart);
    p.cash += back;
    p.stats.stockProfit += profit;
    global.SFX.play('sell');
    U.log('📉 <b>' + U.esc(p.name) + '</b> 卖出 ' + stockName(id) + ' × ' + n + ' 股 <span class="n up">+' + fmt(back) + '</span>' +
      '（' + (profit >= 0 ? '<span class="up">盈利 +' : '<span class="down">亏损 −') + fmt(Math.abs(profit)) + '</span>）', profit >= 0 ? 'up' : 'down');
  }

  function stockName(id) {
    const s = C.STOCKS.find(x => x.id === id);
    return s ? s.icon + s.name : id;
  }

  /* ======================================================================
     乐透
     ====================================================================== */
  async function onLottery(p) {
    const G = E().G;
    const have = G.lottery.tickets[p.id] || 0;
    const price = BAL.lotteryPrice;

    if (p.isAI) {
      if (p.cash > 6000 && Math.random() < 0.3) {
        p.cash -= price;
        G.lottery.tickets[p.id] = have + 1;
        G.lottery.pot = Math.round(G.lottery.pot + price * BAL.lotteryPotRate);
        U.log('🎰 AI ' + U.esc(p.name) + ' 买了一张彩票', 'info');
      }
      return;
    }

    const choice = await U.modal({
      icon: '🎰', title: '乐透站',
      desc: '「一券在手，希望无穷！」每 ' + BAL.lotteryDrawEvery + ' 轮开奖一次。',
      rows: [
        { label: '当前奖池', value: fmt(G.lottery.pot) + ' 元', emphasis: true, cls: 'up' },
        { label: '下轮开奖', value: '第 ' + G.lottery.nextDrawRound + ' 轮（还剩 ' + Math.max(0, G.lottery.nextDrawRound - G.round) + ' 轮）' },
        { label: '你持有的彩票', value: have + ' 张' },
        { label: '中奖率（每张）', value: (BAL.lotteryWinRate * 100) + '%' },
      ],
      options: [
        { label: '买一张（' + fmt(price) + '）', value: 'buy', primary: true, disabled: p.cash < price },
        { label: '离开', value: 'close', soft: true },
      ],
      teach: '彩票是「负期望」游戏的典型：买的人整体一定亏，只有极少数幸运儿赚。小赌怡情可以，把它当理财就是灾难。',
    });

    if (choice === 'buy') {
      p.cash -= price;
      G.lottery.tickets[p.id] = have + 1;
      G.lottery.pot = Math.round(G.lottery.pot + price * BAL.lotteryPotRate);
      global.SFX.play('click');
      U.log('🎰 <b>' + U.esc(p.name) + '</b> 买了一张彩票（持有 ' + (have + 1) + ' 张）', 'info');
      E().render();
    }
  }

  function lotteryDraw() {
    const G = E().G;
    const buyers = G.players.filter(p => (G.lottery.tickets[p.id] || 0) > 0 && !p.bankrupt);
    if (!buyers.length) {
      U.setNews('🎰 本轮乐透开奖：无人中奖，奖池累积至 ' + fmt(G.lottery.pot), '乐透');
      return;
    }
    const winners = [];
    buyers.forEach(p => {
      const n = G.lottery.tickets[p.id];
      for (let k = 0; k < n; k++) {
        if (Math.random() < BAL.lotteryWinRate) { winners.push(p); break; }
      }
    });
    if (winners.length) {
      const share = Math.round(G.lottery.pot / winners.length);
      winners.forEach(p => {
        p.cash += share;
        p.stats.lotteryWon += share;
        U.log('🎰🎊 <b>' + U.esc(p.name) + '</b> 中了乐透头奖！<span class="n up">+' + fmt(share) + '</span>', 'win');
      });
      G.lottery.pot = BAL.lotteryInitPot;
      U.setNews('🎰 乐透开奖：' + winners.map(p => p.name).join('、') + ' 平分了奖池！', '乐透');
      global.SFX.play('lucky');
    } else {
      U.setNews('🎰 本轮乐透开奖：无人中奖，奖池累积至 ' + fmt(G.lottery.pot), '乐透');
    }
    G.lottery.tickets = {};
  }

  global.Finance = {
    onBank, bankPanel, aiBank, interestTick,
    marketTick, sparkline, stockPanel, buyStock, sellStock,
    onLottery, lotteryDraw,
  };
})(window);
