# Rail Blocks

A tiny browser puzzle inspired by the magnetic block train toys: snap colorful track blocks
together, then send a bullet train up walls, around loops and across the ceiling to the station.

**Play:** https://kvnloo.github.io/rail-blocks/

- Drag across the board to lay track; corners are fitted automatically.
- Tap a block to cycle its shape (straight, curves, ✚ crossing for loops, empty).
- ▶ Go runs the train. Collect every ★, reach the 🏁. A gap derails it.
- 6 puzzle levels + a sandbox. Progress and tracks are saved in your browser.

Single static file (`docs/index.html`), no build step, no dependencies.

Test: `pip install playwright && playwright install chromium && python3 tests/e2e.py`
(checks that every level's stored solution reaches the goal with all stars, and plays level 1 through real drag input).
