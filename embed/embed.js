import { XiangqiGame } from '../src/engine/XiangqiGame.js';
import { BoardRenderer } from '../src/ui/BoardRenderer.js';
import { InteractionController } from '../src/ui/InteractionController.js';
import FairyStockfish from '../src/engine/fairyStockfish.js';

class EmbedAPI {
  constructor(container) {
    this.container = container;
    this.game = new XiangqiGame();
    this.renderer = new BoardRenderer(container, this.game);
    this.puzzleMode = { isActive: () => true, type: 'regular', locked: false };
    this.controller = new InteractionController(this.game, this.renderer, this.puzzleMode);
    this.engine = new FairyStockfish();
    this.onResult = null; // callback for external handlers
    this._initUI();
    this.renderer.render();
  }

  async initEngine() {
    try { await this.engine.init(); } catch (e) { console.warn('Engine init failed', e); }
  }

  _initUI() {
    const modeSelect = document.getElementById('modeSelect');
    modeSelect.addEventListener('change', (e) => this.setMode(e.target.value));
    document.getElementById('undo').addEventListener('click', () => { this.game.undo(); this.renderer.render(); });
    document.getElementById('redo').addEventListener('click', () => { this.game.redo(); this.renderer.render(); });
    document.getElementById('hint').addEventListener('click', async () => { const fen = this.game.toFEN(); try{ const best = await this.engine.bestMove(fen, { movetime: 300 }); this._showHint(best); }catch(e){ console.warn(e); } });
  }

  _showHint(best) {
    // simple mapping: engine returns coords like e2e4 or moves in UCI-like notation
    const el = document.getElementById('status');
    el.textContent = `Engine hint: ${best}`;
  }

  setMode(mode) {
    // map UI to puzzleMode types understood by InteractionController
    if (mode === 'free') this.puzzleMode.type = 'free';
    else if (mode === 'rule') this.puzzleMode.type = 'rule';
    else if (mode === 'regular') this.puzzleMode.type = 'regular';
    else if (mode === 'puzzle') this.puzzleMode.type = 'regular';
    else if (mode === 'vs') this.puzzleMode.type = 'vs';
    this.renderer.render();
  }

  loadFEN(fen) {
    this.game.loadFEN(fen);
    this.renderer.render();
  }

  loadPuzzle(puzzle) {
    // puzzle: { startFEN, pgn: '1.e2e3 ...', description }
    if (puzzle.startFEN) this.loadFEN(puzzle.startFEN);
    this._puzzle = puzzle;
    this._puzzlePlayed = [];
    this.renderer.render();
  }

  async playPuzzleSequence() {
    if (!this._puzzle || !this._puzzle.pgn) return;
    // play moves from PGN sequentially using game's loadPGN but step-by-step for feedback
    const moves = this._puzzle.pgn.split(/\s+/).filter(Boolean);
    for (const mv of moves) {
      // parse simple algebraic or uci-like square pairs; find a matching legal move
      const moveObj = this._parseMoveString(mv);
      if (!moveObj) continue;
      if (this.game.isMoveLegal(moveObj, this.game.currentTurn)) {
        this.game.applyMove(moveObj, true);
        this.renderer.render();
        await new Promise(r=>setTimeout(r, 400));
      } else {
        if (this.onResult) this.onResult({ success: false, reason: 'expected legal move but not found', move: mv });
        return;
      }
    }
    if (this.onResult) this.onResult({ success: true });
  }

  _parseMoveString(str) {
    // Accept uci-like 'a0b0' or 'a0-b0' or algebraic fallback 'e2e4'
    const m = str.match(/^([a-i][0-9])[-]?(?:to)?([a-i][0-9])$/i);
    if (!m) return null;
    const from = this._sqToXY(m[1]);
    const to = this._sqToXY(m[2]);
    return { from, to };
  }

  _sqToXY(sq) {
    // expects file a-i (x 0..8), rank 0..9 given as digit
    const file = sq[0].toLowerCase().charCodeAt(0) - 97;
    const rank = Number(sq[1]);
    return { x: file, y: rank };
  }

  async bestMoveForCurrentPosition(opts = {}) {
    const fen = this.game.toFEN();
    return this.engine.bestMove(fen, opts);
  }

  reportToParent(payload) {
    // posts puzzle results to embedding parent (edX bridge should listen)
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: 'xiangqi-embed', payload }, '*');
    }
  }
}

// Auto-initialize when loaded as an iframe page
const container = document.getElementById('boardContainer');
const API = new EmbedAPI(container);
window.XiangqiEmbed = API;

// Check query param for description file
const params = new URLSearchParams(location.search);
const desc = params.get('desc');
if (desc) {
  fetch(desc).then(r=>r.json()).then(p => { API.loadPuzzle(p); document.getElementById('status').textContent = p.description || 'Puzzle loaded'; }).catch(e=>console.warn(e));
}

// expose a small, stable API for host pages (edX wrapper)
export default window.XiangqiEmbed;
