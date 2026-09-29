import { PLACES, ROADS } from './content.js';
import { ENCOUNTERS } from './encounters.js';

export { PLACES, ROADS };
export const SAVE_KEY = 'little-lane-world-v1';
const limit = (value) => Math.max(0, Math.min(100, value));
export const clockText = (minutes) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
export const placeById = (id) => PLACES.find((place) => place.id === id) || PLACES[12];
const HOURS = { room: [6, 24], market: [7, 18], super: [8, 22], cafe: [8, 20], bookshop: [9, 20], office: [9, 18] };
export function opening(id) {
  const hours = HOURS[id];
  return hours ? `${hours[0]}:00–${hours[1]}:00` : '全天开放';
}
export function isOpen(world, id, minutes = 0) {
  const hours = HOURS[id];
  return !hours || (world.clock >= hours[0] * 60 && world.clock < hours[1] * 60 && world.clock + minutes <= hours[1] * 60);
}
export function pathTo(from, to) {
  const queue = [[from]];
  const visited = new Set([from]);
  while (queue.length) {
    const path = queue.shift();
    const end = path[path.length - 1];
    if (end === to) return path;
    ROADS.forEach(([a, b]) => {
      const next = a === end ? b : b === end ? a : null;
      if (next && !visited.has(next)) { visited.add(next); queue.push(path.concat(next)); }
    });
  }
  return [];
}
export function createWorld(legacy) {
  const tables = legacy && legacy.tables || {};
  const player = (tables.player || [])[0] || {};
  const body = (tables.body || [])[0] || {};
  const bag = { snack: 0, water: 0, groceries: 0, flower: 0 };
  (tables.inventory || []).forEach((item) => {
    const key = item.item_id === 'milk' ? 'water' : item.item_id;
    if (Object.prototype.hasOwnProperty.call(bag, key)) bag[key] += Math.max(0, item.qty || 0);
  });
  return {
    version: 1, name: body.name || '小巷新住民', day: player.day || 1,
    clock: player.clock == null ? 420 : Math.min(1380, player.clock),
    place: placeById(player.place || 'bed').id, coins: Math.max(0, player.coins == null ? 12 : player.coins),
    seeds: Math.max(0, player.seeds == null ? 2 : player.seeds),
    hunger: limit(body.hunger == null ? 25 : body.hunger), thirst: limit(body.thirst == null ? 20 : body.thirst),
    stamina: limit(body.stamina == null ? 90 : body.stamina), bag,
    weather: player.weather || 'sunny', relationships: {}, worked: 0,
    garden: player.garden_at ? { readyAt: Date.now() + Math.max(0, 10800000 - (Date.now() - player.garden_at)) } : null,
    journal: [{ day: player.day || 1, text: '搬进小巷。先买点早餐，再去单位看看吧。' }],
  };
}
export function residents(world, place) {
  const hour = world.clock / 60;
  const people = [];
  const auntPlace = hour < 9 ? 'market' : hour < 12 ? 'door' : hour < 17 ? 'balcony' : 'door';
  const friendPlace = hour < 9 ? 'bed' : hour < 18 ? 'office' : hour < 20 ? 'square' : 'bed';
  if (place === auntPlace && hour < 22) people.push({ id: 'auntie', name: '林阿姨' });
  if (place === friendPlace) people.push({ id: 'wenbao', name: '雯宝' });
  if (place === 'cafe' && isOpen(world, place)) people.push({ id: 'barista', name: '店主' });
  return people;
}
export function actionCost(world, id, baseMinutes) {
  const fatigue = (100 - world.stamina) / 200;
  const needs = (world.hunger > 60 ? 0.15 : 0) + (world.thirst > 60 ? 0.15 : 0);
  const skill = Math.min(0.2, ((world.skills || {})[id] || 0) * 0.02);
  let factor = 1 + fatigue + needs - skill;
  if (id === 'rest') factor = 0.8 + fatigue;
  if (id === 'wait' || id === 'sleep') factor = 1;
  if (id === 'travel' && world.weather === 'rainy') factor += 0.15;
  const minutes = baseMinutes ? Math.max(1, Math.ceil(baseMinutes * factor)) : 0;
  const effort = id === 'work' ? Math.ceil(25 * (1 + needs - skill)) : id === 'travel' ? Math.ceil(baseMinutes / 5 * (1 + fatigue + needs)) : 0;
  const reason = id === 'rest' ? '按疲劳程度恢复' : skill ? '熟练度与身体状态' : needs ? '饥渴让动作慢下来' : fatigue > 0.15 ? '疲劳让动作慢下来' : id === 'travel' && world.weather === 'rainy' ? '雨天路滑，走慢一点' : '按当前体力估算';
  return { minutes, effort, reason };
}
const action = (id, label, minutes, detail) => ({ id, label, minutes, detail });
function timedAction(world, item) {
  const cost = actionCost(world, item.id, item.minutes);
  return Object.assign({}, item, cost, { baseMinutes: item.minutes, detail: item.id === 'work' ? `硬币 +12 · 体力 −${cost.effort}` : item.detail });
}
export function actionsAt(world, now = Date.now()) {
  const options = {
    bed: [world.bag.groceries ? action('cook', '做一顿饭', 30, '食材 −1 · 饥饿 −60') : action('community-meal', '邻里互助餐', 20, '免费 · 每天一份 · 饥饿 −60'), action('tap-water', '喝杯水', 5, '免费 · 口渴 −45'), action('rest', '沙发小憩', 30, '体力 +30'), action('sleep', '睡到明早', 0, '新的一天 · 恢复体力')],
    room: [action('buy-snack', '买关东煮', 5, '3 硬币 · 放入背包'), action('buy-water', '买瓶装水', 5, '1 硬币 · 放入背包')],
    market: [action('buy-groceries', '买新鲜食材', 10, '4 硬币 · 回家做饭'), action('buy-seed', '买花种', 5, '2 硬币'), action('sell-flower', '出售鲜花', 5, '鲜花 −1 · 硬币 +6')],
    super: [action('buy-groceries', '买新鲜食材', 10, '4 硬币 · 回家做饭'), action('buy-snack', '买便当', 5, '3 硬币 · 放入背包')],
    office: [action('work', '完成一班工作', 120, '硬币 +12 · 体力 −25'), action('wait', '休息半小时', 30, '等开工，也喘口气')],
    cafe: [action('coffee', '坐下来喝杯咖啡', 20, '3 硬币 · 口渴 −35 · 体力 +12')],
    bookshop: [action('read', '读一会儿书', 30, '免费 · 体力 +8')],
    balcony: [world.garden ? action('harvest', '收获鲜花', 5, now >= world.garden.readyAt ? '已开花 · 可去菜市场出售' : '还在生长，3 小时内开花') : action('plant', '种下一颗花种', 10, '种子 −1 · 离线也会生长'), action('rest', '在树荫下休息', 30, '体力 +30')],
  };
  const list = (options[world.place] || [action('rest', '坐下来歇一会儿', 30, '体力 +30')]).slice();
  const people = residents(world, world.place);
  if (people.length && list.length < 4) list.push(action(`talk:${people[0].id}`, `和${people[0].name}聊聊`, 10, '每天一次深入交流 · 留下共同记忆'));
  return list.map((item) => timedAction(world, item));
}
export const BAG_ACTIONS = [action('eat', '吃一份食物', 10, '食物 −1 · 饥饿 −45'), action('drink', '喝一瓶水', 5, '瓶装水 −1 · 口渴 −45')];
export function bagActions(world) { return BAG_ACTIONS.map((item) => timedAction(world, item)); }
export function availableActions(world, now = Date.now()) {
  const list = actionsAt(world, now).concat(bagActions(world));
  residents(world, world.place).forEach((person) => {
    if (!list.some((item) => item.id === `talk:${person.id}`)) list.push(timedAction(world, action(`talk:${person.id}`, `和${person.name}聊聊`, 10, '每天一次深入交流')));
  });
  list.push(timedAction(world, action('observe', '四处看看', 5, '留意身边的人和事')));
  return list;
}
export function travelCost(world, target) {
  const path = pathTo(world.place, target);
  return Object.assign({ path }, actionCost(world, 'travel', Math.max(0, path.length - 1) * 10));
}
export function blocked(world, item, now = Date.now()) {
  const id = item.id;
  if (!isOpen(world, world.place, item.minutes) && !['wait', 'eat', 'drink', 'observe'].includes(id)) return `营业时间 ${opening(world.place)}`;
  const price = { 'buy-snack': 3, 'buy-water': 1, 'buy-groceries': 4, 'buy-seed': 2, coffee: 3 }[id];
  if (price && world.coins < price) return `还差 ${price - world.coins} 硬币`;
  if (id === 'community-meal' && world.mealDay === world.day) return '今天已经领过了，明天还有一份';
  if (id === 'cook' && !world.bag.groceries) return '需要食材，去菜市场或超市购买';
  if (id === 'eat' && !world.bag.snack) return '背包里没有食物';
  if (id === 'drink' && !world.bag.water) return '背包里没有瓶装水，家里可免费喝水';
  if (id === 'sell-flower' && !world.bag.flower) return '还没有鲜花，去公园种一朵吧';
  if (id === 'plant' && world.seeds < 1) return '需要花种，菜市场有售';
  if (id === 'harvest' && now < world.garden.readyAt) return `约 ${Math.ceil((world.garden.readyAt - now) / 60000)} 分钟后开花`;
  if (id === 'work') {
    if (world.worked >= 2) return '今天已完成两班，明天再来吧';
    if (world.stamina < 30) return '体力不足 30，先休息';
    if (world.hunger > 75 || world.thirst > 75) return '先吃喝补充一下，再开始工作';
  }
  if (id.startsWith('talk:') && (world.relationships[id.slice(5)] || {}).day === world.day) return '今天已经聊过了，明天再来';
  if (id === 'sleep' && world.clock < 18 * 60) return '18:00 后可以入睡，现在可以小憩';
  if (id !== 'sleep' && world.clock + item.minutes > 24 * 60) return '夜深了，回家睡一觉吧';
  return '';
}
function passTime(world, minutes, effort = 0) {
  world.clock += minutes;
  world.hunger = limit(world.hunger + minutes * 0.1);
  world.thirst = limit(world.thirst + minutes * 0.13);
  world.stamina = limit(world.stamina - effort);
}
function remember(world, text) {
  world.journal.push({ day: world.day, text: `${clockText(world.clock)} ${text}` });
  world.journal = world.journal.slice(-40);
}
export function travel(world, target) {
  if (world.pendingEncounter) return { ok: false, say: '先回应眼前的这件事吧。' };
  if (!PLACES.some((place) => place.id === target)) return { ok: false, say: '这个地方还不存在。' };
  const path = pathTo(world.place, target);
  if (path.length < 2) return { ok: false, say: '已经在这里了。' };
  const { minutes, effort } = travelCost(world, target);
  if (world.clock + minutes > 1440 && target !== 'bed') return { ok: false, say: '夜深了，先回家休息吧。' };
  passTime(world, minutes, effort);
  world.clock = Math.min(world.clock, 1440);
  world.place = target;
  const say = `步行 ${minutes} 分钟，到了${placeById(target).name}。`;
  remember(world, say);
  return { ok: true, say, path };
}
export function perform(world, id, now = Date.now()) {
  if (world.pendingEncounter) return { ok: false, say: '先回应眼前的这件事吧。' };
  const item = availableActions(world, now).find((entry) => entry.id === id);
  if (!item) return { ok: false, say: '这里不能进行这个行动。' };
  const reason = blocked(world, item, now);
  if (reason) return { ok: false, say: reason };
  passTime(world, item.minutes);
  let say = '';
  const purchases = { 'buy-snack': ['snack', 3, '热腾腾的食物'], 'buy-water': ['water', 1, '瓶装水'], 'buy-groceries': ['groceries', 4, '新鲜食材'] };
  if (purchases[id]) {
    const [key, price, label] = purchases[id];
    world.coins -= price; world.bag[key] += 1; say = `${label}放进了背包。`;
  } else if (id === 'buy-seed') { world.coins -= 2; world.seeds += 1; say = '收到一包花种，去公园种下吧。';
  } else if (id === 'community-meal') {
    world.mealDay = world.day; world.hunger = limit(world.hunger - 60);
    say = '邻里互助站送来一份热饭。每天一份，困难时也有人照应。';
  } else if (id === 'cook' || id === 'eat') {
    world.bag[id === 'cook' ? 'groceries' : 'snack'] -= 1;
    world.hunger = limit(world.hunger - (id === 'cook' ? 60 : 45)); say = id === 'cook' ? '厨房飘出饭香，认真吃了一顿饭。' : '吃完了，肚子暖暖的。';
  } else if (id === 'drink' || id === 'tap-water') {
    if (id === 'drink') world.bag.water -= 1;
    world.thirst = limit(world.thirst - 45); say = '喝过水，整个人清爽了一些。';
  } else if (id === 'work') {
    world.coins += 12; world.stamina = limit(world.stamina - item.effort); world.worked += 1;
    say = `花了 ${item.minutes} 分钟完成工作，领到了 12 枚硬币。`;
  } else if (id === 'sleep') {
    remember(world, '关灯睡觉。小巷也渐渐安静下来。');
    world.day += 1; world.clock = 420; world.stamina = 100; world.worked = 0;
    world.hunger = limit(world.hunger + 15); world.thirst = limit(world.thirst + 20);
    world.weather = ['sunny', 'breezy', 'rainy'][(world.day - 1) % 3];
    say = '早上好。新的一天，先照顾好自己。';
  } else if (id === 'plant') {
    world.seeds -= 1; world.garden = { readyAt: now + 10800000 }; say = '种子埋进土里。即使离开游戏，它也会长大。';
  } else if (id === 'harvest') {
    world.garden = null; world.bag.flower += 1; say = '收下了一朵花，去菜市场能卖 6 枚硬币。';
  } else if (id === 'sell-flower') {
    world.bag.flower -= 1; world.coins += 6; say = '摊主收下鲜花，递给你 6 枚硬币。';
  } else if (id.startsWith('talk:')) {
    const key = id.slice(5); const previous = world.relationships[key] || { level: 0 };
    world.relationships[key] = { day: world.day, level: previous.level + 1 };
    say = previous.level ? '对方还记得上次的聊天，笑着问起你的近况。' : '交换了名字，小巷里多了一个熟悉的人。';
  } else if (id === 'observe') {
    say = '你放慢脚步，留意了一会儿身边的动静。';
  } else {
    world.stamina = limit(world.stamina + (id === 'read' ? 8 : id === 'coffee' ? 12 : 30));
    if (id === 'coffee') { world.coins -= 3; world.thirst = limit(world.thirst - 35); }
    say = id === 'read' ? '读到一段喜欢的文字，心也慢了下来。' : id === 'coffee' ? '窗边的咖啡很香，街上的人慢慢走过。' : '歇了一会儿，又有力气继续今天了。';
  }
  if (id === 'work' || id === 'cook') {
    if (!world.skills) world.skills = {};
    world.skills[id] = Math.min(10, (world.skills[id] || 0) + 1);
  }
  remember(world, say);
  return { ok: true, say, minutes: item.minutes };
}

