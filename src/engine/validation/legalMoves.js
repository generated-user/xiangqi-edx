import { getRookMoves } from '../rules/rooks.js';
import { getHorseMoves } from '../rules/horses.js';
import { getElephantMoves } from '../rules/elephants.js';
import { getAdvisorMoves } from '../rules/advisors.js';
import { getGeneralMoves } from '../rules/generals.js';
import { getCannonMoves } from '../rules/cannons.js';
import { getPawnMoves } from '../rules/pawns.js';
import { simulateMove } from './moveSimulator.js';
import { isInCheck } from './check.js';

function sideMatches(piece, side) {
  if (!piece) return false;

  return side === 'red'
    ? piece.startsWith('r')
    : piece.startsWith('b');
}

export function getPseudoLegalMovesForPiece(board, x, y) {
  const piece = board[y][x];

  if (!piece) return [];

  const type = piece[1];

  switch(type) {
    case 'r': return getRookMoves(board, x, y);
    case 'h': return getHorseMoves(board, x, y);
    case 'e': return getElephantMoves(board, x, y);
    case 'a': return getAdvisorMoves(board, x, y);
    case 'k': return getGeneralMoves(board, x, y);
    case 'c': return getCannonMoves(board, x, y);
    case 'p': return getPawnMoves(board, x, y);
    default: return [];
  }
}

export function generatePseudoLegalMoves(board, side) {
  const moves = [];

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const piece = board[y][x];

      if (!sideMatches(piece, side)) continue;

      moves.push(...getPseudoLegalMovesForPiece(board, x, y));
    }
  }

  return moves;
}

export function generateLegalMoves(board, side) {
  const pseudo = generatePseudoLegalMoves(board, side);

  return pseudo.filter(move => {
    const next = simulateMove(board, move);
    return !isInCheck(next, side);
  });
}