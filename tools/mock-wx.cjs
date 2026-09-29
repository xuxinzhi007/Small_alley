const store = {};

function ctx() {
  return {
    font: '16px sans-serif',
    fillStyle: '#000',
    strokeStyle: '#000',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    lineWidth: 1,
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    setTransform() {},
    fillRect() {},
    drawImage() {},
    beginPath() {},
    rect() {},
    bezierCurveTo() {},
    createRadialGradient() { return { addColorStop() {} }; },
    moveTo() {},
    lineTo() {},
    arcTo() {},
    arc() {},
    closePath() {},
    clip() {},
    rotate() {},
    fill() {},
    stroke() {},
    strokeRect() {},
    fillText() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    measureText(text) {
      const match = /(\d+)px/.exec(this.font || '');
      const px = match ? Number(match[1]) : 16;
      return { width: String(text).length * px };
    },
  };
}

const canvas = {
  width: 390,
  height: 844,
  getContext: () => ctx(),
};

global.GameGlobal = { canvas };
global.canvas = canvas;
global.wx = {
  createCanvas: () => canvas,
  getWindowInfo: () => ({
    screenWidth: 390,
    screenHeight: 844,
    pixelRatio: 2,
    statusBarHeight: 47,
    safeArea: { top: 47, bottom: 810, left: 0, right: 390 },
  }),
  createImage: () => {
    const image = {
      onload: null,
      onerror: null,
      _src: '',
    };
    Object.defineProperty(image, 'src', {
      set(value) {
        image._src = value;
        if (image.onload) image.onload();
      },
    });
    return image;
  },
  getStorageSync: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? JSON.parse(JSON.stringify(store[key])) : ''),
  setStorageSync: (key, value) => {
    store[key] = JSON.parse(JSON.stringify(value));
  },
  onTouchStart: (fn) => {
    global.__down = fn;
  },
  onTouchMove: (fn) => {
    global.__move = fn;
  },
  onTouchEnd: (fn) => {
    global.__up = fn;
  },
  onTouchCancel(fn) { global.__cancel = fn; },
  onHide(fn) { global.__hide = fn; },
  onShow(fn) { global.__show = fn; },
  onKeyboardComplete(fn) { global.__complete = fn; },
  getMenuButtonBoundingClientRect: () => ({ top: 48, bottom: 84, left: 296, right: 384, width: 88, height: 32 }),
  showKeyboard() {},
  hideKeyboard() {},
  onKeyboardConfirm(fn) { global.__key = fn; },
  onKeyboardInput() {},
};

global.__store = store;
