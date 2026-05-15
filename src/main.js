import './styles/main.css';
import './styles/interaction.css';
import './styles/highlight.css';
import './styles/pieces.css';
import { XiangqiGame } from './engine/XiangqiGame.js';
import { BoardRenderer } from './ui/BoardRenderer.js';
import SvgBoard from './ui/SvgBoard.js';
import { InteractionController } from './ui/InteractionController.js';
import { PuzzleMode } from './modes/puzzle.js';
import { parsePGN } from './engine/pgn.js';
import FairyStockfish from './engine/fairyStockfish.js';
import { uciToMove, moveToUci } from './engine/uci.js';

const game = new XiangqiGame();

// board container inside app (status panel will live to the right)
const container = document.getElementById('board-container');

// prefer SVG renderer when available
const renderer = new SvgBoard(container, game);

// puzzle mode scaffold
const puzzleMode = new PuzzleMode(game);
// expose feedback to status area
puzzleMode.onFeedback = (fb) => {
	const el = document.getElementById('puzzle-feedback');
	if (!el) return;
	el.textContent = `${fb.message || ''}`;
	el.classList.remove('good','bad');
	if (fb.valid === true) el.classList.add('good');
	if (fb.valid === false) el.classList.add('bad');

	// clear any previous highlights
	if (renderer && renderer.clearHighlights) renderer.clearHighlights();

	// If feedback includes suggested moves, highlight them
	if (fb.detail && fb.detail.legalMoves && fb.detail.legalMoves.length) {
		if (renderer && renderer.showLegalMoves) renderer.showLegalMoves(fb.detail.legalMoves);
	  // show silhouette at origin if provided
	  let from = fb.detail.from;
	  if (!from && fb.detail.legalMoves && fb.detail.legalMoves.length) from = fb.detail.legalMoves[0].from;
	  if (!from && fb.detail.pseudoMoves && fb.detail.pseudoMoves.length) from = fb.detail.pseudoMoves[0].from;
	  if (fb.valid === false && from && renderer && renderer.showSilhouette) renderer.showSilhouette(from.x, from.y);
	} else if (fb.detail && fb.detail.pseudoMoves && fb.detail.pseudoMoves.length) {
		if (renderer && renderer.showLegalMoves) renderer.showLegalMoves(fb.detail.pseudoMoves);
	  // silhouette
	  let from = fb.detail.pseudoMoves[0].from;
	  if (fb.valid === false && from && renderer && renderer.showSilhouette) renderer.showSilhouette(from.x, from.y);
	}
};

// When in play-vs-computer mode, trigger engine reply after the player moves
puzzleMode.onMoveMade = async (move, preBoard) => {
	if (puzzleMode.type !== 'vs') return;
	try {
		// ensure engine ready
		await engine.init();
		// ask engine for a move on the current position
		const fen = game.toFEN();
		const best = await engine.bestMove(fen, { movetime: 300 });
		if (!best) return;
			// parse UCI move into internal coordinates, respecting board orientation
			const parsed = uciToMove(best, { flip: renderer && renderer.viewFrom === 'black' });
			if (!parsed) return;
			const compMove = { from: parsed.from, to: parsed.to, promotion: parsed.promotion };
		if (game.applyMove) game.applyMove(compMove, true);
		else game.makeMove(compMove);
		renderAndReapply();
		updateStatus();
	} catch (err) {
		console.error('Engine move failed', err);
	}
};

// interaction controller (keep reference so we can reapply selection after renders)
const controller = new InteractionController(game, renderer, puzzleMode);

// helper to render and reapply selection highlight
function renderAndReapply() {
	if (renderer && renderer.render) renderer.render();
	// reapply selection marker if controller has selection
	try {
		if (controller && controller.selected && renderer && renderer.highlightSelection) {
			renderer.highlightSelection(controller.selected.x, controller.selected.y);
		}
	} catch (e) {}
}

// initial render
renderAndReapply();

