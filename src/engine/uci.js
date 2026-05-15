// Utilities to convert between UCI coordinate strings and internal x,y for Xiangqi
// Xiangqi board: files a..i (x:0..8), ranks 1..10 (y:0..9)
export function uciToMove(uci, { flip = false } = {}) {
  if (!uci || typeof uci !== 'string') return null;
  // extract from (letter+digits) and to (letter+digits), optional promotion
  const m = uci.match(/^([a-i])(\d{1,2})([a-i])(\d{1,2})([a-zA-Z])?$/);
  if (!m) return null;
  const fileToX = (f) => f.charCodeAt(0) - 'a'.charCodeAt(0);
  const rankToY = (r) => Number(r) - 1;
  let fx = fileToX(m[1]);
  let fy = rankToY(m[2]);
  let tx = fileToX(m[3]);
  let ty = rankToY(m[4]);
  if (flip) {
    fx = 8 - fx; fy = 9 - fy;
    tx = 8 - tx; ty = 9 - ty;
  }
  const promo = m[5] || null;
  return { from: { x: fx, y: fy }, to: { x: tx, y: ty }, promotion: promo };
}

export function moveToUci(move, { flip = false } = {}) {
  if (!move || !move.from || !move.to) return null;
  const xToFile = (x) => String.fromCharCode('a'.charCodeAt(0) + x);
  const yToRank = (y) => String(y + 1);
  let fx = move.from.x, fy = move.from.y, tx = move.to.x, ty = move.to.y;
  if (flip) {
    fx = 8 - fx; fy = 9 - fy; tx = 8 - tx; ty = 9 - ty;
  }
  const uci = `${xToFile(fx)}${yToRank(fy)}${xToFile(tx)}${yToRank(ty)}` + (move.promotion ? String(move.promotion) : '');
  return uci;
}

export default { uciToMove, moveToUci };
