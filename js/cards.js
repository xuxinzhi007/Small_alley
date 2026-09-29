export const CARD_SAVE_KEY = 'little-lane-cards-v1';

const clamp = (n, a, b) => Math.max(a, Math.min(b, Number(n) || 0));
const relKey = (a, b) => [a, b].sort().join(':');
const flag = (w, key) => Boolean(w.flags[key]);
const setFlag = (w, key) => { w.flags[key] = true; };
const played = (w, id) => flag(w, 'played:' + id);
const alive = (w, id) => Boolean(resident(w, id));

export function resident(world, id) {
  return world.residents.find(r => r.id === id);
}

export function relation(world, a, b) {
  return world.relations[relKey(a, b)] || 0;
}

export function relationPairs(world) {
  const ids = world.residents.map(r => r.id);
  const pairs = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    pairs.push({ a: ids[i], b: ids[j], value: relation(world, ids[i], ids[j]) });
  }
  return pairs;
}

function record(world, text) {
  world.records.push({ day: world.day, text });
  if (world.records.length > 40) world.records.splice(0, world.records.length - 40);
}

function changeAtmosphere(world, delta) { world.atmosphere = clamp(world.atmosphere + delta, 0, 100); }
function changeRelation(world, a, b, delta) {
  const key = relKey(a, b);
  world.relations[key] = clamp((world.relations[key] || 0) + delta, -100, 100);
}
function changeSurvival(world, id, delta) { const r = resident(world, id); if (r) r.survival = clamp(r.survival + delta, 0, 100); }
function changeMood(world, id, delta) { const r = resident(world, id); if (r) r.mood = clamp(r.mood + delta, 0, 100); }

export function createCardWorld() {
  return {
    version: 1,
    day: 1,
    atmosphere: 62,
    residents: [
      { id: 'xiaoman', name: '小满', survival: 52, mood: 55 },
      { id: 'linyi', name: '林姨', survival: 76, mood: 70 },
      { id: 'ahe', name: '阿禾', survival: 66, mood: 66 },
    ],
    relations: { 'linyi:xiaoman': 52 },
    flags: {},
    deferred: [],
    records: [{ day: 1, text: '你成了小巷的命运之手，看不见，却处处在场。' }],
    pending: null,
  };
}

const CARDS = [
  {
    id: 'fish-dry', title: '少了的鱼干', speaker: 'linyi', deferInDays: 2,
    when: w => w.day >= 2 && !played(w, 'fish-dry') && alive(w, 'linyi') && alive(w, 'xiaoman'),
    text: () => '晾在巷口的鱼干少了一条。我一早上数了两遍，不会错。谁手这么快？',
    options: [
      {
        label: '帮你留意看看',
        say: '你应了下来，说会帮忙留意。',
        apply(w) {
          setFlag(w, 'fishSuspect');
          changeRelation(w, 'linyi', 'xiaoman', -5);
          changeAtmosphere(w, 3);
          record(w, '你留意到小满在墙角躲了一下，眼神有点躲闪。');
        },
      },
      {
        label: '兴许是野猫叼走了',
        say: '林姨点点头，说巷子里的野猫是不少。',
        apply(w) {
          setFlag(w, 'fishBlamedCat');
          changeRelation(w, 'linyi', 'xiaoman', 2);
          changeAtmosphere(w, -4);
          record(w, '一句“野猫叼的”，把巷子里的猜疑按了下去。');
        },
      },
    ],
    resolve(w) {
      if (resident(w, 'xiaoman').survival < 40) {
        changeRelation(w, 'linyi', 'xiaoman', -8);
        changeAtmosphere(w, -6);
        record(w, '小满又去林姨家门口转悠，被撞了个正着。鱼干的事还是没过去。');
      } else {
        setFlag(w, 'fishResolved');
        record(w, '林姨摆摆手，说算了，一条鱼干而已，不想为这个伤了邻里和气。');
      }
    },
  },
  {
    id: 'ahe-cat', title: '小白不见了', speaker: 'ahe', deferInDays: 1,
    when: w => w.day >= 3 && !played(w, 'ahe-cat') && alive(w, 'ahe'),
    text: w => flag(w, 'fishBlamedCat')
      ? '小白两天没回家了。你们都说巷子里野猫多，我更慌了。'
      : '小白两天没回家了。以前它最多半天就回来，我有点慌。',
    options: [
      {
        label: '在巷口留点吃的',
        say: '你在巷口放了一小碗吃的。',
        apply(w) {
          setFlag(w, 'catHome');
          changeMood(w, 'ahe', 10);
          changeAtmosphere(w, 4);
          record(w, '第二天清晨，小白真的回来了，蹲在巷口，吃得吧嗒吧嗒响。');
        },
      },
      {
        label: '劝她别太担心',
        say: '阿禾勉强笑了笑，眼睛还是往巷口望。',
        apply(w) {
          changeMood(w, 'ahe', -8);
          changeAtmosphere(w, -2);
          record(w, '一句“猫会自己回来”，没让阿禾安心多少。');
        },
      },
    ],
    resolve(w) {
      if (resident(w, 'ahe').mood >= 55) {
        changeMood(w, 'ahe', 5);
        record(w, '阿禾自己在巷口一声声唤，竟真把小白唤了回来。');
      } else {
        changeMood(w, 'ahe', -5);
        record(w, '小白还是没回来。阿禾在门口坐到深夜，谁也没去打扰。');
      }
    },
  },
  {
    id: 'xiaoman-confess', title: '小满的心事', speaker: 'xiaoman', deferInDays: 2,
    when: w => w.day >= 6 && !played(w, 'xiaoman-confess') && alive(w, 'xiaoman') && alive(w, 'linyi'),
    text: w => flag(w, 'fishSuspect')
      ? '那天……林姨的鱼干是我拿的。我饿得实在没办法了。'
      : flag(w, 'fishBlamedCat')
        ? '林姨的鱼干其实是我拿的。你们说是野猫，我更不敢开口了。'
        : '有件事压在我心里好几天了，不知道该不该说。',
    options: [
      {
        label: '去跟林姨坦白吧',
        say: '小满深吸一口气，朝林姨家走去。',
        apply(w) {
          changeRelation(w, 'linyi', 'xiaoman', -6);
          changeAtmosphere(w, 4);
          changeSurvival(w, 'xiaoman', 8);
          changeMood(w, 'xiaoman', 10);
          setFlag(w, 'confessed');
          record(w, '小满去道了歉。林姨骂了他两句，转头却往他怀里塞了一袋米。');
        },
      },
      {
        label: '分你点吃的，先瞒着',
        say: '你悄悄分了小满一些吃的。',
        apply(w) {
          changeSurvival(w, 'xiaoman', 8);
          changeRelation(w, 'linyi', 'xiaoman', 3);
          changeAtmosphere(w, -6);
          setFlag(w, 'keptSecret');
          record(w, '秘密像块石头，压在小巷的呼吸里。');
        },
      },
    ],
    resolve(w) {
      if (resident(w, 'xiaoman').mood >= 60) {
        changeRelation(w, 'linyi', 'xiaoman', -4);
        changeSurvival(w, 'xiaoman', 6);
        changeMood(w, 'xiaoman', 8);
        record(w, '小满自己去找林姨坦白了。林姨叹了口气，也没再提。');
      } else {
        changeMood(w, 'xiaoman', -6);
        record(w, '小满把话又咽了回去，人更蔫了。');
      }
    },
  },
];

