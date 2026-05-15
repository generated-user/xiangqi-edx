# Xiangqi Embed

This folder contains a lightweight iframe-ready embed for using the Xiangqi engine and UI for interactive puzzles and playing vs the engine.

Usage (quick):

- Build the project with `pnpm build` (or `npm run build`) if using Vite for production assets.
- Run `pnpm run pack-embed` to create `xiangqi-embed.zip` containing the `embed/`, `src/`, and `public/` assets.
- Upload the zip to your LMS hosting and extract.
- Embed in edX/HTML with:

  <iframe src="/path/to/embed/index.html?desc=sample-puzzle.json" width="700" height="900"></iframe>

Integration notes:

- The embed posts results to the parent window via `postMessage` with messages shaped `{ source: 'xiangqi-embed', payload }`.
- The host (edX wrapper) should listen for `message` events to receive puzzle results and call the edX JS API to grade.
