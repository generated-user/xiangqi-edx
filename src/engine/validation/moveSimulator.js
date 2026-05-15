import { cloneBoard } from '../board.js';

export function simulateMove(board, move) {
  const next = cloneBoard(board);

  next[move.to.y][move.to.x] = next[move.from.y][move.from.x];
  next[move.from.y][move.from.x] = null;

  return next;
}