import { insideBoard, sameSide } from '../coordinates.js';

export function addSlidingMoves(board, x, y, deltas) {
  const piece = board[y][x];
  const moves = [];

  for (const [dx, dy] of deltas) {
    let nx = x + dx;
    let ny = y + dy;

    while (insideBoard(nx, ny)) {
      const target = board[ny][nx];

      if (!target) {
        moves.push({ from:{x,y}, to:{x:nx,y:ny} });
      } else {
        if (!sameSide(piece, target)) {
          moves.push({ from:{x,y}, to:{x:nx,y:ny} });
        }
        break;
      }

      nx += dx;
      ny += dy;
    }
  }

  return moves;
}