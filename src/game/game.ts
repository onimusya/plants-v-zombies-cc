// Game state + main update loop. Owns plants, zombies, projectiles, sun, waves.
import * as THREE from "three";
import {
  COLS, ROWS, CELL_W, CELL_D, LAWN_LEFT, LAWN_RIGHT, LAWN_FRONT, LAWN_BACK,
  colToX, rowToZ,
  PLANT_SPECS, ZOMBIE_SPECS,
  START_SUN, SUN_PER_SEC,
  PlantType, ZombieType, Vec2,
} from "../core/constants";
import { buildPlant, buildZombie, buildPea, buildSun, mat } from "../visuals/meshes";

interface Plant {
  type: PlantType;
  row: number;
  col: number;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  group: THREE.Group;
  baseY: number;
  bobPhase: number;
  spinSpeed: number;
  fireTimer: number;
  sunTimer: number;
  startY: number;
  // animation refs: the plant body child + squash/kick state
  body: THREE.Object3D;
  recoil: number; // 0..1 kick-back on firing, decays
  nodPhase: number; // sunflower nod
  // wallnut only: damage-state readout (crack boxes + shell tint for readability)
  shellMat?: THREE.MeshStandardMaterial;
  crack?: THREE.Object3D;
  crack2?: THREE.Object3D;
}

interface Zombie {
  type: ZombieType;
  row: number;
  x: number; // current x
  hp: number;
  maxHp: number;
  group: THREE.Group;
  baseGroup: THREE.Object3D;
  speed: number;
  dmg: number;
  slowTimer: number;
  eating: boolean;
  walkPhase: number;
  score: number;
  flash: number; // >0: white hit-flash timer; drives emissive pulse on HP loss
  // over-head HP chip (dark backplate + scaled green/yellow/red fill)
  hpBar: THREE.Object3D;
  hpFill: THREE.Mesh;
}

interface Proj {
  mesh: THREE.Object3D;
  snow: boolean;
  x: number; z: number; y: number;
  row: number;
  speed: number;
  dmg: number;
  vx: number;
  spin: number;
}

interface Sun {
  mesh: THREE.Object3D;
  x: number; y: number; z: number;
  targetY: number;
  ttl: number;
  collectable: boolean;
  vy: number;
}

// Lightweight pooled particle for pop/hit bursts. Each carries its own motion
// (velocity + gravity) so it arcs out and falls, spinning, shrinking and fading.
interface HitFx {
  mesh: THREE.Mesh;
  ttl: number;
  max: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  spin: number;
}

// A flattened, greyed-out zombie corpse that lies on the lane briefly, then
// sinks into the grass. Pure visual; not part of gameplay AI.
interface Corpse {
  group: THREE.Object3D;
  timer: number; // seconds it lies on the lawn before sinking
  sinkTimer: number; // >0 while actively sinking into the grass
  sinkDuration: number;
  baseY: number;
}

// A removed plant's body squash-and-fading away (wilted-blink "consequence").
interface Wilt {
  group: THREE.Object3D;
  ttl: number;
  max: number;
}

const PEAR_SPEED = 8.5;
const FIRE_RATE = 1.4; // shots per sec
const FIRE_RATE_REPEATER = 2.2;
const SNOW_SLOW = 0.5;

// wallnut shell tint range (tan -> broken brown) for the damage state readout
const HP_TAN = new THREE.Color(0xc8904a);
const HP_BROWN = new THREE.Color(0x5a3818);

export class Game {
  scene: THREE.Scene;
  group = new THREE.Group();

  // shared HP-chip bar materials (per color tier) + the danger strip material
  private fillMatGreen = mat(0x3bd64a);
  private fillMatYellow = mat(0xe0c22a);
  private fillMatRed = mat(0xd8362f);
  private hpBarBack = mat(0x141414, { transparent: true, opacity: 0.82 });
  private threatMat = mat(0xff2a2a, { transparent: true, opacity: 0.30 });
  private threatStrip!: THREE.Mesh;
  // bright emissive leading-edge chevron that marks the endangered lane
  private threatMarker!: THREE.Group;
  private threatMarkerMat = mat(0xff3020, {
    emissive: 0xff3020, emissiveIntensity: 1.0, transparent: true, opacity: 1,
  });

  sun = 0;
  sunTimer = 0;
  ambientSunTimer = 9; // first ambient sun a moment after start
  time = 0;
  sunflowerTimer = 0;

