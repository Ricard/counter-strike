export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface InputCommand {
  forward: number;
  right: number;
  jumpPressed: boolean;
  crouch: boolean;
  fire: boolean;
  aim: boolean;
  reloadPressed: boolean;
  weaponSlotPressed: number | null;
  yaw: number;
  pitch: number;
}

export interface WeaponSnapshot {
  ammo: number;
  reserve: number;
  reloading: boolean;
  reloadProgress: number;
  recoilPitch: number;
  recoilYaw: number;
  viewPunchPitch: number;
  viewPunchYaw: number;
  spread: number;
  shotIndex: number;
  firing: boolean;
}

export interface TargetSnapshot {
  id: string;
  position: Vec3;
  health: number;
  maxHealth: number;
  active: boolean;
  hitFlash: number;
}

export interface SimulationSnapshot {
  tick: number;
  previousPosition: Vec3;
  position: Vec3;
  velocity: Vec3;
  grounded: boolean;
  crouched: boolean;
  yaw: number;
  pitch: number;
  speed: number;
  score: number;
  streak: number;
  weapon: WeaponSnapshot;
  targets: TargetSnapshot[];
}

export interface ShotEvent {
  type: "shot";
  id: number;
  origin: Vec3;
  end: Vec3;
  normal: Vec3;
  hit: boolean;
  hitTarget: boolean;
  targetDestroyed: boolean;
}

export interface ReloadEvent {
  type: "reload-start" | "reload-finish";
}

export interface JumpEvent {
  type: "jump" | "land";
  intensity: number;
}

export type GameEvent = ShotEvent | ReloadEvent | JumpEvent;

export interface HudTelemetry {
  fps: number;
  frameMs: number;
  ammo: number;
  reserve: number;
  reloading: boolean;
  reloadProgress: number;
  speed: number;
  grounded: boolean;
  score: number;
  streak: number;
  activeTargets: number;
  spreadPixels: number;
  scoped: boolean;
}

export interface FrameTelemetry {
  spreadPixels: number;
  firing: boolean;
  reloading: boolean;
  scoped: boolean;
  hitPulse: boolean;
}
