import { ctx, SCREEN_WIDTH, SCREEN_HEIGHT, HUD_TOP, HUD_H, SAFE_BOTTOM } from './render.js';
import { PLACES, ROADS, clockText } from './content.js';

const INK = '#3a2c28';
const PAPER = '#f3ecdf';
const CARD = '#fffaf4';
const ROSE = '#9c4548';

function blit(image, dx, dy, size) {
  if (!image) return;
  ctx.drawImage(image, 0, 0, 16, 16, Math.round(dx), Math.round(dy), size, size);
}

function roundRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrap(text, maxWidth) {
  const lines = [];
  let line = '';
  const source = text || '';
  for (let i = 0; i < source.length; i += 1) {
    const next = line + source.charAt(i);
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = source.charAt(i);
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function placeById(id) {
  for (let i = 0; i < PLACES.length; i += 1) {
    if (PLACES[i].id === id) return PLACES[i];
  }
  return PLACES[0];
}

function mapBox() {
  return {
    x: 14,
    y: HUD_TOP,
    w: SCREEN_WIDTH - 28,
    h: SCREEN_HEIGHT - HUD_TOP - SAFE_BOTTOM - 12,
  };
}

function nodeCenter(place, box) {
  return {
    x: box.x + place.mx * box.w,
    y: box.y + 18 + place.my * (box.h - 36),
  };
}

function drawMap(state, here, canGo) {
  const box = mapBox();
  const seen = state.life.seen || {};
  ctx.fillStyle = 'rgba(42, 32, 28, 0.45)';
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  ctx.fillStyle = '#e4f0df';
  roundRect(box.x, box.y, box.w, box.h, 22);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('这一带', box.x + 18, box.y + 28);
  ctx.fillStyle = '#8a726c';
  ctx.font = '12px sans-serif';
  ctx.fillText('点一个地方走进去。点脚下这个，地图收起。', box.x + 18, box.y + 52);
  ctx.strokeStyle = '#f7f4ee';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  const field = { x: box.x + 8, y: box.y + 72, w: box.w - 16, h: box.h - 88 };
  ROADS.forEach((pair) => {
    if (!seen[pair[0]] || !seen[pair[1]]) return;
    const from = nodeCenter(placeById(pair[0]), field);
    const to = nodeCenter(placeById(pair[1]), field);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  });
  PLACES.forEach((place) => {
    const mark = seen[place.id];
    if (!mark) return;
    const at = nodeCenter(place, field);
    const w = place.name.length > 2 ? 72 : 56;
    const h = 34;
    const x = at.x - w / 2;
    const y = at.y - h / 2;
    const current = place.id === here.id;
    if (current) ctx.fillStyle = ROSE;
    else if (mark === 'near') ctx.fillStyle = '#efe6da';
    else if (place.id === 'balcony') ctx.fillStyle = '#7ea36a';
    else ctx.fillStyle = CARD;
    roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.fillStyle = current || (mark === 'seen' && place.id === 'balcony') ? '#fffaf4' : (mark === 'near' ? '#a89890' : INK);
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(place.name, at.x, at.y);
    if (!canGo) return;
    if (current) state.hotspots.push({ id: 'map-here', x, y, w, h });
    else state.hotspots.push({ id: `go-${place.id}`, x, y, w, h });
  });
  if (seen[here.id]) {
    const heroAt = nodeCenter(here, field);
    blit(state.art.hero, heroAt.x - 11, heroAt.y - 36, 22);
  }
}

function sheetLabel(text, x, y) {
  ctx.fillStyle = ROSE;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function stepButton(state, id, x, y, label) {
  ctx.fillStyle = '#fffaf4';
  roundRect(x, y, 26, 26, 13);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 13, y + 13);
  state.hotspots.push({ id, x, y, w: 26, h: 26 });
}

function bodyTile(state, x, y, w, h, label, value, max, key) {
  ctx.fillStyle = '#f6f0e6';
  roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.fillStyle = '#8a726c';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 10, y + 14);
  ctx.fillStyle = INK;
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(value == null ? '—' : String(value), x + w - 10, y + 14);
  const ratio = Math.max(0, Math.min(1, (Number(value) || 0) / max));
  ctx.fillStyle = '#efe4d6';
  roundRect(x + 10, y + 28, w - 78, 5, 2);
  ctx.fill();
  if (ratio > 0) {
    ctx.fillStyle = ROSE;
    roundRect(x + 10, y + 28, Math.max(5, (w - 78) * ratio), 5, 2);
    ctx.fill();
  }
  if (key) {
    stepButton(state, `edit-${key}-down`, x + w - 62, y + 26, '−');
    stepButton(state, `edit-${key}-up`, x + w - 32, y + 26, '+');
  }
}

function factTile(x, y, w, h, label, value) {
  ctx.fillStyle = '#f6f0e6';
  roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.fillStyle = '#8a726c';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 10, y + 16);
  ctx.fillStyle = INK;
  ctx.font = '15px sans-serif';
  ctx.fillText(value == null ? '—' : String(value), x + 10, y + 36);
}

