import { XiangqiGame } from '../src/engine/XiangqiGame.js';

function printBoard(game) {
  console.log(game.board.map(row => row.map(c => c ? c : '..').join(' ')).join('\n'));
}

const g = new XiangqiGame();
console.log('Initial');
printBoard(g);

function move(fromX, fromY, toX, toY) {
  const move = { from: { x: fromX, y: fromY }, to: { x: toX, y: toY } };
  console.log(`\nMove ${fromX},${fromY} -> ${toX},${toY}`);
  g.makeMove(move);
  printBoard(g);
}

// Perform sequence P55 P56 Px56 -> interpret as
// P55: move piece at (5,5) to ??? But (5,5) initially is null in standard setup
// We'll try sequence that might reproduce: move (5,6) to (5,5), then (5,5) to (5,6), then capture from (??)
// To allow reproduction, list legal initial pieces and pick some moves. For now, show board only.

console.log('\nNo automatic moves executed; use this script to call move(...) interactively if needed');

export { g, move, printBoard };
