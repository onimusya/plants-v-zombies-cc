// Lightweight orbit camera controls: rotate (right/middle drag), zoom (wheel),
// and reset (double-click / R). Coexists with left-drag plant placement because
// it only captures non-left pointer buttons and the wheel.
import * as THREE from "three";

export class CameraControls {
  enabled = true;
  // Default orbit target is the canonical lawn look-at point (matches scene.ts).
  private target = new THREE.Vector3(4, 0.4, 5.5);
  private radius = 18;
  private theta = 0; // azimuth
  private phi = 0; // polar angle from straight-down
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private idTarget = -1;

  // clamps
  private minPhi = 0.1; // radians from vertical (don't go under the ground)
  private maxPhi = 1.35; // radians from vertical (don't go too low/horizontal)
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
    dom.addEventListener("pointercancel", () => { this.dragging = false; });
    dom.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
    dom.addEventListener("contextmenu", (e) => e.preventDefault());
    dom.addEventListener("dblclick", () => this.reset());
    dom.style.touchAction = "none";
  }

  /** Read the current camera position into spherical coords around the target. */
  private captureFromCamera() {
    const off = new THREE.Vector3().subVectors(this.camera.position, this.target);
    this.radius = Math.max(0.001, off.length());
    this.phi = Math.acos(
      THREE.MathUtils.clamp(off.y / this.radius, -1, 1)
    );
    this.theta = Math.atan2(off.x, off.z);
  }

  /** Re-center orbit on a world-space point (used when the lawn target changes). */
  setTarget(x: number, y: number, z: number) {
    this.target.set(x, y, z);
    this.captureFromCamera();
  }

  /** Sync orbit state to an explicitly-placed camera (e.g. after a scene preset). */
  setView(position: THREE.Vector3, lookAt: THREE.Vector3) {
    this.target.copy(lookAt);
    this.camera.position.copy(position);
    this.camera.lookAt(this.target);
    this.captureFromCamera();
  }

  reset() {
    // Restore the canonical game camera (matches scene.ts "game" preset) and
    // re-capture its spherical coordinates so orbit continues from there.
    this.target.set(4, 0.4, 5.5);
    this.camera.position.set(14.05, 13.2, 15.28);
    this.camera.lookAt(this.target);
    this.captureFromCamera();
    this.apply();
  }

  private onDown(e: PointerEvent) {
    if (!this.enabled) return;
    // Only capture non-primary (right=2, middle=1) buttons + touch second finger.
    const isRotate = e.button === 2 || e.button === 1 || (e.pointerType === "touch" && e.isPrimary === false);
    if (!isRotate) return;
    // Middle-click autoscroll prevention + middle/right handling
    e.preventDefault();
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.idTarget = e.pointerId;
    this.dom.setPointerCapture(e.pointerId);
  }

  private onMove(e: PointerEvent) {
    if (!this.dragging || e.pointerId !== this.idTarget) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    const k = 0.007;
    this.theta -= dx * k;
    this.phi -= dy * k;
    this.phi = THREE.MathUtils.clamp(this.phi, this.minPhi, this.maxPhi);
    this.apply();
  }

  private onUp(e: PointerEvent) {
    if (e.pointerId === this.idTarget) {
      this.dragging = false;
      this.idTarget = -1;
    }
  }

  private onWheel(e: WheelEvent) {
    if (!this.enabled) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    this.radius = THREE.MathUtils.clamp(this.radius * factor, this.minRadius, this.maxRadius);
    this.apply();
  }

  private apply() {
    // spherical -> cartesian, keeping Y up (theta around Y)
    const sinPhi = Math.sin(this.phi);
    const x = this.radius * sinPhi * Math.sin(this.theta);
    const y = this.radius * Math.cos(this.phi);
    const z = this.radius * sinPhi * Math.cos(this.theta);
    this.camera.position.set(this.target.x + x, this.target.y + y, this.target.z + z);
    this.camera.lookAt(this.target);
  }
}