// Lightweight wrapper for a Stockfish-like UCI engine.
// Provides `init()`, `post(cmd)`, `bestMove(fen, opts)` and `destroy()`.

export class FairyStockfish {
  constructor(engineUrl = 'fairy-stockfish-nnue.wasm') {
    this.engineUrl = engineUrl;
    this.worker = null;
    this._listeners = new Map();
    this._nextId = 1;
    this._ready = false;
  }

  async init() {
    if (this.worker) return true;

    // Try dynamic import of the package (bundler-friendly).
    try {
      const mod = await import(/* @vite-ignore */ this.engineUrl).catch(() => null);
      if (mod) {
        if (typeof mod.default === 'function') {
          const inst = await mod.default();
          if (inst && typeof inst.postMessage === 'function') this.worker = inst;
        } else if (mod.createWorker && typeof mod.createWorker === 'function') {
          this.worker = mod.createWorker();
        } else if (mod.Stockfish && typeof mod.Stockfish === 'function') {
          try { this.worker = new mod.Stockfish(); } catch (e) {}
        }
      }
    } catch (e) {
      // ignore
    }

    // Fallback: try to import the packaged stockfish.js and instantiate it.
    if (!this.worker) {
      try {
        const pkg = await import(/* @vite-ignore */ this.engineUrl + '/stockfish.js').catch(() => null);
        const Factory = pkg && (pkg.default || pkg.Stockfish || pkg.Stockfish || pkg);
        if (typeof Factory === 'function') {
          const inst = await Factory();
          if (inst && typeof inst.postMessage === 'function') this.worker = inst;
        }
      } catch (e) {}
    }

    // Final fallback: try creating a Worker that imports the packaged worker
    // via Vite-served node_modules path. This avoids Vite returning index.html
    // (text/html) for bare package specifiers which caused the MIME error.
    // Only attempt worker creation in browser-like environments; skip in Node.
    if (!this.worker && typeof Worker !== 'undefined' && typeof window !== 'undefined') {
      try {
        // if engineUrl looks like a package name, attempt node_modules path
        let workerPath = this.engineUrl;
        if (!workerPath.endsWith('.js') && !workerPath.includes('/')) {
          workerPath = `/node_modules/${workerPath}/stockfish.worker.js`;
        }
        // try module worker first
        this.worker = new Worker(workerPath, { type: 'module' });
      } catch (e) {
        try {
          // Create a compatibility worker that loads stockfish.js and exposes
          // a simple postMessage(string) API by instantiating the JS factory
          const blob = new Blob([
            `importScripts('/node_modules/${this.engineUrl}/stockfish.js');
            // stockfish.js exposes a factory that returns a Module-like object
            (async function(){
              try{
                const Factory = (typeof Stockfish === 'function') ? Stockfish : (typeof Stockfish !== 'undefined' && Stockfish && Stockfish.Stockfish) ? Stockfish.Stockfish : null;
                if(!Factory){ postMessage('ERROR: stockfish factory missing'); return; }
                const inst = await Factory();
                // wire engine output back to main thread
                if(inst.addMessageListener) inst.addMessageListener((line)=>{ postMessage(line); });
                else if(typeof inst.postMessage==='function' && typeof inst.addEventListener==='function') inst.addEventListener('message', (ev)=>{ postMessage(ev.data); });
                else if(typeof inst.onmessage!=='undefined') inst.onmessage = (ev)=>{ postMessage(ev.data||ev); };
                // route incoming messages from main thread to engine
                self.onmessage = function(e){ try{ const msg = e.data; if(typeof inst.postMessage==='function') inst.postMessage(msg); else if(typeof inst.post==='function') inst.post(msg); else if(typeof inst.send==='function') inst.send(msg); }catch(err){ postMessage('WORKER_ROUTE_ERR:'+String(err)); } };
              }catch(err){ postMessage('WORKER_INIT_ERR:'+String(err)); }
            })();`
          ], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          this.worker = new Worker(url);
          URL.revokeObjectURL(url);
        } catch (err) {
          // give up
        }
      }
    }

    if (!this.worker) return false;

    // wire messages for multiple engine host shapes
    if (typeof this.worker.addMessageListener === 'function') {
      // Emscripten-style API: addMessageListener(fn)
      try { this.worker.addMessageListener((line) => this._handleMessage(line)); } catch (e) {}
    }
    if (typeof this.worker.addEventListener === 'function') {
      try { this.worker.addEventListener('message', (ev) => this._handleMessage(ev.data)); } catch (e) {}
    }
    if ('onmessage' in this.worker) {
      try { this.worker.onmessage = (ev) => this._handleMessage(ev.data || ev); } catch (e) {}
    }

    // send UCI init and wait briefly for uciok
    this.post('uci');
    return new Promise((resolve) => {
      const listener = (line) => {
        if (typeof line === 'string' && /uciok/.test(line)) {
          this._off(listener);
          this._ready = true;
          resolve(true);
        }
      };
      this._on(listener);
      setTimeout(() => {
        this._off(listener);
        this._ready = true; // allow usage even if uciok didn't arrive
        resolve(false);
      }, 1500);
    });
  }

  _handleMessage(data) {
    const text = typeof data === 'string' ? data : (data && data.data) ? data.data : String(data);
    for (const fn of Array.from(this._listeners.values())) {
      try { fn(text); } catch (e) {}
    }
  }

  _on(fn) {
    const id = this._nextId++;
    this._listeners.set(id, fn);
    return id;
  }

  _off(fnOrId) {
    if (typeof fnOrId === 'number') return this._listeners.delete(fnOrId);
    for (const [id, fn] of Array.from(this._listeners.entries())) if (fn === fnOrId) this._listeners.delete(id);
  }

  post(cmd) {
    if (!this.worker) return;
    try {
      if (typeof this.worker.postMessage === 'function') return this.worker.postMessage(cmd);
      if (typeof this.worker.post === 'function') return this.worker.post(cmd);
      if (typeof this.worker.send === 'function') return this.worker.send(cmd);
    } catch (e) {}
  }

  async bestMove(fen, opts = {}) {
    await this.init();
    const movetime = opts.movetime || 1000;
    const depth = opts.depth;
    return new Promise((resolve, reject) => {
      let resolved = false;
      const cleanup = () => { this._off(listener); clearTimeout(timeout); };
      const listener = (line) => {
        if (!line) return;
        const m = line.match(/bestmove\s+([^\s]+)/i);
        if (m) {
          resolved = true;
          cleanup();
          resolve(m[1]);
        }
      };
      this._on(listener);

      // send position and go
      this.post(`position fen ${fen}`);
      if (depth) this.post(`go depth ${depth}`);
      else this.post(`go movetime ${movetime}`);

      const timeout = setTimeout(() => {
        if (!resolved) {
          cleanup();
          reject(new Error('engine timeout'));
        }
      }, (opts.timeout || movetime) + 2000);
    });
  }

  destroy() {
    if (this.worker) {
      try { this.worker.terminate(); } catch (e) {}
      this.worker = null;
    }
    this._listeners.clear();
    this._ready = false;
  }

  // Set skill level in range 0-20. Maps to UCI options where available.
  // This will attempt to set both `Skill Level` and `UCI_LimitStrength`/`UCI_Elo`.
  setSkill(level) {
    if (typeof level !== 'number') level = Number(level);
    if (Number.isNaN(level)) return;
    level = Math.max(0, Math.min(20, Math.round(level)));
    // send common UCI options
    // Prefer a direct Skill Level option if engine supports it
    try {
      this.post(`setoption name Skill Level value ${level}`);
    } catch (e) {}
    // limit strength and set approximate ELO mapping (800..3000)
    const elo = Math.round(800 + (level / 20) * 2200);
    try { this.post(`setoption name UCI_LimitStrength value true`); } catch (e) {}
    try { this.post(`setoption name UCI_Elo value ${elo}`); } catch (e) {}
  }
}

export default FairyStockfish;
