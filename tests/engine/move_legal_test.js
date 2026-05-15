import { XiangqiGame } from '../../src/engine/XiangqiGame.js';
import { createMove } from '../../src/engine/move.js';

function assert(condition, msg) {
  if (!condition) {
    console.error('ASSERTION FAILED:', msg);
    process.exit(1);
  }
}

const game = new XiangqiGame();

// Use initial board: try a legal pawn move for red at (0,6) -> (0,5)
const move = createMove(0, 6, 0, 5);
const legal = game.isMoveLegal(move, 'red');
console.log('isMoveLegal for red pawn 0,6->0,5 =>', legal);
assert(legal === true, 'Expected initial pawn move to be legal');

// Illegal: move black rook on a10 by red
const badMove = createMove(0, 0, 0, 1);
const legal2 = game.isMoveLegal(badMove, 'red');
console.log('isMoveLegal invalid (red moving black rook) =>', legal2);
assert(legal2 === false, 'Expected illegal move to be false');

console.log('Move legality tests passed.');
process.exit(0);