function drawPerson(state) {
  const life = state.life || {};
  const person = life.person || {};
  const box = mapBox();
  const pad = 16;
  const inner = box.w - pad * 2;
  ctx.fillStyle = 'rgba(42, 32, 28, 0.45)';
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  ctx.fillStyle = CARD;
  roundRect(box.x, box.y, box.w, box.h, 22);
  ctx.fill();
  ctx.save();
  roundRect(box.x, box.y, box.w, box.h, 22);
  ctx.clip();

  ctx.fillStyle = '#f3e4df';
  roundRect(box.x + pad, box.y + 16, 64, 64, 16);
  ctx.fill();
  blit(state.art.hero, box.x + pad + 8, box.y + 24, 48);
  const creating = !!life.creating;
  ctx.fillStyle = INK;
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(person.name || '未命名', box.x + pad + 76, box.y + 34);
  state.hotspots.push({ id: 'edit-name', x: box.x + pad + 76, y: box.y + 16, w: 120, h: 32 });
  ctx.fillStyle = '#8a726c';
  ctx.font = '12px sans-serif';
  ctx.fillText(creating ? '这套是随机的，点名字可改' : '点名字修改', box.x + pad + 76, box.y + 54);
  ctx.fillStyle = '#f6f0e6';
  roundRect(box.x + pad + 76, box.y + 66, 72, 26, 13);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(person.sex || '女', box.x + pad + 112, box.y + 79);
  state.hotspots.push({ id: 'edit-sex', x: box.x + pad + 76, y: box.y + 66, w: 72, h: 26 });
  ctx.fillStyle = '#f3ecdf';
  roundRect(box.x + box.w - 86, box.y + 22, 70, 28, 14);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '13px sans-serif';
  ctx.fillText(creating ? '重随机' : '收起', box.x + box.w - 51, box.y + 36);
  state.hotspots.push({
    id: creating ? 'edit-roll' : 'person-close',
    x: box.x + box.w - 86,
    y: box.y + 22,
    w: 70,
    h: 28,
  });

  const gap = 8;
  const tileW = (inner - gap) / 2;
  const tileY = box.y + 100;
  const tiles = [
    ['身高', person.height == null ? '—' : `${person.height} cm`, 'height'],
    ['体重', person.weight == null ? '—' : `${person.weight} kg`, 'weight'],
    ['视力', person.sight, 'sight'],
    ['体温', person.temp == null ? '—' : `${person.temp} ℃`, 'temp'],
    ['年龄', person.age == null ? '—' : `${person.age} 岁`, 'age'],
  ];
  tiles.forEach((tile, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = box.x + pad + col * (tileW + gap);
    const ty = tileY + row * 58;
    const wide = index === 4 ? inner : tileW;
    factTile(x, ty, wide, 50, tile[0], tile[1]);
    stepButton(state, `edit-${tile[2]}-down`, x + wide - 62, ty + 12, '−');
    stepButton(state, `edit-${tile[2]}-up`, x + wide - 32, ty + 12, '+');
  });

  const birthY = tileY + 58 * 3;
  factTile(box.x + pad, birthY, inner, 50, '生日', person.birthday || '—');
  stepButton(state, 'edit-birthday-month-down', box.x + pad + inner - 148, birthY + 12, '−');
  stepButton(state, 'edit-birthday-month-up', box.x + pad + inner - 118, birthY + 12, '+');
  ctx.fillStyle = '#8a726c';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('月', box.x + pad + inner - 168, birthY + 25);
  stepButton(state, 'edit-birthday-day-down', box.x + pad + inner - 62, birthY + 12, '−');
  stepButton(state, 'edit-birthday-day-up', box.x + pad + inner - 32, birthY + 12, '+');
  ctx.fillStyle = '#8a726c';
  ctx.fillText('日', box.x + pad + inner - 82, birthY + 25);

  let y = birthY + 66;
  sheetLabel('身体', box.x + pad, y);
  y += 14;
  const bars = [
    ['健康', person.health, 100, 'health'],
    ['体力', person.stamina, 100, 'stamina'],
    ['饥饿', person.hunger, 100, 'hunger'],
    ['口渴', person.thirst, 100, 'thirst'],
    ['清洁', person.clean, 100, 'clean'],
    ['睡意', person.sleep, 100, 'sleep'],
  ];
  bars.forEach((row, index) => {
    const col = index % 2;
    const line = Math.floor(index / 2);
    const x = box.x + pad + col * (tileW + gap);
    const ty = y + line * 62;
    bodyTile(state, x, ty, tileW, 56, row[0], row[1], row[2], row[3]);
  });
  ctx.restore();
  const by = box.y + box.h - 58;
  ctx.fillStyle = creating ? '#f6f0e6' : '#f3e4df';
  roundRect(box.x + pad, by, creating ? (inner - 8) / 2 : inner, 42, 14);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (creating) {
    ctx.fillText('再随机一套', box.x + pad + (inner - 8) / 4, by + 21);
    state.hotspots.push({ id: 'edit-roll', x: box.x + pad, y: by, w: (inner - 8) / 2, h: 42 });
    ctx.fillStyle = ROSE;
    roundRect(box.x + pad + (inner + 8) / 2, by, (inner - 8) / 2, 42, 14);
    ctx.fill();
    ctx.fillStyle = '#fffaf4';
    ctx.fillText('开始今天', box.x + pad + (inner + 8) / 2 + (inner - 8) / 4, by + 21);
    state.hotspots.push({ id: 'edit-start', x: box.x + pad + (inner + 8) / 2, y: by, w: (inner - 8) / 2, h: 42 });
  } else {
    ctx.fillText('再随机一套', box.x + box.w / 2, by + 21);
    state.hotspots.push({ id: 'edit-roll', x: box.x + pad, y: by, w: inner, h: 42 });
  }
}

