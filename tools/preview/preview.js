const canvas = document.querySelector('#game');
const status = document.querySelector('#status');
const keyboard = document.querySelector('#keyboard');
const nameInput = document.querySelector('#name');
const prefix = 'little-lane-preview:';
const listeners = {};
const windowInfo = {
  screenWidth: 390, screenHeight: 844, windowWidth: 390, windowHeight: 844,
  pixelRatio: window.devicePixelRatio || 1, statusBarHeight: 47,
  safeArea: { top: 47, bottom: 810, left: 0, right: 390, width: 390, height: 763 },
};

function emit(name, data) {
  for (const listener of listeners[name] || []) listener(data);
}

function report(error) {
  status.textContent = `预览错误：${error.message || error}`;
}

window.GameGlobal = window;
window.wx = {
  createCanvas: () => canvas,
  getWindowInfo: () => windowInfo,
  getSystemInfoSync: () => windowInfo,
  getMenuButtonBoundingClientRect: () => ({ top: 48, bottom: 84, left: 296, right: 384, width: 88, height: 36 }),
  createImage() {
    const image = new Image();
    // 微信资源路径相对于项目根目录，而预览入口位于 tools 内。
    Object.defineProperty(image, 'src', {
      get() { return image.getAttribute('src') || ''; },
      set(value) { image.setAttribute('src', new URL(value, new URL('../../', import.meta.url)).href); },
    });
    return image;
  },
  getStorageSync(key) {
    const raw = localStorage.getItem(prefix + key);
    return raw === null ? '' : JSON.parse(raw);
  },
  setStorageSync(key, value) { localStorage.setItem(prefix + key, JSON.stringify(value)); },
  vibrateShort() {},
  showKeyboard(options) {
    nameInput.value = options.defaultValue || '';
    nameInput.maxLength = options.maxLength || 8;
    keyboard.returnValue = '';
    keyboard.showModal();
    nameInput.focus();
  },
  hideKeyboard() { keyboard.close(); },
};
for (const name of ['TouchStart', 'TouchMove', 'TouchEnd', 'TouchCancel', 'Hide', 'Show', 'KeyboardConfirm', 'KeyboardInput', 'KeyboardComplete']) {
  wx[`on${name}`] = (listener) => { (listeners[name] ||= []).push(listener); };
}

let pointer = null;
function touch(event) {
  const rect = canvas.getBoundingClientRect();
  const clientX = (event.clientX - rect.left) * windowInfo.screenWidth / rect.width;
  const clientY = (event.clientY - rect.top) * windowInfo.screenHeight / rect.height;
  return { identifier: event.pointerId, clientX, clientY, pageX: clientX, pageY: clientY };
}
canvas.addEventListener('pointerdown', (event) => {
  if (pointer !== null || event.button !== 0) return;
  event.preventDefault();
  pointer = event.pointerId;
  canvas.setPointerCapture(pointer);
  const point = touch(event);
  emit('TouchStart', { touches: [point], changedTouches: [point] });
});
canvas.addEventListener('pointermove', (event) => {
  if (pointer !== event.pointerId) return;
  const point = touch(event);
  emit('TouchMove', { touches: [point], changedTouches: [point] });
});
function endPointer(event) {
  if (pointer !== event.pointerId) return;
  pointer = null;
  const point = touch(event);
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  emit(event.type === 'pointerup' ? 'TouchEnd' : 'TouchCancel', { touches: [], changedTouches: [point] });
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('lostpointercapture', endPointer);
nameInput.addEventListener('input', () => emit('KeyboardInput', { value: nameInput.value }));
keyboard.addEventListener('close', () => {
  const result = { value: nameInput.value };
  if (keyboard.returnValue === 'confirm') emit('KeyboardConfirm', result);
  emit('KeyboardComplete', result);
});
document.addEventListener('visibilitychange', () => emit(document.hidden ? 'Hide' : 'Show', {}));
window.addEventListener('pagehide', () => emit('Hide', {}));
window.addEventListener('error', (event) => report(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => report(event.reason));
document.querySelector('#reset').addEventListener('click', () => {
  if (!window.confirm('清除当前浏览器的预览进度？微信存档不受影响。')) return;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(prefix)) localStorage.removeItem(key);
  }
  window.location.reload();
});

try {
  await import('../../game.js');
  status.textContent = '已启动 · 微信专有能力需使用开发者工具和真机验证。';
} catch (error) {
  report(error);
}
