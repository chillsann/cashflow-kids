/* ==========================================================================
   现金流小富翁 v2 · 梦想小镇 — 世界数据层
   40 格环形地图（15列×7行外圈）· 6 位角色 · 平衡常量
   全部内容数据驱动：老师/家长改这一个文件即可调整游戏内容
   ========================================================================== */
(function (global) {
  'use strict';

  /* ======================================================================
     一、棋盘几何：15 列 × 7 行，外圈 40 格，顺时针
     ====================================================================== */
  const COLS = 15, ROWS = 7;

  /* 与 v1 相同的程序化环形坐标：从左上角出发，顶边→右边→底边→左边 */
  function ringCoord(i) {
    const ring = [];
    for (let c = 1; c <= COLS; c++) ring.push({ col: c, row: 1 });            // 顶边（左→右）i: 0..14
    for (let r = 2; r <= ROWS; r++) ring.push({ col: COLS, row: r });         // 右边（上→下）i: 15..19
    for (let c = COLS - 1; c >= 1; c--) ring.push({ col: c, row: ROWS });     // 底边（右→左）i: 20..34
    for (let r = ROWS - 1; r >= 2; r--) ring.push({ col: 1, row: r });        // 左边（下→上）i: 35..39
    return ring[i % ring.length];
  }

  /* ======================================================================
     二、街区（垄断 = 集齐同街区全部地块 → 租金翻倍）
     ====================================================================== */
  const DISTRICTS = {
    breakfast: { id: 'breakfast', name: '早餐街',  color: '#f5b748', icon: '🍞' },
    candy:     { id: 'candy',     name: '糖果巷',  color: '#ef7fa8', icon: '🍬' },
    dessert:   { id: 'dessert',   name: '甜点路',  color: '#b07de0', icon: '🎂' },
    milktea:   { id: 'milktea',   name: '奶茶湾',  color: '#e8813a', icon: '🧋' },
    beach:     { id: 'beach',     name: '海滩区',  color: '#2ea6c9', icon: '🏖️' },
    funfair:   { id: 'funfair',   name: '游乐城',  color: '#4f6ef7', icon: '🎡' },
    jewel:     { id: 'jewel',     name: '珠宝坊',  color: '#17a673', icon: '💎' },
    star:      { id: 'star',      name: '星光大道', color: '#d9552b', icon: '🌟' },
  };

  /* ======================================================================
     三、40 格地图定义
     地产租金表：[空地搭棚, L1小屋, L2洋房, L3大厦, L4酒店]
     租金 ≈ 地价的 [6%, 11%, 24%, 42%, 68%]，垄断时 ×2
     ====================================================================== */
  const rentOf = price => [
    Math.round(price * 0.06), Math.round(price * 0.11), Math.round(price * 0.24),
    Math.round(price * 0.42), Math.round(price * 0.68),
  ];

  const E = (i, district, name, icon, price) => ({
    i, type: 'estate', district, name, icon,
    price, rent: rentOf(price), buildCost: Math.round(price * 0.5),
    owner: null, level: 0, mortgaged: false,
  });

  const MAP = [
    { i: 0,  type: 'start',    name: '起点',   icon: '🚩', desc: '经过或停驻都能领取津贴，停驻翻倍！' },      // 左上角
    E(1,  'breakfast', '豆浆街',   '🥛', 3000),
    { i: 2,  type: 'chance',   name: '命运',   icon: '🎴', desc: '命运的齿轮开始转动……' },
    E(3,  'breakfast', '包子巷',   '🥟', 3000),
    E(4,  'breakfast', '油条路',   '🌯', 4000),
    { i: 5,  type: 'news',     name: '新闻',   icon: '📰', desc: '小镇大事，全体玩家都会受影响！' },
    E(6,  'candy',     '棒棒糖街', '🍭', 4000),
    { i: 7,  type: 'shop',     name: '道具店', icon: '🏪', desc: '用现金购买功能卡片。' },
    E(8,  'candy',     '棉花糖巷', '🍬', 5000),
    { i: 9,  type: 'lottery',  name: '乐透站', icon: '🎰', desc: '买一张彩票，梦想还是要有的！' },
    E(10, 'candy',     '巧克力路', '🍫', 5000),
    E(11, 'dessert',   '蛋糕大道', '🍰', 6000),
    { i: 12, type: 'god',      name: '神明祭坛', icon: '✨', desc: '随机请来一位神明附身——好坏全看运气！' },
    E(13, 'dessert',   '冰淇淋街', '🍦', 6000),
    { i: 14, type: 'jail',     name: '监狱',   icon: '🔒', desc: '探监专区。被陷害的人要在这里待 2 回合。' },  // 右上角
    E(15, 'dessert',   '甜甜圈广场', '🍩', 7000),
    { i: 16, type: 'bank',     name: '银行',   icon: '🏦', desc: '存款有利息，贷款要付息，量力而行。' },
    E(17, 'milktea',   '珍珠奶茶街', '🧋', 7000),
    { i: 18, type: 'chance',   name: '命运',   icon: '🎴', desc: '命运的齿轮开始转动……' },
    { i: 19, type: 'park',     name: '中央乐园', icon: '🎡', desc: '休息一回合，顺便领 2 张点券。' },          // 右下角
    E(20, 'milktea',   '椰果奶茶巷', '🥤', 8000),
    E(21, 'beach',     '阳光沙滩', '🏖️', 8000),
    { i: 22, type: 'special',  name: '海景建地', icon: '🏗️', desc: '大型建地：可盖公园 / 加油站 / 研究中心 / 度假饭店。' },
    E(23, 'beach',     '贝壳小径', '🐚', 9000),
    { i: 24, type: 'news',     name: '新闻',   icon: '📰', desc: '小镇大事，全体玩家都会受影响！' },
    E(25, 'beach',     '海浪大道', '🌊', 9000),
    { i: 26, type: 'god',      name: '神明祭坛', icon: '✨', desc: '随机请来一位神明附身——好坏全看运气！' },
    E(27, 'funfair',   '旋转木马街', '🎠', 10000),
    { i: 28, type: 'lottery',  name: '乐透站', icon: '🎰', desc: '买一张彩票，梦想还是要有的！' },
    E(29, 'funfair',   '摩天轮路', '🎡', 11000),
    E(30, 'funfair',   '过山车道', '🎢', 12000),
    { i: 31, type: 'shop',     name: '道具店', icon: '🏪', desc: '用现金购买功能卡片。' },
    E(32, 'jewel',     '翡翠街',  '💎', 12000),
    E(33, 'jewel',     '珍珠巷',  '🦪', 14000),
    { i: 34, type: 'hospital', name: '医院',   icon: '🏥', desc: '看望病人。受伤的人要在这里休养 3 回合。' },  // 左下角
    E(35, 'jewel',     '黄金大道', '💰', 16000),
    { i: 36, type: 'special',  name: '星光建地', icon: '🏗️', desc: '大型建地：可盖公园 / 加油站 / 研究中心 / 度假饭店。' },
    { i: 37, type: 'card',     name: '卡片格', icon: '🎁', desc: '免费抽取一张功能卡！' },
    E(38, 'star',      '月光大街', '🌙', 18000),
    E(39, 'star',      '星辰小路', '⭐', 20000),
  ];

  /* 特殊建筑（大型建地上可盖的 4 种） */
  const SPECIAL_BUILDINGS = {
    park:   { id: 'park',   name: '中央公园',   icon: '🌳', cost: 8000,
              desc: '任何人路过都免费——但也无法被收租。适合防御性布局。',
              rent: 0, teach: '公园不收钱，但能让对手在你的街区里「无伤通过」，是防御性投资。' },
    station:{ id: 'station', name: '加油站',   icon: '⛽', cost: 10000,
              desc: '你经过任意起点时，津贴 ×1.5。',
              rent: 0, teach: '加油站提升的是你自己的「主动收入」，跟租金这种被动收入是两回事。' },
    lab:    { id: 'lab',    name: '研究中心', icon: '🔬', cost: 12000,
              desc: '你的每个回合结束时，有 50% 概率免费获得一张卡片。',
              rent: 0, teach: '研究中心生产的是「工具」——工具本身不生钱，但用得好能改变局势。' },
    resort: { id: 'resort', name: '度假饭店', icon: '🏝️', cost: 15000,
              desc: '对手落上需支付高额住宿费（含建造费的回报）。',
              rent: 3000, teach: '度假饭店是纯进攻型建筑：住宿费高，但一分钱防御都没有。' },
  };

  /* ======================================================================
     四、角色（致敬大富翁经典人物的原创儿童版）
     初始现金与津贴的差异 = 教学点：有人本钱多，有人「工资」高
     ====================================================================== */
  const CHARACTERS = [
    { id: 'richgirl', name: '小美',   emoji: '🐱', color: '#ef7fa8', avatar: 'assets/img/char_richgirl.png',
      cash: 22000, salary: 2000,
      story: '富商家的千金，本钱最多，但零花钱很少。',
      teach: '起点高不等于赢到终点——本钱多更要会打理。' },
    { id: 'farmer',   name: '阿土',   emoji: '🐶', color: '#8b5cf0', avatar: 'assets/img/char_farmer.png',
      cash: 10000, salary: 4500,
      story: '勤劳的小农夫，本钱最少，但每月津贴最高。',
      teach: '工资是主动收入：不掷骰子就没有。它只能帮你攒本钱。' },
    { id: 'moneyboy', name: '钱多多', emoji: '🐼', color: '#d99a2b', avatar: 'assets/img/char_moneyboy.png',
      cash: 15000, salary: 3000,
      story: '天生的小商人，什么都要算一笔账。',
      teach: '会算账的人，运气来的时候才接得住。' },
    { id: 'baby',     name: '金贝贝', emoji: '🐣', color: '#2ea6c9', avatar: 'assets/img/char_baby.png',
      cash: 13000, salary: 3500,
      story: '天才小婴儿，戴着奶嘴炒股票。',
      teach: '年龄从来不是理财的门槛，习惯才是。' },
    { id: 'adventurer', name: '沙沙', emoji: '🦊', color: '#e8813a', avatar: 'assets/img/char_adventurer.png',
      cash: 16000, salary: 2800,
      story: '环游世界的小冒险家，走到哪儿学到哪儿。',
      teach: '见多识广的人，更早发现别人看不到的机会。' },
    { id: 'foodie',   name: '糯米',   emoji: '🐹', color: '#17a673', avatar: 'assets/img/char_foodie.png',
      cash: 14000, salary: 3200,
      story: '小熊猫吃货，梦想开一条全是美食店的街。',
      teach: '把兴趣变成事业的人，赚钱的同时也在过想要的生活。' },
  ];

  /* ======================================================================
     五、平衡常量（balance）
     ====================================================================== */
  const BALANCE = {
    /* 回合与胜利 */
    roundLimits: { quick: 20, standard: 35, marathon: 60 },   // 圈数上限（圈 = 绕地图一周）
    startBonus: 1000,          // 停在起点额外奖励

    /* 银行 */
    depositRate: 0.005,        // 存款利率 / 圈（0.5%）
    loanRate: 0.02,            // 贷款利率 / 圈（2%）
    loanMax: 20000,            // 贷款上限
    depositStep: [2000, 5000, 10000],  // 快捷存款档位

    /* 股票 */
    stockDividend: 0.005,      // 分红 / 圈（持有市值 × 0.5%）

    /* 卡片 */
    cardHandMax: 5,            // 手牌上限
    cardShopRestockEvery: 3,   // 道具店每 N 次使用后刷新货架
    ticketCardPrice: 3,        // 点券换卡比例

    /* 监狱 / 医院 */
    jailTurns: 2,
    hospitalTurns: 3,
    jailBailTickets: 2,        // 2 张点券保释

    /* 乐透 */
    lotteryPrice: 500,
    lotteryInitPot: 10000,
    lotteryPotRate: 0.6,       // 每张票 60% 进奖池
    lotteryDrawEvery: 5,       // 每 5 圈开奖
    lotteryWinRate: 0.08,

    /* 抵押 / 变卖 */
    mortgageRate: 0.6,         // 抵押可得地价 × 60%
    redeemRate: 0.7,           // 赎回需付地价 × 70%
    sellBuildingRate: 0.5,     // 拆房回收建造费 × 50%
    sellLandRate: 0.4,         // 破产变卖地价 × 40%

    /* 神明 */
    godTurns: { fortune: 8, bless: 6, poor: 8, decay: 6 },

    /* 教育（保留 v1 内核） */
    livingCost: 1000,          // 每圈生活开销（进收支表，教育口径）
  };

  /* 三种局时长（替代 v1 的难度维度；AI 强度独立设定） */
  const GAME_MODES = {
    quick:    { id: 'quick',    name: '快速局', icon: '⚡', rounds: 20, desc: '约 10 分钟，适合第一次玩。' },
    standard: { id: 'standard', name: '标准局', icon: '⚖️', rounds: 35, desc: '约 20 分钟，完整体验全部系统。' },
    marathon: { id: 'marathon', name: '马拉松', icon: '🏔️', rounds: 60, desc: '约 40 分钟，为真正的地产大亨准备。' },
  };

  /* AI 人格（复用 v1 框架：reserve = 现金安全垫月数；riskTol = 风险偏好） */
  const AI_PERSONAS = [
    { id: 'cautious',   name: '谨慎先生', reserve: 5, riskTol: 0.3, aggression: 0.2 },
    { id: 'balanced',   name: '平衡小姐', reserve: 3, riskTol: 0.5, aggression: 0.5 },
    { id: 'aggressive', name: '进取哥',   reserve: 1, riskTol: 0.8, aggression: 0.9 },
    { id: 'opportunist', name: '机会猎手', reserve: 2, riskTol: 0.6, aggression: 0.7 },
    { id: 'teacher',    name: '理财老师', reserve: 4, riskTol: 0.5, aggression: 0.4 },
  ];

  const PLAYER_COLORS = ['#4f6ef7', '#e34b6d', '#17a673', '#e8813a', '#8b5cf0', '#0e89b8'];

  /* buildMap：深拷贝地图（每局独立），附加坐标 */
  function buildMap() {
    return MAP.map(c => {
      const cell = Object.assign({}, c);
      if (c.type === 'estate') {
        cell.rent = c.rent.slice();
        cell.buildCost = c.buildCost;
      }
      if (c.type === 'special') cell.building = null;
      const co = ringCoord(c.i);
      cell.col = co.col; cell.row = co.row;
      return cell;
    });
  }

  /* 地产总格数与各街区地块数（垄断判定用） */
  const DISTRICT_SIZE = {};
  MAP.forEach(c => {
    if (c.type === 'estate') DISTRICT_SIZE[c.district] = (DISTRICT_SIZE[c.district] || 0) + 1;
  });

  global.CFWorld = {
    COLS, ROWS, ringCoord, buildMap,
    DISTRICTS, DISTRICT_SIZE, MAP, SPECIAL_BUILDINGS,
    CHARACTERS, BALANCE, GAME_MODES, AI_PERSONAS, PLAYER_COLORS,
  };
})(window);
