// Orbit camera controls: rotate (right/middle mouse drag OR one-finger touch
// drag), zoom (wheel OR two-finger pinch), pan (two-finger drag), and reset
// (double-click / R).
//
// Touch gestures are reported via `active` / `isTouchGesture` so the input
// handler can distinguish a tap-to-place from a camera drag.
import * as THREE from "three";

interface TouchPt {
  x: number;
  y: number;
}

const DEAD_ZONE = 8; // px a touch must travel before it becomes a camera drag

export class CameraControls {
  enabled = true;
  /** True while a camera transform (rotate/zoom/pan) is being applied. */
  active = false;
  /** True if the current gesture is a touch camera drag (vs a tap). */
  isTouchGesture = false;

  // Default orbit target is the canonical lawn look-at point (matches scene.ts).
  private target = new THREE.Vector3(4, 0.4, 5.5);
  private radius = 18;
  private theta = 0; // azimuth
  private phi = 0; // polar angle from straight-down

  // mouse rotate state
  private mouseDrag = false;
  private lastX = 0;
  private lastY = 0;
  private mouseId = -1;

  // touch state
  private touch = new Map<number, TouchPt>();
  private touchStart = new Map<number, TouchPt>();
  private lastTouch = new Map<number, TouchPt>();
  private pinchDist = 0;
  private panLast: TouchPt | null = null;
  private touchDragging = false;

