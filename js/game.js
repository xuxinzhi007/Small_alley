import { SCREEN_WIDTH, SCREEN_HEIGHT, SAFE_BOTTOM, HUD_TOP, HUD_H } from './render.js';
import { loadGameArt } from './assets.js';
import { openLife, ensureToday, choose, touchLife, snapshotLife, periodName, travelTo, adjustSelf } from './content.js';
import { render } from './draw.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createGame() {
  const db = openLife();
  const state = {
    ready: false,
    failed: false,
    art: null,
    hotspots: [],
    view: null,
    card: null,
    echo: '',
    echoUntil: 0,
    dragX: 0,
    dragging: false,
    fly: 0,
    flyDir: 0,
    busy: false,
    mapOpen: false,
    personOpen: false,
    bagOpen: false,
    real: Date.now(),
    db,
  };
  let originX = 0;

  function layoutOf() {
    const top = HUD_TOP + HUD_H + 12;
    const width = Math.min(SCREEN_WIDTH - 36, 380);
    const height = Math.min(SCREEN_HEIGHT - top - SAFE_BOTTOM - 148, 460);
    return {
      width,
      height,
      x: (SCREEN_WIDTH - width) / 2,
      y: top,
    };
  }

  function show(card) {
    state.card = card;
    state.dragX = 0;
    state.fly = 0;
    state.busy = false;
  }

  wx.onTouchStart((event) => {
    if (!state.ready || state.busy || !state.card) return;
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    const x = touch.clientX !== undefined ? touch.clientX : touch.x;
    const y = touch.clientY !== undefined ? touch.clientY : touch.y;
    const spots = state.hotspots || [];
    for (let i = spots.length - 1; i >= 0; i -= 1) {
      const spot = spots[i];
      if (x >= spot.x && y >= spot.y && x < spot.x + spot.w && y < spot.y + spot.h) {
        if (spot.id.indexOf('edit-') === 0) {
          const action = spot.id.slice(5);
          if (action === 'name') askName();
          else adjustSelf(db, action);
          return;
        }
        if (spot.id === 'bag-open') {
          state.mapOpen = false;
          state.personOpen = false;
          state.bagOpen = true;
          return;
        }
        if (spot.id === 'bag-close') {
          state.bagOpen = false;
          return;
        }
        if (spot.id === 'map-open') {
          state.personOpen = false;
          state.mapOpen = true;
          return;
        }
        if (spot.id === 'person-open') {
          state.mapOpen = false;
          state.personOpen = true;
          return;
        }
        if (spot.id === 'person-close') {
          state.personOpen = false;
          return;
        }
        if (spot.id === 'day-next') {
          state.flyDir = 1;
          commit();
          return;
        }
        if (spot.id === 'map-here') {
          state.mapOpen = false;
          return;
        }
        if (spot.id.indexOf('go-') === 0) {
          state.mapOpen = false;
          go(spot.id.slice(3));
          return;
        }
        if (state.mapOpen || state.personOpen || state.bagOpen || (state.life && state.life.creating)) return;
        beginFly(spot.id === 'choice-left' ? -1 : 1);
        return;
      }
    }
    if (state.mapOpen || state.personOpen || state.bagOpen || (state.life && state.life.creating)) return;
    if (state.card && state.card.type === 'page') return;
    const view = state.view;
    if (x >= view.x && x <= view.x + view.width && y >= view.y && y <= view.y + view.height) {
      state.dragging = true;
      originX = x;
    }
  });
  if (wx.onTouchMove) {
    wx.onTouchMove((event) => {
      if (!state.dragging) return;
      const touch = event.touches && event.touches[0];
      if (!touch) return;
      const x = touch.clientX !== undefined ? touch.clientX : touch.x;
      state.dragX = clamp(x - originX, -SCREEN_WIDTH, SCREEN_WIDTH);
    });
  }
  if (wx.onTouchEnd) {
    wx.onTouchEnd(() => {
      if (!state.dragging || state.busy) return;
      state.dragging = false;
      if (Math.abs(state.dragX) > state.view.width * 0.22) beginFly(state.dragX < 0 ? -1 : 1);
    });
  }
  if (wx.onHide) wx.onHide(() => { if (state.ready) touchLife(db, Date.now()); });

  function askName() {
    const current = state.life && state.life.person ? state.life.person.name : '';
    if (!wx.showKeyboard) {
      adjustSelf(db, 'name');
      return;
    }
    state.naming = true;
    wx.showKeyboard({ defaultValue: current || '', maxLength: 8, confirmType: 'done' });
  }
  if (wx.onKeyboardConfirm) {
    wx.onKeyboardConfirm((res) => {
      if (!state.naming) return;
      state.naming = false;
      const value = res && res.value !== undefined ? res.value : '';
      if (String(value).trim()) adjustSelf(db, 'name', String(value).trim());
      if (wx.hideKeyboard) wx.hideKeyboard();
    });
  }

  function go(placeId) {
    if (state.busy || !state.card) return;
    if (state.card.type === 'page' || state.card.type === 'letter' || state.card.type === 'night') return;
    const result = travelTo(db, placeId, Date.now());
    if (!result || !result.next) return;
    state.busy = true;
    if (result.say) {
      show({
        id: 'trace',
        type: 'trace',
        text: result.say,
        trace: true,
        next: result.next,
        left: { label: '记下了' },
        right: { label: '去下一件' },
      });
      return;
    }
    show(result.next);
  }

  function beginFly(dir) {
    if (state.busy || !state.card) return;
    state.busy = true;
    state.dragging = false;
    state.flyDir = dir;
    state.fly = 0.01;
    if (wx.vibrateShort) {
      try { wx.vibrateShort({ type: 'light' }); } catch (err) { /* 没有震动也不影响滑动 */ }
    }
  }

  function commit() {
    if (state.card && state.card.trace) {
      const next = state.card.next;
      state.echo = '';
      state.echoUntil = 0;
      show(next);
      return;
    }
    const result = choose(db, state.card, state.flyDir, Date.now());
    db.run('update player set onboarded=? where id=1', [1]);
    touchLife(db, Date.now());
    if (!result.ok) {
      state.echo = result.say;
      state.echoUntil = Date.now() + 1600;
      state.dragX = 0;
      state.fly = 0;
      state.busy = false;
      return;
    }
    if (result.say) {
      state.echo = '';
      state.echoUntil = 0;
      show({
        id: 'trace',
        type: 'trace',
        text: result.say,
        trace: true,
        next: result.next,
        left: { label: '记下了' },
        right: { label: '去下一件' },
      });
      return;
    }
    show(result.next);
  }

  loadGameArt().then((art) => {
    state.art = art;
    show(ensureToday(db, Date.now()));
    touchLife(db, Date.now());
    state.ready = true;
  }).catch(() => {
    state.failed = true;
  });

  function frame() {
    state.real = Date.now();
    state.view = layoutOf();
    state.life = snapshotLife(db, state.card);
    state.period = periodName(state.life.clock || 420);
    if (state.fly) {
      state.fly += 0.08;
      state.dragX = state.flyDir * (state.view.width * 0.25 + state.fly * state.view.width * 1.35);
    } else if (!state.dragging && state.dragX) {
      state.dragX *= 0.72;
      if (Math.abs(state.dragX) < 0.6) state.dragX = 0;
    }
    render(state);
    if (state.fly >= 1) commit();
  }

  return {
    frame,
    get snapshot() {
      return Object.assign({ ready: state.ready, echo: state.echo }, state.life || snapshotLife(db, state.card));
    },
    get hotspots() {
      return state.hotspots || [];
    },
  };
}
