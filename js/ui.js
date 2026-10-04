/* ==========================================================================
   现金流小富翁 · UI 层
   负责：弹窗系统、棋盘渲染、玩家卡片、日志、提示条、引导
   ========================================================================== */
(function (global) {
  'use strict';

  const fmt = n => Math.round(n).toLocaleString('zh-CN');
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ======================================================================
     1. 弹窗系统
     ====================================================================== */

  const overlay   = () => document.getElementById('modalOverlay');
  const modalBox  = () => document.getElementById('modalBox');
  const modalIcon = () => document.getElementById('modalIcon');
  const modalTitle= () => document.getElementById('modalTitle');
  const modalDesc = () => document.getElementById('modalDesc');
  const modalExtra= () => document.getElementById('modalExtra');
  const modalRows = () => document.getElementById('modalRows');
  const modalTeach= () => document.getElementById('modalTeach');
  const modalTeachText = () => document.getElementById('modalTeachText');
  const modalActions = () => document.getElementById('modalActions');
  const modalTimer = () => document.getElementById('modalTimer');
  const modalTimerBar = () => document.getElementById('modalTimerBar');

  let modalResolve = null;
  let modalTimerId = null;
  let modalCountdownId = null;

  function clearModalTimers() {
    if (modalTimerId) { clearTimeout(modalTimerId); modalTimerId = null; }
    if (modalCountdownId) { clearInterval(modalCountdownId); modalCountdownId = null; }
  }

  function closeModal(value) {
    if (!modalResolve) return;
    clearModalTimers();
    const r = modalResolve;
    modalResolve = null;
    overlay().classList.remove('show');
    setTimeout(() => r(value), 60);
  }

  /**
   * 显示弹窗
   * @param {object} o
   *   icon, title, desc,
   *   rows: [{label,value,cls,emphasis}]
   *   options: [{label,value,primary,disabled,cls}]
   *   cards:  自定义 HTML 内容（覆盖 rows）
   *   teach:  财商知识点（字符串）
   *   auto:   自动关闭毫秒数
   *   wide:   宽版
   *   columns: 按钮列排布
   */
  function modal(o) {
    o = o || {};
    return new Promise(resolve => {
      // 若已有弹窗未关闭，先收尾
      if (modalResolve) { const prev = modalResolve; modalResolve = null; prev(null); }
      clearModalTimers();
      modalResolve = resolve;

      modalIcon().textContent  = o.icon || '💡';
      modalTitle().textContent = o.title || '';
      modalTitle().style.display = o.title ? '' : 'none';
      modalDesc().textContent  = o.desc || '';
      modalDesc().style.display = o.desc ? '' : 'none';
      modalDesc().className = 'modal-desc' + (o.lead ? ' lead' : '');

      // 附加内容
      modalExtra().innerHTML = '';
      if (o.html) {
        modalExtra().innerHTML = o.html;
      } else if (o.cards && o.cards.length) {
        const wrap = document.createElement('div');
        wrap.className = 'choice-cards';
        o.cards.forEach(c => {
          const btn = document.createElement('button');
          btn.className = 'choice-card' + (c.bad ? ' bad' : '');
          btn.disabled = !!c.disabled;
          btn.innerHTML =
            '<span class="cc-icon">' + (c.icon || '') + '</span>' +
            '<span class="cc-body">' +
              '<span class="cc-name">' + (c.name || '') + '</span>' +
              '<span class="cc-desc">' + (c.desc || '') + '</span>' +
            '</span>' +
            '<span class="cc-right">' +
              (c.cost != null ? '<div class="cc-cost">' + c.cost + '</div>' : '') +
              (c.income != null ? '<div class="' + (c.incomeBad ? 'cc-bad' : 'cc-inc') + '">' + c.income + '</div>' : '') +
              (c.note ? '<div class="cc-bad">' + c.note + '</div>' : '') +
            '</span>';
          if (!c.disabled) {
            btn.onclick = () => closeModal(c.value != null ? c.value : (c.id || c.name));
          }
          wrap.appendChild(btn);
        });
        modalExtra().appendChild(wrap);
      }

      // 行
      const rowsEl = modalRows();
      const rows = o.rows || [];
      if (rows.length && !o.html) {
        rowsEl.innerHTML = rows.map(r =>
          '<div class="modal-row' + (r.emphasis ? ' emphasis' : '') + '">' +
            '<span class="lbl">' + (r.label || '') + '</span>' +
            '<span class="val ' + (r.cls || '') + '">' + (r.value == null ? '' : r.value) + '</span>' +
          '</div>'
        ).join('');
        rowsEl.style.display = '';
      } else {
        rowsEl.innerHTML = '';
        rowsEl.style.display = 'none';
      }

      // 财商小课堂
      if (o.teach) {
        modalTeachText().innerHTML = o.teach;
        modalTeach().classList.remove('hidden');
      } else {
        modalTeach().classList.add('hidden');
      }

      // 按钮
      const actionsEl = modalActions();
      actionsEl.innerHTML = '';
      actionsEl.className = 'modal-actions' + (o.columns ? ' col' : '');

      const opts = o.options && o.options.length
        ? o.options
        : [{ label: o.okLabel || '继续', value: 'ok', primary: true }];

      opts.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'btn ' + (opt.primary ? 'btn-primary' : 'btn-soft');
        b.textContent = opt.label;
        b.disabled = !!opt.disabled;
        if (!opt.disabled) {
          b.onclick = () => closeModal(opt.value != null ? opt.value : 'ok');
        }
        actionsEl.appendChild(b);
      });

      // 自动关闭
      if (o.auto) {
        modalTimer().classList.remove('hidden');
        const bar = modalTimerBar();
        bar.style.transition = 'none';
        bar.style.width = '100%';
        requestAnimationFrame(() => {
          bar.style.transition = 'width ' + o.auto + 'ms linear';
          bar.style.width = '0%';
        });
        modalTimerId = setTimeout(() => closeModal(o.autoValue != null ? o.autoValue : 'ok'), o.auto);
      } else {
        modalTimer().classList.add('hidden');
      }

      modalBox().className = 'modal' + (o.wide ? ' wide' : '');
      overlay().classList.add('show');

      // 聚焦主按钮，方便键盘操作
      setTimeout(() => {
        const first = actionsEl.querySelector('.btn-primary:not(:disabled)') ||
                      actionsEl.querySelector('.btn:not(:disabled)');
        if (first) first.focus();
      }, 120);
    });
  }

  /* ======================================================================
     2. 棋盘渲染
     38 格环形棋盘，坐标由 data.js 的 ringCoord() 统一生成
     （14 × 7 网格的外圈，顺时针，首尾相接）。
     ====================================================================== */

  function buildBoard(cells, onClick) {
    const board = document.getElementById('board');
    board.innerHTML = '';
    cells.forEach(cell => {
      const el = document.createElement('div');
      el.className = 'cell';
      el.dataset.type = cell.type;
      el.dataset.index = cell.index;
      el.style.gridColumn = cell.col;
      el.style.gridRow = cell.row;

      el.innerHTML =
        '<div class="cell-inner">' +
          '<div class="cell-icon">' + cell.icon + '</div>' +
          '<div class="cell-name">' + cell.name + '</div>' +
          '<div class="cell-price" data-price="' + cell.index + '"></div>' +
        '</div>' +
        '<div class="tokens" data-tokens="' + cell.index + '"></div>';

      if (onClick) el.addEventListener('click', () => onClick(cell.index));
      board.appendChild(el);
    });
  }

  function renderTokens(players, exclude) {
    document.querySelectorAll('.tokens').forEach(t => (t.innerHTML = ''));
    players.forEach((p, i) => {
      if (exclude != null && exclude.indexOf(i) >= 0) return;
      const holder = document.querySelector('.tokens[data-tokens="' + p.pos + '"]');
      if (!holder) return;
      const sp = document.createElement('span');
      sp.className = 'token';
      sp.textContent = p.emoji;
      sp.title = p.name;
      sp.style.filter = 'drop-shadow(0 1.5px 1px rgba(0,0,0,.35)) drop-shadow(0 0 4px ' + p.color + ')';
      holder.appendChild(sp);
    });
  }

  function highlightCell(i) {
    document.querySelectorAll('.cell.highlight').forEach(el => el.classList.remove('highlight'));
    const el = document.querySelector('.cell[data-index="' + i + '"]');
    if (el) el.classList.add('highlight');
    return el;
  }

  function clearHighlight() {
    document.querySelectorAll('.cell.highlight').forEach(el => el.classList.remove('highlight'));
  }

  function updateCellPrice(idx, text) {
    const el = document.querySelector('.cell-price[data-price="' + idx + '"]');
    if (el) el.textContent = text || '';
  }

  /* 浮层文字（金额飘字） */
  function floatText(anchorEl, text, color) {
    if (!anchorEl) return;
    const stage = document.querySelector('.board-stage');
    if (!stage) return;
    const a = anchorEl.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.color = color || '#1b2437';
    el.style.left = (a.left - s.left + a.width / 2) + 'px';
    el.style.top  = (a.top  - s.top  + a.height * 0.3) + 'px';
    stage.appendChild(el);
    setTimeout(() => el.remove(), 1050);
  }

  /* ======================================================================
     3. 玩家卡片
     ====================================================================== */

  function renderPlayers(players, state, handlers) {
    const deck = document.getElementById('playersDeck');
    const showActions = state.showActions;

    deck.innerHTML = players.map((p, i) => {
      const active = i === state.cur && !state.over;
      const prog = v => Math.min(100, (p.passive / Math.max(1, p.expenses)) * 100);
      const pct = prog();
      const interest = p.liabilities.reduce((s, l) => s + l.balance * l.rate, 0);
      const ncf = p.salary + p.passive - p.expenses - interest;
      const done = state.doneSet && state.doneSet.indexOf(i) >= 0;

      const assetChips = p.assets.slice(0, 4).map(a =>
        '<span class="chip">' + a.icon + ' +' + fmt(a.income) + '</span>').join('');
      const moreChip = p.assets.length > 4
        ? '<span class="chip more">+' + (p.assets.length - 4) + ' 项</span>' : '';
      const liabChips = p.liabilities.map(l =>
        '<span class="chip liab">' + l.icon + ' −' + fmt(l.balance) + '</span>').join('');

      const statusTags = [];
      if (p.insured) statusTags.push('<span class="tag">☂️ 已投保</span>');
      if (p.charityStreak > 0) statusTags.push('<span class="tag">💝 善缘 ' + p.charityStreak + '</span>');
      if (p.bankrupt) statusTags.push('<span class="tag danger">💔 已破产</span>');

      return '' +
      '<div class="pcard' + (active ? ' active' : '') + (done ? ' turn-done' : '') + '" style="--pc:' + p.color + '">' +
        '<div class="pc-head">' +
          '<div class="pc-avatar">' + p.emoji + '</div>' +
          '<div class="pc-id">' +
            '<div class="pc-name">' + esc(p.name) + '</div>' +
            '<div class="pc-meta">' +
              '<span class="tag ' + (p.isAI ? 'ai' : 'human') + '">' + (p.isAI ? '🤖 ' + p.persona.name : '👤 真人') + '</span>' +
              '<span class="tag">' + p.careerIcon + ' ' + p.careerName + '</span>' +
            '</div>' +
          '</div>' +
          (p.badges.length ? '<span class="tag crown">🏅 ' + p.badges.length + '</span>' : '') +
        '</div>' +

        '<div class="pc-freedom">' +
          '<div class="pc-freedom-top">' +
            '<span>财务自由进度</span>' +
            '<span class="pct">' + pct.toFixed(0) + '%</span>' +
          '</div>' +
          '<div class="bar"><div class="bar-fill' + (pct >= 100 ? ' done' : '') + '" style="width:' + pct + '%"></div></div>' +
          '<div class="pc-freedom-top" style="margin-top:4px;margin-bottom:0">' +
            '<span>被动收入 ' + fmt(p.passive) + '</span>' +
            '<span>生活费 ' + fmt(p.expenses) + '</span>' +
          '</div>' +
        '</div>' +

        '<div class="pc-kpis">' +
          '<div class="kpi"><div class="k">现金</div><div class="v ' + (p.cash < 0 ? 'down' : 'plain') + '">' + fmt(p.cash) + '</div></div>' +
          '<div class="kpi"><div class="k">总资产</div><div class="v plain">' + fmt(p.cash + p.assets.reduce((s, a) => s + a.value, 0)) + '</div></div>' +
          '<div class="kpi"><div class="k">净资产</div><div class="v ' + (p.netWorth < 0 ? 'down' : 'plain') + '">' + fmt(p.netWorth) + '</div></div>' +
        '</div>' +

        '<div class="pc-ncf">' +
          '<span class="lbl">💧 月净现金流</span>' +
          '<span class="val ' + (ncf >= 0 ? 'up' : 'down') + '">' + (ncf >= 0 ? '+' : '−') + fmt(Math.abs(ncf)) + '</span>' +
        '</div>' +

        ((p.assets.length || p.liabilities.length) ?
          '<div class="pc-assets">' + assetChips + moreChip + liabChips + '</div>' : '') +

        (statusTags.length ? '<div class="pc-assets" style="padding-top:0">' + statusTags.join('') + '</div>' : '') +

        (showActions ? '<div class="pc-actions">' +
          '<button class="btn btn-soft" data-act="detail" data-idx="' + i + '">📋 明细</button>' +
          (p.assets.length ? '<button class="btn btn-soft" data-act="sell" data-idx="' + i + '">💱 卖资产</button>' : '') +
          (p.liabilities.length ? '<button class="btn btn-soft" data-act="repay" data-idx="' + i + '">🔓 还负债</button>' : '') +
        '</div>' : '') +
      '</div>';
    }).join('');

    if (showActions && handlers) {
      deck.querySelectorAll('[data-act]').forEach(btn => {
        btn.addEventListener('click', () => {
          handlers(btn.dataset.act, parseInt(btn.dataset.idx, 10));
        });
      });
    }
  }

  /* ======================================================================
     4. 日志
     ====================================================================== */

  function log(html, cls) {
    const el = document.getElementById('log');
    if (!el) return;
    const empty = el.querySelector('.log-empty');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.className = 'log-item' + (cls ? ' ' + cls : '');
    div.innerHTML = html;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
    while (el.children.length > 120) el.removeChild(el.firstChild);
  }

  function clearLog() {
    const el = document.getElementById('log');
    if (el) el.innerHTML = '<div class="log-empty">事件会显示在这里</div>';
  }

  /* ======================================================================
     5. 新闻条
     ====================================================================== */

  function setNews(text, tag) {
    const t = document.getElementById('newsText');
    const g = document.querySelector('.news-bar .nb-tag');
    if (t) { t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; t.textContent = text; }
    if (g && tag) g.textContent = tag;
  }

  /* ======================================================================
     6. 顶部统计
     ====================================================================== */

  function setTopStats(o) {
    setText('stRound', o.round);
    setText('stInflation', (o.inflation * 100).toFixed(1) + '%');
    setText('stLimit', o.limit == null ? '∞' : o.limit);
    setText('stDebt', fmt(o.debt || 0));
    const w = document.getElementById('stDebtWrap');
    if (w) w.classList.toggle('warn', (o.debt || 0) > 0);
  }

  function setText(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  /* ======================================================================
     7. Toast 提示
     ====================================================================== */

  function toast(icon, title, text) {
    const stack = document.getElementById('toastStack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML =
      '<span class="ti">' + icon + '</span>' +
      '<span class="tb"><div class="tt">' + title + '</div><div class="tx">' + text + '</div></span>';
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, 3200);
  }

  /* ======================================================================
     8. 三体骰子
     ====================================================================== */

  const PIPS = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };

  function buildDice() {
    const stage = document.getElementById('diceStage');
    if (!stage) return;
    const cube = document.createElement('div');
    cube.className = 'dice-3d';
    cube.id = 'diceCube';
    for (let f = 1; f <= 6; f++) {
      const face = document.createElement('div');
      face.className = 'dice-face face-' + f;
      const set = PIPS[f];
      for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        if (set.indexOf(i) >= 0) {
          const pip = document.createElement('div');
          pip.className = 'pip';
          cell.appendChild(pip);
        }
        face.appendChild(cell);
      }
      cube.appendChild(face);
    }
    stage.appendChild(cube);
  }

  /* 让指定面朝前 */
  function diceTo(value) {
    const cube = document.getElementById('diceCube');
    if (!cube) return;
    const map = {
      1: { x: 0,   y: 0 },
      2: { x: 0,   y: -90 },
      3: { x: 0,   y: 180 },
      4: { x: 0,   y: 90 },
      5: { x: -90, y: 0 },
      6: { x: 90,  y: 0 },
    };
    const t = map[value] || map[1];
    cube.style.transform = 'rotateX(' + (t.x - 12) + 'deg) rotateY(' + (t.y - 18) + 'deg)';
  }

  async function rollDiceAnimation(finalValue) {
    const cube = document.getElementById('diceCube');
    if (!cube) return;
    cube.classList.add('rolling');
    const t0 = performance.now();
    while (performance.now() - t0 < 820) {
      const rx = Math.random() * 360;
      const ry = Math.random() * 360;
      cube.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
      await sleep(70);
    }
    cube.classList.remove('rolling');
    // 加上多圈，使停面自然
    const map = {
      1: { x: 0,   y: 0 },
      2: { x: 0,   y: -90 },
      3: { x: 0,   y: 180 },
      4: { x: 0,   y: 90 },
      5: { x: -90, y: 0 },
      6: { x: 90,  y: 0 },
    };
    const t = map[finalValue] || map[1];
    cube.style.transform = 'rotateX(' + (360 * 2 + t.x - 12) + 'deg) rotateY(' + (360 * 3 + t.y - 18) + 'deg)';
    await sleep(560);
  }

  /* ======================================================================
     9. 新手引导
     ====================================================================== */

  const COACH_STEPS = [
    { target: '#boardCenter', title: '这是你的操作台',
      text: '轮到你时，点击 <b>掷骰子</b> 前进。骰子点数决定走几格。' },
    { target: '.cell[data-type="salary"]', title: '领工资格',
      text: '走到或路过这里，结算一次月度现金流：<b>工资 + 被动收入 − 生活费 − 负债利息</b>。' },
    { target: '.cell[data-type="small"]', title: '小机会格',
      text: '有机会买到能生钱的资产。<b>付出的是现金，换来的是每月持续的被动收入。</b>' },
    { target: '.cell[data-type="big"]', title: '大机会格',
      text: '产权、商铺、公寓……金额更大，往往需要贷款。<b>杠杆放大收益，也放大压力。</b>' },
    { target: '#playersDeck', title: '玩家面板',
      text: '这里能看到每个人的 <b>现金、被动收入、净资产</b> 和财务自由进度条。' },
    { target: '.card:has(#reportBody)', title: '财务报表',
      text: '随时查看你的 <b>收支表</b> 和 <b>资产负债表</b>——会看报表，才算真的会理财。' },
  ];

  let coachIdx = 0;
  let coachOpts = null;

  function startCoach(onDone) {
    coachIdx = 0;
    coachOpts = { onDone: onDone };
    document.getElementById('coach').classList.remove('hidden');
    const dots = document.getElementById('coachDots');
    dots.innerHTML = COACH_STEPS.map((_, i) => '<i' + (i === 0 ? ' class="on"' : '') + '></i>').join('');
    showCoachStep();
  }

  function showCoachStep() {
    const step = COACH_STEPS[coachIdx];
    const el = document.querySelector(step.target);
    const spot = document.getElementById('coachSpot');
    const tip = document.getElementById('coachTip');

    document.getElementById('coachStep').textContent =
      '第 ' + (coachIdx + 1) + ' / ' + COACH_STEPS.length + ' 步';
    document.getElementById('coachTitle').textContent = step.title;
    document.getElementById('coachText').innerHTML = step.text;
    document.getElementById('coachNext').textContent =
      coachIdx === COACH_STEPS.length - 1 ? '开始游戏 🎲' : '下一步';

    document.querySelectorAll('#coachDots i').forEach((d, i) =>
      d.classList.toggle('on', i === coachIdx));

    if (!el) { advanceCoach(); return; }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      const r = el.getBoundingClientRect();
      const pad = 6;
      spot.style.left   = (r.left - pad) + 'px';
      spot.style.top    = (r.top - pad) + 'px';
      spot.style.width  = (r.width + pad * 2) + 'px';
      spot.style.height = (r.height + pad * 2) + 'px';

      // 提示框位置：优先放在目标下方，空间不够则放上方
      const tipW = 270, tipH = 190;
      let top = r.bottom + 14;
      if (top + tipH > window.innerHeight - 10) top = Math.max(10, r.top - tipH - 14);
      let left = r.left + r.width / 2 - tipW / 2;
      left = Math.max(12, Math.min(window.innerWidth - tipW - 12, left));
      tip.style.top = top + 'px';
      tip.style.left = left + 'px';
    }, 260);
  }

  function advanceCoach() {
    coachIdx++;
    if (coachIdx >= COACH_STEPS.length) {
      endCoach();
      return;
    }
    showCoachStep();
  }

  function endCoach() {
    document.getElementById('coach').classList.add('hidden');
    window.removeEventListener('resize', showCoachStep);
    const cb = coachOpts && coachOpts.onDone;
    coachOpts = null;
    if (cb) cb();
  }

  window.addEventListener('resize', () => {
    if (!document.getElementById('coach').classList.contains('hidden')) showCoachStep();
  });

  /* ======================================================================
     10. 徽章墙
     ====================================================================== */

  function renderBadges(badges, unlockedSet) {
    const grid = document.getElementById('badgeGrid');
    if (!grid) return;
    grid.innerHTML = badges.map(b => {
      const got = unlockedSet.has(b.id);
      return '<div class="badge ' + (got ? 'unlocked' : 'locked') + '" title="' + b.desc + '" data-badge="' + b.id + '">' +
        '<div class="b-icon">' + b.icon + '</div>' +
        '<div class="b-name">' + b.name + '</div>' +
      '</div>';
    }).join('');
    setText('badgeCount', unlockedSet.size + ' / ' + badges.length);
  }

  function popBadge(id) {
    const el = document.querySelector('.badge[data-badge="' + id + '"]');
    if (el) {
      el.classList.add('unlocked');
      el.classList.remove('locked');
      el.classList.add('pop');
      setTimeout(() => el.classList.remove('pop'), 600);
    }
  }

  /* ======================================================================
     11. 帮助 / 财务自由示意图
     ====================================================================== */

  function freedomViz(p) {
    const max = Math.max(p.salary, p.expenses, p.passive, 1);
    const h = v => Math.max(6, Math.round((v / max) * 66));
    return '' +
      '<div class="freedom-viz">' +
        '<div class="fv-col">' +
          '<div class="fv-bar salary" style="height:' + h(p.salary) + 'px"></div>' +
          '<div class="fv-lbl">工资<b>' + fmt(p.salary) + '</b></div>' +
        '</div>' +
        '<div class="fv-col">' +
          '<div class="fv-bar passive" style="height:' + h(p.passive) + 'px"></div>' +
          '<div class="fv-lbl">被动收入<b>' + fmt(p.passive) + '</b></div>' +
        '</div>' +
        '<div class="fv-col">' +
          '<div class="fv-bar expense" style="height:' + h(p.expenses) + 'px"></div>' +
          '<div class="fv-lbl">生活费<b>' + fmt(p.expenses) + '</b></div>' +
        '</div>' +
      '</div>';
  }

  /* ======================================================================
     导出
     ====================================================================== */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  global.UI = {
    modal, closeModal,
    buildBoard, renderTokens, highlightCell, clearHighlight, updateCellPrice,
    floatText,
    renderPlayers, renderBadges, popBadge,
    log, clearLog, setNews, setTopStats, setText,
    toast,
    buildDice, diceTo, rollDiceAnimation,
    startCoach, advanceCoach, endCoach,
    freedomViz,
    esc, fmt, sleep,
  };

})(window);
