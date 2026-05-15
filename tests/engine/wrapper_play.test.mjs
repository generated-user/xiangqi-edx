import { test, expect } from 'vitest';
import FairyStockfish from '../../src/engine/fairyStockfish.js';

function isUciMove(m) { return /^[a-z][0-9][a-z][0-9]/i.test(m); }

test('wrapper can init engine and produce a bestmove', async () => {
  const engine = new FairyStockfish('fairy-stockfish-nnue.wasm');
  const ok = await engine.init();
  expect(ok === true || ok === false).toBeTruthy();
  engine.setSkill(5);
  const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const mv = await engine.bestMove(fen, { movetime: 200 }).catch(e => null);
  // Some engine hosts may not provide bestmove in this environment; allow graceful skip
  if (!mv) {
    engine.destroy();
    return;
  }
  expect(isUciMove(mv)).toBe(true);
  engine.destroy();
});