// optional engine integration: prefer the npm package `fairy-stockfish-nnue.wasm`
const engine = new FairyStockfish('fairy-stockfish-nnue.wasm');
engine.init().then((ok) => {
	console.log('FairyStockfish init', ok);
}).catch((err) => console.warn('FairyStockfish init failed', err));

// helper available in console to ask engine for best move on current position
window.askEngineBestMove = async (opts = {}) => {
	try {
		const fen = game.toFEN();
		const mv = await engine.bestMove(fen, opts);
		console.log('engine bestmove:', mv);
		return mv;
	} catch (err) {
		console.error('engine error', err);
		throw err;
	}
};

function updateStatus() {
	const turnEl = document.getElementById('turn-side');
	const checkEl = document.getElementById('in-check');
	const pgnOut = document.getElementById('pgn-output');
	if (turnEl) turnEl.textContent = game.currentTurn;
	if (checkEl) checkEl.textContent = game.isInCheck(game.currentTurn) ? 'yes' : 'no';
	if (pgnOut) pgnOut.value = game.exportPGN ? game.exportPGN() : '';
}

// initial status
updateStatus();

// expose for UI controllers to call after rendering
window.updateStatus = updateStatus;

// wire undo/redo/export/load controls
const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');
const exportBtn = document.getElementById('export-pgn');
const loadFenBtn = document.getElementById('load-fen');
const modeSelect = document.getElementById('mode-select');
const puzzleFeedback = document.getElementById('puzzle-feedback');
const clearFeedbackBtn = document.getElementById('clear-feedback');
if (undoBtn) undoBtn.addEventListener('click', () => { if (game.undo) game.undo(); renderAndReapply(); updateStatus(); });
if (redoBtn) redoBtn.addEventListener('click', () => { if (game.redo) game.redo(); renderAndReapply(); updateStatus(); });
if (exportBtn) exportBtn.addEventListener('click', () => { const out = document.getElementById('pgn-output'); if (out) out.value = game.exportPGN ? game.exportPGN() : ''; });
if (loadFenBtn) loadFenBtn.addEventListener('click', () => { const v = prompt('Enter FEN string'); if (v) { if (game.loadFEN) game.loadFEN(v); renderAndReapply(); updateStatus(); } });
if (modeSelect) modeSelect.addEventListener('change', (e) => {
	const v = e.target.value;
	puzzleMode.setMode(v);
	if (puzzleFeedback) puzzleFeedback.textContent = '';
	renderAndReapply();
	updateStatus();
});

// Puzzle controls: load PGN + start FEN, and step through solution
const loadPuzzleBtn = document.getElementById('load-puzzle');
const puzzlePgnInput = document.getElementById('puzzle-pgn');
const puzzleStartFen = document.getElementById('puzzle-start-fen');
const puzzleNextBtn = document.getElementById('puzzle-next');
const puzzlePrevBtn = document.getElementById('puzzle-prev');
const puzzleAutoplay = document.getElementById('puzzle-autoplay');
let _puzzleAutoId = null;

if (loadPuzzleBtn) loadPuzzleBtn.addEventListener('click', () => {
	const pgn = puzzlePgnInput && puzzlePgnInput.value ? puzzlePgnInput.value.trim() : '';
	const fen = puzzleStartFen && puzzleStartFen.value ? puzzleStartFen.value.trim() : null;
	const moves = parsePGN(pgn || '');
	if (!moves.length) {
		if (puzzleFeedback) puzzleFeedback.textContent = 'No moves parsed from PGN';
		return;
	}
	// set regular puzzle mode with parsed solution and optional start FEN
	puzzleMode.setMode('regular', { solution: moves, startFEN: fen });
	// if a start FEN was provided, game.loadFEN already called inside setMode
	renderAndReapply();
	updateStatus();
});

