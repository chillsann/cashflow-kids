/* ==========================================================================
   现金流小富翁 v3.2 · 金融系统（对齐大富翁4Fun）
   银行：存取款 / 3 个月贷款（无息，但贷款期间存款停息）/ 假日休业 / 月底 10% 结息
   股票：量价引擎行情 / 休市日不可交易 / 月底分红 / 专业 K 线+VOL+MACD 组合图
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
        if (h.shares > 0 && G.market[id]) div += Math.round(h.shares * G.market[id].price * BAL.stockDividend);
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
     ----------------------------------------------------------------------
     v3.2：行情生成全部交给 MarketEngine（阶段状态机 + 量价耦合），
     这里只保留统一入口、专业组合图渲染与交易面板。
     ====================================================================== */
  const ME = global.MarketEngine;
  const K_UP = '#e0342b', K_DOWN = '#0f9d58';       // 中国习惯：红涨绿跌
  const K_MA5 = '#E39A6B', K_MA10 = '#4F6EF7', K_MA20 = '#9B7BD4';
  const p2 = v => (Math.round(v * 100) / 100).toFixed(2);
  const num = v => Math.round(v).toLocaleString('zh-CN');
  const f2 = v => (v >= 0 ? '+' : '') + v.toFixed(2);
  const PHASE_NAME = {
    accumulate: '底部吸筹', breakout: '放量突破', trend: '趋势推进',
    distribute: '顶部派发', downtrend: '下跌趋势', box: '整理平台',
  };

  function stockDef(id) {
    return C.STOCKS.find(s => s.id === id) || { id: id, base: 50, vol: 0.1, name: id, icon: '📈' };
  }

  /* 统一行情写入口：任何改价（内线卡 / 新闻事件）都必须走这里，
     保证 history / candles / price 同步，并生成「消息面放量」的完整 K 线。 */
  function pushQuote(m, next) {
    const G = E().G;
    let id = m.id;
    if (!id && G && G.market) id = Object.keys(G.market).find(k => G.market[k] === m);
    const def = stockDef(id);
    const rate = m.price > 0 ? (next - m.price) / m.price : 0;
    ME.shock(m, def, id, rate);
    return m.price;
  }

  /* 旧存档兼容：补 OHLC / 成交量 / 引擎状态 */
  function ensureCandles(m, id) {
    return ME.normalize(m, stockDef(id), id);
  }

  function marketTick() {
    if (!CAL().isMarketOpen()) return;
    const G = E().G;
    C.STOCKS.forEach(s => ME.tick(G.market[s.id], s, s.id));
  }

  /* ======================================================================
     专业组合行情图
     一个 SVG 内三区共用 X 轴：主图（蜡烛 + MA5/10/20） / VOL / MACD，
     并带十字光标。视觉对齐国内行情软件：阳线红框空心、阴线绿实心。
     ====================================================================== */
  let _klCache = null, _klBound = false;

  function marketChartSVG(ks0, opt) {
    const o = opt || {};
    const W = o.width || 680, H = o.height || 372;
    const padL = 6, padR = 58, plotW = W - padL - padR;
    const PT = 10, PH = 196, PB = PT + PH;      // 主图
    const VT = 222, VH = 60, VB = VT + VH;      // 成交量
    const MT = 298, MH = 54, MB = MT + MH;      // MACD
    const ks = ks0.slice(-(o.max || ME.SHOW_K));
    if (!ks.length) return '<div class="kline-empty">暂无行情数据</div>';
    const ind = ME.indicators(ks);

    /* 价格范围含三条均线，避免 MA 画出界 */
    let rawHi = -Infinity, rawLo = Infinity;
    ks.forEach(k => { rawHi = Math.max(rawHi, k.h); rawLo = Math.min(rawLo, k.l); });
    [ind.ma5, ind.ma10, ind.ma20].forEach(a => a.forEach(v => {
      if (v != null) { rawHi = Math.max(rawHi, v); rawLo = Math.min(rawLo, v); }
    }));
    const padP = (rawHi - rawLo) * 0.06 || Math.max(0.5, rawHi * 0.02);
    const hi = rawHi + padP, lo = Math.max(0, rawLo - padP), span = (hi - lo) || 1;
    const yP = v => PT + (hi - v) / span * PH;

    let maxV = 0;
    ks.forEach(k => { maxV = Math.max(maxV, k.v || 0); });
    [ind.vma5, ind.vma10].forEach(a => a.forEach(v => { if (v != null) maxV = Math.max(maxV, v); }));
    maxV = maxV * 1.12 || 1;
    const yV = v => VB - v / maxV * VH;

    let maxA = 0;
    ['dif', 'dea', 'hist'].forEach(key => ind.macd[key].forEach(v => { maxA = Math.max(maxA, Math.abs(v)); }));
    maxA = maxA * 1.15 || 1;
    const yM0 = MT + MH / 2;
    const yM = v => yM0 - v / maxA * (MH / 2 - 2);

    const step = plotW / ks.length;
    const bw = Math.max(2, Math.min(11, step * 0.62));
    const cx = i => padL + step * (i + 0.5);
    const X2 = W - padR;

    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="kline kl-main" role="img" aria-label="股票 K 线、成交量与 MACD 组合图">';
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="8" fill="#FFFDF9"/>';

    /* 网格 + 右侧价格刻度 */
    for (let g = 0; g <= 4; g++) {
      const v = hi - span * g / 4, gy = yP(v);
      s += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + X2 + '" y2="' + gy.toFixed(1) +
        '" stroke="#E9E1D0" stroke-width="1" stroke-dasharray="3 4"/>';
      s += '<text x="' + (X2 + 5) + '" y="' + (gy + 3.4).toFixed(1) +
        '" font-size="9.5" fill="#8A97A6" font-weight="700">' + v.toFixed(2) + '</text>';
    }
    const every = Math.max(1, Math.ceil(ks.length / 8));
    ks.forEach((k, i) => {
      if (i % every === 0) {
        const x = cx(i);
        s += '<line x1="' + x.toFixed(1) + '" y1="' + PT + '" x2="' + x.toFixed(1) + '" y2="' + MB +
          '" stroke="#F0EADC" stroke-width="1"/>';
      }
    });
    s += '<line x1="' + padL + '" y1="214" x2="' + X2 + '" y2="214" stroke="#E3DAC6" stroke-width="1"/>';
    s += '<line x1="' + padL + '" y1="290" x2="' + X2 + '" y2="290" stroke="#E3DAC6" stroke-width="1"/>';
    s += '<line x1="' + padL + '" y1="' + yV(maxV / 2).toFixed(1) + '" x2="' + X2 + '" y2="' + yV(maxV / 2).toFixed(1) +
      '" stroke="#EEE7D8" stroke-width="1" stroke-dasharray="3 4"/>';
    s += '<line x1="' + padL + '" y1="' + yM0.toFixed(1) + '" x2="' + X2 + '" y2="' + yM0.toFixed(1) +
      '" stroke="#DCD3C0" stroke-width="1"/>';
    s += '<text x="' + (padL + 3) + '" y="' + (VT + 10) + '" font-size="9" fill="#98A5B3" font-weight="800">VOL 成交量(手)</text>';
    s += '<text x="' + (X2 + 5) + '" y="' + (VT + 10) + '" font-size="9" fill="#98A5B3" font-weight="700">' + num(maxV) + '</text>';
    s += '<text x="' + (padL + 3) + '" y="' + (MT + 10) + '" font-size="9" fill="#98A5B3" font-weight="800">MACD(12,26,9)</text>';

    /* 蜡烛 + 量柱 + MACD 柱 */
    ks.forEach((k, i) => {
      const up = k.c >= k.o, col = up ? K_UP : K_DOWN;
      const x = cx(i).toFixed(1), bx = (cx(i) - bw / 2).toFixed(1), bws = bw.toFixed(1);
      s += '<line x1="' + x + '" y1="' + yP(k.h).toFixed(1) + '" x2="' + x + '" y2="' + yP(k.l).toFixed(1) +
        '" stroke="' + col + '" stroke-width="1.2"/>';
      const top = yP(Math.max(k.o, k.c)), bot = yP(Math.min(k.o, k.c));
      const bh = Math.max(1.3, bot - top);
      s += '<rect x="' + bx + '" y="' + top.toFixed(1) + '" width="' + bws + '" height="' + bh.toFixed(1) +
        '" rx="0.6" fill="' + (up ? '#FFFDF9' : col) + '" stroke="' + col + '" stroke-width="1.3"/>';
      if (bh <= 1.6) s += '<line x1="' + bx + '" y1="' + top.toFixed(1) + '" x2="' + (cx(i) + bw / 2).toFixed(1) +
        '" y2="' + top.toFixed(1) + '" stroke="' + col + '" stroke-width="1.6"/>';
      const vy = yV(k.v || 0);
      s += '<rect x="' + bx + '" y="' + vy.toFixed(1) + '" width="' + bws + '" height="' + Math.max(0.8, VB - vy).toFixed(1) +
        '" fill="' + col + '" opacity=".72"/>';
      const hv = ind.macd.hist[i], hy = yM(hv);
      s += '<rect x="' + (cx(i) - bw * 0.35).toFixed(1) + '" y="' + Math.min(hy, yM0).toFixed(1) +
        '" width="' + Math.max(1.6, bw * 0.7).toFixed(1) + '" height="' + Math.max(0.6, Math.abs(hy - yM0)).toFixed(1) +
        '" fill="' + (hv >= 0 ? K_UP : K_DOWN) + '" opacity=".85"/>';
    });

    /* 均线 / 均量线 / MACD 线 */
    const poly = (arr, yy, color, wd) => {
      const pts = arr.map((v, i) => v == null ? null : cx(i).toFixed(1) + ',' + yy(v).toFixed(1)).filter(Boolean).join(' ');
      if (pts) s += '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="' + wd +
        '" stroke-linejoin="round" opacity=".9"/>';
    };
    poly(ind.ma5, yP, K_MA5, 1.5); poly(ind.ma10, yP, K_MA10, 1.5); poly(ind.ma20, yP, K_MA20, 1.5);
    poly(ind.vma5, yV, K_MA5, 1.2); poly(ind.vma10, yV, K_MA10, 1.2);
    poly(ind.macd.dif, yM, K_MA5, 1.3); poly(ind.macd.dea, yM, K_MA10, 1.3);

    /* 最新价虚线 + 右侧价签 */
    const last = ks[ks.length - 1], ly = yP(last.c);
    const lc = last.c >= last.o ? K_UP : K_DOWN;
    s += '<line x1="' + padL + '" y1="' + ly.toFixed(1) + '" x2="' + X2 + '" y2="' + ly.toFixed(1) +
      '" stroke="' + lc + '" stroke-width="1" stroke-dasharray="4 3" opacity=".75"/>';
    s += '<rect x="' + (X2 + 2) + '" y="' + (ly - 8).toFixed(1) + '" width="' + (padR - 5) + '" height="16" rx="3" fill="' + lc + '"/>';
    s += '<text x="' + (X2 + (padR - 3) / 2) + '" y="' + (ly + 3.4).toFixed(1) +
      '" font-size="9.5" text-anchor="middle" fill="#fff" font-weight="800">' + p2(last.c) + '</text>';

    /* 区间最高 / 最低标注 */
    let hiI = 0, loI = 0;
    ks.forEach((k, i) => { if (k.h > ks[hiI].h) hiI = i; if (k.l < ks[loI].l) loI = i; });
    s += '<text x="' + cx(hiI).toFixed(1) + '" y="' + (yP(ks[hiI].h) - 4).toFixed(1) +
      '" font-size="8.5" text-anchor="middle" fill="#8A97A6" font-weight="800">' + p2(ks[hiI].h) + '</text>';
    s += '<text x="' + cx(loI).toFixed(1) + '" y="' + (yP(ks[loI].l) + 10).toFixed(1) +
      '" font-size="8.5" text-anchor="middle" fill="#8A97A6" font-weight="800">' + p2(ks[loI].l) + '</text>';

    /* 关键 K 线形态标记（小菱形，带原生 title 兜底） */
    const MARK = ['breakout-up', 'breakout-down', 'doji', 'hammer', 'shooting-star', 'panic-sell', 'news-up', 'news-down'];
    ks.forEach((k, i) => {
      if (!k.form || MARK.indexOf(k.form) < 0) return;
      const bear = /down|panic|shooting/.test(k.form);
      s += '<path d="M ' + cx(i).toFixed(1) + ' ' + (PT + 2) + ' l 3.2 3.2 l -3.2 3.2 l -3.2 -3.2 Z" fill="' +
        (bear ? K_DOWN : K_UP) + '" opacity=".9"><title>第 ' + (k.day || i + 1) + ' 日 · ' +
        esc(ME.FORM_NAME[k.form] || k.form) + '</title></path>';
    });

    /* 底部交易日刻度 */
    ks.forEach((k, i) => {
      if (i % every === 0 || i === ks.length - 1) {
        s += '<text x="' + cx(i).toFixed(1) + '" y="' + (H - 6) +
          '" font-size="9" text-anchor="middle" fill="#98A5B3" font-weight="700">D' + (k.day || i + 1) + '</text>';
      }
    });

    /* 十字光标骨架 + 透明命中层（放最上层才能捕获鼠标） */
    s += '<g class="kl-cross" style="display:none">' +
      '<line class="kl-cv" x1="0" y1="' + PT + '" x2="0" y2="' + MB + '" stroke="#7C8CA0" stroke-width="1" stroke-dasharray="3 3"/>' +
      '<line class="kl-ch" x1="' + padL + '" y1="0" x2="' + X2 + '" y2="0" stroke="#7C8CA0" stroke-width="1" stroke-dasharray="3 3"/>' +
      '</g>';
    s += '<rect class="kl-hit" x="' + padL + '" y="' + PT + '" width="' + plotW + '" height="' + (MB - PT) + '" fill="transparent"/>';
    s += '</svg>';

    _klCache = { ks: ks, W: W, H: H, padL: padL, plotW: plotW, step: step, PT: PT, MB: MB };
    return s;
  }

  /* 行内缩略图：上半蜡烛 + 下半量柱 */
  function miniChartSVG(ks0) {
    /* viewBox 用 300 宽，与列表实际宽度接近，避免蜡烛被横向拉成扁条 */
    const W = 300, H = 44, PT = 3, PH = 28, VT = 33, VH = 10;
    const ks = ks0.slice(-14);
    if (!ks.length) return '';
    let hi = -Infinity, lo = Infinity, maxV = 0;
    ks.forEach(k => { hi = Math.max(hi, k.h); lo = Math.min(lo, k.l); maxV = Math.max(maxV, k.v || 0); });
    const span = (hi - lo) || 1, yP = v => PT + (hi - v) / span * PH;
    const step = W / ks.length, bw = Math.max(3, Math.min(9, step * 0.55));
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="kline mini" preserveAspectRatio="none" role="img" aria-label="缩略 K 线">';
    ks.forEach((k, i) => {
      const x = step * (i + 0.5), up = k.c >= k.o, col = up ? K_UP : K_DOWN;
      s += '<line x1="' + x.toFixed(1) + '" y1="' + yP(k.h).toFixed(1) + '" x2="' + x.toFixed(1) +
        '" y2="' + yP(k.l).toFixed(1) + '" stroke="' + col + '" stroke-width="0.9"/>';
      const top = yP(Math.max(k.o, k.c)), bot = yP(Math.min(k.o, k.c));
      s += '<rect x="' + (x - bw / 2).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + bw.toFixed(1) +
        '" height="' + Math.max(1, bot - top).toFixed(1) + '" fill="' + (up ? '#FFFDF9' : col) +
        '" stroke="' + col + '" stroke-width="0.9"/>';
      const vh = maxV ? (k.v || 0) / maxV * VH : 0;
      s += '<rect x="' + (x - bw / 2).toFixed(1) + '" y="' + (VT + VH - vh).toFixed(1) + '" width="' + bw.toFixed(1) +
        '" height="' + vh.toFixed(1) + '" fill="' + col + '" opacity=".65"/>';
    });
    return s + '</svg>';
  }

  /* 兼容旧 API（旧的细折线走势图，面板已不用） */
  function sparkline(history, color) {
    const w = 120, h = 34;
    if (!history || history.length < 2) return '';
    const min = Math.min.apply(null, history), max = Math.max.apply(null, history);
    const span = max - min || 1;
    const pts = history.map((v, i) =>
      (i / (history.length - 1) * w).toFixed(1) + ',' + (h - 3 - (v - min) / span * (h - 6)).toFixed(1)).join(' ');
    const up = history[history.length - 1] >= history[0];
    const c = color || (up ? K_UP : K_DOWN);
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="spark"><polyline points="' + pts +
      '" fill="none" stroke="' + c + '" stroke-width="2" stroke-linejoin="round"/></svg>';
  }

  /* ---------- 十字光标 ---------- */
  function tipHTML(ks, i) {
    const k = ks[i], prev = ks[i - 1] || k;
    const chg = prev.c ? (k.c - prev.c) / prev.c * 100 : 0;
    const amp = prev.c ? (k.h - k.l) / prev.c * 100 : 0;
    const vr = ME.volumeRatio(ks, i);
    const cls = v => v >= 0 ? 'up' : 'down';
    return '<div class="kt-head">第 ' + (k.day || i + 1) + ' 个营业日' +
      (k.phase ? ' · ' + esc(PHASE_NAME[k.phase] || k.phase) : '') + '</div>' +
      '<div class="kt-grid">' +
        '<span>开</span><b class="' + cls(k.o - prev.c) + '">' + p2(k.o) + '</b>' +
        '<span>高</span><b class="up">' + p2(k.h) + '</b>' +
        '<span>低</span><b class="down">' + p2(k.l) + '</b>' +
        '<span>收</span><b class="' + cls(k.c - prev.c) + '">' + p2(k.c) + '</b>' +
      '</div>' +
      '<div class="kt-row">涨跌 <b class="' + cls(chg) + '">' + f2(chg) + '%</b> · 振幅 <b>' + amp.toFixed(2) + '%</b></div>' +
      '<div class="kt-row">成交量 <b>' + num(k.v) + '</b> 手 · 量比 <b>' + vr.toFixed(2) + '</b></div>' +
      (k.form && ME.FORM_NAME[k.form] ? '<div class="kt-form">形态：' + esc(ME.FORM_NAME[k.form]) + '</div>' : '');
  }

  function hideCrosshair() {
    document.querySelectorAll('.kl-cross').forEach(g => { g.style.display = 'none'; });
    document.querySelectorAll('.kl-tip').forEach(t => { t.style.display = 'none'; });
  }

  function bindCrosshair() {
    if (_klBound) return;
    _klBound = true;
    document.addEventListener('mousemove', e => {
      const box = e.target && e.target.closest ? e.target.closest('.kl-chart-box') : null;
      if (!box || !_klCache) { hideCrosshair(); return; }
      const svg = box.querySelector('svg.kl-main');
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      if (!r.width) return;
      const c = _klCache;
      const vx = (e.clientX - r.left) / r.width * c.W;
      const vy = (e.clientY - r.top) / r.height * c.H;
      if (vx < c.padL || vx > c.padL + c.plotW || vy < c.PT || vy > c.MB) { hideCrosshair(); return; }
      const i = Math.max(0, Math.min(c.ks.length - 1, Math.floor((vx - c.padL) / c.step)));
      const x = c.padL + c.step * (i + 0.5);
      document.querySelectorAll('.kl-chart-box').forEach(b => { if (b !== box) b.querySelectorAll('.kl-cross,.kl-tip').forEach(el => { el.style.display = 'none'; }); });
      const cross = box.querySelector('.kl-cross'), tip = box.querySelector('.kl-tip');
      if (cross) {
        cross.style.display = '';
        cross.querySelector('.kl-cv').setAttribute('x1', x.toFixed(1));
        cross.querySelector('.kl-cv').setAttribute('x2', x.toFixed(1));
        cross.querySelector('.kl-ch').setAttribute('y1', vy.toFixed(1));
        cross.querySelector('.kl-ch').setAttribute('y2', vy.toFixed(1));
      }
      if (tip) {
        tip.innerHTML = tipHTML(c.ks, i);
        tip.style.display = 'block';
        /* 浮窗放在光标反侧，避免压住正在查看的那根蜡烛 */
        const br = box.getBoundingClientRect();
        const relX = e.clientX - br.left;
        const left = relX > br.width / 2
          ? Math.max(4, relX - 224)
          : Math.min(Math.max(4, br.width - 210), relX + 14);
        tip.style.left = left + 'px';
        tip.style.top = '6px';
      }
    });
    document.addEventListener('mouseout', e => { if (!e.relatedTarget) hideCrosshair(); });
  }

  /* ======================================================================
     证券交易所面板
     ====================================================================== */
  let chartStock = null, chartPeriod = 'day';

  async function stockPanel(p) {
    const G = E().G;
    const closed = !CAL().isMarketOpen();
    const rows = C.STOCKS.map(s => {
      const m = G.market[s.id];
      ensureCandles(m, s.id);
      const h = p.stocks[s.id] || { shares: 0, cost: 0 };
      const prev = m.history.length > 1 ? m.history[m.history.length - 2] : m.price;
      const chg = prev ? (m.price - prev) / prev * 100 : 0;
      return { s: s, m: m, h: h, chg: chg };
    });
    const sel = rows.filter(r => r.s.id === chartStock)[0] || rows[0];
    chartStock = sel.s.id;

    const raw = sel.m.candles;
    const shown = (chartPeriod === 'week' ? ME.aggregateWeeks(raw) : raw).slice(-ME.SHOW_K);
    const last = shown[shown.length - 1] ||
      { o: sel.m.price, h: sel.m.price, l: sel.m.price, c: sel.m.price, v: 0, day: G.round };
    const prev = shown[shown.length - 2] || last;
    const chgAmt = last.c - prev.c;
    const chgPct = prev.c ? chgAmt / prev.c * 100 : 0;
    const vr = ME.volumeRatio(shown, shown.length - 1);
    const amp = prev.c ? (last.h - last.l) / prev.c * 100 : 0;
    const floatShares = (sel.m.st && sel.m.st.floatShares) || 100000;
    const turnover = last.v / floatShares * 100;
    const sig = ME.signal(raw.slice(-ME.SHOW_K));
    const dirCls = v => v >= 0 ? 'up' : 'down';

    const quoteItem = (label, val, cls) =>
      '<div class="kq-item"><span>' + label + '</span><b class="' + (cls || '') + '">' + val + '</b></div>';

    const chartHTML =
      '<div class="kline-wrap">' +
        '<div class="kl-head">' +
          '<span class="kl-name">' + sel.s.icon + ' <b>' + esc(sel.s.name) + '</b>' +
            '<span class="kl-code">' + sel.s.id.toUpperCase() + '</span></span>' +
          '<span class="kl-price ' + dirCls(chgAmt) + '">' + p2(sel.m.price) + '</span>' +
          '<span class="kl-chg ' + dirCls(chgAmt) + '">' + f2(chgAmt) + '  ' + f2(chgPct) + '%</span>' +
          '<span class="kl-tabs">' +
            '<button class="kl-tab' + (chartPeriod === 'day' ? ' on' : '') + '" data-value="period:day">日K</button>' +
            '<button class="kl-tab' + (chartPeriod === 'week' ? ' on' : '') + '" data-value="period:week">周K</button>' +
          '</span>' +
        '</div>' +
        '<div class="kl-quote">' +
          quoteItem('今开', p2(last.o), dirCls(last.o - prev.c)) +
          quoteItem('昨收', p2(prev.c)) +
          quoteItem('最高', p2(last.h), 'up') +
          quoteItem('最低', p2(last.l), 'down') +
          quoteItem('成交量', num(last.v) + ' 手') +
          quoteItem('量比', vr.toFixed(2), vr >= 1.8 ? 'up' : (vr < 0.7 ? 'down' : '')) +
          quoteItem('换手', turnover.toFixed(2) + '%') +
          quoteItem('振幅', amp.toFixed(2) + '%') +
        '</div>' +
        '<div class="kl-chart-box">' + marketChartSVG(shown, { width: 680, height: 372 }) +
          '<div class="kl-tip"></div></div>' +
        '<div class="kl-legend">' +
          '<span class="lg-up">▯ 阳线(红框空心)</span><span class="lg-down">■ 阴线(绿实心)</span>' +
          '<span class="lg-ma5">— MA5</span><span class="lg-ma10">— MA10</span><span class="lg-ma20">— MA20</span>' +
          '<span>— VOL / VMA</span><span>— MACD</span>' +
          '<span class="kl-cursor-tip">移入图表查看逐日四价 ⇗</span>' +
        '</div>' +
        '<div class="kl-signal ' + sig.tone + '">' +
          '<span class="ks-icon">' + (sig.tone === 'bull' ? '📈' : sig.tone === 'bear' ? '📉' : '⚖️') + '</span>' +
          '<div class="ks-body"><b>' + esc(sig.title) + '</b>' +
            (sig.form ? '<span class="ks-form">' + esc(sig.form) + '</span>' : '') +
            '<p>' + esc(sig.detail) + '</p></div>' +
        '</div>' +
        '<div class="kl-teach">🎓 <b>量价四句口诀：</b>' +
          '① 价涨量增＝趋势健康；② 价涨量缩＝量价背离，警惕见顶；' +
          '③ 价跌量缩＝正常洗盘；④ 价跌量增＝恐慌抛售，别急着抄底。' +
          '当前量比 <b>' + vr.toFixed(2) + '</b>（本根量 ÷ 前 5 根均量，>1.8 为放量）。' +
          '图中 <b>VOL</b> 是成交量，<b>MACD</b> 看涨跌动能；' +
          '鼠标移到任意一根 K 线可查当日开高低收、量能与形态。' +
          (chartPeriod === 'week' ? ' 周K 由每 5 个营业日合并而成。' : '') +
        '</div>' +
      '</div>';

    const html =
      (closed ? '<div class="market-closed">🔒 ' + esc(CAL().label()) + ' · 假日休市，今日不可交易（可查看行情）</div>' : '') +
      chartHTML +
      '<div class="stock-list">' + rows.map(r =>
      '<div class="stock-row' + (r.s.id === chartStock ? ' selected' : '') +
        '" data-stock="' + r.s.id + '" data-value="sel:' + r.s.id + '">' +
        '<div class="sr-head"><span class="sr-icon">' + r.s.icon + '</span>' +
          '<b>' + esc(r.s.name) + '</b>' +
          '<span class="sr-price">' + p2(r.m.price) + '</span>' +
          '<span class="sr-chg ' + (r.chg >= 0 ? 'up' : 'down') + '">' +
            (r.chg >= 0 ? '▲' : '▼') + Math.abs(r.chg).toFixed(2) + '%</span></div>' +
        '<div class="sr-mini">' + miniChartSVG(r.m.candles) + '</div>' +
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
      '</div>').join('') + '</div>' +
      '<div class="kl-switch-tip">💡 点任意股票行切换主图 · 点日K / 周K 切换周期</div>';

    bindCrosshair();
    await U.modal({
      icon: '📈', title: '小镇证券交易所 · ' + CAL().label(),
      desc: closed ? '今天休市，只能看盘不能下单。' :
        '低买高卖赚差价；每月底按持仓市值分红（' + (BAL.stockDividend * 100) + '%）。周末 / 假日休市。',
      html, keepOpen: true, wide: true,
      onCardSelect: async val => {
        if (val === 'close') { U.closeModal('close'); return; }
        if (val.indexOf('period:') === 0) { chartPeriod = val.slice(7); stockPanel(p); return; }
        if (val.indexOf('sel:') === 0) { chartStock = val.slice(4); stockPanel(p); return; }
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
    const cost = Math.round(m.price * n);
    if (p.cash < cost) return;
    const h = p.stocks[id] = p.stocks[id] || { shares: 0, cost: 0 };
    h.cost = h.cost + cost;
    h.shares += n;
    p.cash -= cost;
    global.SFX.play('buy');
    U.log('📈 <b>' + esc(p.name) + '</b> 买入 ' + stockName(id) + ' × ' + n + ' 股 <span class="n down">−' + fmt(cost) + '</span>（成本均价 ' + p2(h.cost / h.shares) + '）', 'info');
  }

  function sellStock(p, id, mode) {
    if (!CAL().isMarketOpen()) return;
    const G = E().G;
    const m = G.market[id];
    const h = p.stocks[id];
    if (!h || h.shares <= 0) return;
    const n = mode === 'all' ? h.shares : Math.floor(h.shares / 2);
    if (n <= 0) return;
    const back = Math.round(m.price * n);
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
    marketTick, sparkline, marketChartSVG, miniChartSVG, pushQuote, ensureCandles,
    stockPanel, buyStock, sellStock,
    onLottery, lotteryDraw,
  };
})(window);
