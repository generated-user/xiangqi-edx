export class BoardRenderer {
  constructor(container, game) {
    this.container = container;
    this.game = game;
    this.selected = null;
  }

  render() {
    this.container.innerHTML = '';

    const board = document.createElement('div');
    board.className = 'board';

    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 9; x++) {
        const square = document.createElement('div');
        square.className = 'square';

        square.dataset.x = x;
        square.dataset.y = y;

        const piece = this.game.getPiece(x, y);

        if (piece) {
          square.textContent = piece;
        }

        board.appendChild(square);
      }
    }

    this.container.appendChild(board);
  }
}