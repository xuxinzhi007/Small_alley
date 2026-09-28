import './js/render.js';
import { createGame } from './js/game.js';

const game = createGame();

function loop(now) {
  game.frame(now);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
