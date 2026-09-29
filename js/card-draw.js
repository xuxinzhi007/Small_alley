import { ctx, SCREEN_WIDTH, SCREEN_HEIGHT, HUD_TOP, SAFE_BOTTOM } from './render.js';
import { resident, relationPairs } from './cards.js';

const P = { paper: '#fff8eb', ink: '#594c40', muted: '#938473', line: '#e3d3bb', green: '#718b65', terra: '#ba7155', blue: '#6f8fa8', good: '#7f9a6e', bad: '#b75a4e' };
const clamp = (n, a, b) => Math.max(a, Math.min(b, Number(n) || 0));
function box(x, y, w, h, color, r = 9) {
  if (w <= 0 || h <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function outline(x, y, w, h, color, r = 9) {
  if (w <= 0 || h <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
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
function wrap(value, x, y, width, lines, size = 13, leading = 20) {
  ctx.font = `${size}px sans-serif`;
  const chars = Array.from(String(value || '')); const result = []; let line = '';
  for (const c of chars) {
    if (c === '\n' || ctx.measureText(line + c).width > width) { result.push(line); line = c === '\n' ? '' : c; }
    else line += c;
  }
  if (line) result.push(line);
  result.slice(0, lines).forEach((s, i) => text(s + (i === lines - 1 && result.length > lines ? '…' : ''), x, y + i * leading, width, size));
}
function button(state, id, label, x, y, w, h = 48, active = false, kind = 'plain') {
  const pressed = state.anim && state.anim.pressId === id;
  const color = pressed ? '#dccfb7' : kind === 'primary' ? P.green : kind === 'danger' ? '#f1ded4' : '#f3e8d7';
  box(x, y, w, h, color);
  text(label, x + w / 2, y + h / 2, w - 16, 13, kind === 'primary' ? '#fffaf0' : P.ink, 'center');
  state.hotspots.push({ id, x, y, w, h });
}
function bar(x, y, w, h, value, color) {
  box(x, y, w, h, '#00000012', h / 2);
  box(x, y, w * clamp(value, 0, 100) / 100, h, color, h / 2);
}
function relationColor(value) { return value > 0 ? P.good : value < 0 ? P.bad : P.muted; }
function near(cur, target, k) {
  const next = cur + (target - cur) * k;
  return Math.abs(target - next) < 0.4 ? target : next;
}
function bars(state) {
  const world = state.world;
  const d = state.display;
  if (Number.isNaN(d.atmosphere)) {
    d.atmosphere = world.atmosphere;
    for (const r of world.residents) d.residents[r.id] = { survival: r.survival, mood: r.mood };
  }
  const k = 0.16;
  d.atmosphere = near(d.atmosphere, world.atmosphere, k);
  for (const r of world.residents) {
    const dd = d.residents[r.id] || (d.residents[r.id] = { survival: r.survival, mood: r.mood });
    dd.survival = near(dd.survival, r.survival, k);
    dd.mood = near(dd.mood, r.mood, k);
  }
}

function header(state) {
  const world = state.world;
  const atm = state.display.atmosphere;
  text('小巷物语', 12, HUD_TOP + 12, 200, 18);
  text(`第 ${world.day} 天 · 命运之手`, 12, HUD_TOP + 38, 200, 11, P.muted);
  const bw = 128, bx = SCREEN_WIDTH - 12 - bw;
  text('氛围', bx, HUD_TOP + 12, 30, 11, P.muted, 'left');
  bar(bx + 34, HUD_TOP + 8, bw - 34, 12, atm, P.blue);
  text(String(Math.round(atm)), bx, HUD_TOP + 36, 30, 11, P.blue, 'left');
}

function residents(state) {
  const world = state.world;
  const y = HUD_TOP + 58;
  const colW = (SCREEN_WIDTH - 24 - 16) / 3;
  world.residents.forEach((r, i) => {
    const x = 12 + i * (colW + 8);
    const dd = state.display.residents[r.id];
    text(r.name, x + colW / 2, y, colW, 13, P.ink, 'center');
    text('生存', x, y + 22, colW - 34, 10, P.muted);
    bar(x + 26, y + 17, colW - 26, 10, dd.survival, P.green);
    text(String(Math.round(dd.survival)), x + colW - 12, y + 22, 22, 10, P.green, 'right');
    text('心情', x, y + 44, colW - 34, 10, P.muted);
    bar(x + 26, y + 39, colW - 26, 10, dd.mood, P.terra);
    text(String(Math.round(dd.mood)), x + colW - 12, y + 44, 22, 10, P.terra, 'right');
  });
  const pairs = relationPairs(world);
  const label = '关系 · ' + pairs.map(p => `${resident(world, p.a).name}⇄${resident(world, p.b).name} ${p.value}`).join(' · ');
  text(label, 12, y + 74, SCREEN_WIDTH - 24, 11, P.muted);
  return y + 74;
}

function card(state, cardBottom, now) {
  const world = state.world;
  const current = state.current;
  const y = state.cardTop;
  const h = cardBottom - y;
  const x = 12, w = SCREEN_WIDTH - 24;
  const t = clamp((now - state.anim.cardAt) / 220, 0, 1);
  const ease = 1 - Math.pow(1 - t, 3);
  ctx.save();
  ctx.globalAlpha = t;
  ctx.translate(0, (1 - ease) * 14);
  box(x + 2, y + 6, w, h, '#30271b33', 18); box(x, y, w, h, P.paper, 18);
  if (!current) {
    text('平静的一天', x + 18, y + 30, w - 36, 17);
    wrap('今天没有非处理不可的事。巷子照常过着，你也可以趁这会儿歇一歇，或者过一天看看。', x + 18, y + 66, w - 36, 3, 13, 20);
    const recent = world.records.slice(-3).reverse();
    recent.forEach((rec, i) => {
      const yy = y + 132 + i * 58;
      text(`第 ${rec.day} 天`, x + 18, yy, 56, 10, P.terra);
      wrap(rec.text, x + 84, yy, w - 102, 2, 11, 16);
    });
    button(state, 'pass', '过一天', x + 18, y + h - 62, w - 36, 48, false, 'primary');
    ctx.restore();
    return;
  }
  text(current.title, x + 18, y + 26, w - 36, 11, P.muted);
  box(x + 18, y + 42, 16, 16, '#f0e2cc', 8);
  text(current.name, x + 42, y + 50, w - 60, 14, P.ink);
  wrap(current.text, x + 18, y + 82, w - 36, 6, 15, 24);
  const bodyBottom = y + 82 + 6 * 24;
  const optH = 52, gap = 10;
  current.options.forEach((opt, i) => {
    const oy = bodyBottom + 8 + i * (optH + gap);
    button(state, 'opt:' + i, opt.label, x + 18, oy, w - 36, optH, false, 'plain');
  });
  const deferY = bodyBottom + 8 + current.options.length * (optH + gap) - gap + 6;
  button(state, 'defer', '先搁下这件事', x + 18, deferY, w - 36, 44, false, 'danger');
  ctx.restore();
}

function resultCard(state, cardBottom, now) {
  const y = state.cardTop;
  const h = cardBottom - y;
  const x = 12, w = SCREEN_WIDTH - 24;
  const t = clamp((now - state.anim.cardAt) / 220, 0, 1);
  const ease = 1 - Math.pow(1 - t, 3);
  ctx.save();
  ctx.globalAlpha = t;
  ctx.translate(0, (1 - ease) * 14);
  box(x + 2, y + 6, w, h, '#30271b33', 18); box(x, y, w, h, P.paper, 18);
  box(x + 18, y + 24, 40, 22, '#fff1d6', 8);
  outline(x + 18, y + 24, 40, 22, '#e0b978', 8);
  text('结果', x + 38, y + 35, 36, 12, P.terra, 'center');
  wrap(state.result.say, x + 18, y + 66, w - 36, 4, 15, 24);
  button(state, 'continue', '继续', x + 18, y + h - 62, w - 36, 48, false, 'primary');
  ctx.restore();
}

function noticeBanner(state, now) {
  if (!state.notice) return;
  const t = clamp((now - state.anim.noticeAt) / 260, 0, 1);
  if (t <= 0) return;
  ctx.save();
  ctx.globalAlpha = t;
  const w = SCREEN_WIDTH - 80, h = 44, x = 40, y = SCREEN_HEIGHT / 2 - 22;
  box(x + 2, y + 4, w, h, '#30271b33', 12); box(x, y, w, h, '#fff1d6', 12);
  outline(x, y, w, h, '#e0b978', 12);
  text(state.notice, x + 16, y + h / 2, w - 32, 13, P.bad, 'center');
  ctx.restore();
}

function journal(state) {
  state.hotspots = [];
  box(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, '#41392f85', 0);
  const x = 12, y = HUD_TOP, w = SCREEN_WIDTH - 24, h = SCREEN_HEIGHT - SAFE_BOTTOM - y - 12;
  box(x + 2, y + 6, w, h, '#30271b33', 16); box(x, y, w, h, P.paper, 16);
  button(state, 'close', '收起', x + w - 64, y + 8, 52, 44);
  text('小巷纪事', x + 16, y + 29, w - 92, 18);
  const entries = state.world.records.slice().reverse();
  const space = Math.max(0, h - 90), count = Math.max(1, Math.min(6, Math.floor(space / 66)));
  state.page = clamp(Math.floor(state.page || 0), 0, Math.max(0, Math.ceil(entries.length / count) - 1));
  const pages = Math.max(1, Math.ceil(entries.length / count));
  const rowH = Math.min(120, space / count);
  entries.slice(state.page * count, (state.page + 1) * count).forEach((entry, i) => {
    const yy = y + 64 + i * rowH;
    box(x + 12, yy, w - 24, rowH - 8, '#f4ead9', 8);
    text(`第 ${entry.day} 天`, x + 24, yy + 17, w - 48, 11, P.terra);
    wrap(entry.text, x + 24, yy + 40, w - 48, Math.max(1, Math.floor((rowH - 48) / 18)), 13, 18);
  });
  if (!entries.length) wrap('还没有发生什么。', x + 24, y + 120, w - 48, 2);
  const bw = (w - 32) / 3;
  button(state, 'page:prev', '上一页', x + 12, y + h - 64, bw, 44, false, 'plain');
  text(`${state.page + 1} / ${pages}`, x + w / 2, y + h - 42, bw - 4, 12, P.muted, 'center');
  button(state, 'page:next', '下一页', x + w - 12 - bw, y + h - 64, bw, 44, false, 'plain');
}

export function renderCards(state, now) {
  now = Number(now) || Date.now();
  const world = state.world;
  state.hotspots = [];
  ctx.save(); box(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, P.paper, 0);
  bars(state);
  header(state);
  state.cardTop = residents(state) + 16;
  const bottom = SCREEN_HEIGHT - SAFE_BOTTOM;
  const navY = bottom - 46;
  const cardBottom = navY - 10;
  if (state.phase === 'result') resultCard(state, cardBottom, now);
  else card(state, cardBottom, now);
  noticeBanner(state, now);
  button(state, 'journal', '小巷纪事', SCREEN_WIDTH / 2 - 60, navY, 120, 42, false, 'plain');
  if (state.journal) journal(state);
  ctx.restore();
}
