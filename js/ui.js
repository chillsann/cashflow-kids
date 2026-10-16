/* ==========================================================================
   现金流小富翁 v2 · UI 核心层
   Promise 化弹窗（keepOpen 支持面板型弹窗）· toast · 日志 · 金币飞行动画
   · 新手引导 · 浮动数字
   ========================================================================== */
(function (global) {
  'use strict';

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const fmt = n => Math.round(n).toLocaleString('zh-CN');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  /* ======================================================================
     弹窗系统：U.modal({...}) → Promise<value>
     options:
       icon/title/desc/teach(教育文案)
       rows: [{label, value, cls, emphasis}]      键值行
       cards: [{value, icon, name, desc, badge, disabled, color, price}] 可选卡列表
       options: [{label, value, primary, danger, disabled}] 底部按钮
       auto: ms 自动关闭（返回第一个 primary）
       keepOpen: true 时不自动 resolve——面板型弹窗由调用方 closeModal()
       wide: 宽弹窗
       onCardSelect: 卡片被点击时的钩子（keepOpen 面板用）
     ====================================================================== */
  let modalResolve = null;
  let modalKeepOpen = false;
  let modalOnCard = null;

  function modal(o) {
    const ov = document.getElementById('modalOverlay');
    const box = document.getElementById('modalBox');
    if (!ov || !box) return Promise.resolve('ok');

    modalKeepOpen = !!o.keepOpen;
    modalOnCard = o.onCardSelect || null;
    box.className = 'modal' + (o.wide ? ' wide' : '');

    let html = '';
    if (o.icon || o.title) {
      html += '<div class="m-head">' +
        (o.icon ? '<div class="m-icon">' + o.icon + '</div>' : '') +
        '<div class="m-title">' + esc(o.title || '') + '</div></div>';
    }
    if (o.desc) html += '<div class="m-desc">' + o.desc + '</div>';   // desc 允许内联 b 标签

    if (o.rows && o.rows.length) {
      html += '<div class="m-rows">' + o.rows.map(r =>
        '<div class="m-row' + (r.emphasis ? ' emph' : '') + (r.kind === 'heading' ? ' heading' : '') + '">' +
          '<span class="mr-l">' + esc(r.label) + '</span>' +
          '<span class="mr-v ' + (r.cls || '') + '">' + esc(r.value) + '</span>' +
        '</div>').join('') + '</div>';
    }

    if (o.cards && o.cards.length) {
      html += '<div class="m-cards">' + o.cards.map(c =>
        '<button class="m-card" data-value="' + esc(c.value) + '"' +
          (c.disabled ? ' disabled' : '') +
          (c.color ? ' style="--cc:' + c.color + '"' : '') + '>' +
          (c.color ? '<i class="m-card-bar"></i>' : '') +
          '<div class="mc-icon">' + c.icon + '</div>' +
          '<div class="mc-name">' + esc(c.name) + '</div>' +
          (c.desc ? '<div class="mc-desc">' + esc(c.desc) + '</div>' : '') +
          (c.badge !== undefined ? '<div class="mc-badge">' + esc(c.badge) + '</div>' : '') +
          (c.price !== undefined ? '<div class="mc-price">' + (typeof c.price === 'number' ? fmt(c.price) + ' 元' : c.price) + '</div>' : '') +
        '</button>').join('') + '</div>';
    }

    if (o.html) html += '<div class="m-html">' + o.html + '</div>';

    if (o.options && o.options.length) {
      html += '<div class="m-actions" id="modalActions">' + o.options.map(op =>
        '<button class="btn ' + (op.primary ? 'btn-primary' : '') + ' ' + (op.danger ? 'btn-danger' : '') + ' ' + (op.soft ? 'btn-soft' : '') + '"' +
          (op.disabled ? ' disabled' : '') + ' data-value="' + esc(op.value) + '">' + op.label + '</button>').join('') + '</div>';
    } else if (!o.keepOpen) {
      /* 兜底：任何非面板型弹窗都必须有一个出口，否则玩家会永久卡住 */
      html += '<div class="m-actions" id="modalActions">' +
        '<button class="btn btn-primary" data-value="ok">' + (o.okLabel || '知道了') + '</button></div>';
    }

    if (o.teach) {
      html += '<div class="m-teach"><span class="t-icon">🎓</span><div>' + o.teach + '</div></div>';
    }

    box.innerHTML = html;
    ov.classList.add('show');

    return new Promise(resolve => {
      modalResolve = resolve;
      if (o.auto && !modalKeepOpen) {
        setTimeout(() => closeModal(o.options && o.options.find(x => x.primary) ?
          o.options.find(x => x.primary).value : 'ok'), o.auto);
      }
    });
  }

  function closeModal(value) {
    const ov = document.getElementById('modalOverlay');
    if (!ov) return;
    ov.classList.remove('show');
    modalKeepOpen = false;
    modalOnCard = null;
    if (modalResolve) { const r = modalResolve; modalResolve = null; r(value); }
  }

  /* 全局事件委托（绑定一次，由 main.js 调 initUIEvents） */
  function initModalEvents() {
    const ov = document.getElementById('modalOverlay');
    if (!ov) return;
    ov.addEventListener('click', e => {
      const btn = e.target.closest('[data-value]');
      if (btn && !btn.disabled) {
        if (modalKeepOpen && modalOnCard) { modalOnCard(btn.dataset.value, btn); return; }
        closeModal(btn.dataset.value);
        return;
      }
      if (e.target === ov && !modalKeepOpen) closeModal('close');
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && ov.classList.contains('show') && !modalKeepOpen) closeModal('close');
    });
  }

  /* ======================================================================
     头像组件：优先用 AI 素材图，加载失败自动回退 emoji
     用法：U.av(playerLike)  —— 需要 .av / .av-fb 两个 CSS 类
     ====================================================================== */
  function av(p, extraClass) {
    const e = (p && p.emoji) ? p.emoji : '🙂';
    const src = (p && p.avatar) ? p.avatar : '';
    return '<span class="av' + (extraClass ? ' ' + extraClass : '') + '">' +
      (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
      '<span class="av-fb">' + e + '</span>' +
      '</span>';
  }

  /* ======================================================================
     Toast / 日志 / 新闻 / 顶部状态
     ====================================================================== */
  function toast(icon, title, desc) {
    const stack = document.getElementById('toastStack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<div class="toast-ic">' + (icon || '💬') + '</div><div class="toast-bd">' +
      '<b>' + esc(title) + '</b>' + (desc ? '<span>' + esc(desc) + '</span>' : '') + '</div>';
    stack.appendChild(el);
    setTimeout(() => el.classList.add('show'), 20);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 350); }, 3400);
  }

  function log(html, cls) {
    const el = document.getElementById('log');
    if (!el) return;
    const line = document.createElement('div');
    line.className = 'log-line ' + (cls || 'info');
    line.innerHTML = '<span class="log-time">' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + '</span>' + html;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
    while (el.children.length > 120) el.removeChild(el.firstChild);
  }

  function clearLog() { const el = document.getElementById('log'); if (el) el.innerHTML = ''; }

  function setNews(text, tag) {
    const el = document.getElementById('newsBar');
    if (el) el.innerHTML = (tag ? '<b>[' + esc(tag) + ']</b> ' : '') + text;
  }

  function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }

  /* 浮动数字（+/-金额，从棋盘格冒出） */
  function floatText(at, text, color) {
    const cell = typeof at === 'object' ? at : document.querySelector('.cell[data-index="' + at + '"]');
    if (!cell) return;
    const f = document.createElement('div');
    f.className = 'float-num';
    f.textContent = text;
    f.style.color = color || '#e0342b';
    cell.appendChild(f);
    setTimeout(() => f.remove(), 1400);
  }

  /* ======================================================================
     金币飞行动画：从付款方棋子 → 收款方棋子
     ====================================================================== */
  function tokenEl(playerId) {
    return document.querySelector('.token[data-pid="' + playerId + '"]');
  }

  async function coinsFly(fromPid, toPid, amount) {
    const from = tokenEl(fromPid);
    const to = toPid === 'bank' ? document.getElementById('boardCenter') : tokenEl(toPid);
    if (!from || !to || !amount || amount <= 0) return;
    const stage = from.closest('.board-stage') || from.parentElement;
    if (!stage) return;

    const frect = from.getBoundingClientRect();
    const trect = to.getBoundingClientRect();
    const srect = stage.getBoundingClientRect();

    const n = Math.min(10, Math.max(5, Math.round(Math.abs(amount) / 1500)));
    const parts = [];
    for (let k = 0; k < n; k++) {
      const c = document.createElement('div');
      c.className = 'coin';
      c.textContent = '🪙';
      const sx = frect.left - srect.left + frect.width / 2;
      const sy = frect.top - srect.top + frect.height / 2;
      c.style.left = sx + 'px';
      c.style.top = sy + 'px';
      stage.appendChild(c);
      parts.push({ el: c, sx, sy,
        tx: trect.left - srect.left + trect.width / 2,
        ty: trect.top - srect.top + trect.height / 2,
        delay: k * 55 });
    }
    await sleep(30);
    parts.forEach(p => {
      const dx = p.tx - p.sx, dy = p.ty - p.sy;
      /* 两段位移模拟弧线：先上抛再落下 */
      p.el.style.transition = 'none';
      p.el.style.transform = 'translate(0,0) scale(.6)';
      requestAnimationFrame(() => {
        p.el.style.transition = 'left .5s cubic-bezier(.3,-.4,.7,1.4) ' + p.delay + 'ms,' +
                                'top .55s cubic-bezier(.5,0,.8,1) ' + p.delay + 'ms,' +
                                'transform .55s ease ' + p.delay + 'ms, opacity .2s ease ' + (p.delay + 420) + 'ms';
        p.el.style.left = p.tx + 'px';
        p.el.style.top = p.ty + 'px';
        p.el.style.transform = 'translate(-50%,-50%) scale(1)';
        p.el.style.opacity = '0';
      });
      setTimeout(() => p.el.remove(), p.delay + 700);
    });
    await sleep(600);
  }

  /* ======================================================================
     新手引导（8 步，逐项高亮）
     ====================================================================== */
  const COACH_STEPS = [
    { sel: '#rollBtn', title: '掷骰子', text: '点击掷骰子开始你的回合！也可以先盖房、用卡、炒股——顺序随你。' },
    { sel: '#board', title: '买地盖房', text: '落到无主的地块就能买下它；再路过时可以加盖房屋。房子越多，对手要交的过路费越贵！' },
    { sel: '#handBar', title: '手牌', text: '这里是你收集的卡片道具。点击卡片就能使用——遥控骰子、怪兽卡、路障……兵法多多！' },
    { sel: '#btnStock', title: '股市', text: '糖果、科技、深海……低买高卖赚差价。小心：涨得快的，跌得也快。' },
    { sel: '#btnBank', title: '银行', text: '存钱有利息，借钱要付息。贷款是杠杆——能放大收益，也能放大亏损。' },
    { sel: '#reportTabs', title: '财务报表', text: '收支表和资产负债表随时可查。租金是被动收入——睡着了也在赚的钱。' },
    { sel: '#playersDeck', title: '对手情报', text: '盯紧对手的现金和地产。谁快集齐一个街区（垄断）了？垄断意味着租金翻倍！' },
    { sel: '#roundInfo', title: '胜利条件', text: '让所有对手破产，或者圈数走完时总资产最高。祝你好运，未来的大亨！' },
  ];

  let coachIdx = -1;

  function startCoach() {
    coachIdx = 0;
    const ov = document.getElementById('coachOverlay');
    if (ov) ov.classList.remove('hidden');
    renderCoach();
  }

  function renderCoach() {
    const ov = document.getElementById('coachOverlay');
    if (!ov || coachIdx < 0 || coachIdx >= COACH_STEPS.length) return endCoach();
    const st = COACH_STEPS[coachIdx];
    document.querySelectorAll('.coach-hl').forEach(el => el.classList.remove('coach-hl'));
    const target = document.querySelector(st.sel);
    if (target) target.classList.add('coach-hl');
    const tip = document.getElementById('coachTip');
    if (tip) {
      tip.innerHTML = '<div class="ct-step">' + (coachIdx + 1) + ' / ' + COACH_STEPS.length + '</div>' +
        '<div class="ct-title">' + st.title + '</div><div class="ct-text">' + st.text + '</div>' +
        '<div class="ct-btns"><button class="btn btn-soft" id="coachSkip">跳过</button>' +
        '<button class="btn btn-primary" id="coachNext">' +
        (coachIdx === COACH_STEPS.length - 1 ? '开始游戏！' : '下一步') + '</button></div>';
      document.getElementById('coachNext').onclick = () => { coachIdx++; renderCoach(); };
      document.getElementById('coachSkip').onclick = endCoach;
    }
    if (target) target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function endCoach() {
    coachIdx = -1;
    document.querySelectorAll('.coach-hl').forEach(el => el.classList.remove('coach-hl'));
    const ov = document.getElementById('coachOverlay');
    if (ov) ov.classList.add('hidden');
  }

  global.UI = {
    modal, closeModal, initModalEvents,
    toast, log, clearLog, setNews, setText, floatText, coinsFly, av,
    startCoach, endCoach,
    fmt, esc, sleep,
  };
})(window);
