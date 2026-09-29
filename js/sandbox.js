export const TILE = 40;
export const COLS = 24;
export const ROWS = 20;
export const SAVE_KEY = 'little-lane-sandbox-v1';
export const CATALOG = {
  bench: { name: '长椅' }, flower: { name: '花盆' }, food: { name: '食物' }, shelter: { name: '遮雨棚' }
};

// Rectangles use inclusive grid cells; each south wall has a central doorway.
export const BUILDINGS = [
  { name: '小巷的家', x: 2, y: 2, w: 7, h: 6 },
  { name: '街角商店', x: 14, y: 2, w: 8, h: 6 },
  { name: '花园小屋', x: 15, y: 13, w: 7, h: 6 }
];
const directions = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
const finiteCell = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < COLS && y < ROWS;
const position = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0 && p.x <= COLS - 1 && p.y <= ROWS - 1;
const same = (a, b) => a.x === b.x && a.y === b.y;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cell = p => ({ x: Math.round(p.x), y: Math.round(p.y) });
const copy = value => JSON.parse(JSON.stringify(value));
const result = (ok, say) => ({ ok, say });
const nextId = world => `s${world.nextId++}`;
const knownType = type => Object.prototype.hasOwnProperty.call(CATALOG, type);
// 阿禾的家门口（巷口）：留一点食物，小白会在次日回来。
const CAT_HOME = { x: 5, y: 8 };
const arc = world => world.arc || (world.arc = { cat: 'missing' });
function log(world, text) {
  world.journal.push({ day: world.day, text });
  if (world.journal.length > 50) world.journal.splice(0, world.journal.length - 50);
}

export function isWall(x, y) {
  if (!finiteCell(x, y)) return true;
  return BUILDINGS.some(b => {
    const right = b.x + b.w - 1, bottom = b.y + b.h - 1;
    if (x < b.x || x > right || y < b.y || y > bottom) return false;
    if (y === bottom && x === b.x + Math.floor(b.w / 2)) return false;
    return x === b.x || x === right || y === b.y || y === bottom;
  });
}
function blocked(world, p) {
  return isWall(p.x, p.y) || world.objects.some(o => same(o, p));
}

// Only walkable cells count; a post covers its four immediate neighbours, never a wall.
export function isSheltered(world, point) {
  if (!position(point)) return false;
  const p = cell(point);
  if (blocked(world, p)) return false;
  return BUILDINGS.some(b => p.x > b.x && p.x < b.x + b.w - 1 && p.y > b.y && p.y < b.y + b.h - 1) ||
    world.objects.some(o => o.type === 'shelter' && Math.abs(o.x - p.x) + Math.abs(o.y - p.y) === 1);
}
function resetPlan(r) {
  r.path = []; r._plan = null; r._until = 0; r.activity = '散步'; r.say = '看看接下来去哪里。';
}
function replan(world) { world.residents.forEach(resetPlan); }

export function createSandbox(name = '小巷居民') {
  return {
    version: 1, name: typeof name === 'string' && name.trim() ? name.trim() : '小巷居民',
    day: 1, clock: 480, weather: 'sunny', paused: false,
    hero: { x: 6, y: 10, path: [] },
    residents: [
      { id: 'resident-a', name: '阿禾', x: 10, y: 10, path: [], hunger: 48, energy: 70, mood: 65, activity: '散步', say: '今天也在巷子里走走。' },
      { id: 'resident-b', name: '林姨', x: 12, y: 12, path: [], hunger: 24, energy: 42, mood: 70, activity: '散步', say: '找个地方坐一会儿。' },
      { id: 'resident-c', name: '小满', x: 4, y: 14, path: [], hunger: 30, energy: 85, mood: 55, activity: '散步', say: '想看看新开的花。' }
    ],
    objects: [
      { id: 's1', type: 'food', x: 18, y: 5, stock: 6 },
      { id: 's2', type: 'bench', x: 10, y: 14, stock: 0 },
      { id: 's3', type: 'flower', x: 7, y: 14, stock: 0 },
      { id: 's4', type: 'bench', x: 4, y: 4, stock: 0 },
      { id: 's5', type: 'flower', x: 7, y: 3, stock: 0 }
    ],
    notes: [], journal: [{ day: 1, text: '搬进小巷，生活从这里慢慢开始。' }], nextId: 6, elapsed: 0, arc: { cat: 'missing' }
  };
}

