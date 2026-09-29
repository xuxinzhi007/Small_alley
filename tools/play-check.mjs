import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { createWorld, perform, travel, residents, pathTo, PLACES, SAVE_KEY, actionCost, travelCost, actionsAt, rollEncounter, currentEncounter, eligibleEncounters, resolveEncounter, encounterChoice } from '../js/world.js';

createRequire(import.meta.url)('./mock-wx.cjs');
const { createGame } = await import('../js/game.js');

let checks = 0;
function check(name, fn) { fn(); checks += 1; console.log(`OK ${name}`); }
function succeeds(result) { assert.equal(result.ok, true, result.say); }
function rejectedWithoutChange(world, id) {
  const before = JSON.stringify(world);
  assert.equal(perform(world, id).ok, false);
  assert.equal(JSON.stringify(world), before);
}
check('早餐、工作、采购、做饭与次日闭环', () => {
  const world = createWorld();
  succeeds(travel(world, 'room'));
  succeeds(perform(world, 'buy-snack'));
  succeeds(perform(world, 'buy-water'));
  succeeds(perform(world, 'eat'));
  succeeds(perform(world, 'drink'));
  succeeds(travel(world, 'office'));
  while (world.clock < 540) succeeds(perform(world, 'wait'));
  const coins = world.coins;
  succeeds(perform(world, 'work'));
  assert.equal(world.coins, coins + 12);
  succeeds(travel(world, 'market'));
  succeeds(perform(world, 'buy-groceries'));
  succeeds(travel(world, 'bed'));
  succeeds(perform(world, 'cook'));
  assert.equal(world.bag.groceries, 0);
  while (world.clock < 1080) succeeds(perform(world, 'rest'));
  succeeds(perform(world, 'sleep'));
  assert.equal(world.day, 2); assert.equal(world.clock, 420); assert.equal(world.stamina, 100);
});
check('营业时间、跨关门时段、缺钱与缺物品不产生副作用', () => {
  const world = createWorld(); world.place = 'office'; world.clock = 539;
  rejectedWithoutChange(world, 'work'); world.clock = 17 * 60;
  rejectedWithoutChange(world, 'work'); world.place = 'room'; world.coins = 0;
  rejectedWithoutChange(world, 'buy-snack'); rejectedWithoutChange(world, 'eat'); rejectedWithoutChange(world, 'drink');
  world.place = 'bed'; rejectedWithoutChange(world, 'cook'); world.clock = 420;
  rejectedWithoutChange(world, 'sleep'); rejectedWithoutChange(world, 'work');
});
check('身体约束、每日工作上限、深夜返家不锁死', () => {
  const world = createWorld(); world.place = 'office'; world.clock = 540; world.stamina = 29;
  rejectedWithoutChange(world, 'work'); world.stamina = 100; world.hunger = 76;
  rejectedWithoutChange(world, 'work'); world.hunger = 0; world.worked = 2;
  rejectedWithoutChange(world, 'work'); world.clock = 1440; world.stamina = 0;
  assert.equal(travel(world, 'market').ok, false);
  succeeds(travel(world, 'bed')); succeeds(perform(world, 'sleep'));
  assert.equal(world.clock, 420);
});
check('物资耗尽后通过互助餐恢复工作，不能重复领餐', () => {
  const world = createWorld(); world.coins = 0; world.seeds = 0; world.hunger = 100; world.thirst = 100;
  succeeds(perform(world, 'community-meal')); rejectedWithoutChange(world, 'community-meal');
  succeeds(perform(world, 'tap-water')); succeeds(perform(world, 'tap-water'));
  succeeds(travel(world, 'office'));
  while (world.clock < 540) succeeds(perform(world, 'wait'));
  succeeds(perform(world, 'work')); assert.equal(world.coins, 12);
  world.place = 'bed'; world.clock = 1080;
  succeeds(perform(world, 'sleep')); succeeds(perform(world, 'community-meal'));
});
check('NPC作息、同日不刷关系与次日记忆', () => {
  const world = createWorld();
  assert(residents(world, 'market').some((p) => p.id === 'auntie'));
  world.place = 'door'; world.clock = 600;
  succeeds(perform(world, 'talk:auntie')); rejectedWithoutChange(world, 'talk:auntie');
  world.day += 1;
  succeeds(perform(world, 'talk:auntie')); assert.equal(world.relationships.auntie.level, 2);
  world.clock = 840;
  assert(residents(world, 'balcony').some((p) => p.id === 'auntie'));
});
check('种植、离线成熟、收获与出售', () => {
  const world = createWorld(); world.place = 'balcony';
  succeeds(perform(world, 'plant', 1000));
  const before = JSON.stringify(world); assert.equal(perform(world, 'harvest', 2000).ok, false); assert.equal(JSON.stringify(world), before);
  succeeds(perform(world, 'harvest', 10801000)); assert.equal(world.bag.flower, 1);
  world.place = 'market'; const coins = world.coins;
  succeeds(perform(world, 'sell-flower')); assert.equal(world.coins, coins + 6);
});
check('旧存档迁移不修改来源，保留名字和可用物品', () => {
  const legacy = { tables: { player: [{ coins: 7, seeds: 3, day: 5, place: 'room' }], body: [{ name: '小山' }], inventory: [{ item_id: 'snack', qty: 2 }, { item_id: 'milk', qty: 1 }] } };
  const before = JSON.stringify(legacy); const world = createWorld(legacy);
  assert.equal(world.name, '小山'); assert.equal(world.coins, 7); assert.equal(world.day, 5);
  assert.equal(world.bag.snack, 2); assert.equal(world.bag.water, 1);
  assert.equal(JSON.stringify(legacy), before);
});
check('全地图连通与非法目的地', () => {
  for (const from of PLACES) for (const to of PLACES) assert(pathTo(from.id, to.id).length);
  const world = createWorld(); const before = JSON.stringify(world);
  assert.equal(travel(world, 'missing').ok, false); assert.equal(JSON.stringify(world), before);
});

