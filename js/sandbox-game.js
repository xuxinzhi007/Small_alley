import { SCREEN_WIDTH } from './render.js';
import { createSandbox, SAVE_KEY, TILE, COLS, ROWS, findPath, commandMove, interact, editObject, undoEdit, addNote, step } from './sandbox.js';
import { renderSandbox } from './sandbox-draw.js';

export function createSandboxGame() {
  const saved = wx.getStorageSync(SAVE_KEY);
  if (saved && saved.version !== 1) throw new Error('沙盒存档版本不受支持，请保留存档并更新游戏。');
  const legacy = saved ? null : wx.getStorageSync('little-lane-world-v1');
  const world = saved || createSandbox(legacy && legacy.name || '小巷居民');
  const state = {
    world, mode: 'life', camera: { x: Math.max(0, (world.hero.x + .5) * TILE - SCREEN_WIDTH / 2), y: 160 },
    tool: null, selected: null, hover: null, undo: null, notice: '点地面走动，点物件互动；也可以创造自己的小街区。',
    panel: null, page: 0, noteText: '', noteResident: null, hotspots: [], viewport: null,
  };
  let movingObject = false;
  let pressed = null;
  let pending = null;
  let approachUntil = 0;
  function cancelApproach() { pending = null; world.hero.path = []; }
  let hidden = false;
  let keyboard = false;
  let keyboardValue = '';
  let last = null;
  let sinceSave = 0;
  let notePosition = null;
  function notify(say) { state.notice = say; }
  function save() {
    try { wx.setStorageSync(SAVE_KEY, world); sinceSave = 0; }
    catch (error) { notify('保存失败，请检查存储空间，暂时不要退出。'); }
  }
  function apply(result) {
    notify(result.say);
    if (result.ok) save();
    return result.ok;
  }
  function inView(p) {
    const v = state.viewport;
    return v && p.x >= v.x && p.x < v.x + v.w && p.y >= v.y && p.y < v.y + v.h;
  }
  function cell(p) {
    return { x: Math.floor((p.x - state.viewport.x + state.camera.x) / TILE), y: Math.floor((p.y - state.viewport.y + state.camera.y) / TILE) };
  }
  function openKeyboard() {
    if (!wx.showKeyboard) { notify('当前环境无法输入文字。'); return; }
    keyboard = true; keyboardValue = state.noteText;
    wx.showKeyboard({ defaultValue: state.noteText, maxLength: 80, multiple: true, confirmType: 'done', fail() { keyboard = false; notify('键盘暂时无法打开，请重试。'); } });
  }
  function approach(id) {
    if (pending === id && world.hero.path.length) return;
    cancelApproach();
    const target = world.objects.find(o => o.id === id) || world.residents.find(p => p.id === id);
    if (!target) return;
    const tx = Math.round(target.x), ty = Math.round(target.y);
    const candidates = [[tx - 1, ty], [tx + 1, ty], [tx, ty - 1], [tx, ty + 1]];
    let best = null;
    for (const [x, y] of candidates) {
      if (Math.hypot(target.x - x, target.y - y) > 1.05) continue;
      if (Math.hypot(world.hero.x - x, world.hero.y - y) < .1) { best = { x, y, length: 0 }; break; }
      const path = findPath(world, world.hero, { x, y });
      if (path.length && (!best || path.length < best.length)) best = { x, y, length: path.length };
    }
    if (!best) { notify('暂时走不到旁边，试着换个位置或调整物品。'); return; }
    if (!best.length) { pending = null; apply(interact(world, id)); return; }
    if (apply(commandMove(world, best.x, best.y))) {
      pending = id; approachUntil = world.elapsed + 20;
    }
  }
  function activate(id) {
    if (id === 'close') { state.panel = null; return; }
    if (id === 'journal') { cancelApproach(); state.panel = 'journal'; state.page = 0; return; }
    if (id === 'page:prev') { state.page = Math.max(0, state.page - 1); return; }
    if (id === 'page:next') { state.page += 1; return; }
    if (id === 'note:new') {
      world.hero.path = []; pending = null;
      state.noteText = ''; state.noteResident = null; state.panel = 'note';
      notePosition = { x: Math.round(world.hero.x), y: Math.round(world.hero.y) };
      openKeyboard(); return;
    }
    if (id === 'note:edit') { openKeyboard(); return; }
    if (id.startsWith('note:resident:')) { const person = id.slice(14); state.noteResident = person === 'private' ? null : person; return; }
    if (id === 'note:save') {
      const p = notePosition || world.hero;
      if (apply(addNote(world, state.noteText, state.noteResident, Math.round(p.x), Math.round(p.y)))) { state.panel = 'journal'; state.page = 0; }
      return;
    }
    if (id.startsWith('mode:')) {
      state.mode = id.slice(5); state.tool = null; state.selected = null; state.hover = null;
      movingObject = false; pending = null; world.hero.path = []; save();
      notify(state.mode === 'life' ? '点地面自由走动；点人物或物品走近互动。' : state.mode === 'observe' ? '拖动画面观察，居民会继续过自己的生活。' : '编辑时世界暂停。选物品，再点地面放置；点已有物品可移动或移除。');
      return;
    }
    if (state.mode === 'create') {
      if (id.startsWith('tool:')) { state.tool = id.slice(5); state.selected = null; movingObject = false; return; }
      if (id === 'move') { movingObject = !!state.selected; state.tool = 'move'; notify('点一个空地，将选中的物品搬过去。'); return; }
      if (id === 'remove' && state.selected) {
        const result = editObject(world, { id: state.selected, remove: true });
        if (apply(result)) { state.undo = result.undo; state.selected = null; state.tool = null; movingObject = false; }
        return;
      }
      if (id === 'undo' && state.undo) { if (apply(undoEdit(world, state.undo))) { state.undo = null; state.selected = null; state.tool = null; movingObject = false; } return; }
      if (id === 'pause') { world.paused = !world.paused; save(); return; }
      if (id === 'weather') { world.weather = world.weather === 'sunny' ? 'rainy' : 'sunny'; save(); return; }
      if (id === 'time') { world.clock = world.clock < 1080 ? 1200 : 480; save(); return; }
    }
    if (id.startsWith('object:')) {
      const objectId = id.slice(7);
      if (state.mode === 'create') { state.selected = objectId; state.tool = null; movingObject = false; }
      else if (state.mode === 'life') approach(objectId);
      else { const o = world.objects.find(item => item.id === objectId); notify(o && o.type === 'food' ? `食物剩余 ${o.stock} 份，饥饿的居民会来取用。` : '物品会影响居民的选择，可以观察他们接下来做什么。'); }
    }
    if (id.startsWith('npc:')) {
      const personId = id.slice(4);
      if (state.mode === 'life') approach(personId);
      else { const p = world.residents.find(person => person.id === personId); if (p) notify(`${p.name} · ${p.activity} · 饥饿 ${Math.round(p.hunger)} · 精力 ${Math.round(p.energy)}`); }
    }
  }
  function ground(p) {
    const target = cell(p); state.hover = target;
    if (state.mode === 'life') { pending = null; apply(commandMove(world, target.x, target.y)); }
    if (state.mode === 'create' && (state.tool || movingObject)) {
      const object = world.objects.find(o => o.id === state.selected);
      const result = editObject(world, { ...target, type: movingObject && object ? object.type : state.tool, ...(movingObject ? { id: state.selected } : {}) });
      if (apply(result)) { state.undo = result.undo; if (movingObject) state.tool = null; movingObject = false; state.selected = null; }
    }
  }
  const point = touch => ({ x: touch.clientX == null ? touch.x : touch.clientX, y: touch.clientY == null ? touch.y : touch.clientY });
  wx.onTouchStart(event => {
    pressed = null;
    if (hidden || keyboard || !event.touches || event.touches.length !== 1) return;
    const p = point(event.touches[0]);
    const hit = state.hotspots.slice().reverse().find(h => p.x >= h.x && p.x < h.x + h.w && p.y >= h.y && p.y < h.y + h.h);
    if (hit || (!state.panel && inView(p))) pressed = { p, hit, camera: { ...state.camera }, dragged: false };
  });
  wx.onTouchMove(event => {
    if (!pressed || !event.touches || event.touches.length !== 1) { pressed = null; return; }
    const p = point(event.touches[0]);
    if (Math.hypot(p.x - pressed.p.x, p.y - pressed.p.y) > 10) pressed.dragged = true;
    if (pressed.dragged && !state.panel && state.mode !== 'life' && inView(pressed.p)) {
      state.camera.x = Math.max(0, Math.min(COLS * TILE - state.viewport.w, pressed.camera.x - p.x + pressed.p.x));
      state.camera.y = Math.max(0, Math.min(ROWS * TILE - state.viewport.h, pressed.camera.y - p.y + pressed.p.y));
    }
    if (inView(p)) state.hover = cell(p);
  });
  wx.onTouchEnd(event => {
    const start = pressed; pressed = null;
    if (!start || start.dragged || !event.changedTouches || !event.changedTouches.length) return;
    const p = point(event.changedTouches[0]);
    if (Math.hypot(p.x - start.p.x, p.y - start.p.y) > 10) return;
    if (start.hit) {
      const h = start.hit;
      if (p.x >= h.x && p.x < h.x + h.w && p.y >= h.y && p.y < h.y + h.h) activate(h.id);
    } else if (!state.panel && inView(p)) ground(p);
    renderSandbox(state, Date.now());
  });
  if (wx.onTouchCancel) wx.onTouchCancel(() => { pressed = null; if (pending) cancelApproach(); });
  if (wx.onKeyboardInput) wx.onKeyboardInput(event => { if (keyboard) keyboardValue = String(event.value || '').slice(0, 80); });
  if (wx.onKeyboardConfirm) wx.onKeyboardConfirm(event => {
    if (!keyboard) return;
    state.noteText = String(event.value == null ? keyboardValue : event.value).trim().slice(0, 80); keyboard = false;
    if (wx.hideKeyboard) wx.hideKeyboard();
    renderSandbox(state, Date.now());
  });
  if (wx.onKeyboardComplete) wx.onKeyboardComplete(() => { keyboard = false; });
  if (wx.onHide) wx.onHide(() => { hidden = true; pressed = null; keyboard = false; if (pending) cancelApproach(); save(); });
  if (wx.onShow) wx.onShow(() => { hidden = false; last = null; });
  if (!saved) save();
  renderSandbox(state, Date.now());
  return {
    frame(now = Date.now()) {
      if (hidden) return;
      const dt = last === null ? 0 : Math.max(0, Math.min(.1, (now - last) / 1000)); last = now;
      if (state.mode !== 'create' && !state.panel && !keyboard && !world.paused) {
        if (pending && world.elapsed >= approachUntil) { cancelApproach(); notify('这次没能走近，换个位置再打招呼吧。'); }
        const changed = step(world, dt, pending);
        sinceSave += dt;
        if (pending && !world.hero.path.length) { const id = pending; pending = null; apply(interact(world, id)); }
        if (changed || sinceSave >= 10) save();
      }
      if (state.mode === 'life' && state.viewport) {
        state.camera.x = Math.max(0, (world.hero.x + .5) * TILE - state.viewport.w / 2);
        state.camera.y = Math.max(0, (world.hero.y + .5) * TILE - state.viewport.h / 2);
      }
      renderSandbox(state, now);
    },
    get snapshot() { return JSON.parse(JSON.stringify(world)); },
    get hotspots() { return state.hotspots.map(h => ({ ...h })); },
    get view() { return { mode: state.mode, camera: { ...state.camera }, viewport: { ...state.viewport }, panel: state.panel, notice: state.notice }; },
  };
}
