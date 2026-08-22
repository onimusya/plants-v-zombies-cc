// Scene construction: warm backyard diorama, camera rig, lighting, sky.
import * as THREE from "three";
import { COLS, ROWS, CELL_W, CELL_D, LAWN_LEFT, LAWN_RIGHT, LAWN_FRONT, LAWN_BACK } from "../core/constants";
import { mat } from "../visuals/meshes";

function grassColor(col: number, row: number): number {
  const checker = (col + row) % 2 === 0;
  return checker ? 0x7cc24f : 0x74b846;
}

export class SceneSetup {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  dirLight: THREE.DirectionalLight = new THREE.DirectionalLight();
  private envGroup = new THREE.Group();

  constructor() {
    this.scene.fog = new THREE.Fog(0xaee3f2, 45, 95);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    this.configureCamera();
    this.buildSky();
    this.buildGround();
    this.buildLawn();
    this.buildHouse();
    this.buildBackyard();
    this.buildLights();
    this.scene.add(this.envGroup);
  }

  configureCamera() {
    // Slightly rotated isometric view; the resulting frame keeps the house top-left,
    // full 5-lane lawn centre, and zombie spawn on the right. Inlined from preset.
    const cx = (LAWN_LEFT + LAWN_RIGHT) / 2;
    const cz = LAWN_BACK / 2;
    this.camera.position.set(cx + 5.5, 13.5, cz + 11);
    this.camera.lookAt(4, 0.4, 5.5);
  }

  /** Move the camera into one of a few preset framings (debug/showcase). */
  setCameraPreset(name: "game" | "portrait" | "overview" | "low" | "gamewide") {
    const p = {
      game: [8.55 + 5.5, 13.2, 4.75 + 10.5, 2.0, 0.4, 5.5],
      portrait: [2.2, 3.6, 17.5, 4.0, 1.4, 4.0],
      overview: [9.0, 22, 13.0, 4.0, 0.4, 6.0],
      low: [1.0, 2.4, 17.5, 4.5, 0.9, 5.0],
      gamewide: [8.55 + 7.0, 12.0, 4.75 + 13.0, 4.0, 0.3, 5.0],
    } as any;
    const v = p[name];
    this.camera.position.set(v[0], v[1], v[2]);
    this.camera.lookAt(v[3], v[4], v[5]);
  }

