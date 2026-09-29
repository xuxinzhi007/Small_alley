import { createCardWorld, CARD_SAVE_KEY, nextCard, choose, defer, passDay } from './cards.js';
import { renderCards } from './card-draw.js';

export function createCardGame() {
  const saved = wx.getStorageSync(CARD_SAVE_KEY);
  if (saved && saved.version !== 1) throw new Error('卡牌存档版本不受支持，请保留存档并更新游戏。');
  const world = saved || createCardWorld();
  const state = {
    world,
    current: nextCard(world),
    phase: 'card',
    result: null,
    notice: '',
    journal: false,
    page: 0,
    cardTop: 0,
    hotspots: [],
    now: Date.now(),
    anim: { cardAt: 0, noticeAt: 0, pressId: null },
    display: { atmosphere: NaN, residents: {} },
  };
  world.pending = state.current ? state.current.id : null;
  let hidden = false;
  let pressed = null;
  function notify(say) { state.notice = say; state.anim.noticeAt = state.now; }
  function save() {
    try { wx.setStorageSync(CARD_SAVE_KEY, world); }
    catch (error) { notify('保存失败，请检查存储空间，暂时不要退出。'); }
  }
  function settle(result) {
    if (!result.ok) { notify(result.say); return; }
    state.result = result;
    state.phase = 'result';
    state.anim.cardAt = state.now;
    save();
  }
  function render() { renderCards(state, state.now); }
  function activate(id) {
    if (id === 'journal') { state.journal = true; state.page = 0; return; }
    if (id === 'close') { state.journal = false; return; }
    if (id === 'page:prev') { state.page = Math.max(0, state.page - 1); return; }
    if (id === 'page:next') { state.page += 1; return; }
    if (id === 'continue') { state.current = state.result ? state.result.card : null; state.result = null; state.phase = 'card'; state.anim.cardAt = state.now; return; }
    if (state.journal) return;
    if (id.startsWith('opt:')) { settle(choose(world, Number(id.slice(4)))); return; }
    if (id === 'defer') { settle(defer(world)); return; }
    if (id === 'pass') { settle(passDay(world)); return; }
  }
  const point = touch => ({ x: touch.clientX == null ? touch.x : touch.clientX, y: touch.clientY == null ? touch.y : touch.clientY });
  wx.onTouchStart(event => {
    if (hidden || !event.touches || event.touches.length !== 1) return;
    const p = point(event.touches[0]);
    pressed = state.hotspots.slice().reverse().find(h => p.x >= h.x && p.x < h.x + h.w && p.y >= h.y && p.y < h.y + h.h) || null;
    state.anim.pressId = pressed ? pressed.id : null;
  });
  wx.onTouchEnd(event => {
    const hit = pressed; pressed = null; state.anim.pressId = null;
    if (!hit || !event.changedTouches || !event.changedTouches.length) return;
    const p = point(event.changedTouches[0]);
    if (p.x >= hit.x && p.x < hit.x + hit.w && p.y >= hit.y && p.y < hit.y + hit.h) activate(hit.id);
    render();
  });
  if (wx.onTouchCancel) wx.onTouchCancel(() => { pressed = null; state.anim.pressId = null; });
  if (wx.onHide) wx.onHide(() => { hidden = true; pressed = null; state.anim.pressId = null; save(); });
  if (wx.onShow) wx.onShow(() => { hidden = false; });
  if (!saved) save();
  render();
  return {
    frame(now = Date.now()) { if (hidden) return; state.now = now; render(); },
    get snapshot() { return JSON.parse(JSON.stringify(world)); },
    get hotspots() { return state.hotspots.map(h => ({ ...h })); },
    get view() { return { journal: state.journal, phase: state.phase, notice: state.notice }; },
  };
}
