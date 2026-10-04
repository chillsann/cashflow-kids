/* ==========================================================================
   现金流小富翁 · 核心引擎
   玩家建模、回合流程、落格结算、AI 决策、成就判定、胜负判定
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.CFData;
  const U = global.UI;
  const R = global.Report;

  const fmt = n => Math.round(n).toLocaleString('zh-CN');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  /* ======================================================================
     游戏状态
     ====================================================================== */
  const G = {
    cells: [],
    players: [],
    cur: 0,
    round: 1,
    busy: false,
    over: false,
    mode: 'normal',
    cfg: null,
    badgeSet: new Set(),
    log: [],           // 用于导出
    startedAt: 0,
    history: [],       // 净资产走势
    rng: Math.random,
  };

  /* ======================================================================
     玩家工厂
     ====================================================================== */
  function createPlayer(cfg, index) {
    const mode = D.MODES[G.mode];
    const career = cfg.career || pick(D.CAREERS);
    const persona = cfg.persona || pick(D.AI_PERSONAS);

    const p = {
      id: index,
      name: cfg.name || ('玩家' + (index + 1)),
      emoji: D.PLAYER_EMOJIS[index % D.PLAYER_EMOJIS.length],
      color: D.PLAYER_COLORS[index % D.PLAYER_COLORS.length],
      isAI: !!cfg.isAI,
      persona: persona,

      careerId: career.id,
      careerName: career.name,
      careerIcon: career.icon,

      cash: Math.round(career.cash * mode.startCashMult),
      salary: career.salary,
      expenses: Math.round(career.expenses),
      baseExpenses: Math.round(career.expenses),

      passive: 0,
      pos: 0,
      laps: 0,

      assets: [],        // {id,name,icon,value,income,cost,tags,unit}
      liabilities: [],   // {id,name,icon,balance,rate,kind}

      badges: [],
      stats: {
        bought: 0, sold: 0, earned: 0, spent: 0, interestPaid: 0,
        studies: 0, charities: 0, dreams: 0, loans: 0,
        turns: 0, peakPassive: 0, maxNcf: -Infinity,
      },

      insured: false,
      charityStreak: 0,     // 善缘剩余步数加成
      charityBonus: 0,
      bankrupt: false,
      skipNext: false,

      get netWorth() {
        const a = this.cash + this.assets.reduce((s, x) => s + x.value, 0);
        const l = this.liabilities.reduce((s, x) => s + x.balance, 0);
        return a - l;
      },
    };

    // 初始负债
    if (career.debt > 0) {
      p.liabilities.push({
        id: 'init_debt', name: '个人消费贷', icon: '💳',
        balance: career.debt, rate: debtRate(), kind: 'consumer',
      });
    }
    return p;
  }

  /* ======================================================================
     派生计算
     ====================================================================== */
  const interestOf = p => p.liabilities.reduce((s, l) => s + l.balance * l.rate, 0);
  const totalDebt  = p => p.liabilities.reduce((s, l) => s + l.balance, 0);
  const totalAssetValue = p => p.assets.reduce((s, a) => s + a.value, 0);
  const ncfOf = p => p.salary + p.passive - p.expenses - interestOf(p);
  const monthsOfRunway = p => (p.expenses + interestOf(p)) > 0
    ? p.cash / (p.expenses + interestOf(p)) : 99;
  // 难度可以调整借款成本：硬核难度借钱更贵，逼玩家减少杠杆
  const debtRate = () => D.DEBT_RATE * ((D.MODES[G.mode] && D.MODES[G.mode].debtRateMult) || 1);

  /* ======================================================================
     现金流结算（领工资格 / 每期结算）
     ====================================================================== */
  async function settleCashflow(p, opts) {
    opts = opts || {};
    const interest = interestOf(p);
    const income = p.salary + p.passive;
    const expense = p.expenses + interest;
    const ncf = income - expense;

    p.cash += ncf;
    p.stats.interestPaid += interest;
    if (ncf > p.stats.maxNcf) p.stats.maxNcf = ncf;

    if (ncf > 0) p.stats.earned += ncf;

    // 通胀：每轮回合后生活费缓慢上涨
    // （由 tickInflation 处理）

    // 破产检查
    if (p.cash < 0) {
      await handleNegativeCash(p);
    }

    return { interest, income, expense, ncf };
  }

  /* ----------------------------------------------------------------------
     现金为负 → 紧急贷款
     ---------------------------------------------------------------------- */
  async function handleNegativeCash(p) {
    // 先尝试自动变卖资产（AI 或 已无选择）
    // 折价 22%：这是「急用钱」的真实代价，也是本作最想让玩家记住的一课
    while (p.cash < 0 && p.assets.length) {
      // 优先卖掉收益最低的
      const sorted = p.assets.slice().sort((a, b) => (a.income / a.value) - (b.income / b.value));
      const a = sorted[0];
      const price = Math.round(a.value * 0.78);
      removeAsset(p, a.id);
      p.cash += price;
      p.stats.sold++;
      U.log('💱 <b>' + p.name + '</b> 现金不够，被迫低价变卖 <b>' + a.name + '</b>，收回 ' +
            '<span class="n">' + fmt(price) + '</span> 元（折价 22%）', 'down');
      if (!p.isAI) {
        await U.modal({
          icon: '💱', title: '被迫变卖资产',
          desc: '现金变成负数了，只能把资产折价卖掉应急。资产本身没坏，坏的是你「等不起」。',
          rows: [
            { label: a.icon + ' ' + a.name, value: '−1 项', cls: 'down' },
            { label: '账面价值', value: fmt(a.value) },
            { label: '实际收回', value: '+' + fmt(price), cls: 'down' },
            { label: '折价亏损', value: '−' + fmt(a.value - price), cls: 'down' },
            { label: '当前现金', value: fmt(p.cash) },
          ],
          auto: 2200,
          teach: '这就是为什么要有「应急基金」。急用钱的时候变卖资产，往往要打折亏钱。',
        });
      }
      await sleep(120);
    }

    if (p.cash < 0) {
      const loan = D.EMERGENCY_LOAN;
      p.cash += loan;
      p.liabilities.push({
        id: 'loan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: '紧急贷款', icon: '🏦',
        balance: loan, rate: Math.min(0.06, debtRate() * 1.5), kind: 'emergency',
      });
      p.stats.loans++;
      U.log('🏦 <b>' + p.name + '</b> 现金见底，向银行申请了 <span class="n">' + fmt(loan) + '</span> 元紧急贷款', 'down');

      if (!p.isAI) {
        await U.modal({
          icon: '🆘', title: '触发紧急贷款',
          desc: '现金不够用了，银行给你一笔应急贷款——利息比普通贷款还高。',
          rows: [
            { label: '贷款金额', value: '+' + fmt(loan), cls: 'up' },
            { label: '贷款月利率', value: (Math.min(0.06, debtRate() * 1.5) * 100).toFixed(1) + '%', cls: 'down' },
            { label: '当前现金', value: fmt(p.cash) },
          ],
          teach: '借钱能救急，但负债会增加你每月的支出。<b>利息一多，你买资产的钱就少了。</b>',
        });
      }

      // 破产判定：现金为负、无法再借，且净资产已被耗尽
      if (p.cash < 0 && p.netWorth < 0) {
        p.bankrupt = true;
        U.log('💔 <b>' + p.name + '</b> 资不抵债，宣告破产', 'down');
        global.SFX.play('fail');
        if (!p.isAI) {
          await U.modal({
            icon: '💔', title: '破产了',
            desc: '现金还不上、资产也卖光了。这不是游戏在惩罚你，是现实在提醒你。',
            rows: [
              { label: '净资产', value: fmt(p.netWorth), cls: 'down' },
              { label: '负债总额', value: fmt(totalDebt(p)), cls: 'down' },
            ],
            teach: '破产的真正原因通常不是「赚得太少」，而是「欠得太多 + 没有现金缓冲」。',
          });
        }
      } else if (p.netWorth <= (p.expenses + interestOf(p)) * 1.5) {
        // 危险边缘提醒（不破产，但教育意图要到位）
        U.log('⚠️ <b>' + p.name + '</b> 净资产只剩不到 1.5 个月开支，已经走到破产边缘', 'down');
      }
    }
  }

  /* ======================================================================
     通胀 / 时间推进
     ====================================================================== */
  function tickInflation() {
    const mode = D.MODES[G.mode];
    const rate = mode.inflation;
    const cap = mode.expenseCap || 4;   // 生活费上限倍数，防止通胀失控把游戏拖成死局
    G.players.forEach(p => {
      if (p.bankrupt) return;
      const roof = Math.round((p.baseExpenses || p.expenses) * cap);
      if (p.expenses >= roof) return;
      p.expenses = Math.min(roof, Math.round(p.expenses * (1 + rate / 12)));
    });
  }

  /* ======================================================================
     资产 / 负债操作
     ====================================================================== */
  function addAsset(p, src, cost, income, value, tags) {
    const id = src.id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
    p.assets.push({
      id: id,
      srcId: src.id,
      name: src.name,
      icon: src.icon,
      value: value,
      income: income,
      cost: cost,
      tags: tags || src.tags || [],
      unit: src.unit || '项',
    });
    p.passive += income;
    p.stats.bought++;
    if (p.passive > p.stats.peakPassive) p.stats.peakPassive = p.passive;
    return id;
  }

  function removeAsset(p, assetId) {
    const i = p.assets.findIndex(a => a.id === assetId);
    if (i < 0) return null;
    const a = p.assets[i];
    p.assets.splice(i, 1);
    p.passive -= a.income;
    if (p.passive < 0) p.passive = 0;
    return a;
  }

  function addLiability(p, src, balance, rate) {
    p.liabilities.push({
      id: 'liab_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      name: src.name, icon: src.icon,
      balance: balance, rate: rate || debtRate(), kind: 'mortgage',
    });
  }

  async function repayDebt(p, liabId, amount) {
    const l = p.liabilities.find(x => x.id === liabId);
    if (!l) return 0;
    const pay = Math.min(amount, l.balance, p.cash);
    if (pay <= 0) return 0;
    p.cash -= pay;
    l.balance -= pay;
    if (l.balance <= 0.5) {
      p.liabilities = p.liabilities.filter(x => x.id !== liabId);
    }
    return pay;
  }

  /* ======================================================================
     成就检查
     ====================================================================== */
  const BADGE_CHECKS = {
    first_asset: p => p.assets.length >= 1,
    passive_1k:  p => p.passive >= 1000,
    passive_5k:  p => p.passive >= 5000,
    passive_10k: p => p.passive >= 10000,
    portfolio3:  p => new Set(p.assets.flatMap(a => a.tags)).size >= 3,
    debt_free:   p => p.liabilities.length === 0 && p.stats.loans >= 0 && totalDebt(p) === 0,
    emergency:   p => monthsOfRunway(p) >= 6,
    insured:     p => p.insured,
    scholar:     p => p.stats.studies >= 3,
    kind_heart:  p => p.stats.charities >= 1,
    dreamer:     p => p.stats.dreams >= 1,
    freedom:     p => p.passive >= p.expenses && p.passive > 0,
  };

  function checkBadges(p, silent) {
    const got = [];
    D.BADGES.forEach(b => {
      if (G.badgeSet.has(b.id)) return;
      const fn = BADGE_CHECKS[b.id];
      if (fn && fn(p)) {
        G.badgeSet.add(b.id);
        p.badges.push(b.id);
        got.push(b);
      }
    });
    if (got.length) {
      U.renderBadges(D.BADGES, G.badgeSet);
      global.SFX.play('badge');
      got.forEach((b, i) => {
        U.popBadge(b.id);
        setTimeout(() => {
          U.toast(b.icon, '解锁徽章 · ' + b.name, b.desc);
          U.log('🏅 <b>' + p.name + '</b> 解锁徽章 ' + b.icon + ' <b>' + b.name + '</b>（' + b.desc + '）', 'gold');
        }, i * 380);
      });
    }
    return got;
  }

  /* ======================================================================
     AI 决策
     ====================================================================== */
  function aiWantsAsset(p, cost, income, isBig) {
    const persona = p.persona;
    const burn = p.expenses + interestOf(p);          // 每月总开销（含利息）
    const reserve = Math.max(3, persona.reserve) * burn;
    const afterCash = p.cash - cost;

    const roi = income / Math.max(1, cost);        // 每月回报率
    const payback = cost / Math.max(1, income);    // 回本月份

    // 大机会要背月供：先算清楚这笔负债会把月现金流压成什么样
    if (isBig) {
      // 房贷月供 = 贷款额 × 利率（本金不还，这是本作的简化）
      const mRate = debtRate() * 1.6;
      const mortgage = Math.max(0, cost) * mRate;
      const ncfAfter = p.salary + p.passive + income - p.expenses - interestOf(p) - mortgage;
      const cushionAfter = burn + mortgage > 0 ? afterCash / (burn + mortgage) : 99;

      // 加了这笔负债之后月现金流还是负的 → 除「机会猎手」外都拒绝
      if (ncfAfter < 0 && persona.id !== 'opportunist') return false;
      // 现金缓冲不足 3 个月 → 现金变负时只能折价卖资产，得不偿失
      if (afterCash < 0 || cushionAfter < 3) return false;
      // 负债会推高利息，加完息支出不能超过总收入的 75%
      const incomeTotal = p.salary + p.passive + income;
      const expAfter = p.expenses + interestOf(p) + mortgage;
      if (incomeTotal > 0 && expAfter / incomeTotal > 0.75) return false;
    } else if (afterCash < reserve) {
      // 高收益资产可以突破一点
      if (!(persona.id === 'aggressive' && roi > 0.010 && afterCash > 0)) return false;
    }

    switch (persona.id) {
      case 'cautious':    return roi >= 0.005 && payback <= 180 && afterCash > reserve;
      case 'balanced':    return roi >= 0.004 && afterCash > reserve * 0.8;
      case 'aggressive':  return roi >= 0.0025 && afterCash > 0;
      case 'opportunist': return payback <= 120 && afterCash > 0;
      case 'teacher':     return roi >= 0.005 && afterCash > reserve * 1.3;
      default:            return roi >= 0.004;
    }
  }

  function aiDebtDecision(p) {
    // 返回要偿还的金额
    const rate = p.persona.debtRepay;
    if (!p.liabilities.length) return 0;
    const burn = p.expenses + interestOf(p);
    const reserve = Math.max(3, p.persona.reserve) * burn;
    const spare = p.cash - reserve;
    if (spare <= 0) return 0;
    return Math.max(0, Math.floor(spare * rate));
  }

  function aiStudyDecision(p, offer) {
    const burn = p.expenses + interestOf(p);
    if (p.cash - offer.cost < Math.max(3, p.persona.reserve) * burn) return false;
    if (p.persona.id === 'teacher') return true;
    // 判断回本：涨薪 / 学费（几个月工资能赚回学费）
    const payback = offer.cost / Math.max(1, offer.salaryGain + offer.incomeGain);
    return payback <= 3;
  }

  function aiCharityDecision(p, card) {
    if (p.persona.id === 'aggressive') return Math.random() < 0.15;
    if (p.persona.id === 'cautious') return Math.random() < 0.2;
    const burn = p.expenses + interestOf(p);
    const reserve = Math.max(3, p.persona.reserve) * burn;
    return p.cash - card.amount > reserve;
  }

  /* ======================================================================
     回合流程
     ====================================================================== */
  async function doRoll() {
    if (G.busy || G.over) return;
    const p = cur();
    if (!p || p.bankrupt) { nextTurn(); return; }

    G.busy = true;
    render();

    global.SFX.play('dice');
    const die1 = 1 + Math.floor(Math.random() * 6);
    const die2 = 1 + Math.floor(Math.random() * 6);
    const bonus = p.charityBonus || 0;
    const steps = die1 + die2 + bonus;

    // 更新骰子显示
    const dv = document.getElementById('diceValue');
    if (dv) dv.textContent = die1 + ' + ' + die2 + (bonus ? ' +' + bonus : '');

    await U.rollDiceAnimation(die1);
    await sleep(90);
    await U.rollDiceAnimation(die2);

    U.log('🎲 <b>' + p.name + '</b> 掷出 <span class="n">' + die1 + '</span> + <span class="n">' + die2 + '</span>' +
          (bonus ? '（善缘 <span class="n">+' + bonus + '</span>）' : '') +
          ' = <b>' + steps + '</b> 步');

    await movePlayer(p, steps);

    if (!G.over) {
      await resolveCell(p, steps);
    }

    if (p.charityBonus > 0) {
      p.charityBonus = 0;
      p.charityStreak = 0;
    }

    checkBadges(p);
    render();

    if (!G.over) {
      G.busy = false;
      await sleep(260);
      nextTurn();
    } else {
      G.busy = false;
    }
  }

  /* ---------- 移动 ---------- */
  async function movePlayer(p, steps) {
    const size = D.BOARD_SIZE;
    let salaryHits = 0;

    for (let i = 0; i < steps; i++) {
      p.pos = (p.pos + 1) % size;
      if (p.pos === 0) p.laps++;
      if (G.cells[p.pos] && G.cells[p.pos].type === 'salary') salaryHits++;

      U.highlightCell(p.pos);
      U.renderTokens(G.players);
      U.setNews(p.emoji + ' ' + p.name + ' 前进中… 当前位置：' + G.cells[p.pos].icon + G.cells[p.pos].name, '移动');
      global.SFX.play('step');
      await sleep(Math.max(70, 150 - steps * 4));
    }

    // 现金结算：经过 / 停下的领工资格
    if (salaryHits > 0) {
      const wasStopped = G.cells[p.pos].type === 'salary';
      // 若停在领工资格，前面已经计入一次，不重复
      const times = wasStopped ? salaryHits - 1 : salaryHits;
      if (times > 0) {
        await settleSalaryTimes(p, times, false);
      }
    }

    await sleep(80);
    const el = document.querySelector('.cell[data-index="' + p.pos + '"]');
    if (el) {
      el.classList.add('just-landed');
      setTimeout(() => el.classList.remove('just-landed'), 600);
    }
  }

  async function settleSalaryTimes(p, times, isStopped) {
    let totalNcf = 0;
    let last = null;
    for (let i = 0; i < times; i++) {
      last = await settleCashflow(p);
      totalNcf += last.ncf;
    }

    global.SFX.play(totalNcf >= 0 ? 'income' : 'expense');
    if (p.cash >= 0) {
      const el = document.querySelector('.cell[data-index="' + p.pos + '"]');
      U.floatText(el, (totalNcf >= 0 ? '+' : '−') + fmt(Math.abs(totalNcf)), totalNcf >= 0 ? '#e0342b' : '#0f9d58');
    }

    U.log('💰 <b>' + p.name + '</b> ' + (isStopped ? '停在' : '路过') + '领工资格' +
          (times > 1 ? '（结算 ' + times + ' 次）' : '') + '：' +
          '工资 <span class="n up">+' + fmt(last.income - p.passive + p.passive) + '</span>…' +
          '净现金流 <span class="n ' + (totalNcf >= 0 ? 'up' : 'down') + '">' +
          (totalNcf >= 0 ? '+' : '−') + fmt(Math.abs(totalNcf)) + '</span>',
          totalNcf >= 0 ? 'up' : 'down');

    await U.modal({
      icon: '💰',
      title: times > 1 ? '领工资 ×' + times : '发工资啦',
      desc: '工资是主动收入——你必须去上班才能拿到。被动收入则是资产替你赚的。',
      rows: [
        { label: '💼 工资收入',   value: '+' + fmt(p.salary),  cls: 'up' },
        { label: '📈 被动收入',   value: '+' + fmt(p.passive), cls: 'up' },
        { label: '🍚 生活支出',   value: '−' + fmt(p.expenses), cls: 'down' },
        { label: '🏦 负债利息',   value: '−' + fmt(last.interest), cls: 'down' },
        { label: '💰 本次净现金流', value: (last.ncf >= 0 ? '+' : '−') + fmt(Math.abs(last.ncf)),
          cls: last.ncf >= 0 ? 'up' : 'down', emphasis: true },
      ],
      teach: '看！<b>被动收入</b>那一栏，是你不用上班也能拿到的钱。每买一项资产，这一栏就变大一点。',
      auto: p.isAI ? 1500 : 0,
    });

    render();
    return totalNcf;
  }

  /* ---------- 落格结算 ---------- */
  async function resolveCell(p, steps) {
    const cell = G.cells[p.pos];
    if (!cell) return;

    switch (cell.type) {
      case 'start':    await onStart(p); break;
      case 'salary':   await onSalaryStop(p); break;
      case 'small':    await onOpportunity(p, 'small'); break;
      case 'big':      await onOpportunity(p, 'big'); break;
      case 'spend':    await onSpend(p); break;
      case 'market':   await onMarket(p); break;
      case 'accident': await onAccident(p); break;
      case 'parttime': await onPartTime(p); break;
      case 'study':    await onStudy(p); break;
      case 'charity':  await onCharity(p); break;
      case 'bank':     await onBank(p); break;
      case 'landmark': await onLandmark(p); break;
    }

    // 落格后立即检查财务自由
    checkFreedom(p);
  }

  /* ---------- 起点 ---------- */
  async function onStart(p) {
    p.cash += D.START_BONUS;
    global.SFX.play('income');
    const el = document.querySelector('.cell[data-index="0"]');
    U.floatText(el, '+' + fmt(D.START_BONUS), '#e0342b');
    U.log('🏁 <b>' + p.name + '</b> 绕行一圈回到起点，领取 <span class="n up">' + fmt(D.START_BONUS) + '</span> 元完成奖励', 'up');
    if (!p.isAI) {
      await U.modal({
        icon: '🏁', title: '完成一圈！',
        desc: '每绕行一圈都会有额外奖励，鼓励你持续前进。',
        rows: [
          { label: '圈数奖励', value: '+' + fmt(D.START_BONUS), cls: 'up' },
          { label: '已完成圈数', value: p.laps + ' 圈' },
          { label: '当前现金', value: fmt(p.cash) },
        ],
        teach: '理财也是这样：<b>坚持的每一圈都不会白走。</b>',
        auto: 1500,
      });
    }
  }

  /* ---------- 停在领工资格 ---------- */
  async function onSalaryStop(p) {
    await settleSalaryTimes(p, 1, true);
  }

  /* ---------- 机会格 ---------- */
  async function onOpportunity(p, kind) {
    const mode = D.MODES[G.mode];
    const pool = kind === 'small' ? D.SMALL_OPPS : D.BIG_OPPS;

    // 大机会小概率出现「负债陷阱」
    if (kind === 'big' && Math.random() < 0.14) {
      return onDebtTrap(p);
    }

    // 小概率出现「捡漏」市场机会
    if (Math.random() < 0.18) {
      return onMarketOffer(p);
    }

    const src = pick(pool);
    const mult = mode.mult[kind];
    const isBig = kind === 'big';

    const cost = Math.round(src.cost * mult);
    const down = isBig ? Math.round(src.down * mult) : cost;
    const loan = Math.max(0, cost - down);
    const income = Math.round(src.income * mult);
    const value = cost;

    const canAfford = p.cash >= down;

    let buy = false;

    // 买房出租：月供利息是「真实的现金流出」，孩子必须在决策时就看见它
    const mortgageRate = isBig ? debtRate() * 1.6 : 0;
    const mortgage = Math.round(loan * mortgageRate);
    const netIncome = income - mortgage;

    if (p.isAI) {
      buy = canAfford && aiWantsAsset(p, down, income, isBig);
    } else {
      const rows = [
        { label: '总价', value: fmt(cost) },
      ];
      if (isBig) {
        rows.push({ label: '首付（现金支出）', value: '−' + fmt(down), cls: 'down' });
        rows.push({ label: '贷款金额', value: fmt(loan), cls: 'down' });
        rows.push({ label: '　└ 月供利息（' + (mortgageRate * 100).toFixed(1) + '%/月）', value: '−' + fmt(mortgage) + ' /月', cls: 'down' });
      } else {
        rows.push({ label: '需要现金', value: '−' + fmt(cost), cls: 'down' });
      }
      rows.push({ label: '每月租金 / 收入', value: '+' + fmt(income), cls: 'up' });
      rows.push({ label: '每月实际净收入', value: (netIncome >= 0 ? '+' : '−') + fmt(Math.abs(netIncome)) + ' /月',
        cls: netIncome >= 0 ? 'up' : 'down', emphasis: true });
      rows.push({ label: '按净收入算的回本周期', value: (netIncome > 0 ? Math.ceil(down / netIncome) : '∞') + ' 个月' });
      rows.push({ label: '你的现金', value: fmt(p.cash) });
      rows.push({ label: '买后剩余现金', value: fmt(p.cash - down), cls: p.cash - down < p.expenses ? 'down' : '' });

      const choice = await U.modal({
        icon: src.icon,
        title: (kind === 'small' ? '💡 小机会 · ' : '🏗️ 大机会 · ') + src.name,
        desc: src.desc,
        rows: rows,
        teach: src.teach + (isBig
          ? '\n\n<b>别忘了月供。</b>房子租金 1,000 元不代表你每月多 1,000 元——先减掉月供利息，剩下的才是真正进你口袋的钱。'
          : ''),
        options: [
          { label: canAfford ? '✅ 买入' + (isBig ? '（付首付）' : '') : '❌ 现金不足',
            value: 'buy', primary: true, disabled: !canAfford },
          { label: '再想想', value: 'skip' },
        ],
      });
      buy = choice === 'buy';
    }

    if (!buy) {
      if (!p.isAI) {
        U.log(canAfford
          ? '💭 <b>' + p.name + '</b> 放弃了 ' + src.icon + ' ' + src.name
          : '💭 <b>' + p.name + '</b> 想买 ' + src.name + '，但首付不够', 'info');
      }
      return;
    }

    // 执行买入
    p.cash -= down;
    p.stats.spent += down;
    if (loan > 0) addLiability(p, src, loan, mortgageRate);
    addAsset(p, src, cost, income, value, src.tags);

    global.SFX.play('buy');
    const el = document.querySelector('.cell[data-index="' + p.pos + '"]');
    U.floatText(el, '−' + fmt(down), '#0f9d58');

    U.log('✅ <b>' + p.name + '</b> 买入 ' + src.icon + ' <b>' + src.name + '</b>，' +
          (isBig ? '首付 <span class="n down">' + fmt(down) + '</span>（贷款 ' + fmt(loan) + '）' : '花费 <span class="n down">' + fmt(cost) + '</span>') +
          '，被动收入 <span class="n up">+' + fmt(income) + '/月</span>', 'up');

    if (!p.isAI) {
      await U.modal({
        icon: '🎉',
        title: '成功买入 ' + src.name,
        desc: '注意看：现金变少了一点，但每月的被动收入增加了——钱换了种方式陪你。',
        rows: [
          { label: '💸 现金支出', value: '−' + fmt(down), cls: 'down' },
          { label: '📈 月被动收入', value: '+' + fmt(income), cls: 'up', emphasis: true },
          { label: '剩余现金', value: fmt(p.cash) },
          { label: '月净现金流', value: (ncfOf(p) >= 0 ? '+' : '−') + fmt(Math.abs(ncfOf(p))),
            cls: ncfOf(p) >= 0 ? 'up' : 'down' },
        ],
        teach: '资产不会让你的现金变多，它让<b>现金流</b>变多。现金流，才是真正的财富。' +
          (isBig && mortgage > 0
            ? '\n\n注意看上面那笔「月供利息」——它已经出现在你的支出里了。<b>负债不只会吃掉你的现金，还会每个月持续吃掉你的现金流。</b>'
            : ''),
      });
    }

    if (p.cash < 0) await handleNegativeCash(p);
  }

  /* ---------- 负债陷阱（大机会的坑） ---------- */
  async function onDebtTrap(p) {
    const src = pick(D.DEBT_OPPS);
    let accept;
    if (p.isAI) {
      accept = false; // 电脑基本不上当
      if (p.persona.id === 'aggressive' && Math.random() < 0.35) accept = true;
    } else {
      const choice = await U.modal({
        icon: src.icon,
        title: '⚠️ ' + src.name,
        desc: src.desc,
        rows: [
          { label: '现金支出', value: '−' + fmt(src.cost), cls: 'down' },
          { label: '新增负债', value: fmt(src.debt), cls: 'down' },
          { label: '每月额外支出', value: '−' + fmt(Math.abs(src.income)), cls: 'down', emphasis: true },
        ],
        teach: src.teach,
        options: [
          { label: '我拒绝（推荐）', value: 'no', primary: true },
          { label: '好吧，买它', value: 'yes' },
        ],
      });
      accept = choice === 'yes';
    }

    if (accept) {
      p.cash -= src.cost;
      addLiability(p, { name: src.name, icon: src.icon }, src.debt);
      p.expenses += Math.abs(src.income);
      p.baseExpenses += Math.abs(src.income);
      global.SFX.play('alert');
      U.log('😖 <b>' + p.name + '</b> ' + src.name + '，新增负债 <span class="n down">' + fmt(src.debt) + '</span>，' +
            '每月多支出 <span class="n down">' + fmt(Math.abs(src.income)) + '</span>', 'down');
    } else {
      U.log('🛑 <b>' + p.name + '</b> 明智地拒绝了「' + src.name + '」', 'info');
      if (!p.isAI) {
        await U.modal({
          icon: '👏', title: '聪明的选择！',
          desc: '你避开了一个会持续吃钱的负债。',
          teach: '买之前问一句：<b>它是把钱放进我口袋，还是从我口袋拿走？</b>',
          auto: 1800,
        });
      }
    }
  }

  /* ---------- 市场机会（低价收购 / 高价出售） ---------- */
  async function onMarketOffer(p) {
    // 有资产时，可能遇到有人高价收购
    if (p.assets.length && Math.random() < 0.5) {
      return onSellOffer(p);
    }

    const offer = pick(D.MARKET_OFFERS);
    const canBuy = p.cash >= offer.buyPrice;
    let buy;

    if (p.isAI) {
      buy = canBuy && aiWantsAsset(p, offer.buyPrice, offer.buyIncome, false);
    } else {
      const choice = await U.modal({
        icon: offer.icon,
        title: '💰 ' + offer.name,
        desc: offer.desc,
        rows: [
          { label: '买入价', value: '−' + fmt(offer.buyPrice), cls: 'down' },
          { label: '每月被动收入', value: '+' + fmt(offer.buyIncome), cls: 'up', emphasis: true },
          { label: '回本周期', value: Math.ceil(offer.buyPrice / offer.buyIncome) + ' 个月' },
          { label: '你的现金', value: fmt(p.cash) },
        ],
        teach: offer.teach,
        options: [
          { label: canBuy ? '✅ 买下' : '❌ 现金不足', value: 'buy', primary: true, disabled: !canBuy },
          { label: '不了', value: 'skip' },
        ],
      });
      buy = choice === 'buy';
    }

    if (buy) {
      p.cash -= offer.buyPrice;
      p.stats.spent += offer.buyPrice;
      addAsset(p, { id: offer.id, name: offer.name, icon: offer.icon, tags: [offer.buyTag] },
               offer.buyPrice, offer.buyIncome, offer.buyPrice, [offer.buyTag]);
      global.SFX.play('buy');
      U.log('💰 <b>' + p.name + '</b> 抓住机会买入 <b>' + offer.name + '</b>，被动收入 <span class="n up">+' +
            fmt(offer.buyIncome) + '/月</span>', 'up');
      if (p.cash < 0) await handleNegativeCash(p);
    } else if (!p.isAI) {
      U.log('💭 <b>' + p.name + '</b> 错过了 ' + offer.name, 'info');
    }
  }

  async function onSellOffer(p) {
    const a = pick(p.assets);
    const price = Math.round(a.value * rnd(1.15, 1.45));
    let sell;

    if (p.isAI) {
      // 只有在急需现金时才卖
      sell = p.cash < p.expenses * 2;
    } else {
      const choice = await U.modal({
        icon: '📤',
        title: '有人高价收购你的资产',
        desc: '有人愿意出高于市价的价格买下它。卖掉能拿回一大笔现金，但每月被动收入会减少。',
        rows: [
          { label: a.icon + ' ' + a.name, value: '卖出 1 项', cls: 'down' },
          { label: '你的成本', value: fmt(a.cost) },
          { label: '收购价', value: '+' + fmt(price), cls: 'up' },
          { label: '失去的月收入', value: '−' + fmt(a.income), cls: 'down' },
          { label: '盈亏', value: (price - a.cost >= 0 ? '+' : '−') + fmt(Math.abs(price - a.cost)),
            cls: price - a.cost >= 0 ? 'up' : 'down', emphasis: true },
        ],
        teach: '卖资产收回的是「一次性」的钱，放弃的是「持续」的现金流。想清楚你要哪一种。',
        options: [
          { label: '✅ 卖掉，落袋为安', value: 'sell', primary: true },
          { label: '继续持有', value: 'hold' },
        ],
      });
      sell = choice === 'sell';
    }

    if (sell) {
      removeAsset(p, a.id);
      p.cash += price;
      p.stats.sold++;
      global.SFX.play('sell');
      U.log('💱 <b>' + p.name + '</b> 卖出 ' + a.icon + ' <b>' + a.name + '</b>，获利 <span class="n up">+' +
            fmt(price) + '</span>（成本 ' + fmt(a.cost) + '）', 'up');
    }
  }

  /* ---------- 消费格 ---------- */
  async function onSpend(p) {
    const card = pick(D.SPEND_CARDS);
    const amount = Math.round(card.amount * (1 + (G.round - 1) * 0.008));
    const before = p.cash;
    p.cash -= amount;
    p.stats.spent += amount;

    global.SFX.play('expense');
    const el = document.querySelector('.cell[data-index="' + p.pos + '"]');
    U.floatText(el, '−' + fmt(amount), '#0f9d58');

    U.log('🛍️ <b>' + p.name + '</b> ' + card.name + '，花了 <span class="n down">' + fmt(amount) + '</span> 元' +
          '（' + card.tag + '）', 'down');

    if (!p.isAI) {
      await U.modal({
        icon: card.icon,
        title: card.name,
        desc: '消费之前先想一想：这是「需要」，还是「想要」？',
        rows: [
          { label: '类型', value: card.needLevel === 'need' ? '✅ 需要' : card.needLevel === 'want' ? '🤔 想要' : '⚠️ 可以省', cls: card.needLevel === 'need' ? 'up' : card.needLevel === 'waste' ? 'down' : '' },
          { label: '本次支出', value: '−' + fmt(amount), cls: 'down' },
          { label: '剩余现金', value: fmt(p.cash) },
        ],
        teach: card.teach,
        auto: 2000,
      });
    }

    if (p.cash < 0) await handleNegativeCash(p);
    render();
  }

  /* ---------- 市场风云 ---------- */
  async function onMarket(p) {
    const ev = pick(D.MARKET_EVENTS);
    const e = ev.effect;
    const results = [];

    G.players.forEach(q => {
      if (q.bankrupt) return;
      let delta = 0;
      let note = '';

      switch (e.kind) {
        case 'assetReturn': {
          const matched = q.assets.filter(a => a.tags.some(t => e.tags.indexOf(t) >= 0));
          const base = matched.reduce((s, a) => s + a.income, 0);
          delta = Math.round(base * e.rate);
          note = matched.length ? matched.length + ' 项资产受影响' : '无相关资产';
          break;
        }
        case 'assetValue': {
          const matched = q.assets.filter(a => a.tags.some(t => e.tags.indexOf(t) >= 0));
          matched.forEach(a => { a.value = Math.round(a.value * (1 + e.rate)); });
          delta = 0;
          note = matched.length ? matched.length + ' 项资产估值变动' : '无相关资产';
          break;
        }
        case 'liabilityCost': {
          q.liabilities.forEach(l => {
            const base = l.baseRate || (l.baseRate = l.rate);
            // 永久性加息最多累计 3 次，避免一局游戏里利率被推到荒谬的高度
            if (e.permanent) {
              l.rateHikes = (l.rateHikes || 0);
              if (l.rateHikes >= 3) return;
              l.rateHikes++;
            }
            l.rate = clamp(l.rate * (1 + e.rate), base * 0.5, base * 1.7);
          });
          note = q.liabilities.length ? q.liabilities.length + ' 笔负债利率变动' : '无负债';
          break;
        }
        case 'cash': {
          if (e.mode === 'salary') delta = Math.round(q.salary * e.rate);
          else if (e.mode === 'expenses') {
            if (e.permanent) {
              // 永久性生活成本上升：直接抬高每月支出，影响从此一直存在
              const up = Math.round(q.expenses * e.rate);
              q.expenses += up;
              q.baseExpenses = (q.baseExpenses || 0) + up;
              delta = 0;
              note = '每月生活费 +' + fmt(up) + '（永久）';
            } else {
              delta = -Math.round(q.expenses * Math.abs(e.rate));
              note = '额外支出';
            }
          } else delta = e.value || 0;
          if (e.mode !== 'expenses' || !e.permanent) {
            note = delta >= 0 ? '额外收入' : '额外支出';
          }
          break;
        }
        default:
          note = '无影响';
      }

      q.cash += delta;
      results.push({ p: q, delta: delta, note: note });
    });

    // 日志
    results.forEach(r => {
      if (r.delta === 0 && e.kind !== 'assetValue' && e.kind !== 'liabilityCost') return;
      const cls = r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : 'info';
      const deltaTxt = r.delta === 0 ? '' :
        '（<span class="n ' + cls + '">' + (r.delta > 0 ? '+' : '−') + fmt(Math.abs(r.delta)) + '</span>）';
      U.log('📊 <b>市场风云</b>｜' + ev.icon + ' ' + ev.name + ' → <b>' + r.p.name + '</b> ' +
            r.note + deltaTxt, cls);
    });

    global.SFX.play(ev.type === 'bear' ? 'alert' : 'lucky');
    U.setNews(ev.icon + ' ' + ev.name + '：' + ev.desc, '市场');

    // 破产检查
    for (const r of results) {
      if (r.p.cash < 0) await handleNegativeCash(r.p);
    }

    const human = G.players.find(q => !q.isAI);
    const myResult = results.find(r => r.p === cur());

    await U.modal({
      icon: ev.icon,
      title: '📊 ' + ev.name,
      desc: ev.desc,
      rows: results.map(r => ({
        label: r.p.emoji + ' ' + r.p.name + '　' + r.note,
        value: r.delta === 0 ? (e.kind === 'assetValue' || e.kind === 'liabilityCost' ? '估值变动' : '无变化')
                             : (r.delta > 0 ? '+' : '−') + fmt(Math.abs(r.delta)),
        cls: r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : '',
      })),
      teach: ev.teach,
      auto: human ? 0 : 1700,
    });

    render();
  }

  /* ---------- 意外支出 ---------- */
  async function onAccident(p) {
    const mode = D.MODES[G.mode];
    const card = pick(D.ACCIDENT_CARDS);
    let amount = Math.round(card.amount * mode.accidentMult * (1 + (G.round - 1) * 0.01));
    // 单笔意外支出不超过「一个月总开销」，可预期、可承担，才谈得上学得会
    const ceiling = Math.round((p.expenses + interestOf(p)) * (card.jobLoss ? 1.5 : 1));
    amount = Math.min(amount, ceiling);
    let covered = 0;

    if (card.insurable && p.insured) {
      covered = Math.round(amount * D.INSURANCE_COVER);
      amount = amount - covered;
    }

    p.cash -= amount;
    p.stats.spent += amount;
    global.SFX.play(amount > 0 ? 'alert' : 'lucky');
    const el = document.querySelector('.cell[data-index="' + p.pos + '"]');
    if (amount > 0) U.floatText(el, '−' + fmt(amount), '#0f9d58');

    const rows = [];
    if (covered > 0) {
      rows.push({ label: '总损失', value: '−' + fmt(covered + amount), cls: 'down' });
      rows.push({ label: '☂️ 保险理赔', value: '+' + fmt(covered), cls: 'up' });
    }
    rows.push({ label: '自付金额', value: '−' + fmt(amount), cls: amount > 0 ? 'down' : '', emphasis: amount === 0 });
    rows.push({ label: '剩余现金', value: fmt(Math.max(0, p.cash)) });

    U.log('⚡ <b>' + p.name + '</b> 遇到「' + card.name + '」，' +
          (covered > 0 ? '保险理赔 <span class="n up">' + fmt(covered) + '</span>，' : '') +
          '自付 <span class="n down">' + fmt(amount) + '</span> 元', 'down');

    if (!p.isAI) {
      await U.modal({
        icon: card.icon,
        title: card.name,
        desc: covered > 0 ? '幸好你买了保险，大部分损失由保险公司承担了！' : '意外总会发生，所以要提前准备。',
        rows: rows,
        teach: card.teach,
        auto: 2200,
      });
    }

    if (p.cash < 0) await handleNegativeCash(p);
    render();
  }

  /* ---------- 副业 ---------- */
  async function onPartTime(p) {
    const card = pick(D.PARTTIME_CARDS);
    p.cash += card.amount;
    global.SFX.play('income');
    const el = document.querySelector('.cell[data-index="' + p.pos + '"]');
    U.floatText(el, '+' + fmt(card.amount), '#e0342b');

    U.log('💼 <b>' + p.name + '</b> ' + card.name + '，赚到 <span class="n up">' + fmt(card.amount) + '</span> 元（主动收入）', 'up');

    if (!p.isAI) {
      await U.modal({
        icon: card.icon,
        title: card.name,
        desc: '这是「主动收入」——必须花时间才能赚到。',
        rows: [
          { label: '副业收入', value: '+' + fmt(card.amount), cls: 'up', emphasis: true },
          { label: '当前现金', value: fmt(p.cash) },
        ],
        teach: card.teach,
        auto: 2000,
      });
    }
    render();
  }

  /* ---------- 学习进修 ---------- */
  async function onStudy(p) {
    const offer = pick(D.STUDY_OFFERS);
    const canAfford = p.cash >= offer.cost;
    let go = false;

    if (p.isAI) {
      go = canAfford && aiStudyDecision(p, offer);
    } else {
      const rows = [
        { label: '学费', value: '−' + fmt(offer.cost), cls: 'down' },
      ];
      if (offer.salaryGain) rows.push({ label: '工资永久提升', value: '+' + fmt(offer.salaryGain) + '/月', cls: 'up' });
      if (offer.incomeGain) rows.push({ label: '所有资产收益提升', value: '+' + fmt(offer.incomeGain) + '/月', cls: 'up' });
      if (offer.expenseCut) rows.push({ label: '生活支出降低', value: '−' + fmt(offer.expenseCut) + '/月', cls: 'up' });
      rows.push({ label: '当前工资', value: fmt(p.salary) });
      rows.push({ label: '你的现金', value: fmt(p.cash) });

      const choice = await U.modal({
        icon: offer.icon,
        title: '📚 ' + offer.name,
        desc: offer.desc,
        rows: rows,
        teach: offer.teach,
        options: [
          { label: canAfford ? '📖 去学' : '❌ 现金不足', value: 'yes', primary: true, disabled: !canAfford },
          { label: '算了', value: 'no' },
        ],
      });
      go = choice === 'yes';
    }

    if (!go) {
      if (!p.isAI && !canAfford) U.log('📚 <b>' + p.name + '</b> 想进修，但现金不够', 'info');
      return;
    }

    p.cash -= offer.cost;
    p.stats.spent += offer.cost;
    p.stats.studies++;
    if (offer.salaryGain) p.salary += offer.salaryGain;
    if (offer.incomeGain) p.passive += offer.incomeGain;
    if (offer.expenseCut) {
      p.expenses = Math.max(0, p.expenses - offer.expenseCut);
      p.baseExpenses = Math.max(0, p.baseExpenses - offer.expenseCut);
    }

    global.SFX.play('lucky');
    U.log('📚 <b>' + p.name + '</b> 完成「' + offer.name + '」，' +
          (offer.salaryGain ? '工资提升到 <span class="n up">' + fmt(p.salary) + '/月</span> ' : '') +
          (offer.incomeGain ? '资产收益 <span class="n up">+' + fmt(offer.incomeGain) + '/月</span> ' : '') +
          (offer.expenseCut ? '支出降低 <span class="n up">−' + fmt(offer.expenseCut) + '/月</span>' : ''), 'up');

    if (!p.isAI) {
      await U.modal({
        icon: '🎓', title: '能力提升了！',
        desc: '这是回报率最高的一笔投资——没人能把它拿走。',
        rows: [
          { label: '新工资', value: fmt(p.salary) + '/月', cls: 'up', emphasis: true },
          { label: '月净现金流', value: (ncfOf(p) >= 0 ? '+' : '−') + fmt(Math.abs(ncfOf(p))), cls: ncfOf(p) >= 0 ? 'up' : 'down' },
          { label: '剩余现金', value: fmt(p.cash) },
        ],
        teach: '学习是唯一「不会亏本」的投资。它提高的不只是工资，是你赚钱的能力。',
        auto: 2200,
      });
    }
    render();
  }

  /* ---------- 慈善 ---------- */
  async function onCharity(p) {
    const card = pick(D.CHARITY_CARDS);
    const canAfford = p.cash >= card.amount;
    let give = false;

    if (p.isAI) {
      give = canAfford && aiCharityDecision(p, card);
    } else {
      const choice = await U.modal({
        icon: card.icon,
        title: '💝 ' + card.name,
        desc: '捐出一笔钱，帮助需要帮助的人。你会获得「善缘」——接下来几次移动 +1 步。',
        rows: [
          { label: '捐赠金额', value: '−' + fmt(card.amount), cls: 'down' },
          { label: '善缘奖励', value: '+' + card.steps + ' 次移动加成', cls: 'up' },
          { label: '你的现金', value: fmt(p.cash) },
        ],
        teach: card.teach,
        options: [
          { label: canAfford ? '💝 捐赠' : '❌ 现金不足', value: 'yes', primary: true, disabled: !canAfford },
          { label: '这次算了', value: 'no' },
        ],
      });
      give = choice === 'yes';
    }

    if (!give) return;

    p.cash -= card.amount;
    p.stats.spent += card.amount;
    p.stats.charities++;
    p.charityStreak = card.steps;
    p.charityBonus = 1;

    global.SFX.play('lucky');
    U.log('💝 <b>' + p.name + '</b> ' + card.name + '，捐出 <span class="n down">' + fmt(card.amount) +
          '</span> 元，获得 ' + card.steps + ' 次「善缘 +1 步」', 'gold');

    if (!p.isAI) {
      await U.modal({
        icon: '💝', title: '谢谢你，善良的人',
        desc: '善意的支出，回报不在账本上。',
        teach: card.teach,
        auto: 1900,
      });
    }
    render();
  }

  /* ---------- 银行 ---------- */
  async function onBank(p) {
    const options = [];

    // 1) 存款（利息很低，教育用）
    // 2) 买保险
    // 3) 提前还债
    if (!p.isAI) {
      const acts = [];
      if (!p.insured && p.cash >= D.INSURANCE_COST) {
        acts.push({ label: '☂️ 购买保险（' + fmt(D.INSURANCE_COST) + ' 元）', value: 'ins', primary: false });
      }
      if (p.liabilities.length) {
        acts.push({ label: '🔓 提前还债', value: 'repay', primary: false });
      }
      acts.push({ label: '👋 什么都不做', value: 'none', primary: true });

      const choice = await U.modal({
        icon: '🏦',
        title: '银行',
        desc: '银行可以帮你做三件事：买保险、还负债、或者在有钱时借钱给你。',
        rows: [
          { label: '现金', value: fmt(p.cash) },
          { label: '总负债', value: p.liabilities.length ? '−' + fmt(totalDebt(p)) : '0', cls: p.liabilities.length ? 'down' : '' },
          { label: '每月利息支出', value: '−' + fmt(interestOf(p)), cls: 'down' },
        ],
        teach: '银行是最会算账的机构。它借钱给你收利息，你的钱存进去利息却很少——<b>方向一定要搞对</b>。',
        options: acts,
      });

      if (choice === 'ins') {
        p.cash -= D.INSURANCE_COST;
        p.insured = true;
        global.SFX.play('buy');
        U.log('☂️ <b>' + p.name + '</b> 购买了保险，意外支出可获 ' + Math.round(D.INSURANCE_COVER * 100) + '% 理赔', 'up');
        await U.modal({
          icon: '☂️', title: '保险已生效',
          desc: '每年花一点点钱，把「大风险」转嫁给保险公司。',
          teach: '保险不是投资，是「减少人生波动」的工具。它不让你变富，但它防止你一次回到起点。',
          auto: 1900,
        });
      } else if (choice === 'repay') {
        await openRepayPanel(p);
      }
      render();
      return;
    }

    // AI：优先还债，然后买保险
    let acted = false;
    if (p.liabilities.length && p.persona.debtRepay > 0) {
      const amt = aiDebtDecision(p);
      if (amt > 0) {
        for (const l of p.liabilities.slice()) {
          await repayDebt(p, l.id, amt);
        }
        acted = true;
        U.log('🏦 <b>' + p.name + '</b> 在银行提前还了一部分负债', 'info');
      }
    }
    if (!acted && !p.insured && p.cash > D.INSURANCE_COST * 4) {
      p.cash -= D.INSURANCE_COST;
      p.insured = true;
      U.log('☂️ <b>' + p.name + '</b> 购买了保险', 'info');
    }
    render();
  }

  /* ---------- 梦想之角 ---------- */
  async function onLandmark(p) {
    const dream = pick(D.DREAMS);
    const canAfford = p.cash >= dream.cost;
    let buy = false;

    if (p.isAI) {
      // 电脑只在现金充裕时实现梦想
      buy = canAfford && (p.cash - dream.cost) > p.persona.reserve * (p.expenses + interestOf(p)) * 2;
    } else {
      const choice = await U.modal({
        icon: dream.icon,
        title: '🌈 梦想之角 · ' + dream.name,
        desc: dream.desc,
        rows: [
          { label: '梦想价格', value: '−' + fmt(dream.cost), cls: 'down' },
          { label: '实现后奖励', value: '+' + fmt(D.DREAM_BONUS), cls: 'up' },
          { label: '你的现金', value: fmt(p.cash) },
        ],
        teach: '理财从来不是「省钱」本身，而是为了<b>买得起真正想要的东西</b>。有目标的存钱，才有动力。',
        options: [
          { label: canAfford ? '🌟 实现它！' : '❌ 还差 ' + fmt(dream.cost - p.cash), value: 'yes', primary: true, disabled: !canAfford },
          { label: '再攒攒', value: 'no' },
        ],
      });
      buy = choice === 'yes';
    }

    if (!buy) {
      if (!p.isAI && !canAfford) U.log('🌈 <b>' + p.name + '</b> 在梦想之角看了看「' + dream.name + '」，还差 ' + fmt(dream.cost - p.cash) + ' 元', 'info');
      return;
    }

    p.cash -= dream.cost;
    p.cash += D.DREAM_BONUS;
    p.stats.dreams++;
    global.SFX.play('win');
    U.log('🌈 <b>' + p.name + '</b> 实现了梦想「' + dream.name + '」！花费 <span class="n down">' + fmt(dream.cost) +
          '</span>，获得鼓励金 <span class="n up">+' + fmt(D.DREAM_BONUS) + '</span>', 'gold');

    if (!p.isAI) {
      await U.modal({
        icon: '🌟',
        title: '梦想实现：' + dream.name,
        desc: '这就是理财的意义——不是为了数字，是为了你想要的生活。',
        rows: [
          { label: '花费', value: '−' + fmt(dream.cost), cls: 'down' },
          { label: '梦想鼓励金', value: '+' + fmt(D.DREAM_BONUS), cls: 'up' },
          { label: '当前现金', value: fmt(p.cash) },
        ],
        teach: '有梦想的存钱，叫「目标储蓄」；没有目标的存钱，往往存不下来。',
      });
    }
    render();
  }

  /* ======================================================================
     财务自由判定
     ====================================================================== */
  function checkFreedom(p) {
    if (G.over) return false;
    if (p.bankrupt) return false;
    if (p.passive > 0 && p.passive >= p.expenses) {
      G.over = true;
      p.freedomRound = G.round;
      global.SFX.play('win');
      U.log('🎊 <b>' + p.name + '</b> 实现财务自由！被动收入 <span class="n up">' + fmt(p.passive) +
            '</span> ≥ 生活费 <span class="n">' + fmt(p.expenses) + '</span>', 'win');
      U.setNews('🎊 ' + p.emoji + ' ' + p.name + ' 实现财务自由！', '恭喜');
      checkBadges(p);
      setTimeout(() => endGame(p), 900);
      return true;
    }
    return false;
  }

  /* ======================================================================
     回合推进
     ====================================================================== */
  function nextTurn() {
    if (G.over) return;

    // 找下一个可行动的玩家
    let guard = 0;
    do {
      G.cur = (G.cur + 1) % G.players.length;
      if (G.cur === 0) {
        G.round++;
        tickInflation();
        recordHistory();
        if (D.MODES[G.mode].maxRounds && G.round > D.MODES[G.mode].maxRounds) {
          return endGameByNetWorth('回合数已满');
        }
      }
      guard++;
    } while (G.players[G.cur].bankrupt && guard < G.players.length * 2);

    G.busy = false;
    U.clearHighlight();
    global.SFX.play('turn');
    render();

    const p = cur();
    if (p && p.isAI) {
      setTimeout(doRoll, 900);
    }
  }

  function recordHistory() {
    G.history.push(G.players.map(p => ({ name: p.name, color: p.color, netWorth: p.netWorth, passive: p.passive })));
  }

  /* ======================================================================
     渲染
     ====================================================================== */
  function render() {
    const p = cur();

    U.renderTokens(G.players);
    U.renderPlayers(G.players, {
      cur: G.cur,
      over: G.over,
      showActions: !!(p && !p.isAI && !G.over && !G.busy),
      doneSet: [],
    }, onPlayerAction);

    U.setTopStats({
      round: G.round,
      inflation: D.MODES[G.mode].inflation,
      limit: D.MODES[G.mode].maxRounds ? Math.max(0, D.MODES[G.mode].maxRounds - G.round + 1) : null,
      debt: p ? totalDebt(p) : 0,
    });

    U.setText('subLabel', '模式：' + D.MODES[G.mode].icon + ' ' + D.MODES[G.mode].name +
      (p ? '　·　当前：' + p.emoji + ' ' + p.name : ''));

    const badge = document.getElementById('turnBadge');
    if (badge) {
      if (G.over) { badge.textContent = '已结束'; }
      else if (!p) { badge.textContent = '准备中'; }
      else if (p.isAI) { badge.textContent = p.emoji + ' ' + p.name + ' 思考中…'; }
      else { badge.textContent = '轮到你了'; }
    }

    renderReport();
    renderCenterConsole();
  }

  function renderCenterConsole() {
    const el = document.getElementById('boardCenter');
    if (!el) return;
    const p = cur();
    if (!p) return;

    const canRoll = !G.over && !G.busy && !p.isAI;
    const prog = Math.min(100, (p.passive / Math.max(1, p.expenses)) * 100);

    const mini = G.players.map((q, i) =>
      '<span class="mini-chip' + (i === G.cur && !G.over ? ' active' : '') + '" style="--mc:' + q.color + '">' +
        q.emoji + ' ' + fmt(q.passive) + '</span>'
    ).join('');

    el.innerHTML =
      '<div class="turn-label">' + (G.over ? '游戏结束' : '当前回合') + '</div>' +
      '<div class="turn-player" style="color:' + p.color + '">' + p.emoji + ' ' + esc(p.name) + '</div>' +
      '<div class="turn-sub">' +
        (G.over ? '本局已结束'
          : p.isAI ? p.persona.icon + ' ' + p.persona.name + ' 正在思考…'
          : '被动收入 ' + fmt(p.passive) + ' / 生活费 ' + fmt(p.expenses)) +
      '</div>' +
      '<div class="dice-stage" id="diceStage"></div>' +
      '<div class="turn-sub" id="diceValue" style="font-variant-numeric:tabular-nums">　</div>' +
      '<button class="btn-roll' + (canRoll ? ' pulse' : '') + '" id="rollBtn"' +
        (canRoll ? '' : ' disabled') + '>' +
        (G.over ? '🏁 已结束' : p.isAI ? '🤖 电脑回合' : G.busy ? '⏳ 行动中' : '🎲 掷骰子') +
      '</button>' +
      '<div class="center-teach" id="centerTeach"></div>' +
      '<div class="center-mini">' + mini + '</div>';

    U.buildDice();
    U.diceTo(1);

    const btn = document.getElementById('rollBtn');
    if (btn) btn.addEventListener('click', doRoll);

    setTip();
  }

  let tipTimer = null;
  function setTip() {
    const el = document.getElementById('centerTeach');
    if (!el) return;
    const show = () => {
      el.textContent = '💡 ' + pick(D.TIPS);
      el.style.opacity = '1';
    };
    show();
    if (tipTimer) clearInterval(tipTimer);
    tipTimer = setInterval(() => {
      el.style.opacity = '0';
      setTimeout(show, 320);
    }, 9000);
  }

  /* ---------- 报表渲染 ---------- */
  let reportTab = 'cashflow';
  let reportPlayer = 0;

  function renderReport() {
    const body = document.getElementById('reportBody');
    if (!body) return;

    // 玩家切换栏
    let switcher = document.getElementById('reportSwitcher');
    if (!switcher) {
      switcher = document.createElement('div');
      switcher.id = 'reportSwitcher';
      switcher.style.cssText = 'display:flex;gap:4px;padding:8px 12px 0;flex-wrap:wrap';
      body.parentNode.insertBefore(switcher, body);
    }
    switcher.innerHTML = G.players.map((p, i) =>
      '<button class="btn btn-sm ' + (i === reportPlayer ? 'btn-primary' : 'btn-soft') + '" data-rp="' + i + '">' +
        p.emoji + ' ' + esc(p.name) + '</button>'
    ).join('');
    switcher.querySelectorAll('[data-rp]').forEach(b => {
      b.onclick = () => { reportPlayer = parseInt(b.dataset.rp, 10); renderReport(); };
    });

    const p = G.players[reportPlayer];
    if (!p) { body.innerHTML = ''; return; }

    let html = '';
    if (reportTab === 'cashflow') {
      const cf = R.cashflowRows(p);
      html = R.renderTable(cf.rows);
      html += '<div style="padding:10px 12px;font-size:11px;color:#6b7a90;font-weight:700;border-top:1px solid #eef2f7">' +
        '💡 净现金流为' + (cf.ncf >= 0 ? '正' : '负') + '：' +
        (cf.ncf >= 0
          ? '每月能存下 <b style="color:#e0342b">' + fmt(cf.ncf) + '</b> 元，可以拿去继续买资产。'
          : '每月都在吃老本 <b style="color:#0f9d58">' + fmt(Math.abs(cf.ncf)) + '</b> 元，需要减少支出或增加收入。') +
        '</div>';
    } else {
      const bs = R.balanceRows(p);
      html = R.renderTable(bs.rows);
      html += '<div style="padding:10px 12px;font-size:11px;color:#6b7a90;font-weight:700;border-top:1px solid #eef2f7">' +
        '💡 净资产 = 资产 − 负债 = <b style="color:#4f6ef7">' + fmt(bs.netWorth) + '</b> 元。' +
        '这是你真正拥有的财富。' +
        '</div>';
    }

    body.innerHTML = html;
  }

  /* ---------- 玩家操作（明细 / 卖资产 / 还债） ---------- */
  async function onPlayerAction(act, idx) {
    const p = G.players[idx];
    if (!p) return;
    global.SFX.play('click');

    if (act === 'detail') {
      const cf = R.cashflowRows(p);
      const bs = R.balanceRows(p);
      await U.modal({
        wide: true,
        icon: p.emoji,
        title: p.name + ' 的财务明细',
        desc: p.careerIcon + ' ' + p.careerName + '　·　已进行 ' + G.round + ' 回合',
        html:
          '<div style="display:grid;gap:14px;text-align:left">' +
            '<div>' +
              '<div style="font-size:11px;font-weight:900;color:#4f6ef7;letter-spacing:1px;margin-bottom:6px">📊 收支表</div>' +
              R.renderTable(cf.rows) +
            '</div>' +
            '<div>' +
              '<div style="font-size:11px;font-weight:900;color:#4f6ef7;letter-spacing:1px;margin-bottom:6px">🏛️ 资产负债表</div>' +
              R.renderTable(bs.rows) +
            '</div>' +
          '</div>',
        teach: '会看这两张表，你就掌握了理财的「体检报告」。',
      });
      return;
    }

    if (act === 'sell') {
      await openSellPanel(p);
      render();
      return;
    }

    if (act === 'repay') {
      await openRepayPanel(p);
      render();
      return;
    }
  }

  async function openSellPanel(p) {
    if (!p.assets.length) {
      await U.modal({ icon: '📭', title: '没有可卖的资产', desc: '先买点资产吧。', auto: 1500 });
      return;
    }
    const cards = p.assets.map(a => ({
      id: a.id,
      icon: a.icon,
      name: a.name,
      desc: '原价 ' + fmt(a.cost) + '　·　卖价约为 ' + fmt(Math.round(a.value * 0.9)) + '　·　月收益 ' + fmt(a.income),
      cost: '≈ ' + fmt(Math.round(a.value * 0.9)),
      income: '−' + fmt(a.income) + '/月',
      incomeBad: true,
    }));
    const chosen = await U.modal({
      wide: true,
      icon: '💱',
      title: '卖出资产（回笼现金）',
      desc: '卖出后现金会回来，但每月的被动收入也会减少。想清楚再决定。',
      cards: cards,
      teach: '被动收入是「会下蛋的鸡」。卖资产就是杀鸡取卵——除非你急需用钱，或者发现了更好的机会。',
      options: [{ label: '取消', value: null }],
    });
    if (!chosen) return;

    const a = p.assets.find(x => x.id === chosen);
    if (!a) return;
    const price = Math.round(a.value * 0.9);
    const gain = price - a.cost;
    const yes = await U.modal({
      icon: a.icon,
      title: '确认卖出 ' + a.name + '？',
      desc: '卖出后它带来的被动收入会消失。',
      rows: [
        { label: '回收现金', value: '+' + fmt(price), cls: 'up' },
        { label: '失去月收入', value: '−' + fmt(a.income), cls: 'down' },
        { label: '这笔投资盈亏', value: (gain >= 0 ? '+' : '−') + fmt(Math.abs(gain)), cls: gain >= 0 ? 'up' : 'down', emphasis: true },
      ],
      options: [
        { label: '确认卖出', value: 'yes', primary: true },
        { label: '再想想', value: 'no' },
      ],
    });
    if (yes !== 'yes') return;

    removeAsset(p, a.id);
    p.cash += price;
    p.stats.sold++;
    global.SFX.play('sell');
    U.log('💱 <b>' + p.name + '</b> 卖出 ' + a.icon + ' <b>' + a.name + '</b>，收回 <span class="n up">' + fmt(price) + '</span>', 'up');
  }

  async function openRepayPanel(p) {
    if (!p.liabilities.length) {
      await U.modal({ icon: '🎉', title: '你没有负债', desc: '无债一身轻！把现金拿去买资产吧。', auto: 1600 });
      return;
    }
    const cards = p.liabilities.map(l => ({
      id: l.id,
      icon: l.icon,
      name: l.name,
      desc: '欠款 ' + fmt(l.balance) + '　·　月利率 ' + (l.rate * 100).toFixed(1) +
            '%　·　每月利息 ' + fmt(l.balance * l.rate) + ' 元',
      cost: '欠 ' + fmt(l.balance),
      income: '月息 −' + fmt(l.balance * l.rate),
      incomeBad: true,
      disabled: p.cash <= 0,
    }));
    const chosen = await U.modal({
      wide: true,
      icon: '🔓',
      title: '偿还负债',
      desc: '还掉负债，每月的利息支出就少了，净现金流立刻变好。',
      cards: cards,
      teach: '还掉一笔 15% 利率的债，等于稳稳赚了 15%——比大多数投资都划算。',
      options: [{ label: '取消', value: null }],
    });
    if (!chosen) return;

    const l = p.liabilities.find(x => x.id === chosen);
    if (!l) return;

    const maxPay = Math.min(l.balance, p.cash);
    const choice = await U.modal({
      icon: l.icon,
      title: '还给「' + l.name + '」多少钱？',
      desc: '你的现金：' + fmt(p.cash) + ' 元',
      rows: [
        { label: '欠款总额', value: fmt(l.balance), cls: 'down' },
        { label: '可用现金', value: fmt(p.cash) },
        { label: '每月利息', value: '−' + fmt(l.balance * l.rate), cls: 'down' },
      ],
      options: [
        { label: '💰 全部还清（' + fmt(maxPay) + '）', value: 'all', primary: true, disabled: maxPay <= 0 },
        { label: '还一半', value: 'half', disabled: maxPay <= 0 },
        { label: '取消', value: null },
      ],
      teach: '优先还清利率最高的负债，这是理财里最「稳赚不赔」的操作之一。',
    });

    if (!choice) return;
    const pay = choice === 'all' ? maxPay : (choice === 'half' ? Math.floor(maxPay / 2) : 0);
    if (pay <= 0) return;

    const paid = await repayDebt(p, l.id, pay);
    global.SFX.play('expense');
    U.log('🔓 <b>' + p.name + '</b> 偿还「' + l.name + '」<span class="n down">' + fmt(paid) + '</span> 元', 'info');

    await U.modal({
      icon: '🔓',
      title: '还款成功',
      desc: '负债变少了，每月的利息支出也跟着减少。',
      rows: [
        { label: '还款金额', value: '−' + fmt(paid), cls: 'down' },
        { label: '剩余欠款', value: fmt(Math.max(0, l.balance)) },
        { label: '月净现金流', value: (ncfOf(p) >= 0 ? '+' : '−') + fmt(Math.abs(ncfOf(p))), cls: ncfOf(p) >= 0 ? 'up' : 'down' },
      ],
      teach: '每次还债，都是在给未来的自己「涨工资」。',
      auto: 1900,
    });
  }

  /* ======================================================================
     结束游戏
     ====================================================================== */
  function rankPlayers() {
    return G.players.slice().sort((a, b) => {
      if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
      // 先看有没有达成自由、谁更快达成
      const af = a.passive >= a.expenses && a.passive > 0 && !a.bankrupt;
      const bf = b.passive >= b.expenses && b.passive > 0 && !b.bankrupt;
      if (af !== bf) return af ? -1 : 1;
      if (af && bf && (a.freedomRound || 999) !== (b.freedomRound || 999)) {
        return (a.freedomRound || 999) - (b.freedomRound || 999);
      }
      // 都没自由 → 比「距离自由的进度」，最后才看净资产
      const ap = a.expenses > 0 ? a.passive / a.expenses : 0;
      const bp = b.expenses > 0 ? b.passive / b.expenses : 0;
      if (Math.abs(ap - bp) > 0.02) return bp - ap;
      return b.netWorth - a.netWorth;
    });
  }

  function endGame(winner) {
    G.over = true;
    G.busy = false;
    const ranked = rankPlayers();
    showResult(winner, ranked, false);
  }

  function endGameByNetWorth(reason) {
    G.over = true;
    G.busy = false;
    // 回合上限到达时，用「距离财务自由的进度」排序，
    // 而不是净资产——因为本作想教的是现金流，不是比谁更富。
    const ranked = rankPlayers();
    const free = ranked.filter(p => !p.bankrupt && p.passive >= p.expenses && p.passive > 0);
    const byFreedom = freedomProgressOf(ranked[0]);
    showResult(free[0] || ranked[0], ranked, !free.length, reason, byFreedom);
  }

  const freedomProgressOf = p => (p.expenses > 0 ? p.passive / p.expenses : 0);

  function showResult(winner, ranked, byNetWorth, reason, byFreedom) {
    const sc = document.getElementById('resultScreen');
    const card = document.getElementById('resultCard');

    const human = G.players.filter(p => !p.isAI);
    const humanWon = winner && !winner.isAI;
    const anyoneFree = G.players.some(p => !p.bankrupt && p.passive >= p.expenses && p.passive > 0);

    const ranks = ranked.map((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
      const done = p.passive >= p.expenses && p.passive > 0 && !p.bankrupt;
      const pct = Math.round(freedomProgressOf(p) * 100);
      const sub = p.bankrupt
        ? '💔 破产 · 欠款 ' + fmt(totalDebt(p))
        : done
          ? '🏆 财务自由 · 第 ' + (p.freedomRound || '?') + ' 回合'
          : '被动 ' + fmt(p.passive) + ' / 生活费 ' + fmt(p.expenses) + '（自由进度 ' + pct + '%）';
      return '<div class="rank-row' + (i === 0 ? ' first' : '') + '" style="--rc:' + p.color + '">' +
        '<div class="rr-pos">' + medal + '</div>' +
        '<div class="rr-name">' +
          '<b>' + p.emoji + ' ' + esc(p.name) + (p.isAI ? ' <span style="font-size:10px;color:#94a3b8">（电脑）</span>' : '') + '</b>' +
          '<span>' + sub + '</span>' +
        '</div>' +
        '<div class="rr-val">' + fmt(p.netWorth) + '<small>净资产</small></div>' +
      '</div>';
    }).join('');

    const top = winner || ranked[0];

    // 每个玩家一句针对性点评，比笼统的「你学到了什么」有用得多
    const advice = p => {
      const burn = p.expenses + interestOf(p);
      if (p.bankrupt) return '💔 破产了。原因通常不是赚得少，而是欠得多、现金流太紧。';
      if (p.passive >= p.expenses && p.passive > 0) return '🏆 被动收入盖住了生活费，你自由了。';
      if (interestOf(p) > p.salary * 0.15) return '⚠️ 利息吃掉你工资的 ' + Math.round(interestOf(p) / p.salary * 100) + '%。先还高息负债，比买新资产更划算。';
      if (p.cash < burn * 2) return '⚠️ 应急基金不到 2 个月开销，一次意外就可能被迫折价卖资产。';
      if (p.passive === 0) return '💡 一整局没买任何资产。工资再高也只是主动收入，停了就没有了。';
      return '📈 现金流还算稳，下一步是让被动收入追上生活费（当前 ' + Math.round(freedomProgressOf(p) * 100) + '%）。';
    };

    const playerAdvice = G.players.map(p =>
      '<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px dashed var(--line)">' +
        '<div style="flex:0 0 auto;font-size:15px">' + p.emoji + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:800;font-size:12px">' + esc(p.name) + '　<span style="color:#94a3b8;font-weight:600">' + esc(p.careerName) + '</span></div>' +
          '<div style="font-size:11.5px;line-height:1.55;color:var(--text-2);margin-top:2px">' + advice(p) + '</div>' +
        '</div>' +
      '</div>').join('');

    const title = byNetWorth
      ? '回合结束 · 自由进度排名'
      : (humanWon ? '恭喜你，实现财务自由！' : top.emoji + ' ' + esc(top.name) + ' 率先自由了！');

    card.innerHTML =
      '<div class="result-medal">' + (byNetWorth ? '📊' : '🏆') + '</div>' +
      '<h2 class="result-title">' + title + '</h2>' +
      '<p class="result-sub">' +
        (byNetWorth
          ? (reason || '回合数已满') + '。这一局没有人达成财务自由——' +
            (anyoneFree ? '' : '这很正常，它说明「被动收入追上生活费」真的不容易。') +
            ' 下面按「自由进度」排名，而不是按谁最有钱。'
          : '当被动收入 ≥ 生活支出，你就再也不用为了钱而工作了。') +
      '</p>' +

      '<div class="result-stats">' +
        '<div class="rstat"><div class="k">共进行回合</div><div class="v">' + G.round + '</div></div>' +
        '<div class="rstat"><div class="k">你的净资产</div><div class="v ' + (human[0] && human[0].netWorth >= 0 ? 'up' : 'down') + '">' +
          fmt(human[0] ? human[0].netWorth : 0) + '</div></div>' +
        '<div class="rstat"><div class="k">你的自由进度</div><div class="v ' + (human[0] && freedomProgressOf(human[0]) >= 1 ? 'up' : '') + '">' +
          (human[0] ? Math.round(freedomProgressOf(human[0]) * 100) : 0) + '%</div></div>' +
      '</div>' +

      '<div style="font-size:11px;font-weight:900;color:#94a3b8;letter-spacing:1.2px;text-align:left;margin-bottom:8px">最终排名</div>' +
      '<div class="rank-list">' + ranks + '</div>' +

      '<div class="teach" style="margin-bottom:12px">' +
        '<div class="t-icon">🧭</div>' +
        '<div class="t-body">' +
          '<div class="t-title">逐一点评</div>' +
          '<div class="t-text">' + playerAdvice + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="teach" style="margin-bottom:16px">' +
        '<div class="t-icon">🎓</div>' +
        '<div class="t-body">' +
          '<div class="t-title">这一局你学到了什么</div>' +
          '<div class="t-text">' +
            '① 资产把钱放进口袋，负债把钱从口袋拿走；<br>' +
            '② 现金流是水管，净资产是水池——先让水管变粗；<br>' +
            '③ 还掉高息负债，等于稳赚不赔的投资；<br>' +
            '④ 应急基金 + 保险，让你扛得住意外；<br>' +
            '⑤ 财务自由的公式：<b>被动收入 ≥ 生活支出</b>。' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="result-actions">' +
        '<button class="btn btn-primary" id="btnPlayAgain">🔄 再来一局</button>' +
        '<button class="btn btn-soft" id="btnBackHome">🏠 返回设置</button>' +
      '</div>';

    sc.classList.remove('hidden');
    global.SFX.play(byNetWorth ? 'info' : 'win');

    document.getElementById('btnPlayAgain').onclick = () => {
      sc.classList.add('hidden');
      restartSameConfig();
    };
    document.getElementById('btnBackHome').onclick = () => {
      sc.classList.add('hidden');
      backToSetup();
    };
  }

  /* ======================================================================
     存档
     ====================================================================== */
  const SAVE_KEY = 'cashflow_kids_save_v1';

  function serialize() {
    return {
      v: 1,
      mode: G.mode,
      cur: G.cur,
      round: G.round,
      over: G.over,
      badgeSet: Array.from(G.badgeSet),
      cfg: G.cfg,
      players: G.players.map(p => ({
        name: p.name, emoji: p.emoji, color: p.color, isAI: p.isAI,
        personaId: p.persona.id,
        careerId: p.careerId, careerName: p.careerName, careerIcon: p.careerIcon,
        cash: p.cash, salary: p.salary, expenses: p.expenses, baseExpenses: p.baseExpenses,
        passive: p.passive, pos: p.pos, laps: p.laps,
        assets: p.assets, liabilities: p.liabilities,
        badges: p.badges, stats: p.stats,
        insured: p.insured, charityStreak: p.charityStreak, charityBonus: p.charityBonus,
        bankrupt: p.bankrupt, freedomRound: p.freedomRound,
      })),
    };
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(serialize()));
      return true;
    } catch (e) { return false; }
  }

  function hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      restore(s);
      return true;
    } catch (e) { return false; }
  }

  function restore(s) {
    G.mode = s.mode;
    G.cells = D.buildBoard();
    G.badgeSet = new Set(s.badgeSet || []);
    G.cfg = s.cfg;
    G.cur = s.cur;
    G.round = s.round;
    G.over = !!s.over;
    G.busy = false;
    G.history = [];

    G.players = s.players.map((sp, i) => {
      const persona = D.AI_PERSONAS.find(x => x.id === sp.personaId) || D.AI_PERSONAS[0];
      const p = {
        id: i,
        name: sp.name, emoji: sp.emoji, color: sp.color, isAI: sp.isAI,
        persona: persona,
        careerId: sp.careerId, careerName: sp.careerName, careerIcon: sp.careerIcon,
        cash: sp.cash, salary: sp.salary, expenses: sp.expenses, baseExpenses: sp.baseExpenses || sp.expenses,
        passive: sp.passive, pos: sp.pos, laps: sp.laps || 0,
        assets: sp.assets || [], liabilities: sp.liabilities || [],
        badges: sp.badges || [], stats: sp.stats || {},
        insured: !!sp.insured, charityStreak: sp.charityStreak || 0, charityBonus: sp.charityBonus || 0,
        bankrupt: !!sp.bankrupt, freedomRound: sp.freedomRound,
      };
      Object.defineProperty(p, 'netWorth', {
        get() {
          const a = this.cash + this.assets.reduce((s, x) => s + x.value, 0);
          const l = this.liabilities.reduce((s, x) => s + x.balance, 0);
          return a - l;
        },
      });
      return p;
    });
  }

  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }

  /* ======================================================================
     生命周期
     ====================================================================== */
  /* 用同一套配置重开一局：AI 人格 / 职业可以重新随机，玩家名字保留 */
  function restartSameConfig() {
    const cfg = G.cfg || {};
    const players = (cfg.players || []).map(pc => Object.assign({}, pc));
    // 电脑玩家重新抽职业和人格，避免每局都一样
    players.forEach(pc => {
      if (pc.isAI) {
        pc.career = pick(D.CAREERS);
        pc.persona = pick(D.AI_PERSONAS);
      }
    });
    clearSave();
    startGame({ mode: cfg.mode || G.mode, players: players });
  }

  /* 回到设置界面，让玩家重新选人数 / 难度 / 职业 */
  function backToSetup() {
    G.over = true;
    G.busy = false;
    clearSave();
    document.getElementById('resultScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('setupScreen').classList.remove('hidden');
    if (global.CashflowKids && typeof global.CashflowKids.renderSetup === 'function') {
      global.CashflowKids.renderSetup();
    } else {
      global.location.reload();
    }
  }

  function startGame(cfg) {
    G.cells = D.buildBoard();
    G.mode = cfg.mode || 'normal';
    G.cfg = cfg;
    G.cur = 0;
    G.round = 1;
    G.busy = false;
    G.over = false;
    G.badgeSet = new Set();
    G.history = [];

    G.players = cfg.players.map((pc, i) => createPlayer(pc, i));

    // 渲染静态部分
    U.buildBoard(G.cells, onCellClick);
    U.renderBadges(D.BADGES, G.badgeSet);
    U.clearLog();
    U.setTopStats({
      round: 1, inflation: D.MODES[G.mode].inflation,
      limit: D.MODES[G.mode].maxRounds || null, debt: 0,
    });

    document.getElementById('setupScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    document.getElementById('resultScreen').classList.add('hidden');

    U.log('🎬 <b>游戏开始！</b>模式：' + D.MODES[G.mode].icon + ' ' + D.MODES[G.mode].name +
          '　目标：让<b>被动收入 ≥ 生活费</b>', 'gold');
    G.players.forEach(p => {
      U.log(p.emoji + ' <b>' + p.name + '</b>（' + p.careerIcon + ' ' + p.careerName + '）起始工资 ' +
            '<span class="n">' + fmt(p.salary) + '</span>，生活费 <span class="n">' + fmt(p.expenses) +
            '</span>，现金 <span class="n">' + fmt(p.cash) + '</span>' +
            (p.liabilities.length ? '，负债 <span class="n down">' + fmt(totalDebt(p)) + '</span>' : ''), 'info');
    });

    render();

    const first = cur();
    if (first && first.isAI) setTimeout(doRoll, 1100);

    return true;
  }

  async function onCellClick(idx) {
    const cell = G.cells[idx];
    if (!cell) return;
    const descriptions = {
      start: '🏁 <b>起点</b>：每绕行一圈，可领取完成奖励。',
      bank: '🏦 <b>银行</b>：可以买保险、提前还债，也是你现金不足时的最后靠山。',
      salary: '💰 <b>领工资格</b>：走到或路过这里，结算一次月度现金流。',
      small: '💡 <b>小机会</b>：用小钱买入起步型资产，建立你的第一条被动收入。',
      big: '🏗️ <b>大机会</b>：不动产与大生意，可用杠杆撬动更大的现金流。',
      spend: '🛍️ <b>消费</b>：分清「需要」和「想要」，这是理财第一课。',
      market: '📊 <b>市场风云</b>：宏观事件，影响所有玩家的资产与负债。',
      accident: '⚡ <b>意外支出</b>：生活的不确定性。应急基金和保险派上用场。',
      parttime: '💼 <b>副业</b>：用时间换钱，是主动收入。',
      study: '📚 <b>学习进修</b>：花学费提高工资，回报率最高的一笔投资。',
      charity: '💝 <b>慈善捐赠</b>：给予让你获得善缘，也让你更懂钱的意义。',
      landmark: '🌈 <b>梦想之角</b>：理财的终点不是数字，是你真正想要的生活。',
    };
    U.modal({
      icon: cell.icon,
      title: cell.name,
      desc: descriptions[cell.type] || '',
      auto: 2600,
    });
  }

  function cur() { return G.players[G.cur]; }

  /* ======================================================================
     导出
     ====================================================================== */
  global.Game = {
    G, startGame, doRoll,
    render, renderReport,
    save, load, hasSave, clearSave, serialize,
    setReportTab: t => { reportTab = t; renderReport(); },
    getReportTab: () => reportTab,
    rankPlayers, endGameByNetWorth, restartSameConfig, backToSetup,
    interestOf, totalDebt, totalAssetValue, ncfOf, monthsOfRunway,
    createPlayer,
  };

})(window);
