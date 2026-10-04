/* ==========================================================================
   现金流小富翁 · 财务报表层
   把玩家状态渲染成两张真正的报表：
     1) 收支表（Income Statement）
     2) 资产负债表（Balance Sheet）
   —— 这是本游戏最重要的「教育输出」。
   ========================================================================== */
(function (global) {
  'use strict';

  const fmt  = n => Math.round(n).toLocaleString('zh-CN');
  const sign = n => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));

  /* ----------------------------------------------------------------------
     收支表
     设计要点（教育考量）：
     不动产等带按揭的资产，其「月供」直接归属于该资产，而不是另立一行。
     报表按「租金收入 − 月供 = 净收益」展示，让孩子一眼看懂
     「这套房到底每个月给我留下多少钱」。
     ---------------------------------------------------------------------- */
  function cashflowRows(p) {
    const interest = p.liabilities.reduce((s, l) => s + (l.balance * l.rate), 0);
    const totalIncome = p.salary + p.passive;
    const totalExpense = p.expenses + interest;
    const ncf = totalIncome - totalExpense;

    const rows = [];
    rows.push({ kind: 'heading', label: '收入' });

    // 工资
    rows.push({ label: '工资收入（主动收入）', value: sign(p.salary), cls: 'up' });

    // 资产：按类别分组，展示净收益
    if (!p.assets.length) {
      rows.push({ label: '（暂无资产，快去小机会 / 大机会格买一个）', value: '—', cls: 'muted' });
    } else {
      p.assets.forEach(a => {
        const tag = (a.tags || []).includes('realestate') ? '（租金）' : '';
        rows.push({
          label: a.icon + ' ' + a.name + tag,
          value: sign(a.income) + ' /月',
          cls: a.income >= 0 ? 'up' : 'down',
        });
      });
    }
    rows.push({ kind: 'subtotal', label: '被动收入合计', value: sign(p.passive), cls: 'up' });
    rows.push({ kind: 'subtotal', label: '收入合计', value: sign(totalIncome), cls: 'up' });

    rows.push({ kind: 'heading', label: '支出' });
    rows.push({ label: '生活支出（吃住行学费）', value: '−' + fmt(p.expenses), cls: 'down' });
    if (p.baseExpenses && p.expenses > p.baseExpenses + 1) {
      rows.push({
        label: '　└ 其中：物价上涨 / 通胀累积',
        value: '+' + fmt(p.expenses - p.baseExpenses) + ' /月',
        cls: 'down',
      });
    }
    p.liabilities.forEach(l => {
      const pay = l.balance * l.rate;
      rows.push({
        label: '' + l.name + '（月供利息 ' + (l.rate * 100).toFixed(1) + '%）',
        value: '−' + fmt(pay),
        cls: 'down',
      });
    });
    if (!p.liabilities.length) {
      rows.push({ label: '（无负债，不用付利息）', value: '0', cls: 'muted' });
    }
    rows.push({ kind: 'subtotal', label: '支出合计', value: '−' + fmt(totalExpense), cls: 'down' });

    rows.push({
      kind: 'total',
      label: '每月净现金流',
      value: sign(ncf),
      cls: ncf >= 0 ? 'up' : 'down',
    });
    rows.push({
      kind: 'subtotal',
      label: '财务自由线：被动收入 ÷ 生活支出',
      value: (p.expenses > 0 ? Math.round((p.passive / p.expenses) * 100) : 0) + '%',
      cls: p.passive >= p.expenses ? 'up' : 'muted',
    });
    rows.push({
      kind: 'note',
      label: '　达到 100% 就实现财务自由。注意：被动收入要「单独」盖住生活费，工资不算数。',
      value: '',
    });

    return { rows: rows, ncf: ncf, interest: interest, totalIncome: totalIncome, totalExpense: totalExpense };
  }

  /* ----------------------------------------------------------------------
     资产负债表
     ---------------------------------------------------------------------- */
  function balanceRows(p) {
    const totalAssets = p.cash + p.assets.reduce((s, a) => s + a.value, 0);
    const totalLiab = p.liabilities.reduce((s, l) => s + l.balance, 0);
    const netWorth = totalAssets - totalLiab;

    const rows = [];
    rows.push({ kind: 'heading', label: '资产' });
    rows.push({ label: '现金', value: fmt(p.cash), cls: '' });
    p.assets.forEach(a => {
      rows.push({ label: a.icon + ' ' + a.name, value: fmt(a.value), cls: '' });
    });
    if (!p.assets.length) rows.push({ label: '（暂无资产）', value: '—', cls: 'muted' });
    rows.push({ kind: 'subtotal', label: '资产合计', value: fmt(totalAssets), cls: '' });

    rows.push({ kind: 'heading', label: '负债' });
    p.liabilities.forEach(l => {
      rows.push({ label: l.icon + ' ' + l.name, value: '−' + fmt(l.balance), cls: 'down' });
    });
    if (!p.liabilities.length) rows.push({ label: '（无负债，很棒）', value: '0', cls: 'muted' });
    rows.push({ kind: 'subtotal', label: '负债合计', value: '−' + fmt(totalLiab), cls: 'down' });

    rows.push({
      kind: 'total',
      label: '净资产',
      value: fmt(netWorth),
      cls: netWorth >= 0 ? '' : 'down',
    });

    return { rows: rows, totalAssets: totalAssets, totalLiab: totalLiab, netWorth: netWorth };
  }

  /* ----------------------------------------------------------------------
     渲染成 HTML 表格
     ---------------------------------------------------------------------- */
  function renderTable(rows, opts) {
    opts = opts || {};
    const rowsHtml = rows.map(r => {
      if (r.kind === 'heading') {
        return '<tr class="heading"><td colspan="2">' + esc(r.label) + '</td></tr>';
      }
      // note 行：一整行的小字说明，不做数值对齐
      if (r.kind === 'note') {
        return '<tr class="note-row"><td colspan="2">' + esc(r.label) + '</td></tr>';
      }
      const cls = r.kind === 'total' ? 'total' : (r.kind === 'subtotal' ? 'total' : '');
      const you = (opts.highlight && r.label === opts.highlight) ? ' you' : '';
      return '<tr class="' + cls + you + '">' +
        '<td>' + esc(r.label) + '</td>' +
        '<td class="v ' + (r.cls || '') + '">' + esc(r.value) + '</td>' +
      '</tr>';
    }).join('');
    return '<table class="rpt-table"><tbody>' + rowsHtml + '</tbody></table>';
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /* ----------------------------------------------------------------------
     全部玩家横向对比表
     ---------------------------------------------------------------------- */
  function comparisonRows(players) {
    const head = '<thead><tr><th>玩家</th><th>现金</th><th>月工资</th><th>被动收入</th>' +
                 '<th>月支出</th><th>净现金流</th><th>净资产</th></tr></thead>';
    const body = players.map(p => {
      const cf = cashflowRows(p);
      const bs = balanceRows(p);
      return '<tr>' +
        '<td>' + esc(p.name) + '</td>' +
        '<td class="v">' + fmt(p.cash) + '</td>' +
        '<td class="v">' + fmt(p.salary) + '</td>' +
        '<td class="v up">' + fmt(p.passive) + '</td>' +
        '<td class="v down">' + fmt(cf.totalExpense) + '</td>' +
        '<td class="v ' + (cf.ncf >= 0 ? 'up' : 'down') + '">' + sign(cf.ncf) + '</td>' +
        '<td class="v">' + fmt(bs.netWorth) + '</td>' +
      '</tr>';
    }).join('');
    return '<table class="rpt-table">' + head + '<tbody>' + body + '</tbody></table>';
  }

  /* ----------------------------------------------------------------------
     财务自由进度（百分比）
     口径说明：分母是「生活费」，与胜利条件保持一致（负债权重已通过
     更高的生活费自动体现，避免同一份报表里出现两套不同的自由线）。
     ---------------------------------------------------------------------- */
  function freedomProgress(p) {
    if (p.expenses <= 0) return p.passive > 0 ? 100 : 0;
    return Math.min(100, (p.passive / p.expenses) * 100);
  }

  global.Report = {
    fmt, sign,
    cashflowRows, balanceRows,
    renderTable, comparisonRows,
    freedomProgress,
    esc,
  };

})(window);
