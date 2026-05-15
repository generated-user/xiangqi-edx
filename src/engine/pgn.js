// Simple coordinate PGN utilities for Xiangqi.
// Format: moves separated by spaces, each move as `x1y1-x2y2`, 0-based digits.
// Example: "04-24 76-56"

export function parsePGN(pgn) {
  if (!pgn || typeof pgn !== 'string') return [];
  const toks = pgn.trim().split(/\s+/);
  const moves = [];
  for (const t of toks) {
    if (!t) continue;
    const m = t.trim();
    const parts = m.split('-');
    if (parts.length !== 2) continue;
    const a = parts[0];
    const b = parts[1];
    if (a.length !== 2 || b.length !== 2) continue;
    const fromX = Number(a[0]);
    const fromY = Number(a[1]);
    const toX = Number(b[0]);
    const toY = Number(b[1]);
    if ([fromX,fromY,toX,toY].some(n => Number.isNaN(n))) continue;
    moves.push({ from: { x: fromX, y: fromY }, to: { x: toX, y: toY } });
  }
  return moves;
}

export function generatePGN(moves) {
  if (!Array.isArray(moves)) return '';
  return moves.map(m => `${m.from.x}${m.from.y}-${m.to.x}${m.to.y}`).join(' ');
}

export default { parsePGN, generatePGN };
