import { XiangqiGame } from '../../src/engine/XiangqiGame.js';

function createEmptyBoard() {
  const board = [];
  for (let y = 0; y < 10; y++) {
    const row = new Array(9).fill(null);
    board.push(row);
  }
  return board;
}

function assert(condition, msg) {
  if (!condition) {
    console.error('ASSERTION FAILED:', msg);
    process.exit(1);
  }
}

// Test 1: simple vertical rook check
const game = new XiangqiGame();
const board = createEmptyBoard();

// place red general at e10 (x=4,y=9)
board[9][4] = 'rk';
// place black rook at e1 (x=4,y=0) with no blocking pieces
board[0][4] = 'br';

game.board = board;

console.log('Board setup for vertical rook check created.');

const inCheck = game.isInCheck('red');
console.log('isInCheck(red) =>', inCheck);
assert(inCheck === true, 'Expected red to be in check from vertical rook');

// Test 2: not in check when rook is moved away
board[0][4] = null;
board[0][3] = 'br'; // rook on d1
game.board = board;
const inCheck2 = game.isInCheck('red');
console.log('isInCheck(red) after moving rook =>', inCheck2);
assert(inCheck2 === false, 'Expected red NOT to be in check when rook not on same file');

console.log('All check tests passed.');

process.exit(0);
