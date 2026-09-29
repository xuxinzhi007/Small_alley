import assert from 'node:assert/strict';
import {
  TILE, COLS, ROWS, SAVE_KEY, CATALOG, BUILDINGS, createSandbox, isWall,
  findPath, commandMove, interact, editObject, undoEdit, addNote, step, isSheltered
} from '../js/sandbox.js';

let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`OK ${name}`); }
function ok(value) { assert.equal(value.ok, true, value.say); return value; }
function unchanged(world, fn) {
  const before = JSON.stringify(world);
  assert.equal(fn().ok, false);
  assert.equal(JSON.stringify(world), before);
}
function advance(world, seconds) {
  for (let i = 0; i < seconds * 10; i++) assert.equal(typeof step(world, 0.1), 'boolean');
}
function oneResident() {
  const world = createSandbox();
  world.objects = [];
  world.residents = [world.residents[0]];
  Object.assign(world.residents[0], { x: 10, y: 10, hunger: 0, energy: 100, mood: 20 });
  return world;
}

check('API常量和初始数据安全', () => {
  assert.deepEqual([TILE, COLS, ROWS, SAVE_KEY], [40, 24, 20, 'little-lane-sandbox-v1']);
  assert.deepEqual(CATALOG, { bench: { name: '长椅' }, flower: { name: '花盆' }, food: { name: '食物' }, shelter: { name: '遮雨棚' } });
  const w = createSandbox();
  assert.equal(w.version, 1); assert.equal(w.name, '小巷居民');
  assert.equal(w.clock, 480); assert.equal(w.elapsed, 0);
  assert.equal(isWall(w.hero.x, w.hero.y), false);
  for (const b of BUILDINGS) assert.equal(isWall(b.x + Math.floor(b.w / 2), b.y + b.h - 1), false);
  assert.deepEqual(w, JSON.parse(JSON.stringify(w)));
});

check('可达穿门、绕墙、物品阻挡且居民不阻挡', () => {
  const w = createSandbox(), to = { x: 5, y: 4 };
  const path = findPath(w, w.hero, to);
  assert.ok(path.some(p => p.x === 5 && p.y === 7));
  assert.deepEqual(path.at(-1), to);
  assert.notDeepEqual(path[0], { x: w.hero.x, y: w.hero.y });
  let previous = w.hero;
  for (const p of path) {
    assert.equal(Math.abs(p.x - previous.x) + Math.abs(p.y - previous.y), 1);
    assert.equal(isWall(p.x, p.y), false); previous = p;
  }
  const around = findPath(w, { x: 1, y: 4 }, { x: 10, y: 4 });
  assert.ok(around.length > 9);
  assert.deepEqual(findPath(w, w.hero, { x: 2, y: 2 }), []);
  assert.deepEqual(findPath(w, w.hero, w.objects[0]), []);
  assert.ok(findPath(w, w.hero, w.residents[0]).length);
  ok(editObject(w, { type: 'bench', x: 5, y: 7 }));
  assert.deepEqual(findPath(w, w.hero, to), []);
});

check('移动速度、到达保存、改道和边界失败不变', () => {
  const w = createSandbox(); w.residents = [];
  ok(commandMove(w, 9, 10));
  assert.equal(step(w, 0.1), false);
  assert.ok(Math.abs(w.hero.x - 6.3) < 1e-9);
  assert.ok(Math.abs(w.clock - 480.05) < 1e-9);
  ok(commandMove(w, 6, 12));
  assert.deepEqual(w.hero.path[0], { x: 7, y: 10 });
  advance(w, 2);
  assert.equal(w.hero.x, 6); assert.equal(w.hero.y, 12);
  ok(commandMove(w, 6, 13));
  let saved = false;
  for (let i = 0; i < 10; i++) saved = step(w, 0.1) || saved;
  assert.equal(saved, true);
  for (const x of [NaN, Infinity, -1, COLS, 1.5, '4']) {
    unchanged(w, () => commandMove(w, x, 10));
    assert.deepEqual(findPath(w, w.hero, { x, y: 10 }), []);
  }
  w.paused = true;
  const snapshot = JSON.stringify(w);
  assert.equal(step(w, 0.1), false); assert.equal(JSON.stringify(w), snapshot);
  w.paused = false;
  for (const dt of [NaN, Infinity, -1, 0]) assert.equal(step(w, dt), false);
});