function drawBag(state) {
  const life = state.life || {};
  const box = mapBox();
  const bag = life.pocket || [];
  ctx.fillStyle = 'rgba(42, 32, 28, 0.45)';
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  ctx.fillStyle = CARD;
  roundRect(box.x, box.y, box.w, box.h, 22);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('背包', box.x + 20, box.y + 36);
  ctx.fillStyle = '#f3ecdf';
  roundRect(box.x + box.w - 86, box.y + 22, 70, 28, 14);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('收起', box.x + box.w - 51, box.y + 36);
  state.hotspots.push({ id: 'bag-close', x: box.x + box.w - 86, y: box.y + 22, w: 70, h: 28 });
  let y = box.y + 78;
  if (!bag.length) {
    ctx.fillStyle = '#8a726c';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('还是空的', box.x + 20, y);
    return;
  }
  bag.forEach((item) => {
    ctx.fillStyle = '#f6f0e6';
    roundRect(box.x + 16, y, box.w - 32, 44, 12);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.name, box.x + 28, y + 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#8a726c';
    ctx.fillText(`×${item.qty}`, box.x + box.w - 28, y + 22);
    y += 52;
  });
}
function drawDay(state) {
  const life = state.life || {};
  const card = state.card || {};
  const weather = life.weather === 'rainy' ? '下雨' : (life.weather === 'breezy' ? '有风' : '晴');
  const top = HUD_TOP + HUD_H;
  const boxH = SCREEN_HEIGHT - top - SAFE_BOTTOM - 16;
  const x = 16;
  const w = SCREEN_WIDTH - 32;
  ctx.fillStyle = CARD;
  roundRect(x, top, w, boxH, 22);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  roundRect(x, top, w, boxH, 22);
  ctx.clip();
  ctx.fillStyle = ROSE;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('今日', x + 20, top + 18);
  ctx.fillStyle = INK;
  ctx.font = '22px sans-serif';
  ctx.fillText(card.title || `第 ${life.day || 1} 天`, x + 20, top + 38);
  ctx.fillStyle = '#8a726c';
  ctx.font = '13px sans-serif';
  ctx.fillText(`${weather}  ·  到 ${clockText(life.clock)}`, x + 20, top + 70);
  const facts = [
    ['硬币', life.coins],
    ['精神', life.spirit],
    ['文化', life.culture],
    ['邻里', life.neighbor],
  ];
  const factW = (w - 40 - 18) / 4;
  facts.forEach((item, index) => {
    const fx = x + 20 + index * (factW + 6);
    ctx.fillStyle = '#f6f0e6';
    roundRect(fx, top + 96, factW, 44, 12);
    ctx.fill();
    ctx.fillStyle = '#8a726c';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(item[0], fx + factW / 2, top + 108);
    ctx.fillStyle = INK;
    ctx.font = '15px sans-serif';
    ctx.fillText(String(item[1] == null ? 0 : item[1]), fx + factW / 2, top + 126);
  });
  let y = top + 156;
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = '15px sans-serif';
  ctx.fillText(card.text || '这一天大多时候只是待在一起。', x + 20, y);
  y += 28;
  ctx.font = '14px sans-serif';
  const lines = [];
  (card.lines || []).forEach((block) => {
    wrap(block, w - 40).forEach((line) => lines.push(line));
  });
  const missed = [];
  (card.missed || []).forEach((block) => {
    wrap(block, w - 40).forEach((line) => missed.push(line));
  });
  const room = top + boxH - 78 - y;
  const lineH = 22;
  const slots = Math.max(1, Math.floor(room / lineH));
  const keep = lines.length > slots ? slots - 1 : lines.length;
  ctx.fillStyle = INK;
  lines.slice(0, keep).forEach((block) => {
    ctx.fillText(block, x + 20, y);
    y += lineH;
  });
  if (lines.length > keep) {
    ctx.fillStyle = '#8a726c';
    ctx.fillText(`还有 ${lines.length - keep} 行，记在小记里`, x + 20, y);
    y += lineH;
  }
  ctx.fillStyle = '#a89890';
  missed.forEach((block) => {
    if (y > top + boxH - 84) return;
    ctx.fillText(block, x + 20, y);
    y += lineH;
  });
  ctx.restore();
  const by = top + boxH - 62;
  ctx.fillStyle = ROSE;
  roundRect(x + 20, by, w - 40, 46, 16);
  ctx.fill();
  ctx.fillStyle = '#fffaf4';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('开始第二天', x + w / 2, by + 23);
  if (!state.busy && !state.bagOpen && !state.personOpen) {
    state.hotspots.push({ id: 'day-next', x: x + 20, y: by, w: w - 40, h: 46 });
  }
}