export function eligibleEncounters(world) {
  return ENCOUNTERS.filter((event) => event.places.includes(world.place)
    && (!event.requires || ((world.memories || {})[event.requires] && world.memories[event.requires] < world.day))
    && (!event.once || !(world.memories || {})[event.once])
    && (!event.weather || event.weather === world.weather)
    && (!event.before || world.clock < event.before)
    && (!event.after || world.clock >= event.after)
    && (!event.shop || isOpen(world, world.place))
    && (!event.npc || residents(world, world.place).some((person) => person.id === event.npc))
    && (!event.relation || ((world.relationships[event.relation] || {}).level || 0) >= 1)
    && (world.encounterSeen || {})[event.id] !== world.day);
}
export function rollEncounter(world, random = Math.random) {
  if (world.pendingEncounter) return world.pendingEncounter;
  const total = world.day * 1440 + world.clock;
  if (world.clock >= 1380 || total - (world.encounterCheckedAt || 0) < 25) return null;
  const seen = world.encounterSeen || {};
  if (Object.values(seen).filter((day) => day === world.day).length >= 3) return null;
  world.encounterCheckedAt = total;
  const pool = eligibleEncounters(world);
  if (!pool.length || random() >= 0.48) return null;
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  const event = pool[index];
  world.pendingEncounter = { id: event.id, place: world.place, day: world.day };
  world.encounterSeen = Object.assign({}, seen, { [event.id]: world.day });
  return world.pendingEncounter;
}
export function currentEncounter(world) {
  return world.pendingEncounter ? ENCOUNTERS.find((event) => event.id === world.pendingEncounter.id) || null : null;
}
export function encounterChoice(world, direction) {
  const event = currentEncounter(world);
  if (!event) return null;
  const choice = direction < 0 ? event.left : event.right;
  const cost = actionCost(world, 'encounter', choice.minutes);
  let reason = '';
  if (choice.item && !world.bag[choice.item]) reason = '背包里没有可分享的食物';
  if (world.clock + cost.minutes > 1440) reason = '夜深了，选择告别后回家吧';
  return Object.assign({}, choice, cost, { reason });
}
export function resolveEncounter(world, direction) {
  if (direction !== -1 && direction !== 1) return { ok: false, say: '请选择一个回应。' };
  const event = currentEncounter(world);
  if (!event) return { ok: false, say: '眼前没有待回应的事件。' };
  const choice = encounterChoice(world, direction);
  if (choice.reason) return { ok: false, say: choice.reason };
  passTime(world, choice.minutes, direction > 0 ? event.right.effort || 0 : event.left.effort || 0);
  if (choice.item) world.bag[choice.item] -= 1;
  world.seeds += choice.seeds || 0;
  world.stamina = limit(world.stamina + (choice.stamina || 0));
  world.hunger = limit(world.hunger + (choice.hunger || 0));
  world.thirst = limit(world.thirst + (choice.thirst || 0));
  if (choice.relation) {
    const previous = world.relationships[choice.relation] || { level: 0 };
    world.relationships[choice.relation] = Object.assign({}, previous, { level: previous.level + 1 });
  }
  if (choice.memory && !(world.memories || {})[choice.memory]) world.memories = Object.assign({}, world.memories, { [choice.memory]: world.day });
  world.pendingEncounter = null;
  remember(world, choice.say);
  return { ok: true, say: choice.say, minutes: choice.minutes };
}