check('非法编辑原子性、放置移动移除撤销、人物占用撤销失败', () => {
  const w = createSandbox();
  for (const edit of [null, { type: 'unknown', x: 8, y: 10 }, { type: 'food', x: NaN, y: 10 },
    { type: 'bench', x: 2, y: 2 }, { type: 'food', x: 6, y: 10 },
    { type: 'bench', x: 10, y: 10 }, { type: 'bench', x: 7, y: 14 },
    { id: 'missing', remove: true }, { type: 'food', x: 24, y: 10 }]) {
    unchanged(w, () => editObject(w, edit));
  }
  const before = structuredClone(w.objects);
  const added = ok(editObject(w, { type: 'food', x: 8, y: 10 }));
  const id = w.objects.at(-1).id;
  const moved = ok(editObject(w, { id, type: 'food', x: 8, y: 11 }));
  unchanged(w, () => editObject(w, { id, type: 'food', x: 6, y: 10 }));
  ok(undoEdit(w, moved.undo));
  assert.equal(w.objects.at(-1).y, 10);
  ok(undoEdit(w, added.undo));
  assert.deepEqual(w.objects, before);
  const removed = ok(editObject(w, { id: w.objects[1].id, remove: true }));
  w.hero.x = 10; w.hero.y = 14;
  unchanged(w, () => undoEdit(w, removed.undo));
  w.hero.x = 6; w.hero.y = 10;
  ok(undoEdit(w, removed.undo));
  assert.deepEqual(w.objects, before);
  unchanged(w, () => undoEdit(w, { before: [null], after: w.objects }));
});

check('物品上限60、无补充食物、交互必须邻近', () => {
  const w = createSandbox(); w.objects = [];
  outer: for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (isWall(x, y) || [w.hero, ...w.residents].some(p => p.x === x && p.y === y)) continue;
    if (w.objects.length === 60) {
      unchanged(w, () => editObject(w, { type: 'bench', x, y })); break outer;
    }
    ok(editObject(w, { type: 'bench', x, y }));
  }
  assert.equal(w.objects.length, 60); assert.equal(w.journal.length, 50);
  const v = createSandbox();
  unchanged(v, () => interact(v, v.objects[0].id));
  v.hero.x = 18; v.hero.y = 6;
  const food = v.objects[0]; food.stock = 1;
  ok(interact(v, food.id)); assert.equal(food.stock, 0);
  unchanged(v, () => interact(v, food.id));
  assert.ok(v.objects.includes(food));
  v.hero.x = 10; v.hero.y = 13; ok(interact(v, 's2'));
  v.hero.x = 7; v.hero.y = 13; ok(interact(v, 's3'));
  v.hero.x = 9; v.hero.y = 10; ok(interact(v, v.residents[0].id));
});

check('饥饿居民到达后吃饭，疲劳居民休息，花盆改善心情', () => {
  for (const type of ['food', 'bench', 'flower']) {
    const w = oneResident(), r = w.residents[0];
    if (type === 'food') r.hunger = 90;
    if (type === 'bench') r.energy = 10;
    ok(editObject(w, { type, x: 14, y: 10 }));
    const o = w.objects[0], stock = o.stock;
    const baseline = w.journal.length;
    step(w, 0.1);
    assert.ok(r.x < 13);
    assert.equal(o.stock, stock);
    if (type === 'bench') assert.ok(r.energy < 11);
    advance(w, 2);
    if (type === 'food') { assert.equal(o.stock, stock - 1); assert.ok(r.hunger < 40); assert.equal(r.activity, '吃饭'); }
    if (type === 'bench') { assert.ok(r.energy > 50); assert.equal(r.activity, '休息'); }
    if (type === 'flower') { assert.ok(r.mood > 20); assert.equal(r.activity, '赏花'); }
    assert.equal(w.journal.length, baseline);
    const journals = w.journal.length;
    advance(w, 2);
    assert.equal(w.journal.length, journals);
  }
});

