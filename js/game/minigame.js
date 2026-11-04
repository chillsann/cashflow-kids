/* ==========================================================================
   现金流小富翁 v3 · 游乐场小游戏（对齐大富翁4Fun 的点券经济）
   接金币 / 射神明 / 猜兔子 —— 玩小游戏赚点券，点券在道具店换卡片。
   AI 走纯结算路径（绝不弹交互窗），人类玩 1-3 轮轻交互。
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.UI;
  const C = global.CFContent;
  const W = global.CFWorld;
  const BAL = W.BALANCE;
  const E = () => global.Engine;
  const esc = U.esc;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- 接金币：3 轮，每轮 5 个落点，点中金币得分 ---------- */
  async function catchCoins() {
    let hits = 0;
    for (let round = 1; round <= 3; round++) {
      const spots = ['🌤️', '☁️', '🌈', '⭐', '🎈'];
      const goldAt = Math.floor(Math.random() * spots.length);
      const choice = await U.modal({
        icon: '🪙', title: '接金币 · 第 ' + round + ' / 3 轮',
        desc: '金币从天上掉下来了！点一个位置接住它（已接住 ' + hits + ' 枚）。',
        cards: spots.map((s, i) => ({ value: 's:' + i, icon: s, name: '位置 ' + (i + 1), desc: '点我接住' })),
        options: [{ label: '放弃本轮', value: 's:-1', soft: true }],
      });
      if (!choice) break;
      const idx = +choice.split(':')[1];
      if (idx === goldAt) {
        hits++;
        global.SFX.play('lucky');
        await U.modal({ icon: '🪙', title: '接住啦！', desc: '叮！金币进袋（累计 ' + hits + ' 枚）。', auto: 900 });
      } else {
        await U.modal({ icon: '💨', title: '扑空了…', desc: '金币落在了位置 ' + (goldAt + 1) + '。', auto: 900 });
      }
    }
    return Math.max(1, Math.min(3, hits + 1));
  }

  /* ---------- 射神明：好神 +2，坏神 -1（保底 1） ---------- */
  async function shootGods() {
    const gods = [
      { id: 'fortune', icon: '🧧', name: '财神', good: true },
      { id: 'bless', icon: '🛡️', name: '福神', good: true },
      { id: 'poor', icon: '🕳️', name: '穷神', good: false },
      { id: 'decay', icon: '🌩️', name: '衰神', good: false },
    ];
    const choice = await U.modal({
      icon: '🎯', title: '射神明',
      desc: '射中好神得 2 张点券，射中坏神要倒扣！看准了再出手。',
      cards: gods.map(g => ({ value: g.id, icon: g.icon, name: g.name, desc: g.good ? '好神' : '坏神' })),
      options: [{ label: '放弃', value: 'skip', soft: true }],
    });
    if (!choice || choice === 'skip') return 0;
    const g = gods.find(x => x.id === choice);
    if (!g) return 0;
    global.SFX.play(g.good ? 'lucky' : 'alert');
    await U.modal({
      icon: g.icon, title: g.good ? '射中好神！' : '哎呀，射中坏神…',
      desc: g.good ? '好运气 +2 张点券' : '被缠上了，点券 −1',
      auto: 1200,
    });
    return g.good ? 3 : 1;
  }

  /* ---------- 猜兔子：3 个杯子，猜中 +3，猜错安慰 1 ---------- */
  async function guessRabbit() {
    const hidden = Math.floor(Math.random() * 3);
    const choice = await U.modal({
      icon: '🐰', title: '猜兔子',
      desc: '兔子藏在三个杯子之一。猜中得 3 张点券！',
      cards: [0, 1, 2].map(i => ({ value: 'c:' + i, icon: '🥤', name: '第 ' + (i + 1) + ' 个杯子', desc: '掀开看看' })),
      options: [{ label: '不猜了', value: 'c:-1', soft: true }],
    });
    if (!choice) return 0;
    const idx = +choice.split(':')[1];
    if (idx < 0) return 0;
    const win = idx === hidden;
    global.SFX.play(win ? 'lucky' : 'info');
    await U.modal({
      icon: win ? '🐰' : '🥤', title: win ? '猜中啦！' : '空杯子～',
      desc: win ? '兔子在第 ' + (hidden + 1) + ' 个杯子里，+3 张点券！' : '兔子其实在第 ' + (hidden + 1) + ' 个杯子，安慰奖 1 张点券。',
      auto: 1300,
    });
    return win ? 3 : 1;
  }

  const GAMES = { catch: catchCoins, shoot: shootGods, rabbit: guessRabbit };

  /* ---------- 落在游乐场格 ---------- */
  async function onArcade(p) {
    const G = E().G;

    /* 进乐园就先送 2 张点券（沿用中央乐园的奖励） */
    p.tickets += 2;
    global.SFX.play('lucky');
    U.log('🎡 <b>' + esc(p.name) + '</b> 来到游乐场，获得 2 张点券', 'up');

    if (p.isAI) {
      /* AI 纯结算：随机玩一个，拿 1-3 张，绝不弹窗 */
      const g = pick(C.MINIGAMES);
      const won = 1 + Math.floor(Math.random() * 3);
      p.tickets += won;
      U.log('🕹️ AI ' + esc(p.name) + ' 玩了「' + g.name + '」，又赢了 ' + won + ' 张点券', 'info');
      E().render();
      return;
    }

    const choice = await U.modal({
      icon: '🕹️', title: '游乐场 · ' + global.Calendar.label(),
      desc: '玩一个小游戏赢点券，点券可以在道具店换功能卡片。你已有 ' + p.tickets + ' 张。',
      cards: C.MINIGAMES.map(g => ({ value: g.id, icon: g.icon, name: g.name, desc: g.desc })),
      wide: true,
      options: [{ label: '先不玩（仍得 2 点券）', value: 'skip', soft: true }],
      teach: '点券是「奖励型收入」：不花钱就能换到工具。但注意——小游戏给的是一次性收入，卡片用得好才能变成长期优势。',
    });
    if (!choice || choice === 'skip' || !GAMES[choice]) { E().render(); return; }

    const game = C.MINIGAMES.find(g => g.id === choice);
    const won = await GAMES[choice]();
    p.tickets += won;
    U.log('🕹️ <b>' + esc(p.name) + '</b> 玩「' + game.name + '」获得 <span class="n up">+' + won + '</span> 张点券（共 ' + p.tickets + ' 张）', 'up');
    U.toast(game.icon, '小游戏结束', '+' + won + ' 张点券');
    if (game.teach) {
      await U.modal({ icon: '🎓', title: '财商小贴士', desc: game.teach, auto: 0 });
    }
    E().render();
  }

  global.MiniGame = { onArcade, GAMES };
})(window);
