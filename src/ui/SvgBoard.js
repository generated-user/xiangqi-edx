const SQUARE = 64;
const WIDTH = 9 * SQUARE;
const HEIGHT = 10 * SQUARE;

// Display metadata for pieces: Chinese characters (red/black) and English abbr
const PIECE_DISPLAY = {
  r: { zh: { red: '車', black: '車' }, abbr: 'Rk' },
  h: { zh: { red: '馬', black: '馬' }, abbr: 'Kn' },
  e: { zh: { red: '相', black: '象' }, abbr: 'Ele' },
  a: { zh: { red: '仕', black: '士' }, abbr: 'Adv' },
  k: { zh: { red: '帥', black: '將' }, abbr: 'Gen' },
  c: { zh: { red: '炮', black: '炮' }, abbr: 'Can' },
  p: { zh: { red: '兵', black: '卒' }, abbr: 'Pn' }
};

// Colors and gradients are provided by CSS variables in src/styles/pieces.css

export class SvgBoard {
  constructor(container, game) {
    this.container = container;
    this.game = game;
    this.svg = null;
    this.hotspots = [];
    this.pieceElements = new Map();
    this.hotspotMap = new Map();
    this.piecesLayer = null;
    this._silhouette = null;
    this.viewFrom = 'red'; // 'red' or 'black' - controls displayed orientation
  }

  _internalToDisplay(x, y) {
    if (this.viewFrom === 'black') return { dx: 8 - x, dy: 9 - y };
    return { dx: x, dy: y };
  }

  _displayToInternal(dx, dy) {
    if (this.viewFrom === 'black') return { x: 8 - dx, y: 9 - dy };
    return { x: dx, y: dy };
  }

