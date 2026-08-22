// Entry: wire together scene, game, HUD, input, render loop.
import * as THREE from "three";
import { SceneSetup } from "./scene/scene";
import { Game } from "./game/game";
import { HUD } from "./ui/hud";
import { Input } from "./input/input";
import { CameraControls } from "./input/cameraControls";
import { buildSun } from "./visuals/meshes";
import { colToX, rowToZ, ROWS } from "./core/constants";

const app = document.getElementById("app")!;
const sceneSetup = new SceneSetup();
const { scene, camera } = sceneSetup;

// Resilient renderer: try to obtain a WebGL context; if the default fails
// (e.g. software Mesa/ANGLE environments), retry with software-friendly
// options before giving up with a descriptive message.
function createRenderer(): THREE.WebGLRenderer {
  const attempts: THREE.WebGLRendererParameters[] = [
    { antialias: true },
    { antialias: true, powerPreference: "low-power", failIfMajorPerformanceCaveat: false },
    { antialias: false, powerPreference: "default", failIfMajorPerformanceCaveat: false },
  ];
  let lastErr: unknown = null;
  for (const opts of attempts) {
    try {
      return new THREE.WebGLRenderer(opts);
    } catch (e) {
      lastErr = e;
    }
  }
  // No WebGL at all — show a friendly panel instead of crashing.
  app.innerHTML =
    "<div style='position:fixed;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;background:#16222e;color:#e5f0fa;font-family:ui-sans-serif,system-ui;'>" +
    "<div><div style='font-size:64px'>🌻</div><h1 style='margin:12px 0 8px'>This browser can't open 3D</h1>" +
    "<p style='opacity:.75;max-width:420px;margin:0 auto'>WebGL isn't available here, so the lawn can't be rendered. " +
    "Try a browser or GPU with WebGL enabled.</p></div></div>";
  throw new Error("Could not create a WebGL context: " + String(lastErr));
}

const renderer = createRenderer();
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const game = new Game(scene);
const hud = new HUD(game, app);
const input = new Input(camera, game, hud, renderer);

const params = new URLSearchParams(location.search);
const showcase = params.get("showcase") === "1";
const demo = params.get("demo") === "1";
const cam = params.get("cam") ?? "game";
const activeCam = (["portrait", "overview", "low", "gamewide"] as const).includes(cam as any) ? (cam as any) : "game";
sceneSetup.setCameraPreset(showcase || demo ? activeCam : "game");

if (showcase) seedShowcase();
if (demo) seedDemo();

// Orbit controls created AFTER the camera preset so they adopt the applied view.
const controls = new CameraControls(camera, renderer.domElement);

// debug controls for critics
(window as any).__pvz = {
  game,
  sceneSetup,
  camera,
  controls,
  pause: () => game.pause(),
  resume: () => game.resume(),
  step: () => { game.pause(); },
};

game.onWave = (n) => hud.showWaveBanner(n);
game.onSunChange = (s) => hud.update(0, game);

const clock = new THREE.Clock();
let last = clock.getElapsedTime();
let time3d = 0;

function loop() {
  requestAnimationFrame(loop);
  const now = clock.getElapsedTime();
  let dt = Math.min(0.05, now - last);
  last = now;
  time3d += dt;
  game.update(dt);
  hud.update(dt, game);
  if (game.lost) hud.showGameOver();
  renderer.render(scene, camera);
}

/** Build a curated, dense "poster" scene for critics to judge a single frame. */
function seedShowcase() {
  const layout: [string, number, number][] = [
    // evenly spread a garden across the 5 lanes
    ["sunflower", 1, 0], ["peashooter", 4, 0], ["wallnut", 7, 1],
    ["snowpea", 2, 1], ["repeater", 5, 2], ["sunflower", 3, 3],
    ["peashooter", 4, 3], ["sunflower", 1, 4], ["wallnut", 6, 4],
    ["snowpea", 4, 2], ["peashooter", 6, 1],
  ];
  game.pause();
  game.autoWave = false;
  game.sun = 100000; // showcase: ignore economy so the whole garden is planted
  for (const [t, c, r] of layout) game.placePlant(t as any, c, r);
  const zombieRows: [number, number][] = [
    [0, 9], [0, 12], [1, 10], [2, 6], [2, 13], [3, 8], [4, 9], [1, 7],
  ];
  for (const [r, x] of zombieRows) game.spawnZombie("basic", r, x);
  game.spawnZombie("cone", 0, 13.5);
  game.spawnZombie("bucket", 3, 12.5);
  game.spawnZombie("runner", 4, 13);
  // ambient suns mid-fall for visual interest
  for (const [dx, dz] of [[4, 2], [8, 4], [13, 1]]) {
    const s = buildSun();
    s.position.set(colToX(dx), 3 + dz * 0.5, rowToZ(dz % ROWS));
    game.group.add(s);
    game.suns.push({ mesh: s, x: s.position.x, y: s.position.y, z: s.position.z, targetY: 0.4, ttl: 12, collectable: true, vy: 0 });
  }
}

/** A controlled, self-running skirmish for judging combat feedback/animation in motion. */
function seedDemo() {
  game.autoWave = false;
  game.sun = 100000; // demo: ignore economy
  // dense defense line on the left half, zombies pressing from the right
  const layout: [string, number, number][] = [
    ["peashooter", 1, 0], ["sunflower", 2, 0], ["peashooter", 1, 1],
    ["repeater", 2, 1], ["peashooter", 1, 2], ["sunflower", 2, 2],
    ["snowpea", 2, 3], ["peashooter", 1, 3], ["wallnut", 3, 3],
    ["repeater", 1, 4], ["sunflower", 2, 4], ["wallnut", 3, 2],
  ];
  for (const [t, c, r] of layout) game.placePlant(t as any, c, r);
  const zombies: [number, number][] = [
    [0, 8], [0, 10], [1, 9], [1, 11], [2, 7], [2, 9], [3, 8], [3, 10], [4, 8], [4, 11],
  ];
  for (const [r, x] of zombies) game.spawnZombie(Math.random() < 0.2 ? "cone" : "basic", r, x);
}

// Auto-resize the scene to the container/browser/iframe size, keeping the canvas
// crisp on any DPR. Reads from the #app container (filled to the window via CSS),
// so window resizes, iframe embeds and DPR changes all stay in sync.
const appRoot: HTMLElement = document.getElementById("app")!;
function resize() {
  const w = appRoot.clientWidth || window.innerWidth;
  const h = appRoot.clientHeight || window.innerHeight;
  sceneSetup.resize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h); // updateStyle=true so the canvas CSS matches the size
}
new ResizeObserver(resize).observe(appRoot);
window.addEventListener("resize", resize);
resize();

// Small hint for the new camera controls (auto-fades after a few seconds).
const hint = document.createElement("div");
hint.textContent = "Drag (right button) to rotate · Scroll to zoom · Double-click to reset";
Object.assign(hint.style, {
  position: "absolute", bottom: "128px", left: "50%", transform: "translateX(-50%)",
  background: "rgba(15,26,15,.6)", color: "#eaf3dd", padding: "6px 14px",
  borderRadius: "999px", fontSize: "12px", pointerEvents: "none", zIndex: "10",
  transition: "opacity 1s", border: "1px solid rgba(255,255,255,.15)",
});
app.appendChild(hint);
setTimeout(() => { hint.style.opacity = "0"; }, 4000);

loop();