import { cloneBoard } from '../engine/board.js';

export class InteractionController {
  constructor(game, renderer, puzzleMode) {
    this.game = game;
    this.renderer = renderer;
    this.puzzleMode = puzzleMode;

    this.selected = null;
    this._potentialDrag = null; // store pointerdown info until movement threshold exceeded
    this._suppressClick = false;

    // Clicks will be handled from pointerup capture handler to unify with drag logic

    // Drag support
    this._drag = null;
    renderer.container.addEventListener('pointerdown', this._onPointerDown.bind(this));
    window.addEventListener('pointermove', this._onPointerMove.bind(this));
    // Use capture so pointerup handling (drag release) runs before container pointerup click handler
    window.addEventListener('pointerup', this._onPointerUp.bind(this), { capture: true });
  }

  handleClick(e) {
    // wrapper to keep original API; actual click processing is handled in `_onPointerUp`
    const xy = this._getXYFromEvent(e);
    if (!xy) return;
    this._processClickAt(xy.x, xy.y);
  }

  _processClickAt(x, y) {
    if (x === undefined || y === undefined) return;
    if (this.puzzleMode && this.puzzleMode.locked) {
      if (this.puzzleMode.onFeedback) this.puzzleMode.onFeedback({ valid: false, message: 'Puzzle locked after illegal move — undo or clear to continue' });
      return;
    }
    if (!this.selected) {
      const piece = this.game.getPiece(x, y);
      if (!piece) return; // don't select empty squares
      this.selected = { x, y };
      if (this.renderer.highlightSelection) this.renderer.highlightSelection(x, y);
      // no proactive legal-move highlights; feedback will show legal moves when needed
      return;
    }

    if (this.selected.x === x && this.selected.y === y) {
      // clicked the same square -> deselect
      this.selected = null;
      if (this.renderer.clearHighlights) this.renderer.clearHighlights();
      return;
    }

    const pm = this.puzzleMode;

    // Determine available move based on mode
    let move = null;
    if (pm && pm.isActive && pm.isActive()) {
      if (pm.type === 'free') {
        // allow any destination for the selected piece
        move = { from: { x: this.selected.x, y: this.selected.y }, to: { x, y } };
      } else if (pm.type === 'rule') {
        const pseudo = this.game.getPseudoLegalMovesForSquare(this.selected.x, this.selected.y);
        move = pseudo.find(m => m.to.x === x && m.to.y === y) || null;
      } else {
        const legal = this.game.getLegalMovesForSquare(this.selected.x, this.selected.y);
        move = legal.find(m => m.to.x === x && m.to.y === y) || null;
      }
    } else {
      const legal = this.game.getLegalMovesForSquare(this.selected.x, this.selected.y);
      move = legal.find(m => m.to.x === x && m.to.y === y);
    }

    if (move) {
      // For click-click, capture pre-board and then apply; puzzleMode will validate
      const preBoardSnapshot = cloneBoard(this.game.board);
      const preSide = this.game.currentTurn;

      if (this.renderer.animateMove) {
        this.renderer.animateMove(move, () => {
          if (this.game.applyMove) this.game.applyMove(move, true);
          else this.game.makeMove(move);
          this.renderer.render();
          if (pm && pm.onMoveMade) pm.onMoveMade(move, { board: preBoardSnapshot, currentTurn: preSide });
          if (window && typeof window.updateStatus === 'function') window.updateStatus();
        }, { overlay: true });
      } else {
        if (this.game.applyMove) this.game.applyMove(move, true);
        else this.game.makeMove(move);
        this.renderer.render();
        if (pm && pm.onMoveMade) pm.onMoveMade(move, { board: preBoardSnapshot, currentTurn: preSide });
        if (window && typeof window.updateStatus === 'function') window.updateStatus();
      }
      // move executed -> clear selection
      this.selected = null;
      if (this.renderer.clearHighlights) this.renderer.clearHighlights();
      return;
    }

    // If clicked another friendly piece, switch selection to it
    const clickedPiece = this.game.getPiece(x, y);
    if (clickedPiece && clickedPiece.startsWith(this.game.currentTurn[0])) {
      this.selected = { x, y };
      if (this.renderer.highlightSelection) this.renderer.highlightSelection(x, y);
      // no proactive legal-move highlights; feedback will show legal moves when needed
      return;
    }

    // otherwise keep selection (don't clear) so accidental clicks don't deselect
  }

  _getXYFromEvent(e) {
    // Walk up DOM to find element with data-x/data-y or SVG attributes
    let node = e.target;
    while (node && node !== this.renderer.container) {
      const dx = node.dataset && node.dataset.x;
      const dy = node.dataset && node.dataset.y;
      if (dx !== undefined && dy !== undefined) {
        return { x: Number(dx), y: Number(dy) };
      }
      if (node.getAttribute) {
        const ax = node.getAttribute('data-x');
        const ay = node.getAttribute('data-y');
        if (ax !== null && ay !== null) return { x: Number(ax), y: Number(ay) };
      }
      node = node.parentNode;
    }
    return null;
  }