  render() {
    // reset caches for dynamic layers
    this.pieceElements.clear();
    this.hotspotMap.clear();

    const ns = 'http://www.w3.org/2000/svg';

    // If svg not created yet, build the static structure once and keep it.
    if (!this.svg) {
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
      svg.setAttribute('width', WIDTH);
      svg.setAttribute('height', HEIGHT);
      svg.classList.add('svg-board');
      // reapply piece-style persisted on container (if any)
      try {
        const ps = this.container && this.container.dataset && this.container.dataset.pieceStyle;
        if (ps) svg.classList.add(`piece-style-${ps}`);
      } catch (e) {}

      // background board image (served from /board.svg in public)
      const img = document.createElementNS(ns, 'image');
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '/board.svg');
      img.setAttribute('x', '0');
      img.setAttribute('y', '0');
      img.setAttribute('width', WIDTH);
      img.setAttribute('height', HEIGHT);
      svg.appendChild(img);

      // centralized gradients/defs for pieces — stop colors reference CSS variables
      const defs = document.createElementNS(ns, 'defs');
      const gradR = document.createElementNS(ns, 'linearGradient');
      gradR.setAttribute('id', 'grad-red');
      gradR.setAttribute('gradientTransform', 'rotate(45)');
      const stopR1 = document.createElementNS(ns, 'stop');
      stopR1.setAttribute('offset', '0%');
      stopR1.setAttribute('stop-color', 'var(--piece-red-stop1)');
      const stopR2 = document.createElementNS(ns, 'stop');
      stopR2.setAttribute('offset', '100%');
      stopR2.setAttribute('stop-color', 'var(--piece-red-stop2)');
      gradR.appendChild(stopR1);
      gradR.appendChild(stopR2);
      defs.appendChild(gradR);

      const gradB = document.createElementNS(ns, 'linearGradient');
      gradB.setAttribute('id', 'grad-black');
      gradB.setAttribute('gradientTransform', 'rotate(45)');
      const stopB1 = document.createElementNS(ns, 'stop');
      stopB1.setAttribute('offset', '0%');
      stopB1.setAttribute('stop-color', 'var(--piece-black-stop1)');
      const stopB2 = document.createElementNS(ns, 'stop');
      stopB2.setAttribute('offset', '100%');
      stopB2.setAttribute('stop-color', 'var(--piece-black-stop2)');
      gradB.appendChild(stopB1);
      gradB.appendChild(stopB2);
      defs.appendChild(gradB);
      // selection radial gradient (white -> transparent)
      const selGrad = document.createElementNS(ns, 'radialGradient');
      selGrad.setAttribute('id', 'sel-grad');
      const selStop1 = document.createElementNS(ns, 'stop');
      selStop1.setAttribute('offset', '0%');
      selStop1.setAttribute('stop-color', '#FFFFFF');
      selStop1.setAttribute('stop-opacity', '1');
      const selStop2 = document.createElementNS(ns, 'stop');
      selStop2.setAttribute('offset', '90%');
      selStop2.setAttribute('stop-color', '#FFFFFF');
      selStop2.setAttribute('stop-opacity', '1');
      const selStop3 = document.createElementNS(ns, 'stop');
      selStop3.setAttribute('offset', '100%');
      selStop3.setAttribute('stop-color', '#FFFFFF');
      selStop3.setAttribute('stop-opacity', '0');
      selGrad.appendChild(selStop1);
      selGrad.appendChild(selStop2);
      selGrad.appendChild(selStop3);
      defs.appendChild(selGrad);
      svg.appendChild(defs);

      // interactive hotspots at intersections (use transparent circles)
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
          const { dx, dy } = this._internalToDisplay(x, y);
          const cx = dx * SQUARE + SQUARE / 2;
          const cy = dy * SQUARE + SQUARE / 2;

          const g = document.createElementNS(ns, 'g');
          // data-x/y always stored as internal coords for interaction logic
          g.setAttribute('data-x', x);
          g.setAttribute('data-y', y);
          g.classList.add('square');

          const hit = document.createElementNS(ns, 'circle');
          hit.setAttribute('cx', cx);
          hit.setAttribute('cy', cy);
          hit.setAttribute('r', SQUARE * 0.45);
          hit.setAttribute('fill', 'transparent');
          hit.setAttribute('pointer-events', 'all');

          g.appendChild(hit);
          svg.appendChild(g);

          this.hotspots.push(g);
          this.hotspotMap.set(`${x},${y}`, g);
        }
      }

      // create a dedicated pieces layer so we can update pieces without rebuilding svg
      const piecesLayer = document.createElementNS(ns, 'g');
      piecesLayer.classList.add('pieces-layer');
      svg.appendChild(piecesLayer);

      this.container.appendChild(svg);
      this.svg = svg;
      this.piecesLayer = piecesLayer;
    } else {
      // reuse existing svg; rebuild hotspots map in case references changed
      // (hotspots were created once above)
      this.hotspots = Array.from(this.svg.querySelectorAll('g.square'));
      for (const g of this.hotspots) {
        const x = g.getAttribute('data-x');
        const y = g.getAttribute('data-y');
        this.hotspotMap.set(`${x},${y}`, g);
      }
      // clear existing pieces from pieces layer
      if (!this.piecesLayer) this.piecesLayer = this.svg.querySelector('g.pieces-layer');
      while (this.piecesLayer.firstChild) this.piecesLayer.removeChild(this.piecesLayer.firstChild);
    }

    // pieces: always rebuild into the pieces layer (dynamic)
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 9; x++) {
        const piece = this.game.getPiece(x, y);
        if (!piece) continue;

        const { dx, dy } = this._internalToDisplay(x, y);
        const cx = dx * SQUARE + SQUARE / 2;
        const cy = dy * SQUARE + SQUARE / 2;

        const color = piece[0] === 'r' ? 'red' : 'black';

        const g = document.createElementNS(ns, 'g');
        g.classList.add('piece');
        g.setAttribute('data-x', x);
        g.setAttribute('data-y', y);

        const core = document.createElementNS(ns, 'circle');
        core.setAttribute('class', 'core');
        core.setAttribute('cx', cx);
        core.setAttribute('cy', cy);
        core.setAttribute('r', SQUARE * 0.4);
        const coreFill = color === 'red' ? 'url(#grad-red)' : 'url(#grad-black)';
        core.setAttribute('fill', coreFill);

        // compose piece from centralized styles: background circle + stroke + labels
        const back = document.createElementNS(ns, 'circle');
        back.setAttribute('cx', cx);
        back.setAttribute('cy', cy);
        back.setAttribute('r', SQUARE * 0.35);
        // use gradient fill depending on side
        const gradId = color === 'red' ? 'grad-red' : 'grad-black';
        back.setAttribute('fill', `url(#${gradId})`);
        // stroke color and text colors come from CSS variables
        const strokeVar = color === 'red' ? 'var(--piece-red-stroke)' : 'var(--piece-black-stroke)';
        back.setAttribute('stroke', strokeVar);
        back.setAttribute('stroke-width', '1.6');

        // big Chinese character for recognition
        const disp = PIECE_DISPLAY[piece[1]] || { zh: { red: piece[1], black: piece[1] }, abbr: piece[1] };
        const zh = disp.zh[color];
        const abbr = disp.abbr;

        const char = document.createElementNS(ns, 'text');
        char.setAttribute('class', 'chinese');
        char.setAttribute('x', cx);
        char.setAttribute('y', cy - SQUARE * 0.02);
        char.setAttribute('text-anchor', 'middle');
        char.setAttribute('dominant-baseline', 'central');
        char.setAttribute('fill', color === 'red' ? 'var(--piece-red-text)' : 'var(--piece-black-text)');
        char.textContent = zh;

        // initial (single-letter) displayed above the Chinese character in initial mode
        const initial = document.createElementNS(ns, 'text');
        initial.setAttribute('class', 'assisted');
        initial.setAttribute('x', cx);
        initial.setAttribute('y', cy - SQUARE * 0.18 + 2);
        initial.setAttribute('text-anchor', 'middle');
        initial.setAttribute('dominant-baseline', 'central');
        initial.setAttribute('fill', color === 'red' ? 'var(--piece-red-text)' : 'var(--piece-black-text)');
        initial.textContent = (abbr && abbr.length) ? abbr.charAt(0) : '';

        // small English abbreviation for accessibility
        const small = document.createElementNS(ns, 'text');
        small.setAttribute('class', 'abbr');
        small.setAttribute('x', cx);
        small.setAttribute('y', cy);
        small.setAttribute('text-anchor', 'middle');
        small.setAttribute('dominant-baseline', 'central');
        small.setAttribute('fill', color === 'red' ? 'var(--piece-red-text)' : 'var(--piece-black-text)');
        small.textContent = abbr;

        g.appendChild(core);
        g.appendChild(back);
        g.appendChild(initial);
        g.appendChild(char);
        g.appendChild(small);

            this.piecesLayer.appendChild(g);
            this.pieceElements.set(`${x},${y}`, g);
          }
        }
        return;
  }

  clearHighlights() {
    for (const g of this.hotspots) {
      g.classList.remove('selected');
      g.classList.remove('legal');
      const marker = g.querySelector('circle.marker');
      if (marker) marker.remove();
      const sil = g.querySelector('.silhouette');
      if (sil) sil.remove();
    }
    // also clear any global silhouette element (cloned piece)
    if (this._silhouette && this._silhouette.parentNode) {
      try { this._silhouette.remove(); } catch (e) {}
      this._silhouette = null;
    }
    // remove any other residual silhouettes in pieces layer
    if (this.piecesLayer) {
      const others = Array.from(this.piecesLayer.querySelectorAll('.silhouette'));
      for (const o of others) { try { o.remove(); } catch (e) {} }
    }
  }

  highlightSelection(x, y) {
    this.clearHighlights();
    const g = this.hotspotMap.get(`${x},${y}`);
    if (!g) return;
    g.classList.add('selected');
    // create a radial marker under the piece
    const ns = 'http://www.w3.org/2000/svg';
    const { dx, dy } = this._internalToDisplay(x, y);
    const cx = dx * SQUARE + SQUARE / 2;
    const cy = dy * SQUARE + SQUARE / 2;
    const r = SQUARE * 0.42;
    const marker = document.createElementNS(ns, 'circle');
    marker.setAttribute('class', 'marker selection-marker');
    marker.setAttribute('cx', cx);
    marker.setAttribute('cy', cy);
    marker.setAttribute('r', r);
    marker.setAttribute('fill', 'url(#sel-grad)');
    marker.setAttribute('pointer-events', 'none');
    g.appendChild(marker);
  }

  showLegalMoves(moves) {
    for (const m of moves) {
      const key = `${m.to.x},${m.to.y}`;
      const g = this.hotspotMap.get(key);
      if (g) {
        g.classList.add('legal');
      }
    }
  }

  // show a silhouette marker at the original square (for illegal move feedback)
  showSilhouette(x, y) {
    const key = `${x},${y}`;
    const pieceEl = this.pieceElements.get(key);
    const ns = 'http://www.w3.org/2000/svg';
    if (pieceEl && this.piecesLayer) {
      // clone the piece glyph group and append to piecesLayer as a silhouette
      const clone = pieceEl.cloneNode(true);
      clone.classList.add('silhouette');
      clone.removeAttribute('data-x');
      clone.removeAttribute('data-y');
      clone.setAttribute('opacity', '0.5');
      this.piecesLayer.appendChild(clone);
      this._silhouette = clone;
      return;
    }
    // fallback: simple circle silhouette on hotspot
    const g = this.hotspotMap.get(key);
    if (!g) return;
    const { dx, dy } = this._internalToDisplay(x, y);
    const cx = dx * SQUARE + SQUARE / 2;
    const cy = dy * SQUARE + SQUARE / 2;
    const sil = document.createElementNS(ns, 'circle');
    sil.setAttribute('class', 'silhouette');
    sil.setAttribute('cx', cx);
    sil.setAttribute('cy', cy);
    sil.setAttribute('r', SQUARE * 0.35);
    sil.setAttribute('fill', 'rgba(0,0,0,0.06)');
    sil.setAttribute('pointer-events', 'none');
    g.appendChild(sil);
    this._silhouette = sil;
  }

  // Animate a piece from `move.from` to `move.to`, then call onComplete
  animateMove(move, onComplete, options = {}) {
    if (!this.svg) {
      onComplete && onComplete();
      return;
    }
    const fromKey = `${move.from.x},${move.from.y}`;
    const pieceEl = this.pieceElements.get(fromKey);
    const ns = 'http://www.w3.org/2000/svg';

    // If overlay option requested (click-click), animate a cloned overlay instead
    if (options.overlay && pieceEl) {
      // compute client coordinates of source and destination centers
      const rect = this.svg.getBoundingClientRect();
      const scaleX = rect.width / WIDTH;
      const scaleY = rect.height / HEIGHT;
      const fromDisp = this._internalToDisplay(move.from.x, move.from.y);
      const toDisp = this._internalToDisplay(move.to.x, move.to.y);
      const srcClientX = rect.left + (fromDisp.dx * SQUARE + SQUARE / 2) * scaleX;
      const srcClientY = rect.top + (fromDisp.dy * SQUARE + SQUARE / 2) * scaleY;
      const dstClientX = rect.left + (toDisp.dx * SQUARE + SQUARE / 2) * scaleX;
      const dstClientY = rect.top + (toDisp.dy * SQUARE + SQUARE / 2) * scaleY;

      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.left = `${srcClientX - (SQUARE * scaleX) / 2}px`;
      overlay.style.top = `${srcClientY - (SQUARE * scaleY) / 2}px`;
      overlay.style.width = `${SQUARE * scaleX}px`;
      overlay.style.height = `${SQUARE * scaleY}px`;
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = 9999;

      // clone a minimal svg containing the piece
      const overlaySvg = document.createElementNS(ns, 'svg');
      overlaySvg.setAttribute('viewBox', `0 0 ${SQUARE} ${SQUARE}`);
      overlaySvg.setAttribute('width', `${SQUARE * scaleX}`);
      overlaySvg.setAttribute('height', `${SQUARE * scaleY}`);
      // copy piece-style classes so overlay respects current display mode
      // make overlay svg look like the board so piece-style rules apply
      overlaySvg.classList.add('svg-board');
      if (this.svg) {
        const preserved = Array.from(this.svg.classList).filter(c => c.startsWith('piece-style-'));
        for (const c of preserved) overlaySvg.classList.add(c);
      }
      // clone defs if present
      const defs = this.svg.querySelector('defs');
      if (defs) overlaySvg.appendChild(defs.cloneNode(true));
      const clone = pieceEl.cloneNode(true);
      clone.removeAttribute('data-x');
      clone.removeAttribute('data-y');
      const tx = -fromDisp.dx * SQUARE;
      const ty = -fromDisp.dy * SQUARE;
      clone.setAttribute('transform', `translate(${tx} ${ty})`);
      overlaySvg.appendChild(clone);
      overlay.appendChild(overlaySvg);
      document.body.appendChild(overlay);

      // hide original piece during overlay animation
      const origVisibility = pieceEl.style.visibility || '';
      pieceEl.style.visibility = 'hidden';

      // animate overlay in client pixels
      const duration = 300;
      const startTime = performance.now();
      const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      let rafId = null;
      let finished = false;
      let toId = null;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (toId) clearTimeout(toId);
        try { overlay.remove(); } catch (e) {}
        pieceEl.style.visibility = origVisibility;
        onComplete && onComplete();
      };
      const step = (now) => {
        const elapsed = now - startTime;
        const p = Math.min(1, elapsed / duration);
        const e = ease(p);
        const cx = srcClientX + (dstClientX - srcClientX) * e;
        const cy = srcClientY + (dstClientY - srcClientY) * e;
        overlay.style.left = `${cx - (SQUARE * scaleX) / 2}px`;
        overlay.style.top = `${cy - (SQUARE * scaleY) / 2}px`;
        if (p < 1) rafId = requestAnimationFrame(step);
        else finish();
      };
      rafId = requestAnimationFrame(step);
      // safety fallback
      toId = setTimeout(() => finish(), duration + 200);
      // kick off
      return;
    }

    // If we have a real piece element, animate it in-place using a JS tween.
    if (pieceEl) {
      // disable interactions during animation
      const prevPointer = this.container.style.pointerEvents || '';
      this.container.style.pointerEvents = 'none';

      const parseTranslate = (t) => {
        if (!t) return [0, 0];
        const m = /translate\(([-0-9.]+)\s*,?\s*([-0-9.]+)\)/.exec(t);
        if (m) return [Number(m[1]), Number(m[2])];
        return [0, 0];
      };

      const start = parseTranslate(pieceEl.getAttribute('transform'));
      const fromDisp2 = this._internalToDisplay(move.from.x, move.from.y);
      const toDisp2 = this._internalToDisplay(move.to.x, move.to.y);
      const targetX = (toDisp2.dx - fromDisp2.dx) * SQUARE;
      const targetY = (toDisp2.dy - fromDisp2.dy) * SQUARE;

      const duration = 300;
      const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const easing = (options && options.linear) ? ((t) => t) : easeInOutCubic;
      let rafId = null;
      let finished = false;
      let toId = null;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (toId) clearTimeout(toId);
        this.container.style.pointerEvents = prevPointer;
        onComplete && onComplete();
      };
      const startTime = performance.now();
      const step = (now) => {
        const elapsed = now - startTime;
        let p = Math.min(1, elapsed / duration);
        const e = easing(p);
        const cx = start[0] + (targetX - start[0]) * e;
        const cy = start[1] + (targetY - start[1]) * e;
        pieceEl.setAttribute('transform', `translate(${cx} ${cy})`);
        if (p < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          finish();
        }
      };
      rafId = requestAnimationFrame(step);
      // safety fallback
      toId = setTimeout(() => finish(), duration + 200);
      return;
    }

    // Fallback: if there's no piece element, just call onComplete
    onComplete && onComplete();
  }

  // helper to convert client coords to viewBox (float), not rounded to squares
  clientToViewBox(clientX, clientY, rect) {
    // rect can be passed in to avoid repeated getBoundingClientRect calls during drag
    const r = rect || this.container.firstElementChild.getBoundingClientRect();
    const ratioX = (clientX - r.left) / r.width;
    const ratioY = (clientY - r.top) / r.height;
    const viewX = ratioX * WIDTH;
    const viewY = ratioY * HEIGHT;
    return { viewX, viewY };
  }

  // helper to convert client coords to board x,y (nearest intersection)
  clientToXY(clientX, clientY) {
    const rect = this.container.firstElementChild.getBoundingClientRect();
    // compute position in viewBox units accounting for SVG scaling
    const ratioX = (clientX - rect.left) / rect.width;
    const ratioY = (clientY - rect.top) / rect.height;
    const viewX = ratioX * WIDTH;
    const viewY = ratioY * HEIGHT;
    // compute nearest intersection (centers at i*SQUARE + SQUARE/2)
    const dx = Math.min(8, Math.max(0, Math.round((viewX - SQUARE / 2) / SQUARE)));
    const dy = Math.min(9, Math.max(0, Math.round((viewY - SQUARE / 2) / SQUARE)));
    const internal = this._displayToInternal(dx, dy);
    return { x: internal.x, y: internal.y };
  }
}

export default SvgBoard;
