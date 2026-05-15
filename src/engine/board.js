export function createInitialBoard() {
  return [
    ['br','bh','be','ba','bk','ba','be','bh','br'],
    [null,null,null,null,null,null,null,null,null],
    [null,'bc',null,null,null,null,null,'bc',null],
    ['bp',null,'bp',null,'bp',null,'bp',null,'bp'],
    [null,null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null,null],
    ['rp',null,'rp',null,'rp',null,'rp',null,'rp'],
    [null,'rc',null,null,null,null,null,'rc',null],
    [null,null,null,null,null,null,null,null,null],
    ['rr','rh','re','ra','rk','ra','re','rh','rr']
  ];
}

export function cloneBoard(board) {
  return board.map(row => [...row]);
}