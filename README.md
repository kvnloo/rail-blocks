# Rail Blocks 3D

[Play Rail Blocks](https://kvnloo.github.io/rail-blocks/). Latch toy-plastic rails together on a wooden desk and send the train up a wall, upside down, or over the edge. Miss a connection and it tumbles off.

- **Challenges:** tap the blueprints or drag from the parts tray. Collect the stars and reach the checkered flag. Hint fits one piece at a time.
- **Free build:** pick a part and tap the grid. Use the layer arrows, Turn, Tilt, and Roll to build in three dimensions. Choose one of nine layouts from the seller's kit image, or try Sample loop for an upside-down lap. Load replaces the current sandbox. Run train tests the build; loose blocks can fall or slide. Stop returns the parts to their grid positions.
- **Camera:** use Orbit to switch from building to looking around. Drag to rotate, pinch or scroll to zoom. Use the target button to reset the view.
- **Keyboard:** Space runs or stops the train, O toggles Orbit, Esc returns to the build. In Free build, R/T/F rotate a part and `[`/`]` change layers.

The desk and challenge progress are saved in your browser. The game is static HTML, CSS, and JavaScript with vendored Three.js r187. Serve `docs/` over HTTP; no build or CDN is needed.

## Replay

`?shot=edge&t=1.2` renders one frame, at 1.2 seconds into the shot. IDs: `coasters`, `edge`, `halfpipe`, `climb`, `spiral`, `layered`, `tower` (or `1` through `7`). With `&capture=1`, `RBShot.png(t)` returns a base64 PNG of the WebGL canvas. Use a 720 × 720 viewport with device scale one for plates. Shots use the same block meshes, train, and rail sampling as the game.

## Engineering model

One grid pitch represents 3 cm. [`spec.mjs`](docs/spec.mjs) keeps the working dimensions and forces together. The 5 × 2.5 × 3 cm train envelope comes from a matching kit listing; the pitch and force limits are estimates. The train accelerates to 0.25 m/s on flat rails and 0.16 m/s on vertical climbs. Gravity and curvature can pull it out of the guide. The keyed tab and socket can latch without lining up the guide; a latch alone is not a drivable seam. The game assumes no magnet polarity rule.

The run uses simple rigid clusters and approximate collisions, not a model of the toy's internal gears or the molded joints. Presets capture the routes in the kit image, not exact pieces or counts. Open courses end in a drop instead of an automatic turnaround.

## Tests

```sh
node tests/core.mjs
node tests/engineering.mjs
python3 -m pip install playwright
python3 -m playwright install chromium
python3 tests/e2e.py
```

The Playwright suite starts a temporary loopback server, drives desktop and touch input, checks progress after reload, and verifies fixed-time replays. To test an existing site, pass the screenshot directory and URL as arguments.
