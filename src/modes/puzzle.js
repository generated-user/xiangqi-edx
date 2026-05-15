import { parseFEN } from '../engine/fen.js';
import { generateLegalMoves, getPseudoLegalMovesForPiece } from '../engine/validation/legalMoves.js';
import { isInCheck } from '../engine/validation/check.js';
import { simulateMove } from '../engine/validation/moveSimulator.js';

export class PuzzleMode {
  constructor(game) {
    this.game = game;
    this.type = 'normal'; // normal | free | rule | regular | vs
    this.solution = [];
    this.solutionIndex = 0;
    this.startFEN = null;
    this.onFeedback = null; // callback({ valid, message, detail })
    this.locked = false; // when true, no further moves allowed until cleared
  }

  setMode(type, opts = {}) {
    this.type = type || 'normal';
    this.locked = false;
    if (opts.startFEN) {
      this.startFEN = opts.startFEN;
      if (this.game.loadFEN) this.game.loadFEN(this.startFEN);
    }
    // when entering free mode, set a minimal single-rook position for experimentation
    if (this.type === 'free') {
      // create empty 10x9 board
      const board = Array.from({ length: 10 }, () => Array(9).fill(null));
      const centerX = 4; const centerY = 4;
      const side = this.game.currentTurn === 'black' ? 'b' : 'r';
      board[centerY][centerX] = `${side}r`;
      if (this.game.board) this.game.board = board;
      if (this.game.history) { this.game.history = []; this.game.historyIndex = 0; }
    }
    if (opts.solution) {
      this.solution = opts.solution;
      this.solutionIndex = 0;
    }
    if (this.onModeChange) this.onModeChange(this.type);
  }

  isActive() {
    return this.type !== 'normal';
  }

  // Called after a move was made (the move already applied to the game)
  // preBoard: { board, currentTurn }
  onMoveMade(move, preBoard) {
    const pre = preBoard && preBoard.board ? preBoard.board : this.game.board;
    const side = preBoard && preBoard.currentTurn ? preBoard.currentTurn : this.game.currentTurn;

    if (this.type === 'free') {
      // For free mode: allow moving any piece regardless of turn.
      // Determine the piece at the source square on the pre-move board and use its side for legality checks.
      const piece = (pre && pre[move.from.y]) ? pre[move.from.y][move.from.x] : null;
      if (!piece) return this._feedback({ valid: false, message: 'No piece at source' });
      const pieceSide = piece[0] === 'r' ? 'red' : 'black';
      const legal = generateLegalMoves(pre, pieceSide);
      const ok = legal.some(m => m.from.x === move.from.x && m.from.y === move.from.y && m.to.x === move.to.x && m.to.y === move.to.y);
      if (ok) {
        this._feedback({ valid: true, message: 'Legal move' });
      } else {
        // provide legal moves for this piece as guidance
        const candidates = legal.filter(m => m.from.x === move.from.x && m.from.y === move.from.y);
        this._feedback({ valid: false, message: 'Illegal move', detail: { legalMoves: candidates, from: move.from } });
      }
      return;
    }

    if (this.type === 'rule') {
      // Move must conform to piece movement rules on the pre-move board
      const pseudo = getPseudoLegalMovesForPiece(pre, move.from.x, move.from.y) || [];
      const ok = pseudo.some(m => m.to.x === move.to.x && m.to.y === move.to.y);
      if (!ok) return this._feedback({ valid: false, message: 'Move violates piece movement rules', detail: { pseudoMoves: pseudo } });
      // Also require the move to escape check for the moving side: simulate the move on pre-board
      const next = simulateMove(pre, move);
      const stillInCheck = isInCheck(next, side);
      if (stillInCheck) {
        // compute legal escapes from this source (if any)
        const legal = generateLegalMoves(pre, side) || [];
        const escapes = legal.filter(m => m.from.x === move.from.x && m.from.y === move.from.y);
        return this._feedback({ valid: false, message: 'Still in check', detail: { legalMoves: escapes } });
      }
      this._feedback({ valid: true, message: 'Move escapes check' });
      return;
    }

    if (this.type === 'regular') {
      // Compare to expected solution move
      const expected = this.solution[this.solutionIndex];
      if (!expected) return this._feedback({ valid: false, message: 'No solution step configured' });
      const match = expected.from.x === move.from.x && expected.from.y === move.from.y && expected.to.x === move.to.x && expected.to.y === move.to.y;
      if (match) {
        this.solutionIndex++;
        this._feedback({ valid: true, message: 'Correct move' });
      } else {
        this._feedback({ valid: false, message: 'Incorrect move' });
      }
      return;
    }

    if (this.type === 'vs') {
      // For now, just acknowledge move; computer integration later
      this._feedback({ valid: true, message: 'Move played; computer move coming (stub)' });
      return;
    }
  }

  _feedback(obj) {
    if (this.onFeedback) this.onFeedback(obj);
    // lock puzzle on illegal moves (so user must undo/clear)
    if (obj && obj.valid === false) this.locked = true;
  }

  clearLock() {
    this.locked = false;
    if (this.onFeedback) this.onFeedback({ valid: true, message: 'Cleared' });
  }
}

export default PuzzleMode;