check('不可达食物不会远程生效，物品移动后重新决策', () => {
  const w = oneResident(), r = w.residents[0]; r.hunger = 90;
  ok(editObject(w, { type: 'food', x: 5, y: 4 }));
  ok(editObject(w, { type: 'bench', x: 5, y: 7 }));
  advance(w, 10);
  assert.equal(w.objects[0].stock, 4); assert.ok(r.hunger >= 90);
  const v = oneResident(); v.residents[0].hunger = 90;
  ok(editObject(v, { type: 'food', x: 14, y: 10 }));
  step(v, 0.1);
  const id = v.objects[0].id;
  ok(editObject(v, { id, x: 20, y: 10 }));
  advance(v, 1);
  assert.equal(v.objects[0].stock, 4);
  advance(v, 5);
  assert.equal(v.objects[0].stock, 3);
});

check('私密不触发、指定居民主动走近且只触发一次', () => {
  const w = oneResident(), r = w.residents[0];
  ok(addNote(w, '  私密的一天  '));
  assert.equal(w.notes[0].text, '私密的一天');
  ok(addNote(w, '看见了一只猫', r.id, 19, 10));
  advance(w, 6);
  assert.equal(w.notes[0].status, 'private');
  assert.equal(w.notes[1].status, 'happened');
  const occurrences = () => w.journal.filter(j => j.text.includes('回应了小事')).length;
  assert.equal(occurrences(), 1);
  advance(w, 10); assert.equal(occurrences(), 1);
  const v = createSandbox();
  ok(addNote(v, '只有指定居民回应', v.residents[0].id, 4, 14));
  v.residents[0]._until = 100;
  step(v, 0.1);
  assert.equal(v.notes[0].status, 'pending');
});

check('记录trim、80字和40条边界，非法记录不变', () => {
  const w = createSandbox();
  for (const args of [['   '], ['字'.repeat(81)], ['记录', 'missing'], ['记录', null, Infinity, 10], ['记录', null, 2, 2]]) {
    unchanged(w, () => addNote(w, ...args));
  }
  ok(addNote(w, `  ${'字'.repeat(80)}  `));
  ok(addNote(w, String.fromCodePoint(0x20000).repeat(80)));
  while (w.notes.length < 40) ok(addNote(w, '平凡的小事'));
  unchanged(w, () => addNote(w, '多一条'));
});

check('序列化重载继续确定性模拟，已发生记录不重演', () => {
  const w = createSandbox('测试居民');
  ok(addNote(w, '遇见邻居', w.residents[0].id, 10, 10));
  ok(commandMove(w, 5, 4));
  advance(w, 0.3);
  const restored = JSON.parse(JSON.stringify(w));
  for (let i = 0; i < 600; i++) {
    assert.equal(step(w, 0.1), step(restored, 0.1));
    assert.deepEqual(w, restored);
  }
  assert.equal(w.notes[0].status, 'happened');
  assert.equal(w.journal.filter(j => j.text.includes('回应了小事')).length, 1);
  w.clock = 1439.95; w.residents = []; step(w, 0.2);
  assert.equal(w.day, 2); assert.ok(w.clock < 1);
});

