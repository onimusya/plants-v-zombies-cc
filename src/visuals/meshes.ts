// Procedurally-built low-poly meshes for plants and zombies.
// Builders return THREE.Group so entities attach their own animation state.
import * as THREE from "three";

/** A soft dark ground-blob that grounds a unit. Attach per entity. */
export function shadowBlob(scale: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(scale, 18),
    new THREE.MeshBasicMaterial({
      color: 0x1c2a12,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  m.renderOrder = -1;
  return m;
}

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.05,
    flatShading: true,
    ...opts,
  });
}

/** Make a cone/sphere-ish mesh lying like a locator ring. */
function tileRing(r: number, color: number) {
  const g = new THREE.TorusGeometry(r, 0.035, 8, 24);
  const m = new THREE.Mesh(g, mat(color, { roughness: 0.9 }));
  m.rotation.x = Math.PI / 2;
  return m;
}

// ---------------------------------------------------------------------------
// PLANTS
// ---------------------------------------------------------------------------

export function buildPlant(type: string): { group: THREE.Group; spin: boolean } {
  const group = new THREE.Group();
  let spin = false;
  const g = new THREE.Group(); // the plant body, tilts with idle bob
  group.add(g);

  const mk = (
    geo: THREE.BufferGeometry,
    color: number,
    x = 0,
    y = 0,
    z = 0,
    rot: { x?: number; y?: number; z?: number } = {}
  ) => {
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(x, y, z);
    m.rotation.set(rot.x ?? 0, rot.y ?? 0, rot.z ?? 0);
    g.add(m);
    return m;
  };

  // Compact helper: a pair of little dark eyes + a mouth on the +X ("toward
  // zombies") front of a head sphere.
  const faceX = (
    cx: number, cy: number, cz: number,
    eyeSpan = 0.18, eyeY = 0.08, eyeR = 0.045,
    mouthW = 0.1, mouthDown = 0.1
  ) => {
    for (const s of [-1, 1]) {
      mk(new THREE.SphereGeometry(eyeR, 7, 5), 0x1c2410,
        cx, cy + eyeY, cz + s * eyeSpan, { y: s * 0.1 });
    }
    const m = mk(new THREE.BoxGeometry(mouthW, 0.028, 0.045), 0x1c2410,
      cx + 0.03, cy - mouthDown, cz);
    m.rotation.x = -0.4; // curve downward a touch into a smile
    return m;
  };

  switch (type) {
    case "sunflower": {
      spin = true;
      const stem = mk(new THREE.CylinderGeometry(0.07, 0.1, 0.5, 6), 0x4f8f3f, 0, 0.28, 0);
      // leaves (thicker, cupped)
      for (const s of [-1, 1]) {
        const leaf = mk(new THREE.ConeGeometry(0.15, 0.34, 4), 0x5da84c, s * 0.16, 0.2, 0, { z: s * 0.5 });
        leaf.rotation.y = s * 0.4;
        leaf.rotation.x = s * 0.4;
      }
      // head disc (brown, warm)
      const head = mk(new THREE.SphereGeometry(0.3, 12, 8), 0xb9822e, 0, 0.6, 0);
      head.scale.y = 0.85;
      // ring of THICK petals
      const petalGeo = new THREE.SphereGeometry(0.17, 8, 6);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const petal = mk(petalGeo, 0xffd23f, Math.cos(a) * 0.36, 0.8, Math.sin(a) * 0.36);
        petal.scale.set(1.4, 0.8, 1);
        petal.rotation.z = Math.cos(a) * 0.6;
        petal.rotation.x = Math.sin(a) * 0.6;
      }
      // warm smiling face on the brown disc (front toward camera / zombies)
      faceX(0.06, 0.6, 0, 0.17, 0.06, 0.055, 0.12, 0.06);
      // rosy cheeks
      for (const s of [-1, 1]) {
        mk(new THREE.SphereGeometry(0.045, 6, 4), 0xd98a4a, 0.1, 0.6, s * 0.2);
      }
      // a few seed dots for texture
      for (const [rx, ry] of [[-0.06, 0.62], [0.0, 0.66], [0.06, 0.62]]) {
        mk(new THREE.SphereGeometry(0.03, 5, 4), 0x8a6119, rx, ry, 0.14);
      }
      break;
    }
    case "peashooter": {
      const stem = mk(new THREE.CylinderGeometry(0.09, 0.12, 0.4, 6), 0x52a044, 0, 0.26, 0);
      mk(new THREE.SphereGeometry(0.18, 10, 8), 0x4a8f00, 0, 0.15, 0).scale.set(1, 0.8, 1); // bulb at top
      // head (big), leans slightly toward the lane
      const head = mk(new THREE.SphereGeometry(0.34, 12, 9), 0x61b33f, 0.02, 0.62, 0);
      head.scale.set(1, 0.9, 1);
      // two leaves
      for (const s of [-1, 1]) {
        const leaf = mk(new THREE.ConeGeometry(0.2, 0.5, 4), 0x5da84c, s * 0.24, 0.18, 0, { z: s * 0.55 });
        leaf.rotation.y = s * 0.5;
      }
      // barrel (the shooter) pointing +X
      const barrel = mk(new THREE.CylinderGeometry(0.12, 0.14, 0.5, 8), 0x4f8f3f, 0.32, 0.72, 0, { z: Math.PI / 2 });
      barrel.rotation.z = Math.PI / 2 - 0.35;
      barrel.position.x = 0.35;
      barrel.position.y = 0.78;
      const tip = mk(new THREE.SphereGeometry(0.13, 8, 6), 0x56a044, 0.58, 0.78, 0);
      // determined-but-cute face toward +X (the zombies)
      faceX(0.24, 0.7, 0, 0.17, 0.03, 0.05, 0.1, 0.02);
      break;
    }
    case "snowpea": {
      const stem = mk(new THREE.CylinderGeometry(0.09, 0.12, 0.4, 6), 0x4f9fa8, 0, 0.26, 0);
      // icicle sprouts at the top of the stem
      for (const s of [-1, 1]) {
        mk(new THREE.ConeGeometry(0.07, 0.16, 4), 0x8fe3f2, s * 0.09, 0.3, 0, { z: s * 0.5 });
      }
      mk(new THREE.SphereGeometry(0.2, 10, 8), 0x3fbfe0, 0, 0.15, 0);
      const head = mk(new THREE.SphereGeometry(0.34, 12, 9), 0x73d2e8, 0.02, 0.62, 0);
      head.scale.set(1, 0.9, 1);
      // icy-blue SPIKY leaves (rost spikes per side)
      for (const s of [-1, 1]) {
        const leaf = mk(new THREE.ConeGeometry(0.2, 0.5, 4), 0x3ea6b0, s * 0.24, 0.18, 0, { z: s * 0.55 });
        leaf.rotation.y = s * 0.5;
        for (const dx of [-0.03, 0.06]) {
          mk(new THREE.ConeGeometry(0.05, 0.22, 4), 0xaeeaf5,
            s * 0.22 + dx, 0.36, s * 0.18, { z: s * 0.4 });
        }
      }
      const barrel = mk(new THREE.CylinderGeometry(0.12, 0.14, 0.5, 8), 0x4f9fa8, 0.35, 0.78, 0);
      barrel.rotation.z = Math.PI / 2 - 0.35;
      const tip = mk(new THREE.SphereGeometry(0.13, 8, 6), 0x8fe3f2, 0.58, 0.78, 0);
      // cool, calm face toward +X
      faceX(0.24, 0.7, 0, 0.17, 0.03, 0.05, 0.1, 0.0);
      break;
    }
    case "wallnut": {
      // walnut shape: two-lobed body, warm tan, raised shell ridges
      const body = mk(new THREE.SphereGeometry(0.42, 16, 12), 0xc8904a, 0, 0.42, 0);
      body.scale.set(1.1, 1.05, 0.95);
      // vertical shell seam (the walnut crease) down the middle
      mk(new THREE.BoxGeometry(0.1, 0.85, 0.08), 0xa5742f, 0, 0.42, 0);
      // raised "brain" ridges
      for (const [rx, zoff] of [[0, 0.4], [Math.PI / 3, -0.22], [-Math.PI / 3, 0.22]]) {
        mk(new THREE.BoxGeometry(0.05, 0.72, 0.05), 0x9a6b28, 0, 0.42, zoff, { z: rx });
      }
      // expressive, worried face on the front lobe (facing the camera)
      // eyes (almond, worried)
      mk(new THREE.BoxGeometry(0.15, 0.1, 0.06), 0x2b1a0e, 0.14, 0.55, 0.4);
      mk(new THREE.BoxGeometry(0.15, 0.1, 0.06), 0x2b1a0e, 0.3, 0.53, 0.32);
      // worried inverted brows
      mk(new THREE.BoxGeometry(0.2, 0.04, 0.05), 0x2b1a0e, 0.13, 0.6, 0.4, { z: 0.2 });
      mk(new THREE.BoxGeometry(0.2, 0.04, 0.05), 0x2b1a0e, 0.3, 0.58, 0.32, { z: -0.2 });
      // open fearful mouth (lopsided)
      mk(new THREE.BoxGeometry(0.13, 0.1, 0.05), 0x2b1a0e, 0.22, 0.34, 0.36, { z: 0.1 });
      // sweat drop for the "oh no" charm
      const sweat = mk(new THREE.SphereGeometry(0.045, 6, 4), 0xbfe6f5, 0.05, 0.68, 0.44);
      sweat.scale.y = 1.3;
      // a tiny leaf on top for charm
      mk(new THREE.ConeGeometry(0.1, 0.2, 4), 0x5da84c, 0, 0.98, -0.1, { z: 0.5 });
      break;
    }
    case "repeater": {
      const stem = mk(new THREE.CylinderGeometry(0.09, 0.12, 0.4, 6), 0x52a044, 0, 0.26, 0);
      const head = mk(new THREE.SphereGeometry(0.36, 12, 9), 0x63b53f, 0.02, 0.62, 0);
      head.scale.y = 0.9;
      // two clearly-stacked barrels pointing +X
      for (const dy of [0.18, -0.18]) {
        const barrel = mk(new THREE.CylinderGeometry(0.11, 0.13, 0.48, 8), 0x4f8f3f, 0.4, 0.78 + dy, 0);
        barrel.rotation.z = Math.PI / 2 - 0.3;
        barrel.position.x = 0.42;
        barrel.position.y = 0.78 + dy;
        const tip = mk(new THREE.SphereGeometry(0.12, 8, 6), 0x56a044, 0.66, 0.78 + dy, 0);
      }
      for (const s of [-1, 1]) {
        const leaf = mk(new THREE.ConeGeometry(0.2, 0.5, 4), 0x5da84c, s * 0.24, 0.18, 0, { z: s * 0.55 });
        leaf.rotation.y = s * 0.5;
      }
      // determined face with narrowed brows (busy double-shooter)
      faceX(0.26, 0.68, 0, 0.2, 0.03, 0.055, 0.12, 0.0);
      for (const s of [-1, 1]) {
        mk(new THREE.BoxGeometry(0.16, 0.035, 0.04), 0x1c2410, 0.28, 0.76, s * 0.09, { z: s * 0.45 });
      }
      break;
    }
  }

  // A tiny green dirt mound + soft shadow under every plant for grounding.
  const mound = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 10, 6),
    mat(0x4a7a3a, { roughness: 1 })
  );
  mound.scale.set(1, 0.28, 1);
  mound.position.y = 0.05;
  group.add(mound);
  mound.renderOrder = 0;
  const blob = shadowBlob(0.42);
  group.add(blob);

  return { group, spin };
}