export function nextCard(world) {
  const card = CARDS.find(c => c.when(world));
  if (!card) return null;
  return {
    id: card.id,
    title: card.title,
    speaker: card.speaker,
    name: resident(world, card.speaker).name,
    text: typeof card.text === 'function' ? card.text(world) : card.text,
    options: card.options.map(o => ({ label: o.label })),
  };
}

export function advanceDay(world) {
  world.day += 1;
  for (const r of world.residents) {
    r.survival = clamp(r.survival - (r.id === 'xiaoman' ? 2 : 1), 0, 100);
    if (r.survival < 40) r.mood = clamp(r.mood - 2, 0, 100);
  }
  world.atmosphere = Math.round(clamp(world.atmosphere + (55 - world.atmosphere) * 0.2, 0, 100));
  const remaining = [];
  for (const d of world.deferred) {
    if (world.day >= d.resolveDay) {
      const card = CARDS.find(c => c.id === d.id);
      if (card && card.resolve) card.resolve(world);
    } else {
      remaining.push(d);
    }
  }
  world.deferred = remaining;
}

function settle(world) {
  const snapshot = nextCard(world);
  world.pending = snapshot ? snapshot.id : null;
  return snapshot;
}

export function choose(world, optionIndex) {
  const card = CARDS.find(c => c.id === world.pending);
  if (!card) return { ok: false, say: '此刻没有要处理的事。', card: null };
  const option = card.options[optionIndex];
  if (!option) return { ok: false, say: '这个选择不存在。', card: null };
  option.apply(world);
  setFlag(world, 'played:' + card.id);
  advanceDay(world);
  return { ok: true, say: option.say, card: settle(world) };
}

export function defer(world) {
  const card = CARDS.find(c => c.id === world.pending);
  if (!card) return { ok: false, say: '此刻没有要处理的事。', card: null };
  world.deferred.push({ id: card.id, resolveDay: world.day + (card.deferInDays || 2) });
  setFlag(world, 'played:' + card.id);
  record(world, `「${card.title}」被轻轻搁下了，巷子会自己往前走。`);
  advanceDay(world);
  return { ok: true, say: '你先把这件事搁下了。', card: settle(world) };
}

export function passDay(world) {
  advanceDay(world);
  return { ok: true, say: '平静地过了一天。', card: settle(world) };
}
