/* ==========================================================================
   现金流小富翁 v2 · 棋盘渲染层
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

  /* 房屋：level 0-4。颜色随 owner，形态随等级 */
  function houseSVG(level, color) {
    const c = color || '#9aa7b8';
    const dark = shade(c, -18), light = shade(c, 20);
    let inner = '';
    if (level === 0) {
      /* 空地：草地 + 出售木牌 */
      inner =
        '<ellipse cx="24" cy="40" rx="16" ry="4" fill="#bfe3a8"/>' +
        '<path d="M14 40 q10 -8 20 0" stroke="#8ec66f" stroke-width="1.5" fill="none"/>' +
        '<rect x="19" y="22" width="10" height="12" rx="1.5" fill="#c98d4f"/>' +
        '<rect x="17.5" y="24" width="13" height="5" rx="1" fill="#fff" stroke="#a9713a" stroke-width=".8"/>' +
        '<text x="24" y="28.2" font-size="3.6" text-anchor="middle" fill="#a9713a" font-weight="700">出售</text>';
    } else if (level === 1) {
      /* 小屋：单层坡顶 */
      inner =
        '<rect x="13" y="24" width="22" height="16" rx="1.5" fill="' + light + '" stroke="' + dark + '" stroke-width="1"/>' +
        '<path d="M11 25 L24 14 L37 25 Z" fill="' + c + '" stroke="' + dark + '" stroke-width="1"/>' +
        '<rect x="21" y="29" width="6" height="11" rx="1" fill="' + dark + '"/>' +
        '<rect x="15.5" y="28" width="4.5" height="4.5" rx=".8" fill="#fff" stroke="' + dark + '" stroke-width=".7"/>' +
        '<rect x="28" y="28" width="4.5" height="4.5" rx=".8" fill="#fff" stroke="' + dark + '" stroke-width=".7"/>';
    } else if (level === 2) {
      /* 洋房：双层 + 烟囱 */
      inner =
        '<rect x="14" y="20" width="20" height="20" rx="1.5" fill="' + light + '" stroke="' + dark + '" stroke-width="1"/>' +
        '<path d="M12 21 L24 11 L36 21 Z" fill="' + c + '" stroke="' + dark + '" stroke-width="1"/>' +
        '<rect x="28" y="8" width="3.5" height="7" rx=".8" fill="' + dark + '"/>' +
        '<rect x="20.5" y="25" width="7" height="15" rx="1" fill="' + dark + '"/>' +
        '<rect x="15.5" y="24" width="4" height="4" rx=".7" fill="#fff" stroke="' + dark + '" stroke-width=".6"/>' +
        '<rect x="28.5" y="24" width="4" height="4" rx=".7" fill="#fff" stroke="' + dark + '" stroke-width=".6"/>' +
        '<rect x="15.5" y="31" width="4" height="4" rx=".7" fill="#fff" stroke="' + dark + '" stroke-width=".6"/>' +
        '<rect x="28.5" y="31" width="4" height="4" rx=".7" fill="#fff" stroke="' + dark + '" stroke-width=".6"/>';
    } else if (level === 3) {
      /* 大厦：三层平顶 + 窗阵 */
      inner =
        '<rect x="14" y="12" width="20" height="28" rx="1.5" fill="' + light + '" stroke="' + dark + '" stroke-width="1"/>' +
        '<rect x="12.5" y="10" width="23" height="3.5" rx="1" fill="' + c + '"/>' +
        '<rect x="20.5" y="24" width="7" height="16" rx="1" fill="' + dark + '"/>' +
        windows(15, 15.5, 3, 2) + windows(15, 22.5, 3, 2) + windows(15, 29.5, 3, 2);
    } else {
      /* L4 酒店：宽体 + 金字招牌 + 旗子 */
      inner =
        '<rect x="10" y="14" width="28" height="26" rx="2" fill="' + light + '" stroke="' + dark + '" stroke-width="1"/>' +
        '<rect x="8.5" y="11.5" width="31" height="4" rx="1.5" fill="' + c + '"/>' +
        '<path d="M24 11 V3.5 l6 2 -6 2" fill="#f6c043" stroke="#d99a2b" stroke-width=".8"/>' +
        '<rect x="15" y="16.5" width="18" height="5" rx="1" fill="#f6c043" stroke="#d99a2b" stroke-width=".8"/>' +
        '<text x="24" y="20.8" font-size="4" text-anchor="middle" fill="#8a5c00" font-weight="800">HOTEL</text>' +
        '<rect x="20.5" y="27" width="7" height="13" rx="1" fill="' + dark + '"/>' +
        windows(12, 25, 4, 1) + windows(28, 25, 2, 1);
    }
    return '<svg viewBox="0 0 48 48" class="b-svg">' + inner + '</svg>';

    function windows(x0, y0, cols, rows) {
      let s = '';
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        s += '<rect x="' + (x0 + k * 6) + '" y="' + (y0 + r * 6.5) + '" width="4" height="4.6" rx=".7" fill="#fff" opacity=".92" stroke="' + dark + '" stroke-width=".5"/>';
      }
      return s;
    }
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
      const owner = cell.owner != null ? players[cell.owner] : null;
      const oc = owner ? owner.color : null;
      return houseSVG(cell.level, oc);
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
    stage.innerHTML =
      '<div class="dice-tilt"><div class="dice-3d" id="dice3d">' +
        faces.map((f, i) => '<div class="dice-face d-' + f + '" data-face="' + pips[i] + '">' + pipSVG(pips[i]) + '</div>').join('') +
      '</div></div>';
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

  async function rollDiceAnimation(finalValue) {
    const d = document.getElementById('dice3d');
    const txt = document.getElementById('diceValue');
    if (!d) return finalValue;
    d.classList.add('rolling');
    const spin = ['rotateX(720deg) rotateY(360deg)', 'rotateX(360deg) rotateY(720deg)',
      'rotateX(-720deg) rotateY(180deg)', 'rotateX(180deg) rotateY(-720deg)'];
    for (let i = 0; i < 3; i++) {
      d.style.transform = spin[i % spin.length];
      if (txt) txt.textContent = '?';
      await U.sleep(160);
    }
    d.classList.remove('rolling');
    d.style.transform = FACE_ROT[finalValue] || FACE_ROT[1];
    if (txt) txt.textContent = finalValue;
    await U.sleep(240);
    return finalValue;
  }

  global.Board = {
    houseSVG, specialSVG, shade,
    buildBoard, refreshAll, updateCell,
    ensureToken, placeTokens, moveTokenAlong, landBounce,
    highlightCell, clearHighlight,
    buildDice, rollDiceAnimation,
  };
})(window);
