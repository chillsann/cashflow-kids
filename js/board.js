/* ==========================================================================
   现金流小富翁 v3.1 · 棋盘渲染层（2.5D 立体绘本）
   SVG 参数化建筑（L0 空地 → L4 酒店 + 4 种特殊建筑）
   街区色带 · 产权标记 · 持久棋子（平滑移动）· 3D 骰子
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.UI;
  const W = global.CFWorld;

  /* ======================================================================
     一、SVG 建筑生成（参数化：同函数随 level 变外观）
     ====================================================================== */

  /* ======================================================================
     一、SVG 建筑生成（v3.1 · 2.5D 斜二测立体建筑，来自已确认的视觉样张）
     正面矩形 + 顶面平行四边形 + 右侧面；建筑按街区取柔和色，
     产权仍由格子边框与小旗区分，避免高饱和玩家色堆叠。
     ====================================================================== */
  const INK = '#3A4A5C';
  const DISTRICT_TONE = {
    breakfast:'#E9C173', candy:'#E9AFBB', dessert:'#C1A9DA', milktea:'#DFAE85',
    beach:'#8FC3D2', funfair:'#93A9DF', jewel:'#8FC5AC', star:'#DC9A86'
  };

function prism(x,y,w,h,d,c){
  const top=shade(c,20), front=shade(c,6), side=shade(c,-16);
  return '<path d="M'+x+' '+y+' l'+d+' -'+(d*.6)+' h'+w+' l-'+d+' '+(d*.6)+' Z" fill="'+top+'" stroke="'+INK+'" stroke-width="1.15" stroke-linejoin="round"/>'+
    '<path d="M'+(x+w)+' '+y+' l'+d+' -'+(d*.6)+' v'+h+' l-'+d+' '+(d*.6)+' Z" fill="'+side+'" stroke="'+INK+'" stroke-width="1.15" stroke-linejoin="round"/>'+
    '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="1.2" fill="'+front+'" stroke="'+INK+'" stroke-width="1.15"/>';
}
function windows(x,y,cols,rows,gap,cls){
  let s='';
  for(let r=0;r<rows;r++)for(let k=0;k<cols;k++){
    s+='<rect class="'+(cls||'win')+'" x="'+(x+k*gap)+'" y="'+(y+r*(gap*1.05))+'" width="4.3" height="4.6" rx=".9" fill="#FFF6E2" stroke="'+INK+'" stroke-width=".7"/>';
  }
  return s;
}
function gable(x,y,w,d,c){
  /* 坡屋顶：正面人字 + 右侧斜面 */
  const roof=shade(c,-8), side=shade(c,-24);
  const apexX=x+w/2, apexY=y-9;
  return '<path d="M'+(x+w)+' '+y+' L'+(apexX+d)+' '+(apexY-d*.6)+' L'+(apexX)+' '+apexY+' L'+x+' '+y+' Z" fill="'+side+'" stroke="'+INK+'" stroke-width="1.15" stroke-linejoin="round"/>'+
    '<path d="M'+(x-1.5)+' '+y+' L'+apexX+' '+apexY+' L'+(x+w+1.5)+' '+y+' Z" fill="'+roof+'" stroke="'+INK+'" stroke-width="1.25" stroke-linejoin="round"/>';
}
function houseSVG(level,color){
  const c=color||'#C9B7A0';
  const ink=INK;
  let s='<svg viewBox="0 0 48 52" class="b-svg" xmlns="http://www.w3.org/2000/svg">';
  /* 地面投影 */
  s+='<ellipse cx="24" cy="46" rx="16" ry="3.8" fill="rgba(58,74,92,.15)"/>';

  if(level===0){
    /* 空地：草丘 + 小树 + 草丛 + 出售木牌（让 24 块空地也有画面感） */
    s+='<path d="M6 45 Q24 34 42 45 Z" fill="#CFE0B4" stroke="'+ink+'" stroke-width="1.25" stroke-linejoin="round"/>';
    s+='<path d="M10 44 Q24 38 38 44" fill="none" stroke="#A8C68C" stroke-width="1" opacity=".8"/>';
    s+='<rect x="11.6" y="30" width="2.8" height="13" rx="1.2" fill="#B98B5E" stroke="'+ink+'" stroke-width=".9"/>';
    s+='<circle cx="13" cy="27.5" r="6.4" fill="#A8C68C" stroke="'+ink+'" stroke-width="1.25"/>';
    s+='<circle cx="8.6" cy="31" r="3.9" fill="#B9D29C" stroke="'+ink+'" stroke-width="1"/>';
    s+='<circle cx="17" cy="30.5" r="3.4" fill="#9DBE82" stroke="'+ink+'" stroke-width="1"/>';
    s+='<path d="M31 43 l1.4 -4.4 M34 43 l2 -3.4 M37 43 l1.2 -4" stroke="#8FAE79" stroke-width="1.3" stroke-linecap="round" fill="none"/>';
    s+='<rect x="22.6" y="33" width="2.6" height="11" rx="1" fill="#B98B5E" stroke="'+ink+'" stroke-width="1"/>';
    s+='<rect x="17" y="24.5" width="14" height="10" rx="2" fill="#F6E7C6" stroke="'+ink+'" stroke-width="1.3"/>';
    s+='<text x="24" y="31.9" font-size="6.4" text-anchor="middle" fill="'+ink+'" font-weight="900" font-family="sans-serif">出售</text>';
  }else if(level===1){
    s+=prism(14,27,18,15,5,c);
    s+=gable(14,27,18,5,c);
    s+=windows(16,31,3,1,5.5);
    s+='<rect x="21" y="36" width="5.5" height="6" rx="1" fill="'+shade(c,-30)+'" stroke="'+ink+'" stroke-width=".9"/>';
  }else if(level===2){
    s+=prism(13,22,20,20,5,c);
    s+=gable(13,22,20,5,c);
    s+='<rect x="28" y="10" width="3.6" height="8" rx="1" fill="'+shade(c,-26)+'" stroke="'+ink+'" stroke-width="1"/>';
    s+=windows(15,26,3,2,6);
    s+='<rect x="21" y="35" width="5.5" height="7" rx="1" fill="'+shade(c,-30)+'" stroke="'+ink+'" stroke-width=".9"/>';
  }else if(level===3){
    s+=prism(12,18,21,24,6,c);
    s+='<rect x="10.5" y="15.5" width="24" height="3.4" rx="1.2" fill="'+shade(c,-12)+'" stroke="'+ink+'" stroke-width="1.1"/>';
    s+=windows(14.5,21,3,3,6);
    s+='<rect x="20.5" y="35" width="6" height="7" rx="1" fill="'+shade(c,-32)+'" stroke="'+ink+'" stroke-width=".9"/>';
  }else if(level===4){
    s+=prism(10,16,25,26,6,c);
    s+='<rect x="8.5" y="13.5" width="28" height="3.6" rx="1.3" fill="'+shade(c,-12)+'" stroke="'+ink+'" stroke-width="1.1"/>';
    s+='<path d="M22.5 13.5 V6 l7 2.4 -7 2.4" fill="#F0C86A" stroke="'+ink+'" stroke-width=".9" stroke-linejoin="round"/>';
    s+='<rect x="14" y="19" width="17" height="5" rx="1.4" fill="#F6D98C" stroke="'+ink+'" stroke-width="1"/>';
    s+='<text x="22.5" y="23.1" font-size="4" text-anchor="middle" fill="'+ink+'" font-weight="900" font-family="sans-serif">HOTEL</text>';
    s+=windows(13,26,4,2,5.6);
    s+='<rect x="20" y="35" width="6" height="7" rx="1" fill="'+shade(c,-32)+'" stroke="'+ink+'" stroke-width=".9"/>';
  }else{
    /* L5 星级酒店：塔楼 + 皇冠 + 五星 */
    s+=prism(11,17,23,25,6,c);
    s+='<rect x="17" y="8" width="12" height="9" rx="1.5" fill="'+shade(c,-10)+'" stroke="'+ink+'" stroke-width="1.2"/>';
    s+='<path d="M16.5 8 l2.4 -3 2.6 3 2 -3.6 2 3.6 2.6 -3 2.4 3 Z" fill="#F0C86A" stroke="'+ink+'" stroke-width=".9" stroke-linejoin="round"/>';
    s+='<rect x="13" y="19" width="19" height="4.6" rx="1.2" fill="#F6D98C" stroke="'+ink+'" stroke-width="1"/>';
    s+='<text x="22.5" y="22.6" font-size="4.2" text-anchor="middle" fill="'+ink+'" font-weight="900" font-family="sans-serif">★★★★★</text>';
    s+=windows(13,25,3,2,6.4);
    s+='<rect x="20" y="35" width="6" height="7" rx="1" fill="'+shade(c,-32)+'" stroke="'+ink+'" stroke-width=".9"/>';
    s+='<circle cx="6" cy="24" r="1.1" fill="#F0C86A"/><circle cx="42" cy="30" r="1.1" fill="#F0C86A"/>';
  }
  return s+'</svg>';
}

  /* 特殊建筑 */
  function specialSVG(kind) {
    switch (kind) {
      case 'park':
        return '<svg viewBox="0 0 48 48" class="b-svg">' +
          '<ellipse cx="24" cy="41" rx="17" ry="4" fill="#bfe3a8"/>' +
          '<circle cx="16" cy="26" r="7" fill="#6fbf58" stroke="#4d9440" stroke-width="1"/>' +
          '<circle cx="31" cy="24" r="8.5" fill="#7fca68" stroke="#4d9440" stroke-width="1"/>' +
          '<rect x="22.8" y="28" width="2.6" height="12" rx="1" fill="#8a5c3a"/>' +
          '<ellipse cx="24" cy="16" rx="3" ry="1.6" fill="#cfe8ff" stroke="#8bb8d8" stroke-width=".7"/>' +
          '</svg>';
      case 'mall':
        return '<svg viewBox="0 0 48 48" class="b-svg">' +
          '<rect x="8" y="19" width="32" height="22" rx="2" fill="#f3e9f7" stroke="#a97bc0" stroke-width="1"/>' +
          '<rect x="8" y="19" width="32" height="6" rx="2" fill="#b07de0"/>' +
          '<rect x="12" y="28" width="9" height="10" rx="1" fill="#fff" stroke="#a97bc0" stroke-width=".8"/>' +
          '<rect x="27" y="28" width="9" height="10" rx="1" fill="#fff" stroke="#a97bc0" stroke-width=".8"/>' +
          '<rect x="21" y="30" width="6" height="11" rx="1" fill="#a97bc0"/>' +
          '<text x="24" y="16" font-size="7" text-anchor="middle">🛍️</text>' +
          '</svg>';
      case 'station':
        return '<svg viewBox="0 0 48 48" class="b-svg">' +
          '<rect x="8" y="30" width="32" height="9" rx="2" fill="#d9524f" stroke="#a83a38" stroke-width="1"/>' +
          '<rect x="14" y="17" width="20" height="14" rx="1.5" fill="#fff" stroke="#a83a38" stroke-width="1"/>' +
          '<text x="24" y="26.5" font-size="7" text-anchor="middle">⛽</text>' +
          '<rect x="10" y="12" width="28" height="4" rx="1" fill="#d9524f" stroke="#a83a38" stroke-width="1"/>' +
          '</svg>';
      case 'lab':
        return '<svg viewBox="0 0 48 48" class="b-svg">' +
          '<rect x="16" y="26" width="16" height="15" rx="1.5" fill="#e8edf4" stroke="#8b9bb0" stroke-width="1"/>' +
          '<path d="M12 28 a12 12 0 0 1 24 0 Z" fill="#4f6ef7" opacity=".85"/>' +
          '<line x1="24" y1="16" x2="24" y2="7" stroke="#4f6ef7" stroke-width="2"/>' +
          '<circle cx="24" cy="6" r="2" fill="#4f6ef7"/>' +
          '<rect x="20" y="30" width="8" height="7" rx=".8" fill="#fff" stroke="#8b9bb0" stroke-width=".8"/>' +
          '</svg>';
      case 'resort':
        return '<svg viewBox="0 0 48 48" class="b-svg">' +
          '<rect x="12" y="20" width="24" height="21" rx="2" fill="#fff" stroke="#c9b06a" stroke-width="1"/>' +
          '<rect x="12" y="20" width="24" height="4" rx="2" fill="#f0c75e"/>' +
          '<rect x="20" y="27" width="8" height="14" rx="1" fill="#c9b06a"/>' +
          '<rect x="14.5" y="27" width="4" height="4" rx=".7" fill="#bfe3ff" stroke="#8bb8d8" stroke-width=".6"/>' +
          '<rect x="29.5" y="27" width="4" height="4" rx=".7" fill="#bfe3ff" stroke="#8bb8d8" stroke-width=".6"/>' +
          '<path d="M6 41 q4 -9 8 -9 M42 41 q-4 -9 -8 -9" stroke="#4d9440" stroke-width="1.6" fill="none"/>' +
          '<circle cx="8" cy="30" r="2.4" fill="#7fca68"/><circle cx="40" cy="30" r="2.4" fill="#7fca68"/>' +
          '</svg>';
      default:  /* 未盖特殊建筑：建地围挡 */
        return '<svg viewBox="0 0 48 48" class="b-svg">' +
          '<rect x="10" y="22" width="28" height="18" rx="2" fill="#f5e6c8" stroke="#c9a96a" stroke-width="1"/>' +
          '<path d="M10 28 h28 M10 34 h28 M18 22 v18 M28 22 v18" stroke="#d9c291" stroke-width=".8"/>' +
          '<rect x="16" y="8" width="16" height="10" rx="1.5" fill="#f6c043" stroke="#d99a2b" stroke-width="1"/>' +
          '<text x="24" y="15.5" font-size="6" text-anchor="middle">🏗️</text>' +
          '</svg>';
    }
  }

  /* 颜色明暗工具 */
  function shade(hex, pct) {
    const m = hex.replace('#', '');
    const n = parseInt(m, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r + (pct / 100) * 255)));
    g = Math.max(0, Math.min(255, Math.round(g + (pct / 100) * 255)));
    b = Math.max(0, Math.min(255, Math.round(b + (pct / 100) * 255)));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  /* ======================================================================
     二、棋盘构建与格子刷新
     ====================================================================== */
  function cellIconHTML(cell, players) {
    if (cell.type === 'estate') {
      return houseSVG(cell.level, DISTRICT_TONE[cell.district] || null);
    }
    if (cell.type === 'special') {
      return specialSVG(cell.building ? cell.building : 'empty');
    }
    return '<div class="cell-emoji">' + cell.icon + '</div>';
  }

  function buildBoard(map, players, onCellClick) {
    const board = document.getElementById('board');
    if (!board) return;
    board.innerHTML = '';
    board.style.gridTemplateColumns = 'repeat(' + W.COLS + ', minmax(0,1fr))';
    board.style.gridTemplateRows = 'repeat(' + W.ROWS + ', minmax(0,1fr))';

    map.forEach(cell => {
      const el = document.createElement('div');
      el.className = 'cell';
      el.dataset.index = cell.i;
      el.dataset.type = cell.type;
      if (cell.district) el.dataset.district = cell.district;
      el.style.gridColumn = cell.col;
      el.style.gridRow = cell.row;
      el.innerHTML =
        '<div class="cell-inner">' +
          '<div class="cell-art">' + cellIconHTML(cell, players) + '</div>' +
          '<div class="cell-name">' + cell.name + '</div>' +
          '<div class="cell-sub"></div>' +
        '</div>' +
        '<div class="cell-mark"></div>' +
        '<div class="cell-roadblock hidden">🚧</div>';
      el.addEventListener('click', () => onCellClick && onCellClick(cell.i));
      board.appendChild(el);
    });
    /* 棋子层（绝对定位覆盖在棋盘上） */
    const stage = document.querySelector('.board-stage');
    if (stage && !stage.querySelector('.token-layer')) {
      const layer = document.createElement('div');
      layer.className = 'token-layer';
      stage.appendChild(layer);
    }
    refreshAll(map, players);
  }

  /* 刷新全部格子（回合渲染时） */
  function refreshAll(map, players) {
    map.forEach(c => updateCell(c, players));
  }

  /* 刷新单格显示：产权 / 房级 / 抵押 / 路障 */
  function updateCell(cell, players) {
    const el = document.querySelector('.cell[data-index="' + cell.i + '"]');
    if (!el) return;
    const art = el.querySelector('.cell-art');
    const sub = el.querySelector('.cell-sub');
    const mark = el.querySelector('.cell-mark');
    const rb = el.querySelector('.cell-roadblock');

    if (art) art.innerHTML = cellIconHTML(cell, players);

    const owner = cell.owner != null && players ? players[cell.owner] : null;

    if (cell.type === 'estate') {
      el.style.setProperty('--pc', owner ? owner.color : 'transparent');
      el.classList.toggle('owned', !!owner);
      el.classList.toggle('mortgaged', !!cell.mortgaged);
      if (sub) {
        if (owner) {
          sub.textContent = owner.name + (cell.level > 0 ? ' · L' + cell.level : '');
          sub.style.color = owner.color;
        } else {
          sub.textContent = U.fmt(cell.price) + ' 元';
          sub.style.color = '';
        }
      }
      if (mark) {
        mark.innerHTML = owner
          ? '<span class="own-flag" style="background:' + owner.color + '">' + owner.emoji + '</span>' +
            (cell.level > 0 ? '<span class="lv-dots">' + '●'.repeat(cell.level) + '</span>' : '') +
            (cell.mortgaged ? '<span class="mortg-badge">🔒</span>' : '')
          : '';
      }
    } else if (cell.type === 'special') {
      el.style.setProperty('--pc', owner ? owner.color : 'transparent');
      el.classList.toggle('owned', !!owner);
      if (sub) {
        sub.textContent = owner ? owner.name : '大型建地';
        sub.style.color = owner ? owner.color : '';
      }
      if (mark) mark.innerHTML = owner ? '<span class="own-flag" style="background:' + owner.color + '">' + owner.emoji + '</span>' : '';
    } else if (cell.type === 'estate' || cell.type === 'special') {
      /* noop */
    }

    /* 路障显示 */
    if (rb) rb.classList.toggle('hidden', !cell.roadblock);
  }

  /* ======================================================================
     三、棋子（持久元素 + 平滑移动）
     ====================================================================== */
  function tokenLayer() { return document.querySelector('.token-layer'); }

  function ensureToken(p) {
    const layer = tokenLayer();
    if (!layer) return null;
    let t = layer.querySelector('.token[data-pid="' + p.id + '"]');
    if (!t) {
      t = document.createElement('div');
      t.className = 'token';
      t.dataset.pid = p.id;
      t.style.setProperty('--tc', p.color);
      t.innerHTML = '<div class="token-body">' + U.av(p, 'av-token') + '</div><i class="token-shadow"></i>';
      layer.appendChild(t);
    }
    if (p.bankrupt) t.classList.add('out');
    else t.classList.remove('out');
    if (p.jailTurns > 0) t.classList.add('in-jail');
    else t.classList.remove('in-jail');
    return t;
  }

  /* 格子中心坐标（相对 token-layer） */
  function cellPoint(idx) {
    const layer = tokenLayer();
    const cell = document.querySelector('.cell[data-index="' + idx + '"]');
    if (!layer || !cell) return null;
    const lr = layer.getBoundingClientRect();
    const cr = cell.getBoundingClientRect();
    return { x: cr.left - lr.left + cr.width / 2, y: cr.top - lr.top + cr.height / 2 };
  }

  /* 同格多棋子扇形偏移 */
  function placeTokens(players, activeId) {
    const byPos = {};
    players.forEach(p => { if (!p.bankrupt) (byPos[p.pos] = byPos[p.pos] || []).push(p); });
    Object.keys(byPos).forEach(pos => {
      const arr = byPos[pos];
      arr.forEach((p, k) => {
        const t = ensureToken(p);
        if (!t) return;
        const pt = cellPoint(+pos);
        if (!pt) return;
        const off = (k - (arr.length - 1) / 2) * 13;
        t.style.left = (pt.x + off) + 'px';
        t.style.top = pt.y + 'px';
        t.classList.toggle('active', p.id === activeId);
      });
    });
    /* 清理破产玩家的棋子 */
    players.forEach(p => {
      const t = layer2().querySelector('.token[data-pid="' + p.id + '"]');
      if (t && p.bankrupt) t.classList.add('out');
    });
  }

  function layer2() { return tokenLayer() || document.createElement('div'); }

  /* 逐格移动动画 */
  async function moveTokenAlong(p, path, onStep) {
    for (let k = 0; k < path.length; k++) {
      const idx = path[k];
      const t = ensureToken(p);
      const pt = cellPoint(idx);
      if (t && pt) {
        t.classList.add('hopping');
        t.style.left = pt.x + 'px';
        t.style.top = pt.y + 'px';
      }
      if (onStep) onStep(idx, k);
      await U.sleep(240);
      if (t) t.classList.remove('hopping');
    }
  }

  /* 落格弹跳 */
  async function landBounce(p) {
    const t = layer2().querySelector('.token[data-pid="' + p.id + '"]');
    if (t) {
      t.classList.add('just-landed');
      await U.sleep(400);
      t.classList.remove('just-landed');
    }
  }

  function highlightCell(idx) {
    clearHighlight();
    const el = document.querySelector('.cell[data-index="' + idx + '"]');
    if (el) el.classList.add('highlight');
  }
  function clearHighlight() {
    document.querySelectorAll('.cell.highlight').forEach(el => el.classList.remove('highlight'));
  }

  /* ======================================================================
     四、3D 骰子（自 v1 迁移）
     ====================================================================== */
  function buildDice() {
    const stage = document.getElementById('diceStage');
    if (!stage) return;
    const faces = ['front', 'back', 'right', 'left', 'top', 'bottom'];
    const pips = [1, 6, 3, 4, 5, 2];   // 面 → 点数
    /* 原版为两颗骰子：并排两颗，各自独立旋转 */
    const one = k => '<div class="dice-tilt"><div class="dice-3d" data-die="' + k + '">' +
      faces.map((f, i) => '<div class="dice-face d-' + f + '" data-face="' + pips[i] + '">' + pipSVG(pips[i]) + '</div>').join('') +
      '</div></div>';
    stage.innerHTML = one(0) + one(1);
  }

  function pipSVG(n) {
    const pos = {
      1: [[24, 24]],
      2: [[14, 14], [34, 34]],
      3: [[14, 14], [24, 24], [34, 34]],
      4: [[14, 14], [34, 14], [14, 34], [34, 34]],
      5: [[14, 14], [34, 14], [24, 24], [14, 34], [34, 34]],
      6: [[14, 13], [34, 13], [14, 24], [34, 24], [14, 35], [34, 35]],
    }[n] || [];
    return '<svg viewBox="0 0 48 48">' + pos.map(pt =>
      '<circle cx="' + pt[0] + '" cy="' + pt[1] + '" r="4.8" fill="#2f3f5c"/>').join('') + '</svg>';
  }

  const FACE_ROT = {
    1: 'rotateX(0deg) rotateY(0deg)',
    2: 'rotateX(-90deg) rotateY(0deg)',
    3: 'rotateX(0deg) rotateY(-90deg)',
    4: 'rotateX(0deg) rotateY(90deg)',
    5: 'rotateX(90deg) rotateY(0deg)',
    6: 'rotateX(180deg) rotateY(0deg)',
  };

  /* 兼容两种调用：单颗(数字) 或 原版双骰(数组 [d1,d2]) */
  async function rollDiceAnimation(finalValue) {
    const values = Array.isArray(finalValue) ? finalValue : [finalValue];
    const dice = Array.prototype.slice.call(document.querySelectorAll('#diceStage .dice-3d'));
    const txt = document.getElementById('diceValue');
    if (!dice.length) return values;
    const spin = ['rotateX(720deg) rotateY(360deg)', 'rotateX(360deg) rotateY(720deg)',
      'rotateX(-720deg) rotateY(180deg)', 'rotateX(180deg) rotateY(-720deg)'];
    dice.forEach(d => d.classList.add('rolling'));
    for (let i = 0; i < 3; i++) {
      dice.forEach((d, k) => { d.style.transform = spin[(i + k) % spin.length]; });
      if (txt) txt.textContent = '?';
      await U.sleep(160);
    }
    dice.forEach((d, k) => {
      d.classList.remove('rolling');
      d.style.transform = FACE_ROT[values[k]] || FACE_ROT[1];
    });
    if (txt) {
      txt.textContent = values.length > 1
        ? values[0] + '+' + values[1] + '=' + values.reduce((a, b) => a + b, 0)
        : values[0];
    }
    await U.sleep(240);
    return values;
  }

  global.Board = {
    houseSVG, specialSVG, shade,
    buildBoard, refreshAll, updateCell,
    ensureToken, placeTokens, moveTokenAlong, landBounce,
    highlightCell, clearHighlight,
    buildDice, rollDiceAnimation,
  };
})(window);