function _applySolutionStep(idx) {
	if (!puzzleMode || !Array.isArray(puzzleMode.solution)) return;
	const sol = puzzleMode.solution;
	if (idx < 0 || idx >= sol.length) return;
	const mv = sol[idx];
	// apply directly without validation (for stepping demo)
	if (game.applyMove) game.applyMove(mv, true);
	else game.makeMove(mv);
	puzzleMode.solutionIndex = idx + 1;
	renderAndReapply();
	updateStatus();
	if (puzzleMode.onFeedback) puzzleMode.onFeedback({ valid: true, message: `Applied solution step ${idx+1}` });
}

if (puzzleNextBtn) puzzleNextBtn.addEventListener('click', () => {
	const idx = puzzleMode.solutionIndex || 0;
	if (idx < (puzzleMode.solution || []).length) _applySolutionStep(idx);
});
if (puzzlePrevBtn) puzzlePrevBtn.addEventListener('click', () => {
	// undo one move
	if (game.undo) { game.undo(); renderAndReapply(); updateStatus(); }
});

if (puzzleAutoplay) puzzleAutoplay.addEventListener('change', (e) => {
	if (e.target.checked) {
		_puzzleAutoId = setInterval(() => {
			const idx = puzzleMode.solutionIndex || 0;
			if (idx < (puzzleMode.solution || []).length) _applySolutionStep(idx);
			else { clearInterval(_puzzleAutoId); _puzzleAutoId = null; puzzleAutoplay.checked = false; }
		}, 600);
	} else {
		if (_puzzleAutoId) { clearInterval(_puzzleAutoId); _puzzleAutoId = null; }
	}
});
if (clearFeedbackBtn) clearFeedbackBtn.addEventListener('click', () => { puzzleMode.clearLock(); if (puzzleFeedback) puzzleFeedback.textContent = ''; renderAndReapply(); updateStatus(); });

// Wire piece style radio controls
const controls = document.getElementById('controls');
// Engine skill control wiring
const engineSkill = document.getElementById('engine-skill');
const engineSkillValue = document.getElementById('engine-skill-value');
if (engineSkill) {
	engineSkill.addEventListener('input', (e) => {
		const v = Number(e.target.value || 0);
		if (engine && typeof engine.setSkill === 'function') engine.setSkill(v);
		if (engineSkillValue) engineSkillValue.textContent = String(v);
	});
	// apply initial
	if (engine && typeof engine.setSkill === 'function') engine.setSkill(Number(engineSkill.value || 10));
}
if (controls) {
	controls.addEventListener('change', (e) => {
		const v = e.target.value;
		const svg = document.querySelector('.svg-board');
		if (!svg) return;
		svg.classList.remove('piece-style-chinese','piece-style-assisted','piece-style-abbr');
		if (v === 'chinese') svg.classList.add('piece-style-chinese');
		if (v === 'assisted') svg.classList.add('piece-style-assisted');
		if (v === 'abbr') svg.classList.add('piece-style-abbr');
		// persist selection so renderer can reapply when re-creating SVG
		if (container) container.dataset.pieceStyle = v;
	});

	// optional flip-board checkbox (if present in UI)
	const flipBox = controls.querySelector('#flip-board');
	if (flipBox) {
		flipBox.addEventListener('change', (ev) => {
			renderer.viewFrom = ev.target.checked ? 'black' : 'red';
			renderAndReapply();
			updateStatus();
		});
	}
}

// Apply initial piece-style based on checked radio (so first render looks correct)
if (controls) {
	const checked = controls.querySelector('input[name="piece-style"]:checked');
	const svg = document.querySelector('.svg-board');
	if (checked) {
		const v = checked.value;
		// persist so SvgBoard can apply on initial render
		if (container) container.dataset.pieceStyle = v;
		if (svg) {
			svg.classList.remove('piece-style-chinese','piece-style-assisted','piece-style-abbr');
			if (v === 'chinese') svg.classList.add('piece-style-chinese');
			if (v === 'assisted') svg.classList.add('piece-style-assisted');
			if (v === 'abbr') svg.classList.add('piece-style-abbr');
		}
	}
}