  // clamps
  private minPhi = 0.1;
  private maxPhi = 1.35;
  private minRadius = 4;
  private maxRadius = 38;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private dom: HTMLElement
  ) {
    this.captureFromCamera();
    dom.addEventListener("pointerdown", (e) => this.onDown(e));
    dom.addEventListener("pointermove", (e) => this.onMove(e));
    dom.addEventListener("pointerup", (e) => this.onUp(e));
    dom.addEventListener("pointercancel", (e) => this.onUp(e));
    dom.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
    dom.addEventListener("contextmenu", (e) => e.preventDefault());
    dom.addEventListener("dblclick", () => this.reset());
    dom.style.touchAction = "none";
  }

  /** Read the current camera position into spherical coords around the target. */
  private captureFromCamera() {
    const off = new THREE.Vector3().subVectors(this.camera.position, this.target);
    this.radius = Math.max(0.001, off.length());
    this.phi = Math.acos(THREE.MathUtils.clamp(off.y / this.radius, -1, 1));
    this.theta = Math.atan2(off.x, off.z);
  }

  setTarget(x: number, y: number, z: number) {
    this.target.set(x, y, z);
    this.captureFromCamera();
  }

  setView(position: THREE.Vector3, lookAt: THREE.Vector3) {
    this.target.copy(lookAt);
    this.camera.position.copy(position);
    this.camera.lookAt(this.target);
    this.captureFromCamera();
  }

  reset() {
    this.target.set(4, 0.4, 5.5);
    this.camera.position.set(14.05, 13.2, 15.28);
    this.camera.lookAt(this.target);
    this.captureFromCamera();
    this.apply();
  }

  private onDown(e: PointerEvent) {
    if (!this.enabled) return;
    if (e.pointerType === "touch") {
      e.preventDefault();
      const pt = { x: e.clientX, y: e.clientY };
      this.touch.set(e.pointerId, pt);
      this.touchStart.set(e.pointerId, { ...pt });
      this.touchDragging = false;
      if (this.touch.size === 2) {
        this.pinchDist = this.dist(this.touchPoints());
        this.active = true;
      }
      return;
    }
    // mouse: only non-primary buttons rotate (primary = plant).
    if (e.button === 2 || e.button === 1) {
      e.preventDefault();
      this.mouseDrag = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.mouseId = e.pointerId;
      this.dom.setPointerCapture(e.pointerId);
      this.active = true;
    }
  }

  private onMove(e: PointerEvent) {
    if (e.pointerType === "touch") {
      const start = this.touchStart.get(e.pointerId);
      // engage a drag once a finger travels past the dead-zone
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > DEAD_ZONE) {
        this.touchDragging = true;
        this.isTouchGesture = true;
        this.active = true;
      }

      // update the pointer's current + last positions
      const prev = this.lastTouch.get(e.pointerId);
      this.lastTouch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.touch.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (!this.touchDragging) return;

      // two fingers: pinch to zoom + pan
      if (this.touch.size >= 2) {
        const pts = this.touchPoints();
        const d = this.dist(pts);
        if (this.pinchDist > 0) {
          this.radius = THREE.MathUtils.clamp((this.radius * this.pinchDist) / d, this.minRadius, this.maxRadius);
        }
        this.pinchDist = d;
        // pan via midpoint delta
        this.pan2(pts);
        this.apply();
        return;
      }

      // one finger: rotate using per-frame delta
      if (prev) {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        this.orbit(dx, dy);
      }
      return;
    }
    // mouse rotate
    if (this.mouseDrag && e.pointerId === this.mouseId) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.orbit(dx, dy);
    }
  }

  private onUp(e: PointerEvent) {
    if (e.pointerType === "touch") {
      this.touch.delete(e.pointerId);
      this.touchStart.delete(e.pointerId);
      this.lastTouch.delete(e.pointerId);
      this.pinchDist = 0;
      if (this.touch.size === 0) {
        const wasDrag = this.touchDragging;
        this.touchDragging = false;
        this.isTouchGesture = false;
        this.active = false;
        this.panLast = null;
        // double-tap to reset (a tap that wasn't a drag, twice within 300ms)
        if (!wasDrag) this.onTap();
      }
      return;
    }
    if (e.pointerId === this.mouseId) {
      this.mouseDrag = false;
      this.mouseId = -1;
      this.active = false;
    }
  }

  private lastTap = 0;
  private onTap() {
    const now = performance.now();
    if (now - this.lastTap < 300) {
      this.lastTap = 0;
      this.reset();
    } else {
      this.lastTap = now;
    }
  }

  private onWheel(e: WheelEvent) {
    if (!this.enabled) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    this.radius = THREE.MathUtils.clamp(this.radius * factor, this.minRadius, this.maxRadius);
    this.apply();
  }

  /** Rotate by a screen-space delta (used by touch and mouse). */
  private orbit(dx: number, dy: number) {
    const k = 0.007;
    this.theta -= dx * k;
    this.phi -= dy * k;
    this.phi = THREE.MathUtils.clamp(this.phi, this.minPhi, this.maxPhi);
    this.apply();
  }

  /** Pan the camera target by moving it opposite the 2-finger midpoint delta. */
  private pan2(pts: TouchPt[]) {
    const m = { x: (pts[0].x + (pts[1]?.x ?? pts[0].x)) / 2, y: (pts[0].y + (pts[1]?.y ?? pts[0].y)) / 2 };
    if (!this.panLast) { this.panLast = m; return; }
    const dx = m.x - this.panLast.x;
    const dy = m.y - this.panLast.y;
    this.panLast = m;
    if (dx === 0 && dy === 0) return;

    const scale = this.radius * 0.0022 * Math.sin(this.phi);
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const camUp = new THREE.Vector3().crossVectors(right, fwd).normalize();
    this.target.addScaledVector(right, -dx * scale);
    this.target.addScaledVector(camUp, dy * scale);
  }

  private touchPoints(): TouchPt[] {
    return Array.from(this.touch.values());
  }

  private dist(pts: TouchPt[]): number {
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  private apply() {
    const sinPhi = Math.sin(this.phi);
    const x = this.radius * sinPhi * Math.sin(this.theta);
    const y = this.radius * Math.cos(this.phi);
    const z = this.radius * sinPhi * Math.cos(this.theta);
    this.camera.position.set(this.target.x + x, this.target.y + y, this.target.z + z);
    this.camera.lookAt(this.target);
  }
}