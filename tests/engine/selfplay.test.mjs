import fs from 'fs';
import { test, expect } from 'vitest';

// Provide fetch shim for Emscripten loader
globalThis.fetch = (input, init) => {
  if (typeof input === 'string' && (input.startsWith('/') || input.startsWith('./') || input.startsWith('../'))) {
    return Promise.resolve({ ok: true, arrayBuffer: async () => fs.promises.readFile(input) });
  }
  return Promise.reject(new Error('unhandled fetch: ' + input));
};

const pkgPath = 'fairy-stockfish-nnue.wasm/stockfish.js';
const StockfishModule = await import(pkgPath).catch(() => null);
const StockfishFactory = StockfishModule && (StockfishModule.default || StockfishModule) ;

function isUciMove(m) { return /^[a-h][1-8][a-h][1-8][qnrbQNBR]?$/i.test(m); }

test('engine self-play produces valid UCI moves', async () => {
  const e1 = await StockfishFactory();
  const e2 = await StockfishFactory();

  const createOn = (mod) => {
    const listeners = [];
    const on = (fn) => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i>=0) listeners.splice(i,1); }; };
    mod.addMessageListener((line) => listeners.forEach(fn => fn(line)));
    return { mod, post: (c) => mod.postMessage(c), on };
  };

  const a = createOn(e1);
  const b = createOn(e2);

  const waitFor = (engine, re, timeout=5000) => new Promise((resolve, reject) => {
    const off = engine.on((line) => { if (line && re.test(line)) { off(); resolve(line); } });
    setTimeout(() => { off(); reject(new Error('timeout')); }, timeout);
  });

  // init
  a.post('uci'); await waitFor(a, /uciok/).catch(()=>{}); a.post('isready'); await waitFor(a, /readyok/).catch(()=>{});
  b.post('uci'); await waitFor(b, /uciok/).catch(()=>{}); b.post('isready'); await waitFor(b, /readyok/).catch(()=>{});

  const moves = [];
  const max = 40;
  for (let ply=0; ply<max; ply++) {
    const side = (ply%2===0)?a:b;
    const pos = moves.length ? `position startpos moves ${moves.join(' ')}` : 'position startpos';
    side.post(pos);
    side.post('go movetime 100');
    const line = await waitFor(side, /bestmove\s+([^\s]+)/, 5000);
    const m = line.match(/bestmove\s+([^\s]+)/i);
    expect(m).toBeTruthy();
    const mv = m[1];
    expect(isUciMove(mv)).toBe(true);
    moves.push(mv);
  }

  expect(moves.length).toBeGreaterThan(0);
});
