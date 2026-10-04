/* ==========================================================================
   现金流小富翁 · 入口 / 设置界面
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.CFData;
  const U = global.UI;
  const Game = global.Game;

  /* ======================================================================
     设置状态
     ====================================================================== */
  const CFG = {
    count: 2,
    mode: 'normal',
    players: [],
    tutorial: true,
    sound: true,
    autosave: true,
    report: true,
  };

  const NAME_POOL = ['小明', '小红', '爸爸', '妈妈', '队长', '小美'];

  function initPlayers(n) {
    const old = CFG.players.slice();
    CFG.players = [];
    for (let i = 0; i < n; i++) {
      CFG.players.push(old[i] || {
        name: i === 0 ? '我' : '电脑' + i,
        isAI: i !== 0,
        career: null,
        persona: null,
      });
    }
  }

  /* ======================================================================
     渲染设置界面
     ====================================================================== */
  function renderSetup() {
    // 人数
    document.querySelectorAll('#countSeg button').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.count, 10) === CFG.count);
    });

    // 模式
    document.querySelectorAll('#modeGrid .mode-card').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === CFG.mode);
    });

    // 玩家列表
    const list = document.getElementById('playerSetupList');
    const A = global.Art;
    list.innerHTML = CFG.players.map((p, i) => {
      const career = p.career || D.CAREERS[i % D.CAREERS.length];
      return '<div class="player-setup" data-idx="' + i + '">' +
        '<div class="ps-avatar" style="border-color:' + D.PLAYER_COLORS[i % D.PLAYER_COLORS.length] + '">' +
          (A ? A.face(D.PLAYER_FACES[i % D.PLAYER_FACES.length]) : '') +
        '</div>' +
        '<div class="ps-fields">' +
          '<input class="ps-name" data-idx="' + i + '" value="' + U.esc(p.name) + '" maxlength="10" placeholder="输入名字">' +
          '<div class="ps-role">' +
            '<button data-idx="' + i + '" data-role="human" class="' + (p.isAI ? '' : 'active') + '">真人</button>' +
            '<button data-idx="' + i + '" data-role="ai" class="' + (p.isAI ? 'active' : '') + '">电脑</button>' +
            '<button data-idx="' + i + '" data-career="1" title="换一个职业" class="ps-career">' +
              (A ? A.jobIcon(career.id) : '') + '<span>' + career.name + '</span> ⟳' +
            '</button>' +
          '</div>' +
        '</div>' +
        (i >= 2 ? '<button class="ps-remove" data-remove="' + i + '" title="移除">✕</button>' : '') +
      '</div>';
    }).join('');

    // 绑定
    list.querySelectorAll('.ps-name').forEach(inp => {
      inp.addEventListener('input', e => {
        CFG.players[parseInt(e.target.dataset.idx, 10)].name =
          e.target.value.trim() || ('玩家' + (parseInt(e.target.dataset.idx, 10) + 1));
      });
      inp.addEventListener('click', e => e.stopPropagation());
    });

    list.querySelectorAll('[data-role]').forEach(b => {
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.idx, 10);
        CFG.players[i].isAI = b.dataset.role === 'ai';
        if (!CFG.players[i].name || /^(玩家|电脑)\d*$/.test(CFG.players[i].name)) {
          CFG.players[i].name = CFG.players[i].isAI ? ('电脑' + (i + 1)) : (i === 0 ? '我' : '玩家' + (i + 1));
        }
        renderSetup();
      });
    });

    list.querySelectorAll('[data-career]').forEach(b => {
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.idx, 10);
        const cur = CFG.players[i].career;
        let next = D.CAREERS[Math.floor(Math.random() * D.CAREERS.length)];
        if (cur && D.CAREERS.length > 1) {
          let guard = 0;
          while (next.id === cur.id && guard++ < 20) {
            next = D.CAREERS[Math.floor(Math.random() * D.CAREERS.length)];
          }
        }
        CFG.players[i].career = next;
        renderSetup();
      });
    });

    list.querySelectorAll('[data-remove]').forEach(b => {
      b.addEventListener('click', () => {
        CFG.players.splice(parseInt(b.dataset.remove, 10), 1);
        CFG.count = CFG.players.length;
        renderSetup();
      });
    });

    // 继续游戏按钮
    const cont = document.getElementById('btnContinue');
    cont.hidden = !Game.hasSave();
  }

  /* ======================================================================
     事件绑定
     ====================================================================== */

  function bindSetup() {
    document.getElementById('countSeg').addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      CFG.count = parseInt(btn.dataset.count, 10);
      initPlayers(CFG.count);
      global.SFX.play('click');
      renderSetup();
    });

    document.getElementById('modeGrid').addEventListener('click', e => {
      const card = e.target.closest('.mode-card');
      if (!card) return;
      CFG.mode = card.dataset.mode;
      global.SFX.play('click');
      renderSetup();
    });

    // 开关
    bindSwitch('optTutorial', 'tutorial', true);
    bindSwitch('optSound', 'sound', true);
    bindSwitch('optAutosave', 'autosave', true);
    bindSwitch('optReport', 'report', true);

    // 规则折叠
    const rt = document.getElementById('btnRules');
    rt.addEventListener('click', () => {
      const panel = document.getElementById('rulesPanel');
      const open = panel.hidden;
      panel.hidden = !open;
      rt.setAttribute('aria-expanded', String(open));
      global.SFX.play('click');
    });

    // 开始
    document.getElementById('btnStart').addEventListener('click', () => {
      global.SFX.unlock();
      global.SFX.play('click');
      launch();
    });

    // 继续
    document.getElementById('btnContinue').addEventListener('click', () => {
      global.SFX.unlock();
      if (Game.load()) {
        document.getElementById('setupScreen').classList.add('hidden');
        document.getElementById('gameScreen').classList.remove('hidden');
        document.getElementById('resultScreen').classList.add('hidden');
        Game.render();
        U.log('💾 已载入上一次的对局', 'info');
        const p = Game.G.players[Game.G.cur];
        if (p && p.isAI && !Game.G.over) setTimeout(Game.doRoll, 900);
      } else {
        U.toast('⚠️', '读档失败', '存档可能已损坏，请重新开始。');
      }
    });
  }

  function bindSwitch(id, key, def) {
    const el = document.getElementById(id);
    el.setAttribute('aria-checked', String(def));
    CFG[key] = def;
    el.addEventListener('click', () => {
      const v = el.getAttribute('aria-checked') !== 'true';
      el.setAttribute('aria-checked', String(v));
      CFG[key] = v;
      if (key === 'sound') {
        global.SFX.setEnabled(v);
        syncSoundFab();
      }
      if (v) global.SFX.play('click');
    });
  }

  /* ======================================================================
     启动游戏
     ====================================================================== */
  function launch() {
    const players = CFG.players.map((p, i) => ({
      name: p.name || ('玩家' + (i + 1)),
      isAI: p.isAI,
      career: p.career || D.CAREERS[i % D.CAREERS.length],
      persona: p.isAI ? pickPersona(i) : null,
    }));

    // 至少一个真人
    if (!players.some(p => !p.isAI)) players[0].isAI = false;

    global.SFX.setEnabled(CFG.sound);
    syncSoundFab();

    Game.startGame({ mode: CFG.mode, players: players });

    // 新手引导
    if (CFG.tutorial) {
      setTimeout(() => U.startCoach(() => {
        U.toast('🎲', '开始吧！', '点击「掷骰子」，开始你的财富之旅。');
      }), 500);
    }

    // 全局绑定（只绑定一次）
    bindGameOnce();
  }

  function pickPersona(i) {
    return D.AI_PERSONAS[i % D.AI_PERSONAS.length];
  }

  /* ======================================================================
     游戏内全局绑定
     ====================================================================== */
  let gameBound = false;

  function bindGameOnce() {
    if (gameBound) return;
    gameBound = true;

    // 报表切换
    document.getElementById('reportTabs').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      document.querySelectorAll('#reportTabs button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      Game.setReportTab(b.dataset.tab);
      global.SFX.play('click');
    });

    // 清空日志
    document.getElementById('btnClearLog').addEventListener('click', () => {
      U.clearLog();
      global.SFX.play('click');
    });

    // 帮助
    document.getElementById('btnHelp').addEventListener('click', () => {
      global.SFX.play('click');
      showHelp();
    });

    // 存档
    document.getElementById('btnSave').addEventListener('click', () => {
      global.SFX.play('click');
      if (Game.save()) {
        U.toast('💾', '已保存', '下次打开页面可以继续这一局。');
      } else {
        U.toast('⚠️', '保存失败', '浏览器可能禁用了本地存储。');
      }
    });

    // 重开
    document.getElementById('btnRestart').addEventListener('click', async () => {
      global.SFX.play('click');
      const yes = await U.modal({
        icon: '🔄', title: '重新开始？',
        desc: '当前进度会丢失（如果开了自动存档，也会一并清除）。',
        options: [
          { label: '确认重开', value: 'yes', primary: true },
          { label: '取消', value: 'no' },
        ],
      });
      if (yes === 'yes') {
        Game.clearSave();
        location.reload();
      }
    });

    // 音效 FAB
    document.getElementById('fabSound').addEventListener('click', () => {
      const on = !global.SFX.isEnabled();
      global.SFX.setEnabled(on);
      syncSoundFab();
      if (on) global.SFX.play('click');
      U.toast(on ? '🔔' : '🔕', on ? '音效已开启' : '音效已关闭', on ? '掷骰子、买卖都会有声哦。' : '安静的游戏中。');
    });

    // 回到顶部
    document.getElementById('fabTop').addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 新手引导
    document.getElementById('coachNext').addEventListener('click', () => U.advanceCoach());
    document.getElementById('coachSkip').addEventListener('click', () => U.endCoach());
    document.querySelector('.coach-mask').addEventListener('click', () => U.endCoach());

    // 键盘快捷键
    document.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'Enter') {
        const btn = document.getElementById('rollBtn');
        if (document.activeElement === document.body && btn && !btn.disabled) {
          e.preventDefault();
          btn.click();
        }
      }
      if (e.key === 'Escape') {
        const coach = document.getElementById('coach');
        if (!coach.classList.contains('hidden')) { U.endCoach(); return; }
        U.closeModal(null);
      }
    });

    // 自动存档
    window.addEventListener('beforeunload', () => {
      if (CFG.autosave && Game.G.players.length && !Game.G.over) Game.save();
    });

    // 每回合自动存档
    setInterval(() => {
      if (CFG.autosave && Game.G.players.length && !Game.G.over && !Game.G.busy) Game.save();
    }, 20000);
  }

  function syncSoundFab() {
    const f = document.getElementById('fabSound');
    if (f) f.textContent = global.SFX.isEnabled() ? '🔔' : '🔕';
  }

  /* ======================================================================
     帮助弹窗
     ====================================================================== */
  function showHelp() {
    U.modal({
      wide: true,
      icon: '📖',
      title: '游戏规则速查',
      desc: '随时按 Esc 关闭',
      html:
        '<div class="rules-panel" style="margin:0;text-align:left">' +
          '<h4>🎯 怎么赢</h4>' +
          '<ul><li>让 <b>被动收入 ≥ 每月生活费</b>，立刻实现财务自由。</li>' +
          '<li>回合数满时，按 <b>净资产</b> 排名。</li></ul>' +
          '<h4>💰 钱从哪来</h4>' +
          '<ul>' +
            '<li><b>领工资格</b>：结算 工资 + 被动收入 − 生活费 − 负债利息。</li>' +
            '<li><b>副业格</b>：一次性主动收入。</li>' +
            '<li><b>市场风云</b>：宏观事件，全员受影响。</li>' +
          '</ul>' +
          '<h4>🏗️ 怎么变富</h4>' +
          '<ul>' +
            '<li><b>小机会</b>：门槛低，用现金买。</li>' +
            '<li><b>大机会</b>：门槛高，可用首付 + 贷款撬动。</li>' +
            '<li><b>学习进修</b>：永久提高工资或资产收益。</li>' +
            '<li><b>还债</b>：点自己卡片上的「🔓 还负债」，减少每月利息。</li>' +
          '</ul>' +
          '<h4>⚠️ 小心这些</h4>' +
          '<ul>' +
            '<li><b>消费 / 意外</b>：现金变负数会被迫卖资产或借紧急贷款。</li>' +
            '<li><b>负债陷阱</b>：大机会里偶尔出现「买车、买奢侈品」，它们只会吃钱。</li>' +
          '</ul>' +
          '<h4>🛡️ 保命工具</h4>' +
          '<ul>' +
            '<li><b>保险</b>（银行格）：意外支出可获 80% 理赔。</li>' +
            '<li><b>应急基金</b>：留住 3–6 个月生活费，是最重要的安全垫。</li>' +
          '</ul>' +
        '</div>',
      options: [{ label: '知道了', value: 'ok', primary: true }],
    });
  }

  /* ======================================================================
     初始化
     ====================================================================== */
  function boot() {
    initPlayers(2);
    bindSetup();
    renderSetup();
    syncSoundFab();
    paintBrandLogo();
    paintBoardSlot();

    // 首次交互解锁音频
    const unlock = () => { global.SFX.unlock(); document.removeEventListener('pointerdown', unlock); };
    document.addEventListener('pointerdown', unlock);
  }

  function paintBrandLogo() {
    const el = document.getElementById('brandLogo');
    if (el && global.Art) el.innerHTML = global.Art.decor.coin('#ffd45e');
  }

  /* 窄屏时棋盘中央显示的桌游铭牌 */
  function paintBoardSlot() {
    const el = document.getElementById('boardSlot');
    if (!el || !global.Art) return;
    const A = global.Art;
    el.innerHTML =
      '<div class="slot-coins">' +
        A.decor.coin('#ffd45e') + A.decor.coin('#f0ae2b') + A.decor.coin('#ffe9a8') +
      '</div>' +
      '<div class="slot-logo">现金流<br>小富翁</div>' +
      '<div class="slot-rule"></div>' +
      '<div class="slot-sub">让钱为你工作</div>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.CashflowKids = { CFG, renderSetup, launch, showHelp };

})(window);
