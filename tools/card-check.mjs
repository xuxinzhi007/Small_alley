import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  CARD_SAVE_KEY, createCardWorld, resident, relation, nextCard, choose, defer, passDay
} from '../js/cards.js';
createRequire(import.meta.url)('./mock-wx.cjs');
const { createCardGame } = await import('../js/card-game.js');

let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`OK ${name}`); }
function unchanged(world, fn) {
  const before = JSON.stringify(world);
  const result = fn();
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(world), before);
  return result;
}
function playedSetup(extra = {}) {
  const w = createCardWorld();
  w.flags['played:fish-dry'] = true;
  w.flags['played:ahe-cat'] = true;
  w.day = 6;
  Object.assign(w, extra);
  return w;
}
function clearSave() { delete global.__store[CARD_SAVE_KEY]; }
function pointer(type, p) { global[type]({ touches: [p], changedTouches: [p] }); }
function tapPoint(p) { pointer('__down', p); pointer('__up', p); }
function tap(game, id) {
  const h = game.hotspots.find(h => h.id === id);
  assert(h, `找不到热点 ${id}`);
  tapPoint({ clientX: h.x + h.w / 2, clientY: h.y + h.h / 2 });
}

check('API常量与初始数据安全', () => {
  assert.equal(CARD_SAVE_KEY, 'little-lane-cards-v1');
  const w = createCardWorld();
  assert.equal(w.version, 1); assert.equal(w.day, 1); assert.equal(w.atmosphere, 62);
  assert.deepEqual(w.residents.map(r => r.name), ['小满', '林姨', '阿禾']);
  assert.equal(w.relations['linyi:xiaoman'], 52);
  assert.equal(w.records.length, 1); assert.deepEqual(w.deferred, []);
  assert.equal(w.pending, null); assert.deepEqual(w.flags, {});
  assert.equal(resident(w, 'xiaoman').survival, 52);
  assert.equal(relation(w, 'linyi', 'xiaoman'), 52);
  assert.equal(relation(w, 'ahe', 'xiaoman'), 0);
  assert.deepEqual(w, JSON.parse(JSON.stringify(w)));
});

check('首日无卡，过一天推进到第2天出现鱼干', () => {
  const w = createCardWorld();
  assert.equal(nextCard(w), null);
  const result = passDay(w);
  assert.equal(result.ok, true); assert.equal(w.day, 2);
  assert.ok(result.card); assert.equal(result.card.id, 'fish-dry');
  assert.equal(result.card.speaker, 'linyi'); assert.equal(result.card.name, '林姨');
  assert.equal(result.card.options.length, 2); assert.match(result.card.text, /鱼干/);
  assert.equal(w.pending, 'fish-dry');
});

check('鱼干选A留意：怀疑小满、关系降、氛围升、次卡是小白', () => {
  const w = createCardWorld(); passDay(w);
  const result = choose(w, 0);
  assert.equal(result.ok, true); assert.ok(result.say);
  assert.equal(w.flags.fishSuspect, true);
  assert.equal(relation(w, 'linyi', 'xiaoman'), 47);
  assert.equal(w.atmosphere, 62); // 过一天 61 → +3 → 再回归一天
  assert.ok(w.records.some(r => r.text.includes('小满在墙角躲了一下')));
  assert.equal(w.day, 3);
  assert.equal(w.flags['played:fish-dry'], true);
  assert.equal(result.card.id, 'ahe-cat'); assert.equal(result.card.name, '阿禾');
});

check('鱼干选B野猫：氛围降、关系升、阿禾文案提到野猫', () => {
  const w = createCardWorld(); passDay(w);
  const result = choose(w, 1);
  assert.equal(w.flags.fishBlamedCat, true);
  assert.equal(relation(w, 'linyi', 'xiaoman'), 54);
  assert.equal(w.atmosphere, 57);
  assert.match(result.card.text, /野猫/);
});

check('搁置鱼干：两天后小满尚可则不了了之', () => {
  const w = createCardWorld(); passDay(w);
  defer(w);
  assert.equal(w.deferred.length, 1); // 尚未到 resolveDay
  assert.equal(w.day, 3);
  const result = passDay(w); // day 4，触发 resolve
  assert.equal(w.flags.fishResolved, true);
  assert.ok(w.records.some(r => r.text.includes('林姨摆摆手')));
  assert.equal(result.card.id, 'ahe-cat');
});

check('搁置鱼干：小满困顿时东窗事发', () => {
  const w = createCardWorld(); w.residents.find(r => r.id === 'xiaoman').survival = 30; passDay(w);
  defer(w); passDay(w);
  assert.equal(w.flags.fishResolved, undefined);
  assert.ok(w.records.some(r => r.text.includes('被撞了个正着')));
  assert.ok(relation(w, 'linyi', 'xiaoman') < 50);
});

check('小白留食物回猫、劝慰更慌', () => {
  const w = createCardWorld(); passDay(w); choose(w, 0);
  const ahe = resident(w, 'ahe'); const mood = ahe.mood;
  choose(w, 0);
  assert.equal(w.flags.catHome, true);
  assert.equal(ahe.mood, mood + 10);
  assert.ok(w.records.some(r => r.text.includes('小白真的回来了')));

  const v = createCardWorld(); passDay(v); choose(v, 1);
  const vAhe = resident(v, 'ahe');
  choose(v, 1);
  assert.equal(vAhe.mood, 66 - 8);
});