export function findPath(world, from, to) {
  if (!position(from) || !to || !finiteCell(to.x, to.y)) return [];
  // A mid-step actor keeps heading for its current cell instead of rounding back onto the one it is leaving.
  const midStep = Array.isArray(from.path) && from.path.length && (from.x % 1 !== 0 || from.y % 1 !== 0);
  const start = midStep ? from.path[0] : cell(from);
  if (blocked(world, start) || blocked(world, to)) return [];
  const key = p => p.y * COLS + p.x;
  const queue = [start], parents = new Map([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (same(p, to)) {
      const path = [];
      let node = p;
      while (parents.get(key(node)) !== null) {
        path.push({ x: node.x, y: node.y });
        node = parents.get(key(node));
      }
      path.reverse();
      // Finish the current grid segment before changing direction.
      if (!same(from, start)) path.unshift(start);
      return path;
    }
    for (const d of directions) {
      const n = { x: p.x + d.x, y: p.y + d.y };
      if (!blocked(world, n) && !parents.has(key(n))) {
        parents.set(key(n), p);
        queue.push(n);
      }
    }
  }
  return [];
}

export function commandMove(world, x, y) {
  if (!finiteCell(x, y) || blocked(world, { x, y })) return result(false, '那里不能通行。');
  const path = findPath(world, world.hero, { x, y });
  if (!path.length && !same(world.hero, { x, y })) return result(false, '暂时找不到过去的路。');
  world.hero.path = path;
  return result(true, path.length ? '往那里走走。' : '已经到了。');
}

function adjacent(a, b) {
  return distance(a, b) <= 1.05;
}
export function interact(world, id) {
  const target = world.objects.find(o => o.id === id) || world.residents.find(r => r.id === id);
  if (!target) return result(false, '它已经不在这里了。');
  if (!adjacent(world.hero, target)) return result(false, '走近一点再互动吧。');
  let say;
  if (target.type === 'food') {
    if (target.stock <= 0) return result(false, '食物已经吃完了，空盘还留在这里。');
    target.stock--;
    say = '尝了一口食物，巷子里多了一点烟火气。';
  } else if (target.type === 'bench') say = '坐在长椅上歇了歇，慢慢看看小巷。';
  else if (target.type === 'flower') say = '靠近花盆，闻到了淡淡的花香。';
  else if (target.type === 'shelter') say = '棚柱旁的四格可以遮阳避雨，柱子本身不能通行。';
  else if (target.type === 'cat') say = '小白蹭了蹭你的裤脚，喉咙里咕噜咕噜响。';
  else {
    const first = target.lastGreetingDay !== world.day;
    const memory = target.sharedRainDay;
    const shared = world.weather === 'rainy' && isSheltered(world, world.hero) && isSheltered(world, target);
    if (first) {
      target.relationship = (target.relationship || 0) + 1;
      target.mood = Math.min(100, target.mood + 5);
    }
    target.say = shared ? (memory === world.day ? '还在一起听雨呢。' : '今天一起避雨，记住这会儿了。') :
      first ? (memory ? `还记得第${memory}天一起避雨。今天又见面了。` : '今天头一回见，来打个招呼吧。') :
        memory ? `又见面了，还记得第${memory}天一起避雨。` : '又见面了，慢慢逛。';
    if (target.id === 'resident-a' && !shared) {
      target.say += arc(world).cat === 'home'
        ? (first ? '小白回家了，多亏巷口有人留了吃的。' : '小白回家了，这会儿正趴在我脚边呢。')
        : (first ? '我的猫小白跑丢了，还在巷口找它。你要是在巷口留点吃的，它兴许会回来。' : '小白还没回来，我在巷口找它……');
    }
    if (shared) target.sharedRainDay = world.day;
    target.lastGreetingDay = world.day;
    say = `${target.name}：${target.say}`;
  }
  log(world, say);
  return result(true, say);
}

function personAt(world, p) {
  return [world.hero, ...world.residents].some(r => same(cell(r), p) || distance(r, p) < 0.75);
}
function freeSpot(world, near, maxR) {
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) + Math.abs(dy) !== r) continue;
      const p = { x: near.x + dx, y: near.y + dy };
      if (!finiteCell(p.x, p.y) || blocked(world, p) || personAt(world, p)) continue;
      if (BUILDINGS.some(b => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h)) continue;
      return p;
    }
  }
  return null;
}
function advanceArc(world) {
  const a = arc(world);
  if (a.cat !== 'missing' || world.objects.length >= 60) return;
  const lured = world.objects.some(o => o.type === 'food' && o.stock > 0 &&
    Math.abs(o.x - CAT_HOME.x) + Math.abs(o.y - CAT_HOME.y) <= 3);
  if (!lured) return;
  const spot = freeSpot(world, CAT_HOME, 3);
  if (!spot) return;
  world.objects.push({ id: nextId(world), type: 'cat', x: spot.x, y: spot.y, stock: 0 });
  a.cat = 'home';
  const owner = world.residents.find(r => r.id === 'resident-a');
  if (owner) { owner.mood = Math.min(100, owner.mood + 8); owner.relationship = (owner.relationship || 0) + 2; }
  log(world, '小白回家了，蹲在巷口。');
}
function validObjects(world, objects) {
  const ids = new Set(), cells = new Set();
  return objects.length <= 60 && objects.every(o => {
    if (!o || typeof o !== 'object') return false;
    const k = `${o.x},${o.y}`;
    if (typeof o.id !== 'string' || ids.has(o.id) || !(knownType(o.type) || o.type === 'cat') ||
        isWall(o.x, o.y) || cells.has(k) || personAt(world, o) ||
        !Number.isInteger(o.stock) || o.stock < 0) return false;
    ids.add(o.id); cells.add(k);
    return true;
  });
}
export function editObject(world, edit) {
  if (!edit || typeof edit !== 'object') return result(false, '无效的编辑。');
  const { type, x, y, id, remove } = edit;
  const index = id == null ? -1 : world.objects.findIndex(o => o.id === id);
  if (id != null && index < 0) return result(false, '找不到这件物品。');
  if (remove && index < 0) return result(false, '请先选择物品。');
  const before = copy(world.objects), after = copy(before);
  if (remove) after.splice(index, 1);
  else {
    const actualType = type === undefined && index >= 0 ? after[index].type : type;
    if (!knownType(actualType) || !finiteCell(x, y)) return result(false, '物品或位置无效。');
    if (index >= 0 && actualType !== after[index].type) return result(false, '移动不能改变物品种类。');
    const object = index >= 0 ? { ...after[index], x, y } : {
      id: `s${world.nextId}`, type: actualType, x, y, stock: actualType === 'food' ? 4 : 0
    };
    if (index >= 0) after[index] = object;
    else after.push(object);
  }
  if (!validObjects(world, after)) return result(false, '这里有墙、物品或人物，或物品已达60件。');
  world.objects = after;
  replan(world);
  if (!remove && index < 0) world.nextId++;
  log(world, remove ? '收起了一件物品。' : '重新布置了小巷。');
  return { ok: true, say: '布置完成。', undo: { before, after: copy(after) } };
}
export function undoEdit(world, undo) {
  if (!undo || !Array.isArray(undo.before) || !Array.isArray(undo.after) ||
      JSON.stringify(world.objects) !== JSON.stringify(undo.after) || !validObjects(world, undo.before)) {
    return result(false, '现在无法撤销：物品已改变或原位置被占用。');
  }
  world.objects = copy(undo.before);
  replan(world);
  log(world, '撤销了上一次布置。');
  return result(true, '已撤销。');
}

