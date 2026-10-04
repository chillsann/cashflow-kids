/* ==========================================================================
   现金流小富翁 · 美术资源库 (SVG)
   全部图形以矢量绘制，不依赖任何图片文件 / 图标字体。
   棋格图标、玩家头像、装饰元素统一从这里取，保证视觉风格一致。
   ========================================================================== */
(function (global) {
  'use strict';

  /* ======================================================================
     一、棋格图标
     每个图标都画在 0 0 48 48 的画布里，风格：圆头粗描边 + 柔和填色，
     接近桌游贴纸的观感，远看轮廓清晰，小格子里也不糊。
     ====================================================================== */

  const G = {
    /* 描边统一色 */
    ink: '#2c2340',
  };

  const ICONS = {

    /* ── 起点：终点小旗 ───────────────────────────────────────────── */
    start: `
      <path d="M15 40V9" stroke="${G.ink}" stroke-width="3.2" stroke-linecap="round" fill="none"/>
      <path d="M15 10h20l-5 7 5 7H15z" fill="#ffd45e" stroke="${G.ink}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M8 40h16" stroke="${G.ink}" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="15" cy="7" r="3" fill="#ff8a5c" stroke="${G.ink}" stroke-width="2.2"/>`,

    /* ── 银行：柱廊建筑 ───────────────────────────────────────────── */
    bank: `
      <path d="M6 20L24 8l18 12z" fill="#ffd45e" stroke="${G.ink}" stroke-width="2.6" stroke-linejoin="round"/>
      <rect x="9" y="20" width="30" height="18" rx="2" fill="#fff6e0" stroke="${G.ink}" stroke-width="2.6"/>
      <rect x="12" y="23" width="4" height="12" rx="1.4" fill="#7cc0f8" stroke="${G.ink}" stroke-width="2"/>
      <rect x="22" y="23" width="4" height="12" rx="1.4" fill="#7cc0f8" stroke="${G.ink}" stroke-width="2"/>
      <rect x="32" y="23" width="4" height="12" rx="1.4" fill="#7cc0f8" stroke="${G.ink}" stroke-width="2"/>
      <rect x="5" y="38" width="38" height="5" rx="2.2" fill="#ffb057" stroke="${G.ink}" stroke-width="2.6"/>`,

    /* ── 领工资：钱袋 ────────────────────────────────────────────── */
    salary: `
      <path d="M19 10c-1 3-5 5-5 5" stroke="${G.ink}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M29 10c1 3 5 5 5 5" stroke="${G.ink}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M19 10c0 3 2 5 2 5M29 10c0 3-2 5-2 5" stroke="${G.ink}" stroke-width="2.2" fill="none"/>
      <path d="M16 17h16c4 5 6 9 6 14 0 6-6 9-14 9s-14-3-14-9c0-5 2-9 6-14z"
            fill="#6ee7a8" stroke="${G.ink}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M18 15h12v4H18z" fill="#ffd45e" stroke="${G.ink}" stroke-width="2.4" stroke-linejoin="round"/>
      <text x="24" y="34" font-size="13" font-weight="800" text-anchor="middle"
            fill="${G.ink}" font-family="system-ui,sans-serif">$</text>`,

    /* ── 小机会：小灯泡 ───────────────────────────────────────────── */
    small: `
      <path d="M24 8a11 11 0 0 1 6.5 19.9c-1.2.9-1.8 1.8-2 3.1h-9c-.2-1.3-.8-2.2-2-3.1A11 11 0 0 1 24 8z"
            fill="#ffe066" stroke="${G.ink}" stroke-width="2.6" stroke-linejoin="round"/>
      <rect x="19" y="31" width="10" height="4" rx="1.6" fill="#b8c0cf" stroke="${G.ink}" stroke-width="2.2"/>
      <rect x="20" y="36" width="8" height="4" rx="1.6" fill="#8e97a8" stroke="${G.ink}" stroke-width="2.2"/>
      <path d="M24 12v6M20 15h8" stroke="${G.ink}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`,

    /* ── 大机会：摩天楼 ───────────────────────────────────────────── */
    big: `
      <rect x="8" y="14" width="15" height="27" rx="2" fill="#8fc9ff" stroke="${G.ink}" stroke-width="2.6"/>
      <rect x="25" y="7" width="15" height="34" rx="2" fill="#ffd45e" stroke="${G.ink}" stroke-width="2.6"/>
      <rect x="5" y="40" width="38" height="4" rx="1.8" fill="#ff9a5c" stroke="${G.ink}" stroke-width="2.4"/>
      <rect x="11" y="18" width="4" height="4" rx="1" fill="#fff" stroke="${G.ink}" stroke-width="1.7"/>
      <rect x="16.5" y="18" width="4" height="4" rx="1" fill="#fff" stroke="${G.ink}" stroke-width="1.7"/>
      <rect x="11" y="25" width="4" height="4" rx="1" fill="#fff" stroke="${G.ink}" stroke-width="1.7"/>
      <rect x="16.5" y="25" width="4" height="4" rx="1" fill="#fff" stroke="${G.ink}" stroke-width="1.7"/>
      <rect x="11" y="32" width="4" height="4" rx="1" fill="#fff" stroke="${G.ink}" stroke-width="1.7"/>
      <rect x="16.5" y="32" width="4" height="4" rx="1" fill="#fff" stroke="${G.ink}" stroke-width="1.7"/>
      <rect x="28.5" y="12" width="4" height="4" rx="1" fill="#fff" stroke="${G.ink}" stroke-width="1.7"/>
      <rect x="34" y="12" width="4" height="4" rx="1" fill="#fff" stroke="${G.ink}" stroke-width="1.7"/>
      <rect x="28.5" y="19" width="4" height="4" rx="1" fill="#fff" stroke="${G.ink}" stroke-width="1.7"/>
      <rect x="34" y="19" width="4" height="4" rx="1" fill="#fff" stroke="${G.ink}" stroke-width="1.7"/>
      <rect x="28.5" y="26" width="4" height="4" rx="1" fill="#fff" stroke="${G.ink}" stroke-width="1.7"/>
      <rect x="34" y="26" width="4" height="4" rx="1" fill="#fff" stroke="${G.ink}" stroke-width="1.7"/>
      <rect x="28.5" y="33" width="4" height="4" rx="1" fill="#fff" stroke="${G.ink}" stroke-width="1.7"/>
      <rect x="34" y="33" width="4" height="4" rx="1" fill="#fff" stroke="${G.ink}" stroke-width="1.7"/>`,

    /* ── 消费：购物袋 ────────────────────────────────────────────── */
    spend: `
      <path d="M13 18h22l-2.4 22a3 3 0 0 1-3 2.7H18.4a3 3 0 0 1-3-2.7z"
            fill="#ff9ec4" stroke="${G.ink}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M18 19v-4a6 6 0 0 1 12 0v4" stroke="${G.ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M13 18h22" stroke="${G.ink}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M24 24v10M20.5 27.5l7 3M27.5 27.5l-7 3" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`,

    /* ── 市场风云：走势图 ─────────────────────────────────────────── */
    market: `
      <rect x="7" y="10" width="34" height="28" rx="3" fill="#fff" stroke="${G.ink}" stroke-width="2.6"/>
      <rect x="7" y="10" width="34" height="7" rx="3" fill="#c9b6ff" stroke="${G.ink}" stroke-width="2.6"/>
      <path d="M11 32l6-7 5 4 6-9 5 5" fill="none" stroke="#ff6b6b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M33 25v-4h-4" fill="none" stroke="#ff6b6b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M11 36h26" stroke="${G.ink}" stroke-width="2" opacity=".35"/>`,

    /* ── 意外支出：闪电 ⚡ ─────────────────────────────────────────── */
    accident: `
      <path d="M27 5L11 27h10l-3 16 17-23H25z"
            fill="#ffb03a" stroke="${G.ink}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M27 5L11 27h10" fill="none" stroke="#fff3c4" stroke-width="2" stroke-linejoin="round"/>`,

    /* ── 副业：工具箱 ────────────────────────────────────────────── */
    parttime: `
      <rect x="6" y="18" width="36" height="20" rx="3" fill="#8fc9ff" stroke="${G.ink}" stroke-width="2.6"/>
      <path d="M18 18v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3" fill="none" stroke="${G.ink}" stroke-width="2.6" stroke-linecap="round"/>
      <rect x="20" y="24" width="8" height="6" rx="1.6" fill="#ffd45e" stroke="${G.ink}" stroke-width="2.2"/>
      <path d="M6 27h36" stroke="${G.ink}" stroke-width="2" opacity=".3"/>`,

    /* ── 学习进修：翻开的书 ───────────────────────────────────────── */
    study: `
      <path d="M24 14c-4-4-10-5-16-4v22c6-1 12 0 16 4z" fill="#a8e6a3" stroke="${G.ink}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M24 14c4-4 10-5 16-4v22c-6-1-12 0-16 4z" fill="#c9f0c4" stroke="${G.ink}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M24 14v22" stroke="${G.ink}" stroke-width="2.6"/>
      <path d="M11 19h7M11 24h7M30 19h7M30 24h7" stroke="${G.ink}" stroke-width="1.8" opacity=".4" stroke-linecap="round"/>
      <path d="M36 6l2.4 5 5 2.4-5 2.4L36 21l-2.4-5.2-5-2.4 5-2.4z" fill="#ffd45e" stroke="${G.ink}" stroke-width="2.2" stroke-linejoin="round"/>`,

    /* ── 慈善捐赠：爱心 ──────────────────────────────────────────── */
    charity: `
      <path d="M24 40S7 30 7 19.5C7 13 12 9 17.5 9c3.6 0 6 1.9 6.5 4.2C24.5 10.9 26.9 9 30.5 9 36 9 41 13 41 19.5 41 30 24 40 24 40z"
            fill="#ff8fab" stroke="${G.ink}" stroke-width="2.7" stroke-linejoin="round"/>
      <path d="M17 22h4l2-4 2.4 8 2-4h3.6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,

    /* ── 梦想之角：奖杯 ──────────────────────────────────────────── */
    landmark: `
      <path d="M15 8h18v8a9 9 0 0 1-18 0z" fill="#ffd45e" stroke="${G.ink}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M15 11h-5a5 5 0 0 0 5 6M33 11h5a5 5 0 0 1-5 6" fill="none" stroke="${G.ink}" stroke-width="2.6" stroke-linecap="round"/>
      <rect x="21" y="25" width="6" height="7" rx="1.6" fill="#ff9a5c" stroke="${G.ink}" stroke-width="2.4"/>
      <rect x="14" y="32" width="20" height="6" rx="2.4" fill="#ff9a5c" stroke="${G.ink}" stroke-width="2.6"/>
      <path d="M21 11l1.6 3.2 3.4 1.6-3.4 1.6L21 21l-1.6-3.6L16 15.8l3.4-1.6z" fill="#fff" stroke="${G.ink}" stroke-width="1.7" stroke-linejoin="round"/>`,
  };

  /* ======================================================================
     三、职业图标 —— 八个职业各一枚
     ====================================================================== */

  const JOBS = {
    milk: `
      <path d="M13 16h18l-1.6 20a4 4 0 0 1-4 3.6h-6.8a4 4 0 0 1-4-3.6z"
            fill="#fff6e0" stroke="${G.ink}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M11 20h22l-.4 5H11.4z" fill="#8fd6f0" stroke="${G.ink}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M14 12c0-3 2-5 5-5M30 12c0-3-2-5-5-5" stroke="${G.ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M22 30l2.6 2.4 4.4-5" fill="none" stroke="${G.ink}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,

    office: `
      <rect x="7" y="20" width="34" height="21" rx="2.6" fill="#5b8fd6" stroke="${G.ink}" stroke-width="2.6"/>
      <path d="M24 20V9a2 2 0 0 1 2-2h8l7 7v6z" fill="#9ec2f0" stroke="${G.ink}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M34 7v8h7" fill="none" stroke="${G.ink}" stroke-width="2.2" stroke-linejoin="round"/>
      <rect x="12" y="26" width="6" height="5" rx="1" fill="#fff6e0" stroke="${G.ink}" stroke-width="1.8"/>
      <rect x="21" y="26" width="6" height="5" rx="1" fill="#fff6e0" stroke="${G.ink}" stroke-width="1.8"/>
      <rect x="30" y="26" width="6" height="5" rx="1" fill="#fff6e0" stroke="${G.ink}" stroke-width="1.8"/>
      <rect x="12" y="34" width="6" height="5" rx="1" fill="#fff6e0" stroke="${G.ink}" stroke-width="1.8"/>
      <rect x="21" y="34" width="6" height="5" rx="1" fill="#fff6e0" stroke="${G.ink}" stroke-width="1.8"/>`,

    teacher: `
      <rect x="6" y="12" width="36" height="26" rx="2.6" fill="#3f6b4a" stroke="${G.ink}" stroke-width="2.6"/>
      <rect x="9" y="15" width="30" height="20" rx="1.6" fill="#e8f5ea"/>
      <path d="M13 21h10M13 26h16M13 31h8" stroke="#7fae8c" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M36 22l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#ffd45e" stroke="${G.ink}" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M24 38v4M18 42h12" stroke="${G.ink}" stroke-width="2.6" stroke-linecap="round"/>`,

    nurse: `
      <rect x="9" y="10" width="30" height="30" rx="4" fill="#fff" stroke="${G.ink}" stroke-width="2.6"/>
      <circle cx="18" cy="19" r="2.2" fill="${G.ink}"/><circle cx="30" cy="19" r="2.2" fill="${G.ink}"/>
      <path d="M18 28c1.6 1.8 3.8 2.6 6 2.6s4.4-.8 6-2.6" fill="none" stroke="${G.ink}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M19 33h10v3a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3z" fill="#ffd0d8" stroke="${G.ink}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M24 12v6M21 15h6" stroke="#e0574c" stroke-width="3" stroke-linecap="round"/>
      <circle cx="24" cy="15" r="4.6" fill="none" stroke="#e0574c" stroke-width="2.2"/>`,

    driver: `
      <rect x="5" y="18" width="27" height="12" rx="2.4" fill="#ffd45e" stroke="${G.ink}" stroke-width="2.5"/>
      <path d="M32 22h5l5 6v2H32z" fill="#ffc95c" stroke="${G.ink}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M34 23h3.6l3.4 4.4H34z" fill="#c9e8ff" stroke="${G.ink}" stroke-width="1.9" stroke-linejoin="round"/>
      <rect x="8" y="21" width="10" height="6" rx="1.4" fill="#c9e8ff" stroke="${G.ink}" stroke-width="1.9"/>
      <circle cx="13" cy="32" r="4.4" fill="#3f3a4d" stroke="${G.ink}" stroke-width="2.2"/>
      <circle cx="35" cy="32" r="4.4" fill="#3f3a4d" stroke="${G.ink}" stroke-width="2.2"/>
      <circle cx="13" cy="32" r="1.6" fill="#d8dbe4"/><circle cx="35" cy="32" r="1.6" fill="#d8dbe4"/>
      <path d="M20 34h9v4h-9z" fill="#8fd6f0" stroke="${G.ink}" stroke-width="2.1" stroke-linejoin="round"/>`,

    coder: `
      <rect x="5" y="12" width="38" height="26" rx="3" fill="#3d4256" stroke="${G.ink}" stroke-width="2.6"/>
      <rect x="8" y="15" width="32" height="19" rx="1.6" fill="#8fd6c4"/>
      <path d="M17 20l-4 4 4 4M31 20l4 4-4 4" fill="none" stroke="#1f6b58" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M26 19l-4 10" stroke="#1f6b58" stroke-width="2.6" stroke-linecap="round"/>
      <rect x="17" y="38" width="14" height="3" rx="1.5" fill="#8b8399" stroke="${G.ink}" stroke-width="1.9"/>`,

    doctor: `
      <rect x="6" y="8" width="36" height="32" rx="5" fill="#fff" stroke="${G.ink}" stroke-width="2.6"/>
      <circle cx="24" cy="10" r="4" fill="#6b4fb0" stroke="${G.ink}" stroke-width="2.2"/>
      <path d="M21 10h6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="17" cy="21" r="2.4" fill="${G.ink}"/><circle cx="31" cy="21" r="2.4" fill="${G.ink}"/>
      <path d="M24 25v4" stroke="${G.ink}" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="24" cy="32" r="4" fill="#ffd0d8" stroke="${G.ink}" stroke-width="2.2"/>
      <path d="M17 34h-4M35 34h-4" stroke="${G.ink}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M22 40v2M26 40v2" stroke="${G.ink}" stroke-width="2.2" stroke-linecap="round"/>`,

    shop: `
      <path d="M9 18h30l-2 22a3 3 0 0 1-3 2.7H14a3 3 0 0 1-3-2.7z"
            fill="#ff9ec4" stroke="${G.ink}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M8 13a5 5 0 0 1 5-5h22a5 5 0 0 1 5 5z" fill="#fff" stroke="${G.ink}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M8 13h6v5H8zM19 13h6v5h-6zM30 13h6v5h-6z" fill="#e0574c" stroke="${G.ink}" stroke-width="1.9"/>
      <path d="M17 18v24M31 18v24" stroke="${G.ink}" stroke-width="1.9" opacity=".3"/>`,
  };

  function jobIcon(id) {
    const body = JOBS[id] || JOBS.office;
    return `<svg class="cell-art" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
  }

  /* ======================================================================
     四、玩家头像 —— 六种动物，圆脸大眼，卡通桌游风
     ====================================================================== */
  const FACES = {
    cat: { fur: '#ffb86b', fur2: '#ff9f43', ear: 'triangle', inner: '#ff8fab', muzzle: '#fff3e0',
      eyes: '#3a2f4a', extra: `<path d="M13 20l-2-7 7 3zM35 20l2-7-7 3z" fill="#ffb86b" stroke="#2c2340" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M13.6 18.6l-1-3.4 3.4 1.4zM34.4 18.6l1-3.4-3.4 1.4z" fill="#ff8fab"/>` },
    dog: { fur: '#d9a066', fur2: '#c1864a', ear: 'droop', inner: '#f0b78a', muzzle: '#fff3e0',
      eyes: '#3a2f4a', extra: `<ellipse cx="9" cy="24" rx="5" ry="8" fill="#c1864a" stroke="#2c2340" stroke-width="2.2"/>
        <ellipse cx="39" cy="24" rx="5" ry="8" fill="#c1864a" stroke="#2c2340" stroke-width="2.2"/>` },
    panda: { fur: '#ffffff', fur2: '#ececf2', ear: 'round', inner: '#2c2340', muzzle: '#ffffff',
      eyes: '#2c2340', extra: `<ellipse cx="17" cy="22" rx="5.4" ry="6.4" fill="#2c2340"/>
        <ellipse cx="31" cy="22" rx="5.4" ry="6.4" fill="#2c2340"/>
        <circle cx="18.6" cy="20" r="1.8" fill="#fff"/><circle cx="32.6" cy="20" r="1.8" fill="#fff"/>` },
    fox: { fur: '#ff8f5a', fur2: '#f26f3d', ear: 'triangle', inner: '#ffd6c2', muzzle: '#fff3e0',
      eyes: '#3a2f4a', extra: `<path d="M12 20l-2-8 8 4zM36 20l2-8-8 4z" fill="#ff8f5a" stroke="#2c2340" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M12.6 18l-1-4 4 2zM35.4 18l1-4-4 2z" fill="#ffd6c2"/>` },
    koala: { fur: '#b8b4c8', fur2: '#9d99b0', ear: 'roundbig', inner: '#e8e4f0', muzzle: '#f2f0f8',
      eyes: '#3a2f4a', extra: `<circle cx="24" cy="25" r="6" fill="#3a2f4a"/>
        <circle cx="24" cy="23.4" r="1.9" fill="#fff"/>` },
    frog: { fur: '#7ed957', fur2: '#5cb83c', ear: 'none', inner: '#7ed957', muzzle: '#c9f0b8',
      eyes: '#3a2f4a', extra: `<circle cx="17" cy="15" r="6.4" fill="#fff" stroke="#2c2340" stroke-width="2.2"/>
        <circle cx="31" cy="15" r="6.4" fill="#fff" stroke="#2c2340" stroke-width="2.2"/>
        <circle cx="17" cy="15.4" r="2.8" fill="#2c2340"/><circle cx="31" cy="15.4" r="2.8" fill="#2c2340"/>
        <circle cx="18" cy="14" r="1.1" fill="#fff"/><circle cx="32" cy="14" r="1.1" fill="#fff"/>` },
  };

  const EAR = {
    triangle: (f) => `<path d="M12 21l-3-9 9 4zM36 21l3-9-9 4z" fill="${f}" stroke="#2c2340" stroke-width="2.3" stroke-linejoin="round"/>
      <path d="M13.4 18.6l-1.4-4.2 4.2 1.8zM34.6 18.6l1.4-4.2-4.2 1.8z" fill="#ff8fab"/>`,
    round: (f) => `<circle cx="12.5" cy="13" r="5.4" fill="${f}" stroke="#2c2340" stroke-width="2.3"/>
      <circle cx="35.5" cy="13" r="5.4" fill="${f}" stroke="#2c2340" stroke-width="2.3"/>
      <circle cx="12.5" cy="13" r="2.6" fill="#2c2340"/><circle cx="35.5" cy="13" r="2.6" fill="#2c2340"/>`,
    roundbig: (f) => `<circle cx="11.5" cy="12" r="7" fill="${f}" stroke="#2c2340" stroke-width="2.3"/>
      <circle cx="36.5" cy="12" r="7" fill="${f}" stroke="#2c2340" stroke-width="2.3"/>
      <circle cx="11.5" cy="12" r="3.4" fill="#f0b7c8"/><circle cx="36.5" cy="12" r="3.4" fill="#f0b7c8"/>`,
    droop: (f) => `<ellipse cx="10" cy="24" rx="5.4" ry="8.6" fill="${f}" stroke="#2c2340" stroke-width="2.3"/>
      <ellipse cx="38" cy="24" rx="5.4" ry="8.6" fill="${f}" stroke="#2c2340" stroke-width="2.3"/>`,
    none: () => '',
  };

  /**
   * 画一个动物头像
   * @param {string} kind  cat/dog/panda/fox/koala/frog
   */
  function face(kind) {
    const f = FACES[kind] || FACES.cat;
    const ear = (EAR[f.ear] || EAR.none)(f.fur);
    return `<svg class="face-svg" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      ${ear}
      <circle cx="24" cy="27" r="17" fill="${f.fur}" stroke="#2c2340" stroke-width="2.6"/>
      <path d="M7 27a17 17 0 0 0 34 0z" fill="${f.fur2}" opacity=".35"/>
      ${f.extra}
      <ellipse cx="24" cy="32" rx="7.4" ry="5.4" fill="${f.muzzle}" stroke="#2c2340" stroke-width="2.2"/>
      <ellipse cx="24" cy="29.6" rx="2.4" ry="1.8" fill="#2c2340"/>
      <path d="M24 31.4v2.2M24 33.6c-1.4 0-2.4-.8-2.8-1.8M24 33.6c1.4 0 2.4-.8 2.8-1.8"
            fill="none" stroke="#2c2340" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="16.5" cy="30" rx="3" ry="2" fill="#ff8fab" opacity=".55"/>
      <ellipse cx="31.5" cy="30" rx="3" ry="2" fill="#ff8fab" opacity=".55"/>
    </svg>`;
  }

  /* ======================================================================
     三、棋子 —— 立体车 / 立体小人，六个颜色
     大富翁里的棋子是立体的，这里用 SVG 做一个带高光和底影的小车。
     ====================================================================== */

  /**
   * 生成一枚立体棋子（默认小车造型）
   * @param {string} kind  car / pawn
   * @param {string} color 主色
   */
  function token(kind, color) {
    const dark = shade(color, -22);
    const light = shade(color, 26);
    if (kind === 'pawn') {
      return `<svg class="tk-svg" viewBox="0 0 40 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse cx="20" cy="45" rx="11" ry="3" fill="rgba(0,0,0,.22)"/>
        <path d="M8 44h24a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" fill="${dark}"/>
        <path d="M11 44c0-7 2-11 9-11s9 4 9 11z" fill="${color}" stroke="#2c2340" stroke-width="1.8" stroke-linejoin="round"/>
        <circle cx="20" cy="18" r="8.4" fill="${color}" stroke="#2c2340" stroke-width="1.8"/>
        <circle cx="17" cy="15.4" r="3" fill="${light}" opacity=".8"/>
        <path d="M11 32h18" stroke="${dark}" stroke-width="1.6" opacity=".6"/>
      </svg>`;
    }
    /* 小车：车身 + 车顶 + 轮子 + 高光 */
    return `<svg class="tk-svg" viewBox="0 0 44 34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="22" cy="30.5" rx="16" ry="2.6" fill="rgba(0,0,0,.24)"/>
      <path d="M6 22h32v5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" fill="${dark}" stroke="#2c2340" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M4 14c0-3.4 2-5.4 5.4-5.4h25.2c3.4 0 5.4 2 5.4 5.4V22H4z"
            fill="${color}" stroke="#2c2340" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M13 9.4h18c2.6 0 4.4 1.8 4.4 4.4V14H8.6v-.2c0-2.6 1.8-4.4 4.4-4.4z" fill="${light}" opacity=".75"/>
      <path d="M15 9.2h14c2.2 0 3.8 1.6 3.8 3.8H11.2c0-2.2 1.6-3.8 3.8-3.8z" fill="#eaf6ff" stroke="#2c2340" stroke-width="1.5"/>
      <circle cx="13" cy="27" r="5" fill="#3f3a4d" stroke="#2c2340" stroke-width="1.7"/>
      <circle cx="31" cy="27" r="5" fill="#3f3a4d" stroke="#2c2340" stroke-width="1.7"/>
      <circle cx="13" cy="27" r="1.9" fill="#d8dbe4"/>
      <circle cx="31" cy="27" r="1.9" fill="#d8dbe4"/>
      <rect x="6" y="16.4" width="4" height="2.6" rx="1.3" fill="#ffe9a8" stroke="#2c2340" stroke-width="1.3"/>
    </svg>`;
  }

  /* ======================================================================
     四、装饰 —— 金币、星星、彩虹、骰子、礼盒
     ====================================================================== */

  const DECOR = {
    coin: (c) => `<svg class="d-svg" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="${c || '#ffd45e'}" stroke="#2c2340" stroke-width="2.4"/>
      <circle cx="16" cy="16" r="10" fill="none" stroke="#2c2340" stroke-width="1.5" opacity=".35"/>
      <path d="M11 12c0-1.6 2.2-2.6 5-2.6s5 1 5 2.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>
    </svg>`,

    star: (c) => `<svg class="d-svg" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M16 3l3.9 8.6 9.1 1-6.8 6.2 1.9 9.2L16 23.4 7.9 28l1.9-9.2L3 12.6l9.1-1z"
            fill="${c || '#ffd45e'}" stroke="#2c2340" stroke-width="2" stroke-linejoin="round"/>
    </svg>`,

    die: (c) => `<svg class="d-svg" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4" y="4" width="24" height="24" rx="6" fill="${c || '#fff'}" stroke="#2c2340" stroke-width="2.4"/>
      <circle cx="11" cy="11" r="2.4" fill="#2c2340"/><circle cx="21" cy="21" r="2.4" fill="#2c2340"/>
      <circle cx="16" cy="16" r="2.4" fill="#2c2340"/>
    </svg>`,

    gift: () => `<svg class="d-svg" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="5" y="13" width="22" height="15" rx="2.5" fill="#ff8fab" stroke="#2c2340" stroke-width="2.2"/>
      <rect x="3" y="8" width="26" height="7" rx="2.2" fill="#ffb3c9" stroke="#2c2340" stroke-width="2.2"/>
      <path d="M16 8v20" stroke="#2c2340" stroke-width="2"/>
      <path d="M16 8c-4 0-6-1.4-6-3.2S12 2 16 8zM16 8c4 0 6-1.4 6-3.2S20 2 16 8z"
            fill="#ffd45e" stroke="#2c2340" stroke-width="2" stroke-linejoin="round"/>
    </svg>`,

    plant: () => `<svg class="d-svg" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M16 18c0-6 2-10 7-12 1 6-1 11-7 12zM16 18C16 12 14 8 9 6 8 12 10 17 16 18z"
            fill="#7ed957" stroke="#2c2340" stroke-width="2" stroke-linejoin="round"/>
      <path d="M10 20h12l-1.6 9H11.6z" fill="#ff9a5c" stroke="#2c2340" stroke-width="2.2" stroke-linejoin="round"/>
    </svg>`,
  };

  /* ======================================================================
     五、工具
     ====================================================================== */

  function shade(hex, amt) {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, r + amt));
    g = Math.max(0, Math.min(255, g + amt));
    b = Math.max(0, Math.min(255, b + amt));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /**
   * 取棋格图标 HTML
   * @param {string} type  data.js 里的 cell.type
   */
  function cellIcon(type) {
    const body = ICONS[type] || ICONS.market;
    return `<svg class="cell-art" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
  }

  global.Art = {
    cellIcon, jobIcon, face, token, decor: DECOR, shade,
    hasIcon: t => !!ICONS[t],
    FACES: Object.keys(FACES),
  };

})(window);