check('疲劳、饥渴与熟练度影响耗时，预览与执行一致', () => {
  const world = createWorld(); world.stamina = 100;
  const fresh = actionCost(world, 'cook', 30).minutes;
  world.stamina = 20; assert(actionCost(world, 'cook', 30).minutes > fresh);
  const tired = actionCost(world, 'cook', 30).minutes;
  world.hunger = 80; assert(actionCost(world, 'cook', 30).minutes > tired);
  world.stamina = 100; world.hunger = 0; world.skills = { cook: 10 };
  assert(actionCost(world, 'cook', 30).minutes < fresh);
  world.bag.groceries = 1;
  const quote = actionsAt(world).find((a) => a.id === 'cook'); const clock = world.clock;
  succeeds(perform(world, 'cook')); assert.equal(world.clock - clock, quote.minutes);
  const trip = travelCost(world, 'room'); const departure = world.clock;
  succeeds(travel(world, 'room')); assert.equal(world.clock - departure, trip.minutes);
});
check('随机事件按天气、时段、地点和人物关系筛选', () => {
  const world = createWorld(); world.place = 'street'; world.weather = 'sunny';
  assert(!eligibleEncounters(world).some(e => e.id === 'rain-shelter'));
  world.weather = 'rainy'; assert(eligibleEncounters(world).some(e => e.id === 'rain-shelter'));
  assert(!eligibleEncounters(world).some(e => e.id === 'evening-light'));
  world.clock = 1100; assert(eligibleEncounters(world).some(e => e.id === 'evening-light'));
  world.place = 'cafe'; assert(!eligibleEncounters(world).some(e => e.id === 'cafe-regular'));
  world.relationships.barista = { level: 1 }; assert(eligibleEncounters(world).some(e => e.id === 'cafe-regular'));
});
check('事件概率、冷却、每日上限与重新加载不重抽', () => {
  const world = createWorld(); world.place = 'room';
  assert.equal(rollEncounter(world, () => 0.99), null);
  assert.equal(rollEncounter(world, () => 0), null);
  world.clock += 25; assert(rollEncounter(world, () => 0));
  const id = currentEncounter(world).id;
  const restored = JSON.parse(JSON.stringify(world)); assert.equal(rollEncounter(restored, () => 0.99).id, id);
  succeeds(resolveEncounter(world, -1));
  assert(!eligibleEncounters(world).some(e => e.id === id));
  world.encounterSeen = { a: world.day, b: world.day, c: world.day }; world.clock += 25;
  assert.equal(rollEncounter(world, () => 0), null);
});
check('事件选择条件、只结算一次、事件期间不穿透行动', () => {
  const world = createWorld(); world.place = 'street';
  assert(rollEncounter(world, () => 0)); assert.equal(currentEncounter(world).id, 'street-cat');
  rejectedWithoutChange(world, 'rest'); assert.equal(travel(world, 'bed').ok, false);
  assert(encounterChoice(world, 1).reason); const before = JSON.stringify(world);
  assert.equal(resolveEncounter(world, 1).ok, false); assert.equal(JSON.stringify(world), before);
  succeeds(resolveEncounter(world, -1)); assert.equal(resolveEncounter(world, -1).ok, false);
});

check('帮助留下记忆，次日重逢且礼物只领取一次', () => {
  const world = createWorld(); world.place = 'door'; world.clock = 600;
  world.pendingEncounter = { id: 'door-bag' }; succeeds(resolveEncounter(world, 1));
  assert.equal(world.memories['helped-auntie'], 1);
  assert(!eligibleEncounters(world).some(e => e.id === 'auntie-thanks'));
  world.day = 2; world.clock = 600;
  assert(eligibleEncounters(world).some(e => e.id === 'auntie-thanks'));
  world.pendingEncounter = { id: 'auntie-thanks' }; succeeds(resolveEncounter(world, -1));
  world.day = 3; world.clock = 600;
  assert(eligibleEncounters(world).some(e => e.id === 'auntie-thanks'));
  world.pendingEncounter = { id: 'auntie-thanks' }; const seeds = world.seeds;
  succeeds(resolveEncounter(world, 1)); assert.equal(world.seeds, seeds + 1);
  const copy = JSON.parse(JSON.stringify(world)); copy.day = 4;
  assert(!eligibleEncounters(copy).some(e => e.id === 'auntie-thanks'));
});

