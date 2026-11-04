/* ==========================================================================
   现金流小富翁 v3 · 内容数据层
   股票 · 32 张卡片道具 · 8 位神明 · 魔法屋惩罚 · 小游戏 · 命运/新闻事件
   全部声明式定义，效果执行见 game/cardsys.js 与 game/finance.js
   ========================================================================== */
(function (global) {
  'use strict';

  /* ======================================================================
     一、股票（4 只：波动率从低到高，教学「风险与收益成正比」）
     ====================================================================== */
  const STOCKS = [
    { id: 'bread',  name: '面包股份', icon: '🍞', base: 60,
      vol: 0.07,  desc: '人人都要吃面包。慢，但稳。',
      teach: '低波动的股票像债券：赚得慢，但很难让你睡不着觉。' },
    { id: 'candy',  name: '糖果股份', icon: '🍬', base: 25,
      vol: 0.10,  desc: '小朋友的最爱，节日行情火爆。',
      teach: '消费类公司跟着季节波动，低买高卖才有利润。' },
    { id: 'tech',   name: '科技股份', icon: '🚀', base: 120,
      vol: 0.14,  desc: '小镇最热门的公司，涨得快跌得也快。',
      teach: '热门股波动大：能让你翻倍，也能让你腰斩。仓位控制是第一课。' },
    { id: 'ocean',  name: '深海股份', icon: '🐋', base: 8,
      vol: 0.20,  desc: '传说在深海发现了宝藏，也可能什么都没有。',
      teach: '妖股的每一分收益都是别人交的学费。小仓位试错，别押身家。' },
  ];

  /* ======================================================================
     二、卡片道具（32 张，对齐大富翁4Fun 的道具体系）
     effect.kind 对应 cardsys.js 中 execCard 的 switch 分支
     target: self / enemy / estate-empty / estate-built / cell / swap
     所有卡片对 AI 都必须能自动选目标，绝不进入交互式弹窗。
     ====================================================================== */
  const CARDS = [
    /* ---- 控制步数 ---- */
    { id: 'tele_dice', name: '遥控骰子', icon: '🎛️', price: 3000,
      desc: '下回合自选骰子总点数（2-12）。',
      effect: { kind: 'fixedDice' }, target: 'self',
      teach: '确定性本身就是一种资源——能控制结果的人，才配谈策略。' },
    { id: 'motorcycle', name: '机车卡', icon: '🏍️', price: 2600,
      desc: '下回合掷骰后额外前进 3 格。',
      effect: { kind: 'bonusSteps', value: 3 }, target: 'self',
      teach: '速度能带来机会，也能让你一头撞上别人的高租金地段。' },
    { id: 're_roll', name: '再来一次', icon: '🔁', price: 4200,
      desc: '本回合结束后立刻获得一个额外回合。',
      effect: { kind: 'extraTurn' }, target: 'self',
      teach: '多一次行动 = 多一次复利的机会。时间是最被低估的资产。' },
    { id: 'move_card', name: '传送卡', icon: '🌀', price: 2800,
      desc: '立刻移动到指定格子（下回合从那里出发）。',
      effect: { kind: 'moveTo' }, target: 'cell',
      teach: '换个位置，有时比多走几步更重要。' },
    { id: 'roadblock', name: '路障卡', icon: '🚧', price: 1500,
      desc: '在任意一格放置路障，任何人踩到都会停下。',
      effect: { kind: 'roadblock' }, target: 'cell',
      teach: '让对手停在你的高租地段上，一档小小的路障价值千金。' },
    { id: 'robot', name: '机器娃娃', icon: '🤖', price: 1200,
      desc: '清除棋盘上所有路障。',
      effect: { kind: 'clearRoadblock' }, target: 'self',
      teach: '工具克制工具。再厉害的战术也有克星。' },

    /* ---- 地产经营 ---- */
    { id: 'buyland', name: '购地卡', icon: '📜', price: 5000,
      desc: '把一块「无主」的地按原价买下来（即使不在那格）。',
      effect: { kind: 'buyLand' }, target: 'estate-empty',
      teach: '机会来的时候，手里有工具的人才能抓住。' },
    { id: 'swapland', name: '换地卡', icon: '🔄', price: 4500,
      desc: '用自己的一块地和对手的一块地交换。',
      effect: { kind: 'swapLand' }, target: 'swap',
      teach: '对你没用的地，可能是对手的关键拼图。交易才能创造价值。' },
    { id: 'raise', name: '涨价卡', icon: '📈', price: 3200,
      desc: '3 天内自己所有地产的租金 ×1.5。',
      effect: { kind: 'rentBoost', value: 1.5, days: 3 }, target: 'self',
      teach: '提高单价是最直接的增收方式——但前提是你已经有资产在收租。' },
    { id: 'double_rent', name: '加倍卡', icon: '✖️', price: 3800,
      desc: '3 天内自己所有地产的租金 ×2。',
      effect: { kind: 'doubleRent', days: 3 }, target: 'self',
      teach: '同样的资产，规则一变，现金流就翻倍。先建资产，再找杠杆。' },
    { id: 'seal', name: '查封卡', icon: '⛔', price: 3000,
      desc: '指定对手一块已盖房的地，3 天内无法收租。',
      effect: { kind: 'sealEstate', days: 3 }, target: 'estate-built',
      teach: '现金流被掐断，比资产减值更致命。看报表时先看现金流那一栏。' },
    { id: 'force_auction', name: '拍卖卡', icon: '🔨', price: 5500,
      desc: '强制把对手一块地拿去银行公开拍卖。',
      effect: { kind: 'forceAuction' }, target: 'estate-built',
      teach: '产权不是永恒的。规则、税费、拍卖，都可能让资产易主。' },
    { id: 'monster', name: '怪兽卡', icon: '🦖', price: 5000,
      desc: '拆毁任意一块地产上的一层建筑。',
      effect: { kind: 'demolish' }, target: 'estate-built',
      teach: '破坏永远比建设便宜。这也是为什么防守（保险/福神）有价值。' },
    { id: 'bomb', name: '炸弹卡', icon: '💣', price: 4000,
      desc: '炸毁一块地产上的全部建筑，主人被送进医院。',
      effect: { kind: 'bomb' }, target: 'estate-built',
      teach: '损人不利己的卡尽量少用——但如果对手快垄断了，就是另一回事。' },

    /* ---- 陷害 / 防御 ---- */
    { id: 'sleepy', name: '梦游卡', icon: '💤', price: 2000,
      desc: '指定对手下回合无法行动。',
      effect: { kind: 'skipTurn' }, target: 'enemy',
      teach: '时间是零成本资源——让对手「停一拍」，就是给自己争取一拍。' },
    { id: 'timed_bomb', name: '定时炸弹', icon: '⏱️', price: 3400,
      desc: '给对手挂上炸弹，3 天后爆炸：住院 2 回合 + 罚款。',
      effect: { kind: 'timedBomb', days: 3 }, target: 'enemy',
      teach: '有些风险不会立刻爆，但一直挂在你身上。别只看今天有没有出事。' },
    { id: 'jail_card', name: '入狱卡', icon: '🚓', price: 3600,
      desc: '把指定对手直接送进监狱。',
      effect: { kind: 'sendJail' }, target: 'enemy',
      teach: '失去行动自由的代价，往往比罚款更大。' },
    { id: 'hospital_card', name: '住院卡', icon: '🏥', price: 3200,
      desc: '把指定对手送进医院休养 3 回合。',
      effect: { kind: 'sendHospital' }, target: 'enemy',
      teach: '健康也是资产：一旦停摆，收入立刻断流。' },
    { id: 'tax', name: '查税卡', icon: '🧾', price: 2800,
      desc: '对手按持有地产数缴税（每块 600）。',
      effect: { kind: 'taxEnemy', value: 600 }, target: 'enemy',
      teach: '持有资产是有成本的：税、维护、折旧，一样都跑不掉。' },
    { id: 'rob', name: '抢夺卡', icon: '🦝', price: 2500,
      desc: '从指定对手手中抢走一张卡片。',
      effect: { kind: 'robCard' }, target: 'enemy',
      teach: '小心：你抢得走别人的卡，别人也抢得走你的。' },
    { id: 'steal_cash', name: '抢钱卡', icon: '💸', price: 3000,
      desc: '从指定对手手里拿走 2,000 现金。',
      effect: { kind: 'stealCash', value: 2000 }, target: 'enemy',
      teach: '零和博弈：你多拿的，正是别人少掉的。' },
    { id: 'freecard', name: '免费卡', icon: '🛡️', price: 2000,
      desc: '免除本次需支付的一笔钱（租金/医药费/罚金）。',
      effect: { kind: 'freePass' }, target: 'self',
      teach: '保险思维：花小钱，避免大额的一次性支出。' },
    { id: 'shield', name: '免罪卡', icon: '🦉', price: 2600,
      desc: '3 天内免疫所有厄运事件与坏卡。',
      effect: { kind: 'shield', days: 3 }, target: 'self',
      teach: '风险管理不是消灭风险，是提前给它划一条止损线。' },
    { id: 'guardian', name: '守护卡', icon: '🛡️', price: 3800,
      desc: '5 天内免疫所有厄运事件与坏卡（免罪卡加强版）。',
      effect: { kind: 'shield', days: 5 }, target: 'self',
      teach: '保障期越长越贵，但真正值钱的不是那几天，是你敢在这几天里放手做事。' },
    { id: 'angel', name: '天使卡', icon: '😇', price: 3000,
      desc: '清除自己身上的坏神（穷神/衰神/恶魔）。',
      effect: { kind: 'cleanse' }, target: 'self',
      teach: '坏运气不是惩罚，是提醒：该检查一下自己的风险敞口了。' },

    /* ---- 财运 ---- */
    { id: 'cash_gift', name: '红包卡', icon: '🧧', price: 1800,
      desc: '立刻获得 2,000 现金。',
      effect: { kind: 'cashGift', value: 2000 }, target: 'self',
      teach: '一次性收入花完就没了，把它变成资产才有后续。' },
    { id: 'equal', name: '均富卡', icon: '⚖️', price: 4000,
      desc: '全体玩家的现金平均分配。',
      effect: { kind: 'equalize' }, target: 'self',
      teach: '落后时它是翻盘神器，领先时它是灾难——用之前先看看排行榜。' },
    { id: 'stock_tip', name: '内线卡', icon: '📊', price: 2400,
      desc: '随机一只股票立刻上涨 20%。',
      effect: { kind: 'stockTip', rate: 0.2 }, target: 'self',
      teach: '「消息」能短期改变价格，改变不了价值。别把运气当能力。' },
    { id: 'lottery_card', name: '彩票卡', icon: '🎟️', price: 1600,
      desc: '免费获得一张随机号码的乐透彩票。',
      effect: { kind: 'freeLottery' }, target: 'self',
      teach: '免费拿到的彩票也是负期望——只是你没有付那 500 元而已。' },

    /* ---- 请神 ---- */
    { id: 'landgod_card', name: '土地公卡', icon: '🏡', price: 5200,
      desc: '请土地公附身：所到之地都能据为己有。',
      effect: { kind: 'summonGod', god: 'landgod' }, target: 'self',
      teach: '最强的「收入」是直接拿到资产本身，而不只是现金。' },
    { id: 'angelgod_card', name: '天使神卡', icon: '👼', price: 4600,
      desc: '请天使附身：路过自己的地自动免费加盖一层。',
      effect: { kind: 'summonGod', god: 'angel' }, target: 'self',
      teach: '复利的关键不是多赚钱，而是让已有的资产自动升级。' },
    { id: 'devil_card', name: '恶魔卡', icon: '😈', price: 4200,
      desc: '请恶魔附身：路过任何地产拆掉一层。',
      effect: { kind: 'summonGod', god: 'devil' }, target: 'self',
      teach: '破坏型策略能拖慢对手，但不会让你自己变富。' },
  ];

  /* 道具店随机上架的卡池（价格 = CARDS.price × 0.8 商店价） */
  const SHOP_POOL = CARDS.map(c => c.id);

  /* ======================================================================
     三、神明（8 位，附身机制；大/小神通过 turns 区分）
     hooks 声明式，执行见 cardsys.js
     ====================================================================== */
  const GODS = {
    fortune: { id: 'fortune', name: '财神', icon: '🧧', color: '#d99a2b', good: true, turns: 8,
      desc: '附身期间，你的所有现金收入 ×2！',
      teach: '好运气来的时候，最重要的是手里已经有资产——财神只会放大你已有的现金流。' },
    bless: { id: 'bless', name: '福神', icon: '🛡️', color: '#4f6ef7', good: true, turns: 6,
      desc: '附身期间，厄运事件对你无效，坏卡对你无效。',
      teach: '福神就是「保险」的化身：平时看不见用处，出事的时候才知道值钱。' },
    landgod: { id: 'landgod', name: '土地公', icon: '🏡', color: '#8b5cf0', good: true, turns: 5,
      desc: '附身期间，你所到之处的无主地自动归你；有主地可强行征收（付地价）。',
      teach: '土地公把「路过」变成「收购」——行动本身就是投资。' },
    angel: { id: 'angel', name: '天使', icon: '👼', color: '#7fc8f8', good: true, turns: 6,
      desc: '附身期间，路过自己的地免费加盖一层房屋。',
      teach: '天使是最纯粹的复利：你什么都不用做，资产自己长大。' },
    poor: { id: 'poor', name: '穷神', icon: '🕳️', color: '#7f8c9b', good: false, turns: 8,
      desc: '附身期间，你的所有现金收入减半。',
      teach: '穷神的可怕不在于让你变穷，而在于它趁你「正需要钱」的时候来。' },
    decay: { id: 'decay', name: '衰神', icon: '🌩️', color: '#6c5ce7', good: false, turns: 6,
      desc: '每个回合结束扣你 500 元，厄运事件伤害 ×2。',
      teach: '衰神缠身时最好的策略是防守：别扩张、别冒险、等它走。' },
    devil: { id: 'devil', name: '恶魔', icon: '😈', color: '#c0392b', good: false, turns: 5,
      desc: '附身期间，你所到之处一律拆掉一层房屋（含自己的）。',
      teach: '恶魔不分敌我。无差别破坏的工具，用时先算算自己会赔多少。' },
    dog: { id: 'dog', name: '恶犬', icon: '🐕', color: '#a0522d', good: false, turns: 1,
      desc: '被恶犬咬伤，立刻进医院休养 3 回合（开车状态可免疫）。',
      teach: '意外风险要用「现金垫 + 保险」来接，而不是祈祷它别发生。' },
  };

  /* 大小神：同一种神 30% 概率为「大神」，持续回合 ×1.5、效果更强 */
  const GOD_TIERS = {
    big: { label: '大', multiplier: 1.5, chance: 0.3 },
    small: { label: '小', multiplier: 1, chance: 0.7 },
  };

  /* ======================================================================
     四、魔法屋：女巫选人 → 玩家决定惩罚
     ====================================================================== */
  const MAGIC_PUNISHMENTS = [
    { id: 'cash', icon: '💸', name: '破财', desc: '损失 2,000 现金', teach: '现金是最容易被事件击中的资产。' },
    { id: 'jail', icon: '🔒', name: '牢狱之灾', desc: '关进监狱 2 回合', teach: '失去行动自由，比损失一笔钱更贵。' },
    { id: 'hospital', icon: '🏥', name: '病来如山倒', desc: '住院 3 回合', teach: '健康与自由，都是看不见的资产。' },
    { id: 'demolish', icon: '🦖', name: '房屋倒塌', desc: '随机一块地产降一级', teach: '资产也会折旧，别把账面价值当成永恒。' },
    { id: 'card', icon: '🃏', name: '失物咒', desc: '随机失去一张手牌', teach: '工具也是资产，丢了才知道它的价值。' },
    { id: 'tax', icon: '🧾', name: '补税通知', desc: '按地产数补缴税款', teach: '持有越多，被征税的敞口越大。' },
  ];

  /* ======================================================================
     五、游乐场小游戏（赚点券换卡片）
     ====================================================================== */
  const MINIGAMES = [
    { id: 'catch', name: '接金币', icon: '🪙', desc: '看准从天上掉下来的金币，点住它！',
      teach: '主动收入要「动手」才有，被动收入是别人替你动手。' },
    { id: 'shoot', name: '射神明', icon: '🎯', desc: '射中好神得点券，射中坏神倒扣！',
      teach: '不是所有看起来像机会的东西都是机会，先看清再出手。' },
    { id: 'rabbit', name: '猜兔子', icon: '🐰', desc: '兔子藏在三个杯子之一，猜中就有奖。',
      teach: '猜中的概率是 1/3。靠运气赚来的，迟早靠运气还回去。' },
  ];

  /* ======================================================================
     六、命运卡（个人事件，好坏概率各半）
     ====================================================================== */
  const CHANCES = [
    { icon: '🎉', text: '生日快乐！收到亲友红包', effect: { kind: 'cash', value: 2000 }, good: true,
      teach: '意外之财最容易变成意外消费——先存一半。' },
    { icon: '🪙', text: '在路边捡到零钱', effect: { kind: 'cash', value: 800 }, good: true },
    { icon: '📱', text: '手机摔坏了，修理费好贵', effect: { kind: 'cash', value: -1500 }, good: false,
      teach: '这就是为什么要留应急现金。' },
    { icon: '🏥', text: '吃坏肚子进医院，医药费 + 休养', effect: { kind: 'hospital' }, good: false,
      teach: '医院 = 被动失去回合 + 现金损失。健康也是资产。' },
    { icon: '🎁', text: '好运连连！免费获得一张卡片', effect: { kind: 'card' }, good: true },
    { icon: '🎫', text: '参加活动获奖，得到 3 张点券', effect: { kind: 'ticket', value: 3 }, good: true },
    { icon: '🎲', text: '命运之风：直接前进 3 格', effect: { kind: 'move', steps: 3 }, good: true },
    { icon: '🎯', text: '踩到香蕉皮滑倒……后退 3 格', effect: { kind: 'move', steps: -3 }, good: false },
    { icon: '✨', text: '路遇神仙！随机附身一位神明', effect: { kind: 'god' }, good: true },
    { icon: '💸', text: '被小偷光顾，损失现金 10%', effect: { kind: 'cashPct', value: -0.10 }, good: false,
      teach: '现金放在家里会丢，放在银行有利息——形式本身就有价值。' },
    { icon: '📈', text: '内线消息！随机一只股票明日上涨', effect: { kind: 'stockTip' }, good: true,
      teach: '「内幕消息」真的可靠吗？想想谁告诉你的、他为什么告诉你。' },
    { icon: '🤝', text: '帮邻居干活赚零花钱', effect: { kind: 'cash', value: 1200 }, good: true,
      teach: '劳动收入（主动收入）永远是最踏实的第一桶金。' },
    { icon: '🐕', text: '被恶犬追了三条街！', effect: { kind: 'god', force: 'dog' }, good: false,
      teach: '意外风险要用「现金垫 + 保险」来接，而不是祈祷它别发生。' },
    { icon: '🔮', text: '误入魔法屋，女巫对你施了法', effect: { kind: 'magic' }, good: false,
      teach: '有些事你控制不了，能控制的只有自己的准备程度。' },
  ];

  /* ======================================================================
     七、新闻事件（全体玩家，含股价驱动）
     ====================================================================== */
  const NEWS = [
    { icon: '📈', name: '牛市来了', text: '小镇股市一片红火！',
      effect: { kind: 'stock', target: 'all', rate: 0.25 },
      teach: '牛市里人人都像天才。真正考验人的，是熊市来的时候。' },
    { icon: '📉', name: '股市大跌', text: '恐慌抛售！股价集体跳水。',
      effect: { kind: 'stock', target: 'all', rate: -0.30 },
      teach: '下跌时你的股份没变少，只是报价便宜了。别慌，也别贪。' },
    { icon: '🍬', name: '糖果节开幕', text: '糖果股份供不应求！',
      effect: { kind: 'stock', target: 'candy', rate: 0.35 } },
    { icon: '🐋', name: '深海传说破灭', text: '宝藏传闻被证实是谣言。',
      effect: { kind: 'stock', target: 'ocean', rate: -0.40 },
      teach: '靠故事涨起来的价格，故事破灭时跌得最狠。' },
    { icon: '🎉', name: '小镇庆典', text: '人人有红包！每人 +1,000。',
      effect: { kind: 'cashAll', value: 1000 } },
    { icon: '🌧️', name: '暴雨成灾', text: '房屋受损，每人维修费 1,000。',
      effect: { kind: 'cashAll', value: -1000 },
      teach: '拥有越多房产，这种全体事件的敞口就越大。分散配置！' },
    { icon: '🏛️', name: '房产税开征', text: '每块地产缴税 300。',
      effect: { kind: 'taxEstate', value: 300 },
      teach: '持有资产不只是收租——还有持有成本。' },
    { icon: '💼', name: '打工旺季', text: '人人加班费到账！津贴补发 50%。',
      effect: { kind: 'cashAllSalary', rate: 0.5 } },
    { icon: '🎰', name: '乐透池暴涨', text: '神秘富豪向奖池捐款 5,000！',
      effect: { kind: 'lotteryPot', value: 5000 } },
    { icon: '🧧', name: '财神爷路过', text: '财神给每位玩家送上 1,500。',
      effect: { kind: 'cashAll', value: 1500 } },
    { icon: '🏚️', name: '旅游淡季', text: '本圈内所有租金收入减半（持续 1 圈）。',
      effect: { kind: 'rentMod', rate: 0.5, rounds: 1 },
      teach: '租金收入也有周期性——这就是为什么大亨们会同时持有股票和地产。' },
    { icon: '🌊', name: '旅游旺季', text: '本圈内所有租金收入 ×1.5（持续 1 圈）。',
      effect: { kind: 'rentMod', rate: 1.5, rounds: 1 } },
    { icon: '🏗️', name: '建材涨价', text: '物价指数上扬，全镇地价与租金水涨船高。',
      effect: { kind: 'indexUp', value: 0.2 },
      teach: '通胀不只让东西变贵，也让你收的租变多——但你的欠款和支出同样在涨。' },
  ];

  global.CFContent = {
    STOCKS, CARDS, SHOP_POOL, GODS, GOD_TIERS,
    MAGIC_PUNISHMENTS, MINIGAMES, CHANCES, NEWS,
  };
})(window);
