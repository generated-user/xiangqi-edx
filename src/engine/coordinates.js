export function insideBoard(x, y) {
  return x >= 0 && x < 9 && y >= 0 && y < 10;
}

export function isRed(piece) {
  return piece?.startsWith('r');
}

export function isBlack(piece) {
  return piece?.startsWith('b');
}

export function sameSide(a, b) {
  if (!a || !b) return false;
  return a[0] === b[0];
}

export function enemySide(a, b) {
  if (!a || !b) return false;
  return a[0] !== b[0];
}