  _onPointerDown(e) {
    const xy = this._getXYFromEvent(e);
    if (!xy) return;

    if (this.puzzleMode && this.puzzleMode.locked) {
      if (this.puzzleMode.onFeedback) this.puzzleMode.onFeedback({ valid: false, message: 'Puzzle locked after illegal move — undo or clear to continue' });
      return;
    }

    const piece = this.game.getPiece(xy.x, xy.y);
    if (!piece) return;

    // allow interacting with any piece in free puzzle mode; otherwise restrict to current turn
    const side = this.game.currentTurn;
    if (!(this.puzzleMode && this.puzzleMode.isActive && this.puzzleMode.type === 'free')) {
      if (!piece.startsWith(side[0])) return;
    }

    // don't create overlay immediately; wait until pointer moves beyond threshold
    this._potentialDrag = {
      from: xy,
      startX: e.clientX,
      startY: e.clientY
    };

    // no proactive highlights on pointerdown; feedback will show legal moves when needed
    if (this.renderer.highlightSelection) this.renderer.highlightSelection(xy.x, xy.y);
  }

  _onPointerMove(e) {
    // If we have a potential drag from pointerdown but no overlay yet, check threshold
    if (this._potentialDrag && !this._drag) {
      const dx = e.clientX - this._potentialDrag.startX;
      const dy = e.clientY - this._potentialDrag.startY;
      const distSq = dx * dx + dy * dy;
      const THRESHOLD = 6 * 6; // 6px
      if (distSq > THRESHOLD) {
        const from = this._potentialDrag.from;
        // start dragging the actual piece element instead of creating an overlay
        const pieceEl = this.renderer.svg?.querySelector(`g.piece[data-x="${from.x}"][data-y="${from.y}"]`);
        this._drag = {
          from,
          pieceEl,
          origTransform: pieceEl ? (pieceEl.getAttribute('transform') || '') : '',
          // cache the svg rect for smoother pointermove handling
          rect: this.renderer.container.firstElementChild.getBoundingClientRect()
        };
        // prime latest client position and start a continuous RAF loop
        this._drag.latestClient = { x: e.clientX, y: e.clientY };
        this._drag.rafId = requestAnimationFrame(this._flushDrag.bind(this));
        // we've started a drag gesture; suppress the following mouseup click
        this._suppressClick = true;
        this._isDragging = true;
        // prevent default now that we started dragging
        e.preventDefault();
      } else {
        return;
      }
    }

    if (!this._drag) return;
    const pieceEl = this._drag.pieceEl;
    if (pieceEl) {
      // store latest client position; RAF loop samples this each frame
      this._drag.latestClient = { x: e.clientX, y: e.clientY };
      // increment pointermove counter for debugging
      this._drag.moveCount = (this._drag.moveCount || 0) + 1;
      if (this._drag.moveCount === 50) {
        console.log('InteractionController: received 50 pointermove events during drag', { from: this._drag.from, piece: this._drag.pieceEl && this._drag.pieceEl.dataset });
      }
    }
  }

  _onPointerUp(e) {
    // If pointerdown was on a piece but no drag started, treat as a click on that piece
    if (!this._drag && this._potentialDrag) {
      const from = this._potentialDrag.from;
      this._processClickAt(from.x, from.y);
      this._potentialDrag = null;
      return;
    }

    // If there was no pointerdown on a piece and no drag, this is a normal click (destination)
    if (!this._drag && !this._potentialDrag) {
      const xy = this._getXYFromEvent(e);
      if (xy) this._processClickAt(xy.x, xy.y);
      return;
    }

    const from = this._drag.from;

    // determine drop target
    let to = null;
    if (this.renderer.clientToXY) {
      to = this.renderer.clientToXY(e.clientX, e.clientY);
    } else {
      const xy = this._getXYFromEvent(e);
      if (xy) to = xy;
    }

    if (to) {
      // commit any CSS transform into the element's SVG transform attribute
      this._commitDragTransform();
      const move = { from, to };
      // remove any overlay if present
      if (this._drag.overlay && this._drag.overlay.parentNode) {
        this._drag.overlay.parentNode.removeChild(this._drag.overlay);
      }

      // take a snapshot of the board and side before applying the move
      const preBoardSnapshot = cloneBoard(this.game.board);
      const preSide = this.game.currentTurn;

      // determine whether we should allow the move depending on puzzle mode
      let allow = false;
      const pm = this.puzzleMode;

      if (pm && pm.isActive && pm.isActive()) {
        if (pm.type === 'free') {
          allow = true; // allow any move; will validate after
        } else if (pm.type === 'rule') {
          const pseudo = this.game.getPseudoLegalMovesForSquare(from.x, from.y) || [];
          allow = pseudo.some(m => m.to.x === to.x && m.to.y === to.y);
        } else if (pm.type === 'regular') {
          // require fully legal moves for regular puzzles
          allow = this.game.isMoveLegal(move, this.game.currentTurn);
        } else if (pm.type === 'vs') {
          allow = this.game.isMoveLegal(move, this.game.currentTurn);
        } else {
          allow = this.game.isMoveLegal(move, this.game.currentTurn);
        }
      } else {
        allow = this.game.isMoveLegal(move, this.game.currentTurn);
      }

      if (allow) {
        if (this.game.applyMove) this.game.applyMove(move, true);
        else this.game.makeMove(move);
        this.renderer.render();
        if (this.renderer.clearHighlights) this.renderer.clearHighlights();
        // call puzzle feedback hook if present; pass pre-move board and side
        if (pm && pm.onMoveMade) pm.onMoveMade(move, { board: preBoardSnapshot, currentTurn: preSide });
        if (window && typeof window.updateStatus === 'function') window.updateStatus();
      } else {
        // invalid drop: snap piece back to origin visually then re-render
        this.renderer.render();
        if (pm && pm.onFeedback) pm.onFeedback({ valid: false, message: 'Move not allowed by current mode' });
      }
    }

    // cleanup drag state
    if (this._drag && this._drag.rafId) {
      cancelAnimationFrame(this._drag.rafId);
    }
    this._drag = null;
    this._potentialDrag = null;
    this._isDragging = false;
  }