check('雨天自主找棚，到达才避雨且不冲出去赏花', () => {
  const w = oneResident(), r = w.residents[0];
  ok(editObject(w, { type: 'shelter', x: 13, y: 10 }));
  ok(editObject(w, { type: 'flower', x: 8, y: 10 }));
  w.weather = 'rainy'; step(w, .1);
  assert.equal(r.activity, '寻找遮雨处'); assert.equal(isSheltered(w, r), false);
  assert.equal(w.journal.some(j => j.text.includes('花开得')), false);
  advance(w, 2); assert.equal(r.activity, '避雨'); assert.equal(isSheltered(w, r), true);
  const p = { x: r.x, y: r.y }; advance(w, 20);
  assert.deepEqual({ x: r.x, y: r.y }, p);
  w.weather = 'sunny'; advance(w, 3);
  assert.equal(r.activity, '赏花');
});

check('没有棚仍自主进屋，门堵住则改找可达房屋', () => {
  for (const sealed of [false, true]) {
    const w = oneResident(), r = w.residents[0];
    if (sealed) ok(editObject(w, { type: 'bench', x: 5, y: 7 }));
    w.weather = 'rainy'; advance(w, 15);
    assert.equal(r.activity, '避雨'); assert.equal(isSheltered(w, r), true);
    if (sealed) assert.ok(r.x > 14);
  }
});

check('覆盖不穿墙，不包括柱子、对角或不可通行格', () => {
  const w = oneResident(); ok(editObject(w, { type: 'shelter', x: 1, y: 4 }));
  assert.equal(isSheltered(w, { x: 2, y: 4 }), false);
  assert.equal(isSheltered(w, { x: 1, y: 4 }), false);
  assert.equal(isSheltered(w, { x: 0, y: 3 }), false);
  assert.equal(isSheltered(w, { x: 0, y: 4 }), true);
  ok(editObject(w, { type: 'bench', x: 0, y: 4 }));
  assert.equal(isSheltered(w, { x: 0, y: 4 }), false);
  // All building doors closed; a covered but enclosed cell is not a destination.
  w.objects = [{ id: 'roof', type: 'shelter', x: 13, y: 10, stock: 0 }];
  for (const p of [[12,9],[11,10],[12,11],[14,10],[13,9],[13,11],[5,7],[18,7],[18,18]]) {
    w.objects.push({ id: String(p), type: 'bench', x: p[0], y: p[1], stock: 0 });
  }
  assert.equal(isSheltered(w, { x: 12, y: 10 }), true);
  assert.deepEqual(findPath(w, w.residents[0], { x: 12, y: 10 }), []);
  w.weather = 'rainy'; advance(w, 8);
  assert.notEqual(w.residents[0].activity, '避雨');
});

check('棚移动移除撤销后重算，旧停留和途中计划失效', () => {
  const w = oneResident(), r = w.residents[0];
  ok(editObject(w, { type: 'shelter', x: 13, y: 10 })); const id = w.objects[0].id;
  w.weather = 'rainy'; step(w, .1);
  ok(editObject(w, { id, x: 10, y: 13 }));
  assert.equal(r._plan, null); advance(w, 3); assert.equal(isSheltered(w, r), true);
  const removed = ok(editObject(w, { id, remove: true }));
  assert.equal(isSheltered(w, r), false); assert.notEqual(r.activity, '避雨');
  ok(undoEdit(w, removed.undo)); advance(w, .2); assert.equal(r.activity, '避雨');
  ok(editObject(w, { id, remove: true })); advance(w, 15);
  assert.equal(isSheltered(w, r), true); assert.equal(r.activity, '避雨');
});

check('雨中只在遮雨范围到达需求物品后消费', () => {
  const w = oneResident(), r = w.residents[0];
  Object.assign(r, { x: 3, y: 3, hunger: 90 });
  ok(editObject(w, { type: 'food', x: 7, y: 5 }));
  w.weather = 'rainy'; step(w, .1); assert.equal(w.objects[0].stock, 4);
  assert.equal(r.activity, '寻找食物'); advance(w, 3);
  assert.equal(w.objects[0].stock, 3); assert.equal(isSheltered(w, r), true);
});