  private buildSky() {
    // vertical gradient sky via a big sphere with vertex colors handled by fog + bg.
    this.scene.background = new THREE.Color(0xaee3f2);
    // big sun disc low in sky (golden hour warmth)
    const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 16), mat(0xfff0b0, { emissive: 0xffdf8a, emissiveIntensity: 0.6, roughness: 1 }));
    sun.position.set(-26, 20, -60);
    sun.lookAt(this.camera.position);
    this.envGroup.add(sun);
    // soft clouds (low-poly blobs)
    for (let i = 0; i < 6; i++) {
      const cloud = new THREE.Group();
      const matCloud = mat(0xf6fbfd, { roughness: 1 });
      const c = Math.random() * 0.6;
      const n = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(1.2 + Math.random() * 1.4, 8, 6), matCloud);
        s.position.set((j - n / 2) * 1.6, Math.random() * 0.5, Math.random() * 1);
        cloud.add(s);
      }
      cloud.position.set(-40 + i * 16 + Math.random() * 6, 26 + Math.random() * 5, -50 + Math.random() * 14);
      this.envGroup.add(cloud);
    }
  }

  private buildGround() {
    // Big grass plane that extends far beyond the lawn (backyard horizon).
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mat(0x5fa83e, { roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    this.envGroup.add(ground);
    // a dirt path leading up to the lawn
    const path = new THREE.Mesh(new THREE.BoxGeometry(22, 0.05, 14), mat(0xc8a76b, { roughness: 1 }));
    path.position.set(LAWN_LEFT + 4, -0.42, LAWN_BACK + 26);
    path.rotation.x = 0.02;
    this.envGroup.add(path);
  }

  private buildLawn() {
    const w = LAWN_RIGHT - LAWN_LEFT;
    const d = LAWN_BACK - LAWN_FRONT;
    // raised soil block
    const soil = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 1.2, d + 1.2), mat(0x6b4a26, { roughness: 1 }));
    soil.position.set((LAWN_LEFT + LAWN_RIGHT) / 2, -0.6, (LAWN_FRONT + LAWN_BACK) / 2);
    this.envGroup.add(soil);
    // checkered top
    const cellGeo = new THREE.BoxGeometry(CELL_W - 0.1, 0.1, CELL_D - 0.1);
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const m = new THREE.Mesh(cellGeo, mat(grassColor(c, r), { roughness: 0.95 }));
        m.position.set(LAWN_LEFT + c * CELL_W + CELL_W / 2, 0.02, LAWN_FRONT + r * CELL_D + CELL_D / 2);
        this.envGroup.add(m);
      }
    }
    // row separators
    const sepGeo = new THREE.BoxGeometry(w + 1.1, 0.05, 0.14);
    for (let r = 0; r <= ROWS; r++) {
      const m = new THREE.Mesh(sepGeo, mat(0x4a8a30, { roughness: 1 }));
      m.position.set((LAWN_LEFT + LAWN_RIGHT) / 2, 0.04, LAWN_FRONT + r * CELL_D);
      this.envGroup.add(m);
    }
    // left "front porch" strip for plants is the lawn start.
  }

  private buildHouse() {
    const h = new THREE.Group();
    // Rotate the whole house so its detailed front (door, windows, gable peak)
    // faces +X (toward the lawn/camera) instead of +Z, so it reads as a house
    // from gameplay rather than as a featureless side wall.
    h.rotation.y = Math.PI / 2;
    const PX = LAWN_LEFT; // house sits just left of the lawn edge
    // Compact house: depth ~7 (not the whole lawn), tucked fully left of the lawn
    // so its rotated footprint (which spans ~±4.4 in X) never occludes a column.
    const dH = 6.8;
    const HZ = LAWN_FRONT + 2.4; // front-ish, closer to camera
    const hx = PX - 8.2;         // center x: footprint spans ≈[-12.6,-3.8], far from the lawn
    const hz = HZ + dH / 2;      // center z
    const wallW = 5.2;
    const wallH = 6.6;

    const cream = mat(0xf0e0c4, { roughness: 0.9 });
    const dark = mat(0x6e2f23, { roughness: 0.8 }); // roof (clearly darker)

    // ---- body (compact, warm cream) ----
    const body = new THREE.Mesh(new THREE.BoxGeometry(wallW, wallH, dH), cream);
    body.position.set(hx, wallH / 2, hz);
    h.add(body);
    // siding grooves on the front (camera-facing +Z) and side faces
    const groove = mat(0xe0cda8, { roughness: 0.9 });
    for (let sy = 1.0; sy < wallH - 0.4; sy += 0.9) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(wallW + 0.06, 0.035, dH + 0.06), groove);
      g.position.set(hx, sy, hz);
      h.add(g);
    }
    // foundation
    const ff = new THREE.Mesh(new THREE.BoxGeometry(wallW + 0.7, 0.8, dH + 0.7), mat(0x8b7a63, { roughness: 1 }));
    ff.position.set(hx, 0.4, hz);
    h.add(ff);

    // ---- gable roof: explicit triangular prism so it ALWAYS renders.
    // Apex runs along Z at x=hx,y=peakY; eaves at x=hx±half,y=baseY.
    {
      const half = wallW / 2;
      const baseY = wallH - 0.4;
      const peakY = wallH + 2.3;
      const rL = dH / 2 + 0.8; // half-length along Z (overhang both ends)
      const ax = 0; // relative x
      const p = { x: hx, y: baseY, z: hz };
      // vertices (x,z) offsets relative to (hx,hz)
      const T1 = [ax, peakY, -rL], T2 = [ax, peakY, rL];
      const L1 = [-half - 0.3, baseY, -rL], L2 = [-half - 0.3, baseY, rL];
      const R1 = [half + 0.3, baseY, -rL], R2 = [half + 0.3, baseY, rL];
      const pos = [];
      const triPts: number[][] = [];
      // build triangle soup directly: two triangles per quad + one per gable
      for (const [A1, A2, B1, B2] of [
        [T1, L1, L2, T2], // left slope quad
        [T1, R1, R2, T2], // right slope quad
      ]) {
        triPts.push(A1, A2, B1, A1, B1, B2);
      }
      for (const [A, B, C] of [
        [T1, L1, R1],
        [T2, R2, L2],
      ]) {
        triPts.push(A, B, C);
      }
      for (const v of triPts) pos.push(p.x + v[0], p.y + v[1], p.z + v[2]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      const roof = new THREE.Mesh(geo, dark);
      roof.material.side = THREE.DoubleSide;
      h.add(roof);
    }
    // a lintel/trim line under the eave for crispness
    const eave = new THREE.Mesh(new THREE.BoxGeometry(wallW + 1.2, 0.28, dH + 1.4), mat(0xd8b998, { roughness: 0.8 }));
    eave.position.set(hx, wallH + 0.15, hz);
    h.add(eave);

    // ---- chimney ----
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.6, 0.9), mat(0x9a6a4a, { roughness: 0.9 }));
    chim.position.set(hx + 1.3, wallH + 1.9, hz);
    h.add(chim);
    const flue = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 1.1), mat(0x6b4a34, { roughness: 0.9 }));
    flue.position.set(hx + 1.3, wallH + 3.2, hz);
    h.add(flue);

    // ---- windows (on the front +Z face, facing the camera) ----
    const pane = mat(0x9ad0f5, { emissive: 0xffe9a0, emissiveIntensity: 0.5, roughness: 0.4 });
    const frame = mat(0xf5efe2, { roughness: 0.8 });
    const fz = hz + dH / 2 + 0.12; // front surface z
    for (const [wx, wy] of [[-1.2, 3.6], [1.2, 3.6]]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, 0.25), pane);
      p.position.set(hx + wx, wy, fz);
      h.add(p);
      // white frame: 4 thin bars around the pane
      const fb = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.18, 0.32), frame); fb.position.set(hx + wx, wy + 0.74, fz); h.add(fb);
      const fbt = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.18, 0.32), frame); fbt.position.set(hx + wx, wy - 0.74, fz); h.add(fbt);
      const fs1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.65, 0.32), frame); fs1.position.set(hx + wx - 0.8, wy, fz); h.add(fs1);
      const fs2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.65, 0.32), frame); fs2.position.set(hx + wx + 0.8, wy, fz); h.add(fs2);
    }

    // ---- front door + step (camera-facing) ----
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.2, 0.3), mat(0x7a4a26, { roughness: 0.9 }));
    door.position.set(hx, 1.8, fz + 0.15);
    h.add(door);
    const dTrim = new THREE.Mesh(new THREE.BoxGeometry(1.9, 3.6, 0.18), frame);
    dTrim.position.set(hx, 1.9, fz + 0.42);
    h.add(dTrim);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(0xffd94a, { metalness: 0.5, roughness: 0.3 }));
    knob.position.set(hx + 0.55, 1.8, fz + 0.5);
    h.add(knob);
    // porch step + posts + roof over the door
    const step = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 1.1), mat(0xc9b693, { roughness: 1 }));
    step.position.set(hx, 0.3, fz + 0.6);
    h.add(step);
    // welcome mat
    const matPlane = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.5), mat(0xa54825, { roughness: 1 }));
    matPlane.position.set(hx, 0.11, fz + 0.95);
    h.add(matPlane);
    // a small porch roof awning
    const awning = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 0.8), dark);
    awning.position.set(hx, 3.6, fz + 0.55);
    h.add(awning);

    // house-number plate
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.04), frame);
    plate.position.set(hx + 1.1, 4.6, fz + 0.5);
    h.add(plate);

    this.envGroup.add(h);
  }

  private buildBackyard() {
    // ---- white picket fence along the back edge + right side (cozy boundary) ----
    const post = mat(0xf4efe3, { roughness: 0.85 });
    const rail = mat(0xe6dfcf, { roughness: 0.85 });
    const plankGeo = new THREE.BoxGeometry(0.12, 0.75, 0.05);
    // back fence line
    const backZ = LAWN_BACK + 0.6;
    for (let x = LAWN_LEFT - 2; x <= LAWN_RIGHT + 4; x += 1.0) {
      const pl = new THREE.Mesh(plankGeo, post);
      pl.position.set(x, 0.35, backZ);
      this.envGroup.add(pl);
    }
    // horizontal rails for the back fence
    for (const ry of [0.22, 0.5]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(LAWN_RIGHT + 7, 0.06, 0.05), rail);
      r.position.set((LAWN_LEFT - 2 + LAWN_RIGHT + 4) / 2, ry, backZ);
      this.envGroup.add(r);
    }
    // short right-side fence
    const rightX = LAWN_RIGHT + 1.0;
    for (let z = LAWN_FRONT; z <= LAWN_BACK; z += 1.0) {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.12), post);
      pl.position.set(rightX, 0.32, z);
      this.envGroup.add(pl);
    }
    for (const ry of [0.2, 0.48]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, LAWN_BACK + 1), rail);
      r.position.set(rightX, ry, LAWN_BACK / 2);
      this.envGroup.add(r);
    }

    // ---- trees (trunk + layered foliage) behind house + at the back corners ----
    const trunkMat = mat(0x7a5230, { roughness: 1 });
    const leafA = mat(0x3f7a2c, { roughness: 1 });
    const leafB = mat(0x59a23c, { roughness: 1 });
    const tree = (x: number, z: number, s: number) => {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.22 * s, 1.3 * s, 6), trunkMat);
      trunk.position.y = 0.65 * s;
      g.add(trunk);
      for (let i = 0; i < 3; i++) {
        const l = new THREE.Mesh(new THREE.SphereGeometry((0.7 - i * 0.14) * s, 8, 6), i % 2 ? leafA : leafB);
        l.position.set((Math.random() - 0.5) * 0.5, 1.35 * s + i * 0.5 * s, (Math.random() - 0.5) * 0.5);
        l.scale.y = 0.85;
        g.add(l);
      }
      g.position.set(x, -0.5, z);
      this.envGroup.add(g);
    };
    tree(-6.2, 3.5, 1.3);
    tree(-5.4, -1.0, 1.1);
    tree(-3.0, -1.8, 1.2);
    tree(LAWN_RIGHT + 2.5, 8.5, 1.2);
    tree(LAWN_RIGHT + 1.6, 9.3, 1.4);

    // ---- flower beds (tiny colorful blooms) along the front and left edges ----
    const colors = [0xe0565a, 0xf2a03c, 0xc97ad0, 0x7fbfe4, 0xf2d24c];
    for (let k = 0; k < 26; k++) {
      const fx = LAWN_LEFT - 1.5 + Math.random() * (LAWN_RIGHT + 4);
      const fz = (Math.random() < 0.5 ? -0.9 : LAWN_BACK + 0.15) + (Math.random() - 0.5) * 0.5;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 4), mat(0x3f7a2c));
      stem.position.set(fx, 0.1, fz);
      this.envGroup.add(stem);
      const bloom = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 6, 5),
        mat(colors[k % colors.length], { roughness: 0.7 })
      );
      bloom.position.set(fx, 0.26, fz);
      this.envGroup.add(bloom);
    }

    // small bushes/shrubs for charm
    const bushMat = mat(0x3f7a2c, { roughness: 1 });
    for (let i = 0; i < 10; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.4 + Math.random() * 0.35, 8, 6), bushMat);
      b.scale.y = 0.7;
      b.position.set(LAWN_LEFT - 2.5 + Math.random() * 12, -0.35, LAWN_FRONT - 1.6 + (i % 3) * 1.5);
      this.envGroup.add(b);
    }

    // pond on the left side of the yard
    const pond = new THREE.Mesh(new THREE.CircleGeometry(2.0, 20), mat(0x4a9ed4, { roughness: 0.3, metalness: 0.3 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(LAWN_LEFT - 4.2, -0.4, LAWN_BACK + 4);
    this.envGroup.add(pond);
    // a couple of lily pads
    const lilly = new THREE.Mesh(new THREE.CircleGeometry(0.4, 8), mat(0x43a23c, { roughness: 0.9 }));
    lilly.rotation.x = -Math.PI / 2;
    lilly.position.set(LAWN_LEFT - 4.0, -0.38, LAWN_BACK + 4.3);
    this.envGroup.add(lilly);
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(0xfff2d8, 0x5a9a3a, 1.05);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffe9bb, 2.3);
    dir.position.set(-8, 18, 8);
    this.scene.add(dir);
    this.dirLight = dir;
    const rim = new THREE.DirectionalLight(0xdff3ff, 0.7);
    rim.position.set(16, 10, 12);
    this.scene.add(rim);
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}