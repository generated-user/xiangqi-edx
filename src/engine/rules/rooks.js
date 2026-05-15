import { addSlidingMoves } from './shared.js';

export function getRookMoves(board, x, y) {
  return addSlidingMoves(board, x, y, [
    [1,0],
    [-1,0],
    [0,1],
    [0,-1]
  ]);
}