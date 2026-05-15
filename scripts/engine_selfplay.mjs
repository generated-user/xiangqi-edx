import fs from 'fs';
import path from 'path';

// Provide fetch shim so the Emscripten wasm loader can read local files
globalThis.fetch = (input, init) => {
  if (typeof input === 'string' && (input.startsWith('/') || input.startsWith('./') || input.startsWith('../'))) {
    return Promise.resolve({ ok: true, arrayBuffer: async () => fs.promises.readFile(input) });
  }
  return Promise.reject(new Error('unhandled fetch: ' + input));
};

const pkgPath = '../node_modules/fairy-stockfish-nnue.wasm/stockfish.js';
console.log('Loading stockfish factory from', pkgPath);
const StockfishFactory = (await import(pkgPath)).default || (await import(pkgPath));

async function createEngine(name) {
  const mod = await StockfishFactory();
  const listeners = [];
  mod.addMessageListener((line) => {
    // forward to local listeners
    listeners.forEach((fn) => { try { fn(line); } catch (e) { console.error(e); } });
  });
  return {
    name,
    mod,
    post: (cmd) => mod.postMessage(cmd),
    on: (fn) => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i,1); }; }
  };
}

function waitFor(engine, matchRegex, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const off = engine.on((line) => {
      if (!line) return;
      if (matchRegex.test(line)) {
        off();
        resolve(line);
      }
    });
    const to = setTimeout(() => { off(); reject(new Error('timeout waiting for ' + matchRegex)); }, timeout);
  });
}

function isUciMove(m) {
  return /^[a-h][1-8][a-h][1-8][qnrbQNBR]?$/i.test(m);
}

async function selfPlay() {
  const e1 = await createEngine('e1');
  const e2 = await createEngine('e2');

  // initialize
  for (const e of [e1, e2]) {
    e.post('uci');
    await waitFor(e, /uciok/, 2000).catch(() => {});
    e.post('isready');
    await waitFor(e, /readyok/, 2000).catch(() => {});
  }

  const moves = [];
  const maxMoves = 80;

  for (let ply = 0; ply < maxMoves; ply++) {
    const side = (ply % 2 === 0) ? e1 : e2;
    const fen = 'startpos';
    const posCmd = moves.length ? `position ${fen} moves ${moves.join(' ')}` : `position ${fen}`;
    side.post(posCmd);

    // ask for bestmove
    side.post('go movetime 200');
    const line = await waitFor(side, /bestmove\s+([^\s]+)/, 5000);
    const m = line.match(/bestmove\s+([^\s]+)/i);
    if (!m) throw new Error('engine returned no bestmove: ' + line);
    const mv = m[1];
    console.log(`[ply ${ply}] ${side.name} -> ${mv}`);
    if (mv === '(none)' || mv === '0000') {
      console.log('engine resigned or no move; ending');
      return { result: 'no-move', moves };
    }
    if (!isUciMove(mv)) throw new Error('Invalid UCI move: ' + mv);

    moves.push(mv);

    // update other engine position too
    const other = side === e1 ? e2 : e1;
    other.post(posCmd + (moves.length ? ' ' + mv : ''));

    // small delay
    await new Promise(r => setTimeout(r, 50));
  }

  return { result: 'move-limit', moves };
}

(async () => {
  try {
    const res = await selfPlay();
    console.log('Self-play finished:', res.result, 'moves:', res.moves.length);
    process.exit(0);
  } catch (e) {
    console.error('Self-play failed:', e);
    process.exit(2);
  }
})();
