import { ctx, SCREEN_WIDTH, SCREEN_HEIGHT, HUD_TOP, SAFE_BOTTOM } from './render.js';
import { PLACES, ROADS, placeById, clockText, opening, isOpen, residents, availableActions, bagActions, blocked, pathTo, travelCost, encounterChoice } from './world.js';
import { drawScene } from './scenes.js';

const C = { ink: '#263e39', muted: '#79877d', paper: '#f6f4eb', green: '#386b54', light: '#e5eddf', gold: '#c78a45', white: '#fffdf6' };
function box(x, y, w, h, color, radius = 12) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius); ctx.fill();
}
function text(value, x, y, size = 13, color = C.ink, align = 'left') {
  ctx.fillStyle = color; ctx.font = `${size}px sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(String(value), x, y);
}
function lines(value, x, y, width, max = 2, size = 12, color = C.muted) {
  ctx.font = `${size}px sans-serif`;
  let line = ''; let row = 0;
  const chars = Array.from(value);
  for (let i = 0; i < chars.length; i += 1) {
    if (ctx.measureText(line + chars[i]).width > width && line) {
      text(line, x, y + row * 18, size, color); row += 1; line = '';
      if (row >= max) return;
    }
    line += chars[i];
    if (row === max - 1 && i < chars.length - 1 && ctx.measureText(line + chars[i + 1] + '…').width > width) {
      text(`${line}…`, x, y + row * 18, size, color); return;
    }
  }
  if (line) text(line, x, y + row * 18, size, color);
}
function spot(state, id, x, y, w, h) { state.hotspots.push({ id, x, y, w, h }); }
function button(state, id, label, x, y, w, h, active = false) {
  box(x, y, w, h, active ? C.green : C.white, 10);
  text(label, x + w / 2, y + h / 2, 13, active ? C.white : C.ink, 'center');
  spot(state, id, x, y, w, h);
}
function point(id) {
  const p = placeById(id);
  return { x: 30 + p.mx * 330, y: 197 + p.my * 244 };
}
function dot(x, y, radius, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
}
function mapScene(state, now) {
  const world = state.world;
  const night = world.clock >= 19 * 60;
  const rain = world.weather === 'rainy';
  box(0, 155, 390, 279, night ? '#314b46' : rain ? '#b9cec5' : '#d9e6c7', 20);
  text('小巷街区', 18, 175, 12, night ? '#e8eee0' : C.green);
  text(`${rain ? '细雨' : world.weather === 'breezy' ? '微风' : '晴天'} · 点击建筑探索`, 372, 175, 11, night ? '#e8eee0' : C.green, 'right');
  const route = pathTo(world.place, state.selected);
  ROADS.forEach(([a, b]) => {
    const from = point(a); const to = point(b);
    ctx.strokeStyle = '#f3efda'; ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    if (route.some((id, index) => index && ((route[index - 1] === a && id === b) || (route[index - 1] === b && id === a)))) {
      ctx.strokeStyle = '#dba45b'; ctx.lineWidth = 3; ctx.stroke();
    }
  });
  [[22, 267], [370, 324], [30, 394], [270, 220], [124, 220]].forEach(([x, y]) => {
    box(x - 2, y, 4, 15, '#a28b66', 1); dot(x, y, 10, night ? '#3e6753' : '#8bb38b'); dot(x - 4, y - 4, 7, night ? '#49765d' : '#a0c397');
  });
  PLACES.forEach((place) => {
    const p = point(place.id); const selected = place.id === state.selected;
    if (selected) box(p.x - 32, p.y - 24, 64, 54, '#efd29b', 10);
    box(p.x - 23, p.y - 17, 46, 30, isOpen(world, place.id) ? '#fff8dc' : '#c4c9bc', 4);
    box(p.x - 27, p.y - 20, 54, 8, place.zone === 'home' ? '#b48062' : '#658778', 3);
    box(p.x - 15, p.y - 5, 9, 10, night && isOpen(world, place.id) ? '#f6ca74' : '#a9c1ba', 1);
    box(p.x + 6, p.y - 5, 9, 18, '#bba785', 1);
    text(place.name, p.x, p.y + 18, 11, night && !selected ? '#fff8dc' : C.ink, 'center');
    residents(world, place.id).forEach((person, index) => dot(p.x + 22 + index * 6, p.y - 15, 3, C.gold));
    spot(state, `place:${place.id}`, p.x - 32, p.y - 21, 64, 43);
  });
  const hero = point(world.place);
  dot(hero.x, hero.y + 4, 13, '#fffdf6');
  if (state.art) ctx.drawImage(state.art.hero, 0, 0, 16, 16, hero.x - 12, hero.y - 15, 24, 24);
  else dot(hero.x, hero.y, 7, C.green);
  if (rain) {
    ctx.strokeStyle = '#edf7f0'; ctx.globalAlpha = 0.4; ctx.lineWidth = 1;
    for (let i = 0; i < 20; i += 1) {
      const x = (i * 71 + now / 70) % 380; const y = 191 + (i * 43 + now / 30) % 220;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 8); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
function actionCards(state, list, y, now) {
  list.forEach((item, index) => {
    const x = (index % 2) * 199; const top = y + Math.floor(index / 2) * 72;
    const reason = blocked(state.world, item, now);
    box(x, top, 191, 64, reason ? '#ebece4' : C.white, 12);
    text(item.label, x + 12, top + 19, 14, reason ? C.muted : C.green);
    lines(reason || `${item.minutes ? `${item.minutes} 分钟 · ` : ''}${item.detail}`, x + 12, top + 40, 167, 2, 10, C.muted);
    spot(state, `action:${item.id}`, x, top, 191, 64);
  });
}
function district(state, now) {
  mapScene(state, now);
  const world = state.world; const place = placeById(state.selected);
  const here = world.place === place.id; const cost = travelCost(world, place.id);
  text(place.name, 4, 459, 21);
  text(here ? '你在这里' : `预计 ${cost.minutes} 分钟 · 体力 −${cost.effort}`, 386, 459, 12, C.green, 'right');
  const people = residents(world, place.id);
  text(`${opening(place.id)}${!isOpen(world, place.id) ? ' · 已打烊' : ''}${people.length ? ` · ${people.map((p) => p.name).join('、')}在这里` : ''}`, 4, 486, 12, C.muted);
  lines(here ? '收起地图，回到眼前的生活。' : `${place.blurb} ${cost.reason}。`, 4, 516, 370, 2, 13);
  button(state, here ? 'close-panel' : `travel:${place.id}`, here ? '回到场景' : `出发，去${place.name}`, 0, 570, 390, 46, true);
}
function bag(state, now) {
  text('随身背包', 4, 184, 23);
  text('买到的东西可以随时使用，不用等待事件。', 4, 216, 12, C.muted);
  const world = state.world;
  [['关东煮 / 便当', world.bag.snack], ['瓶装水', world.bag.water], ['新鲜食材', world.bag.groceries], ['鲜花', world.bag.flower], ['花种', world.seeds]].forEach(([label, count], index) => {
    const y = 245 + index * 45; box(0, y, 390, 38, C.white, 9); text(label, 14, y + 19); text(`× ${count}`, 374, y + 19, 14, C.green, 'right');
  });
  actionCards(state, bagActions(world), 498, now);
  lines('食材要带回家烹饪；花种可以种在公园，鲜花可以在菜市场出售。', 4, 603, 380, 2, 13);
}
function journal(state) {
  text('小巷手记', 4, 184, 23);
  text('不是任务清单，是你在这里生活过的痕迹。', 4, 216, 12, C.muted);
  state.world.journal.slice(-7).reverse().forEach((entry, index) => {
    const y = 244 + index * 57;
    text(`第 ${entry.day} 天`, 4, y + 8, 10, C.gold);
    lines(entry.text, 65, y + 8, 316, 2, 12, C.ink);
    box(0, y + 43, 390, 1, C.light, 0);
  });
}
function dialogueCard(state, now) {
  const dialogue = state.dialogue;
  if (!dialogue) {
    text('把脚步慢下来', 10, 493, 21);
    lines('点场景中的物件，或者和身边的人说句话。每一次出门，都可能遇见一点不同。', 10, 530, 368, 3, 14);
    button(state, 'look', '留意周围', 0, 602, 190, 40);
    button(state, 'actions', '我想做点什么', 200, 602, 190, 40, true);
    return;
  }
  const drag = state.dragX || 0;
  box(5, 475, 380, 125, drag < 0 ? '#e6d5c4' : '#d1e0c9', 17);
  text(drag < 0 ? dialogue.left : dialogue.right, drag < 0 ? 350 : 40, 527, 17, C.green, drag < 0 ? 'right' : 'left');
  ctx.save(); ctx.translate(195 + drag, 535); ctx.rotate(drag / 1500); ctx.translate(-195, -535);
  box(5, 475, 380, 125, C.white, 17);
  dot(30, 499, 11, '#e4ccb0');
  text(dialogue.speaker.slice(0, 1), 30, 499, 12, '#87684d', 'center');
  text(dialogue.speaker, 49, 499, 12, C.gold);
  text(dialogue.title, 368, 499, 12, C.green, 'right');
  const visible = state.revealed ? dialogue.text : dialogue.text.slice(0, Math.floor((now - state.dialogueAt) / 25));
  lines(visible, 20, 527, 350, 4, 13, C.ink);
  ctx.restore();
  spot(state, 'dialogue', 5, 475, 380, 125);
  button(state, 'choice:left', `‹ ${dialogue.left}`, 0, 605, 191, 39);
  button(state, 'choice:right', `${dialogue.right} ›`, 199, 605, 191, 39, true);
  if (dialogue.kind === 'event') {
    const choice = encounterChoice(state.world, drag < 0 ? -1 : 1);
    if (choice) text(choice.reason || `预计 ${choice.minutes} 分钟 · 左右滑动回应`, 195, 655, 10, choice.reason ? '#a36c59' : C.muted, 'center');
  } else text('点文字立即读完 · 左右滑动选择，也可以点按钮', 195, 655, 10, C.muted, 'center');
}
export function render(state, now = Date.now()) {
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  const scale = Math.min((SCREEN_WIDTH - 24) / 390, (SCREEN_HEIGHT - HUD_TOP - SAFE_BOTTOM - 8) / 710);
  state.layout = { scale, x: (SCREEN_WIDTH - 390 * scale) / 2, y: HUD_TOP };
  state.hotspots = [];
  ctx.save(); ctx.translate(state.layout.x, state.layout.y); ctx.scale(scale, scale);
  const world = state.world;
  text(placeById(state.viewPlace).name, 0, 14, 24);
  text(`第 ${world.day} 天 · ${clockText(world.clock)}`, 390, 14, 14, C.green, 'right');
  text(`${world.name} · 点击改名`, 0, 39, 11, C.muted); spot(state, 'name', 0, 25, 195, 23);
  text(`${world.coins} 硬币`, 390, 39, 13, C.gold, 'right');
  [['体力', world.stamina, C.green], ['饥饿', world.hunger, C.gold], ['口渴', world.thirst, '#698fa0']].forEach(([label, value, color], i) => {
    const x = i * 133; box(x, 57, 124, 39, C.white, 10);
    text(label, x + 10, 70, 11, C.muted); text(Math.round(value), x + 112, 70, 12, color, 'right');
    box(x + 10, 83, 104, 4, C.light, 2); if (value > 0) box(x + 10, 83, Math.max(4, value * 1.04), 4, color, 2);
  });
  const motion = { hero: state.hero, freezePeople: !!state.dialogue || !!state.approach };
  let fade = 0;
  if (state.transition) {
    const t = Math.max(0, Math.min(1, (now - state.transition.start) / state.transition.duration));
    if (t < 0.5) motion.exit = Math.min(1, t / 0.35);
    else motion.enter = Math.min(1, (t - 0.5) / 0.5);
    fade = t < 0.5 ? Math.max(0, (t - 0.25) * 4) : Math.max(0, 1 - (t - 0.5) * 4);
  }
  state.hotspots.push(...drawScene(ctx, Object.assign({}, world, { place: state.viewPlace }), now, motion));
  dialogueCard(state, now);
  [['地图', 'map'], ['背包', 'bag'], ['手记', 'journal'], ['行动', 'actions']].forEach(([label, id], i) => button(state, id, label, i * 100, 666, 90, 44));
  if (state.panel) {
    state.hotspots = [];
    box(0, 105, 390, 555, C.paper, 16);
    if (state.panel === 'map') district(state, now);
    if (state.panel === 'bag') bag(state, now);
    if (state.panel === 'journal') journal(state);
    if (state.panel === 'actions') actionCards(state, availableActions(world, now), 165, now);
    text({ map: '展开街区地图', bag: '随身物品', journal: '生活片段', actions: '在这里，你可以…' }[state.panel], 12, 130, 17);
    button(state, 'close-panel', '收起', 323, 111, 60, 34);
  }
  if (state.dialogue && !state.panel) {
    state.hotspots = state.hotspots.filter((s) => s.id === 'dialogue' || s.id.startsWith('choice:'));
  }
  if (state.notice && now < state.noticeUntil && !state.panel) {
    box(8, 431, 374, 30, '#fff7e8', 8);
    lines(state.notice, 18, 446, 353, 1, 11, C.green);
  }
  if (state.transition) {
    state.hotspots = [];
    ctx.save(); ctx.globalAlpha = fade; box(0, 105, 390, 555, '#334339', 0); ctx.restore();
    if (fade > 0.4) text(`正在走进${placeById(world.place).name}…`, 195, 330, 19, '#fff4d8', 'center');
  }
  ctx.restore();
}
