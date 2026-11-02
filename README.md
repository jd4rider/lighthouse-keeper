# Lighthouse Keeper

Route beams along a night coast: turn lighthouses, angle mirrors and tint lenses so every buoy is lit with the colour it wants, while every forbidden reef stays dark. Built with Phaser 4, Vite and Electron — playable in the browser and as a desktop app for macOS, Windows and Linux.

- Play in your browser: <https://jd4rider.github.io/lighthouse-keeper/play/>
- Downloads: <https://github.com/jd4rider/lighthouse-keeper/releases/latest>

## How to play

- **Lighthouse** — tap to turn it a quarter turn. Each one shines a single beam.
- **Mirror** — tap to flip between `/` and `\`, or drag it onto open water to move it.
- **Lens** — tap to cycle red → green → blue. The beam takes the colour of the last lens it passes.
- **Buoy** — lit only when the beam arrives in the colour it asks for. `W` buoys need an untinted beam, so keep lenses away from them.
- **Rock** — blocks and absorbs the beam.
- **Red reef marker** — must never be touched by any beam.

Solve at or under par for three stars; each hint costs a star. Progress and stars are saved locally.

**24 stations across four coasts:** Harbor Watch (7×7 warm-ups), Cliffside (8×8), Reef Waters (9×9) and Storm Coast (10×10).

## Develop

```bash
npm install
npm run dev      # web dev server
npm test         # beam, level and scoring tests
npm start        # build and open in Electron
npm run dist:mac # package an installer (also dist:win, dist:linux)
```

Levels live in `src/levels.js` as the **solved** board (lighthouse headings, mirror angles, lens colours). `createBoard` scrambles those settings deterministically for play, and `npm test` re-runs every level's solved art through the beam tracer, so a level that doesn't actually light its buoys fails the build.

The beam engine is `src/game.js`; scenes are in `src/phaser/`.

## Release

Pushing a `v*` tag runs `.github/workflows/release.yml`, which builds installers on macOS, Windows and Linux and attaches them to the GitHub release. Pushing to `main` redeploys the website (landing page at `/`, game at `/play/`) via `.github/workflows/pages.yml`.
