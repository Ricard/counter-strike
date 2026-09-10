export const FIXED_TIMESTEP = 1 / 64;
export const MAX_FRAME_DELTA = 0.1;

export const PLAYER_CONFIG = {
  capsuleRadius: 0.34,
  capsuleHalfHeight: 0.56,
  eyeOffset: 0.64,
  walkSpeed: 5.6,
  crouchSpeed: 3.05,
  groundAcceleration: 46,
  airAcceleration: 8.5,
  groundFriction: 34,
  airFriction: 0.7,
  jumpVelocity: 5.15,
  gravity: 17.5,
  maxFallSpeed: 24,
  spawn: { x: 0, y: 1.02, z: 17 },
} as const;

export const VIEW_CONFIG = {
  fov: 76,
  scopedFov: 48,
  sensitivity: 0.00175,
  minPitch: -Math.PI * 0.475,
  maxPitch: Math.PI * 0.475,
} as const;

export type RecoilStep = readonly [pitchDegrees: number, yawDegrees: number];

export interface WeaponDefinition {
  id: string;
  name: string;
  shortName: string;
  damage: number;
  magazineSize: number;
  reserveAmmo: number;
  roundsPerMinute: number;
  reloadSeconds: number;
  range: number;
  baseSpread: number;
  movingSpread: number;
  airborneSpread: number;
  crouchMultiplier: number;
  bloomPerShot: number;
  maxBloom: number;
  bloomRecovery: number;
  recoilRecovery: number;
  recoilPattern: readonly RecoilStep[];
}

export const RIFLE: WeaponDefinition = {
  id: "vx7",
  name: "VX-7 Service Rifle",
  shortName: "VX-7",
  damage: 34,
  magazineSize: 30,
  reserveAmmo: 90,
  roundsPerMinute: 600,
  reloadSeconds: 2.35,
  range: 140,
  baseSpread: 0.0018,
  movingSpread: 0.015,
  airborneSpread: 0.042,
  crouchMultiplier: 0.72,
  bloomPerShot: 0.00165,
  maxBloom: 0.019,
  bloomRecovery: 0.028,
  recoilRecovery: 3.2,
  recoilPattern: [
    [0.34, 0.02], [0.39, -0.09], [0.43, 0.12], [0.47, -0.16],
    [0.51, -0.12], [0.55, 0.18], [0.58, 0.25], [0.56, -0.28],
    [0.54, -0.32], [0.51, 0.29], [0.48, 0.36], [0.45, -0.38],
    [0.43, -0.42], [0.41, 0.44], [0.39, 0.48], [0.37, -0.46],
    [0.35, -0.38], [0.34, 0.32], [0.33, 0.42], [0.32, -0.36],
    [0.31, -0.28], [0.3, 0.34], [0.3, 0.39], [0.29, -0.31],
    [0.29, 0.24], [0.28, -0.27], [0.28, 0.3], [0.27, -0.22],
    [0.27, 0.2], [0.26, -0.18],
  ] as const,
};

export const MATERIAL_PALETTE = {
  concrete: 0x747b80,
  darkConcrete: 0x363f45,
  metal: 0x314b52,
  cover: 0xb66b36,
  accent: 0xe9ff58,
  target: 0xff6847,
  targetHit: 0xffffff,
  ground: 0x1b2428,
  outline: 0x0d1417,
  weapon: 0x27343a,
} as const;