export function addNote(world, text, residentId = null, x = Math.round(world.hero.x), y = Math.round(world.hero.y)) {
  if (typeof text !== 'string' || !text.trim() || Array.from(text.trim()).length > 80) return result(false, '请写下1至80字的小事。');
  if (world.notes.length >= 40) return result(false, '生活记录已达40条。');
  if (!finiteCell(x, y) || isWall(x, y)) return result(false, '记录需要放在街区的可通行位置。');
  if (residentId !== null && !world.residents.some(r => r.id === residentId)) return result(false, '找不到指定居民。');
  world.notes.push({ id: nextId(world), text: text.trim(), residentId, x, y, status: residentId === null ? 'private' : 'pending' });
  log(world, residentId === null ? '收好了一条私密生活记录。' : '在巷子里留下了一件待发生的小事。');
  return result(true, residentId === null ? '仅保存在你的手记里。' : '等那位居民走近时，这件小事就会发生。');
}

function routeNear(world, actor, target, radius = 1) {
  let best = null;
  for (let y = Math.max(0, target.y - radius); y <= Math.min(ROWS - 1, target.y + radius); y++) {
    for (let x = Math.max(0, target.x - radius); x <= Math.min(COLS - 1, target.x + radius); x++) {
      const p = { x, y };
      if (distance(p, target) > radius || blocked(world, p)) continue;
      if (world.residents.some(other => other !== actor && (distance(other, p) < .8 || (other.path.length && same(other.path[other.path.length - 1], p))))) continue;
      const path = findPath(world, actor, p);
      if (world.weather === 'rainy' && (!isSheltered(world, p) || path.some(n => !isSheltered(world, n)))) continue;
      if ((path.length || same(actor, p)) && (!best || path.length < best.length)) best = path;
    }
  }
  return best;
}
function seekShelter(world, r) {
  let best = null;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const p = { x, y };
    if (!isSheltered(world, p) || world.residents.some(other => other !== r &&
        (distance(other, p) < .8 || (other.path.length && same(other.path[other.path.length - 1], p))))) continue;
    if (best && distance(r, p) >= best.path.length) continue;
    const path = findPath(world, r, p);
    if ((path.length || same(r, p)) && (!best || path.length < best.path.length)) best = { p, path };
  }
  if (best) {
    r.path = best.path; r._plan = { kind: 'shelter', ...best.p }; r.activity = '寻找遮雨处';
  } else {
    r.activity = '等一条避雨的路'; r.say = '暂时过不去，等等再找。'; r._until = world.elapsed + 6;
  }
}
function choose(world, r) {
  if (world.weather === 'rainy' && !isSheltered(world, r)) { seekShelter(world, r); return; }
  const pleasant = ['flower'];
  if (arc(world).cat === 'home') pleasant.unshift('cat');
  const types = r.hunger >= 55 ? ['food', ...(r.energy < 45 ? ['bench'] : []), ...pleasant] :
    r.energy < 45 ? ['bench', ...pleasant] : pleasant;
  for (const type of types) {
    if ((type === 'flower' || type === 'cat') && r.mood >= 80) continue;
    let choice = null;
    for (const o of world.objects) {
      if (o.type !== type || (type === 'food' && o.stock <= 0)) continue;
      const path = routeNear(world, r, o);
      if (path !== null && (!choice || path.length < choice.path.length)) choice = { o, path };
    }
    if (choice) {
      r.path = choice.path;
      r._plan = { kind: type, id: choice.o.id, x: choice.o.x, y: choice.o.y };
      r.activity = type === 'food' ? '寻找食物' : type === 'bench' ? '去休息' : type === 'cat' ? '去找猫' : '去赏花';
      return;
    }
  }
  if (world.weather === 'rainy') {
    r.activity = '避雨'; r.say = '这里淋不到雨，等雨停再出去。'; r._until = world.elapsed + 6;
  } else wander(world, r);
}
function wander(world, r) {
  const seed = Array.from(r.id).reduce((n, c) => n + c.charCodeAt(0), 0) + Math.floor(world.elapsed / 6) * 17;
  for (let i = 0; i < COLS * ROWS; i++) {
    const n = (seed + i * 31) % (COLS * ROWS), p = { x: n % COLS, y: Math.floor(n / COLS) };
    if (distance(r, p) > 5 || distance(r, p) < 2) continue;
    const path = findPath(world, r, p);
    if (path.length) { r.path = path; break; }
  }
  r._plan = { kind: 'walk' };
  r.activity = '散步';
}
function move(world, actor, dt) {
  let budget = dt * 3, arrived = false;
  while (actor.path.length && budget > 0) {
    const target = actor.path[0];
    if (blocked(world, target)) { actor.path = []; return true; }
    const length = distance(actor, target);
    if (length <= budget) {
      actor.x = target.x; actor.y = target.y;
      actor.path.shift(); budget -= length;
      if (!actor.path.length) arrived = true;
    } else {
      actor.x += (target.x - actor.x) / length * budget;
      actor.y += (target.y - actor.y) / length * budget;
      budget = 0;
    }
  }
  return arrived;
}
function tick(world, dt, heldResidentId) {
  world.elapsed += dt;
  world.clock += dt * 0.5;
  let changed = false;
  if (world.clock >= 1440) {
    world.day += Math.floor(world.clock / 1440); world.clock %= 1440;
    log(world, '新的一天开始了。'); advanceArc(world); changed = true;
  }
  changed = move(world, world.hero, dt) || changed;
  for (const r of world.residents) {
    r.hunger = Math.min(100, r.hunger + dt * 0.22);
    r.energy = Math.max(0, r.energy - dt * 0.09);
    r.mood = Math.max(0, r.mood - dt * 0.04);
    if ((r._weather || 'sunny') !== world.weather ||
        (r._plan && r._plan.kind === 'shelter' && !isSheltered(world, r._plan)) ||
        (world.weather === 'rainy' && r.activity === '避雨' && !isSheltered(world, r))) {
      resetPlan(r); changed = true;
    }
    r._weather = world.weather;
    // A controller-owned hold is transient: never stored on the resident.
    if (r.id === heldResidentId) continue;
    const plan = r._plan;
    if (plan && ['food', 'bench', 'flower', 'cat'].includes(plan.kind)) {
      const o = world.objects.find(item => item.id === plan.id);
      if (!o || !same(o, plan) || (o.type === 'food' && o.stock <= 0)) {
        r.path = []; r._plan = null; r._until = 0; changed = true;
      }
    }
    if (!(r._until > world.elapsed) && !r._plan) {
      const note = world.notes.find(n => n.status === 'pending' && n.residentId === r.id);
      const path = note && (world.weather !== 'rainy' || isSheltered(world, r)) ? routeNear(world, r, note, 2) : null;
      if (path !== null) {
        r.path = path; r._plan = { kind: 'note', id: note.id }; r.activity = '去看看小事';
      } else choose(world, r);
    }
    changed = move(world, r, dt) || changed;
    for (const note of world.notes) {
      if (note.status === 'pending' && note.residentId === r.id && distance(r, note) <= 2 &&
          routeNear(world, r, note, 2)?.length === 0) {
        note.status = 'happened';
        r.say = `收到你留下的记录：${note.text}`;
        r.mood = Math.min(100, r.mood + 8);
        log(world, `${r.name}回应了小事：${note.text}`);
        if (r._plan && r._plan.kind === 'note' && r._plan.id === note.id) {
          r.path = []; r._plan = null; r.activity = '回味小事'; r._until = world.elapsed + 6;
        }
        changed = true;
      }
    }
    if (!r.path.length && r._plan) {
      const p = r._plan, o = world.objects.find(item => item.id === p.id);
      if (p.kind === 'shelter' && same(r, p) && isSheltered(world, r)) {
        r.activity = '避雨'; r.say = '这里淋不到雨，等雨停再出去。'; changed = true;
      }
      if (o && adjacent(r, o) && (world.weather !== 'rainy' || isSheltered(world, r))) {
        if (p.kind === 'food' && o.stock > 0) {
          o.stock--; r.hunger = Math.max(0, r.hunger - 65);
          r.activity = '吃饭'; r.say = '肚子饿了，吃点东西真舒服。';
        } else if (p.kind === 'bench') {
          r.energy = Math.min(100, r.energy + 48); r.activity = '休息'; r.say = '累了就坐一会儿，又有精神了。';
        } else if (p.kind === 'flower') {
          r.mood = Math.min(100, r.mood + 12); r.activity = '赏花'; r.say = '花开得真好，心情也亮起来了。';
        } else if (p.kind === 'cat') {
          r.mood = Math.min(100, r.mood + 12); r.activity = '看猫'; r.say = '小白，可别再乱跑了。';
        }
        changed = true;
      }
      r._plan = null; r._until = world.elapsed + 6;
    }
  }
  return changed;
}

export function step(world, dtSeconds, heldResidentId = null) {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0 || world.paused) return false;
  // The controller supplies active simulation time, never wall-clock gaps.
  let remaining = dtSeconds, changed = false;
  while (remaining > 1e-9) {
    const dt = Math.min(0.1, remaining);
    changed = tick(world, dt, heldResidentId) || changed;
    remaining -= dt;
  }
  return changed;
}
