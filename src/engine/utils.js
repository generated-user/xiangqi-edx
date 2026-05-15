import { cloneBoard as boardClone } from './board.js';
import { BOARD_HEIGHT, BOARD_WIDTH } from './constants';

export function isInsideBoard(x, y) {
  return (
    x >= 0 &&
    x < BOARD_WIDTH &&
    y >= 0 &&
    y < BOARD_HEIGHT
  );
}

// Delegate to board.js clone implementation to ensure consistency
export function cloneBoard(board) {
  return boardClone(board);
}

// These helpers expect piece string codes (e.g., 'rk', 'bp').
export function isEnemyPiece(a, b) {
  if (!a || !b) return false;
  return a[0] !== b[0];
}

export function isFriendlyPiece(a, b) {
  if (!a || !b) return false;
  return a[0] === b[0];
}