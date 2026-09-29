import { loadGameArt } from './assets.js';
import { createWorld, SAVE_KEY, travel, perform, availableActions, placeById, residents, blocked, rollEncounter, currentEncounter, resolveEncounter, encounterChoice } from './world.js';
import { render } from './draw.js';

export function createGame() {
  const saved = wx.getStorageSync(SAVE_KEY);
  if (saved && saved.version !== 1) throw new Error('存档版本不受支持，请保留存档并更新游戏。');
  const world = saved || createWorld(wx.getStorageSync('wenbebi-sql-v1'));
  const state = {
    world, viewPlace: world.place, selected: world.place, panel: null, art: null, hotspots: [], layout: null,
    notice: saved ? '欢迎回来。点场景里的物件，或和身边的人聊聊。' : '点物件开始生活，点门出发。对话卡片可以左右滑动。',
    noticeUntil: Date.now() + 6500, transition: null, dialogue: null, dialogueAt: 0, revealed: false,
    dragX: 0, dragging: false, fly: null, approach: null, hero: { x: 195, y: 325, walking: false },
  };
  let hidden = false;
  let lastFrame = 0;
  let lastClock = Date.now();
  let pressed = null;
  let naming = false;
  function notify(message) { state.notice = message; state.noticeUntil = Date.now() + 5000; }
  function save() {
    try { wx.setStorageSync(SAVE_KEY, world); }
    catch (error) { notify('进度保存失败，请检查设备存储空间，暂时不要退出。'); }
  }
  function show(dialogue) {
    state.dialogue = dialogue; state.dialogueAt = Date.now(); state.revealed = false;
    state.dragX = 0; state.dragging = false; state.fly = null;
  }
  function showEncounter() {
    const event = currentEncounter(world);
    if (event) show({ kind: 'event', speaker: event.speaker, title: event.title, text: event.text, left: event.left.label, right: event.right.label });
  }
  if (!saved) save();
  showEncounter();
  function finishResult(result, allowEncounter = true) {
    if (!result.ok) { notify(result.say); state.dragX = 0; state.fly = null; return; }
    if (allowEncounter) rollEncounter(world);
    save();
    show({ kind: 'result', speaker: '小巷手记', title: '这一刻，发生了', text: result.say, left: '记在心里', right: '继续今天' });
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail() {} });
  }
  function promptAction(id) {
    const item = availableActions(world).find((entry) => entry.id === id);
    if (!item) return;
    if (['tap-water', 'rest', 'wait', 'observe', 'eat', 'drink'].includes(id)) {
      const result = perform(world, id);
      if (!result.ok) { notify(result.say); return; }
      state.panel = null;
      rollEncounter(world); save(); notify(result.say); showEncounter();
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail() {} });
      return;
    }
    const person = id.startsWith('talk:') ? residents(world, world.place).find((p) => p.id === id.slice(5)) : null;
    const greetings = ['今天过得怎么样？坐下来慢慢说。', '刚好遇见你。小巷里每天都有些新鲜事。', '先歇一歇吧，事情可以慢慢来。'];
    const familiar = person && ((world.relationships[person.id] || {}).level || 0) > 0;
    const description = person ? `${familiar ? '上次说的事，我还记得。' : ''}${greetings[Math.floor(Math.random() * greetings.length)]}` : `${item.detail}。${item.minutes ? `以你现在的状态，预计 ${item.minutes} 分钟。${item.reason}。` : '把今天收好，明早再出发。'}`;
    state.panel = null;
    show({ kind: 'action', actionId: id, speaker: person ? person.name : id.startsWith('buy-') ? '柜台旁' : placeById(world.place).name, title: item.label, text: description, left: '先不着急', right: item.label });
    const reason = blocked(world, item);
    if (reason) notify(reason);
  }
  function respond(direction) {
    const dialogue = state.dialogue;
    if (!dialogue || state.fly) return;
    if (dialogue.kind === 'event') {
      const choice = encounterChoice(world, direction);
      if (choice && choice.reason) { notify(choice.reason); return; }
    }
    if (dialogue.kind === 'action' && direction > 0) {
      const item = availableActions(world).find((entry) => entry.id === dialogue.actionId);
      const reason = item ? blocked(world, item) : '这里不能进行这个行动。';
      if (reason) { notify(reason); return; }
    }
    state.revealed = true; state.dragging = false;
    state.fly = { start: Date.now(), from: state.dragX, direction };
  }
  function commitResponse(direction) {
    const dialogue = state.dialogue;
    if (!dialogue) return;
    if (dialogue.kind === 'event') { finishResult(resolveEncounter(world, direction), false); return; }
    if (dialogue.kind === 'action' && direction > 0) {
      finishResult(perform(world, dialogue.actionId)); return;
    }
    show(null); showEncounter();
  }
  function approachAction(id, hotspotId) {
    const item = availableActions(world).find((entry) => entry.id === id);
    const reason = item ? blocked(world, item) : '这里暂时不能这样做。';
    if (reason) { notify(reason); return; }
    const hit = state.hotspots.find((entry) => entry.id === hotspotId);
    if (!hit) return;
    const target = { x: Math.max(25, Math.min(365, hit.x + hit.w / 2 - (id.startsWith('talk:') ? 36 : 0))), y: Math.max(235, Math.min(325, hit.y + hit.h - 108 + 18)) };
    state.approach = { id, from: { ...state.hero }, target, start: Date.now(), duration: Math.max(220, Math.min(650, Math.hypot(target.x - state.hero.x, target.y - state.hero.y) * 3)) };
    notify(`走近${item.label}的位置…`);
  }
  function activate(id) {
    if (state.transition || state.fly || state.approach) return;
    if (id === 'choice:left' || id === 'choice:right') { respond(id.endsWith('left') ? -1 : 1); return; }
    if (id === 'dialogue') { state.revealed = true; return; }
    if (world.pendingEncounter) { showEncounter(); return; }
    if (id === 'close-panel') { state.panel = null; return; }
    if (id === 'exit' || id === 'map') { show(null); state.selected = world.place; state.panel = 'map'; return; }
    if (id === 'bag' || id === 'journal' || id === 'actions') { show(null); state.panel = id; return; }
    if (id.startsWith('place:')) { state.selected = id.slice(6); return; }
    if (id === 'name') {
      if (wx.showKeyboard) {
        naming = true;
        wx.showKeyboard({ defaultValue: world.name, maxLength: 8, confirmType: 'done', fail: () => { naming = false; notify('键盘暂时无法打开，请重试。'); } });
      }
      return;
    }
    if (id.startsWith('travel:')) {
      const from = world.place;
      const result = travel(world, id.slice(7));
      if (!result.ok) { notify(result.say); return; }
      rollEncounter(world); save(); show(null);
      state.panel = null; state.selected = world.place;
      state.transition = { from, to: world.place, start: Date.now(), duration: 1100 };
      notify(result.say); return;
    }
    if (id === 'look') { promptAction('observe'); return; }
    if (id.startsWith('npc:')) { approachAction(`talk:${id.slice(4)}`, id); return; }
    if (id.startsWith('object:')) { approachAction(id.slice(7), id); return; }
    if (id.startsWith('action:')) promptAction(id.slice(7));
  }
  function position(touch) {
    const layout = state.layout;
    return { x: ((touch.clientX == null ? touch.x : touch.clientX) - layout.x) / layout.scale, y: ((touch.clientY == null ? touch.y : touch.clientY) - layout.y) / layout.scale };
  }
  function cancelTouch() { pressed = null; state.dragging = false; }
  wx.onTouchStart((event) => {
    if (!state.layout || naming || state.fly || state.transition || state.approach || !event.touches || event.touches.length !== 1) { cancelTouch(); return; }
    const p = position(event.touches[0]);
    const hit = state.hotspots.slice().reverse().find((s) => p.x >= s.x && p.x < s.x + s.w && p.y >= s.y && p.y < s.y + s.h);
    pressed = hit ? { id: hit.id, x: p.x, y: p.y, hit } : null;
    if (hit && hit.id === 'dialogue') { state.dragging = true; state.dragX = 0; }
  });
  wx.onTouchMove((event) => {
    if (!pressed || !event.touches || event.touches.length !== 1) { cancelTouch(); return; }
    const p = position(event.touches[0]);
    if (pressed.id === 'dialogue') {
      state.dragX = Math.max(-330, Math.min(330, p.x - pressed.x));
      if (Math.abs(state.dragX) > 8) state.revealed = true;
    } else if (Math.hypot(p.x - pressed.x, p.y - pressed.y) > 12) cancelTouch();
  });
  wx.onTouchEnd((event) => {
    if (!pressed) return;
    const current = pressed; pressed = null; state.dragging = false;
    const touch = event.changedTouches && event.changedTouches[0];
    if (current.id === 'dialogue') {
      if (touch) state.dragX = Math.max(-330, Math.min(330, position(touch).x - current.x));
      if (Math.abs(state.dragX) >= 78) respond(state.dragX < 0 ? -1 : 1);
      else if (Math.abs(state.dragX) < 8) state.revealed = true;
    } else {
      if (touch) {
        const p = position(touch); const s = current.hit;
        if (p.x < s.x || p.x >= s.x + s.w || p.y < s.y || p.y >= s.y + s.h) return;
      }
      activate(current.id);
    }
    render(state);
  });
  if (wx.onTouchCancel) wx.onTouchCancel(cancelTouch);
  if (wx.onKeyboardConfirm) wx.onKeyboardConfirm((result) => {
    if (!naming) return;
    naming = false;
    const name = String(result.value || '').trim().slice(0, 8);
    if (name) { world.name = name; save(); }
    if (wx.hideKeyboard) wx.hideKeyboard();
  });
  if (wx.onKeyboardComplete) wx.onKeyboardComplete(() => { naming = false; });
  if (wx.onHide) wx.onHide(() => { hidden = true; cancelTouch(); state.fly = null; state.dragX = 0; state.approach = null; state.hero.walking = false; save(); });
  if (wx.onShow) wx.onShow(() => {
    if (state.transition) state.hero = { x: 195, y: 325, walking: false };
    hidden = false; state.transition = null; state.viewPlace = world.place;
    lastFrame = 0; lastClock = Date.now();
    if (world.pendingEncounter) showEncounter();
  });
  loadGameArt().then((art) => { state.art = art; }).catch(() => notify('头像图片未载入，场景人物仍可正常互动。'));
  return {
    frame(now = Date.now()) {
      if (hidden || now - lastFrame < 25) return;
      lastFrame = now;
      const clock = Date.now(); const dt = Math.min(100, Math.max(0, clock - lastClock)); lastClock = clock;
      if (state.transition) {
        const t = (clock - state.transition.start) / state.transition.duration;
        if (t >= 0.5) state.viewPlace = world.place;
        if (t >= 1) { state.transition = null; state.hero = { x: 195, y: 325, walking: false }; showEncounter(); }
      }
      if (state.approach) {
        const move = state.approach;
        const t = Math.min(1, (clock - move.start) / move.duration);
        state.hero = { x: move.from.x + (move.target.x - move.from.x) * t, y: move.from.y + (move.target.y - move.from.y) * t, walking: t < 1 };
        if (t >= 1) { state.approach = null; state.notice = ''; promptAction(move.id); }
      }
      if (state.fly) {
        const t = Math.min(1, (clock - state.fly.start) / 220);
        state.dragX = state.fly.from + (state.fly.direction * 480 - state.fly.from) * t * t;
        if (t >= 1) { const direction = state.fly.direction; state.fly = null; commitResponse(direction); }
      } else if (!state.dragging) {
        state.dragX *= Math.exp(-dt / 65);
        if (Math.abs(state.dragX) < 0.3) state.dragX = 0;
      }
      render(state, clock);
    },
    get snapshot() { return JSON.parse(JSON.stringify(world)); },
    get hotspots() {
      if (!state.layout) return [];
      const { scale, x, y } = state.layout;
      return state.hotspots.map((s) => ({ id: s.id, x: x + s.x * scale, y: y + s.y * scale, w: s.w * scale, h: s.h * scale }));
    },
  };
}
