import { ctx, SCREEN_WIDTH, SCREEN_HEIGHT, HUD_TOP, SAFE_BOTTOM } from './render.js';
import { TILE, COLS, ROWS, BUILDINGS, isWall, isSheltered, CATALOG } from './sandbox.js';

const P = { paper: '#fff8eb', ink: '#594c40', muted: '#938473', line: '#e3d3bb', green: '#718b65', terra: '#ba7155' };
const clamp = (n, a, b) => Math.max(a, Math.min(b, Number(n) || 0));
function box(x, y, w, h, color, r = 9) {
  if (w <= 0 || h <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function ellipse(x, y, rx, ry, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(rx, ry); ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.restore();
}
function text(value, x, y, width, size = 12, color = P.ink, align = 'left') {
  ctx.font = `${size}px sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  let s = String(value == null ? '' : value);
  if (ctx.measureText(s).width > width) {
    while (s && ctx.measureText(s + '…').width > width) s = s.slice(0, -1);
    s += '…';
  }
  ctx.fillText(s, x, y);
}
function wrap(value, x, y, width, lines, size = 13, leading = 19) {
  ctx.font = `${size}px sans-serif`;
  const chars = Array.from(String(value || '')); const result = []; let line = '';
  for (const c of chars) {
    if (c === '\n' || ctx.measureText(line + c).width > width) { result.push(line); line = c === '\n' ? '' : c; }
    else line += c;
  }
  if (line) result.push(line);
  result.slice(0, lines).forEach((s, i) => text(s + (i === lines - 1 && result.length > lines ? '…' : ''), x, y + i * leading, width, size));
}
function button(state, id, label, x, y, w, h = 44, active = false, enabled = true) {
  box(x, y, w, h, !enabled ? '#eee5d7' : active ? P.green : '#f3e8d7');
  text(label, x + w / 2, y + h / 2, w - 10, 12, !enabled ? '#afa393' : active ? '#fffaf0' : P.ink, 'center');
  if (enabled) state.hotspots.push({ id, x, y, w, h });
}
function objectName(type) {
  const item = Array.isArray(CATALOG) ? CATALOG.find(v => v.type === type || v.id === type) : CATALOG && CATALOG[type];
  return (typeof item === 'string' ? item : item && (item.name || item.label)) || ({ bench: '长椅', flower: '花盆', food: '食物', cat: '小白' })[type] || type;
}
function tree(x, y, seed) {
  ellipse(x + 6, y + 8, 17, 9, '#75694b22');
  box(x - 2, y - 12, 5, 20, '#aa8460', 2);
  ellipse(x - 7, y - 15, 12, 13, '#9aa779'); ellipse(x + 5, y - 20, 15, 15, '#809766');
  ellipse(x, y - 26, 10, 10, '#b0b88a');
  if (seed % 2) ellipse(x + 9, y - 19, 2, 2, '#e8c792');
}
function ground(state) {
  box(0, 0, COLS * TILE, ROWS * TILE, '#bcc29a', 0);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const px = x * TILE, py = y * TILE;
    const interior = BUILDINGS.some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
    if (!interior) {
      const road = (y >= 8 && y <= 11) || (x >= 9 && x <= 12) || x === 5 || x === 18;
      box(px, py, TILE, TILE, road ? '#e4d5b7' : '#bdc79d', 0);
      if (road) box(px + 4, py + TILE - 2, TILE - 8, 1, '#c7b79766', 0);
      else if ((x + y) % 3 === 0) { box(px + 12, py + 23, 2, 5, '#96aa7b', 1); box(px + 16, py + 21, 2, 6, '#a1b487', 1); }
      if ((x * 17 + y * 23) % 19 === 0) {
        ellipse(px + 7, py + 8, 4, 2, '#a5ad80'); ellipse(px + 12, py + 7, 2, 2, '#d09b82');
      }
    }
  }
  BUILDINGS.forEach((b, i) => {
    const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
    box(x + 5, y + 7, w, h, '#76634d25', 7);
    box(x, y, w, h, ['#efe1ca', '#e8d7bb', '#e0dfbb'][i % 3], 5);
    for (let yy = y + 12; yy < y + h; yy += 16) box(x + 5, yy, w - 10, 1, '#c4af8b33', 0);
    for (let gy = b.y; gy < b.y + b.h; gy++) for (let gx = b.x; gx < b.x + b.w; gx++) {
      if (!isWall(gx, gy)) continue;
      // Low cutaway walls follow collision cells, never a roof over the inhabitants.
      box(gx * TILE + 2, gy * TILE + 4, TILE - 4, TILE - 6, '#a7876c', 3);
      box(gx * TILE + 2, gy * TILE + 2, TILE - 4, TILE - 12, '#cfb69b', 3);
      box(gx * TILE + 5, gy * TILE + 4, TILE - 10, 3, '#efddbf', 1);
    }
    box(x + 8, y + 7, Math.min(w - 16, 108), 23, '#fff6e4e8', 5);
    text(b.name, x + 16, y + 19, Math.min(w - 32, 92), 11);
  });
  // Border planting sits outside walkable tile centres and is purely ornamental.
  for (let y = 1; y < ROWS; y += 3) {
    if (!BUILDINGS.some(b => b.x === 0 && y >= b.y && y < b.y + b.h)) tree(3, y * TILE, y);
    if (!BUILDINGS.some(b => b.x + b.w >= COLS && y >= b.y && y < b.y + b.h)) tree(COLS * TILE - 4, y * TILE + 12, y + 1);
  }
  if (state.mode === 'create') {
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (isSheltered(state.world, { x, y })) box(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4, '#649baf40', 3);
    }
    ctx.strokeStyle = '#8d805b28'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x <= COLS; x++) { ctx.moveTo(x * TILE, 0); ctx.lineTo(x * TILE, ROWS * TILE); }
    for (let y = 0; y <= ROWS; y++) { ctx.moveTo(0, y * TILE); ctx.lineTo(COLS * TILE, y * TILE); }
    ctx.stroke();
  }
}
function drawObject(o, ghost = false) {
  const x = (o.x + .5) * TILE, y = (o.y + .5) * TILE;
  ctx.save(); if (ghost) ctx.globalAlpha = .65;
  ellipse(x + 3, y + 7, 17, 7, '#6d573c25');
  if (o.type === 'shelter') {
    box(x - 3, y - 27, 6, 40, '#806749', 2);
    ellipse(x, y - 23, 55, 34, '#547f86');
    box(x - 53, y - 24, 106, 12, '#77a6aa', 4);
    for (let i = -4; i <= 4; i++) box(x + i * 11 - 3, y - 25, 6, 14, '#e9dbb7', 2);
    ellipse(x, y - 55, 3, 3, '#806749');
  } else if (o.type === 'bench') {
    box(x - 13, y - 3, 4, 15, '#82634d', 1); box(x + 9, y - 3, 4, 15, '#82634d', 1);
    box(x - 18, y - 12, 36, 7, '#b88659', 2); box(x - 18, y - 3, 36, 10, '#c99b6c', 2);
    box(x - 16, y - 1, 32, 2, '#e3bb8d', 1);
  } else if (o.type === 'flower') {
    box(x - 10, y - 2, 20, 14, '#b5785d', 4); ellipse(x, y - 2, 12, 5, '#dbab85');
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4, xx = x + Math.cos(a) * 8, yy = y - 10 + Math.sin(a) * 5;
      ellipse(xx, yy + 2, 5, 6, '#839766'); ellipse(xx, yy - 3, 4, 4, i % 2 ? '#f2d69d' : '#d89485');
      ellipse(xx, yy - 3, 1.4, 1.4, '#a77d4c');
    }
  } else if (o.type === 'cat') {
    ellipse(x + 8, y - 1, 11, 4, '#e6ddcd');
    ellipse(x, y - 4, 12, 8, '#f4eee2');
    ellipse(x - 2, y - 10, 8, 8, '#f6f1e6');
    ellipse(x - 6, y - 14, 4, 5, '#efe8da'); ellipse(x + 1, y - 14, 4, 5, '#efe8da');
    ellipse(x - 5, y - 10, 1.3, 1.5, '#5b5146'); ellipse(x - 1, y - 10, 1.3, 1.5, '#5b5146');
    ellipse(x - 3, y - 7, 1, 1, '#c98d80');
  } else {
    box(x - 14, y, 4, 12, '#967351', 1); box(x + 10, y, 4, 12, '#967351', 1);
    box(x - 18, y - 10, 36, 18, '#d4ad79', 4); box(x - 15, y - 8, 30, 12, '#f6e8c9', 3);
    if (o.stock > 0) { ellipse(x - 6, y - 4, 5, 4, '#c48b51'); ellipse(x + 5, y - 4, 4, 4, '#bc775b'); }
  }
  ctx.restore();
}
function person(p, hero, now, moving) {
  const x = (p.x + .5) * TILE, y = (p.y + .5) * TILE;
  const step = moving && p.path && p.path.length ? Math.sin(now / 115 + String(p.id || '').length) : 0;
  const coat = hero ? '#b66e55' : ['#7e977f', '#bb9870', '#8b91a5'][String(p.id).charCodeAt(String(p.id).length - 1) % 3];
  ellipse(x + 2, y + 8, 10, 5, '#59472d30');
  box(x - 6, y + 2 + step * 2, 4, 9, '#645447', 2); box(x + 2, y + 2 - step * 2, 4, 9, '#645447', 2);
  box(x - 9, y - 12 - Math.abs(step), 18, 20, '#fff4df', 7);
  box(x - 8, y - 11 - Math.abs(step), 16, 18, coat, 6);
  ellipse(x, y - 17 - Math.abs(step), 8, 9, '#efd0a4');
  ellipse(x, y - 22 - Math.abs(step), 8, 5, hero ? '#72533d' : '#695c4b');
  ellipse(x - 3, y - 16, 1, 1, '#67503e'); ellipse(x + 3, y - 16, 1, 1, '#67503e');
  if (hero) { ellipse(x, y - 37, 3, 3, '#ba7155'); }
}
function worldHotspot(state, id, x, y, w, h) {
  const v = state.viewport;
  const sx = x - state.camera.x + v.x, sy = y - state.camera.y + v.y;
  const left = Math.max(v.x, sx), top = Math.max(v.y, sy);
  const right = Math.min(v.x + v.w, sx + w), bottom = Math.min(v.y + v.h, sy + h);
  if (right > left && bottom > top) state.hotspots.push({ id, x: left, y: top, w: right - left, h: bottom - top });
}
function preview(state) {
  if (!state.hover || !state.tool || state.mode !== 'create') return;
  const { x, y } = state.hover, world = state.world;
  const selected = world.objects.find(o => o.id === state.selected);
  const moving = state.tool === 'move';
  const type = moving ? selected && selected.type : state.tool;
  if (!Object.prototype.hasOwnProperty.call(CATALOG, type)) return;
  const occupied = p => Math.floor(p.x) === x && Math.floor(p.y) === y;
  const valid = Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < COLS && y < ROWS && !isWall(x, y)
    && !world.objects.some(o => (!moving || o.id !== state.selected) && occupied(o))
    && !world.residents.some(occupied) && !occupied(world.hero);
  box(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4, valid ? '#71956470' : '#c45d5570', 5);
  drawObject({ type, x, y, stock: type === 'food' ? 1 : undefined }, true);
  ctx.strokeStyle = valid ? '#4f7b47' : '#b74d43'; ctx.lineWidth = 2;
  ctx.strokeRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
}
function clockText(clock) {
  if (typeof clock !== 'number') return String(clock == null ? '' : clock);
  const minutes = ((Math.floor(clock) % 1440) + 1440) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
function isNight(clock) {
  const hour = typeof clock === 'number' ? (clock % 1440) / 60 : Number(String(clock).split(':')[0]);
  return hour >= 18 || hour < 6;
}
function atmosphere(state, now) {
  const v = state.viewport;
  if (isNight(state.world.clock)) {
    box(v.x, v.y, v.w, v.h, '#30375375', 0);
    BUILDINGS.forEach(b => {
      const x = (b.x + b.w / 2) * TILE - state.camera.x, y = (b.y + b.h / 2) * TILE - state.camera.y + v.y;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, TILE * 2);
      glow.addColorStop(0, '#ffd79528'); glow.addColorStop(1, '#ffd79500');
      ctx.fillStyle = glow; ctx.fillRect(x - TILE * 2, y - TILE * 2, TILE * 4, TILE * 4);
    });
  }
  if (state.world.weather === 'rainy') {
    box(v.x, v.y, v.w, v.h, '#75879b22', 0);
    ctx.strokeStyle = '#f4f1e57a'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 65; i++) {
      const x = ((i * 73 - now * .025) % (v.w + 30) + v.w + 30) % (v.w + 30) - 15;
      const y = v.y + (i * 97 + now * .22) % Math.max(1, v.h);
      const p = { x: Math.floor((x - v.x + state.camera.x) / TILE), y: Math.floor((y - v.y + state.camera.y) / TILE) };
      if (!isSheltered(state.world, p)) { ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 11); }
    }
    ctx.stroke();
  }
}
function panel(state) {
  state.hotspots = [];
  box(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, '#41392f85', 0);
  const x = 12, y = HUD_TOP, w = SCREEN_WIDTH - 24, h = SCREEN_HEIGHT - SAFE_BOTTOM - y - 12;
  box(x + 2, y + 6, w, h, '#30271b33', 16); box(x, y, w, h, P.paper, 16);
  button(state, 'close', '收起', x + w - 64, y + 8, 52);
  text(state.panel === 'journal' ? '街区手记' : '留下生活小事', x + 16, y + 29, w - 92, 18);
  const bottom = y + h;
  if (state.panel === 'journal') {
    text('私密留存 · 等待相遇 · 已经发生', x + 16, y + 62, w - 32, 11, P.muted);
    const entries = [
      ...state.world.notes.slice().reverse().map(n => ({ text: n.text, label: n.status === 'private' ? '私密 · 仅本地' : n.status === 'pending' ? '待发生 · 地点小事' : '已发生 · 生活小事' })),
      ...state.world.journal.slice().reverse().map(j => ({ text: j.text, label: `第 ${j.day} 天 · 街区发生` })),
    ];
    const space = Math.max(0, h - 194), count = Math.max(1, Math.min(4, Math.floor(space / 88)));
    const pages = Math.max(1, Math.ceil(entries.length / count)); state.page = clamp(Math.floor(state.page), 0, pages - 1);
    const rowH = Math.min(126, space / count);
    entries.slice(state.page * count, (state.page + 1) * count).forEach((entry, i) => {
      const yy = y + 82 + i * rowH;
      box(x + 12, yy, w - 24, rowH - 8, '#f4ead9', 8);
      text(entry.label, x + 24, yy + 17, w - 48, 11, P.terra);
      wrap(entry.text, x + 24, yy + 40, w - 48, Math.max(1, Math.floor((rowH - 48) / 18)), 13, 18);
    });
    if (!entries.length) wrap('还没有手记。把一件生活小事留在这里，或交给街区里的一位居民。', x + 24, y + 120, w - 48, 4);
    const bw = (w - 32) / 3;
    button(state, 'page:prev', '上一页', x + 12, bottom - 108, bw, 44, false, state.page > 0);
    text(`${state.page + 1} / ${pages}`, x + w / 2, bottom - 86, bw - 4, 12, P.muted, 'center');
    button(state, 'page:next', '下一页', x + w - 12 - bw, bottom - 108, bw, 44, false, state.page + 1 < pages);
    button(state, 'note:new', '＋ 记一件生活小事', x + 12, bottom - 56, w - 24, 44, true);
  } else {
    const privateNote = !state.noteResident || state.noteResident === 'private';
    const place = state.world.hero;
    text(privateNote ? '私密本地 · 不放入世界' : `当前地点 · ${Math.floor(place.x) + 1}, ${Math.floor(place.y) + 1}`, x + 16, y + 62, w - 32, 12, P.terra);
    const choices = [{ id: 'private', name: '仅自己' }, ...state.world.residents];
    const columns = Math.max(1, Math.floor((w - 24) / 92)); const rows = Math.ceil(choices.length / columns);
    const editH = Math.max(44, Math.min(142, h - 202 - rows * 48));
    box(x + 12, y + 82, w - 24, editH, '#f0e6d5', 9);
    wrap(state.noteText || '点这里输入，最多 80 字。', x + 24, y + 102, w - 48, Math.max(1, Math.floor((editH - 26) / 19)));
    state.hotspots.push({ id: 'note:edit', x: x + 12, y: y + 82, w: w - 24, h: editH });
    text('交给谁？选择居民后将在此地等待相遇', x + 16, y + 82 + editH + 20, w - 32, 11, P.muted);
    const start = y + 82 + editH + 38, bw = (w - 24 - (columns - 1) * 4) / columns;
    choices.forEach((r, i) => {
      const yy = start + Math.floor(i / columns) * 48;
      if (yy + 44 > bottom - 64) return;
      button(state, 'note:resident:' + r.id, r.name, x + 12 + (i % columns) * (bw + 4), yy, bw, 44, r.id === 'private' ? privateNote : state.noteResident === r.id);
    });
    button(state, 'note:save', privateNote ? '保存私密手记' : '把小事留在当前地点', x + 12, bottom - 56, w - 24, 44, true, Boolean(String(state.noteText || '').trim()));
  }
}

export function renderSandbox(state, now) {
  now = Number(now) || 0;
  const world = state.world, creating = state.mode === 'create';
  const toolbarH = creating ? 156 : 52;
  const toolbarY = SCREEN_HEIGHT - SAFE_BOTTOM - toolbarH;
  state.viewport = { x: 0, y: HUD_TOP + 62, w: SCREEN_WIDTH, h: Math.max(0, toolbarY - HUD_TOP - 62) };
  const v = state.viewport;
  state.camera.x = clamp(state.camera.x, 0, Math.max(0, COLS * TILE - v.w));
  state.camera.y = clamp(state.camera.y, 0, Math.max(0, ROWS * TILE - v.h));
  state.hotspots = [];
  ctx.save(); box(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, P.paper, 0);
  ctx.save(); ctx.beginPath(); ctx.rect(v.x, v.y, v.w, v.h); ctx.clip();
  ctx.save(); ctx.translate(v.x - state.camera.x, v.y - state.camera.y);
  ground(state);
  world.notes.filter(n => n.status === 'pending').forEach(n => {
    const x = (n.x + .5) * TILE, y = (n.y + .5) * TILE;
    ellipse(x, y, 14 + Math.sin(now / 600) * 2, 9, '#fff1bb99');
    box(x - 7, y - 5, 14, 10, '#fff9e3', 2);
    text('·', x, y, 12, 16, P.terra, 'center');
  });
  if (state.mode === 'life' && world.hero.path) world.hero.path.forEach(p => {
    ellipse((p.x + .5) * TILE, (p.y + .5) * TILE, 2, 2, '#b47a5866');
  });
  const entities = [ ...world.objects.map(o => ({ p: o, kind: 'object' })),
    ...world.residents.map(p => ({ p, kind: 'npc' })), { p: world.hero, kind: 'hero' } ];
  entities.sort((a, b) => a.p.y - b.p.y || (a.kind === 'object' ? -1 : 1));
  entities.forEach(({ p, kind }) => {
    const x = (p.x + .5) * TILE, y = (p.y + .5) * TILE;
    if (kind === 'object') {
      if (state.selected === p.id) {
        box(x - 20, y - 19, 40, 38, '#fff8dc99', 6);
        ctx.strokeStyle = P.terra; ctx.lineWidth = 2; ctx.strokeRect(x - 19, y - 18, 38, 36);
      }
      drawObject(p);
      if (state.selected === p.id || p.type === 'food') text(objectName(p.type) + (p.type === 'food' ? ` · ${p.stock == null ? 0 : p.stock}` : ''), x, y + 21, 74, 10, P.ink, 'center');
      worldHotspot(state, 'object:' + p.id, x - 22, y - 22, 44, 44);
    } else {
      person(p, kind === 'hero', now, !world.paused && !creating);
      text(kind === 'hero' ? world.name : p.name, x, y + 20, 74, 10, P.ink, 'center');
      if (kind === 'npc') worldHotspot(state, 'npc:' + p.id, x - 22, y - 29, 44, 52);
    }
  });
  preview(state);
  ctx.restore(); atmosphere(state, now);
  // Bubbles remain readable above the lighting and never capture ground input.
  const bubbleRects = [];
  world.residents.forEach(p => {
    const sx = (p.x + .5) * TILE - state.camera.x, sy = (p.y + .5) * TILE - state.camera.y + v.y;
    if (sx < -20 || sx > v.w + 20 || sy < v.y || sy > v.y + v.h + 40) return;
    const line = p.path.length ? p.activity : p.say || p.activity;
    if (!line) return;
    const width = Math.min(136, v.w - 12), left = clamp(sx - width / 2, 6, v.w - width - 6);
    if (bubbleRects.some(r => left < r.x + r.w && left + width > r.x && Math.abs(sy - r.y) < 30)) return;
    bubbleRects.push({ x: left, y: sy, w: width });
    box(left, sy - 65, width, 26, '#fff9ebeb', 8);
    text(line, left + width / 2, sy - 52, width - 12, 11, P.ink, 'center');
  });
  ctx.restore();
  // All chrome is drawn after the world; modal panels replace every other hit area.
  box(0, HUD_TOP - 4, SCREEN_WIDTH, 66, P.paper, 0);
  const titleW = creating ? SCREEN_WIDTH - 166 : SCREEN_WIDTH - 24;
  text(world.name ? `${world.name}的小巷` : '小巷', 12, HUD_TOP + 14, titleW, 17);
  text(`第 ${world.day} 天 · ${clockText(world.clock)} · ${world.weather === 'rainy' ? '雨' : '晴'}${world.paused ? ' · 已暂停' : ''}`, 12, HUD_TOP + 40, titleW, 11, P.muted);
  if (creating) {
    const start = SCREEN_WIDTH - 150;
    button(state, 'pause', world.paused ? '继续' : '暂停', start, HUD_TOP + 6, 44);
    button(state, 'weather', '晴雨', start + 49, HUD_TOP + 6, 44);
    button(state, 'time', '昼夜', start + 98, HUD_TOP + 6, 44);
  }
  const hint = state.notice || (creating ? '拖动画布浏览 · 点格子放置' : state.mode === 'observe' ? '观察居民 · 拖动画布看街区' : '点地面走走 · 拖动看看远处');
  if (v.h > 54) {
    box(10, v.y + v.h - 52, SCREEN_WIDTH - 20, 46, '#fff8ece8', 8);
    wrap(hint, 20, v.y + v.h - 39, SCREEN_WIDTH - 40, 2, 11, 18);
  }
  box(0, toolbarY, SCREEN_WIDTH, toolbarH + SAFE_BOTTOM, P.paper, 0);
  box(0, toolbarY, SCREEN_WIDTH, 1, P.line, 0);
  if (creating) {
    const gap = 6, bw = (SCREEN_WIDTH - 24 - gap * 2) / 3;
    const toolW = (SCREEN_WIDTH - 24 - gap * 3) / 4;
    Object.keys(CATALOG).forEach((type, i) => button(state, 'tool:' + type, objectName(type), 12 + i * (toolW + gap), toolbarY + 6, toolW, 44, state.tool === type));
    const selected = world.objects.find(o => o.id === state.selected);
    if (selected) {
      button(state, 'move', '移动', 12, toolbarY + 56, bw, 44, state.tool === 'move');
      button(state, 'remove', '移除', 12 + bw + gap, toolbarY + 56, bw);
    } else text('选中物品后可移动、移除', 12, toolbarY + 78, bw * 2 + gap, 11, P.muted);
    button(state, 'undo', '撤销', 12 + 2 * (bw + gap), toolbarY + 56, bw, 44, false, Boolean(state.undo));
  }
  const navY = SCREEN_HEIGHT - SAFE_BOTTOM - 48, navW = (SCREEN_WIDTH - 24) / 4;
  [['life', '生活'], ['observe', '观察'], ['create', '创造'], ['journal', '手记']].forEach(([id, label], i) => {
    button(state, id === 'journal' ? id : 'mode:' + id, label, 6 + i * (navW + 4), navY, navW, 44, state.mode === id);
  });
  if (state.panel === 'journal' || state.panel === 'note') panel(state);
  ctx.restore();
}
