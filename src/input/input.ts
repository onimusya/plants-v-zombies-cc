// Mouse/keyboard input: grid picking for plant placement, sun clicking, ghost preview.
import * as THREE from "three";
import { COLS, ROWS, CELL_W, CELL_D, LAWN_LEFT, LAWN_FRONT, colToX, rowToZ } from "../core/constants";
import { buildPlant } from "../visuals/meshes";
import type { Game } from "../game/game";
import type { HUD } from "../ui/hud";
import type { CameraControls } from "./cameraControls";

export class Input {
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private ghost: THREE.Object3D | null = null;
  // press tracking so planting happens only on a stable tap (not a camera drag)
  private press: { id: number; x: number; y: number } | null = null;
  private static TAP_DEAD_ZONE = 10;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private game: Game,
    private hud: HUD,
    private renderer: THREE.WebGLRenderer,
    private controls: CameraControls
  ) {
    const el = renderer.domElement;
    el.addEventListener("pointerdown", (e) => this.onDown(e));
    el.addEventListener("pointermove", (e) => this.onMove(e));
    el.addEventListener("pointerup", (e) => this.onUp(e));
    el.addEventListener("pointercancel", () => { this.press = null; });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.hud.selectedType) {
        this.hud.toggleSelect(this.hud.selectedType);
        this.setGhostVisible(false);
      }
    });
  }

  private onDown(e: PointerEvent) {
    this.setNdc(e);
    this.raycaster.setFromCamera(this.ndc, this.camera);

    // collecting sun acts immediately on press (feels snappy)
    if (this.pickSun()) {
      e.preventDefault();
      this.press = null;
      return;
    }
    // only a primary tap or mouse click begins planting
    if (e.button !== 0 && e.pointerType !== "touch") return;
    this.press = { id: e.pointerId, x: e.clientX, y: e.clientY };
    // hide the ghost while not hovering a valid cell yet
    this.setNdcGhost();
  }

  private onUp(e: PointerEvent) {
    if (this.press && e.pointerId === this.press.id) {
      const wasTap =
        Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) <= Input.TAP_DEAD_ZONE;
      const cameraMoved = this.controls.active || this.controls.isTouchGesture;
      this.press = null;
      if (!wasTap || cameraMoved) return; // it was a drag, don't place
      this.placeSelectedAt(e);
    }
  }

  private placeSelectedAt(e: PointerEvent) {
    if (!this.hud.selectedType) return;
    this.setNdc(e);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const cell = this.pickCell();
    if (!cell) return;
    if (this.game.placePlant(this.hud.selectedType, cell.col, cell.row)) {
      this.hud.triggerCooldown(this.hud.selectedType);
      if (!this.game.canAfford(this.hud.selectedType)) {
        const t = this.hud.selectedType;
        this.hud.toggleSelect(t);
        this.setGhostVisible(false);
      }
    }
  }

  private setNdcGhost() {
    // refresh raycast origin helpers if needed
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  private onMove(e: PointerEvent) {
    this.setNdc(e);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const cell = this.pickCell();
    this.setGhostVisible(!!this.hud.selectedType);
    if (this.ghost && cell) {
      this.ghost.position.set(colToX(cell.col), 0.07, rowToZ(cell.row));
      this.ghost.visible = this.hud.selectedType !== null;
    }
  }

  private setGhostVisible(v: boolean) {
    if (!this.hud.selectedType) return;
    if (!this.ghost) {
      const { group } = buildPlant(this.hud.selectedType);
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.material = (o.material as THREE.MeshStandardMaterial).clone();
          (o.material as THREE.MeshStandardMaterial).transparent = true;
          (o.material as THREE.MeshStandardMaterial).opacity = 0.55;
        }
      });
      this.ghost = group;
      this.game.group.add(group);
    }
    if (this.ghost) this.ghost.visible = v;
  }

  private setNdc(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /** Returns true if a sun was clicked+collected. */
  private pickSun(): boolean {
    let hit: THREE.Object3D | null = null;
    let best = Infinity;
    for (const s of this.game.suns) {
      if (!s.collectable) continue;
      const sphere = new THREE.Sphere(s.mesh.position, 0.6);
      const p = new THREE.Vector3();
      const ok = this.raycaster.ray.intersectSphere(sphere, p);
      if (ok) {
        const d = p.distanceTo(this.raycaster.ray.origin);
        if (d < best) {
          best = d;
          hit = s.mesh;
        }
      }
    }
    if (hit) {
      this.game.collectSunAt(hit.position);
      return true;
    }
    return false;
  }

  private pickCell(): { col: number; row: number } | null {
    const pt = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, pt)) return null;
    const col = Math.floor((pt.x - LAWN_LEFT) / CELL_W);
    const row = Math.floor((pt.z - LAWN_FRONT) / CELL_D);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    if (this.game.plantAt(col, row)) return null;
    return { col, row };
  }
}