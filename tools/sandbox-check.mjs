import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { TILE, SAVE_KEY, isWall, findPath, createSandbox } from '../js/sandbox.js';
createRequire(import.meta.url)('./mock-wx.cjs');
const { createSandboxGame } = await import('../js/sandbox-game.js');
const legacy = { version: 1, name: '旧居民', coins: 99 };
wx.setStorageSync('little-lane-world-v1', legacy);
const game = createSandboxGame();
let clock = 1000;
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`OK ${name}`); }
function frame(count = 1) { for (let i = 0; i < count; i++) { clock += 100; game.frame(clock); } }
function pointer(type, p) { global[type]({ touches: [p], changedTouches: [p] }); }
function tapPoint(p) { pointer('__down', p); pointer('__up', p); }
function tap(id) { const h = game.hotspots.find(h => h.id === id); assert(h, `找不到 ${id}`); tapPoint({ clientX: h.x + h.w / 2, clientY: h.y + h.h / 2 }); }
function screen(x, y) { const v = game.view; return { clientX: (x + .5) * TILE - v.camera.x + v.viewport.x, clientY: (y + .5) * TILE - v.camera.y + v.viewport.y }; }
function emptyCell(exclude = []) {
  const w = game.snapshot, v = game.view;
  for (let y = 1; y < 19; y++) for (let x = 1; x < 23; x++) {
    const p = screen(x, y);
    if (p.clientX < 24 || p.clientX > 366 || p.clientY < v.viewport.y + 30 || p.clientY > v.viewport.y + v.viewport.h - 50) continue;
    if (isWall(x, y) || exclude.some(c => c.x === x && c.y === y) || w.objects.some(o => o.x === x && o.y === y)) continue;
    if ([w.hero, ...w.residents].some(o => Math.hypot(o.x - x, o.y - y) < 1.5)) continue;
    if (!findPath(w, w.hero, { x, y }).length) continue;
    return { x, y };
  }
  throw new Error('视口中没有测试空地');
}
frame();
check('新沙盒保留旧存档，仅继承名字', () => { assert.equal(game.snapshot.name, '旧居民'); assert.deepEqual(wx.getStorageSync('little-lane-world-v1'), legacy); });
check('无需地图点地面移动且能到达', () => {
  const p = emptyCell(); tapPoint(screen(p.x, p.y)); assert(game.snapshot.hero.path.length); frame(100);
  assert(Math.hypot(game.snapshot.hero.x - p.x, game.snapshot.hero.y - p.y) < .05);
});
check('观察拖镜头不移动玩家，切后台不推进时间', () => {
  tap('mode:observe'); const hero = game.snapshot.hero; const v = game.view;
  const p = { clientX: 195, clientY: v.viewport.y + 150 };
  pointer('__down', p); pointer('__move', { clientX: 145, clientY: p.clientY - 30 }); pointer('__up', p); frame(2);
  assert.deepEqual(game.snapshot.hero, hero);
  global.__hide(); const before = game.snapshot; frame(200); assert.deepEqual(game.snapshot, before); global.__show(); frame();
});
let placed;
check('创造暂停模拟，放置移除撤销可保存', () => {
  tap('mode:create'); const before = game.snapshot; frame(20); assert.deepEqual(game.snapshot, before);
  const p = emptyCell(); tap('tool:bench'); tapPoint(screen(p.x, p.y));
  placed = game.snapshot.objects.find(o => o.x === p.x && o.y === p.y); assert(placed);
  tap(`object:${placed.id}`); tap('remove'); assert(!game.snapshot.objects.some(o => o.id === placed.id));
  tap('undo'); assert(game.snapshot.objects.some(o => o.id === placed.id));
  assert.deepEqual(wx.getStorageSync(SAVE_KEY), game.snapshot);
});
check('移动物品与撤销恢复原位置，取消拖动不放置', () => {
  tap(`object:${placed.id}`); tap('move'); const target = emptyCell(); tapPoint(screen(target.x, target.y));
  assert.equal(game.snapshot.objects.find(o => o.id === placed.id).x, target.x);
  tap('undo'); assert.equal(game.snapshot.objects.find(o => o.id === placed.id).x, placed.x);
  tap('tool:flower'); const p = screen(target.x, target.y), before = game.snapshot;
  pointer('__down', p); global.__cancel({}); pointer('__up', p); assert.deepEqual(game.snapshot, before);
});
check('记录取消不保存，私密与指定居民明确分开', () => {
  tap('journal'); tap('note:new'); global.__complete({}); tap('close'); assert.equal(game.snapshot.notes.length, 0);
  tap('journal'); tap('note:new'); global.__key({ value: '今天喝到了一杯温热的茶' }); tap('note:save');
  assert.equal(game.snapshot.notes[0].status, 'private');
  tap('note:new'); global.__key({ value: '一起在树下听雨' }); const id = game.snapshot.residents[0].id;
  tap(`note:resident:${id}`); tap('note:save');
  assert.equal(game.snapshot.notes[1].residentId, id); assert.equal(game.snapshot.notes[1].status, 'pending');
  tap('close'); tap('mode:life'); frame(300);
  assert.equal(game.snapshot.notes[0].status, 'private');
});
check('刷新恢复物品和生活记录，旧存档未修改', () => {
  global.__hide(); const copy = createSandboxGame(); assert.deepEqual(copy.snapshot, game.snapshot);
  assert.deepEqual(wx.getStorageSync('little-lane-world-v1'), legacy);
});
check('四项创造工具触区至少44px，棚可放置撤销', () => {
  const g = createSandboxGame();
  const click = id => { const h = g.hotspots.find(h => h.id === id); assert(h); tapPoint({ clientX: h.x + h.w / 2, clientY: h.y + h.h / 2 }); };
  click('mode:create');
  const tools = g.hotspots.filter(h => h.id.startsWith('tool:'));
  assert.equal(tools.length, 4); tools.forEach(h => assert(h.w >= 44 && h.h >= 44));
  click('tool:shelter');
  const w = g.snapshot, v = g.view;
  let p;
  for (let y = 0; y < 20 && !p; y++) for (let x = 0; x < 24 && !p; x++) {
    const sx = (x + .5) * TILE - v.camera.x, sy = (y + .5) * TILE - v.camera.y + v.viewport.y;
    if (sx < 24 || sx > 366 || sy < v.viewport.y + 40 || sy > v.viewport.y + v.viewport.h - 60 || isWall(x, y)) continue;
    if ([...w.objects, ...w.residents, w.hero].some(o => Math.hypot(o.x - x, o.y - y) < 1.5)) continue;
    p = { clientX: sx, clientY: sy };
  }
  assert(p); tapPoint(p); assert.equal(g.snapshot.objects.at(-1).type, 'shelter');
  click('undo'); assert.deepEqual(g.snapshot.objects, w.objects);
});

