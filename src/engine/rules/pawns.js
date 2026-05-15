import { insideBoard, sameSide } from '../coordinates.js';

export function getPawnMoves(board, x, y) {
  const piece = board[y][x];
  const red = piece.startsWith('r');

  const moves = [];

  const dirs = [];

  dirs.push([0, red ? -1 : 1]);

  const crossedRiver = red ? y <= 4 : y >= 5;

  if (crossedRiver) {
    dirs.push([1,0]);
    dirs.push([-1,0]);
  }

  for (const [dx,dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;

    if (!insideBoard(nx, ny)) continue;

    const target = board[ny][nx];

    if (!target || !sameSide(piece, target)) {
      moves.push({ from:{x,y}, to:{x:nx,y:ny} });
    }
  }

  return moves;
}