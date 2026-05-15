import { generatePseudoLegalMoves } from './legalMoves.js';

export function findGeneral(board, side) {
  const target = side === 'red' ? 'rk' : 'bk';

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      if (board[y][x] === target) {
        return {x,y};
      }
    }
  }

  return null;
}

export function flyingGeneral(board) {
  let red = null;
  let black = null;

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      if (board[y][x] === 'rk') red = {x,y};
      if (board[y][x] === 'bk') black = {x,y};
    }
  }

  if (!red || !black) return false;
  if (red.x !== black.x) return false;

  const x = red.x;
  const min = Math.min(red.y, black.y);
  const max = Math.max(red.y, black.y);

  for (let y = min + 1; y < max; y++) {
    if (board[y][x]) {
      return false;
    }
  }

  return true;
}

export function isInCheck(board, side) {
  const general = findGeneral(board, side);

  // If the general is missing (invalid board), treat as not in check
  if (!general) return false;

  const enemy = side === 'red' ? 'black' : 'red';

  const enemyMoves = generatePseudoLegalMoves(board, enemy);

  for (const move of enemyMoves) {
    if (move.to.x === general.x && move.to.y === general.y) {
      return true;
    }
  }

  // Also consider flying general (direct face)
  return flyingGeneral(board);
}