/* ==========================================================================
   现金流小富翁 v2 · 财务报表层
   收支表（Income Statement）· 资产负债表（Balance Sheet）
   —— 大富翁化之后仍然保留的教育内核：让孩子看懂「租金＝被动收入」
   ========================================================================== */
(function (global) {
  'use strict';

  const fmt = n => Math.round(n).toLocaleString('zh-CN');
  const sign = n => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  let tab = 'cashflow';
  let viewIdx = 0;      // 查看哪位玩家

  function setTab(t) { tab = t; }
  function setView(i) { viewIdx = i; }

  /* ----------------------------------------------------------------------
     收支表：本圈（本轮）现金流
     口径：一圈 ≈ 一个月。租金 = 被动收入；津贴 = 主动收入。
     ---------------------------------------------------------------------- */
  function cashflowRows(p) {
    const G = global.Engine.G;
    const B = global.CFWorld.BALANCE;

    /* 被动收入：地产租金（按当前等级估算单次过路费）+ 特殊建筑 */
    const rentRows = [];
    let passive = 0;
    p.estateIds.forEach(i => {
      const c = G.map[i];
      if (!c) return;
      if (c.type === 'estate') {
        const r = global.Estate.rentOf(c);
        passive += r;
        rentRows.push({ label: c.icon + ' ' + c.name + '（L' + c.level + '）', value: sign(r), cls: 'up' });
      } else if (c.type === 'special' && c.building === 'resort') {
        passive += 3000;
        rentRows.push({ label: '🏝️ 度假饭店住宿费', value: sign(3000), cls: 'up' });
      }
    });

    /* 股票分红 */
    let dividend = 0;
    Object.keys(p.stocks).forEach(id => {
      const h = p.stocks[id];
      if (h.shares > 0 && G.market[id]) dividend += h.shares * G.market[id].price * B.stockDividend;
    });
    dividend = Math.round(dividend);

    const depositInt = Math.round(p.deposit * B.depositRate);
    const totalIncome = p.char.salary + passive + dividend + depositInt;

    /* 支出 */
    const loanInt = Math.round(p.loan * B.loanRate);
    const living = B.livingCost;
    const totalExpense = living + loanInt;

    const ncf = totalIncome - totalExpense;

    const rows = [];
    rows.push({ kind: 'heading', label: '收入（每月）' });
    rows.push({ label: '💼 津贴收入（主动收入）', value: sign(p.char.salary), cls: 'up' });
    if (!rentRows.length) {
      rows.push({ label: '（暂无地产，去棋盘上买一块吧）', value: '—', cls: 'muted' });
    } else {
      rentRows.forEach(r => rows.push(r));
    }
    rows.push({ kind: 'subtotal', label: '📈 被动收入合计（租金）', value: sign(passive), cls: 'up' });
    if (dividend > 0) rows.push({ label: '🎫 股票分红（市值 × 0.5%）', value: sign(dividend), cls: 'up' });
    if (depositInt > 0) rows.push({ label: '🏦 存款利息', value: sign(depositInt), cls: 'up' });
    rows.push({ kind: 'subtotal', label: '收入合计', value: sign(totalIncome), cls: 'up' });

    rows.push({ kind: 'heading', label: '支出（每月）' });
    rows.push({ label: '🍚 生活开销', value: '−' + fmt(living), cls: 'down' });
    if (loanInt > 0) {
      rows.push({ label: '🏦 贷款利息（' + (B.loanRate * 100).toFixed(0) + '% / 月）', value: '−' + fmt(loanInt), cls: 'down' });
    } else {
      rows.push({ label: '（无贷款，不用付利息 👍）', value: '0', cls: 'muted' });
    }
    rows.push({ kind: 'subtotal', label: '支出合计', value: '−' + fmt(totalExpense), cls: 'down' });

    rows.push({ kind: 'total', label: '💰 每月净现金流', value: sign(ncf), cls: ncf >= 0 ? 'up' : 'down' });

    const pct = passive > 0 ? Math.round(passive / living * 100) : 0;
    rows.push({ kind: 'subtotal', label: '🎯 财务自由：被动收入 ÷ 生活开销', value: pct + '%',
      cls: passive >= living ? 'up' : 'muted' });
    rows.push({ kind: 'note', label: '　租金是「睡着了也在赚」的钱。达到 100% 表示：就算不掷骰子，你也活得下去。' });

    return { rows, ncf, passive, totalIncome, totalExpense };
  }

  /* ----------------------------------------------------------------------
     资产负债表
     ---------------------------------------------------------------------- */
  function balanceRows(p) {
    const G = global.Engine.G;
    const rows = [];
    let assetSum = p.cash + p.deposit;

    rows.push({ kind: 'heading', label: '资产' });
    rows.push({ label: '💵 现金', value: fmt(p.cash) });
    if (p.deposit) rows.push({ label: '🏦 银行存款', value: fmt(p.deposit) });

    let estateValue = 0;
    p.estateIds.forEach(i => {
      const c = G.map[i];
      if (!c) return;
      if (c.type === 'estate') {
        const v = Math.round(c.price + c.level * c.buildCost * 0.8);
        estateValue += v;
        rows.push({ label: c.icon + ' ' + c.name + '（L' + c.level + '）' + (c.mortgaged ? ' 🔒' : ''), value: fmt(v) });
      } else if (c.type === 'special' && c.building) {
        const b = global.CFWorld.SPECIAL_BUILDINGS[c.building];
        const v = Math.round(b.cost * 0.8);
        estateValue += v;
        rows.push({ label: b.icon + ' ' + b.name, value: fmt(v) });
      }
    });
    assetSum += estateValue;

    let stockVal = 0;
    Object.keys(p.stocks).forEach(id => {
      const h = p.stocks[id];
      if (h.shares > 0 && G.market[id]) {
        const v = Math.round(h.shares * G.market[id].price);
        stockVal += v;
        const s = global.CFContent.STOCKS.find(x => x.id === id);
        rows.push({ label: s.icon + ' ' + s.name + '（' + h.shares + ' 股）', value: fmt(v) });
      }
    });
    assetSum += stockVal;

    rows.push({ kind: 'subtotal', label: '资产合计', value: fmt(assetSum), cls: 'up' });

    rows.push({ kind: 'heading', label: '负债' });
    if (p.loan > 0) {
      rows.push({ label: '🏦 银行贷款', value: '−' + fmt(p.loan), cls: 'down' });
    } else {
      rows.push({ label: '（无负债 👍）', value: '0', cls: 'muted' });
    }
    rows.push({ kind: 'subtotal', label: '负债合计', value: '−' + fmt(p.loan), cls: 'down' });
    rows.push({ kind: 'total', label: '🏛️ 净资产（总资产）', value: fmt(assetSum - p.loan),
      cls: assetSum - p.loan >= 0 ? 'up' : 'down' });

    rows.push({ kind: 'note', label: '　现金流是水管，净资产是水池。水管越粗，水池迟早会满——先让租金变多。' });

    return { rows, netWorth: assetSum - p.loan };
  }

  /* ----------------------------------------------------------------------
     全体对比表
     ---------------------------------------------------------------------- */
  function comparisonRows(players) {
    const head = '<thead><tr><th>玩家</th><th>现金</th><th>地产</th><th>股票</th><th>总资产</th></tr></thead>';
    const body = players.slice().sort((a, b) => b.netWorth - a.netWorth).map(p => {
      const bs = balanceRows(p);
      const cf = cashflowRows(p);
      return '<tr>' +
        '<td>' + esc(p.emoji + ' ' + p.name) + '</td>' +
        '<td>' + fmt(p.cash) + '</td>' +
        '<td>' + p.estateIds.length + ' 块</td>' +
        '<td>' + fmt(global.Engine.stockValue(p)) + '</td>' +
        '<td><b>' + fmt(bs.netWorth) + '</b></td>' +
      '</tr>';
    }).join('');
    return '<table class="rpt-table">' + head + '<tbody>' + body + '</tbody></table>';
  }

  function renderTable(rows) {
    return '<table class="rpt-table"><tbody>' + rows.map(r => {
      if (r.kind === 'heading') return '<tr class="heading"><td colspan="2">' + esc(r.label) + '</td></tr>';
      if (r.kind === 'note') return '<tr class="note-row"><td colspan="2">' + esc(r.label) + '</td></tr>';
      const cls = (r.kind === 'total' || r.kind === 'subtotal') ? 'total' : '';
      return '<tr class="' + cls + '"><td>' + esc(r.label) + '</td>' +
        '<td class="' + (r.cls || '') + '">' + esc(r.value) + '</td></tr>';
    }).join('') + '</tbody></table>';
  }

  /* ----------------------------------------------------------------------
     渲染（由 engine.render 调用）
     ---------------------------------------------------------------------- */
  function renderTab(G) {
    const body = document.getElementById('reportBody');
    const tabs = document.getElementById('reportTabs');
    if (!body || !G.players.length) return;

    if (tabs) {
      const btns = tabs.querySelectorAll('button[data-tab]');
      btns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    }

    if (viewIdx >= G.players.length) viewIdx = 0;
    const p = G.players[viewIdx];

    if (tab === 'compare') {
      body.innerHTML = comparisonRows(G.players);
      return;
    }
    const data = tab === 'cashflow' ? cashflowRows(p) : balanceRows(p);
    body.innerHTML =
      '<div class="rpt-who">' + p.emoji + ' ' + esc(p.name) + '　<span>' + esc(p.char.name) + '</span></div>' +
      renderTable(data.rows);
  }

  global.Report = {
    cashflowRows, balanceRows, comparisonRows, renderTable,
    renderTab, setTab, setView,
    getTab: () => tab, getView: () => viewIdx,
    fmt, sign, esc,
  };
})(window);
