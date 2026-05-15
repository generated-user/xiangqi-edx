const fs = require('fs');
const path = require('path');

// Fallback fetch for Node to read local files when stockfish.js calls fetch()
global.fetch = (input, init) => {
  if (typeof input === 'string' && (input.startsWith('/') || input.startsWith('./') || input.startsWith('../'))) {
    return Promise.resolve({
      ok: true,
      arrayBuffer: async () => fs.promises.readFile(input)
    });
  }
  if (typeof globalThis.fetch === 'function') return globalThis.fetch(input, init);
  return Promise.reject(new Error('fetch not available for ' + input));
};

const Stockfish = require('../node_modules/fairy-stockfish-nnue.wasm/stockfish.js');

async function run() {
  const cmds = process.argv.slice(2).join(' ');
  const parts = cmds ? cmds.split('++').map(s => s.trim()).filter(Boolean) : [];
  const sf = await Stockfish();

  // Print lines from engine by intercepting console output isn't straightforward,
  // but stockfish.js uses console.log by default. We just let it print to stdout.
  for (const c of parts) {
    console.log('>>>', c);
    sf.postMessage(c);
  }

  // Wait for engine to respond (short delay)
  await new Promise(resolve => setTimeout(resolve, 800));
  // Tell engine to quit nicely
  try { sf.postMessage('quit'); } catch (e) {}
  // Allow some time for quit
  await new Promise(resolve => setTimeout(resolve, 200));
}

run().catch(err => { console.error(err); process.exit(1); });
