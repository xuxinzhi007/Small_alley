export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = wx.createImage();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(src));
    image.src = src;
  });
}

export function loadGameArt() {
  return loadImage('images/hero.png').then((hero) => ({ hero }));
}
