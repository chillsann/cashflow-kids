/* ==========================================================================
   现金流小富翁 v2 · 入口
   设置屏（人数 / 角色 / 局时长）· 操作台与手牌事件 · 启动
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.UI;
  const W = global.CFWorld;

  const CFG = {
    count: 3,
    mode: 'standard',
    players: [],
    sound: true,
    coach: true,
    autosave: true,
  };

  let soundEnabled = true;

  /* ======================================================================
     设置屏
     ====================================================================== */
  function initPlayers(n) {
    const chars = W.CHARACTERS;
    CFG.players = [];
    for (let i = 0; i < n; i++) {
      CFG.players.push({
        name: i === 0 ? '我' : (i === 1 ? '玩家2' : (i === 2 ? '玩家3' : '玩家4')),
        isAI: i !== 0,
        charId: chars[i % chars.length].id,
        persona: W.AI_PERSONAS[(i * 2) % W.AI_PERSONAS.length],
      });
    }
  }

  function renderSetup() {
    const list = document.getElementById('playerSetupList');
    if (!list) return;
    list.innerHTML = CFG.players.map((p, i) => {
      const ch = W.CHARACTERS.find(c => c.id === p.charId);
      const isHuman = !p.isAI;
      return '<div class="psetup" data-idx="' + i + '" style="--pc:' + W.PLAYER_COLORS[i % W.PLAYER_COLORS.length] + '">' +
        '<div class="psetup-head">' +
          '<span class="ps-av">' + U.av(ch, 'av-setup') + '</span>' +
          '<input class="ps-name" value="' + U.esc(p.name) + '" data-role="name" maxlength="8">' +
          '<div class="ps-toggle">' +
            '<button class="pt-btn' + (isHuman ? ' on' : '') + '" data-role="human">👦 真人</button>' +
            '<button class="pt-btn' + (!isHuman ? ' on' : '') + '" data-role="ai">🤖 电脑</button>' +
          '</div>' +
        '</div>' +
        '<div class="ps-chars">' + W.CHARACTERS.map(c =>
          '<button class="ps-char' + (c.id === p.charId ? ' on' : '') + '" data-role="char" data-char="' + c.id + '" ' +
            'title="' + U.esc(c.story) + '">' +
            '<span class="psc-emoji">' + U.av(c, 'av-charpick') + '</span>' +
            '<span class="psc-name">' + c.name + '</span>' +
            '<span class="psc-meta">现金 ' + (c.cash / 1000) + 'k · 津贴 ' + (c.salary / 1000) + 'k</span>' +
          '</button>').join('') + '</div>' +
        '<div class="ps-story">' + ch.emoji + ' ' + U.esc(ch.story) + '　<b>' + U.esc(ch.teach) + '</b></div>' +
      '</div>';
    }).join('');
  }

  function bindSetup() {
    const list = document.getElementById('playerSetupList');
    if (!list) return;

    list.addEventListener('click', e => {
      const box = e.target.closest('.psetup');
      if (!box) return;
      const i = +box.dataset.idx;
      const btn = e.target.closest('[data-role]');
      if (!btn) return;
      const role = btn.dataset.role;

      if (role === 'human' || role === 'ai') {
        CFG.players[i].isAI = (role === 'ai');
      } else if (role === 'char') {
        CFG.players[i].charId = btn.dataset.char;
      }
      renderSetup();
    });

    list.addEventListener('input', e => {
      if (e.target.dataset.role !== 'name') return;
      const box = e.target.closest('.psetup');
      CFG.players[+box.dataset.idx].name = e.target.value || '玩家';
    });

    /* 人数 */
    document.getElementById('countSeg').addEventListener('click', e => {
      const b = e.target.closest('button[data-count]');
      if (!b) return;
      CFG.count = +b.dataset.count;
      document.querySelectorAll('#countSeg button').forEach(x => x.classList.toggle('on', x === b));
      initPlayers(CFG.count);
      renderSetup();
    });

    /* 局时长 */
    document.getElementById('modeGrid').addEventListener('click', e => {
      const b = e.target.closest('.mode-card');
      if (!b) return;
      CFG.mode = b.dataset.mode;
      document.querySelectorAll('#modeGrid .mode-card').forEach(x => x.classList.toggle('on', x === b));
    });

    /* 开关 */
    const sw = (id, key) => {
      const el = document.getElementById(id);
      el.addEventListener('click', () => {
        CFG[key] = !CFG[key];
        el.classList.toggle('on', CFG[key]);
        if (key === 'sound') { soundEnabled = CFG[key]; global.SFX.setEnabled(CFG[key]); }
      });
      el.classList.toggle('on', CFG[key]);
    };
    sw('optSound', 'sound');
    sw('optCoach', 'coach');
    sw('optAutosave', 'autosave');

    /* 开始 */
    document.getElementById('btnStart').addEventListener('click', launch);
    document.getElementById('btnContinue').addEventListener('click', () => {
      if (!global.SaveSys.load()) U.toast('⚠️', '没有可用的存档');
    });
    document.getElementById('btnContinue').style.display = global.SaveSys.hasSave() ? '' : 'none';

    document.getElementById('btnHelp').addEventListener('click', showHelp);
  }

  function showHelp() {
    U.modal({
      icon: '📖', title: '梦想小镇 · 玩法说明', wide: true,
      html:
        '<div class="help-grid">' +
        '<div class="help-item"><b>🎯 胜利条件</b><p>让所有对手<b>破产</b>，或轮数走完时<b>总资产最高</b>。总资产 = 现金 + 存款 + 地产 + 股票 − 贷款。</p></div>' +
        '<div class="help-item"><b>🏠 买地盖房</b><p>落到无主地块可买下；再次落上可加盖（L1 小屋 → L4 酒店）。对手落上就要交过路费。</p></div>' +
        '<div class="help-item"><b>⚡ 垄断</b><p>集齐同一街区的<b>全部</b>地块，该街区租金 <b>×2</b>。这是最快拉开差距的方式。</p></div>' +
        '<div class="help-item"><b>📈 股市</b><p>4 只股票，每轮波动。低买高卖赚差价，持有还有分红。涨得快的，跌得也快。</p></div>' +
        '<div class="help-item"><b>🃏 卡片</b><p>道具店购买、卡片格拾取、命运赠送。遥控骰子、怪兽卡、路障、炸弹……</p></div>' +
        '<div class="help-item"><b>✨ 神明</b><p>财神收入 ×2、福神挡厄运、穷神收入减半、衰神扣钱。好坏全看运气。</p></div>' +
        '<div class="help-item"><b>🎰 乐透</b><p>500 元一张，每 5 轮开奖，中奖率 8%。奖池越大越值得赌一把。</p></div>' +
        '<div class="help-item"><b>🏦 银行</b><p>存款生息、贷款付息。贷款是杠杆：放大收益，也放大风险。</p></div>' +
        '</div>',
      teach: '记住大亨的三条铁律：<b>① 现金流是氧气；② 垄断是杠杆；③ 分散是铠甲。</b>',
    });
  }

  /* ======================================================================
     启动游戏
     ====================================================================== */
  function launch() {
    CFG.players.forEach(p => {
      if (p.isAI) {
        p.persona = p.persona || W.AI_PERSONAS[Math.floor(Math.random() * W.AI_PERSONAS.length)];
      }
      if (!p.name) p.name = '玩家';
    });
    global.SFX.setEnabled(CFG.sound);
    global.SFX.unlock();
    global.Engine.startGame({
      mode: CFG.mode,
      players: CFG.players.map(p => ({ name: p.name, isAI: p.isAI, charId: p.charId, persona: p.persona })),
      coach: CFG.coach && CFG.players.some(p => !p.isAI),
    });
    if (CFG.autosave) {
      clearInterval(window.__cfAutosave);
      window.__cfAutosave = setInterval(() => {
        if (global.SaveSys) global.SaveSys.save();
      }, 15000);
    }
  }

  /* ======================================================================
     游戏内事件（一次性绑定，事件委托）
     ====================================================================== */
  function bindGameOnce() {
    /* 操作台 */
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      if (btn) {
        const act = btn.dataset.act;
        const p = global.Engine.cur();
        if (!p) return;
        if (act === 'roll') { global.SFX.unlock(); global.Engine.doRoll(p.fixedDice || null); if (p.fixedDice) p.fixedDice = null; }
        else if (act === 'build') global.Estate.openBuildPanel(p);
        else if (act === 'cards') openMyCards(p);
        else if (act === 'stock') global.Finance.stockPanel(p);
        else if (act === 'bank') global.Finance.bankPanel(p);
        else if (act === 'end') global.Engine.endTurn();
        return;
      }
      /* 手牌：只能在自己回合、且处于可操作阶段时使用 */
      const hc = e.target.closest('.hcard');
      if (hc && !hc.disabled) {
        const G = global.Engine.G;
        const cp = global.Engine.cur();
        const me = (cp && !cp.isAI && !cp.bankrupt) ? cp
          : G.players.find(x => !x.isAI && !x.bankrupt);
        if (!me) return;
        if (G.phase !== 'idle' && G.phase !== 'idle-post') {
          U.toast('⏳', '现在还不能用卡', '等结算完成或轮到你时再用');
          return;
        }
        global.CardSys.useCard(me, +hc.dataset.uid);
      }
    });

    /* 报表切换 */
    const tabs = document.getElementById('reportTabs');
    if (tabs) tabs.addEventListener('click', e => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      global.Report.setTab(b.dataset.tab);
      global.Report.renderTab(global.Engine.G);
      /* 切换看谁（点击玩家卡） */
    });

    /* 点玩家卡切换报表查看对象 */
    const deck = document.getElementById('playersDeck');
    if (deck) deck.addEventListener('click', e => {
      const card = e.target.closest('.pcard');
      if (!card) return;
      global.Report.setView(+card.dataset.pid);
      global.Report.renderTab(global.Engine.G);
    });

    /* 音效开关按钮 */
    const fab = document.getElementById('soundFab');
    if (fab) fab.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      global.SFX.setEnabled(soundEnabled);
      fab.textContent = soundEnabled ? '🔊' : '🔇';
      fab.classList.toggle('off', !soundEnabled);
    });

    /* 存档按钮 */
    const sb = document.getElementById('btnSave');
    if (sb) sb.addEventListener('click', () => {
      U.toast(global.SaveSys.save() ? '💾' : '⚠️', global.SaveSys.save() ? '已保存' : '保存失败');
    });
  }

  async function openMyCards(p) {
    if (!p.cards.length) {
      return U.modal({ icon: '🃏', title: '手牌是空的', desc: '去道具店买一张，或者路过卡片格捡一张吧！' });
    }
    const cards = p.cards.map(c => {
      const d = global.CardSys.cardDef(c.id);
      return { value: 'u:' + c.uid, icon: d.icon, name: d.name, desc: d.desc, price: '' };
    });
    const pick = await U.modal({
      icon: '🃏', title: '我的手牌', desc: '选择要使用哪一张：', cards, wide: true,
      options: [{ label: '关闭', value: 'close', soft: true }],
    });
    if (pick && pick.startsWith('u:')) await global.CardSys.useCard(p, +pick.slice(2));
  }

  /* ======================================================================
     启动
     ====================================================================== */
  function boot() {
    U.initModalEvents();
    initPlayers(CFG.count);
    renderSetup();
    bindSetup();
    bindGameOnce();
    /* 默认选中项 */
    document.querySelectorAll('#countSeg button').forEach(b => b.classList.toggle('on', +b.dataset.count === CFG.count));
    document.querySelectorAll('#modeGrid .mode-card').forEach(b => b.classList.toggle('on', b.dataset.mode === CFG.mode));
    ['optSound', 'optCoach', 'optAutosave'].forEach(id => {
      const el = document.getElementById(id);
      const key = { optSound: 'sound', optCoach: 'coach', optAutosave: 'autosave' }[id];
      if (el) el.classList.toggle('on', CFG[key]);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.App = { CFG, renderSetup, launch, showHelp, initPlayers };
})(window);