check('首次重遇和每日关系上限，实际共同避雨记忆可重载', () => {
  const w = oneResident(), r = w.residents[0];
  w.hero.x = 9; w.hero.y = 10;
  assert.match(ok(interact(w, r.id)).say, /头一回/);
  assert.match(ok(interact(w, r.id)).say, /又见面/);
  assert.equal(r.relationship, 1);
  w.weather = 'rainy'; ok(interact(w, r.id)); assert.equal(r.sharedRainDay, undefined);
  Object.assign(r, { x: 3, y: 3 }); Object.assign(w.hero, { x: 4, y: 3 });
  assert.match(ok(interact(w, r.id)).say, /一起避雨/);
  for (let i = 0; i < 10; i++) ok(interact(w, r.id));
  assert.equal(r.relationship, 1); assert.equal(r.sharedRainDay, 1);
  const restored = JSON.parse(JSON.stringify(w)); restored.weather = 'sunny'; restored.day++;
  assert.match(ok(interact(restored, r.id)).say, /第1天一起避雨/);
  assert.equal(restored.residents[0].relationship, 2);
  ok(interact(restored, r.id)); assert.equal(restored.residents[0].relationship, 2);
  const v = oneResident(); Object.assign(v.residents[0], { x: 5, y: 6 });
  Object.assign(v.hero, { x: 5, y: 7 }); v.weather = 'rainy';
  ok(interact(v, v.residents[0].id)); assert.equal(v.residents[0].sharedRainDay, undefined);
  v.hero.x = 10; v.hero.y = 10;
  unchanged(v, () => interact(v, v.residents[0].id));
});

check('阿禾找猫：巷口留食物次日猫回家，无食物不触发', () => {
  const w = oneResident(); w.arc = { cat: 'missing' };
  w.clock = 1439.9; advance(w, 1);
  assert.equal(w.arc.cat, 'missing');
  assert.equal(w.objects.some(o => o.type === 'cat'), false);

  const v = oneResident(); v.arc = { cat: 'missing' };
  const a = v.residents[0];
  ok(editObject(v, { type: 'food', x: 5, y: 8 }));
  const moodBefore = a.mood;
  v.clock = 1439.9; advance(v, 1);
  const cat = v.objects.find(o => o.type === 'cat');
  assert.ok(cat, '次日应在巷口出现猫');
  assert.equal(v.arc.cat, 'home');
  assert.ok(a.mood > moodBefore);
  assert.ok((a.relationship || 0) >= 2);
  assert.ok(v.journal.some(j => j.text.includes('小白回家了')));

  Object.assign(a, { x: 3, y: 10, hunger: 0, energy: 100, mood: 20, path: [], _plan: null, _until: 0 });
  step(v, 0.1);
  assert.equal(a.activity, '去找猫');
  advance(v, 3);
  assert.equal(a.activity, '看猫');
  assert.ok(a.mood > 20);

  Object.assign(a, { x: 10, y: 10, path: [], _plan: null, _until: 0 });
  Object.assign(v.hero, { x: 9, y: 10 });
  assert.match(ok(interact(v, a.id)).say, /回家/);
  Object.assign(v.hero, { x: cat.x, y: cat.y + 1 });
  assert.match(ok(interact(v, cat.id)).say, /小白/);

  const removed = ok(editObject(v, { id: cat.id, remove: true }));
  ok(undoEdit(v, removed.undo));
  assert.ok(v.objects.some(o => o.id === cat.id));
});

check('短暂停步只影响指定居民，不持久化冻结', () => {
  const w = createSandbox(), r = w.residents[0];
  const p = { x: r.x, y: r.y }; step(w, 2, r.id);
  assert.deepEqual({ x: r.x, y: r.y }, p);
  assert.ok(w.residents.slice(1).some(n => n.path.length || n.activity !== '散步'));
  step(w, 2); assert.notDeepEqual({ x: r.x, y: r.y }, p);
});

console.log(`Sandbox model: ${checks} checks passed.`);