  plants: Plant[] = [];
  zombies: Zombie[] = [];
  projs: Proj[] = [];
  suns: Sun[] = [];
  fx: HitFx[] = [];
  corpses: Corpse[] = [];
  wilts: Wilt[] = [];

  // spawner
  waveTimer = 6;
  wave = 0;
  spawned = 0; // total zombies spawned so far
  waveBudget = 0; // zombies to spawn in current wave
  spawnTimer = 0;
  spawnSpacing = 2.2;

  lost = false;
  paused = false;
  autoWave = true; // when false, only manually-spawned zombies run
  autoSun = true;

  // ---- demo controls (exposed on window by main.ts) ----
  pause() { this.paused = true; }
  resume() { this.paused = false; }
  toggleAuto() { this.autoWave = !this.autoWave; this.autoSun = !this.autoSun; }

  onSunChange?: (s: number) => void;
  onPlantDone?: () => void;
  onWave?: (wave: number) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.add(this.group);
    this.sun = START_SUN;

    // translucent red "danger" strip, one mesh reused every frame to mark the
    // lane whose zombie has pushed deepest toward the house.
    const stripH = 0.05;
    this.threatStrip = new THREE.Mesh(
      new THREE.BoxGeometry(LAWN_RIGHT - LAWN_LEFT, stripH, CELL_D),
      this.threatMat
    );
    this.threatStrip.position.y = 0.06;
    this.threatStrip.renderOrder = 2;
    this.threatStrip.visible = false;
    this.group.add(this.threatStrip);