// ---------------------------------------------------------------------------
// ZOMBIES
// ---------------------------------------------------------------------------

export function buildZombie(type: string): { group: THREE.Group; hat?: THREE.Object3D } {
  const group = new THREE.Group();
  const g = new THREE.Group(); // baseGroup -> lurched by game.ts; must stay child[0]
  group.add(g);
  const body = new THREE.Group(); // carries each type's permanent posture/lean
  g.add(body);

  const mk = (
    geo: THREE.BufferGeometry,
    color: number,
    x = 0,
    y = 0,
    z = 0,
    rot: { x?: number; y?: number; z?: number } = {}
  ) => {
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(x, y, z);
    m.rotation.set(rot.x ?? 0, rot.y ?? 0, rot.z ?? 0);
    body.add(m);
    return m;
  };
  const skin = 0xb3c96a; // zombie green-tan
  const cloth = 0x5c442a;
  let hat: THREE.Object3D | undefined;

  // Wander-y, dumbzombie face toward +Z (toward the camera/zombie side).
  const addFace = (hx: number, hy: number, hz: number, r = 0.2) => {
    const fz = hz + r * 0.78;
    for (const [e, zoff] of [[-1, -0.075], [1, 0.075]] as const) {
      mk(new THREE.SphereGeometry(0.06, 6, 4), 0xfdf6e0, hx + e * 0.07, hy + 0.03, fz + 0.035);
      // right eye (e=1) pupil is pulled inward -> cross-eyed, devious charm
      const px = hx + e * 0.07 + (e === 1 ? 0.014 : 0);
      mk(new THREE.SphereGeometry(0.032, 5, 4), 0x1a1a1a, px, hy + 0.03, fz + 0.075);
    }
    // lurching open mouth (drops open / moaning)
    const mouth = mk(new THREE.BoxGeometry(0.13, 0.045, 0.04), 0x1a0f0a, hx + 0.02, hy - 0.1, fz + 0.05);
    mouth.rotation.z = -0.12;
    // one crooked tooth
    mk(new THREE.BoxGeometry(0.03, 0.045, 0.04), 0xfdf6e0, hx - 0.02, hy - 0.115, fz + 0.07, { z: -0.2 });
  };

  if (type === "runner") {
    // ---- slim, leaning-forward sprinter ----
    body.rotation.z = -0.22; // permanent forward lean toward the house
    // legs (thinner)
    for (const s of [-1, 1]) {
      mk(new THREE.BoxGeometry(0.1, 0.26, 0.14), 0x3f3323, s * 0.09, 0.13, 0);
    }
    mk(new THREE.BoxGeometry(0.3, 0.18, 0.2), 0x5a4020, 0, 0.3, 0); // shorts
    // slim torso + light vest
    mk(new THREE.BoxGeometry(0.28, 0.4, 0.2), 0x59704a, 0, 0.56, 0);
    mk(new THREE.BoxGeometry(0.3, 0.18, 0.22), 0x6b8a52, -0.02, 0.64, 0);
    // arms thrown back for a sprint
    for (const s of [-1, 1]) {
      mk(new THREE.BoxGeometry(0.08, 0.26, 0.1), skin, s * 0.2, 0.42, -0.24, { z: s * 0.5 - 0.55 });
      mk(new THREE.SphereGeometry(0.06, 6, 5), skin, s * 0.32, 0.28, -0.3, { z: s * 0.5 - 0.55 });
    }
    // spiky mohawk hair (two cones)
    const spike1 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 5), mat(0x6b3f2a));
    spike1.position.set(-0.05, 1.14, -0.05);
    spike1.rotation.z = -0.28;
    body.add(spike1);
    const spike2 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.32, 5), mat(0x6b3f2a));
    spike2.position.set(0.06, 1.16, -0.02);
    spike2.rotation.z = 0.3;
    body.add(spike2);
    // head moved forward for the lean
    const rhead = mk(new THREE.SphereGeometry(0.19, 10, 8), skin, 0.06, 0.97, 0);
    rhead.scale.set(1, 1.05, 1);
    hat = spike1;
  } else if (type === "giant") {
    // ---- BIG red-overall Gargantuar ----
    body.scale.setScalar(1.75);
    // legs (thick)
    for (const s of [-1, 1]) {
      mk(new THREE.BoxGeometry(0.2, 0.3, 0.2), 0x3a2c1e, s * 0.14, 0.15, 0);
    }
    // round overall-covered torso
    const overallBody = mk(new THREE.SphereGeometry(0.36, 10, 8), 0x8a3a3a, 0, 0.66, 0);
    overallBody.scale.set(1.15, 0.92, 0.9);
    // straps + bib badge
    for (const s of [-1, 1]) {
      mk(new THREE.BoxGeometry(0.07, 0.32, 0.04), 0x6e2b2b, s * 0.1, 0.95, 0.12);
    }
    mk(new THREE.BoxGeometry(0.16, 0.16, 0.03), 0xf2d98a, 0, 0.92, 0.14);
    // huge fists
    for (const s of [-1, 1]) {
      const fa = mk(new THREE.SphereGeometry(0.15, 6, 5), skin, s * 0.42, 0.4, -0.08);
      fa.scale.set(1.1, 1.2, 1);
    }
    // weapons: a big rock raised (kept distinct)
    const rock = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(0x8a8a90, { roughness: 0.4 }));
    rock.position.set(0.34, 1.3, 0.28);
    body.add(rock);
    // heavy jawed head
    const ghead = mk(new THREE.SphereGeometry(0.22, 10, 8), skin, 0, 1.25, 0);
    ghead.scale.set(1.15, 1.0, 1);
    // small warning cone hat (his "helmet")? keep simple: none.
  } else {
    // ---- standard walker (basic / cone / bucket) ----
    // legs
    for (const s of [-1, 1]) {
      mk(new THREE.BoxGeometry(0.13, 0.26, 0.15), 0x3f3323, s * 0.1, 0.13, 0);
    }
    // ragged trousers
    mk(new THREE.BoxGeometry(0.34, 0.2, 0.22), 0x463628, 0, 0.3, 0);
    // torso
    mk(new THREE.BoxGeometry(0.34, 0.42, 0.24), cloth, 0, 0.54, 0);
    // tie (charm detail!)
    mk(new THREE.BoxGeometry(0.12, 0.3, 0.06), 0x9a2a2a, 0, 0.5, 0.13).rotation.z = 0.05;
    // arms reaching forward limp
    for (const s of [-1, 1]) {
      mk(new THREE.BoxGeometry(0.1, 0.28, 0.12), skin, s * 0.24, 0.52, -0.16, { z: s * 0.35 - 0.1 });
      mk(new THREE.SphereGeometry(0.075, 6, 5), skin, s * 0.34, 0.38, -0.22, { z: s * 0.35 - 0.1 });
    }
    // head
    const head = mk(new THREE.SphereGeometry(0.2, 10, 8), skin, 0, 0.92, 0);
    head.scale.set(1, 1.05, 1);
    // ears
    mk(new THREE.SphereGeometry(0.05, 5, 4), skin, -0.2, 0.9, 0.02);
    mk(new THREE.SphereGeometry(0.05, 5, 4), skin, 0.2, 0.9, 0.02);
  }

  // signature hats / accessories per walker archetype
  if (type === "cone") {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.44, 10), mat(0xd9731e));
    c.position.set(0, 1.08, -0.02);
    c.rotation.z = 0.1;
    body.add(c);
    hat = c;
    // white reflective band
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.06, 10), mat(0xf5f0e0, { roughness: 0.5, metalness: 0.2 }));
    band.position.set(0, 0.99, -0.02);
    band.rotation.z = 0.1;
    body.add(band);
  } else if (type === "bucket") {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.17, 0.4, 10), mat(0x9aa0a6, { metalness: 0.5, roughness: 0.4 }));
    b.position.set(0, 1.05, -0.02);
    b.rotation.z = 0.06;
    body.add(b);
    hat = b;
    // handle loop
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 6, 12), mat(0x7f888e, { metalness: 0.6 }));
    handle.position.set(0, 1.34, -0.02);
    handle.scale.y = 0.6;
    body.add(handle);
    // rivets
    for (const s of [-1, 1]) {
      mk(new THREE.SphereGeometry(0.022, 5, 4), 0xcfd4d8, s * 0.15, 1.16, 0.14);
    }
  }

  // common face for standard & giant; runner keeps a matching one too
  addFace(type === "giant" ? 0 : 0, type === "giant" ? 1.29 : 0.96, type === "giant" ? 0 : 0, 0.2);

  const blob = shadowBlob(type === "giant" ? 0.55 : 0.33);
  group.add(blob);
  return { group, hat };
}

