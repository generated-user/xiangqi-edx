import { sameSide } from '../coordinates.js';

function inPalace(red, x, y) {
  if (x < 3 || x > 5) return false;

  if (red) {
    return y >= 7 && y <= 9;
  }

  return y >= 0 && y <= 2;
}

export function getGeneralMoves(board, x, y) {
  const piece = board[y][x];
  const red = piece.startsWith('r');

  const deltas = [
    [1,0],
    [-1,0],
    [0,1],
    [0,-1]
  ];

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