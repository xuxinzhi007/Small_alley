import { createGame } from '../js/game.js';
import { openLife } from '../js/content.js';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function frames(game, count) {
  let now = 1000;
  for (let i = 0; i < count; i += 1) {
    now += 16;
    game.frame(now);
  }
}

function tapId(game, id) {
  const spot = game.hotspots.filter((item) => item.id === id)[0];
  if (!spot) throw new Error(`找不到 ${id}：${game.hotspots.map((item) => item.id).join(',')}`);
  global.__down({ touches: [{ clientX: spot.x + 8, clientY: spot.y + 8 }] });
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const db = openLife();
assert(db.all('select id from cards').length >= 10, '卡牌应该写在本地库里');
const game = createGame();
await wait(30);
frames(game, 2);
assert(game.snapshot.ready, '没有准备好');
if (game.snapshot.creating) {
  frames(game, 1);
  tapId(game, 'edit-start');
  frames(game, 2);
}
assert(!game.snapshot.creating, '开始之后不应该还停在建档页');
assert(game.snapshot.card === 'wake', `第一张应是她醒来，现在是 ${game.snapshot.card}`);
assert(game.snapshot.type === 'her', '第一张应是人物卡');
assert(game.snapshot.events.length >= 3, `每天应有邻居和两件偶然的事，现在是 ${game.snapshot.events.join(',')}`);
assert(game.snapshot.place === 'bed', `早晨应该在卧室，现在是 ${game.snapshot.place}`);
assert(typeof game.snapshot.coins === 'number', '硬币应该显示出来');
frames(game, 1);
tapId(game, 'choice-left');
frames(game, 20);
assert(game.snapshot.type === 'trace', `滑完应先看见刚才发生的事，现在是 ${game.snapshot.type}`);
assert(game.snapshot.beats <= 2, `清晨不该一下跳走，现在是第 ${game.snapshot.beats} 拍`);
let guard = 0;
while (game.snapshot.type !== 'page' && guard < 48) {
  guard += 1;
  const before = `${game.snapshot.card}:${game.snapshot.type}`;
  frames(game, 1);
  tapId(game, 'choice-left');
  frames(game, 20);
  if (`${game.snapshot.card}:${game.snapshot.type}` === before) {
    tapId(game, 'choice-right');
    frames(game, 20);
  }
}
assert(game.snapshot.type === 'page', `滑完一天应收到这一页，现在是 ${game.snapshot.type} / ${game.snapshot.card}`);
assert(game.snapshot.journal >= 1, '这一页应该进了本地库');
assert((game.snapshot.moments || []).length >= 6, `一天里记下的事太少：${(game.snapshot.moments || []).length}`);
const finished = game.snapshot.day;
frames(game, 1);
tapId(game, 'day-next');
frames(game, 4);
assert(game.snapshot.day === finished + 1, `开始第二天后应是第 ${finished + 1} 天，现在是第 ${game.snapshot.day} 天`);
assert(game.snapshot.type !== 'page', `第二天应该重新开始，现在还是 ${game.snapshot.type}`);
console.log('play-check ok', JSON.stringify({ card: game.snapshot.card, day: game.snapshot.day, moments: (game.snapshot.moments || []).length, journal: game.snapshot.journal }));