/** A bouncing pea projectile. */
export function buildPea(snow: boolean): THREE.Object3D {
  const g = new THREE.Group();
  const r = 0.20; // chunky so it reads in flight at gameplay scale
  // warm emissive core so the pea glows against the green lawn
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(r, 10, 8),
    mat(snow ? 0x9fe6f5 : 0x7ac74f, {
      emissive: snow ? 0x9fdcf5 : 0xd9ff8a,
      emissiveIntensity: 0.55,
    })
  );
  g.add(core);
  // highlight (sparkle for snow) + a small white trailing spark so flight pops
  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), mat(0xffffff, { roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.6 }));
  hl.position.set(0.05, 0.05, 0.05);
  g.add(hl);
  const trail = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mat(0xffffff, { transparent: true, opacity: 0.7, emissive: 0xffffff, emissiveIntensity: 0.9 }));
  trail.position.set(-0.16, 0.01, 0.01);
  g.add(trail);
  if (snow) {
    // icy tint + a little bite sparkle
    const spark = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), mat(0xffffff, { roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.8 }));
    spark.position.set(-0.05, 0.03, -0.05);
    g.add(spark);
  }
  return g;
}

/** A sun drop / collectible. */
export function buildSun(scale = 1): THREE.Object3D {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.18 * scale, 12, 8), mat(0xffd94a, { emissive: 0xffaa00, emissiveIntensity: 0.25 }));
  core.scale.y = 0.8;
  g.add(core);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const ray = new THREE.Mesh(new THREE.ConeGeometry(0.07 * scale, 0.22 * scale, 4), mat(0xffd94a, { emissive: 0xffaa00, emissiveIntensity: 0.25 }));
    ray.position.set(Math.cos(a) * 0.3 * scale, 0, Math.sin(a) * 0.3 * scale);
    ray.rotation.z = Math.cos(a) * 0.35;
    ray.rotation.x = Math.sin(a) * 0.35;
    g.add(ray);
  }
  return g;
}

/** White glossy sky-stone pebble used thown by giant. */
export function buildRock(): THREE.Object3D {
  return new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mat(0x8a8a90, { roughness: 0.4, metalness: 0.2 }));
}

export { mat };