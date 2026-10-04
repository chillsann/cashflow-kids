/* ==========================================================================
   现金流小富翁 · 数据层
   所有游戏内容（职业、棋格、卡牌、徽章、财商知识）集中在此，
   方便老师 / 家长自行增删改。
   ========================================================================== */
(function (global) {
  'use strict';

  /* ======================================================================
     一、职业（决定初始工资、生活费、存款与负债）
     ====================================================================== */
  const CAREERS = [
    { id: 'milk',    name: '早餐店小老板', icon: '🥛', salary: 6800,  expenses: 3200, cash: 18000, debt: 0,
      story: '每天凌晨 4 点起床，辛苦但现金流稳定。' },
    { id: 'office',  name: '普通白领',     icon: '💼', salary: 9500,  expenses: 4600, cash: 14000, debt: 0,
      story: '朝九晚五，工资固定，月底常常“月光”。' },
    { id: 'teacher', name: '小学老师',     icon: '👩‍🏫', salary: 8200,  expenses: 3800, cash: 13000, debt: 2000,
      story: '收入稳定，有点小小的信用账单。' },
    { id: 'nurse',   name: '护士',         icon: '👩‍⚕️', salary: 8800,  expenses: 4200, cash: 11000, debt: 3000,
      story: '三班倒换来的辛苦钱，最懂健康的重要。' },
    { id: 'driver',  name: '网约车司机',   icon: '🚕', salary: 8600,  expenses: 5200, cash: 9000,  debt: 6000,
      story: '车贷还没还完，但每天都在跑。' },
    { id: 'coder',   name: '程序员',       icon: '🧑‍💻', salary: 18000, expenses: 8500, cash: 30000, debt: 8000,
      story: '工资高，消费也高，还有个相机分期。' },
    { id: 'doctor',  name: '医生',         icon: '👨‍⚕️', salary: 22000, expenses: 9800, cash: 38000, debt: 12000,
      story: '高收入伴随高责任，也有学生贷款要还。' },
    { id: 'shop',    name: '网店店主',     icon: '🛍️', salary: 12000, expenses: 6000, cash: 20000, debt: 4000,
      story: '卖什么都不如卖得稳，现金流就是命。' },
  ];

  /* ======================================================================
     二、棋格定义
     环形棋盘共 38 格（14 × 7 网格的边缘一圈），按顺时针排列：
        0–13   底边（左 → 右）
        14–19  右边（下 → 上）
        20–32  顶边（右 → 左）
        33–37  左边（上 → 下）

     坐标由 ringCoord() 程序化生成，保证首尾相接、无重叠。
     ====================================================================== */
  const CORNERS = { 0: 'start', 13: 'bank', 19: 'salary', 32: 'landmark', 37: 'charity' };

  /* 中间格子的排布（底边 12 格 / 右边 5 格 / 顶边 12 格 / 左边 4 格） */
  const EDGE_LAYOUTS = {
    bottom: ['small', 'salary', 'spend', 'small', 'accident', 'big',
             'market', 'small', 'salary', 'spend', 'big', 'market'],
    right:  ['small', 'market', 'spend', 'accident', 'study'],
    top:    ['big', 'spend', 'market', 'small', 'salary', 'accident',
             'small', 'big', 'study', 'spend', 'market', 'small'],
    left:   ['small', 'spend', 'big', 'market'],
  };

  /* 格子文案 */
  const CELL_TEXT = {
    start:    { name: '起点',     icon: '🏁' },
    bank:     { name: '银行',     icon: '🏦' },
    salary:   { name: '领工资',   icon: '💰' },
    small:    { name: '小机会',   icon: '💡' },
    big:      { name: '大机会',   icon: '🏗️' },
    spend:    { name: '消费',     icon: '🛍️' },
    market:   { name: '市场风云', icon: '📊' },
    accident: { name: '意外支出', icon: '⚡' },
    parttime: { name: '副业',     icon: '💼' },
    study:    { name: '学习进修', icon: '📚' },
    charity:  { name: '慈善捐赠', icon: '💝' },
    landmark: { name: '梦想之角', icon: '🌈' },
  };

  /* 生成环形坐标：顺时针，从左上角(1,1)起，共 38 格，首尾相接。
     路径：左上角 → 顶边向右 → 右上角 → 右边向下 → 右下角 → 底边向左 → 左下角 → 左边向上 */
  function ringCoord(i) {
    const COLS = 14, ROWS = 7;
    const ring = [];
    for (let c = 1; c <= COLS; c++) ring.push({ col: c, row: 1 });          // 顶边（左→右）
    for (let r = 2; r <= ROWS; r++) ring.push({ col: COLS, row: r });       // 右边（上→下）
    for (let c = COLS - 1; c >= 1; c--) ring.push({ col: c, row: ROWS });   // 底边（右→左）
    for (let r = ROWS - 1; r >= 2; r--) ring.push({ col: 1, row: r });      // 左边（下→上）
    return ring[i % ring.length];
  }

  function buildBoard() {
    const cells = [];

    const push = (i, type) => {
      const t = CELL_TEXT[type];
      const c = ringCoord(i);
      cells.push({ index: i, type: type, name: t.name, icon: t.icon, col: c.col, row: c.row });
    };

    // 角格
    Object.keys(CORNERS).forEach(k => push(parseInt(k, 10), CORNERS[k]));

    // 边格
    EDGE_LAYOUTS.bottom.forEach((t, k) => push(1 + k, t));    // 1–12
    EDGE_LAYOUTS.right.forEach((t, k) => push(14 + k, t));    // 14–18
    EDGE_LAYOUTS.top.forEach((t, k) => push(20 + k, t));      // 20–31
    EDGE_LAYOUTS.left.forEach((t, k) => push(33 + k, t));     // 33–36

    cells.sort((a, b) => a.index - b.index);
    return cells;
  }

  /* ======================================================================
     三、机会卡 —— 资产
     cost 投入成本 / income 每月净被动收入
     设计原则（教育性）：
       · 起步型资产（基金/国债）收益低但安全 → 教「稳健」
       · 生意型资产收益中等但会被市场事件影响 → 教「波动」
       · 高收益资产门槛高 → 教「攒钱 + 抓机会」
       月回报率区间约 0.6% ~ 1.6%，回本周期 60 ~ 150 个月，
       接近真实投资品的量级，避免「随便买都暴富」。
     ====================================================================== */
  const SMALL_OPPS = [
    /* --- 低门槛起步资产：低风险低回报 --- */
    { id: 's_bond',  name: '国债', icon: '🏛️', cost: 5000,  income: 35,  unit: '份', tags: ['paper'],
      desc: '把钱借给国家，到期还本付息，非常安全。', risk: '低',
      teach: '国债是「把钱借给国家」。收益不高，但几乎是最稳的投资，适合放应急基金。' },
    { id: 's_fund',  name: '宽基指数基金', icon: '📊', cost: 8000,  income: 62,  unit: '份', tags: ['paper'],
      desc: '一篮子公司的一小份，长期跟着经济一起长大。', risk: '低',
      teach: '指数基金 = 一次性买入一大堆公司。它不会一夜暴富，但会跟着整个国家的经济一起长大。' },

    /* --- 中档：小额生意，有波动 --- */
    { id: 's_slot',  name: '共享充电宝机位', icon: '🔌', cost: 12000, income: 130, unit: '台', tags: ['cash'],
      desc: '放在商场角落，别人借电你收钱。', risk: '中',
      teach: '「一次投入、持续收租」是很多小生意的本质。关键看：多久能把本金赚回来。' },
    { id: 's_vend',  name: '自动售货机', icon: '🥤', cost: 15000, income: 175, unit: '台', tags: ['cash'],
      desc: '不用人看店，半夜也在卖货。', risk: '中',
      teach: '自动售货机是典型的「睡后收入」：你睡觉的时候，它还在赚钱。' },
    { id: 's_shop',  name: '小奶茶店', icon: '🧋', cost: 20000, income: 260, unit: '间', tags: ['biz'],
      desc: '人流量不错，每天都有客人排队。', risk: '中',
      teach: '开店是「主动 + 被动」混合型收入。你雇了店长之后，它才越来越像被动收入。' },

    /* --- 版权型：一次创作，持续收钱 --- */
    { id: 's_book',  name: '图书版权', icon: '📖', cost: 25000, income: 300, unit: '本', tags: ['royalty'],
      desc: '写一次，卖很多年，不用重复劳动。', risk: '中',
      teach: '版权收入是「复利型收入」：同一个作品可以卖无数次，边际成本几乎为零。' },
    { id: 's_course',name: '线上课程', icon: '🎓', cost: 32000, income: 420, unit: '套', tags: ['royalty'],
      desc: '录一次课，全世界的人都能买。', risk: '中',
      teach: '把知识做成产品，是普通人最容易上手的「被动收入」之一。' },

    /* --- 纸资产：波动最大，长期回报高 --- */
    { id: 's_stocks',name: '优质股票', icon: '📈', cost: 40000, income: 520, unit: '手', tags: ['paper'],
      desc: '好公司的小小股东，跟着一起分红。', risk: '高',
      teach: '股票短期会上下跳，但长期看，好公司赚的钱会一分一分为股东赚回来。' },

    /* --- 较高门槛：稳定现金流引擎 --- */
    { id: 's_noodle',name: '连锁面馆加盟店', icon: '🍜', cost: 60000, income: 860, unit: '间', tags: ['biz'],
      desc: '总部帮你打理，你只管收分红。', risk: '中',
      teach: '加盟 = 买「已经跑通的商业模式」。省下试错成本，但要小心加盟费和隐藏条款。' },
    { id: 's_logi',  name: '小型物流车队', icon: '🚚', cost: 80000, income: 1100, unit: '队', tags: ['cash'],
      desc: '有几辆车在跑，运费按月结。', risk: '中',
      teach: '重资产型生意门槛高，但一旦跑起来，现金流很大很稳。' },
    { id: 's_self',  name: '公寓自助洗衣房', icon: '🧺', cost: 100000, income: 1500, unit: '间', tags: ['cash'],
      desc: '无人值守，扫码就能用。', risk: '中',
      teach: '「无人值守」是判断被动收入质量的重要标准：你不在，它能不能照样赚钱？' },
  ];

  /* ======================================================================
     四、大机会卡 —— 带按揭的不动产 / 大生意
     cost 总价 / down 首付（现金流出的现金） / income 已扣除月供后的净被动收入
     不动产月回报率约 0.30% ~ 0.38%（贴近真实租售比），
     生意型资产略高但更易受市场事件影响。
     ====================================================================== */
  const BIG_OPPS = [
    { id: 'b_park1', name: '停车位出租', icon: '🅿️', cost: 80000,  down: 20000, income: 220,  unit: '个', tags: ['realestate'],
      desc: '小区里的车位永远不够用。', risk: '低',
      teach: '不动产最大的魅力是「杠杆」：你出 20%–25% 首付就买下 100% 的房子，租金却全归你。' },
    { id: 'b_store', name: '临街商铺出租', icon: '🏪', cost: 150000, down: 35000, income: 430,  unit: '间', tags: ['realestate'],
      desc: '商铺的租金，会随着物价慢慢上涨。', risk: '中',
      teach: '商铺租金通常比住宅高，但空置风险也更大。投资前先想：如果半年租不出去，你能撑住吗？' },
    { id: 'b_apt1',  name: '小户型出租房', icon: '🏢', cost: 200000, down: 45000, income: 520,  unit: '套', tags: ['realestate'],
      desc: '地铁口附近，租客从不缺。', risk: '中',
      teach: '租金减掉房贷月供，剩下的才是真正流进你口袋的「被动收入」。' },
    { id: 'b_apt2',  name: '学区房出租', icon: '🏫', cost: 260000, down: 55000, income: 720, unit: '套', tags: ['realestate'],
      desc: '家长抢着租，租金很抗跌。', risk: '中',
      teach: '「位置」决定租金的下限，「稀缺」决定租金的上限。' },
    { id: 'b_villa', name: '度假别墅出租', icon: '🏖️', cost: 350000, down: 70000, income: 1050, unit: '栋', tags: ['realestate'],
      desc: '旅游旺季一房难求，淡季可能空着。', risk: '高',
      teach: '高租金往往伴随高波动：旺季赚翻，淡季可能空置。要有现金储备顶住淡季。' },
    { id: 'b_office',name: '写字楼整层', icon: '🏬', cost: 420000, down: 84000, income: 1500, unit: '层', tags: ['realestate'],
      desc: '一家公司签三年租约，非常稳。', risk: '中',
      teach: '长租约 = 现金流确定性高。做生意的人最怕的不是赚得少，而是收入不确定。' },
    { id: 'b_factory',name:'小型加工厂', icon: '🏭', cost: 500000, down: 100000, income: 2100, unit: '座', tags: ['biz'],
      desc: '给大厂做配套，订单排到明年。', risk: '高',
      teach: '实业利润高，但要管人、管货、管账。没精力时，宁可买更「轻」的资产。' },
    { id: 'b_land',  name: '城郊地块', icon: '🗺️', cost: 600000, down: 120000, income: 1500, unit: '块', tags: ['realestate'],
      desc: '城市总有一天会扩张过来。', risk: '高',
      teach: '土地本身不产生现金流，只有出租或被开发时才生钱。它更像「赌未来」，不是稳现金流。' },
    { id: 'b_mall',  name: '商场铺位投资', icon: '🛒', cost: 800000, down: 160000, income: 2900, unit: '个', tags: ['realestate'],
      desc: '商场客流大，但也和商场共命运。', risk: '中',
      teach: '投资「依附型资产」时，要问一句：如果商场衰落了，我这笔投资怎么办？' },
    { id: 'b_apart', name: '青年公寓楼', icon: '🏨', cost: 1000000, down: 200000, income: 3800, unit: '栋', tags: ['realestate'],
      desc: '一栋 12 间，满租时现金流非常可观。', risk: '中',
      teach: '规模化能让现金流上一个台阶。缺点是需要更专业的管理。' },
  ];

  /* ======================================================================
     五、特殊债务资产（大机会里偶尔出现「坑」）
     ====================================================================== */
  const DEBT_OPPS = [
    { id: 'd_car',  name: '贷款买豪车', icon: '🚗', debt: 50000, cost: 3000, income: -400, tags: ['bad'],
      desc: '好看是好看，但它每个月都在吃你的钱。', risk: '差',
      teach: '车子会贬值，还要油费、保险、保养。它是典型的「负债」，不是资产。' },
    { id: 'd_lux',  name: '分期买奢侈品', icon: '👜', debt: 20000, cost: 1000, income: -260, tags: ['bad'],
      desc: '分 24 期，每期还一点，利息却不少。', risk: '差',
      teach: '「分期免息」通常有手续费。算年化利率时，你会发现它比想象的高得多。' },
    { id: 'd_reno', name: '装修升级自住房', icon: '🔨', debt: 30000, cost: 2000, income: -180, tags: ['bad'],
      desc: '住得更舒服了，但每月多一笔还款。', risk: '中',
      teach: '自住房的装修让人开心，但它不会给你带来一分钱收入，只会增加支出。' },
  ];

  /* ======================================================================
     六、消费卡（想要 vs 需要）
     needLevel: need(需要) / want(想要) / waste(浪费)
     ====================================================================== */
  const SPEND_CARDS = [
    { icon: '🍔', name: '和朋友聚餐',   amount: 800,  needLevel: 'want',  tag: '社交',
      teach: '社交是值得的支出，但要分清「偶尔聚」和「天天聚」。' },
    { icon: '🎬', name: '看电影',       amount: 400,  needLevel: 'want',  tag: '娱乐',
      teach: '娱乐支出不是坏事。关键是它有没有超出你的预算。' },
    { icon: '👟', name: '买了双新球鞋', amount: 1500, needLevel: 'want',  tag: '消费',
      teach: '想要的东西永远买不完。给自己设一个「想要预算」，每月花完就停。' },
    { icon: '🎮', name: '买了新游戏',   amount: 600,  needLevel: 'want',  tag: '娱乐',
      teach: '把「想要」的清单列出来，等一个月再决定，很多冲动会自己消失。' },
    { icon: '☕', name: '天天喝奶茶',   amount: 500,  needLevel: 'waste', tag: '习惯',
      teach: '一杯奶茶 25 元，一年就是 9000 元。小钱天天花的威力，比你想的大得多。' },
    { icon: '🎢', name: '去游乐园玩',   amount: 1200, needLevel: 'want',  tag: '娱乐',
      teach: '体验型消费会留下回忆，比买东西更值。但也要提前做好预算。' },
    { icon: '📱', name: '换最新款手机', amount: 4000, needLevel: 'want',  tag: '消费',
      teach: '手机还能用的时候换掉，多花的就是纯浪费。' },
    { icon: '🚗', name: '汽车保养',     amount: 2000, needLevel: 'need',  tag: '必需',
      teach: '这是「需要」：不做会出安全事故。必要支出要留出预算，省不得。' },
    { icon: '📚', name: '买书和文具',   amount: 300,  needLevel: 'need',  tag: '成长',
      teach: '花在学习和成长上的钱，是最不容易亏本的投资。' },
    { icon: '🍱', name: '日常买菜做饭', amount: 1500, needLevel: 'need',  tag: '必需',
      teach: '生活必需支出是固定的「底线」。先扣掉它，剩下的才是可以自由分配的钱。' },
    { icon: '👚', name: '换季衣服',     amount: 1800, needLevel: 'want',  tag: '消费',
      teach: '换季打折最容易超支。列好缺什么再出门，能省下一大半。' },
    { icon: '🎁', name: '给朋友买礼物', amount: 600,  needLevel: 'want',  tag: '社交',
      teach: '心意和价格不成正比。会花钱的人，懂得把钱花在关键的地方。' },
  ];

  /* ======================================================================
     七、意外卡（含保险理赔：有保险时可减免）
     ====================================================================== */
  const ACCIDENT_CARDS = [
    { icon: '🏥', name: '生病看医生',    amount: 2000, insurable: true,
      teach: '医疗支出是最大的不确定项，也是最该配置保险的地方。' },
    { icon: '🚗', name: '车子抛锚维修',  amount: 2500, insurable: true,
      teach: '「应急基金」的作用就在这里：不用借钱，也能扛住意外。' },
    { icon: '💻', name: '电脑突然坏了',  amount: 1800, insurable: false,
      teach: '很多东西说坏就坏。准备 3–6 个月生活费当应急基金，你会睡得踏实很多。' },
    { icon: '🦷', name: '看牙齿',        amount: 1200, insurable: true,
      teach: '牙齿和健康是最容易被忽略的投资，也是最贵的事后补救。' },
    { icon: '🚑', name: '意外受伤',      amount: 3500, insurable: true,
      teach: '意外险一年只要几百块，却能在关键时刻顶上几万块。' },
    { icon: '💧', name: '水管爆裂',      amount: 1600, insurable: true,
      teach: '生活中的小概率事件，长期看一定会发生。这就是保险存在的意义。' },
    { icon: '📵', name: '手机摔坏了',    amount: 1400, insurable: false,
      teach: '能修就别换。区分「修复成本」和「替换成本」，能省不少钱。' },
    { icon: '📉', name: '被裁员 1 个月', amount: 5000, insurable: false, jobLoss: true,
      teach: '主动收入随时可能中断。只有被动收入，才是在你失业时还在赚钱的朋友。' },
  ];

  /* ======================================================================
     八、市场风云卡（作用于全体玩家的宏观事件）
     设计原则：让「熊市」真的能伤到人，才会形成「分散风险 + 留现金」的学习动机。
     ====================================================================== */
  const MARKET_EVENTS = [
    /* —— 先立一条底线：市场风云是「当月一次性」的，
          涨跌幅度按「你这类资产的当月收入」计算，最多影响一两个月的收益。
          真正会留下长期伤口的只有两种：永久性的物价上涨，和永久性的利率上调。 —— */

    { icon: '📈', name: '股市大涨', type: 'bull',
      desc: '行情火热，持有股票 / 基金的人笑开花。',
      effect: { kind: 'assetReturn', tags: ['paper', 'royalty'], rate: 0.20, label: '纸资产当月收益 +20%' },
      teach: '牛市里人人都像天才。真正考验人的，是熊市来临的时候。' },

    { icon: '📉', name: '股市大跌', type: 'bear',
      desc: '恐慌抛售，但其实好公司还在赚钱。',
      effect: { kind: 'assetReturn', tags: ['paper', 'royalty'], rate: -0.30, label: '纸资产当月收益 −30%' },
      teach: '市场下跌时，你的股份没有变少，只是报价便宜了。跌的时候别慌，涨的时候别贪。' },

    { icon: '🏠', name: '房价上涨', type: 'bull',
      desc: '一线城市房价回暖，房子更值钱了。',
      effect: { kind: 'assetValue', tags: ['realestate'], rate: 0.12, label: '不动产估值 +12%' },
      teach: '资产价格上涨是你「被动增值」的一部分，但只有卖出去才算真的赚到。' },

    { icon: '📉', name: '楼市降温', type: 'bear',
      desc: '调控加码，房子短期不好卖也不好租。',
      effect: { kind: 'assetValue', tags: ['realestate'], rate: -0.15, label: '不动产估值 −15%' },
      teach: '房价会跌，这很正常。别把全部家当都压在一类资产上，这叫「分散风险」。' },

    { icon: '💹', name: '利率下降', type: 'bull',
      desc: '贷款变便宜了，有负债的人轻松一些。',
      effect: { kind: 'liabilityCost', rate: -0.30, label: '负债利息下调 30%' },
      teach: '利率下降时，负债成本降低，但存款利息也变少。同一件事，对不同的人是好是坏。' },

    { icon: '📈', name: '利率上升', type: 'bear',
      desc: '借钱变贵了，负债的压力更大了。',
      effect: { kind: 'liabilityCost', rate: 0.35, label: '负债利息上调 35%' },
      teach: '杠杆是双刃剑：利率一涨，同样的负债要多还钱，现金流立刻变紧。' },

    { icon: '🎉', name: '经济繁荣', type: 'bull',
      desc: '各行各业生意都好，人人有红包。',
      effect: { kind: 'cash', mode: 'salary', rate: 0.5, label: '领取半个月工资' },
      teach: '经济好的时候赚到的钱，不要全花掉——那是给下一个低谷准备的粮食。' },

    { icon: '🌧️', name: '经济不景气', type: 'bear',
      desc: '生意难做，日子要精打细算。',
      effect: { kind: 'cash', mode: 'expenses', rate: 0.6, label: '生活成本上升（额外支出一个月生活费）' },
      teach: '经济周期就像四季。冬天一定会来，关键是你在秋天有没有储备。' },

    { icon: '🎁', name: '政府发放消费券', type: 'bull',
      desc: '人人有份，直接进钱包。',
      effect: { kind: 'cash', mode: 'fixed', value: 2000, label: '每人获得 2,000 元' },
      teach: '意外之财最容易变成意外消费。拿到就存起来的，才是真正会理财的人。' },

    /* —— 下面的「大支出 / 大行情」事件专门用来制造压力：
          让「留着现金」和「控制负债」这两件事在游戏里真的会救命。 —— */

    { icon: '⛽', name: '物价集体上涨', type: 'bear',
      desc: '柴米油盐、房租学费全在涨，每月的开销直接顶上去了。',
      effect: { kind: 'cash', mode: 'expenses', rate: 0.30, permanent: true, label: '生活成本永久上升 30%（最多累计 2 次）' },
      teach: '物价上涨没有商量余地——它是「悄悄涨工资的对手」。生活成本一旦上去了，就很少降回来。' },

    { icon: '🏥', name: '突发住院', type: 'bear',
      desc: '家人突然住院，账单来得又快又急。',
      effect: { kind: 'cash', mode: 'expenses', rate: 0.6, label: '一次性支出（约 0.6 个月生活费）' },
      teach: '应急基金不是理论。手里有 6 个月生活费的人，遇到这种事只是「心疼」，没准备的人只能去借钱。' },

    { icon: '🏦', name: '银行降息通知', type: 'bear',
      desc: '存款利息变少了，钱更「不值钱」。',
      effect: { kind: 'cash', mode: 'fixed', value: -1000, label: '每人损失 1,000 元利息' },
      teach: '把钱一直放着不动，会被通胀悄悄吃掉。这就是为什么「会理财」很重要。' },

    { icon: '🔧', name: '原材料涨价', type: 'bear',
      desc: '做生意的人成本上升，利润被压缩。',
      effect: { kind: 'assetReturn', tags: ['biz', 'cash'], rate: -0.25, label: '生意类资产当月收益 −25%' },
      teach: '成本涨了你却不能立刻涨价，这是生意最难受的时候——所以要有现金缓冲。' },

    { icon: '🚀', name: '行业风口来了', type: 'bull',
      desc: '新需求爆发，会做生意的人先赚到。',
      effect: { kind: 'assetReturn', tags: ['biz', 'cash'], rate: 0.22, label: '生意类资产当月收益 +22%' },
      teach: '风口能挣钱，但风停的时候，没本事的人会摔得很惨。' },

    { icon: '🛒', name: '消费回暖', type: 'bull',
      desc: '大家都愿意花钱了，零售生意好起来。',
      effect: { kind: 'assetReturn', tags: ['biz'], rate: 0.18, label: '实体生意当月收益 +18%' },
      teach: '生意的收入随经济波动，这就是为什么成熟的投资者会搭配不同类型的资产。' },

    { icon: '🏛️', name: '稳定币值政策', type: 'neutral',
      desc: '物价平稳，现金流照常。',
      effect: { kind: 'none', label: '没有影响，稳稳当当' },
      teach: '平静的市场里，最能看清一个人是不是真的在坚持定投。' },

    { icon: '💸', name: '加息周期', type: 'bear',
      desc: '所有贷款利息一起上涨，负债多的人最难受。',
      effect: { kind: 'liabilityCost', rate: 0.15, permanent: true, label: '负债利息上调 15%（永久，最多累计 3 次）' },
      teach: '负债多的人，最怕加息。这就是「杠杆」的另一面。' },

    { icon: '📈', name: '利率进入上行通道', type: 'bear',
      desc: '央行连续加息，每个月的月供都在变贵。',
      effect: { kind: 'liabilityCost', rate: 0.12, permanent: true, label: '负债利息上调 12%（永久，最多累计 3 次）' },
      teach: '浮动利率的负债，是一颗会自己长大的石头。签合同前一定要问清楚：利息会不会变？' },
  ];

  /* ======================================================================
     九、市场机会（玩家可以收购 / 出售资产）
     ====================================================================== */
  const MARKET_OFFERS = [
    { id: 'mo_paper', icon: '📈', name: '有人在低价甩卖股票',
      desc: '金融危机里，好资产常常被恐慌打折。',
      buyTag: 'paper', buyPrice: 12000, buyIncome: 320,
      teach: '别人恐惧时我贪婪——前提是你手上还有现金，而且你懂这个东西值多少。' },

    { id: 'mo_realty', icon: '🏠', name: '法拍房急售',
      desc: '比市价便宜 30%，但要一次性付款。',
      buyTag: 'realestate', buyPrice: 60000, buyIncome: 1100,
      teach: '便宜的东西往往要求「手上有现金」。现金储备不只是保险，更是抓机会的弹药。' },

    { id: 'mo_biz', icon: '🏪', name: '邻居的店铺转让',
      desc: '他要出国，愿意低价转让一家赚钱的店。',
      buyTag: 'biz', buyPrice: 25000, buyIncome: 900,
      teach: '接盘别人跑通的生意，比自己从零开店成功率高得多。' },
  ];

  /* ======================================================================
     十、学习进修卡
     ====================================================================== */
  const STUDY_OFFERS = [
    { id: 'st_skill', icon: '🎯', name: '考取专业证书',
      cost: 3000, salaryGain: 1800, incomeGain: 0,
      desc: '专业技能提升，工资永久上涨。',
      teach: '投资自己，是唯一「没人能抢走」的资产。' },
    { id: 'st_mba',   icon: '🎓', name: '读一个在职 MBA',
      cost: 9000, salaryGain: 4200, incomeGain: 0,
      desc: '学费贵，但涨薪幅度更大。',
      teach: '判断一笔教育投资值不值：用「多涨的工资 × 12」去比学费，多久回本一目了然。' },
    { id: 'st_fin',   icon: '📊', name: '系统学习财商课程',
      cost: 4000, salaryGain: 0, incomeGain: 1200,
      desc: '看懂报表，让你所有资产多赚一点。',
      teach: '财商不是天赋，是技能。它会让你手上每一笔钱，效率都更高。' },
    { id: 'st_lang',  icon: '🗣️', name: '学会一门外语',
      cost: 3500, salaryGain: 2500, incomeGain: 0,
      desc: '能接海外订单，收入天花板更高。',
      teach: '能力是有溢价的。同一份时间，会得多的人可以卖出更高的价格。' },
    { id: 'st_health',icon: '🏃', name: '报名健身年卡',
      cost: 2200, salaryGain: 0, incomeGain: 0, expenseCut: 600,
      desc: '少生病，医疗支出每月降低。',
      teach: '健康是所有资产的底座。身体垮了，再好的现金流也归零。' },
  ];

  /* ======================================================================
     十一、慈善卡
     ====================================================================== */
  const CHARITY_CARDS = [
    { icon: '📚', name: '给乡村小学捐书', amount: 1500, steps: 3,
      teach: '给予不会让你变穷，反而会让人更懂钱的意义——这才是财商的最后一课。' },
    { icon: '🐾', name: '捐助流浪动物救助站', amount: 1200, steps: 3,
      teach: '愿意分享的人，往往也更能管好自己的钱。' },
    { icon: '🍲', name: '请环卫工人吃顿饭', amount: 1000, steps: 2,
      teach: '善意的支出，回报不在账本上，而在心里。' },
    { icon: '🌱', name: '植树公益项目', amount: 800, steps: 2,
      teach: '有些回报要用十年、二十年来衡量。理财也一样，要有长期视角。' },
  ];

  /* ======================================================================
     十二、梦想（梦想之角）
     ====================================================================== */
  const DREAMS = [
    { icon: '🏝️', name: '全家海岛度假',   cost: 30000, desc: '一年一次，和家人一起看海。' },
    { icon: '🎸', name: '学一把吉他',     cost: 6000,  desc: '小时候的梦想，现在实现它。' },
    { icon: '🚐', name: '买一辆房车旅行', cost: 150000, desc: '开着车去看中国。' },
    { icon: '📷', name: '一台专业相机',   cost: 20000, desc: '记录孩子的每一次成长。' },
    { icon: '🎓', name: '孩子的大学基金', cost: 100000, desc: '提前十年为教育做好准备。' },
    { icon: '🌍', name: '环游世界一圈',   cost: 400000, desc: '终极梦想，慢慢攒。' },
  ];

  /* ======================================================================
     十三、副业卡
     ====================================================================== */
  const PARTTIME_CARDS = [
    { icon: '💼', name: '周末做兼职',     amount: 2500, teach: '主动收入的天花板是「你的时间」。每天只有 24 小时，这是它最大的限制。' },
    { icon: '📷', name: '接一单摄影活',   amount: 3000, teach: '技能变现是最快的副业。但它仍然要用时间换钱。' },
    { icon: '🛵', name: '跑了一个月外卖', amount: 4000, teach: '辛苦钱值得尊重。同时想一想：这笔钱能不能拿去换成会生钱的资产？' },
    { icon: '✍️', name: '帮人写文案',     amount: 3200, teach: '副业赚到的第一笔钱，最该做的不是消费，而是建立「资产账户」。' },
    { icon: '🎨', name: '接了个设计单',   amount: 2800, teach: '把副业收入固定拿出 50% 买资产，是很多人实现财务自由的第一步。' },
  ];

  /* ======================================================================
     十四、财商小课堂（随机穿插）
     ====================================================================== */
  const TIPS = [
    '先支付给自己：每月发工资，第一件事是存下一部分，而不是花剩下的再存。',
    '资产把钱放进你口袋，负债把钱从你口袋拿走。买之前先问：它属于哪一种？',
    '应急基金 = 3–6 个月生活费。它是你敢于抓机会的底气。',
    '复利是世界的第八大奇迹。10% 年化，7 年本金翻倍。',
    '负债分两种：投资性负债（帮你赚钱）和消费性负债（帮你花钱）。',
    '会理财的人先还高息负债，因为还掉 18% 的债，等于稳赚 18%。',
    '不要用「能不能借到」来决定买不买，要用「值不值得」来决定。',
    '被动收入的关键：做一次，能收很多次。',
    '分散投资不是「买很多」，而是「买不一样」。',
    '通货膨胀会悄悄吃掉现金。钱放着不动，其实是在慢慢变少。',
    '最贵的不是买错东西，是没买对时间。理财最难的从来不是知识，是耐心。',
    '别人贪婪时我恐惧，别人恐惧时我贪婪。',
    '现金流是水管，净资产是水池。水管粗了，水池迟早会满。',
    '买资产最好的时间是十年前，其次是现在。',
    '记账不是为了省钱，是为了看清钱到底去了哪里。',
  ];

  /* ======================================================================
     十五、财商徽章（成就）
     ====================================================================== */
  const BADGES = [
    { id: 'first_asset',  icon: '🌱', name: '第一桶金',   desc: '买入第一项资产' },
    { id: 'passive_1k',   icon: '💧', name: '细水长流',   desc: '月被动收入达到 1,000' },
    { id: 'passive_5k',   icon: '🌊', name: '现金流小成', desc: '月被动收入达到 5,000' },
    { id: 'passive_10k',  icon: '🏞️', name: '被动收入过万', desc: '月被动收入达到 10,000' },
    { id: 'portfolio3',   icon: '🧺', name: '不把鸡蛋放一个篮子', desc: '同时持有 3 类以上资产' },
    { id: 'debt_free',    icon: '🔓', name: '无债一身轻', desc: '把负债清零' },
    { id: 'emergency',    icon: '🛡️', name: '有底气的人', desc: '现金储备超过 6 个月生活费' },
    { id: 'insured',      icon: '☂️', name: '未雨绸缪',   desc: '配置一份保险' },
    { id: 'scholar',      icon: '📚', name: '学无止境',   desc: '完成 3 次学习进修' },
    { id: 'kind_heart',   icon: '💝', name: '善意有余力', desc: '完成一次慈善捐赠' },
    { id: 'dreamer',      icon: '🌈', name: '梦想实现家', desc: '在梦想之角实现一个梦想' },
    { id: 'freedom',      icon: '🏆', name: '财务自由',   desc: '被动收入 ≥ 每月生活费' },
  ];

  /* ======================================================================
     十六、电脑玩家性格
     ====================================================================== */
  const AI_PERSONAS = [
    { id: 'cautious', name: '谨慎先生', icon: '🐢', reserve: 6, debtRepay: 0.9,
      desc: '保守型：宁可少赚，也要留足现金。' },
    { id: 'balanced', name: '平衡小姐', icon: '🐱', reserve: 3, debtRepay: 0.6,
      desc: '稳健型：现金流优先，兼顾机会。' },
    { id: 'aggressive', name: '进取哥', icon: '🦊', reserve: 1, debtRepay: 0.2,
      desc: '进攻型：看到机会就上，敢用杠杆。' },
    { id: 'opportunist', name: '机会猎手', icon: '🦉', reserve: 2,  debtRepay: 0.35,
      desc: '灵活型：专挑回本快的资产下手。' },
    { id: 'teacher', name: '理财老师', icon: '🧑‍🏫', reserve: 4, debtRepay: 0.7,
      desc: '教科书型：先还债、再储蓄、后投资。' },
  ];

  /* ======================================================================
     十七、难度参数
     ====================================================================== */
  const MODES = {
    easy: {
      id: 'easy', name: '轻松', icon: '🌱',
      mult: { small: 0.70, big: 1.30 },   // 便宜的小资产多，适合攒第一桶金
      startCashMult: 1.6,                 // 起始现金更宽裕，容错高
      inflation: 0.015,
      accidentMult: 0.6,                  // 意外只按六折赔
      expenseCap: 2.5,
      maxRounds: 45,
      desc: '机会便宜、意外更轻、启动资金更多。适合第一次玩的小朋友，重点是先建立「买资产 → 收现金流」的正反馈。',
    },
    normal: {
      id: 'normal', name: '标准', icon: '⚖️',
      mult: { small: 1, big: 1 },
      startCashMult: 1,
      inflation: 0.03,
      accidentMult: 1,
      expenseCap: 3,
      maxRounds: 55,
      desc: '贴近真实生活的理财节奏：既会遇到好机会，也会遇到物价上涨和加息。推荐 10 岁以上。',
    },
    hard: {
      id: 'hard', name: '硬核', icon: '🔥',
      mult: { small: 0.9, big: 1.05 },
      startCashMult: 1,                   // 现金不再被砍——真正的难点在通胀和意外
      inflation: 0.07,                    // 生活费涨得更快，逼你早点建立起被动收入
      accidentMult: 1.8,                  // 意外更狠
      debtRateMult: 1.25,                 // 借钱更贵
      expenseCap: 3,
      maxRounds: 70,
      desc: '通胀更高、意外更狠、借钱更贵。你会真切体会「跑不赢通胀」的焦虑，以及为什么必须先有被动收入。',
    },
  };

  /* ======================================================================
     十八、常量
     ====================================================================== */
  const BOARD_SIZE = 38;
  const PLAYER_COLORS  = ['#4f6ef7', '#e8813a', '#17a673', '#e34b6d', '#8b5cf0', '#0e89b8'];
  const PLAYER_EMOJIS  = ['🐱', '🐶', '🐼', '🦊', '🐨', '🐸'];
  const DEBT_RATE      = 0.020;   // 每期负债利息率（默认 2.0%，约合年化 24%，接近真实的消费贷 / 信用贷水平）
  const EMERGENCY_LOAN = 12000;   // 现金为负时的紧急贷款额度
  const INSURANCE_COST = 1500;    // 保险费用
  const INSURANCE_COVER= 0.8;     // 保险理赔比例
  const START_BONUS    = 800;     // 停在起点的鼓励金
  const DREAM_BONUS    = 3000;    // 梦想实现的额外激励

  /* ======================================================================
     导出
     ====================================================================== */
  global.CFData = {
    CAREERS, CORNERS, EDGE_LAYOUTS, CELL_TEXT, buildBoard,
    SMALL_OPPS, BIG_OPPS, DEBT_OPPS,
    SPEND_CARDS, ACCIDENT_CARDS, MARKET_EVENTS, MARKET_OFFERS,
    STUDY_OFFERS, CHARITY_CARDS, DREAMS, PARTTIME_CARDS,
    TIPS, BADGES, AI_PERSONAS, MODES,
    BOARD_SIZE, PLAYER_COLORS, PLAYER_EMOJIS,
    DEBT_RATE, EMERGENCY_LOAN, INSURANCE_COST, INSURANCE_COVER,
    START_BONUS, DREAM_BONUS,
  };

})(window);
