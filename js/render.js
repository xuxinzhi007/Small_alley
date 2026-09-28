const canvas = wx.createCanvas();
GameGlobal.canvas = canvas;

const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
const dpr = windowInfo.pixelRatio || 1;

canvas.width = windowInfo.screenWidth * dpr;
canvas.height = windowInfo.screenHeight * dpr;

export const SCREEN_WIDTH = windowInfo.screenWidth;
export const SCREEN_HEIGHT = windowInfo.screenHeight;
export const SAFE_TOP = Math.max(
  (windowInfo.safeArea && windowInfo.safeArea.top) || 0,
  windowInfo.statusBarHeight || 0,
);
export const SAFE_BOTTOM = windowInfo.safeArea
  ? Math.max(0, windowInfo.screenHeight - windowInfo.safeArea.bottom)
  : 0;

function capsuleBottom() {
  try {
    if (wx.getMenuButtonBoundingClientRect) {
      const box = wx.getMenuButtonBoundingClientRect();
      if (box && box.bottom) return box.bottom;
    }
  } catch (err) {
    // 开发者工具偶尔量不到胶囊，退回状态栏下面
  }
  return SAFE_TOP + 48;
}

export const HUD_TOP = capsuleBottom() + 12;
export const HUD_H = 164;

export const ctx = canvas.getContext('2d');
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
ctx.imageSmoothingEnabled = false;
