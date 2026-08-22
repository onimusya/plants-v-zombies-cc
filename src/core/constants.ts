// Core type definitions and game constants shared across modules.

export interface Vec2 {
  x: number;
  y: number;
}

// Grid layout.
export const COLS = 9; // plants can be placed in 9 columns
export const ROWS = 5; // 5 lanes
export const CELL_W = 1.9;
export const CELL_D = 1.9;

// World coordinates: origin at the house wall (left), lanes run along -Z? We'll run
// zombies moving +X (left->right) would be wrong; zombies must approach from the right.
// Let's define +Z as "toward viewer/zombie side", so zombies move in -Z direction? Simpler:
// zombies move along -X from right to left, house on the left (-X), zombies spawn at +X.
export const LAWN_LEFT = 0;
export const LAWN_RIGHT = COLS * CELL_W;
export const LAWN_FRONT = 0;
export const LAWN_BACK = ROWS * CELL_D;

export function colToX(col: number): number {
  return LAWN_LEFT + col * CELL_W + CELL_W / 2;
}
export function rowToZ(row: number): number {
  return LAWN_FRONT + row * CELL_D + CELL_D / 2;
}

export type PlantType = "sunflower" | "peashooter" | "wallnut" | "snowpea" | "repeater";
export type ZombieType = "basic" | "cone" | "bucket" | "runner" | "giant";

export interface PlantSpec {
  type: PlantType;
  cost: number;
  hp: number;
  cooldown: number; // seconds
  name: string;
  icon: string; // emoji for UI
  desc: string;
}

export const PLANT_SPECS: Record<PlantType, PlantSpec> = {
  sunflower: { type: "sunflower", cost: 50, hp: 80, cooldown: 7, name: "Sunflower", icon: "🌻", desc: "Produces sun" },
  peashooter: { type: "peashooter", cost: 100, hp: 100, cooldown: 7, name: "Peashooter", icon: "🌱", desc: "Shoots peas" },
  snowpea: { type: "snowpea", cost: 175, hp: 100, cooldown: 7, name: "Snow Pea", icon: "❄️", desc: "Slows zombies" },
  wallnut: { type: "wallnut", cost: 50, hp: 400, cooldown: 20, name: "Wall-nut", icon: "🌰", desc: "Blocks zombies" },
  repeater: { type: "repeater", cost: 200, hp: 100, cooldown: 7, name: "Repeater", icon: "🔁", desc: "Shoots twice" },
};

export const ZOMBIE_SPECS: Record<ZombieType, { hp: number; speed: number; dmg: number; score: number; name: string }> = {
  basic: { hp: 100, speed: 0.55, dmg: 20, score: 10, name: "Zombie" },
  cone: { hp: 220, speed: 0.5, dmg: 20, score: 15, name: "Conehead" },
  bucket: { hp: 500, speed: 0.45, dmg: 20, score: 20, name: "Buckethead" },
  runner: { hp: 80, speed: 1.1, dmg: 15, score: 8, name: "Runner" },
  giant: { hp: 1200, speed: 0.32, dmg: 60, score: 50, name: "Gargantuar" },
};

export const START_SUN = 150;
export const SUN_PER_SEC = 10;