let time = Date.now();
const originalNow = Date.now;
const originalRandom = Math.random;
Date.now = () => time;
Math.random = () => 0.99;
try {
  const game = createGame();
  await Promise.resolve();
  function frame() { time += 1500; game.frame(time); }
  function touch(id, mode = 'tap') {
    frame();
    const hit = game.hotspots.find((spot) => spot.id === id);
    assert(hit, `找不到 ${id}`);
    const point = { clientX: hit.x + hit.w / 2, clientY: hit.y + hit.h / 2 };
    global.__down({ touches: [point] });
    if (mode === 'cancel') global.__cancel({});
    if (mode === 'drag') global.__move({ touches: [{ clientX: point.clientX + 50, clientY: point.clientY }] });
    global.__up({ changedTouches: [point] });
    frame();
  }
  check('建筑热区互不重叠', () => {
    frame(); assert(!game.hotspots.some(s => s.id.startsWith('place:')));
    touch('map'); const spots = game.hotspots.filter((s) => s.id.startsWith('place:'));
    assert.equal(spots.length, 13);
    for (let i = 0; i < spots.length; i += 1) for (let j = i + 1; j < spots.length; j += 1) {
      const a = spots[i]; const b = spots[j];
      assert(!(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y), `${a.id} 与 ${b.id} 重叠`);
    }
  });
  check('真实游戏控制器：选择地点、旅行、购买与背包使用', () => {
    touch('place:room'); touch('travel:room'); assert.equal(game.snapshot.place, 'room');
    touch('object:buy-snack'); assert.equal(game.snapshot.bag.snack, 0);
    touch('choice:right'); assert.equal(game.snapshot.bag.snack, 1); touch('choice:left');
    touch('bag'); touch('action:eat'); assert.equal(game.snapshot.bag.snack, 0);
    assert(!game.hotspots.some(s => s.id === 'dialogue'));
    assert.deepEqual(wx.getStorageSync(SAVE_KEY), game.snapshot);
  });
  check('拖动与取消手势不会误购买', () => {
    const before = game.snapshot;
    touch('object:buy-snack', 'drag'); touch('object:buy-snack', 'cancel');
    assert.deepEqual(game.snapshot, before);
  });
  check('对话滑动确认一次、短拖回弹与取消不结算', () => {
    touch('object:buy-snack');
    function swipe(dx, cancel = false) {
      frame(); const hit = game.hotspots.find(s => s.id === 'dialogue'); assert(hit);
      const start = { clientX: hit.x + hit.w / 2, clientY: hit.y + hit.h / 2 };
      const end = { clientX: start.clientX + dx, clientY: start.clientY };
      global.__down({ touches: [start] }); global.__move({ touches: [end] });
      if (cancel) global.__cancel({});
      global.__up({ changedTouches: [end] }); frame();
    }
    const coins = game.snapshot.coins;
    swipe(30); assert.equal(game.snapshot.coins, coins);
    swipe(120, true); assert.equal(game.snapshot.coins, coins);
    swipe(120); assert.equal(game.snapshot.coins, coins - 3);
    touch('choice:left');
  });
  check('走近后直接喝水，途中重复触摸或切后台不误结算', () => {
    touch('map'); touch('place:bed'); touch('travel:bed');
    frame(); const hit = game.hotspots.find(s => s.id === 'object:tap-water'); assert(hit);
    const point = { clientX: hit.x + hit.w / 2, clientY: hit.y + hit.h / 2 };
    const before = game.snapshot;
    global.__down({ touches: [point] }); global.__up({ changedTouches: [point] });
    assert.deepEqual(game.snapshot, before);
    global.__hide(); global.__show(); frame(); assert.deepEqual(game.snapshot, before);
    global.__down({ touches: [point] }); global.__up({ changedTouches: [point] });
    global.__down({ touches: [point] }); global.__up({ changedTouches: [point] });
    frame(); assert(game.snapshot.thirst < before.thirst);
    assert(!game.hotspots.some(s => s.id === 'dialogue'));
    const after = game.snapshot; frame(); assert.deepEqual(game.snapshot, after);
  });
  check('命名取消与确认、后台保存、重新加载', () => {
    touch('name'); global.__complete({}); global.__key({ value: '不应写入' });
    assert.notEqual(game.snapshot.name, '不应写入');
    touch('name'); global.__key({ value: '小巷居民' }); assert.equal(game.snapshot.name, '小巷居民');
    global.__hide(); global.__show(); frame();
    const copy = createGame(); assert.deepEqual(copy.snapshot, game.snapshot);
  });
  check('渲染循环不读写存储', () => {
    const get = wx.getStorageSync; const set = wx.setStorageSync;
    wx.getStorageSync = () => { throw new Error('每帧读取存储'); };
    wx.setStorageSync = () => { throw new Error('每帧写入存储'); };
    try { frame(); frame(); } finally { wx.getStorageSync = get; wx.setStorageSync = set; }
  });
} finally { Date.now = originalNow; Math.random = originalRandom; }
console.log(`play-check: ${checks} checks passed`);
