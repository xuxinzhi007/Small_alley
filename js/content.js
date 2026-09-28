import { openDb } from './sql.js';

const SPROUT_MS = 30 * 60 * 1000;
const BLOOM_MS = 3 * 60 * 60 * 1000;

function gardenStage(at, now) {
  if (!at) return 'empty';
  const elapsed = now - at;
  if (elapsed >= BLOOM_MS) return 'bloom';
  if (elapsed >= SPROUT_MS) return 'sprout';
  return 'seed';
}

export function periodName(clock) {
  const hour = Math.floor((clock || 420) / 60);
  if (hour < 9) return '清晨';
  if (hour < 12) return '上午';
  if (hour < 14) return '午后';
  if (hour < 17) return '下午';
  if (hour < 19) return '黄昏';
  return '夜里';
}

export function clockText(mins) {
  const value = mins || 420;
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${hour}:${minute < 10 ? '0' : ''}${minute}`;
}

export const PLACES = [
  { id: 'balcony', name: '公园', next: 'square', zone: 'out', npc: '', mx: 0.5, my: 0.08, blurb: '小路绕着一块草坪。花坛里还空着一角土。' },
  { id: 'bookshop', name: '书店', next: 'cafe', zone: 'out', npc: '', mx: 0.18, my: 0.26, blurb: '门口的推车上堆着书。纸味一直漫到台阶。' },
  { id: 'square', name: '广场', next: 'cafe', zone: 'out', npc: '', mx: 0.5, my: 0.26, blurb: '喷泉边有人在休息。鸽子停在石砖上。' },
  { id: 'neighbor', name: '公交站', next: 'metro', zone: 'out', npc: '', mx: 0.82, my: 0.26, blurb: '站牌上的下一班还有几分钟。凳子是凉的。' },
  { id: 'cafe', name: '咖啡馆', next: 'bookshop', zone: 'out', npc: '店主', mx: 0.18, my: 0.44, blurb: '玻璃门上贴着今日咖啡。店主在吧台后面。' },
  { id: 'street', name: '小区', next: 'square', zone: 'out', npc: '', mx: 0.5, my: 0.44, blurb: '楼下的路刚扫过。健身器材那边有人在遛弯。' },
  { id: 'metro', name: '地铁站', next: 'office', zone: 'out', npc: '', mx: 0.82, my: 0.44, blurb: '闸机响了一声。出站的人比进站的多。' },
  { id: 'super', name: '超市', next: 'square', zone: 'out', npc: '', mx: 0.18, my: 0.62, blurb: '推车堆在入口。冷藏柜的灯白得很。' },
  { id: 'room', name: '便利店', next: 'street', zone: 'out', npc: '', mx: 0.5, my: 0.62, blurb: '冷柜的灯比街上亮。关东煮还在冒气。' },
  { id: 'office', name: '单位', next: 'metro', zone: 'out', npc: '', mx: 0.82, my: 0.62, blurb: '大堂的沙发很软。她说只坐一会儿。' },
  { id: 'market', name: '菜市场', next: 'street', zone: 'out', npc: '', mx: 0.18, my: 0.82, blurb: '菜叶子上还有水。有人在称一把葱。' },
  { id: 'door', name: '楼道', next: 'street', zone: 'home', npc: '林阿姨', mx: 0.5, my: 0.82, blurb: '声控灯亮了一下。对门林阿姨的门缝里有电视声。' },
  { id: 'bed', name: '家', next: 'door', zone: 'home', npc: '', mx: 0.82, my: 0.82, blurb: '屋里的灯还开着。雯宝在玄关换鞋。' },
];

export const ROADS = [
  ['bed', 'door'],
  ['door', 'street'],
  ['street', 'room'],
  ['street', 'market'],
  ['street', 'square'],
  ['street', 'neighbor'],
  ['square', 'balcony'],
  ['square', 'bookshop'],
  ['square', 'cafe'],
  ['square', 'super'],
  ['neighbor', 'metro'],
  ['metro', 'office'],
];

function weatherFor(seed) {
  let hash = 0;
  const text = String(seed);
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return ['sunny', 'breezy', 'rainy'][hash % 3];
}

function dayKey(date) {
  const now = date || new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

const CARD_ROWS = [
  ['wake', 'her', 'start', 'bed', 1, 0, 2, '', '被子外面有一点光。她睁开眼，先看向你这边。', '再躺一会儿', '早晨被拉长了一小段。', 'home', '', '', 0, 0, '', '', 1, '', '把窗帘拉开', '光进来了。她在等你说今天去哪。', 'out', '', '', 0, 0, '', '', 1, ''],
  ['plan', 'place', 'start', 'door', 1, 0, 0, '', '光已经进来了。她没有自己往外走。', '去街上', '门开了，风进来。', 'out', '', '', 0, 0, 'pace', 'out', 0, '', '留在家里', '鞋子又放了回去。', 'home', '', '', 0, 0, 'pace', 'home', 1, ''],
  ['linger', 'pause', 'start', 'rug', 1, 0, 0, '', '这件事告一段落。她看着你，等你说还要不要继续。', '再遇见一件', '她又跟着你走了一步。', 'keep', '', '', 0, 0, '', '', 1, '', '今天就到这里', '你们把这一天收住了。', 'night', '', '', 0, 0, '', '', 1, ''],
  ['night', 'night', 'night', 'bed', 1, 0, 0, '', '天暗下来。她的手停在灯绳上。', '留一盏小灯', '夜里还有一盏灯。', 'end', '', '', 0, 0, 'light', 'on', 1, '', '把灯关掉', '黑暗很完整。', 'end', '', '', 0, 0, 'light', 'off', 1, ''],
  ['window', 'her', 'home', 'window', 2, 0, 1, 'rain', '雨贴在玻璃上。她没有开灯，只是站着。', '一起听雨', '雨声把话都变得很轻。', 'home', '', '', 0, 0, '', '', 1, '', '撑伞出门', '伞撑开，雨留在肩膀外面。', 'out', '', '', 0, 0, '', '', 0, ''],
  ['snack', 'find', 'home', 'snack', 2, 0, 2, '', '点心的香味漫出来。她看了你一眼。', '分给她', '她把大的那半推过来。', 'home', '', '', 0, 0, 'snack', 'eaten', 1, '', '放进背包', '她把点心包好，说想吃再拿。', 'home', 'snack', '', 0, 0, 'snack', 'bag', 0, ''],
  ['music', 'her', 'home', 'rug', 1, 0, 3, '', '唱片转到一半。她坐在地毯上，没有催。', '听完这一面', '这首歌被听完了，房间还留着尾巴。', 'home', '', '', 0, 0, '', '', 1, '', '出门换空气', '唱针抬起来，你们去找外面的声音。', 'out', '', '', 0, 0, '', '', 0, ''],
  ['shelf', 'memory', 'home', 'shelf', 2, 0, 2, 'memento', '她蹲在架子前，手指停在你们带回来的东西上。', '讲给她听', '每一样都被重新讲了一遍。', 'home', '', '', 0, 0, '', '', 2, '', '带她出门', '她看了一眼，还是跟你往外走。', 'out', '', '', 0, 0, '', '', 1, ''],
  ['pot', 'place', 'home', 'garden', 1, 0, 4, '', '她想把花盆挪到更晒的地方。那里风会大一些。', '按她说的挪', '叶子马上就亮了。', 'home', '', '', 0, 0, 'pot', 'sun', 1, '', '去外面看看', '花盆没动。你们出门看别人的花。', 'out', '', '', 0, 0, 'pot', 'stay', 0, ''],
  ['balcony', 'place', 'home', 'garden', 3, 0, 1, 'soil', '阳台上的土还空着。', '现在种下去', '种子埋好了。你不在的时候，它也会长。', 'home', '', '', 0, -1, '', '', 1, 'plant', '先去街上', '土先空着，你们往外走。', 'out', '', '', 0, 0, '', '', 0, ''],
  ['eat', 'find', 'home', 'snack', 3, 0, 1, 'item:snack', '背包里还有点心。她已经闻到了。', '现在吃掉', '碎屑落在她手心。', 'home', '', 'snack', 0, 0, '', '', 1, '', '再留一会儿', '纸包被她按了按，放回背包。', 'home', '', '', 0, 0, '', '', 0, ''],
  ['kettle', 'her', 'home', 'snack', 2, 0, 1, '', '水壶响了。她先把你的杯子转过来。', '等它再开一点', '水汽糊住了窗子。你们谁都没说话。', 'home', '', '', 0, 0, '', '', 1, '', '倒两杯', '杯子挨在一起，热气是一样的。', 'home', '', '', 0, 0, '', '', 1, ''],
  ['laundry', 'place', 'home', 'window', 2, 0, 1, '', '阳台绳子上晾着昨天的衣服，风把袖子吹起来。', '帮她收下来', '衣服还带着外面的温度，叠好了。', 'home', '', '', 0, 0, '', '', 1, '', '再晾一会儿', '她说风还没吹够，袖子又扬起来。', 'home', '', '', 0, 0, '', '', 0, ''],
  ['book', 'her', 'home', 'shelf', 2, 0, 1, '', '她把书摊开，指尖停在同一行上很久。', '念给她听', '那一行被读出声，房间忽然很近。', 'home', '', '', 0, 0, '', '', 1, '', '让她自己看', '她又把那一行看了一遍，没有催你。', 'home', '', '', 0, 0, '', '', 1, ''],
  ['photo', 'memory', 'home', 'rug', 2, 0, 1, '', '地毯上躺着一张拍立得，还没干透。', '写上一句', '背面多了一句很短的话，夹进架子。', 'home', '', '', 0, 0, 'photo', 'written', 1, '', '先晾着', '照片还在变清楚。她蹲着看。', 'home', '', '', 0, 0, '', '', 0, ''],
  ['yawn', 'her', 'home', 'bed', 1, 0, 1, '', '她打了个哈欠，又装作没有。', '让她靠一会儿', '她的额头抵着你的肩，呼吸慢下来。', 'home', '', '', 0, 0, '', '', 2, '', '拉她起来', '哈欠被她咽回去，眼睛还是湿的。', 'out', '', '', 0, 0, '', '', 0, ''],
  ['fridge', 'find', 'home', 'snack', 1, 0, 1, '', '冰箱门开着一条缝，里面的光漏到地板上。', '看看有什么', '剩了半盒草莓。她把大的那颗推过来。', 'home', '', '', 0, 0, '', '', 1, '', '先关上', '灯灭了，厨房又暗回去。', 'home', '', '', 0, 0, '', '', 0, ''],
  ['crosswalk', 'place', 'out', 'fountain', 2, 0, 1, '', '绿灯还没亮。她的手在口袋外面停着。', '牵一下', '手是热的。绿灯亮了，你们才走。', 'out', '', '', 0, 0, '', '', 1, '', '等她自己走', '她先迈出去，又回头确认你在。', 'out', '', '', 0, 0, '', '', 0, ''],
  ['bakery', 'find', 'out', 'cafe', 2, 0, 1, '', '面包店刚出炉，纸袋还烫手。', '买一个带走', '袋子被她抱在胸口，一路都是热的。', 'home', 'snack', '', -2, 0, '', '', 1, '', '只闻一下', '香味留在衣领上。你们没买。', 'out', '', '', 0, 0, '', '', 0, ''],
  ['bookstore', 'place', 'out', 'shelf', 2, 0, 1, '', '书店很静。她抽出一本，封面朝向你。', '一起看目录', '你们在同一页停住，谁都没出声。', 'out', '', '', 0, 0, '', '', 1, '', '去门口坐', '店里的光留在身后，台阶是凉的。', 'out', '', '', 0, 0, '', '', 1, ''],
  ['market', 'place', 'out', 'flower', 2, 0, 1, '', '菜摊上的叶子还带着水。她问你晚上想吃什么。', '让她挑', '她挑了最小的那把，说够两个人。', 'home', '', '', -1, 0, '', '', 1, '', '今天不买', '叶子上的水滴回去。你们空着手走。', 'out', '', '', 0, 0, '', '', 0, ''],
  ['bus', 'place', 'out', 'bench', 1, 0, 1, '', '公交还有三分钟。站牌的影子盖住她的鞋。', '坐这一班', '车窗起雾，她用手指画了一小块。', 'out', '', '', 0, 0, '', '', 1, '', '走路回去', '站牌被甩在后面，路变得很长。', 'home', '', '', 0, 0, '', '', 1, ''],
  ['sunset', 'her', 'out', 'window', 2, 0, 1, '', '天色开始往下掉。她站住，没有说要回家。', '再看一会儿', '最后一点光停在她头发上。', 'home', '', '', 0, 0, '', '', 2, '', '现在回去', '路灯比太阳先亮。门在前面。', 'home', '', '', 0, 0, '', '', 1, ''],
  ['street', 'place', 'out', 'fountain', 1, 0, 1, '', '街上的声音一下子多起来。她走在你旁边。', '继续往前', '你们没有挑一家店，只是把这条路走完。', 'out', '', '', 0, 0, '', '', 0, '', '回家', '门在身后带上，屋里安静了。', 'home', '', '', 0, 0, '', '', 1, ''],
  ['cafe', 'place', 'out', 'cafe', 2, 0, 2, '', '门铃响了一下。店里有牛奶的味道。', '点一杯牛奶', '杯子被她捂在手心。', 'home', 'milk', '', -3, 0, '', '', 1, '', '只坐一会儿', '位子还是那个位子，你们没有点单。', 'out', '', '', 0, 0, '', '', 1, ''],
  ['lamp', 'memory', 'home', 'window', 2, 1, 0, 'warm', '你不在的晚上，她还是把靠窗的灯留着。', '在灯下坐一会儿', '灯没有白留。', 'home', '', '', 0, 0, '', '', 2, '', '说晚安', '灯灭了，窗子里只剩一点余温。', 'night', '', '', 0, 0, '', '', 1, ''],
];

const CARD_COLS = ['id', 'type', 'tag', 'art', 'weight', 'once', 'cooldown', 'need', 'text', 'l_label', 'l_say', 'l_pull', 'l_item', 'l_drop', 'l_coins', 'l_seeds', 'l_flag', 'l_flag_v', 'l_warmth', 'l_garden', 'r_label', 'r_say', 'r_pull', 'r_item', 'r_drop', 'r_coins', 'r_seeds', 'r_flag', 'r_flag_v', 'r_warmth', 'r_garden'];

const EVENT_ROWS = [
  ['boat', 'event', 'out', 'fountain', 3, '', '喷泉边停着一只小纸船，上面写着：愿今天也好。', '带回背包', '纸船被她吹干，夹进背包。', 'home', 'boat', '纸船', '', 0, 0, 'boat', 'keep', 1, '让它继续漂', '她把纸船推回水里，没有再去捞。', 'out', '', '', '', 0, 0, 'boat', 'float', 0, '我们没去喷泉。那只纸船不知漂去了哪。'],
  ['badge', 'event', 'out', 'bench', 2, '', '长椅上有一枚没人认领的徽章。', '先替他收着', '徽章进了背包。她说，遇到主人就还。', 'home', 'badge', '徽章', '', 0, 0, 'badge', 'keep', 0, '挂到留言板', '风一吹，徽章会响。她退后看了看。', 'out', '', '', '', 0, 0, 'badge', 'return', 1, '长椅上的徽章，我们今天没看见。'],
  ['pastry', 'event', 'out', 'cafe', 2, '', '吧台多出一块没人要的点心。店主摆了摆手。', '收下', '她把纸包放进背包。', 'home', 'snack', '店里的点心', '', 0, 0, '', '', 1, '留给下一位', '她对看不见的下一位点了点头。', 'out', '', '', '', 0, 0, '', '', 0, '咖啡店那块点心，一直留到了打烊。'],
  ['box', 'event', 'home', 'door', 2, '', '门口多了一盒点心，没有名字，只写着「分你的」。', '拿进来', '她闻了闻，说是甜的，放进背包。', 'home', 'box', '无名的盒子', '', 0, 0, '', '', 1, '留一张谢谢', '很短的一句谢谢压在盒盖上。', 'home', '', '', '', 0, 0, '', '', 1, '门口的盒子在天黑前被收走了。'],
  ['stall', 'find', 'out', 'flower', 2, '', '花摊要收了。老板手里还有一包种子。', '买下来', '种子进了背包。她已经在想那块空土。', 'home', '', '', '', -2, 1, '', '', 0, '帮忙收摊', '绳子勒过指节。老板多给了几枚硬币。', 'out', '', '', '', 3, 0, '', '', 1, '花摊收得很干净，我们没赶上。'],
  ['aunt', 'event', 'home', 'door', 3, '', '对门的林阿姨探出头，塑料袋里是橘子。', '收下', '橘子进了口袋。雯宝说林阿姨人很好。', 'home', 'orange', '橘子', '', 0, 0, 'aunt', 'kind', 1, '下次再来', '林阿姨把袋子收回去，笑了一下。', 'home', '', '', '', 0, 0, 'aunt', 'later', 1, '林阿姨今天在家，我们没敲门。'],
  ['owner', 'event', 'out', 'cafe', 2, '', '店主把你们常坐的位子留着，杯子已经温过。', '坐下来', '热气贴着手心。店主没再多问。', 'out', '', '', '', -2, 0, '', '', 1, '只打个招呼', '店主挥了挥手，位子还留着。', 'out', '', '', '', 0, 0, '', '', 1, '店主把位子留到打烊，我们没进去。'],
];

const EVENT_COLS = ['id', 'type', 'tag', 'art', 'weight', 'need', 'text', 'l_label', 'l_say', 'l_pull', 'l_item', 'l_item_name', 'l_drop', 'l_coins', 'l_seeds', 'l_flag', 'l_flag_v', 'l_warmth', 'r_label', 'r_say', 'r_pull', 'r_item', 'r_item_name', 'r_drop', 'r_coins', 'r_seeds', 'r_flag', 'r_flag_v', 'r_warmth', 'missed'];

function insertRow(db, tableName, columns, values) {
  db.run(`insert into ${tableName} (${columns.join(',')}) values (${columns.map(() => '?').join(',')})`, values);
}

export function openLife() {
  const db = openDb();
  CARD_ROWS.forEach((row) => {
    if (!db.get('select id from cards where id=?', [row[0]])) insertRow(db, 'cards', CARD_COLS, row);
  });
  EVENT_ROWS.forEach((row) => {
    if (!db.get('select id from events where id=?', [row[0]])) insertRow(db, 'events', EVENT_COLS, row);
  });
  db.run('update cards set cooldown=? where id=?', [1, 'eat']);
  if (!db.get('select id from player where id=?', [1])) {
    db.run(
      'insert into player (id,day,weather,beats,pull,phase,coins,seeds,garden_at,warmth,outings,offered_stop,current_id,current_kind,saved_at,onboarded) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [1, 1, 'sunny', 0, 'home', 'play', 8, 2, 0, 0, 0, 0, '', '', 0, 0],
    );
  }
  const who = db.get('select * from player where id=?', [1]);
  if (who && (who.clock === undefined || who.clock === null)) {
    db.run('update player set clock=?, place=?, spirit=?, culture=?, neighbor=? where id=1', [(7 + (who.beats || 0)) * 60, 'bed', 8, 0, 0]);
  }
  const playing = db.get('select * from player where id=?', [1]);
  if (playing && playing.phase === 'play' && !db.get('select event_id from day_events where day=? and event_id=?', [playing.day, 'aunt'])) {
    db.run('insert into day_events (day,event_id,status) values (?,?,?)', [playing.day, 'aunt', 'pending']);
  }
  if (!db.get('select id from body where id=?', [1])) {
    db.run('insert into body (id,name,confirmed) values (?,?,?)', [1, '', 0]);
    writeBody(db, rolled(Math.random() < 0.5 ? '女' : '男'));
  } else if (db.get('select confirmed from body where id=?', [1]).confirmed == null) {
    db.run('update body set confirmed=? where id=1', [0]);
  }
  [
    ['wenbao', '雯宝', 'npc', 'bed', '女'],
    ['auntie', '林阿姨', 'npc', 'door', '女'],
    ['barista', '店主', 'npc', 'cafe', ''],
  ].forEach((row) => {
    if (!db.get('select id from people where id=?', [row[0]])) {
      db.run('insert into people (id,name,kind,place,sex) values (?,?,?,?,?)', row);
    }
  });
  knowPlace(db, 'bed');
  if (playing && playing.place) knowPlace(db, playing.place);
  if (playing && !db.get('select k from flags where k=?', ['errand'])) {
    db.run('insert into flags (k,v,day) values (?,?,?)', ['errand', 'market', playing.day || 1]);
  }
  return db;
}

function player(db) {
  return db.get('select * from player where id=?', [1]);
}

function knowPlace(db, id) {
  if (!id) return false;
  const key = `where:${id}`;
  if (db.get('select k from flags where k=?', [key])) return false;
  const who = player(db);
  db.run('insert into flags (k,v,day) values (?,?,?)', [key, 'seen', who ? who.day : 1]);
  return true;
}

export function placeVisibility(db) {
  const known = { bed: true };
  db.all('select k from flags').forEach((row) => {
    if (row.k && row.k.indexOf('where:') === 0) known[row.k.slice(6)] = true;
  });
  const visible = {};
  Object.keys(known).forEach((id) => { visible[id] = 'seen'; });
  ROADS.forEach((pair) => {
    if (known[pair[0]] && !known[pair[1]]) visible[pair[1]] = 'near';
    if (known[pair[1]] && !known[pair[0]]) visible[pair[0]] = 'near';
  });
  return visible;
}

function clamp100(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function shiftBody(db, minutes, meal) {
  const row = db.get('select * from body where id=?', [1]);
  if (!row) return;
  const hour = minutes / 60;
  let hunger = row.hunger + hour * 6;
  let thirst = row.thirst + hour * 8;
  let clean = row.clean - hour * 2;
  let sleep = row.sleep + hour * 5;
  let stamina = row.stamina - hour * 4;
  if (meal === 'eat') hunger -= 28;
  if (meal === 'drink') thirst -= 22;
  db.run('update body set hunger=?, thirst=?, clean=?, sleep=?, stamina=? where id=1', [
    clamp100(hunger), clamp100(thirst), clamp100(clean), clamp100(sleep), clamp100(stamina),
  ]);
}

const GIVEN_NAMES = ['阿宁', '小山', '迟迟', '南风', '木木', '晚晚', '江澄', '予安'];
const SIGHTS = ['0.6', '0.8', '1.0', '1.2', '1.5'];

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function rolled(sex) {
  const female = sex !== '男';
  const height = female ? randInt(152, 172) : randInt(168, 186);
  const bmi = 18 + Math.random() * 6;
  const weight = Math.round((bmi * height * height) / 10000);
  return {
    name: GIVEN_NAMES[randInt(0, GIVEN_NAMES.length - 1)],
    age: randInt(18, 32),
    sex: female ? '女' : '男',
    birthday: `${randInt(1, 12)}月${randInt(1, 28)}日`,
    height,
    weight,
    sight: SIGHTS[randInt(0, SIGHTS.length - 1)],
    temp: Math.round((36.2 + Math.random() * 0.8) * 10) / 10,
    health: randInt(76, 98),
    stamina: randInt(60, 92),
    hunger: randInt(8, 36),
    thirst: randInt(8, 34),
    clean: randInt(70, 98),
    sleep: randInt(4, 28),
    confirmed: 0,
  };
}

function writeBody(db, profile) {
  db.run(
    'update body set name=?, age=?, sex=?, birthday=?, height=?, weight=?, sight=?, temp=?, health=?, stamina=?, hunger=?, thirst=?, clean=?, sleep=?, confirmed=? where id=1',
    [profile.name, profile.age, profile.sex, profile.birthday, profile.height, profile.weight, profile.sight, profile.temp, profile.health, profile.stamina, profile.hunger, profile.thirst, profile.clean, profile.sleep, profile.confirmed ? 1 : 0],
  );
}

export function adjustSelf(db, action, text) {
  const row = db.get('select * from body where id=?', [1]);
  if (!row) return;
  if (action === 'roll') {
    const next = rolled(Math.random() < 0.5 ? '女' : '男');
    next.confirmed = row.confirmed ? 1 : 0;
    writeBody(db, next);
    return;
  }
  if (action === 'start') {
    db.run('update body set confirmed=? where id=1', [1]);
    return;
  }
  if (action === 'name') {
    const value = text ? String(text).trim().slice(0, 8) : '';
    if (value) db.run('update body set name=? where id=1', [value]);
    else {
      const index = GIVEN_NAMES.indexOf(row.name);
      db.run('update body set name=? where id=1', [GIVEN_NAMES[(index + 1) % GIVEN_NAMES.length]]);
    }
    return;
  }
  if (action === 'sex') {
    const sex = row.sex === '男' ? '女' : '男';
    const sample = rolled(sex);
    db.run('update body set sex=?, height=?, weight=? where id=1', [sex, sample.height, sample.weight]);
    return;
  }
  if (action === 'sight-up' || action === 'sight-down') {
    const index = SIGHTS.indexOf(String(row.sight));
    const step = action === 'sight-up' ? 1 : SIGHTS.length - 1;
    db.run('update body set sight=? where id=1', [SIGHTS[(index + step) % SIGHTS.length]]);
    return;
  }
  const matched = /^(age|height|weight|temp|health|stamina|hunger|thirst|clean|sleep)-(up|down)$/.exec(action);
  if (action.indexOf('birthday-') === 0) {
    const read = /^(\d+)月(\d+)日$/.exec(row.birthday || '');
    let month = read ? Number(read[1]) : 6;
    let day = read ? Number(read[2]) : 1;
    const days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (action === 'birthday-month-up') month = month >= 12 ? 1 : month + 1;
    if (action === 'birthday-month-down') month = month <= 1 ? 12 : month - 1;
    if (action === 'birthday-day-up') day += 1;
    if (action === 'birthday-day-down') day -= 1;
    if (day > days[month]) day = days[month];
    if (day < 1) day = days[month];
    db.run('update body set birthday=? where id=1', [`${month}月${day}日`]);
    return;
  }
  if (!matched) return;
  const key = matched[1];
  const dir = matched[2] === 'up' ? 1 : -1;
  const limits = {
    age: [16, 60],
    height: [145, 200],
    weight: [40, 120],
    temp: [35.5, 38],
    health: [1, 100],
    stamina: [0, 100],
    hunger: [0, 100],
    thirst: [0, 100],
    clean: [0, 100],
    sleep: [0, 100],
  };
  let next = Number(row[key]) + (key === 'temp' ? dir * 0.1 : dir);
  if (key === 'temp') next = Math.round(next * 10) / 10;
  next = Math.max(limits[key][0], Math.min(limits[key][1], next));
  db.run(`update body set ${key}=? where id=1`, [next]);
}

function seenDay(db, id) {
  const row = db.get('select day from seen where card_id=?', [id]);
  return row ? row.day : 0;
}

function eligibleCard(db, card, who, now) {
  if (!card || card.tag === 'start' || card.tag === 'night' || card.type === 'pause') return false;
  const at = seenDay(db, card.id);
  if (at && card.once) return false;
  if (at && who.day < at + (card.cooldown || 0)) return false;
  if (card.need === 'rain' && who.weather !== 'rainy') return false;
  if (card.need === 'warm' && who.warmth < 4) return false;
  if (card.need === 'memento' && !db.all('select * from inventory').some((item) => item.qty > 0)) return false;
  if (card.need === 'soil') {
    const stage = gardenStage(who.garden_at, now);
    if (stage === 'empty' && who.seeds <= 0) return false;
  }
  if (card.need && card.need.indexOf('item:') === 0) {
    const item = db.get('select qty from inventory where item_id=?', [card.need.slice(5)]);
    if (!item || item.qty < 1) return false;
  }
  return true;
}

function pickWeighted(rows) {
  const total = rows.reduce((sum, row) => sum + (row.weight || 1), 0);
  let roll = Math.random() * total;
  for (let i = 0; i < rows.length; i += 1) {
    roll -= rows[i].weight || 1;
    if (roll <= 0) return rows[i];
  }
  return rows[rows.length - 1];
}

function sideOf(row, prefix) {
  return {
    label: row[`${prefix}_label`],
    say: row[`${prefix}_say`],
    pull: row[`${prefix}_pull`],
    item: row[`${prefix}_item`] || '',
    itemName: row[`${prefix}_item_name`] || '',
    drop: row[`${prefix}_drop`] || '',
    coins: row[`${prefix}_coins`] || 0,
    seeds: row[`${prefix}_seeds`] || 0,
    flag: row[`${prefix}_flag`] || '',
    flagValue: row[`${prefix}_flag_v`] || '',
    warmth: row[`${prefix}_warmth`] || 0,
    garden: row[`${prefix}_garden`] || '',
  };
}

function faceFrom(row, who, now, eventId) {
  const face = {
    id: row.id,
    type: row.type,
    text: row.text,
    eventId: eventId || '',
    left: sideOf(row, 'l'),
    right: sideOf(row, 'r'),
  };
  if (row.id !== 'balcony') return face;
  const stage = gardenStage(who.garden_at, now);
  if (stage === 'bloom') {
    face.text = '阳台那盆花开了，比昨天更高一点。';
    face.left = { label: '收回背包', say: '花被她放进背包。土里还留着下一颗种子。', pull: 'home', item: 'flower', itemName: '阳台的花', drop: '', coins: 0, seeds: 1, flag: '', flagValue: '', warmth: 1, garden: 'harvest' };
    face.right = { label: '让它再站一会儿', say: '花还在风里。她说明天再看。', pull: 'home', item: '', itemName: '', drop: '', coins: 0, seeds: 0, flag: '', flagValue: '', warmth: 1, garden: '' };
  } else if (stage === 'sprout' || stage === 'seed') {
    face.text = stage === 'sprout' ? '土里冒出两片叶子，还站不稳。' : '种子还埋着。表面已经湿过一轮。';
    face.left = { label: '浇一点水', say: '水渗进去，她蹲着看到土变暗。', pull: 'home', item: '', itemName: '', drop: '', coins: 0, seeds: 0, flag: '', flagValue: '', warmth: 0, garden: 'water' };
    face.right = { label: '先去别处', say: '她把浇水壶放回原处。', pull: 'out', item: '', itemName: '', drop: '', coins: 0, seeds: 0, flag: '', flagValue: '', warmth: 0, garden: '' };
  } else {
    face.text = '阳台的土是空的。背包里还有种子。';
    face.left = { label: '现在种下去', say: '种子埋好了。你不在的时候，它也会长。', pull: 'home', item: '', itemName: '', drop: '', coins: 0, seeds: -1, flag: '', flagValue: '', warmth: 1, garden: 'plant' };
    face.right = { label: '先去街上', say: '土先空着，你们往外走。', pull: 'out', item: '', itemName: '', drop: '', coins: 0, seeds: 0, flag: '', flagValue: '', warmth: 0, garden: '' };
  }
  return face;
}

function presentId(db, id, kind, now) {
  const who = player(db);
  if (kind === 'event') {
    const row = db.get('select * from events where id=?', [id]);
    if (!row) return null;
    const face = faceFrom(row, who, now, row.id);
    face.left.itemName = row.l_item_name || '';
    face.right.itemName = row.r_item_name || '';
    return face;
  }
  const row = db.get('select * from cards where id=?', [id]);
  if (!row) return null;
  return faceFrom(row, who, now, '');
}

export function touchLife(db, now) {
  db.run('update player set saved_at=? where id=1', [now]);
}

export function ensureToday(db, now) {
  const who = player(db);
  const hours = who.saved_at ? (now - who.saved_at) / 3600000 : 0;
  if (hours >= 0.35 && who.current_kind !== 'letter' && who.phase !== 'play') {
    db.run('update player set current_kind=?, current_id=? where id=1', ['letter', 'letter']);
    return presentLetter(db);
  }
  if (who.current_kind === 'letter') return presentLetter(db);
  if (who.current_kind === 'page') return presentPage(db);
  if (who.current_id === 'here' && who.phase === 'play') return hereCard(db, who, now);
  if (who.current_id && who.phase === 'play') return presentId(db, who.current_id, who.current_kind || 'card', now);
  return beginDay(db, now);
}

function presentLetter(db) {
  const who = player(db);
  const stage = gardenStage(who.garden_at, Date.now());
  let title = '门口的风';
  let copy = '我在门口站了一会儿。今天遇到的事，我都替你记着。';
  let gift = '一张小画';
  if (stage === 'bloom' || stage === 'sprout') {
    title = '阳台';
    copy = '你不在的时候，土里的东西自己长了一截。我去看过，没动它。';
    gift = '';
  } else if (db.get('select v from flags where k=?', ['boat']) && db.get('select v from flags where k=?', ['boat']).v === 'float') {
    title = '水还在走';
    copy = '我又去了喷泉。那只纸船换了块石头，还浮着。';
    gift = '';
  }
  return {
    id: 'letter',
    type: 'letter',
    text: copy,
    title,
    gift,
    eventId: '',
    left: { label: '把信收好', say: gift ? `她把${gift}放进背包。` : '信被她夹进小记。', pull: 'resume', item: gift ? 'gift' : '', itemName: gift, drop: '', coins: 0, seeds: 0, flag: '', flagValue: '', warmth: 0, garden: '' },
    right: { label: '读给她听', say: '她听完，把信纸折得很小。', pull: 'resume', item: gift ? 'gift' : '', itemName: gift, drop: '', coins: 0, seeds: 0, flag: '', flagValue: '', warmth: 1, garden: '' },
  };
}

function presentPage(db) {
  const who = player(db);
  const lines = db.all('select body from log where day=?', [who.day]).map((row) => row.body);
  const missed = [];
  db.all('select event_id, status from day_events where day=?', [who.day]).forEach((row) => {
    if (row.status !== 'pending' && row.status !== 'missed') return;
    const event = db.get('select missed from events where id=?', [row.event_id]);
    if (event && event.missed) missed.push(event.missed);
  });
  const next = {
    label: '开始第二天',
    say: '',
    pull: 'next',
    item: '',
    itemName: '',
    drop: '',
    coins: 0,
    seeds: 0,
    flag: '',
    flagValue: '',
    warmth: 0,
    garden: '',
  };
  return {
    id: 'page',
    type: 'page',
    title: `第 ${who.day} 天`,
    lines,
    missed,
    text: lines.length ? `今天记下了 ${lines.length} 件事。` : '这一天大多时候只是待在一起。',
    eventId: '',
    left: next,
    right: next,
  };
}

function rollEvents(db, who) {
  db.run('delete from day_events where day=?', [who.day]);
  const pool = db.all('select * from events').filter((row) => !row.need || row.need === who.weather);
  const aunt = pool.filter((row) => row.id === 'aunt')[0];
  const copy = pool.filter((row) => row.id !== 'aunt');
  const picked = [];
  if (aunt) picked.push(aunt);
  while (picked.length < 3 && copy.length) {
    const index = Math.floor(Math.random() * copy.length);
    picked.push(copy.splice(index, 1)[0]);
  }
  picked.forEach((row) => {
    db.run('insert into day_events (day,event_id,status) values (?,?,?)', [who.day, row.id, 'pending']);
  });
}

export function beginDay(db, now) {
  const who = player(db);
  const weather = weatherFor(`${dayKey(new Date(now))}-${who.day}`);
  db.run('update player set weather=?, beats=?, pull=?, phase=?, outings=?, offered_stop=?, current_id=?, current_kind=?, clock=?, place=?, spirit=? where id=1', [weather, 0, 'home', 'play', 0, 0, 'wake', 'card', 7 * 60, 'bed', 8]);
  knowPlace(db, 'bed');
  const body = db.get('select sleep,stamina from body where id=?', [1]);
  if (body) db.run('update body set sleep=?, stamina=? where id=1', [Math.min(body.sleep, 20), Math.max(body.stamina, 72)]);
  db.run('delete from log where day=?', [who.day]);
  rollEvents(db, Object.assign({}, who, { weather }));
  const errands = ['market', 'office', 'balcony', 'cafe', 'bookshop'];
  const errand = errands[(who.day - 1) % errands.length];
  const oldErrand = db.get('select k from flags where k=?', ['errand']);
  if (oldErrand) db.run('update flags set v=?, day=? where k=?', [errand, who.day, 'errand']);
  else db.run('insert into flags (k,v,day) values (?,?,?)', ['errand', errand, who.day]);
  const wake = db.get('select * from cards where id=?', ['wake']);
  const at = seenDay(db, 'wake');
  if (!at || who.day >= at + (wake.cooldown || 0)) return presentId(db, 'wake', 'card', now);
  db.run('update player set current_id=?, current_kind=? where id=1', ['plan', 'card']);
  return presentId(db, 'plan', 'card', now);
}

function remember(db, card) {
  const who = player(db);
  const old = db.get('select card_id from seen where card_id=?', [card.id]);
  if (old) db.run('update seen set day=? where card_id=?', [who.day, card.id]);
  else db.run('insert into seen (card_id,day) values (?,?)', [card.id, who.day]);
}

const ITEM_NAMES = { snack: '点心', milk: '热牛奶', boat: '纸船', badge: '徽章', box: '无名的盒子', flower: '阳台的花', gift: '一张小画', orange: '橘子' };

function giveItem(db, id, name) {
  const label = name || ITEM_NAMES[id] || id;
  if (!id || !label) return;
  const row = db.get('select qty from inventory where item_id=?', [id]);
  if (row) db.run('update inventory set qty=? where item_id=?', [row.qty + 1, id]);
  else db.run('insert into inventory (item_id,name,qty) values (?,?,?)', [id, label, 1]);
}

function takeItem(db, id) {
  if (!id) return;
  const row = db.get('select qty from inventory where item_id=?', [id]);
  if (!row) return;
  if (row.qty <= 1) db.run('delete from inventory where item_id=?', [id]);
  else db.run('update inventory set qty=? where item_id=?', [row.qty - 1, id]);
}

function applySide(db, card, side, now) {
  const who = player(db);
  if (side.coins < 0 && who.coins + side.coins < 0) return { ok: false, say: '硬币还不够。' };
  if (side.seeds < 0 && who.seeds + side.seeds < 0) return { ok: false, say: '背包里没有种子。' };
  if (side.item) giveItem(db, side.item, side.itemName || ITEM_NAMES[side.item] || side.item);
  if (side.drop) takeItem(db, side.drop);
  if (side.flag) {
    const old = db.get('select k from flags where k=?', [side.flag]);
    if (old) db.run('update flags set v=?, day=? where k=?', [side.flagValue, who.day, side.flag]);
    else db.run('insert into flags (k,v,day) values (?,?,?)', [side.flag, side.flagValue, who.day]);
  }
  let gardenAt = who.garden_at;
  if (side.garden === 'plant') gardenAt = now;
  if (side.garden === 'water' && gardenAt) gardenAt -= 10 * 60 * 1000;
  if (side.garden === 'harvest') gardenAt = 0;
  const pull = side.pull === 'keep' ? who.pull : side.pull;
  const outings = who.outings + (pull === 'out' ? 1 : 0);
  const beats = card.type === 'pause' || card.type === 'letter' || card.type === 'page' ? who.beats : who.beats + 1;
  const place = side.moveTo || who.place || 'bed';
  let clock = who.clock == null ? 7 * 60 : who.clock;
  if (card.type !== 'pause' && card.type !== 'letter' && card.type !== 'page' && card.type !== 'night') clock += side.moveTo ? 15 : 60;
  if (clock > 23 * 60) clock = 23 * 60;
  let spirit = who.spirit == null ? 8 : who.spirit;
  spirit += side.spirit || 0;
  if (pull === 'out') spirit -= 1;
  if (spirit < 0) spirit = 0;
  if (spirit > 8) spirit = 8;
  let culture = (who.culture || 0) + (side.culture || 0);
  if (card.id === 'bookstore' || card.id === 'book' || card.id === 'owner') culture += 1;
  let neighbor = (who.neighbor || 0) + (side.neighbor || 0);
  if (card.id === 'aunt') neighbor += 1;
  if (neighbor > 9) neighbor = 9;
  db.run(
    'update player set coins=?, seeds=?, warmth=?, garden_at=?, pull=?, outings=?, beats=?, clock=?, place=?, spirit=?, culture=?, neighbor=? where id=1',
    [who.coins + (side.coins || 0), who.seeds + (side.seeds || 0), who.warmth + (side.warmth || 0), gardenAt, pull === 'end' || pull === 'night' || pull === 'resume' || pull === 'rest' || pull === 'next' ? who.pull : pull, outings, beats, clock, place, spirit, culture, neighbor],
  );
  if (card.eventId) db.run('update day_events set status=? where day=? and event_id=?', ['done', who.day, card.eventId]);
  if (side.say && card.type !== 'page') db.run('insert into log (day,body) values (?,?)', [who.day, side.say]);
  if (card.id !== 'letter' && card.id !== 'page' && card.id !== 'here') remember(db, card);
  if (card.type !== 'pause' && card.type !== 'letter' && card.type !== 'page' && card.type !== 'night') {
    const minutes = side.moveTo ? 15 : 60;
    let meal = '';
    if (side.drop === 'snack') meal = 'eat';
    if (card.id === 'cafe' || card.id === 'owner') meal = 'drink';
    shiftBody(db, minutes, meal);
  }
  knowPlace(db, place);
  return { ok: true, say: side.say, pull: side.pull };
}

export function choose(db, card, sideName, now) {
  const side = sideName < 0 ? card.left : card.right;
  const result = applySide(db, card, side, now);
  if (!result.ok) return result;
  if (card.type === 'letter') {
    db.run('insert into journal (day,title,body,at) values (?,?,?,?)', [player(db).day, card.title, card.text, now]);
    db.run('update player set current_id=?, current_kind=? where id=1', ['', '']);
    const who = player(db);
    if (who.phase === 'play') return { ok: true, say: result.say, next: pickNext(db, now) };
    return { ok: true, say: result.say, next: presentPage(db) };
  }
  if (result.pull === 'rest') {
    db.run('update player set phase=?, current_kind=?, current_id=? where id=1', ['rest', 'page', 'page']);
    return { ok: true, say: '她把今天放好了。', next: presentPage(db) };
  }
  if (result.pull === 'next') {
    const who = player(db);
    db.run('update player set day=?, phase=? where id=1', [who.day + 1, 'play']);
    return { ok: true, say: '', next: beginDay(db, now) };
  }
  if (result.pull === 'end' || card.type === 'night') {
    closeDay(db, now);
    return { ok: true, say: result.say, next: presentPage(db) };
  }
  if (result.pull === 'night') {
    db.run('update player set current_id=?, current_kind=? where id=1', ['night', 'card']);
    return { ok: true, say: result.say, next: presentId(db, 'night', 'card', now) };
  }
  const next = pickNext(db, now);
  return { ok: true, say: result.say, next };
}

function closeDay(db, now) {
  const who = player(db);
  const pace = who.outings > 0 ? 'out' : 'home';
  const old = db.get('select k from flags where k=?', ['pace']);
  if (old) db.run('update flags set v=?, day=? where k=?', [pace, who.day, 'pace']);
  else db.run('insert into flags (k,v,day) values (?,?,?)', ['pace', pace, who.day]);
  const lines = db.all('select body from log where day=?', [who.day]).map((row) => row.body);
  db.all('select event_id from day_events where day=? and status=?', [who.day, 'pending']).forEach((row) => {
    const event = db.get('select missed from events where id=?', [row.event_id]);
    if (event) lines.push(event.missed);
    db.run('update day_events set status=? where day=? and event_id=?', ['missed', who.day, row.event_id]);
  });
  db.run('insert into journal (day,title,body,at) values (?,?,?,?)', [who.day, `第 ${who.day} 天`, lines.join('\n') || '这一天大多时候只是待在一起。', now]);
  db.run('update player set phase=?, current_kind=?, current_id=? where id=1', ['evening', 'page', 'page']);
}

function pickNext(db, now) {
  const who = player(db);
  const clock = who.clock == null ? 7 * 60 : who.clock;
  if (clock >= 22 * 60) {
    db.run('update player set current_id=?, current_kind=? where id=1', ['night', 'card']);
    return presentId(db, 'night', 'card', now);
  }
  if (clock >= 20 * 60 && !who.offered_stop) {
    db.run('update player set offered_stop=?, current_id=?, current_kind=? where id=1', [1, 'linger', 'card']);
    return presentId(db, 'linger', 'card', now);
  }
  return presentHere(db, now);
}

function placeById(id) {
  for (let i = 0; i < PLACES.length; i += 1) {
    if (PLACES[i].id === id) return PLACES[i];
  }
  return PLACES[0];
}

function neighborsOf(id) {
  const list = [];
  ROADS.forEach((pair) => {
    if (pair[0] === id) list.push(pair[1]);
    if (pair[1] === id) list.push(pair[0]);
  });
  return list;
}

function route(from, to) {
  if (from === to) return [from];
  const queue = [[from]];
  const seen = {};
  seen[from] = true;
  while (queue.length) {
    const path = queue.shift();
    const nexts = neighborsOf(path[path.length - 1]);
    for (let i = 0; i < nexts.length; i += 1) {
      const id = nexts[i];
      if (seen[id]) continue;
      const grown = path.concat([id]);
      if (id === to) return grown;
      seen[id] = true;
      queue.push(grown);
    }
  }
  return null;
}

function walkPhrase(minutes) {
  if (minutes <= 15) return '走了一小段。';
  if (minutes <= 30) return '走了大约半小时。';
  if (minutes <= 45) return '一路走了快一个小时。';
  return '这一路走了很久。';
}

function blankSide(partial) {
  return Object.assign({
    label: '', say: '', pull: 'home', item: '', itemName: '', drop: '', coins: 0, seeds: 0,
    flag: '', flagValue: '', warmth: 0, garden: '', culture: 0, spirit: 0, neighbor: 0, moveTo: '',
  }, partial);
}

function rowFits(row, placeId) {
  if (!row) return false;
  if (placeId === 'door') return row.id === 'aunt' || row.id === 'box';
  if (placeId === 'neighbor') return row.id === 'bus' || row.id === 'crosswalk' || row.id === 'badge';
  if (placeId === 'cafe') return row.art === 'cafe' || row.id === 'pastry' || row.id === 'owner' || row.id === 'bakery';
  if (placeId === 'street') return row.id === 'street' || row.id === 'boat' || row.id === 'sunset';
  if (placeId === 'market') return row.id === 'market' || row.id === 'stall';
  if (placeId === 'bookshop') return row.id === 'bookstore' || row.id === 'book';
  if (placeId === 'balcony') return row.id === 'balcony' || row.id === 'pot' || row.art === 'garden';
  if (placeId === 'bed') return row.id === 'yawn' || row.id === 'lamp' || row.id === 'kettle' || row.id === 'music' || row.id === 'shelf' || row.id === 'snack' || row.id === 'fridge' || row.id === 'photo' || row.id === 'window' || row.id === 'eat';
  return false;
}

function holding(db, id) {
  const row = db.get('select qty from inventory where item_id=?', [id]);
  return !!(row && row.qty > 0);
}

function hereCard(db, who, now) {
  const place = placeById(who.place || 'bed');
  const next = placeById(place.next);
  let text = place.blurb;
  let left = blankSide({ label: '在这儿坐一会儿', say: '她把靠垫拍松，你们谁都没说话。', pull: 'home', warmth: 1 });
  if (place.id === 'bed') left = blankSide({ label: '再靠一会儿', say: '她的额头抵过来，呼吸慢了。', pull: 'home', warmth: 1, spirit: 2 });
  if (place.id === 'balcony') {
    const stage = gardenStage(who.garden_at, now);
    if (stage === 'bloom') {
      text = '花开了。收回来可以带到菜市场卖掉，也可以再留一会儿。';
      left = blankSide({ label: '把花收回来', say: '花被她放进口袋。花坛空出来，还能再种。', pull: 'home', item: 'flower', itemName: '公园的花', warmth: 1, garden: 'harvest', seeds: 1 });
    } else if (stage === 'sprout' || stage === 'seed') {
      text = stage === 'sprout' ? '芽已经顶出土。浇一点，开得更快。' : '种子刚埋下。浇一点水，土会记住。';
      left = blankSide({ label: '浇一点水', say: '水渗进花坛，她蹲着看土变暗。', pull: 'home', garden: 'water', warmth: 1 });
    } else if (who.seeds > 0) {
      text = '花坛空着，口袋里有种子。种下去之后，你离开它也会长。';
      left = blankSide({ label: '种进花坛', say: '种子埋进公园的土里。过一会儿再来看。', pull: 'home', garden: 'plant', seeds: -1, warmth: 1 });
    } else {
      text = '花坛还空着。种子在菜市场，两枚硬币一包。';
      left = blankSide({ label: '沿小路走一圈', say: '草坪上的影子慢慢变长。花坛还在等种子。', pull: 'out', warmth: 1 });
    }
  }
  if (place.id === 'door') left = blankSide({ label: '跟林阿姨说话', say: '林阿姨拉着你们说了很久的楼下。', pull: 'home', culture: 1, neighbor: 1, warmth: 1 });
  if (place.id === 'room' && who.coins >= 2) left = blankSide({ label: '买一盒关东煮', say: '盒子是烫的。她把它放进口袋。', pull: 'out', item: 'snack', itemName: '关东煮', coins: -2, warmth: 1 });
  if (place.id === 'room' && who.coins < 2) left = blankSide({ label: '只看看货架', say: '冷气扑在脸上。你们什么也没拿。', pull: 'out' });
  if (place.id === 'cafe' && who.coins >= 2) left = blankSide({ label: '坐下来喝一杯', say: '店主把常坐的位子擦了一下。', pull: 'out', coins: -2, warmth: 1 });
  if (place.id === 'cafe' && who.coins < 2) left = blankSide({ label: '靠窗站着', say: '店主看了你们一眼，没有催。', pull: 'out', warmth: 1 });
  if (place.id === 'bookshop') left = blankSide({ label: '抽出一本书', say: '那一页被她折了个很小的角。', pull: 'out', culture: 1, warmth: 1 });
  if (place.id === 'street') left = blankSide({ label: '在楼下站一会儿', say: '有人牵着狗过去。雯宝让到路边。', pull: 'out', warmth: 1 });
  if (place.id === 'neighbor') left = blankSide({ label: '等下一班', say: '车来了又走了。你们谁都没上车。', pull: 'out', warmth: 1 });
  if (place.id === 'square') left = blankSide({ label: '在喷泉边坐下', say: '石砖是温的。她把包放在膝盖上。', pull: 'out', warmth: 1 });
  if (place.id === 'market' && holding(db, 'flower')) {
    text = '摊主看见那朵花，说可以换成硬币。';
    left = blankSide({ label: '把花卖掉', say: '摊主把花收进桶里，硬币落进你口袋。', pull: 'out', drop: 'flower', coins: 3, warmth: 1 });
  } else if (place.id === 'market' && who.coins >= 2 && who.seeds < 4) {
    text = '种子摊还开着。两枚硬币一包，拿去公园就能种。';
    left = blankSide({ label: '买一包种子', say: '纸包很小。她说公园的土还空着。', pull: 'out', coins: -2, seeds: 1, warmth: 1 });
  } else if (place.id === 'market') {
    left = blankSide({ label: '看看今天的菜', say: '她挑了一把最小的葱，说够两个人。', pull: 'out', coins: who.coins >= 1 ? -1 : 0, warmth: 1 });
  }
  if (place.id === 'metro') left = blankSide({ label: '看一眼时刻', say: '下一班还有两分钟。你们没进闸机。', pull: 'out' });
  if (place.id === 'office') {
    text = '前台还亮着。做一上午，能领到硬币，人会累一点。';
    left = blankSide({ label: '做一上午', say: '工位上的灯亮到中午。硬币被她放进你口袋。', pull: 'out', coins: 4, spirit: -1 });
  }
  if (place.id === 'super' && who.coins >= 3) left = blankSide({ label: '买一点晚饭', say: '袋子沉了沉。她说晚上不用再出门。', pull: 'out', item: 'snack', itemName: '晚饭', coins: -3, warmth: 1 });
  if (place.id === 'super' && who.coins < 3) left = blankSide({ label: '只推着车看', say: '货架尽头的灯很白。你们空手出来。', pull: 'out' });
  const towardHome = route(place.id, 'bed');
  const stepHome = towardHome && towardHome.length > 1 ? placeById(towardHome[1]) : null;
  let right = blankSide({ label: `去${next.name}`, say: `顺着路到了${next.name}。`, pull: next.zone === 'out' ? 'out' : 'home', moveTo: next.id });
  const spirit = who.spirit == null ? 8 : who.spirit;
  if (spirit <= 1 && place.id !== 'bed' && stepHome) {
    const arrived = stepHome.id === 'bed';
    right = blankSide({
      label: arrived ? '进家门' : '往家的方向走',
      say: arrived ? '门开了，鞋放回玄关。' : `先到了${stepHome.name}。家还在前面。`,
      pull: stepHome.zone === 'out' ? 'out' : 'home',
      moveTo: stepHome.id,
      spirit: arrived ? 2 : 0,
    });
  }
  return {
    id: 'here',
    type: 'place',
    text,
    npc: place.npc || '',
    eventId: '',
    left,
    right,
  };
}

function presentHere(db, now) {
  const who = player(db);
  const placeId = who.place || 'bed';
  const pending = db.all('select event_id from day_events where day=? and status=?', [who.day, 'pending'])
    .map((row) => db.get('select * from events where id=?', [row.event_id]))
    .filter((row) => rowFits(row, placeId));
  if (pending.length) {
    const event = pending[0];
    db.run('update player set current_id=?, current_kind=? where id=1', [event.id, 'event']);
    return presentId(db, event.id, 'event', now);
  }
  const pool = db.all('select * from cards').filter((card) => eligibleCard(db, card, who, now) && rowFits(card, placeId));
  if (pool.length && Math.random() < 0.4) {
    const card = pickWeighted(pool);
    db.run('update player set current_id=?, current_kind=? where id=1', [card.id, 'card']);
    return presentId(db, card.id, 'card', now);
  }
  db.run('update player set current_id=?, current_kind=? where id=1', ['here', 'here']);
  return hereCard(db, who, now);
}

export function travelTo(db, placeId, now) {
  let place = null;
  for (let i = 0; i < PLACES.length; i += 1) {
    if (PLACES[i].id === placeId) place = PLACES[i];
  }
  const who = player(db);
  const from = who.place || 'bed';
  if (!place || place.id === from) return { say: '', next: null };
  const path = route(from, place.id);
  if (!path || path.length < 2) return { say: '', next: null };
  const minutes = (path.length - 1) * 15;
  const clock = Math.min(23 * 60, (who.clock == null ? 7 * 60 : who.clock) + minutes);
  const pull = place.zone === 'out' ? 'out' : 'home';
  db.run('update player set place=?, clock=?, pull=?, beats=? where id=1', [place.id, clock, pull, (who.beats || 0) + 1]);
  const first = knowPlace(db, place.id);
  shiftBody(db, minutes, '');
  const extra = first ? claimFind(db, place) : place.blurb;
  db.run('insert into log (day,body) values (?,?)', [who.day, `到了${place.name}。`]);
  return { say: `${place.name}。${walkPhrase(minutes)}${extra}`, next: pickNext(db, now) };
}

function claimFind(db, place) {
  const finds = {
    market: { seeds: 1, line: '摊主塞过来一包种子。' },
    office: { coins: 2, line: '前台把两枚硬币推过来。' },
    bookshop: { culture: 1, line: '店员把一页折页放进你手里。' },
    cafe: { warmth: 1, line: '店主说今天的位子给你留着。' },
    balcony: { seeds: 1, line: '花坛边掉着一颗种子。' },
    square: { coins: 1, line: '喷泉边上有一枚硬币。' },
    super: { coins: 1, line: '购物车里卡着一张找零。' },
    door: { neighbor: 1, line: '林阿姨已经把你当成对门的人。' },
    street: { coins: 1, line: '路边的长椅上有一枚硬币。' },
    room: { warmth: 1, line: '店员说关东煮还热着。' },
    neighbor: { neighbor: 1, line: '站牌下有人跟你们点了下头。' },
    metro: { coins: 1, line: '出站口的地上有一枚硬币。' },
  };
  const find = finds[place.id];
  if (!find) return '第一次走到这儿。';
  const who = player(db);
  db.run('update player set coins=?, seeds=?, warmth=?, culture=?, neighbor=? where id=1', [
    who.coins + (find.coins || 0),
    who.seeds + (find.seeds || 0),
    (who.warmth || 0) + (find.warmth || 0),
    (who.culture || 0) + (find.culture || 0),
    Math.min(9, (who.neighbor || 0) + (find.neighbor || 0)),
  ]);
  return find.line;
}

function lifeHint(db, who) {
  const stage = gardenStage(who.garden_at, Date.now());
  if (stage === 'bloom') return '公园的花开了';
  if (stage === 'sprout') return '公园的芽出来了';
  if (stage === 'seed') return '公园的种子还在长';
  const errand = db.get('select v from flags where k=?', ['errand']);
  const names = {
    market: '今天去菜市场买种子',
    office: '今天去单位领硬币',
    balcony: '今天去公园看看花坛',
    cafe: '今天咖啡馆有位子',
    bookshop: '今天书店有新的一页',
  };
  if (errand && names[errand.v]) return names[errand.v];
  return '';
}

export function snapshotLife(db, card) {
  const who = player(db);
  const items = db.all('select * from inventory').filter((item) => item.qty > 0);
  return {
    day: who.day,
    phase: who.phase,
    coins: who.coins,
    seeds: who.seeds,
    weather: who.weather,
    warmth: who.warmth || 0,
    beats: who.beats,
    clock: who.clock == null ? 7 * 60 : who.clock,
    place: who.place || 'bed',
    spirit: who.spirit == null ? 8 : who.spirit,
    culture: who.culture || 0,
    neighbor: who.neighbor || 0,
    card: card ? card.id : '',
    type: card ? card.type : '',
    moments: db.all('select body from log where day=?', [who.day]).map((row) => row.body),
    pocket: items.map((item) => ({ name: item.name, qty: item.qty })),
    seen: placeVisibility(db),
    person: db.get('select * from body where id=?', [1]),
    creating: !(db.get('select confirmed from body where id=?', [1]) || {}).confirmed,
    company: db.all('select * from people').filter((one) => one.place === (who.place || 'bed')).map((one) => one.name),
    events: db.all('select event_id from day_events where day=? and status=?', [who.day, 'pending']).map((row) => row.event_id),
    journal: db.all('select id from journal').length,
    hint: lifeHint(db, who),
  };
}
