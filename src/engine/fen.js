// Simple Xiangqi FEN utilities.
// Format:
// - 10 ranks separated by '/'. Each rank has 9 squares.
// - Empty squares are digits (count), pieces are letters: r/h/e/a/k/c/p.
// - Uppercase letters denote Red side, lowercase denote Black side.
// - Optional side-to-move after a space: 'r' or 'b' (or 'red'/'black').

export function parseFEN(fen) {
  if (!fen || typeof fen !== 'string') throw new Error('Invalid FEN');
  const parts = fen.trim().split(/\s+/);
  const rows = parts[0].split('/');
  if (rows.length !== 10) throw new Error('FEN must have 10 ranks');

  const board = [];
  for (let y = 0; y < 10; y++) {
    const row = rows[y];
    const outRow = [];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (/[0-9]/.test(ch)) {
        const n = Number(ch);
        for (let k = 0; k < n; k++) outRow.push(null);
        continue;
      }
      const isUpper = ch === ch.toUpperCase();
      const color = isUpper ? 'r' : 'b';
      const type = ch.toLowerCase();
      outRow.push(`${color}${type}`);
    }
    if (outRow.length !== 9) throw new Error(`Rank ${y} must have 9 squares`);
    board.push(outRow);
  }

  // side-to-move
  let side = 'red';
  if (parts.length >= 2) {
    const s = parts[1].toLowerCase();
    if (s === 'r' || s === 'red') side = 'red';
    else if (s === 'b' || s === 'black') side = 'black';
  }

  return { board, currentTurn: side };
}

export function generateFEN(board, currentTurn = 'red') {
  if (!Array.isArray(board) || board.length !== 10) throw new Error('Board must be 10x9');
  const rows = [];
  for (let y = 0; y < 10; y++) {
    const row = board[y];
    let out = '';
    let emptyCount = 0;
    for (let x = 0; x < 9; x++) {
      const p = row[x];
      if (!p) {
        emptyCount++;
        continue;
      }
      if (emptyCount > 0) {
        out += String(emptyCount);
        emptyCount = 0;
      }
      const color = p[0];
      const type = p[1];
      const ch = type.toLowerCase();
      out += (color === 'r') ? ch.toUpperCase() : ch.toLowerCase();
    }
    if (emptyCount > 0) out += String(emptyCount);
    rows.push(out);
  }
  const side = (currentTurn === 'black' || currentTurn === 'b') ? 'b' : 'r';
  return `${rows.join('/')} ${side}`;
}

export default { parseFEN, generateFEN };