check('靠近移动居民可完成交流，取消切模式后台释放停步', () => {
  for (const action of ['finish', 'cancel', 'mode', 'hide', 'ground', 'journal', 'repeat']) {
    const w = createSandbox(); w.objects = []; w.residents = w.residents.slice(0, 2);
    Object.assign(w.hero, { x: 8, y: 10 });
    Object.assign(w.residents[0], { x: 10.4, y: 10, path: [{ x: 11, y: 10 }, { x: 12, y: 10 }], _plan: { kind: 'walk' } });
    wx.setStorageSync(SAVE_KEY, w); const g = createSandboxGame(); let now = 1000; g.frame(now);
    const click = id => { const h = g.hotspots.find(h => h.id === id); assert(h, id); tapPoint({ clientX: h.x + h.w / 2, clientY: h.y + h.h / 2 }); };
    click('npc:resident-a');
    const pathAtTap = g.snapshot.hero.path.map(p => ({ ...p }));
    if (action === 'repeat') { click('npc:resident-a'); assert.deepEqual(g.snapshot.hero.path, pathAtTap); }
    for (let i = 0; i < 3; i++) g.frame(now += 100);
    assert.equal(g.snapshot.residents[0].x, 10.4);
    assert.notDeepEqual(g.snapshot.residents[1], w.residents[1]);
    if (action === 'cancel') global.__cancel({});
    if (action === 'mode') click('mode:observe');
    if (action === 'hide') { global.__hide(); global.__show(); }
    if (action === 'journal') { click('journal'); click('close'); }
    if (action === 'ground') {
      const v = g.view; tapPoint({ clientX: 8.5 * TILE - v.camera.x, clientY: 11.5 * TILE - v.camera.y + v.viewport.y });
    }
    for (let i = 0; i < 40; i++) g.frame(now += 100);
    assert.notEqual(g.snapshot.residents[0].x, 10.4);
    assert.equal(g.snapshot.residents[0].relationship || 0, action === 'finish' || action === 'repeat' ? 1 : 0);
    if (action === 'finish') assert.match(g.view.notice, /头一回/);
  }
});
console.log(`sandbox-check: ${checks} checks passed`);
