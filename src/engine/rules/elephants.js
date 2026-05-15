import { insideBoard, sameSide } from '../coordinates.js';

const moveset = [
  [2,2],
  [2,-2],
  [-2,2],
  [-2,-2]
];

export function getElephantMoves(board, x, y) {
  const piece = board[y][x];
  const red = piece.startsWith('r');
  const moves = [];

  for (const [dx,dy] of moveset) {
    const mx = x + dx/2;
    const my = y + dy/2;

    // must ensure the eye (midpoint) is on board and not blocked
    if (!insideBoard(mx, my)) continue;
    if (board[my][mx]) continue;

    const nx = x + dx;
    const ny = y + dy;

    if (!insideBoard(nx, ny)) continue;

    if (red && ny < 5) continue;
    if (!red && ny > 4) continue;

    const target = board[ny][nx];

    if (!target || !sameSide(piece, target)) {
      moves.push({ from:{x,y}, to:{x:nx,y:ny} });
    }
  }

  return moves;
}