function choice(state, id, label, x, y, w, h, hot) {
  ctx.fillStyle = hot ? ROSE : CARD;
  roundRect(x, y, w, h, 16);
  ctx.fill();
  ctx.fillStyle = hot ? '#fffaf4' : INK;
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrap(label, w - 16).slice(0, 2);
  lines.forEach((line, index) => {
    ctx.fillText(line, x + w / 2, y + h / 2 + (index - (lines.length - 1) / 2) * 18);
  });
  if (!state.busy && !state.mapOpen && !state.personOpen && !state.bagOpen) state.hotspots.push({ id, x, y, w, h });
}

export function render(state) {
  ctx.imageSmoothingEnabled = false;
  state.hotspots = [];
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  if (!state.ready || !state.art || !state.card) {
    ctx.fillStyle = INK;
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.failed ? '画面没有载入' : '她在翻今天的牌…', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
    return;
  }
  const life = state.life || {};
  if (life.creating) {
    drawPerson(state);
    return;
  }
  const card = state.card;
  const weather = life.weather === 'rainy' ? '下雨' : (life.weather === 'breezy' ? '有风' : '晴');
  const here = PLACES.filter((place) => place.id === (life.place || 'bed'))[0] || PLACES[0];
  let y = HUD_TOP;
  ctx.fillStyle = INK;
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`小巷物语  第 ${life.day || 1} 天  ${clockText(life.clock)}  ${state.period || '清晨'}`, 16, y + 12);
  ctx.fillStyle = CARD;
  roundRect(SCREEN_WIDTH - 78, y, 62, 26, 13);
  ctx.fill();
  ctx.fillStyle = ROSE;
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('地图', SCREEN_WIDTH - 47, y + 13);
  if (!state.mapOpen && !state.personOpen && !state.bagOpen && !state.busy) state.hotspots.push({ id: 'map-open', x: SCREEN_WIDTH - 78, y, w: 62, h: 26 });
  ctx.textAlign = 'left';
  const start = 7 * 60;
  const end = 22 * 60;
  const span = Math.max(0, Math.min(1, ((life.clock || start) - start) / (end - start)));
  y += 28;
  ctx.fillStyle = '#e0d3c4';
  roundRect(16, y, SCREEN_WIDTH - 32, 6, 3);
  ctx.fill();
  ctx.fillStyle = ROSE;
  roundRect(16, y, Math.max(6, (SCREEN_WIDTH - 32) * span), 6, 3);
  ctx.fill();
  y += 18;
  const person = life.person || {};
  ctx.fillStyle = CARD;
  roundRect(16, y, 168, 40, 20);
  ctx.fill();
  blit(state.art.hero, 22, y + 6, 28);
  ctx.fillStyle = INK;
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(person.name || '未命名', 56, y + 20);
  ctx.fillStyle = CARD;
  roundRect(SCREEN_WIDTH - 78, y + 4, 62, 32, 16);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`包 ${(life.pocket || []).length}`, SCREEN_WIDTH - 47, y + 20);
  if (!state.mapOpen && !state.personOpen && !state.bagOpen && !state.busy) {
    state.hotspots.push({ id: 'person-open', x: 16, y, w: 168, h: 40 });
    state.hotspots.push({ id: 'bag-open', x: SCREEN_WIDTH - 78, y: y + 4, w: 62, h: 32 });
  }
  const chipY = y + 48;
  const chips = [
    ['硬币', life.coins],
    ['种子', life.seeds],
    ['文化', life.culture],
    ['邻里', life.neighbor],
  ];
  const chipW = (SCREEN_WIDTH - 32 - 18) / 4;
  chips.forEach((item, index) => {
    const cx = 16 + index * (chipW + 6);
    ctx.fillStyle = CARD;
    roundRect(cx, chipY, chipW, 32, 12);
    ctx.fill();
    ctx.fillStyle = '#8a726c';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item[0], cx + chipW / 2, chipY + 11);
    ctx.fillStyle = INK;
    ctx.font = '13px sans-serif';
    ctx.fillText(String(item[1] == null ? 0 : item[1]), cx + chipW / 2, chipY + 23);
  });
  if (life.hint) {
    ctx.fillStyle = ROSE;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(life.hint, 16, chipY + 46);
  }
  ctx.textAlign = 'left';

  if (card.type === 'page') {
    drawDay(state);
    if (state.bagOpen) drawBag(state);
    else if (state.personOpen) drawPerson(state);
    return;
  }

  const view = state.view;
  const lean = state.dragX / view.width;
  ctx.fillStyle = '#e7d9c8';
  roundRect(view.x + 10, view.y - 12, view.width - 20, view.height, 22);
  ctx.fill();
  ctx.save();
  ctx.translate(view.x + view.width / 2 + state.dragX, view.y + view.height / 2);
  ctx.rotate(state.dragX / 900);
  ctx.translate(-(view.width / 2), -(view.height / 2));
  ctx.fillStyle = CARD;
  roundRect(0, 0, view.width, view.height, 22);
  ctx.fill();
  ctx.fillStyle = ROSE;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${here.name}${here.npc ? ` · ${here.npc}` : ''}`, 18, 18);
  let lineY = 40;
  if (life.company && life.company.length) {
    ctx.fillStyle = '#8a726c';
    ctx.font = '12px sans-serif';
    ctx.fillText(`这里还有 ${life.company.join('、')}`, 18, 36);
    lineY = 54;
  }
  ctx.fillStyle = INK;
  const body = card.type === 'page' && card.lines && card.lines.length ? card.lines : [card.text];
  ctx.font = card.type === 'trace' ? '18px sans-serif' : (card.type === 'page' ? '14px sans-serif' : '16px sans-serif');
  const lineH = card.type === 'page' ? 20 : 24;
  const cap = card.type === 'page' ? 8 : 5;
  body.forEach((block) => {
    wrap(block, view.width - 36).forEach((line) => {
      if (lineY > 40 + lineH * (cap - 1)) return;
      ctx.fillText(line, 18, lineY);
      lineY += lineH;
    });
  });
  ctx.restore();

  const gap = 10;
  const buttonW = (view.width - gap) / 2;
  const buttonY = view.y + view.height + 14;
  choice(state, 'choice-left', card.left.label, view.x, buttonY, buttonW, 54, lean < -0.08);
  choice(state, 'choice-right', card.right.label, view.x + buttonW + gap, buttonY, buttonW, 54, lean > 0.08);
  const who = state.db ? state.db.get('select onboarded from player where id=1') : null;
  if (state.echo && state.real < state.echoUntil) {
    ctx.fillStyle = ROSE;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.echo, SCREEN_WIDTH / 2, buttonY + 72);
  } else if (card.type === 'trace' || (who && !who.onboarded)) {
    ctx.fillStyle = '#8a726c';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.type === 'trace' ? '这是刚才发生的，看完再滑开' : '按住卡片滑向一边', SCREEN_WIDTH / 2, buttonY + 72);
  }
  if (state.bagOpen) drawBag(state);
  else if (state.personOpen) drawPerson(state);
  else if (state.mapOpen) {
    const canGo = card.type !== 'page' && card.type !== 'letter' && card.type !== 'night' && !state.busy;
    drawMap(state, here, canGo);
  }
}
