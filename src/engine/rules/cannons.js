import { insideBoard, sameSide } from '../coordinates.js';

export function getCannonMoves(board, x, y) {
  const piece = board[y][x];
  const moves = [];

  const dirs = [
    [1,0],
    [-1,0],
    [0,1],
    [0,-1]
  ];

  for (const [dx,dy] of dirs) {
    let nx = x + dx;
    let ny = y + dy;

    let jumped = false;

    while (insideBoard(nx, ny)) {
      const target = board[ny][nx];

      if (!jumped) {
        if (!target) {
          moves.push({ from:{x,y}, to:{x:nx,y:ny} });
        } else {
          jumped = true;
        }
      } else {
        if (target) {
          if (!sameSide(piece, target)) {
            moves.push({ from:{x,y}, to:{x:nx,y:ny} });
          }
          break;
        }
      }

      nx += dx;
      ny += dy;
    }
  }

  return moves;
}