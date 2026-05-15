import { insideBoard, sameSide } from '../coordinates.js';

const patterns = [
  { leg:[0,-1], move:[-1,-2] },
  { leg:[0,-1], move:[1,-2] },
  { leg:[1,0], move:[2,-1] },
  { leg:[1,0], move:[2,1] },
  { leg:[0,1], move:[-1,2] },
  { leg:[0,1], move:[1,2] },
  { leg:[-1,0], move:[-2,-1] },
  { leg:[-1,0], move:[-2,1] }
];

export function getHorseMoves(board, x, y) {
  const piece = board[y][x];
  const moves = [];

  for (const p of patterns) {
    const lx = x + p.leg[0];
    const ly = y + p.leg[1];

    if (!insideBoard(lx, ly)) continue;
    if (board[ly][lx]) continue;

    const nx = x + p.move[0];
    const ny = y + p.move[1];

    if (!insideBoard(nx, ny)) continue;

    const target = board[ny][nx];

    if (!target || !sameSide(piece, target)) {
      moves.push({ from:{x,y}, to:{x:nx,y:ny} });
    }
  }

  return moves;
}