check('小满坦白：无前置默认开场，坦白与隐瞒各有得失', () => {
  const w = playedSetup();
  const card = nextCard(w);
  assert.equal(card.id, 'xiaoman-confess'); assert.match(card.text, /压在我心里/);
  const rel = relation(w, 'linyi', 'xiaoman'); const surv = resident(w, 'xiaoman').survival;
  w.pending = card.id;
  choose(w, 0);
  assert.equal(w.flags.confessed, true);
  assert.equal(relation(w, 'linyi', 'xiaoman'), rel - 6);
  assert.equal(resident(w, 'xiaoman').survival, surv + 6); // +8 再扣一天漂移 -2
  assert.ok(w.records.some(r => r.text.includes('塞了一袋米')));

  const v = playedSetup(); const vSurv = resident(v, 'xiaoman').survival; const vRel = relation(v, 'linyi', 'xiaoman');
  v.pending = nextCard(v).id;
  choose(v, 1);
  assert.equal(v.flags.keptSecret, true);
  assert.equal(resident(v, 'xiaoman').survival, vSurv + 6);
  assert.equal(relation(v, 'linyi', 'xiaoman'), vRel + 3);
  assert.ok(v.records.some(r => r.text.includes('秘密像块石头')));
});

check('小满坦白开场随前置而变', () => {
  assert.match(nextCard(playedSetup()).text, /压在我心里/);
  const suspect = playedSetup(); suspect.flags.fishSuspect = true;
  assert.match(nextCard(suspect).text, /鱼干是我拿的/);
  const blamed = playedSetup(); blamed.flags.fishBlamedCat = true;
  assert.match(nextCard(blamed).text, /更不敢开口/);
});

check('搁置小满心事：心情足够则自行坦白', () => {
  const w = playedSetup(); resident(w, 'xiaoman').mood = 70;
  w.pending = 'xiaoman-confess';
  defer(w); passDay(w); passDay(w);
  assert.ok(w.records.some(r => r.text.includes('自己去找林姨坦白')));

  const v = playedSetup(); resident(v, 'xiaoman').mood = 40;
  v.pending = 'xiaoman-confess';
  defer(v); passDay(v); passDay(v);
  assert.ok(v.records.some(r => r.text.includes('又咽了回去')));
});

check('无卡时持续过日、漂移与氛围回归、记录封顶', () => {
  const w = playedSetup();
  w.flags['played:xiaoman-confess'] = true;
  const xm = resident(w, 'xiaoman'), ly = resident(w, 'linyi');
  const xm0 = xm.survival, ly0 = ly.survival;
  for (let i = 0; i < 20; i++) { assert.equal(passDay(w).card, null); }
  assert.equal(w.day, 26);
  assert.equal(xm.survival, xm0 - 20 * 2);
  assert.equal(ly.survival, ly0 - 20);
  assert.ok(Math.abs(w.atmosphere - 55) <= 20);
  assert.ok(w.records.length <= 40);
});

check('非法选择与空待处理不变', () => {
  const w = createCardWorld(); passDay(w);
  unchanged(w, () => choose(w, 5));
  unchanged(w, () => choose(w, -1));
  const empty = playedSetup();
  unchanged(empty, () => choose(empty, 0));
  unchanged(empty, () => defer(empty));
});

check('序列化重载继续确定性', () => {
  const w = createCardWorld(); passDay(w); choose(w, 0);
  const restored = JSON.parse(JSON.stringify(w));
  assert.deepEqual(nextCard(w), nextCard(restored));
  assert.deepEqual(choose(w, 1), choose(restored, 1));
  assert.deepEqual(w, restored);
});

check('控制器：新档首日平静，过一天出鱼干并可点选', () => {
  clearSave();
  const game = createCardGame();
  assert.equal(game.snapshot.day, 1);
  assert(game.hotspots.some(h => h.id === 'pass'));
  tap(game, 'pass');
  assert.equal(game.view.phase, 'result');
  assert.equal(game.snapshot.day, 2);
  assert.equal(game.snapshot.pending, 'fish-dry');
  assert(game.hotspots.some(h => h.id === 'continue'));
  tap(game, 'continue');
  assert.equal(game.view.phase, 'card');
  assert(game.hotspots.some(h => h.id === 'opt:0'));
  assert(game.hotspots.some(h => h.id === 'opt:1'));
  assert(game.hotspots.some(h => h.id === 'defer'));
  tap(game, 'opt:0');
  assert.equal(game.view.phase, 'result');
  assert.equal(game.snapshot.flags.fishSuspect, true);
  assert.equal(game.snapshot.pending, 'ahe-cat');
});

check('控制器：搁置、纪事、刷新恢复存档', () => {
  clearSave();
  const game = createCardGame();
  tap(game, 'pass'); tap(game, 'continue'); tap(game, 'defer');
  assert.equal(game.snapshot.deferred.length, 1);
  assert.equal(game.snapshot.flags['played:fish-dry'], true);
  tap(game, 'continue');
  tap(game, 'journal');
  assert.equal(game.view.journal, true);
  assert(game.hotspots.some(h => h.id === 'close'));
  tap(game, 'close');
  assert.equal(game.view.journal, false);
  global.__hide();
  const copy = createCardGame();
  assert.deepEqual(copy.snapshot, game.snapshot);
  assert.deepEqual(copy.hotspots.map(h => h.id).sort(), game.hotspots.map(h => h.id).sort());
  global.__show();
});

check('控制器：渲染覆盖平静、卡牌、结果、纪事四态不抛错', () => {
  clearSave();
  const g1 = createCardGame();
  g1.frame();
  tap(g1, 'journal'); g1.frame(); tap(g1, 'close'); g1.frame();
  tap(g1, 'pass'); g1.frame();
  assert(g1.hotspots.some(h => h.id === 'continue'));
  tap(g1, 'continue'); g1.frame();
  assert(g1.hotspots.some(h => h.id === 'opt:0'));
});

console.log(`card-check: ${checks} checks passed`);
