/* ==========================================================================
   现金流小富翁 v3 · 金融系统（对齐大富翁4Fun）
   银行：存取款 / 3 个月贷款（无息，但贷款期间存款停息）/ 假日休业 / 月底 10% 结息
   股票：营业日行情波动 / 休市日不可交易 / 月底分红 / SVG 走势图
   乐透：自选号码 / 每月 15 号开奖 / 无人中奖滚存 / 罚金注入奖池
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.UI;
  const W = global.CFWorld;
  const C = global.CFContent;
  const BAL = W.BALANCE;
  const E = () => global.Engine;
  const CAL = () => global.Calendar;
  const fmt = U.fmt;
  const esc = U.esc;

  /* ======================================================================
     银行
     ====================================================================== */
  async function onBank(p) {
    if (!CAL().isBankOpen()) {
      U.log('🏦 <b>' + esc(p.name) + '</b> 来到银行，但今天' + (CAL().isHoliday() ? '是假日' : '休市') + '，银行没开门', 'info');
      await U.modal({
        icon: '🏦', title: '银行今日休业', auto: p.isAI ? 1200 : 0,
        desc: CAL().label() + ' —— 周末与小镇假日，股市和银行都不营业。',
        teach: '现实里银行也有营业时间。把这个限制放进游戏，是想让孩子知道：钱不是随时都能调度的，现金流要提前安排。',
      });
      return;
    }
    if (p.isAI) { aiBank(p); return; }
    await bankPanel(p);
  }

  async function bankPanel(p) {
    if (!CAL().isBankOpen()) return onBank(p);
    const G = E().G;
    const dep = BAL.depositStep;
    const due = p.loanDueDay ? Math.max(0, p.loanDueDay - G.round) : 0;

    const html =
      '<div class="bank-grid">' +
      '<div class="bank-card"><div class="bc-title">💾 存款</div><div class="bc-val">' + fmt(p.deposit) +
        ' 元</div><div class="bc-note">每月 ' + CAL().config.drawDay + ' 号按存款 <b>' + (BAL.depositRate * 100) +
        '%</b> 结息' + (p.loan > 0 ? ' · <span class="down">贷款期间暂停计息</span>' : '') + '</div>' +
        '<div class="bc-btns">' + dep.map(v =>
          '<button class="btn btn-soft btn-sm" data-value="dep:' + v + '" ' + (p.cash < v ? 'disabled' : '') + '>存 ' + fmt(v) + '</button>').join('') +
        '<button class="btn btn-soft btn-sm" data-value="wd" ' + (p.deposit <= 0 ? 'disabled' : '') + '>全部取出</button></div></div>' +
      '<div class="bank-card"><div class="bc-title">🏦 贷款</div><div class="bc-val">' + fmt(p.loan) +
        ' 元</div><div class="bc-note">贷款 <b>不收利息</b>，但借期 ' + (BAL.loanTermDays / CAL().config.monthDays) +
        ' 个月（' + BAL.loanTermDays + ' 天），到期必须全数归还' +
        (p.loan > 0 ? '<br>📅 距到期还有 <b>' + due + '</b> 天' : '') + '</div>' +
        '<div class="bc-btns">' +
        '<button class="btn btn-soft btn-sm" data-value="loan:5000" ' + (p.loan + 5000 > BAL.loanMax ? 'disabled' : '') + '>借 5,000</button>' +
        '<button class="btn btn-soft btn-sm" data-value="loan:10000" ' + (p.loan + 10000 > BAL.loanMax ? 'disabled' : '') + '>借 10,000</button>' +
        '<button class="btn btn-soft btn-sm" data-value="repay:5000" ' + (p.loan <= 0 || p.cash < Math.min(5000, p.loan) ? 'disabled' : '') + '>还 5,000</button>' +
        '<button class="btn btn-soft btn-sm" data-value="repay:all" ' + (p.loan <= 0 || p.cash < p.loan ? 'disabled' : '') + '>全还</button></div></div>' +
      '</div>' +
      '<div class="bank-tip">💡 贷款不收利息，代价是<b>这段时间存款也不生息</b>——这就是原版最巧妙的设计：借钱没有直接成本，但会让你失去「钱生钱」的机会。</div>';

    await U.modal({
      icon: '🏦', title: '小镇银行 · ' + CAL().label(),
      desc: '存取款随时可办；贷款 3 个月到期必须还清，贷款期间存款停止计息。',
      html, keepOpen: true, wide: true,
      onCardSelect: async val => {
        /* keepOpen 模式下「关闭」也会流进这里，不特判会无限重开面板 */
        if (val === 'close') { U.closeModal('close'); return; }
        if (val === 'wd') {
          const v = p.deposit;
          p.cash += v; p.deposit = 0;
          U.log('🏧 <b>' + esc(p.name) + '</b> 取出全部存款 <span class="n up">+' + fmt(v) + '</span>', 'up');
        } else if (val.indexOf('dep:') === 0) {
          const v = +val.split(':')[1];
          if (p.cash >= v) {
            p.cash -= v; p.deposit += v;
            U.log('💾 <b>' + esc(p.name) + '</b> 存入 <span class="n">−' + fmt(v) + '</span>（现金 → 存款）', 'info');
          }
        } else if (val.indexOf('loan:') === 0) {
          const v = Math.min(+val.split(':')[1], BAL.loanMax - p.loan);
          if (v > 0) {
            p.loan += v; p.cash += v;
            p.loanDueDay = (p.loanDueDay && p.loan > v) ? p.loanDueDay : G.round + BAL.loanTermDays;
            U.log('🏦 <b>' + esc(p.name) + '</b> 借入 <span class="n up">+' + fmt(v) + '</span> · ' +
              BAL.loanTermDays + ' 天后到期，期间存款停息', 'down');
          }
        } else if (val.indexOf('repay:') === 0) {
          const v = val === 'repay:all' ? p.loan : Math.min(5000, p.loan);
          const pay = Math.min(v, p.cash);
          p.loan -= pay; p.cash -= pay;
          if (p.loan <= 0) p.loanDueDay = 0;
          U.log('🏦 <b>' + esc(p.name) + '</b> 还款 <span class="n down">−' + fmt(pay) + '</span>（剩余欠款 ' + fmt(p.loan) + '）', 'up');
        } else if (val === 'mort') {
          U.closeModal('close');
          await global.Estate.mortgageFlow(p);
          return;
        }
        E().render();
        bankPanel(p);   // 刷新面板余额
      },
      options: [
        { label: '🔒 抵押 / 赎回地产', value: 'mort' },
        { label: '关闭', value: 'close', soft: true },
      ],
    });
  }

  function aiBank(p) {
    if (!CAL().isBankOpen()) return;
    /* AI：现金过多 → 存款（有贷款时优先还款，恢复计息） */
    const reserve = p.persona.reserve * 4000;
    if (p.loan > 0 && p.cash > p.loan + reserve) {
      const pay = p.loan;
      p.loan = 0; p.loanDueDay = 0; p.cash -= pay;
      U.log('🏦 <b>' + esc(p.name) + '</b> 提前还清贷款 ' + fmt(pay) + '，存款恢复计息', 'up');
    } else if (p.cash > reserve + 15000 && p.loan === 0) {
      const v = Math.round((p.cash - reserve - 10000) / 2);
      if (v > 0) {
        p.cash -= v; p.deposit += v;
        U.log('💾 <b>' + esc(p.name) + '</b> 存入 ' + fmt(v) + ' 吃月底利息', 'info');
      }
    }
  }

  /* 兼容旧调用：利息已改为「每月底结算」 */
  function interestTick() { /* no-op：由 monthEndSettle 统一处理 */ }

  /* ======================================================================
     月底结算（每月 15 号，由 Calendar 驱动）
     ====================================================================== */
  function monthEndSettle(ev) {
    const G = E().G;
    U.log('📅 <b>月底结算 · ' + esc(ev ? ev.label : CAL().label()) + '</b>', 'gold');

    G.players.forEach(p => {
      if (p.bankrupt) return;

      /* 1) 存款利息：贷款期间停息（原版） */
      if (p.deposit > 0) {
        if (p.loan > 0) {
          U.log('🏦 ' + esc(p.name) + ' 贷款未清，本月存款利息暂停发放', 'info');
        } else {
          const int = Math.round(p.deposit * BAL.depositRate);
          p.deposit += int;
          U.log('💰 ' + esc(p.name) + ' 存款结息 <span class="n up">+' + fmt(int) + '</span>（' +
            (BAL.depositRate * 100) + '% / 月）', 'up');
        }
      }

      /* 2) 股票分红（月底一次） */
      let div = 0;
      Object.keys(p.stocks).forEach(id => {
        const h = p.stocks[id];
        if (h.shares > 0 && G.market[id]) div += h.shares * G.market[id].price * BAL.stockDividend;
      });
      if (div >= 1) {
        div = Math.round(div);
        p.cash += div;
        U.log('📈 ' + esc(p.name) + ' 收到股票分红 <span class="n up">+' + fmt(div) + '</span>', 'up');
      }

      /* 3) 贷款到期：强制归还，不足则先动存款 / 卖股，仍不足记逾期罚息 */
      if (p.loan > 0 && p.loanDueDay && G.round >= p.loanDueDay) {
        const due = p.loan;
        let pool = p.cash;
        const fromDeposit = Math.min(p.deposit, Math.max(0, due - pool));
        p.deposit -= fromDeposit; pool += fromDeposit;
        if (pool < due) {
          /* 变卖股票补足 */
          Object.keys(p.stocks).forEach(id => {
            if (pool >= due) return;
            const h = p.stocks[id], m = G.market[id];
            if (!h || h.shares <= 0 || !m) return;
            const need = due - pool;
            const n = Math.min(h.shares, Math.ceil(need / Math.max(1, m.price)));
            const back = n * m.price;
            const costPart = Math.round(h.cost / h.shares * n);
            h.shares -= n; h.cost = Math.max(0, h.cost - costPart);
            p.stats.stockProfit += back - costPart;
            pool += back;
          });
        }
        if (pool >= due) {
          p.cash = pool - due; p.loan = 0; p.loanDueDay = 0;
          U.log('🏦 <b>' + esc(p.name) + '</b> 贷款到期，已全额归还 ' + fmt(due) + '（自动动用存款 / 股票）', 'warn');
        } else {
          p.cash = 0; p.loan = Math.max(0, due - pool) + Math.round(due * 0.10);
          p.loanDueDay = G.round + BAL.calendar.monthDays;
          U.log('⚠️ <b>' + esc(p.name) + '</b> 贷款到期无力偿还，逾期加收 10% 并宽限一个月（欠款 ' + fmt(p.loan) + '）', 'down');
        }
      }
    });
  }

  /* ======================================================================
     股票行情（仅营业日推进，分红已移至月底）
     ====================================================================== */
  function marketTick() {
    if (!CAL().isMarketOpen()) return;
    const G = E().G;
    const idx = CAL().index();
    C.STOCKS.forEach(s => {
      const m = G.market[s.id];
      /* 随机游走 + 均值回归；物价指数抬高市场整体重心 */
      const center = s.base * (0.85 + idx * 0.15);
      const revert = (center - m.price) / s.base * 0.15;
      const drift = 0.004;
      const noise = (Math.random() * 2 - 1) * s.vol;
      let next = m.price * (1 + drift + revert + noise);
      next = Math.max(Math.round(s.base * 0.3), Math.min(Math.round(s.base * 3), Math.round(next)));
      m.price = Math.max(1, next);
      m.history.push(m.price);
      if (m.history.length > 24) m.history.shift();
    });
  }

  /* 走势 sparkline SVG —— 中国习惯：涨红跌绿 */
  function sparkline(history, color) {
    const w = 120, h = 34;
    if (!history || history.length < 2) return '';
    const min = Math.min.apply(null, history), max = Math.max.apply(null, history);
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
    const closed = !CAL().isMarketOpen();
    const rows = C.STOCKS.map(s => {
      const m = G.market[s.id];
      const h = p.stocks[s.id] || { shares: 0, cost: 0 };
      const chg = m.history.length > 1
        ? (m.price - m.history[m.history.length - 2]) / m.history[m.history.length - 2] * 100 : 0;
      return { s, m, h, chg };
    });

    const html =
      (closed ? '<div class="market-closed">🔒 ' + esc(CAL().label()) + ' · 假日休市，今日不可交易（可查看行情）</div>' : '') +
      '<div class="stock-list">' + rows.map(r =>
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
          '<button class="btn btn-soft btn-sm" data-value="buy:' + r.s.id + ':100"' + (closed || p.cash < r.m.price * 100 ? ' disabled' : '') + '>买100股</button>' +
          '<button class="btn btn-soft btn-sm" data-value="buy:' + r.s.id + ':500"' + (closed || p.cash < r.m.price * 500 ? ' disabled' : '') + '>买500股</button>' +
          '<button class="btn btn-soft btn-sm" data-value="sell:' + r.s.id + ':half"' + (closed || r.h.shares <= 0 ? ' disabled' : '') + '>卖一半</button>' +
          '<button class="btn btn-soft btn-sm" data-value="sell:' + r.s.id + ':all"' + (closed || r.h.shares <= 0 ? ' disabled' : '') + '>清仓</button>' +
        '</div>' +
      '</div>').join('') + '</div>';

    await U.modal({
      icon: '📈', title: '小镇证券交易所 · ' + CAL().label(),
      desc: closed ? '今天休市，只能看盘不能下单。' :
        '低买高卖赚差价；每月底按持仓市值分红（' + (BAL.stockDividend * 100) + '%）。周末 / 假日休市。',
      html, keepOpen: true, wide: true,
      onCardSelect: async val => {
        if (val === 'close') { U.closeModal('close'); return; }
        if (val.indexOf('buy:') === 0) {
          const parts = val.slice(4).split(':');
          buyStock(p, parts[0], +parts[1]);
        } else if (val.indexOf('sell:') === 0) {
          const parts = val.slice(5).split(':');
          sellStock(p, parts[0], parts[1]);
        }
        E().render();
        stockPanel(p);
      },
      options: [{ label: '关闭', value: 'close', soft: true }],
    });
  }

  function buyStock(p, id, n) {
    if (!CAL().isMarketOpen()) return;
    const G = E().G;
    const m = G.market[id];
    const cost = m.price * n;
    if (p.cash < cost) return;
    const h = p.stocks[id] = p.stocks[id] || { shares: 0, cost: 0 };
    h.cost = h.cost + cost;
    h.shares += n;
    p.cash -= cost;
    global.SFX.play('buy');
    U.log('📈 <b>' + esc(p.name) + '</b> 买入 ' + stockName(id) + ' × ' + n + ' 股 <span class="n down">−' + fmt(cost) + '</span>（成本均价 ' + fmt(h.cost / h.shares) + '）', 'info');
  }

  function sellStock(p, id, mode) {
    if (!CAL().isMarketOpen()) return;
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
    h.cost = Math.max(0, Math.round(h.cost - costPart));
    p.cash += back;
    p.stats.stockProfit += profit;
    global.SFX.play('sell');
    U.log('📉 <b>' + esc(p.name) + '</b> 卖出 ' + stockName(id) + ' × ' + n + ' 股 <span class="n up">+' + fmt(back) + '</span>' +
      '（' + (profit >= 0 ? '<span class="up">盈利 +' : '<span class="down">亏损 −') + fmt(Math.abs(profit)) + '</span>）', profit >= 0 ? 'up' : 'down');
  }

  function stockName(id) {
    const s = C.STOCKS.find(x => x.id === id);
    return s ? s.icon + s.name : id;
  }

  /* ======================================================================
     乐透（自选号码 / 每月 15 号开奖 / 滚存）
     ====================================================================== */
  const NUM_MIN = () => BAL.lotteryNumberMin;
  const NUM_MAX = () => BAL.lotteryNumberMax;
  const picksOf = (G, p) => (G.lottery.picks[p.id] = G.lottery.picks[p.id] || []);

  async function onLottery(p) {
    const G = E().G;
    const price = BAL.lotteryPrice;

    if (p.isAI) {
      const picks = picksOf(G, p);
      if (p.cash > price * 3 && picks.length < 2 && Math.random() < 0.55) {
        let n;
        let guard = 0;
        do { n = NUM_MIN() + Math.floor(Math.random() * (NUM_MAX() - NUM_MIN() + 1)); guard++; }
        while (picks.indexOf(n) >= 0 && guard < 20);
        p.cash -= price;
        picks.push(n);
        G.lottery.tickets[p.id] = picks.length;
        G.lottery.pot = Math.round(G.lottery.pot + price * BAL.lotteryPotRate);
        U.log('🎰 <b>' + esc(p.name) + '</b> 买了 ' + n + ' 号彩票', 'info');
      }
      return;
    }

    const picks = picksOf(G, p);
    const cards = [];
    for (let n = NUM_MIN(); n <= NUM_MAX(); n++) {
      const owned = picks.indexOf(n) >= 0;
      cards.push({
        value: 'pick:' + n,
        name: n + ' 号',
        icon: owned ? '✅' : '🎟️',
        desc: owned ? '你已持有' : '点我投注',
        price: price,
        disabled: owned || p.cash < price,
      });
    }

    const choice = await U.modal({
      icon: '🎰', title: '乐透站 · ' + CAL().label(),
      desc: '选一个你喜欢的号码投注，每月 ' + CAL().config.drawDay + ' 号开奖。开奖号命中即平分奖池；无人中奖，奖金全部滚存到下个月。',
      rows: [
        { label: '当前奖池', value: fmt(G.lottery.pot) + ' 元', emphasis: true, cls: 'up' },
        { label: '距开奖', value: CAL().nextDrawDays() + ' 天（每月 ' + CAL().config.drawDay + ' 号）' },
        { label: '你已买的号码', value: picks.length ? picks.join('、') + ' 号' : '还没有' },
        { label: '上次开奖', value: G.lottery.lastDraw ? G.lottery.lastDraw.number + ' 号（第 ' + G.lottery.lastDraw.day + ' 天）' : '尚未开奖' },
      ],
      cards,
      options: [{ label: '离开', value: 'close', soft: true }],
      teach: '彩票是「负期望」游戏：所有买彩票的人整体一定亏，只有极少数幸运儿赚。小赌怡情可以，把它当理财就是灾难。',
    });

    if (choice && choice.indexOf('pick:') === 0) {
      const n = +choice.split(':')[1];
      const own = picksOf(G, p);
      if (own.indexOf(n) < 0 && p.cash >= price) {
        p.cash -= price;
        own.push(n);
        G.lottery.tickets[p.id] = own.length;
        G.lottery.pot = Math.round(G.lottery.pot + price * BAL.lotteryPotRate);
        global.SFX.play('click');
        U.log('🎰 <b>' + esc(p.name) + '</b> 投注 <b>' + n + ' 号</b>彩票（' + fmt(price) + ' 元，奖池 ' + fmt(G.lottery.pot) + '）', 'info');
        E().render();
      }
    }
  }

  function lotteryDraw() {
    const G = E().G;
    const num = NUM_MIN() + Math.floor(Math.random() * (NUM_MAX() - NUM_MIN() + 1));
    const holders = G.players.filter(p => !p.bankrupt && (G.lottery.picks[p.id] || []).indexOf(num) >= 0);
    G.lottery.lastDraw = { day: G.round, number: num };

    if (holders.length) {
      const share = Math.round(G.lottery.pot / holders.length);
      holders.forEach(p => {
        p.cash += share;
        p.stats.lotteryWon += share;
        U.log('🎰🎊 <b>' + esc(p.name) + '</b> 的 <b>' + num + ' 号</b>中了乐透！<span class="n up">+' + fmt(share) + '</span>', 'win');
      });
      G.lottery.pot = BAL.lotteryInitPot;
      G.lottery.lastWin = { day: G.round, number: num, names: holders.map(p => p.name) };
      U.setNews('🎰 乐透开奖 ' + num + ' 号：' + holders.map(p => p.name).join('、') + ' 平分 ' + fmt(share) + '！', '乐透');
      global.SFX.play('lucky');
    } else {
      G.lottery.lastWin = null;
      U.log('🎰 本月乐透开出 <b>' + num + ' 号</b>，无人命中，' + fmt(G.lottery.pot) + ' 元奖池<b>滚存至下月</b>', 'warn');
      U.setNews('🎰 乐透开奖 ' + num + ' 号：无人中奖，奖池滚存至 ' + fmt(G.lottery.pot), '乐透');
    }
    /* 清空本月投注，下月重新选号 */
    G.lottery.picks = {};
    G.lottery.tickets = {};
    G.players.forEach(p => { p.lotteryPicks = []; });
  }

  global.Finance = {
    onBank, bankPanel, aiBank, interestTick, monthEndSettle,
    marketTick, sparkline, stockPanel, buyStock, sellStock,
    onLottery, lotteryDraw,
  };
})(window);
