/* ==========================================================================
   现金流小富翁 v2 · 梦想小镇 — 内容数据层
   股票 · 卡片道具 · 神明 · 命运/新闻事件
   全部声明式定义，效果执行见 game/cardsys.js 与 game/finance.js
   ========================================================================== */
(function (global) {
  'use strict';

  /* ======================================================================
     一、股票（4 只：波动率从低到高，教学「风险与收益成正比」）
     price 语义：每股价格 × 100 股为一手
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
     二、卡片道具（12 张，致敬大富翁4）
     effect.kind 对应 cardsys.js 中 CARD_EFFECTS 注册表
     target: self(自己) / enemy(选对手) / estate(选地产) / enemy-estate(选对手地产)
     ====================================================================== */
  const CARDS = [
    { id: 'tele_dice', name: '遥控骰子', icon: '🎛️', price: 3000,
      desc: '下次掷骰时，自选 1-6 的点数。',
      effect: { kind: 'fixedDice' }, target: 'self',
      teach: '确定性本身就是一种资源——能控制结果的人，才配谈策略。' },
    { id: 'buyland', name: '购地卡', icon: '📜', price: 5000,
      desc: '把一块「无主」的地按原价买下来（即使不在那格）。',
      effect: { kind: 'buyLand' }, target: 'estate-empty',
      teach: '机会来的时候，手里有工具的人才能抓住。' },
    { id: 'swapland', name: '换地卡', icon: '🔄', price: 4500,
      desc: '用自己的一块地和对手的一块地交换。',
      effect: { kind: 'swapLand' }, target: 'swap',
      teach: '对你没用的地，可能是对手的关键拼图。交易才能创造价值。' },
    { id: 'rob', name: '抢夺卡', icon: '🦝', price: 2500,
      desc: '从指定对手手中抢走一张卡片。',
      effect: { kind: 'robCard' }, target: 'enemy',
      teach: '小心：你抢得走别人的卡，别人也抢得走你的。' },
    { id: 'sleepy', name: '梦游卡', icon: '💤', price: 2000,
      desc: '指定对手下回合无法行动。',
      effect: { kind: 'skipTurn' }, target: 'enemy',
      teach: '时间是零成本资源——让对手「停一拍」，就是给自己争取一拍。' },
    { id: 'monster', name: '怪兽卡', icon: '🦖', price: 5000,
      desc: '拆毁任意一块地产上的一层建筑。',
      effect: { kind: 'demolish' }, target: 'estate-built',
      teach: '破坏永远比建设便宜。这也是为什么防守（保险/福神）有价值。' },
    { id: 'roadblock', name: '路障卡', icon: '🚧', price: 1500,
      desc: '在任意一格放置路障，任何人踩到都会停下。',
      effect: { kind: 'roadblock' }, target: 'cell',
      teach: '让对手停在你的高租地段上，一档小小的路障价值千金。' },
    { id: 'bomb', name: '炸弹卡', icon: '💣', price: 4000,
      desc: '炸毁一块地产上的全部建筑，主人被送进医院。',
      effect: { kind: 'bomb' }, target: 'estate-built',
      teach: '损人不利己的卡尽量少用——但如果对手快垄断了，就是另一回事。' },
    { id: 'freecard', name: '免费卡', icon: '🛡️', price: 2000,
      desc: '免除本次需支付的一笔钱（租金/医药费/罚金）。',
      effect: { kind: 'freePass' }, target: 'self',
      teach: '保险思维：花小钱，避免大额的一次性支出。' },
    { id: 'robot', name: '机器娃娃', icon: '🤖', price: 1200,
      desc: '清除棋盘上所有路障。',
      effect: { kind: 'clearRoadblock' }, target: 'self',
      teach: '工具克制工具。再厉害的战术也有克星。' },
    { id: 'angel', name: '天使卡', icon: '😇', price: 3000,
      desc: '清除自己身上的坏神（穷神/衰神）。',
      effect: { kind: 'cleanse' }, target: 'self',
      teach: '坏运气不是惩罚，是提醒：该检查一下自己的风险敞口了。' },
    { id: 'equal', name: '均富卡', icon: '⚖️', price: 4000,
      desc: '全体玩家的现金平均分配。',
      effect: { kind: 'equalize' }, target: 'self',
      teach: '落后时它是翻盘神器，领先时它是灾难——用之前先看看排行榜。' },
  ];

  /* 道具店随机上架的卡池（价格 = CARDS.price × 0.8 商店价） */
  const SHOP_POOL = CARDS.map(c => c.id);

  /* ======================================================================
     三、神明（4 位，附身机制）
     hooks 声明式，执行见 cardsys.js
     ====================================================================== */
  const GODS = {
    fortune: { id: 'fortune', name: '财神', icon: '🧧', color: '#d99a2b', good: true,
      desc: '附身期间，你的所有现金收入 ×2！',
      teach: '好运气来的时候，最重要的是手里已经有资产——财神只会放大你已有的现金流。' },
    bless: { id: 'bless', name: '福神', icon: '🛡️', color: '#4f6ef7', good: true,
      desc: '附身期间，厄运事件对你无效，坏卡对你无效。',
      teach: '福神就是「保险」的化身：平时看不见用处，出事的时候才知道值钱。' },
    poor: { id: 'poor', name: '穷神', icon: '🕳️', color: '#7f8c9b', good: false,
      desc: '附身期间，你的所有现金收入减半。',
      teach: '穷神的可怕不在于让你变穷，而在于它趁你「正需要钱」的时候来。' },
    decay: { id: 'decay', name: '衰神', icon: '🌩️', color: '#6c5ce7', good: false,
      desc: '每个回合结束扣你 500 元，厄运事件伤害 ×2。',
      teach: '衰神缠身时最好的策略是防守：别扩张、别冒险、等它走。' },
  };

  /* ======================================================================
     四、命运卡（个人事件，好坏概率各半）
     effect.kind: cash / card / ticket / move / jail / hospital / god / stock
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
  ];

  /* ======================================================================
     五、新闻事件（全体玩家，含股价驱动，回收 v1 市场事件文案精华）
     effect.kind: cashAll / cashAllPct / stock(股价事件) / rentUp / rentDown / lottery
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
  ];

  global.CFContent = { STOCKS, CARDS, SHOP_POOL, GODS, CHANCES, NEWS };
})(window);
