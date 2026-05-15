const fs = require('fs');
const path = require('path');

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

(async function run(){
  try{
    const cmds = process.argv.slice(2).join(' ');
    const parts = cmds ? cmds.split('++').map(s => s.trim()).filter(Boolean) : [];
    const sf = await Stockfish();

    for (const c of parts) {
      console.log('>>>', c);
      sf.postMessage(c);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    try { sf.postMessage('quit'); } catch (e) {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }catch(e){console.error(e);process.exit(1)}
})();