  _commitDragTransform() {
    if (!this._drag) return;
    const pieceEl = this._drag.pieceEl;
    const latest = this._drag.latestClient;
    if (!pieceEl || !latest) return;

    // compute viewBox coords from latest client position
    const vb = this.renderer.clientToViewBox(latest.x, latest.y, this._drag.rect);
    const cx = this._drag.from.x * 64 + 32;
    const cy = this._drag.from.y * 64 + 32;
    const dx = vb.viewX - cx;
    const dy = vb.viewY - cy;

    // apply as SVG transform attribute so subsequent animations read correct start
    pieceEl.setAttribute('transform', `translate(${dx} ${dy})`);

    // remove CSS transform and reset transform-origin/box
    try {
      pieceEl.style.transform = '';
      pieceEl.style.transformBox = '';
      pieceEl.style.transformOrigin = '';
      pieceEl.style.willChange = '';
    } catch (err) {}
  }

  _flushDrag() {
    if (!this._drag) return;
    const pieceEl = this._drag.pieceEl;
    const latest = this._drag.latestClient;
    if (!pieceEl || !latest) {
      // schedule next frame while dragging to keep responsiveness
      this._drag.rafId = requestAnimationFrame(this._flushDrag.bind(this));
      return;
    }
    const vb = this.renderer.clientToViewBox(latest.x, latest.y, this._drag.rect);
    const cx = this._drag.from.x * 64 + 32;
    const cy = this._drag.from.y * 64 + 32;
    // compute pixel offsets relative to SVG client rect
    const rect = this._drag.rect;
    const scaleX = rect.width / (9 * 64);
    const scaleY = rect.height / (10 * 64);
    const srcClientX = rect.left + (this._drag.from.x * 64 + 32) * scaleX;
    const srcClientY = rect.top + (this._drag.from.y * 64 + 32) * scaleY;
    const dxPx = latest.x - srcClientX;
    const dyPx = latest.y - srcClientY;
    // apply CSS transform in pixels for smoother, GPU-accelerated motion
    pieceEl.style.willChange = 'transform';
    pieceEl.style.transformBox = 'fill-box';
    pieceEl.style.transformOrigin = 'center';
    pieceEl.style.transform = `translate(${dxPx}px, ${dyPx}px)`;
    // continue the RAF loop while dragging
    this._drag.rafId = requestAnimationFrame(this._flushDrag.bind(this));
  }

  _createOverlayForPiece(x, y, clientX, clientY) {
    const pieceEl = this.renderer.svg?.querySelector(`g.piece[data-x="${x}"][data-y="${y}"]`);
    const overlay = document.createElement('div');
    overlay.className = 'drag-overlay';
    overlay.style.position = 'fixed';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = 9999;

    if (pieceEl) {
      // clone SVG node into overlay
      const svg = pieceEl.ownerSVGElement.cloneNode(false);
      // clone defs from original so gradients and IDs are present
      const defs = pieceEl.ownerSVGElement.querySelector('defs');
      if (defs) svg.appendChild(defs.cloneNode(true));
      const clone = pieceEl.cloneNode(true);
      // shift absolute coordinates into overlay local viewBox
      const tx = -x * 64; // SQUARE is 64 in SvgBoard
      const ty = -y * 64;
      clone.setAttribute('transform', `translate(${tx} ${ty})`);
      svg.appendChild(clone);
      overlay.appendChild(svg);
    } else {
      const div = document.createElement('div');
      div.style.width = '48px';
      div.style.height = '48px';
      div.style.borderRadius = '24px';
      div.style.background = '#fff';
      div.style.border = '2px solid #000';
      overlay.appendChild(div);
    }

    document.body.appendChild(overlay);
    // initial position
    overlay.style.left = `${clientX - 24}px`;
    overlay.style.top = `${clientY - 24}px`;
    return overlay;
  }
}