    // bright red leading-edge danger ARROW pinned at the house-side edge of the
    // threatened lane: two angled wings + a taller body, unmissable against grass.
    this.threatMarker = new THREE.Group();
    const wMat = this.threatMarkerMat;
    const wingGeo = new THREE.BoxGeometry(0.6, 0.2, 0.16);
    const wingL = new THREE.Mesh(wingGeo, wMat);
    wingL.position.set(-0.16, 0.0, 0);
    wingL.rotation.z = 0.5; // tilts up toward -X (house side)
    this.threatMarker.add(wingL);
    wingL.scale.set(1.4, 1, 1);
    const wingR = new THREE.Mesh(wingGeo, wMat);
    wingR.position.set(0.16, 0.0, 0);
    wingR.rotation.z = -0.5;
    wingR.scale.set(1.4, 1, 1);
    this.threatMarker.add(wingR);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.55, 0.28), wMat);
    body.position.set(0, 0.2, 0);
    this.threatMarker.add(body);
    this.threatMarker.position.set(LAWN_LEFT + 0.5, 0.1, 0);
    this.threatMarker.renderOrder = 3;
    this.threatMarker.visible = false;
    this.group.add(this.threatMarker);
  }

  canAfford(type: PlantType): boolean {
    return this.sun >= PLANT_SPECS[type].cost;
  }

  placePlant(type: PlantType, col: number, row: number): boolean {
    if (this.plantAt(col, row)) return false;
    if (!this.canAfford(type)) return false;
    this.sun -= PLANT_SPECS[type].cost;
    this.onSunChange?.(this.sun);

    const x = colToX(col);
    const z = rowToZ(row);
    const { group, spin } = buildPlant(type);
    const spec = PLANT_SPECS[type];
    group.position.set(x, 0, z);
    this.group.add(group);

    this.plants.push({
      type, row, col, x, z,
      hp: spec.hp, maxHp: spec.hp,
      group, baseY: 0.8, bobPhase: Math.random() * 6.28,
      spinSpeed: spin ? 0.6 : 0,
      fireTimer: 0,
      sunTimer: type === "sunflower" ? 2 : 0,
      startY: 0,
      body: group.children[0],
      recoil: 0,
      nodPhase: Math.random() * 6.28,
    });
    // wallnut readability: pre-build the "cracked shell" damage readout once.
    if (type === "wallnut") {
      const pl = this.plants[this.plants.length - 1];
      const shellMesh = pl.body.children[0] as THREE.Mesh;
      pl.shellMat = (Array.isArray(shellMesh.material)
        ? shellMesh.material[0] : shellMesh.material) as THREE.MeshStandardMaterial;
      pl.crack = this.makeCrack(0.55, 0.78, 0.46, 0.05);
      pl.crack2 = this.makeCrack(0.5, 0.62, 0.12, 0.02);
      pl.body.add(pl.crack);
      pl.body.add(pl.crack2);
    }
    return true;
  }

  plantAt(col: number, row: number): Plant | undefined {
    return this.plants.find((p) => p.col === col && p.row === row);
  }

  zombieInRow(row: number, maxX?: number): Zombie[] {
    return this.zombies.filter((z) => z.row === row && (maxX === undefined || z.x < maxX));
  }

  update(dt: number) {
    if (this.lost || this.paused) return;
    this.time += dt;
    if (this.autoSun) {
      // ambient sun: occasionally a sun falls from the sky (collect-only income)
      this.ambientSunTimer -= dt;
      if (this.ambientSunTimer <= 0) {
        this.ambientSunTimer = 7 + Math.random() * 4;
        this.spawnFallingSun();
      }
      // sunflower production (per-plant)
      for (const p of this.plants) {
        if (p.type === "sunflower") {
          p.sunTimer -= dt;
          if (p.sunTimer <= 0) {
            p.sunTimer = 6 + Math.random() * 2;
            this.harvestSunflower(p);
          }
        }
      }
    }
    if (this.autoWave) this.updateWave(dt);
    this.updatePlants(dt);
    this.updateZombies(dt);
    this.updateThreatLane();
    this.updateProjs(dt);
    this.updateSuns(dt);
    this.updateFx(dt);
    this.updateCorpses(dt);
  }

  private updatePlants(dt: number) {
    for (const p of this.plants) {
      // idle bob
      p.bobPhase += dt * 2;
      const bob = Math.sin(p.bobPhase) * 0.04;
      p.group.position.y = bob;
      if (p.spinSpeed) {
        p.group.rotation.y += dt * p.spinSpeed;
      }

      // personality: sunflower gently nods its head
      if (p.type === "sunflower") {
        p.nodPhase += dt * 3;
        const nod = Math.sin(p.nodPhase) * 0.14;
        p.body.rotation.z = nod;
        p.body.rotation.x = Math.abs(Math.sin(p.nodPhase * 0.5)) * 0.1;
        const swell = 1 + Math.sin(p.nodPhase * 2) * 0.03;
        p.body.scale.set(swell, 1 / swell, swell);
      }

      // shoot (with a recoil / squash-and-stretch kickback)
      if (p.type === "peashooter" || p.type === "repeater" || p.type === "snowpea") {
        const rate = p.type === "repeater" ? FIRE_RATE_REPEATER : FIRE_RATE;
        p.fireTimer -= dt;
        const tgt = p.type === "repeater" ? 1.5 : 1; // repeater: shoot when zombie within range + closer
        const zombiesAhead = this.zombieInRow(p.row, p.x + 9);
        if (zombiesAhead.length > 0 && p.fireTimer <= 0) {
          const shots = p.type === "repeater" ? 2 : 1;
          p.fireTimer = 1 / rate;
          for (let i = 0; i < shots; i++) {
            this.firePea(p, i * 0.12);
          }
        }
        // decay the shot kick and settle the body
        p.recoil = Math.max(0, p.recoil - dt * 5);
        // kick back (rotate so the barrel rocks back) + squash on the body
        p.body.rotation.z = -p.recoil * 0.5;
        const sy = 1 - p.recoil * 0.24;
        const sw = 1 + p.recoil * 0.16;
        p.body.scale.set(sw, sy, sw);
      } else if (p.type !== "sunflower") {
        // non-moving plants (wallnut) keep a still, planted body
        p.recoil = 0;
        p.body.rotation.z = p.body.rotation.z * 0.8;
      }

      // wallnut damage state: crack the shell, sink + darken as HP drops so a
      // player reads "about to break" at a glance. Cheap: toggles + color lerp.
      if (p.type === "wallnut" && p.shellMat) {
        const dmg = Math.max(0, Math.min(1, 1 - p.hp / p.maxHp));
        if (p.crack) p.crack.visible = dmg >= 0.34;     // below ~66% HP
        if (p.crack2) p.crack2.visible = dmg >= 0.67;   // below ~33% HP
        // darken shell from tan toward broken brown as it nears the end
        p.shellMat.color.lerpColors(
          HP_TAN, HP_BROWN, Math.pow(dmg, 1.5)
        );
        // subtle sink as the nut weakens
        const sink = 1 - dmg * 0.05;
        p.body.scale.set(sink, sink, sink * 1.02);
      }
    }
  }

  private firePea(p: Plant, delay: number) {
    const snow = p.type === "snowpea";
    const mesh = buildPea(snow);
    const y = 0.78 + Math.sin(p.bobPhase * 0.5) * 0.02;
    mesh.position.set(p.x + 0.5, y, p.z);
    this.group.add(mesh);
    this.projs.push({
      mesh, snow,
      x: p.x + 0.5, z: p.z, y,
      row: p.row, speed: PEAR_SPEED,
      dmg: 20, vx: 0, spin: 0,
    });
    // recoil the shooter back on each shot (pea peashooter kicks, not just recoils)
    p.recoil = 1;
  }

  private updateProjs(dt: number) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const pr = this.projs[i];
      pr.x += dt * pr.speed;
      pr.mesh.position.x = pr.x;
      pr.mesh.rotation.z += dt * 10;
      pr.mesh.rotation.y += dt * 6;
      // hit first zombie in this row
      const target = this.zombieInRow(pr.row).find((z) => z.x - pr.x < 0.35 && z.x - pr.x > -0.1);
      if (target) {
        target.hp -= pr.dmg;
        this.hitFlash(target);
        this.hitFxAt(pr.x, pr.z, pr.snow);
        if (pr.snow) target.slowTimer = 5;
        this.removeProj(i);
        if (target.hp <= 0) this.killZombie(target);
        continue;
      }
      // off field
      if (pr.x > LAWN_RIGHT + 2) this.removeProj(i);
    }
  }

  private removeProj(i: number) {
    const pr = this.projs[i];
    this.group.remove(pr.mesh);
    this.projs.splice(i, 1);
  }

  private updateZombies(dt: number) {
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      const slowing = z.slowTimer > 0;
      if (slowing) z.slowTimer -= dt;

      // decaying white hit-flash (emissive pulse) after each pea connects
      if (z.flash > 0) {
        z.flash -= dt;
        if (z.flash <= 0) {
          this.setEmissive(z.group, 0x000000, 0);
        } else {
          const inten = (z.flash / 0.12) * 1.4;
          this.setEmissive(z.group, 0xffffff, inten);
        }
      }

      // Determine if a plant blocks the path ahead (in same lane, left of zombie)
      const blocker = this.plants
        .filter((p) => p.row === z.row && p.x < z.x)
        .sort((a, b) => b.x - a.x)[0];

      if (blocker && z.x - blocker.x < 0.55) {
        z.eating = true;
        z.x = blocker.x + 0.55;
        blocker.hp -= z.dmg * dt;
        if (blocker.hp <= 0) {
          this.removePlant(blocker);
        }
      } else {
        z.eating = false;
        const sp = z.speed * (slowing ? SNOW_SLOW : 1);
        z.x -= dt * sp;
      }

      // walk anim / lurch (+ archetype body language)
      z.walkPhase += dt * (z.eating ? 0.5 : z.speed * 4);
      // per-type gait: runner staggered/bouncy, giant heavy, cone/bucket stiffer
      const gait = z.type === "runner" ? 1.6 : z.type === "giant" ? 0.55 : 1;
      const swayAmp = (z.eating ? 0.28 : 0.12) * (z.type === "giant" ? 0.7 : 1);
      const tilt = (z.eating ? 0.06 : Math.sin(z.walkPhase) * swayAmp) * gait;
      z.baseGroup.rotation.z = z.eating ? 0.15 : tilt;
      z.baseGroup.position.y = Math.abs(Math.sin(z.walkPhase)) * 0.06 * (z.type === "giant" ? 0.5 : 1);
      z.group.position.x = z.x;

      // reached house
      if (z.x < LAWN_LEFT - 0.5) {
        this.lost = true;
      }

      // keep the overhead HP chip facing the viewer + matching the HP fraction
      this.updateZombieHpBar(z);
    }
  }

  private removePlant(p: Plant) {
    // brown wilted burst: a few specks pop outward from where it stood
    for (let i = 0; i < 4 + Math.floor(Math.random() * 2); i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 5, 4),
        mat([0x7a5a2a, 0x5c442a, 0x4a3a1e][i % 3], { transparent: true, opacity: 0.9 })
      );
      m.position.set(p.x, 0.7 + Math.random() * 0.3, p.z);
      this.group.add(m);
      this.fx.push({
        mesh: m,
        ttl: 0.5, max: 0.5,
        vx: (Math.random() - 0.5) * 2.4,
        vy: 1.2 + Math.random() * 1.6,
        vz: (Math.random() - 0.5) * 2,
        gravity: -6,
        spin: (Math.random() - 0.5) * 12,
      });
    }
    // keep the plant body for a quick squash-and-fade "wilted" death
    this.wilts.push({ group: p.group, ttl: 0.25, max: 0.25 });
    const idx = this.plants.indexOf(p);
    if (idx >= 0) this.plants.splice(idx, 1);
    this.onPlantDone?.();
  }

  spawnZombie(type: ZombieType, row: number, x?: number) {
    const spec = ZOMBIE_SPECS[type];
    const { group, hat } = buildZombie(type);
    const zx = x ?? LAWN_RIGHT + 8 + Math.random() * 6;
    group.position.set(zx, 0, rowToZ(row));
    (group.children[0] as any).userData.hat = hat;
    this.group.add(group);
    // overhead HP chip, one per zombie (own fill mesh so it scales per entity)
    const bar = this.buildHpBar();
    bar.group.position.y = this.zombieHeadY(type);
    group.add(bar.group);
    this.zombies.push({
      type, row, x: zx,
      hp: spec.hp, maxHp: spec.hp,
      group, baseGroup: group.children[0],
      speed: spec.speed, dmg: spec.dmg,
      slowTimer: 0, eating: false,
      walkPhase: Math.random() * 6.28,
      score: spec.score,
      flash: 0,
      hpBar: bar.group,
      hpFill: bar.fill,
    });
  }

  killZombie(z: Zombie) {
    // squash the last few frames of the flash away (corpse is grey/un-flashed)
    this.setEmissive(z.group, 0x000000, 0);
    // "pop" moment registers *before* the corpse drops: brief grey-white flash +
    // a vertical squash->RESET scale spike on the live zombie so the kill pops
    // rather than silently fading out.
    z.group.scale.set(1.3, 0.7, 1.3);       // hard squash
    this.setEmissive(z.group, 0xffffff, 3); // bright white flash
    this.popFlash(z.x, rowToZ(z.row));
    z.group.scale.set(1.3, 1.3, 1.3);       // snap back up (RESET) right as it dies
    this.setEmissive(z.group, 0x000000, 0);
    // pop burst: skin/cloth/tie chunks fly outward with an upward arc
    this.popBurst(z.x, rowToZ(z.row));
    // signature PVZ payoff: a flattened grey corpse is left lying on the lane
    this.dropCorpse(z);
    // stop gameplay AI from walking/eating/attacking it immediately
    this.group.remove(z.group);
    const idx = this.zombies.indexOf(z);
    if (idx >= 0) this.zombies.splice(idx, 1);
  }

  // --- zombie death/hit juice -------------------------------------------------

  /** Knocks the zombie back a hair and flags a brief white hit-flash. */
  private hitFlash(z: Zombie) {
    z.x += 0.06; // cosmetic knockback nudge
    z.group.position.x = z.x;
    z.flash = 0.12;
  }

  // --- readability helpers (HP chips, wallnut cracks, danger lane) ------------

  /** Builds one zombie's overhead HP chip: dark backplate + left-anchored fill. */
  private buildHpBar() {
    const group = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.055, 0.02), this.hpBarBack);
    group.add(back);
    // fill geometry is shifted +x so scaling it grows from the left edge
    const fillGeo = new THREE.BoxGeometry(0.32, 0.038, 0.014);
    fillGeo.translate(0.16, 0, 0);
    const fill = new THREE.Mesh(fillGeo, this.fillMatGreen);
    fill.position.x = -0.17 + 0.012; // nest inside the backplate's left edge
    group.add(fill);
    group.visible = false; // hidden until damaged (or always for heavy zombies)
    // tip the flat chip up toward the high/overhead camera so it stays readable
    group.rotation.x = -0.6;
    return { group, fill };
  }

  /** Float height of the HP chip above each zombie's head. */
  private zombieHeadY(type: ZombieType): number {
    switch (type) {
      case "giant": return 2.55;
      case "runner": return 1.32;
      default: return 1.22;
    }
  }

  /** Show/scale/tint the zombie's HP chip. O(1), no per-frame allocation. */
  private updateZombieHpBar(z: Zombie) {
    const frac = Math.max(0, Math.min(1, z.hp / z.maxHp));
    // heavy archetypes always show their (bigger) life pool; light ones only
    // reveal the chip once they've actually taken a hit.
    const heavy = z.type === "bucket" || z.type === "cone" || z.type === "giant";
    const show = (frac < 0.999) || heavy;
    if (z.hpBar.visible !== show) z.hpBar.visible = show;
    if (!show) return;
    // scale the fill from the left, clamped so a sliver survives at ~0 HP
    z.hpFill.scale.x = Math.max(0.001, frac);
    // green -> yellow (<40%) -> red (<20%)
    z.hpFill.material =
      frac >= 0.4 ? this.fillMatGreen : (frac >= 0.2 ? this.fillMatYellow : this.fillMatRed);
  }

  /** One dark "crack" box for the wallnut shell; toggled on with damage. */
  private makeCrack(w: number, y: number, depth: number, x: number): THREE.Mesh {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.05, depth),
      mat(0x4a2c10)
    );
    m.position.set(x, y, 0.06);
    m.rotation.z = 0.5;
    m.visible = false;
    return m;
  }

  /** Marks the most-threatened lane (deepest zombie) with a pulsing red strip. */
  private updateThreatLane() {
    let deepest: Zombie | undefined;
    for (const z of this.zombies) {
      if (!deepest || z.x < deepest.x) deepest = z;
    }
    if (!deepest) {
      this.threatStrip.visible = false;
      this.threatMarker.visible = false;
      return;
    }
    this.threatStrip.visible = true;
    this.threatMarker.visible = true;
    // fast urgent pulse so the endangered lane reads immediately
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 11);
    // strong red band: base 0.30, peak 0.46 — unmistakable against the lawn
    this.threatMat.opacity = 0.30 + 0.16 * pulse;
    this.threatMarkerMat.opacity = 0.55 + 0.45 * pulse;
    this.threatMarkerMat.emissiveIntensity = 0.7 + 0.8 * pulse;
    this.threatStrip.scale.x = 0.98 + 0.04 * pulse;
    this.threatStrip.position.z = rowToZ(deepest.row);
    this.threatMarker.position.z = rowToZ(deepest.row);
  }

  /** 8-12 small spheres pop outward with an upward arc, shrinking + fading. */
  private popBurst(x: number, z: number) {
    const colors = [0x9db879, 0xb3c96a, 0x5c442a, 0x9a2a2a];
    const n = 8 + Math.floor(Math.random() * 5); // 8-12
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 6, 4),
        mat(colors[i % colors.length], { transparent: true, opacity: 0.95 })
      );
      m.position.set(x, 0.85 + Math.random() * 0.35, z);
      this.group.add(m);
      this.fx.push({
        mesh: m,
        ttl: 0.6, max: 0.6,
        vx: (Math.random() - 0.5) * 4,
        vy: 1.6 + Math.random() * 2.2,
        vz: (Math.random() - 0.5) * 3,
        gravity: -7,
        spin: (Math.random() - 0.5) * 14,
      });
    }
  }

  /**
   * Bright grey-white "combat pop": a tight burst of emissive specks that flash
   * outward and fade, soldering the kill moment so it reads even at scale.
   */
  private popFlash(x: number, z: number) {
    const colors = [0xffffff, 0xcfcfcf, 0xb7bcb2];
    const n = 7 + Math.floor(Math.random() * 4); // 7-10
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 6, 4),
        mat(colors[i % colors.length], {
          transparent: true, opacity: 1, emissive: 0xffffff, emissiveIntensity: 1.4,
        })
      );
      m.position.set(x, 0.95 + Math.random() * 0.3, z);
      this.group.add(m);
      this.fx.push({
        mesh: m,
        ttl: 0.32, max: 0.32,
        vx: (Math.random() - 0.5) * 6.5,
        vy: 2.4 + Math.random() * 2.8,
        vz: (Math.random() - 0.5) * 5,
        gravity: -9,
        spin: (Math.random() - 0.5) * 20,
      });
    }
  }

  /**
   * A flattened, greyed-out clone of the zombie lies face-down on the lane for
   * ~4s, then sinks into the grass. Pure visual in this.corpses; no AI touches
   * it. Shares no materials with the (removed) live zombie.
   */
  private dropCorpse(z: Zombie) {
    const group = z.group.clone(true);
    // grey out every mesh to a darker, high-contrast grey (vs green lawn)
    this.tintCorpse(group, 0x6b6f63);
    // flatten + enlarge so the corpse reads at gameplay scale. Rotate about Y so
    // the flattened silhouette (outstretched arms, red tie chunk) presents its
    // readable, spread shape toward the +Z camera instead of a buried smear.
    group.scale.set(0.85, 0.45, 0.85);
    group.rotation.set(-Math.PI / 2, Math.PI / 2, 0);
    const baseY = 0.05;
    group.position.set(z.x, baseY, rowToZ(z.row));
    this.group.add(group);
    this.corpses.push({
      group,
      timer: 7.0,
      sinkTimer: 0,
      sinkDuration: 1.0,
      baseY,
    });
  }

  /** Recursively recolor the corpse's materials grey + make them fade-able. */
  private tintCorpse(root: THREE.Object3D, color: number) {
    const mats: THREE.Material[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const src of list) {
        const m = src.clone();
        const c = (m as { color?: THREE.Color }).color;
        if (c) c.setHex(color);
        m.transparent = true;
        m.opacity = 1;
        mats.push(m);
      }
    });
    // reassign the freshly-cloned (unique) materials back onto the meshes
    let i = 0;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) {
        const arr: THREE.Material[] = [];
        for (let k = 0; k < mesh.material.length; k++) arr.push(mats[i++]);
        mesh.material = arr;
      } else {
        mesh.material = mats[i++];
      }
    });
  }

  /** Set emissive (+intensity) across a unit's standard materials for hit flash. */
  private setEmissive(root: THREE.Object3D, color: number, intensity: number) {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const raw of list) {
        const m = raw as THREE.MeshStandardMaterial;
        if (m.emissive) {
          m.emissive.setHex(color);
          m.emissiveIntensity = intensity;
          m.needsUpdate = true;
        }
      }
    });
  }

  private updateWave(dt: number) {
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.startWave();
    }
    if (this.spawnTimer > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) this.trySpawnZombie();
    }
  }

  private startWave() {
    this.wave++;
    this.waveBudget += Math.min(2 + this.wave * 1.5, 26);
    this.waveTimer = 22;
    this.spawnTimer = 0.5; // kick off spawning
    this.onWave?.(this.wave);
  }

  private trySpawnZombie() {
    if (this.spawned >= this.waveBudget) {
      this.spawnTimer = 0;
      return;
    }
    // pick a random lane weighted toward reading
    const row = Math.floor(Math.random() * ROWS);
    const roll = Math.random();
    let type: ZombieType = "basic";
    if (this.wave >= 3 && roll < 0.15) type = "cone";
    else if (this.wave >= 5 && roll < 0.3) type = "cone";
    else if (this.wave >= 7 && roll < 0.42) type = "bucket";
    else if (this.wave >= 4 && roll < 0.5) type = "runner";
    if (this.wave >= 8 && Math.random() < 0.12) type = "giant";
    this.spawnZombie(type, row);
    this.spawned++;
    this.spawnTimer = this.spawnSpacing / (1 + this.wave * 0.04);
  }

  // ---- sun ----
  spawnFallingSun() {
    const mesh = buildSun();
    const x = LAWN_LEFT + 1 + Math.random() * (LAWN_RIGHT - 2);
    const z = LAWN_FRONT + 0.5 + Math.random() * (LAWN_BACK - 1);
    mesh.position.set(x, 10, z);
    this.group.add(mesh);
    this.suns.push({ mesh, x, y: 10, z, targetY: 0.4 + Math.random() * 0.6, ttl: 12, collectable: false, vy: 0 });
  }

  /** Sunflower blooms a collectible sun near its head. */
  harvestSunflower(p: Plant) {
    const mesh = buildSun(0.85);
    const x = p.x + (Math.random() - 0.5) * 0.8;
    const z = p.z + (Math.random() - 0.5) * 0.8;
    mesh.position.set(x, 1.1, z);
    this.group.add(mesh);
    this.suns.push({ mesh, x, y: 1.1, z, targetY: 0.7, ttl: 10, collectable: true, vy: 0 });
  }

  private updateSuns(dt: number) {
    for (let i = this.suns.length - 1; i >= 0; i--) {
      const s = this.suns[i];
      if (!s.collectable) {
        s.y -= dt * 4;
        s.mesh.rotation.y += dt * 2;
        s.mesh.position.y = s.y;
        if (s.y <= s.targetY) {
          s.y = s.targetY;
          s.collectable = true;
          s.ttl = 12;
          // ping on landing
          s.mesh.scale.setScalar(1.5);
        }
      } else {
        s.ttl -= dt;
        // gentle pulse + bobs (reads as "collectible")
        const pulse = 1 + Math.sin(this.time * 5 + s.mesh.position.x) * 0.08;
        s.mesh.scale.lerp(new THREE.Vector3(pulse, pulse, pulse), 0.2);
        s.mesh.rotation.y += dt * 1.2;
        s.mesh.position.y = s.y + Math.sin(this.time * 3 + s.mesh.position.z) * 0.06;
        if (s.ttl <= 0) {
          this.group.remove(s.mesh);
          this.suns.splice(i, 1);
          continue;
        }
      }
    }
  }

  collectSunAt(screen: THREE.Vector3): boolean {
    // find nearest collectable sun within a reasonable world distance
    let best: Sun | undefined;
    let bestD = Infinity;
    for (const s of this.suns) {
      if (!s.collectable) continue;
      const dx = s.x - screen.x;
      const dz = s.z - screen.z;
      const d = Math.hypot(dx, dz);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (best && bestD < 1.0) {
      this.group.remove(best.mesh);
      this.suns.splice(this.suns.indexOf(best), 1);
      this.sun += 25;
      this.onSunChange?.(this.sun);
      return true;
    }
    return false;
  }

  // ---- fx ----
  /** Juicy hit: 3-5 colored particles pop outward from the impact point. */
  hitFxAt(x: number, z: number, snow: boolean) {
    const color = snow ? 0xbfe9f5 : 0xeaffd0;
    const n = 3 + Math.floor(Math.random() * 3); // 3-5
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 4),
        mat(color, {
          transparent: true, opacity: 0.95,
          emissive: snow ? 0xaee9ff : 0xeaffd0, emissiveIntensity: 0.8,
        })
      );
      m.position.set(x, 0.8, z);
      this.group.add(m);
      this.fx.push({
        mesh: m,
        ttl: 0.4, max: 0.4,
        vx: (Math.random() - 0.5) * 5,
        vy: 1.8 + Math.random() * 2.6,
        vz: (Math.random() - 0.5) * 3.8,
        gravity: -8,
        spin: (Math.random() - 0.5) * 26,
      });
    }
  }

  private updateFx(dt: number) {
    // particle bursts: integrate motion + gravity, spin, shrink and fade
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.ttl -= dt;
      // motion with gravity, then apply
      f.vy += f.gravity * dt;
      f.mesh.position.x += dt * f.vx;
      f.mesh.position.y += dt * f.vy;
      f.mesh.position.z += dt * f.vz;
      f.mesh.rotation.x += dt * f.spin;
      f.mesh.rotation.z += dt * f.spin * 0.7;
      const k = Math.max(0, f.ttl / f.max);
      f.mesh.scale.setScalar(0.3 + k * 0.9);
      const m = f.mesh.material as THREE.MeshStandardMaterial;
      m.opacity = k * 0.95;
      if (f.ttl <= 0) {
        this.group.remove(f.mesh);
        this.fx.splice(i, 1);
      }
    }
    // plant wilt: squash + fade the removed body away
    for (let i = this.wilts.length - 1; i >= 0; i--) {
      const w = this.wilts[i];
      w.ttl -= dt;
      const k = Math.max(0, w.ttl / w.max);
      const s = 0.2 + k * 0.8;      // shrink toward ~0
      w.group.scale.set(s, s * 0.6, s); // squash fast then fade
      w.group.position.y = 0.05 * k;
      w.group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const raw of list) raw.opacity = k;
        }
      });
      if (w.ttl <= 0) {
        this.group.remove(w.group);
        this.wilts.splice(i, 1);
      }
    }
  }

  private updateCorpses(dt: number) {
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i];
      if (c.sinkTimer <= 0) {
        // lies still on the lane for a beat
        c.timer -= dt;
        if (c.timer <= 0) c.sinkTimer = c.sinkDuration;
      } else {
        // smooth sink into the grass + fade
        c.sinkTimer -= dt;
        const k = Math.max(0, c.sinkTimer / c.sinkDuration); // 1 -> 0
        c.group.position.y = c.baseY * (k) - (1 - k) * 0.7;
        c.group.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const raw of list) raw.opacity = k;
          }
        });
        if (c.sinkTimer <= 0) {
          this.group.remove(c.group);
          this.corpses.splice(i, 1);
        }
      }
    }
  }
}