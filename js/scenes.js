import { placeById, residents, isOpen, actionsAt } from './world.js';

const TOP = 108;
const W = 390;
const H = 350;
const ink = '#624c40';
const wood = '#b58460';
const sage = '#849d79';

function box(c, x, y, w, h, color, r = 5, shadow = false) {
  const radius = Math.min(r, w / 2, h / 2);
  c.save();
  if (shadow) { c.shadowColor = 'rgba(71,49,34,.17)'; c.shadowBlur = 6; c.shadowOffsetY = 3; }
  c.fillStyle = color;
  c.beginPath(); c.moveTo(x + radius, y);
  c.arcTo(x + w, y, x + w, y + h, radius);
  c.arcTo(x + w, y + h, x, y + h, radius);
  c.arcTo(x, y + h, x, y, radius);
  c.arcTo(x, y, x + w, y, radius);
  c.closePath(); c.fill(); c.restore();
}
function oval(c, x, y, rx, ry, color) {
  c.save(); c.translate(x, y); c.scale(rx, ry);
  c.beginPath(); c.arc(0, 0, 1, 0, Math.PI * 2); c.fillStyle = color; c.fill(); c.restore();
}
function line(c, points, color, width = 1) {
  c.beginPath(); c.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(p => c.lineTo(p[0], p[1]));
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}
function shape(c, points, color) {
  c.beginPath(); c.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(p => c.lineTo(p[0], p[1]));
  c.closePath(); c.fillStyle = color; c.fill();
}
function text(c, value, x, y, size = 11, color = ink) {
  c.font = `${size}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = color; c.fillText(value, x, y);
}
function glow(c, x, y, radius) {
  const g = c.createRadialGradient(x, y, 1, x, y, radius);
  g.addColorStop(0, 'rgba(255,221,143,.38)'); g.addColorStop(1, 'rgba(255,220,145,0)');
  oval(c, x, y, radius, radius, g);
}
function steam(c, x, y, now) {
  for (let i = 0; i < 3; i++) {
    const phase = (now / 1800 + i / 3) % 1;
    c.save(); c.globalAlpha *= (1 - phase) * .7;
    c.beginPath(); c.moveTo(x + i * 6, y - phase * 20);
    c.bezierCurveTo(x - 5 + i * 6, y - 7 - phase * 20, x + 8 + i * 6, y - 11 - phase * 20, x + i * 6, y - 17 - phase * 20);
    c.strokeStyle = '#fff9e7'; c.lineWidth = 2; c.stroke(); c.restore();
  }
}
function cup(c, x, y, now) {
  oval(c, x + 7, y + 10, 12, 3, '#eee1ca');
  oval(c, x + 16, y + 3, 5, 5, '#f8f0d8');
  oval(c, x + 16, y + 3, 3, 3, wood);
  box(c, x, y - 3, 13, 13, '#ffefd4', 3);
  oval(c, x + 6.5, y - 2, 6, 2, '#8e6046'); steam(c, x, y - 6, now);
}
function plant(c, x, y, scale = 1, flowers = false) {
  c.save(); c.translate(x, y); c.scale(scale, scale);
  line(c, [[0, 0], [0, -40]], '#698360', 2);
  for (let i = 0; i < 5; i++) {
    const side = i % 2 ? 1 : -1;
    oval(c, side * 8, -13 - i * 6, 10, 5, i % 2 ? '#9dac7d' : '#668a70');
    if (flowers && i > 2) {
      oval(c, side * 9, -17 - i * 6, 7, 6, '#dfb0a0');
      oval(c, side * 9, -17 - i * 6, 2, 2, '#f9df95');
    }
  }
  shape(c, [[-13, -5], [13, -5], [9, 17], [-9, 17]], '#c18a6c');
  box(c, -15, -8, 30, 6, '#d6a180', 2); c.restore();
}
function windowPane(c, x, y, w, h, night, curtains = false) {
  box(c, x - 5, y - 5, w + 10, h + 12, '#bc9774', 4, true);
  box(c, x, y, w, h, night ? '#46566c' : '#bed7d1', 1);
  oval(c, x + w * .7, y + 18, 10, 10, night ? '#f3e7bc' : '#fff1bf');
  shape(c, [[x, y + h], [x, y + h * .67], [x + w * .3, y + h * .48], [x + w * .65, y + h * .8], [x + w, y + h * .56], [x + w, y + h]], night ? '#344c55' : '#91b7a7');
  line(c, [[x + w / 2, y], [x + w / 2, y + h]], '#f8edda', 4);
  line(c, [[x, y + h / 2], [x + w, y + h / 2]], '#f8edda', 3);
  box(c, x - 8, y + h, w + 16, 7, '#f8ecd2', 2);
  if (curtains) {
    line(c, [[x - 12, y - 10], [x + w + 12, y - 10]], ink, 3);
    for (const side of [0, 1]) {
      const edge = x + side * w;
      shape(c, [[edge - 12, y - 8], [edge + 12, y - 8], [edge + (side ? 7 : -7), y + h * .6], [edge + 13, y + h + 6], [edge - 13, y + h + 6]], '#d6a58e');
      line(c, [[edge, y], [edge + (side ? 6 : -6), y + h * .55]], '#bd8974', 2);
      box(c, edge - 8, y + h * .6, 16, 4, '#eacb94', 1);
    }
  }
}
function bench(c, x, y, w = 93) {
  box(c, x + 8, y + 12, 5, 43, ink, 1); box(c, x + w - 13, y + 12, 5, 43, ink, 1);
  for (let i = 0; i < 3; i++) box(c, x, y + i * 9, w, 6, i % 2 ? '#b88761' : '#c79b71', 2, i === 0);
  box(c, x - 3, y + 30, w + 6, 10, '#d0a479', 3, true);
}
function tree(c, x, y, scale = 1) {
  c.save(); c.translate(x, y); c.scale(scale, scale);
  oval(c, 0, 2, 44, 9, 'rgba(63,71,46,.12)');
  shape(c, [[-7, 0], [6, 0], [4, -83], [-4, -87]], '#9b775b');
  line(c, [[0, -42], [-22, -66]], '#9b775b', 5);
  [[-25, -79, 32, 29], [22, -86, 34, 30], [0, -108, 35, 33], [0, -69, 33, 23]].forEach((p, i) => oval(c, ...p, ['#90a67c', '#819b73', '#a8b78b', '#9cae81'][i]));
  for (let i = 0; i < 9; i++) oval(c, Math.sin(i * 3) * 35, -82 + Math.cos(i * 2) * 25, 3, 2, '#c1c99d');
  c.restore();
}
function person(c, x, feet, now, walking, kind = 'player') {
  const colors = { player: '#bc785c', wenbao: '#91a49a', auntie: '#a18aac', barista: '#769490', clerk: '#8ba077' };
  const stride = walking ? Math.sin(now / 100) * 5 : 0;
  oval(c, x, feet + 1, 17, 4, 'rgba(61,45,36,.15)');
  c.save(); c.translate(x, feet + (walking ? -Math.abs(stride) * .35 : Math.sin(now / 1100) * .4));
  line(c, [[-6, -18], [-7 + stride, -3]], '#665c56', 6);
  line(c, [[6, -18], [7 - stride, -3]], '#665c56', 6);
  box(c, -12 + stride, -4, 10, 5, '#554942', 2); box(c, 3 - stride, -4, 10, 5, '#554942', 2);
  shape(c, [[-10, -39], [9, -39], [14, -17], [-14, -17]], colors[kind] || sage);
  line(c, [[-11, -34], [-16 - stride * .6, -22]], '#e7b594', 5);
  line(c, [[11, -34], [16 + stride * .6, -22]], '#e7b594', 5);
  box(c, -3, -44, 6, 9, '#e4b18c', 2);
  oval(c, 0, -49, 13, 14, kind === 'auntie' ? '#776a65' : '#5d493f');
  if (kind === 'wenbao') oval(c, 12, -44, 5, 11, '#5d493f');
  oval(c, 0, -47, 10, 11, '#f0c7a3');
  shape(c, [[-12, -51], [-9, -60], [5, -62], [12, -51], [3, -54], [-3, -50], [-4, -55]], '#5d493f');
  oval(c, -4, -47, 1, 1.4, ink); oval(c, 4, -47, 1, 1.4, ink);
  oval(c, -7, -43, 2.2, 1.4, '#dfaa91'); oval(c, 7, -43, 2.2, 1.4, '#dfaa91');
  line(c, [[-2, -41], [0, -40], [2, -41]], '#ad795f', 1);
  if (kind === 'player') { line(c, [[-7, -37], [8, -18]], '#edd6ae', 3); box(c, 6, -27, 10, 12, '#dbc297', 3, true); }
  if (kind === 'barista' || kind === 'clerk') { box(c, -8, -33, 16, 15, '#eee0bd', 2); box(c, -13, -63, 26, 6, colors[kind], 3); }
  if (kind === 'auntie') { oval(c, -5, -47, 4, 3, 'rgba(255,255,255,.35)'); oval(c, 5, -47, 4, 3, 'rgba(255,255,255,.35)'); line(c, [[-2, -47], [2, -47]], ink); }
  c.restore();
}
// Pure time-based pacing: pause at each end, then return without a loop jump.
function stroll(now, period, offset = 0) {
  const phase = ((now / period + offset) % 1 + 1) % 1;
  if (phase < .25) return { amount: 0, walking: false, direction: 1 };
  if (phase < .5) return { amount: (phase - .25) * 4, walking: true, direction: 1 };
  if (phase < .75) return { amount: 1, walking: false, direction: -1 };
  return { amount: (1 - phase) * 4, walking: true, direction: -1 };
}
function ambience(c, outside, night, now) {
  if (outside) {
    const pace = stroll(now, 28000);
    const x = 142 + pace.amount * 62; const feet = 289;
    const step = pace.walking ? Math.sin(now / 190) * 2 : 0;
    oval(c, x, feet + 1, 19, 3, 'rgba(61,45,36,.12)');
    c.save(); c.translate(x, feet); c.scale(pace.direction, 1);
    line(c, [[-14, -11], [-23, -17], [-24, -24 + Math.sin(now / 1300) * 2]], '#ae8968', 4);
    line(c, [[-9, -9], [-10 + step, 0]], '#ae8968', 4);
    line(c, [[9, -9], [10 - step, 0]], '#ae8968', 4);
    oval(c, 0, -12, 17, 9, '#c4a17d');
    shape(c, [[7, -21], [7, -32], [15, -26], [21, -31], [24, -19]], '#c4a17d');
    oval(c, 16, -21, 10, 8, '#c4a17d');
    oval(c, 21, -22, 1, 1.2, ink); oval(c, 25, -18, 1.5, 1, '#8e695a');
    line(c, [[-5, -18], [-3, -12]], '#a68061', 2);
    line(c, [[2, -18], [4, -13]], '#a68061', 2);
    c.restore();
    for (let i = 0; i < 5; i++) {
      const phase = ((now / 18000 + i / 5) % 1 + 1) % 1;
      c.save(); c.globalAlpha *= Math.sin(phase * Math.PI) * .6;
      c.translate(35 + i * 72 + Math.sin(phase * Math.PI * 2 + i) * 14, 55 + phase * 225);
      c.rotate(Math.sin(now / 2400 + i) * .6 + i);
      oval(c, 0, 0, 4, 1.8, i % 2 ? '#a9ac79' : '#bcaa79');
      c.restore();
    }
  } else {
    // A few drifting dust motes in the room's light, not interactive objects.
    for (let i = 0; i < 7; i++) {
      const phase = ((now / 15000 + i / 7) % 1 + 1) % 1;
      c.save(); c.globalAlpha *= Math.sin(phase * Math.PI) * (night ? .2 : .35);
      oval(c, 52 + i * 42 + Math.sin(now / 3300 + i) * 5, 170 - phase * 125, 1, 1, '#fff8da');
      c.restore();
    }
  }
}
function interior(c, night) {
  box(c, 0, 0, W, H, '#f1e4cb', 0);
  box(c, 0, 175, W, 175, '#d9bd96', 0);
  for (let y = 185; y < H; y += 27) {
    line(c, [[0, y], [W, y]], '#c7a984');
    for (let x = (y % 2) * 45; x < W; x += 90) line(c, [[x, y], [x, y + 27]], '#cbb18e');
  }
  box(c, 0, 169, W, 8, '#b69672', 0);
  if (!night) shape(c, [[48, 127], [134, 127], [246, 278], [99, 278]], 'rgba(255,246,205,.32)');
}
function door(c, x = 335, y = 112) {
  box(c, x - 5, y - 5, 49, 102, '#b69273', 4, true);
  box(c, x, y, 39, 96, '#80928b', 3);
  box(c, x + 5, y + 9, 29, 39, '#a9bab0', 2);
  box(c, x + 5, y + 56, 29, 30, '#71867e', 2);
  oval(c, x + 30, y + 51, 3, 3, '#eed396');
  box(c, x - 9, y + 94, 57, 6, '#e5d8bd', 2);
}
function shelf(c, x, y, w, books = false) {
  box(c, x, y, w, 111, '#b9926c', 3, true);
  const colors = ['#c99072', '#b4bd8e', '#e0c48f', '#8da6a0', '#cdaba0'];
  for (let row = 0; row < 3; row++) {
    box(c, x + 5, y + 5 + row * 34, w - 10, 28, '#8e745a', 1);
    for (let col = 0; col < Math.floor((w - 14) / 13); col++) {
      const height = 17 + (col * 7 + row * 3) % 10;
      const px = x + 8 + col * 13; const py = y + 32 + row * 34 - height;
      box(c, px, py, books ? 9 : 10, height, colors[(col + row) % 5], books ? 1 : 3);
      box(c, px + 2, py + (books ? 3 : 7), 5, books ? 2 : 6, '#f1e6cb', 1);
    }
    box(c, x + 2, y + 32 + row * 34, w - 4, 5, '#d6b28a', 1);
  }
}
function home(c, night, now, hit) {
  interior(c, night); windowPane(c, 43, 30, 92, 85, night, true);
  plant(c, 30, 164, .85); plant(c, 143, 119, .55);
  box(c, 171, 29, 104, 41, '#ccaa82', 3, true);
  for (let i = 0; i < 3; i++) { box(c, 176 + i * 33, 33, 28, 31, '#e1c39b', 2); oval(c, 197 + i * 33, 52, 1.5, 1.5, ink); }
  box(c, 171, 115, 140, 62, '#91a394', 4, true);
  box(c, 166, 108, 150, 10, '#f8ecd7', 3);
  for (let i = 0; i < 3; i++) { box(c, 178 + i * 44, 123, 37, 45, '#aabb9e', 2); line(c, [[190 + i * 44, 129], [202 + i * 44, 129]], '#758976', 2); }
  oval(c, 199, 108, 19, 6, '#6c7568'); box(c, 182, 95, 34, 13, '#c08b68', 3);
  oval(c, 199, 95, 18, 4, '#e3c09a'); box(c, 195, 89, 8, 5, ink, 2); steam(c, 190, 86, now);
  oval(c, 281, 109, 20, 5, '#c8d8ce'); line(c, [[283, 104], [283, 86], [274, 86], [274, 93]], '#8a9690', 4);
  hit('object:tap-water', 259, 77, 49, 39, '喝水', 284, 73);
  hit('object:kitchen', 167, 92, 79, 79, '厨房', 206, 183);
  oval(c, 150, 242, 115, 37, '#bca582'); oval(c, 150, 240, 112, 34, '#c9b7a0');
  for (let i = 0; i < 3; i++) { c.save(); c.globalAlpha = .3; oval(c, 150, 240, 90 - i * 18, 25 - i * 6, i % 2 ? '#eee1c6' : '#a49178'); c.restore(); }
  box(c, 43, 152, 102, 52, '#8fa18b', 12, true);
  box(c, 43, 185, 102, 30, '#a8b69b', 8);
  box(c, 34, 174, 18, 41, '#91a388', 7); box(c, 137, 174, 18, 41, '#91a388', 7);
  box(c, 55, 165, 28, 25, '#e4c9a4', 6, true); box(c, 99, 167, 29, 23, '#d0a58e', 6, true);
  box(c, 44, 211, 6, 13, wood, 1); box(c, 140, 211, 6, 13, wood, 1);
  hit('object:rest', 32, 149, 125, 76, '小憩', 94, 226);
  box(c, 179, 222, 5, 30, wood, 1); box(c, 231, 222, 5, 30, wood, 1);
  box(c, 167, 208, 81, 19, '#ba8b64', 7, true); cup(c, 199, 201, now);
  box(c, 14, 266, 100, 48, '#b28b6a', 5, true);
  box(c, 14, 254, 12, 65, '#a67c5c', 4); box(c, 26, 264, 81, 42, '#f2e8d2', 7);
  box(c, 32, 268, 22, 30, '#fffae9', 6, true); box(c, 60, 263, 50, 44, '#c79684', 5);
  for (let x = 67; x < 108; x += 11) line(c, [[x, 266], [x, 304]], '#dab29e');
  hit('object:sleep', 14, 254, 101, 66, '睡觉', 64, 332);
  door(c); hit('exit', 327, 106, 57, 116, '出门 ›', 355, 235);
  line(c, [[297, 0], [297, 29]], ink, 2); shape(c, [[281, 47], [288, 28], [306, 28], [314, 47]], '#d7b578');
  if (night) glow(c, 297, 51, 100);
}
function shop(c, world, night, now, hit, freezePeople = false) {
  interior(c, night);
  box(c, 16, 13, 357, 28, '#809d86', 4, true); text(c, '小 巷 便 利   ·   好 好 吃 饭', 194, 27, 13, '#fff4d5');
  shelf(c, 18, 60, 112); shelf(c, 144, 60, 100);
  box(c, 264, 53, 58, 139, '#c3d5cd', 5, true);
  box(c, 270, 61, 46, 116, '#789a98', 3);
  for (let row = 0; row < 3; row++) {
    for (let j = 0; j < 3; j++) { box(c, 275 + j * 12, 79 + row * 31, 8, 20, '#d6e5d4', 3); box(c, 277 + j * 12, 76 + row * 31, 4, 4, '#8aafbd', 1); }
    line(c, [[272, 100 + row * 31], [314, 100 + row * 31]], '#e2eee0', 2);
  }
  line(c, [[275, 65], [294, 171]], 'rgba(255,255,255,.2)', 5); box(c, 307, 110, 3, 21, '#edf1da', 1);
  hit('object:buy-water', 260, 51, 64, 144, '瓶装水', 291, 205);
  if (isOpen(world, 'room')) person(c, 91, 228, freezePeople ? 0 : now, false, 'clerk');
  box(c, 18, 222, 157, 49, '#b78966', 4, true); box(c, 12, 212, 169, 14, '#f1dcc0', 4, true);
  box(c, 29, 197, 59, 17, '#949d8d', 3); oval(c, 58, 197, 29, 7, '#8c644b');
  for (let i = 0; i < 5; i++) { oval(c, 38 + i * 10, 197, 5, 4, i % 2 ? '#e8c08a' : '#e6dbc1'); line(c, [[39 + i * 10, 197], [43 + i * 10, 184]], '#bb9870'); }
  if (isOpen(world, 'room')) steam(c, 45, 185, now);
  box(c, 118, 186, 32, 25, '#677b72', 3); box(c, 122, 190, 24, 15, '#b7d0bc', 1);
  text(c, isOpen(world, 'room') ? '欢迎光临' : '打烊休息', 106, 246, 12, '#fff0d0');
  hit('object:buy-snack', 16, 183, 80, 90, '关东煮', 56, 286);
  door(c, 339, 112); hit('exit', 332, 108, 56, 118, '出门 ›', 355, 240);
  box(c, 174, 19, 47, 4, '#fff6d5', 2); if (night) glow(c, 193, 43, 130);
}
function outdoors(c, night) {
  box(c, 0, 0, W, H, night ? '#76828d' : '#d3e1d3', 0);
  oval(c, 305, 37, 20, 20, night ? '#f3e4b8' : '#fff0bf');
  for (let i = 0; i < 7; i++) {
    const x = i * 64 - 14; const y = 64 + (i * 31) % 48;
    box(c, x, y, 58, 121, night ? '#738182' : '#b6c6b7', 2);
    for (let j = 0; j < 3; j++) box(c, x + 9 + j * 16, y + 13, 7, 15, night ? '#c8b58a' : '#dce2ce', 1);
  }
  box(c, 0, 192, W, 158, '#d3c6ad', 0);
  shape(c, [[0, 208], [390, 197], [390, 226], [0, 238]], '#e4d7bd');
  for (let y = 243; y < H; y += 30) {
    line(c, [[0, y], [390, y]], '#c3b69f');
    for (let x = (y % 2) * 34; x < W; x += 70) line(c, [[x, y], [x - 8, y + 30]], '#c8bba5');
  }
}
function lamp(c, x, y, night) {
  box(c, x - 3, y - 115, 6, 115, '#697467', 2); box(c, x - 9, y - 3, 18, 5, '#697467', 2);
  box(c, x - 12, y - 139, 24, 27, '#788477', 4);
  box(c, x - 8, y - 135, 16, 19, night ? '#ffe0a1' : '#eee2ba', 2);
  shape(c, [[x - 17, y - 138], [x, y - 148], [x + 17, y - 138]], '#6b7668');
  if (night) glow(c, x, y - 126, 74);
}
function street(c, world, night, hit) {
  outdoors(c, night);
  box(c, 13, 30, 140, 164, '#d8bb96', 3, true); box(c, 159, 65, 145, 131, '#c3ae91', 3, true);
  box(c, 8, 26, 150, 10, '#ad8b70', 2); box(c, 154, 59, 155, 10, '#9b8b73', 2);
  windowPane(c, 32, 48, 42, 49, night); windowPane(c, 98, 48, 35, 49, night);
  box(c, 29, 131, 106, 62, '#7d9690', 2); line(c, [[82, 133], [82, 194]], '#e3d6bb', 3);
  for (let i = 0; i < 7; i++) shape(c, [[22 + i * 17, 117], [39 + i * 17, 117], [45 + i * 17, 137], [28 + i * 17, 137]], i % 2 ? '#efddba' : '#b7826b');
  box(c, 28, 101, 109, 18, '#f4e5c7', 3); text(c, '巷口 · 日常小铺', 82, 110, 10);
  windowPane(c, 177, 81, 45, 41, night);
  box(c, 249, 96, 33, 97, '#7e8d80', 2); box(c, 252, 104, 27, 29, '#b2b9a0', 2);
  for (let i = 0; i < 3; i++) box(c, 235 - i * 5, 193 + i * 6, 64 + i * 10, 6, '#c4b69e', 1);
  text(c, '小巷 06', 263, 82, 10);
  bench(c, 34, 224, 95); hit('object:rest', 30, 219, 105, 63, '坐一会', 82, 290);
  lamp(c, 318, 245, night); tree(c, 371, 215, .85); plant(c, 154, 194, .7);
  box(c, 323, 277, 62, 27, '#f2e4c8', 4, true); text(c, '街口 →', 354, 291, 12);
  hit('exit', 323, 270, 63, 46, '去别处', 354, 328);
  hit('look', 165, 156, 61, 48, '环顾', 195, 185);
}
function hallway(c, night, hit) {
  interior(c, night); box(c, 0, 0, W, 101, '#e5d5b9', 0);
  windowPane(c, 150, 33, 73, 88, night); door(c, 40, 83); door(c, 300, 83);
  text(c, '601', 60, 73); text(c, '602', 320, 73);
  box(c, 12, 18, 93, 38, '#b49674', 3, true);
  for (let i = 0; i < 3; i++) { box(c, 17 + i * 29, 23, 24, 27, '#ddd0ae', 2); line(c, [[21 + i * 29, 30], [35 + i * 29, 30]], '#8d836d', 2); }
  plant(c, 256, 188, 1.05, true); bench(c, 21, 227, 97);
  hit('object:rest', 17, 222, 106, 64, '歇歇脚', 70, 297);
  for (let i = 0; i < 4; i++) box(c, 309 - i * 8, 229 + i * 13, 82 + i * 8, 13, i % 2 ? '#baaa90' : '#c9b99d', 1);
  line(c, [[302, 222], [302, 272], [384, 308]], '#8d8a76', 4);
  hit('exit', 313, 223, 74, 90, '下楼 ›', 350, 328);
  box(c, 184, 9, 23, 7, '#fff2cd', 4); if (night) glow(c, 195, 20, 110);
}
function other(c, world, night, now, hit) {
  const id = world.place;
  const inside = ['office', 'bookshop', 'cafe', 'super'].includes(id);
  if (inside) interior(c, night); else outdoors(c, night);
  if (id === 'bookshop') {
    shelf(c, 17, 41, 100, true); shelf(c, 132, 41, 100, true); windowPane(c, 261, 37, 66, 86, night, true);
    bench(c, 44, 212, 98); box(c, 159, 200, 86, 13, wood, 3, true); box(c, 173, 213, 5, 32, wood, 1);
    shape(c, [[176, 184], [197, 189], [219, 184], [219, 205], [197, 209], [176, 204]], '#faf0d7'); line(c, [[197, 190], [197, 206]], '#b8a98d');
    hit('object:read', 156, 178, 92, 68, '翻开一本书', 200, 254);
  } else if (id === 'office') {
    windowPane(c, 35, 30, 115, 83, night); box(c, 191, 29, 115, 70, '#a2afa0', 3);
    for (let i = 0; i < 3; i++) { box(c, 202 + i * 31, 45, 24, 32, '#f4e5c4', 1); line(c, [[206 + i * 31, 55], [220 + i * 31, 55]], '#b6a386'); }
    box(c, 92, 166, 28, 40, '#9baba0', 8); box(c, 35, 191, 156, 14, wood, 3, true);
    box(c, 44, 205, 7, 44, wood, 1); box(c, 174, 205, 7, 44, wood, 1);
    box(c, 68, 141, 54, 37, '#74857e', 3); box(c, 73, 146, 44, 26, '#cee0ce', 1); box(c, 91, 178, 8, 12, '#74857e', 1);
    cup(c, 150, 182, now); hit('object:work', 34, 140, 158, 105, '工作台', 107, 255);
    bench(c, 223, 164, 89); hit('object:wait', 220, 160, 95, 61, '等候', 266, 231);
  } else if (id === 'cafe') {
    windowPane(c, 33, 26, 105, 103, night, true); shelf(c, 175, 32, 102);
    box(c, 193, 159, 111, 39, '#ba906d', 4, true); box(c, 187, 151, 125, 12, '#e6ca9f', 3);
    oval(c, 86, 219, 51, 13, '#b48c64'); box(c, 81, 228, 9, 34, wood, 2); cup(c, 78, 209, now); plant(c, 155, 171, .8);
    hit('object:coffee', 30, 191, 110, 70, '喝杯咖啡', 86, 272);
  } else if (id === 'super' || id === 'market') {
    if (id === 'super') { shelf(c, 22, 32, 126); shelf(c, 167, 32, 128); }
    else {
      for (let i = 0; i < 10; i++) shape(c, [[19 + i * 30, 70], [49 + i * 30, 70], [59 + i * 30, 109], [29 + i * 30, 109]], i % 2 ? '#eddcbc' : '#96a78b');
      line(c, [[27, 103], [27, 215]], wood, 5); line(c, [[316, 103], [316, 215]], wood, 5);
    }
    box(c, 26, 180, 130, 53, '#b19068', 3, true); box(c, 21, 172, 140, 14, '#d6b483', 3);
    for (let i = 0; i < 12; i++) oval(c, 38 + (i % 6) * 21, 166 - Math.floor(i / 6) * 12, 10, 8, ['#8fa873', '#d3a366', '#a6b57c'][i % 3]);
    hit('object:buy-groceries', 20, 145, 143, 93, '新鲜食材', 90, 251);
    box(c, 189, 181, 104, 45, '#b19068', 3, true);
    if (id === 'market') {
      for (let i = 0; i < 4; i++) box(c, 198 + i * 20, 161, 15, 22, '#e9d9af', 2);
      hit('object:buy-seed', 185, 153, 110, 80, '花种', 238, 245);
      plant(c, 47, 299, .65, true); hit('object:sell-flower', 25, 264, 54, 59, '卖鲜花', 53, 335);
    } else { box(c, 206, 164, 66, 19, '#e6d8b3', 3); hit('object:buy-snack', 185, 155, 110, 78, '今日便当', 239, 245); }
  } else if (id === 'balcony') {
    tree(c, 65, 198, 1.25); tree(c, 292, 186, 1.05);
    oval(c, 176, 200, 104, 28, '#acbb8a');
    box(c, 30, 232, 116, 37, '#bc9677', 8, true); oval(c, 88, 235, 53, 12, '#826b50');
    for (let i = 0; i < 4; i++) plant(c, 52 + i * 24, 235, .5, !!world.garden && now >= world.garden.readyAt);
    hit(`object:${world.garden ? 'harvest' : 'plant'}`, 27, 205, 121, 70, world.garden ? '照看花坛' : '种花', 88, 286);
    bench(c, 217, 185, 90); hit('object:rest', 213, 182, 98, 63, '树下休息', 259, 254);
  } else if (id === 'square') {
    tree(c, 49, 204, .95); tree(c, 321, 199, .85);
    oval(c, 181, 193, 74, 26, '#a8ad9d'); oval(c, 181, 188, 67, 20, '#a6c8c1');
    box(c, 175, 140, 12, 47, '#c5c6b0', 4); oval(c, 181, 146, 35, 9, '#d5d2b8');
    line(c, [[159, 157], [158, 179]], '#e7f0df', 2); line(c, [[201, 157], [202, 179]], '#e7f0df', 2);
    bench(c, 27, 234, 98); hit('object:rest', 24, 231, 105, 62, '喷泉边坐坐', 77, 305);
  } else if (id === 'neighbor' || id === 'metro') {
    box(c, 36, 89, 237, 12, '#819b91', 3, true); box(c, 43, 101, 7, 117, '#819b91', 1); box(c, 260, 101, 7, 117, '#819b91', 1);
    box(c, 58, 109, 184, 88, '#b9cfc1', 2); line(c, [[145, 109], [145, 197]], '#e5e7cd', 4);
    text(c, id === 'metro' ? 'M   小巷站' : '小巷公交 · 06 路', 154, 81, 15);
    bench(c, 79, 201, 121); hit('object:rest', 76, 199, 128, 64, '候车长椅', 139, 275);
    box(c, 285, 136, 8, 96, '#84988c', 2); box(c, 272, 117, 35, 43, '#f0e5c8', 4, true); text(c, '站', 290, 139, 15);
  } else { tree(c, 70, 208); bench(c, 44, 228); hit('object:rest', 40, 224, 101, 64, '歇一会', 91, 300); }
  if (inside) { door(c, 338, 112); hit('exit', 331, 107, 57, 117, '出门 ›', 354, 238); }
  else { lamp(c, 352, 220, night); box(c, 323, 280, 62, 26, '#f1e3c6', 4, true); text(c, '路口 →', 354, 293); hit('exit', 320, 274, 68, 43, '去别处', 353, 330); }
}
export function drawScene(ctx, world, now, motion = {}) {
  const time = Number.isFinite(now) ? now : 0;
  const night = world.clock >= 19 * 60 || world.clock < 6 * 60;
  const outside = !['bed', 'door', 'room', 'office', 'bookshop', 'cafe', 'super'].includes(world.place);
  const actions = actionsAt(world, time);
  const available = new Set(actions.map(action => action.id));
  const hotspots = []; const labels = [];
  function hit(id, x, y, w, h, label, lx, ly) {
    if (id === 'object:kitchen') id = `object:${available.has('cook') ? 'cook' : 'community-meal'}`;
    if (id.startsWith('object:') && !available.has(id.slice(7))) return;
    const tagWidth = Math.max(36, label.length * 10 + 19);
    const tagX = Math.max(tagWidth / 2 + 2, Math.min(W - tagWidth / 2 - 2, lx));
    const tagY = Math.max(10, Math.min(H - 10, ly));
    const left = Math.max(0, Math.min(x, tagX - tagWidth / 2));
    const top = Math.max(0, Math.min(y, tagY - 9));
    const right = Math.min(W, Math.max(x + w, tagX + tagWidth / 2));
    const bottom = Math.min(H, Math.max(y + h, tagY + 9));
    if (right <= left || bottom <= top) return;
    hotspots.push({ id, x: left, y: TOP + top, w: right - left, h: bottom - top });
    labels.push({ label, x: tagX, y: tagY });
  }
  ctx.save();
  try {
    ctx.beginPath(); ctx.rect(0, TOP, W, H); ctx.clip(); ctx.translate(0, TOP);
    if (world.place === 'bed') home(ctx, night, time, hit);
    else if (world.place === 'room') shop(ctx, world, night, time, hit, motion.freezePeople === true);
    else if (world.place === 'street') street(ctx, world, night, hit);
    else if (world.place === 'door') hallway(ctx, night, hit);
    else other(ctx, world, night, time, hit);

    // Fixed, deterministic paper fibres: no random state or per-frame texture allocation.
    for (let i = 0; i < 105; i++) {
      const x = (i * 97 + 19) % W; const y = (i * 61 + 17) % H;
      line(ctx, [[x, y], [x + 2, y + .5]], 'rgba(109,83,54,.055)');
    }
    ambience(ctx, outside, night, time);
    if (outside && (world.memories || {})['cat-friend']) text(ctx, '花猫朝你轻轻叫了一声', 185, 247, 10);
    const people = residents(world, world.place);
    people.forEach((p, index) => {
      const pace = stroll(time, 14000 + index * 1700, index * .27);
      const frozen = motion.freezePeople === true;
      const x = 274 - index * 72 + (frozen ? 0 : pace.amount * (index % 2 ? -14 : 14));
      const feet = 331;
      person(ctx, x, feet, frozen ? 0 : time, !frozen && pace.walking, p.id);
      hit(`npc:${p.id}`, x - 22, feet - 66, 44, 81, p.name, x, feet + 11);
    });
    let x = 195; let feet = 325; let walking = false;
    const progress = value => Math.max(0, Math.min(1, value));
    if (Number.isFinite(motion.exit)) { x = 195 + 220 * progress(motion.exit); walking = motion.exit > 0 && motion.exit < 1; }
    else if (Number.isFinite(motion.enter)) { x = -25 + 220 * progress(motion.enter); walking = motion.enter < 1; }
    else if (motion.hero) {
      if (Number.isFinite(motion.hero.x)) x = motion.hero.x;
      // Feet are scene-local; TOP is applied once by the scene transform.
      if (Number.isFinite(motion.hero.y)) feet = motion.hero.y;
      walking = motion.hero.walking === true;
    }
    person(ctx, x, feet, time, walking);
    if (night) {
      box(ctx, 0, 0, W, H, outside ? 'rgba(30,43,65,.29)' : 'rgba(54,46,55,.16)', 0);
      glow(ctx, outside ? 321 : 195, outside ? 117 : 47, outside ? 80 : 120);
    }
    if (outside && (world.weather === 'rainy' || world.weather === 'rain')) {
      box(ctx, 0, 0, W, H, 'rgba(93,119,129,.09)', 0);
      for (let i = 0; i < 48; i++) {
        const y = (i * 43 + time * .14) % 380 - 15;
        const rx = (i * 79 - time * .035) % 420;
        const rainX = (rx + 420) % 420;
        line(ctx, [[rainX, y], [rainX - 4, y + 11]], 'rgba(240,246,230,.42)');
      }
      for (let i = 0; i < 4; i++) oval(ctx, 48 + i * 89, 316 + (i % 2) * 18, 17, 2, 'rgba(218,231,217,.3)');
    }
    // Small object/name tags are part of the scene, never a persistent map or HUD.
    labels.forEach(tag => {
      const width = Math.max(36, tag.label.length * 10 + 19);
      const lx = Math.max(width / 2 + 2, Math.min(W - width / 2 - 2, tag.x));
      const ly = Math.max(10, Math.min(H - 10, tag.y));
      box(ctx, lx - width / 2, ly - 9, width, 18, 'rgba(255,248,228,.94)', 8, true);
      oval(ctx, lx - width / 2 + 8, ly, 2, 2, '#b68a57');
      text(ctx, tag.label, lx + 3, ly, 10);
    });
    // A painted location plaque, kept within the scene rather than above it.
    if (!['bed', 'room', 'street', 'door'].includes(world.place)) {
      box(ctx, 9, 8, 61, 20, 'rgba(248,238,213,.9)', 3);
      text(ctx, placeById(world.place).name, 39, 18, 11);
    }
  } finally { ctx.restore(); }
  return hotspots;
}
