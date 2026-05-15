export function createMove(fromX, fromY, toX, toY) {
  return {
    from: { x: fromX, y: fromY },
    to: { x: toX, y: toY },
  };
}

export function moveToString(move) {
  return `(${move.from.x},${move.from.y})->(${move.to.x},${move.to.y})`;
}