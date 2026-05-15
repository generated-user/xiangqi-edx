import { sameSide } from '../coordinates.js';

const deltas = [
  [1,1],
  [1,-1],
  [-1,1],
  [-1,-1]
];

function inPalace(red, x, y) {
  if (x < 3 || x > 5) return false;

  if (red) {
    return y >= 7 && y <= 9;
  }

  return y >= 0 && y <= 2;
}

export function getAdvisorMoves(board, x, y) {
  const piece = board[y][x];
  const red = piece.startsWith('r');

  const moves = [];

  for (const [dx,dy] of deltas) {
    const nx = x + dx;
    const ny = y + dy;

    if (!inPalace(red, nx, ny)) continue;

    const target = board[ny][nx];

    if (!target || !sameSide(piece, target)) {
      moves.push({ from:{x,y}, to:{x:nx,y:ny} });
    }
  }

  return moves;
}