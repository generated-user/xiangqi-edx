import { createInitialBoard } from './board.js';
import { generateLegalMoves, getPseudoLegalMovesForPiece } from './validation/legalMoves.js';
import { isInCheck as boardIsInCheck } from './validation/check.js';
import { parseFEN, generateFEN } from './fen.js';
import { parsePGN, generatePGN } from './pgn.js';

export class XiangqiGame {
  constructor() {
    this.board = createInitialBoard();
    this.currentTurn = 'red';
    // move history: array of { move, movedPiece, captured }
    this.history = [];
    // next index to apply (for redo). historyIndex === history.length means at end
    this.historyIndex = 0;
  }

  loadFEN(fen) {
    const pos = parseFEN(fen);
    this.board = pos.board;
    this.currentTurn = pos.currentTurn;
    // reset history when loading a new position
    this.history = [];
    this.historyIndex = 0;
  }

  toFEN() {
    return generateFEN(this.board, this.currentTurn);
  }

  // Apply a move and optionally record it in history for undo/redo.
  applyMove(move, record = true) {
    const fromPiece = this.board[move.from.y][move.from.x];
    const toPiece = this.board[move.to.y][move.to.x];
    // perform move
    this.board[move.to.y][move.to.x] = fromPiece;
    this.board[move.from.y][move.from.x] = null;

    // record
    if (record) {
      // if we've undone some moves and then make a new move, truncate future
      if (this.historyIndex < this.history.length) {
        this.history.splice(this.historyIndex);
      }
      this.history.push({ move, movedPiece: fromPiece, captured: toPiece });
      this.historyIndex++;
    }

    // toggle turn
    this.currentTurn = this.currentTurn === 'red' ? 'black' : 'red';
  }

  undo() {
    if (this.historyIndex === 0) return false;
    const entry = this.history[this.historyIndex - 1];
    const { move, movedPiece, captured } = entry;
    // revert
    this.board[move.from.y][move.from.x] = movedPiece;
    this.board[move.to.y][move.to.x] = captured || null;
    this.historyIndex--;
    // whose turn after undo: the side that moved
    this.currentTurn = movedPiece && movedPiece[0] === 'r' ? 'red' : 'black';
    return true;
  }

  redo() {
    if (this.historyIndex >= this.history.length) return false;
    const entry = this.history[this.historyIndex];
    const { move, movedPiece, captured } = entry;
    // reapply
    this.board[move.to.y][move.to.x] = movedPiece;
    this.board[move.from.y][move.from.x] = null;
    this.historyIndex++;
    // after redo, turn is opponent
    this.currentTurn = movedPiece && movedPiece[0] === 'r' ? 'black' : 'red';
    return true;
  }

  exportPGN() {
    // export recorded moves up to historyIndex
    const moves = this.history.slice(0, this.historyIndex).map(h => h.move);
    return generatePGN(moves);
  }

  loadPGN(pgn, options = {}) {
    // options: { startFEN } optional starting position
    if (options.startFEN) this.loadFEN(options.startFEN);
    const moves = parsePGN(pgn);
    for (const m of moves) this.applyMove(m, true);
  }

  getPiece(x, y) {
    return this.board[y][x];
  }

  getLegalMoves(x, y) {
    const moves = generateLegalMoves(this.board, this.currentTurn);

    return moves.filter(m => m.from.x === x && m.from.y === y);
  }

  getLegalMovesForSquare(x, y, side = this.currentTurn) {
    const moves = generateLegalMoves(this.board, side);
    return moves.filter(m => m.from.x === x && m.from.y === y);
  }

  getPseudoLegalMovesForSquare(x, y) {
    return getPseudoLegalMovesForPiece(this.board, x, y);
  }

  isInCheck(side) {
    return boardIsInCheck(this.board, side);
  }

  isCheckmate(side) {
    const inCheck = this.isInCheck(side);
    const legal = generateLegalMoves(this.board, side);
    return inCheck && legal.length === 0;
  }

  isStalemate(side) {
    const inCheck = this.isInCheck(side);
    const legal = generateLegalMoves(this.board, side);
    return !inCheck && legal.length === 0;
  }

  getAllLegalMoves(side = this.currentTurn) {
    return generateLegalMoves(this.board, side);
  }

  isMoveLegal(move, side = this.currentTurn) {
    const legal = generateLegalMoves(this.board, side);
    return legal.some(m => (
      m.from.x === move.from.x && m.from.y === move.from.y &&
      m.to.x === move.to.x && m.to.y === move.to.y
    ));
  }

  makeMove(move) {
    if (typeof process !== 'undefined' && process.env && process.env.XQ_DEBUG_MOVES) {
      // minimal logging to help diagnose disappear-on-capture issues
      console.log('XiangqiGame.makeMove', move);
      console.log('from before:', this.board[move.from.y][move.from.x]);
      console.log('to before:', this.board[move.to.y][move.to.x]);
    }

    this.board[move.to.y][move.to.x] = this.board[move.from.y][move.from.x];
    this.board[move.from.y][move.from.x] = null;

    this.currentTurn = this.currentTurn === 'red' ? 'black' : 'red';

    if (typeof process !== 'undefined' && process.env && process.env.XQ_DEBUG_MOVES) {
      console.log('from after:', this.board[move.from.y][move.from.x]);
      console.log('to after:', this.board[move.to.y][move.to.x]);
    }
  }
}