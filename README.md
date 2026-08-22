# 🌻 Lawn Defense — a low-poly 3D tower-defense game

A Plants-vs-Zombies-style tower-defense game built with **Three.js** and **TypeScript** (Vite). Defend your cozy backyard house by planting defenses across a 5-lane lawn against waves of zombies, while collecting sun to fund your garden.

**Live demo:** https://onimusya.github.io/plants-v-zombies-cc/

---

## Getting started

```bash
npm install
npm run dev        # start the dev server (Vite)
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build locally
npm run typecheck  # type-check only
```

Requires Node 18+ and a WebGL-enabled browser.

## Controls

| Action | Mouse | Touch |
| --- | --- | --- |
| Select a plant card | Click a card (bottom bar) | Tap a card |
| Plant / collect sun | Left-click the lawn / a sun | Tap the lawn / a sun |
| Rotate the camera | Right-drag | One-finger drag |
| Zoom in / out | Mouse wheel | Two-finger pinch |
| Pan the view | — | Two-finger drag |
| Reset the camera | Double-click | Double-tap |

Hint: a soft **red pulse + arrow** marks the lane currently in the most danger.

## How to play

1. **Collect sun** (🔆) and let sunflowers produce more — sun is your currency.
2. **Buy defenses** from the seed-packet bar when you can afford them.
3. **Place** sunflowers (economy), peashooters and snow peas (damage + slow), wall-nuts (tank), and repeaters (double shots).
4. **Stop the zombies** before they reach the house. Each zombie archetype (basic, cone, bucket, runner, giant) has different HP, speed, and threat.

## Features

- Full game loop: checkered 5×9-lane lawn, five plants, five zombie types, peas/projectiles, collectible sun, escalating waves, and a game-over state.
- A cozy hand-built low-poly diorama: gabled house with chimney and lit windows, picket fence, trees, flower beds, and a pond — all warm golden-hour lighting.
- Character charm: every plant and zombie has a face and personality (hats, gaits, recoil, nodding).
- Juicy combat feedback: death pops with flattened grey corpses left on the lawn, hit flashes + knockback, particle bursts, and a danger-lane pulse.
- Charming UI: parchment seed-packet cards, a chunky sun-coin counter, and serif wave banners.
- Camera orbit/zoom/pan with touch support, and auto-resize to any browser or iframe.

## Project layout

```
src/
  core/constants.ts     # types + balance (plants, zombies, costs, HP)
  scene/scene.ts        # camera, lighting, lawn, house, backyard
  game/game.ts          # game loop, entities, combat, waves
  visuals/meshes.ts     # procedural low-poly plant/zombie/sun meshes
  ui/hud.ts             # sun counter, seed-packet cards, banners
  input/input.ts        # planting, sun clicking, tap detection
  input/cameraControls.ts # orbit/zoom/pan camera (mouse + touch)
loop/                   # builder → critic loop: bar, verdicts, progress page
.github/workflows/      # GitHub Pages deploy workflow
```

## Deployment

Pushing to `main` automatically builds and deploys `dist` to GitHub Pages via `actions/deploy-pages`. The Vite config uses a relative `base` (`./`) so the site works under any repo subpath.

---

Built with an iterative builder + harsh-critic loop that compared each build against the original *Plants vs. Zombies*; the live progress page lives in [`loop/`](loop/progress.html).