import './js/render.js';
import { createCardGame } from './js/card-game.js';

const game = createCardGame();

function loop(now) {
  game.frame(now);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
