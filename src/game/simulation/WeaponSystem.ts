import { RIFLE, type WeaponDefinition } from "../config";
import type { InputCommand, Vec3, WeaponSnapshot } from "../types";

export interface WeaponContext {
  speedRatio: number;
  grounded: boolean;
  crouched: boolean;
}

export interface WeaponTickResult {
  fired: boolean;
  reloadStarted: boolean;
  reloadFinished: boolean;
}

const DEG_TO_RAD = Math.PI / 180;

const moveToward = (value: number, target: number, amount: number) => {
  if (value < target) return Math.min(value + amount, target);
  return Math.max(value - amount, target);
};

const seededUnit = (seed: number) => {
  let value = seed | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4294967296;
};

export class WeaponSystem {
  readonly definition: WeaponDefinition;

  private ammo: number;
  private reserve: number;
  private nextFireAt = 0;
  private reloadStartedAt = 0;
  private reloading = false;
  private reloadProgress = 0;
  private burstIdle = 1;
  private shotIndex = 0;
  private shotSequence = 0;
  private recoilPitch = 0;
  private recoilYaw = 0;
  private viewPunchPitch = 0;
  private viewPunchYaw = 0;
  private viewPunchVelocityPitch = 0;
  private viewPunchVelocityYaw = 0;
  private bloom = 0;
  private currentSpread = RIFLE.baseSpread;
  private firedThisTick = false;

  constructor(definition: WeaponDefinition = RIFLE) {
    this.definition = definition;
    this.ammo = definition.magazineSize;
    this.reserve = definition.reserveAmmo;
  }

  update(dt: number, simulationTime: number, command: InputCommand, context: WeaponContext): WeaponTickResult {
    const result: WeaponTickResult = {
      fired: false,
      reloadStarted: false,
      reloadFinished: false,
    };

    this.firedThisTick = false;
    this.updateRecovery(dt);
    this.currentSpread = this.calculateSpread(context);

    if (command.weaponSlotPressed !== null && this.reloading) {
      this.cancelReload();
    }

    if (this.reloading) {
      this.reloadProgress = Math.min(
        1,
        (simulationTime - this.reloadStartedAt) / this.definition.reloadSeconds,
      );
      if (this.reloadProgress >= 1) {
        this.finishReload();
        result.reloadFinished = true;
      }
      return result;
    }

    if (command.reloadPressed && this.canReload()) {
      this.reloading = true;
      this.reloadStartedAt = simulationTime;
      this.reloadProgress = 0;
      result.reloadStarted = true;
      return result;
    }

    if (!command.fire) {
      this.burstIdle += dt;
      if (this.burstIdle > 0.24) this.shotIndex = 0;
      return result;
    }

    this.burstIdle = 0;
    if (this.ammo === 0) {
      if (this.canReload()) {
        this.reloading = true;
        this.reloadStartedAt = simulationTime;
        this.reloadProgress = 0;
        result.reloadStarted = true;
      }
      return result;
    }

    if (simulationTime + 0.000001 < this.nextFireAt) return result;

    this.applyShotImpulse();
    this.ammo -= 1;
    this.nextFireAt = simulationTime + 60 / this.definition.roundsPerMinute;
    this.firedThisTick = true;
    result.fired = true;
    return result;
  }

  createShotDirection(baseYaw: number, basePitch: number): Vec3 {
    const sequence = this.shotSequence++;
    const radius = Math.sqrt(seededUnit(sequence * 17 + 71)) * this.currentSpread;
    const angle = seededUnit(sequence * 29 + 191) * Math.PI * 2;
    const yaw = baseYaw + this.recoilYaw + Math.cos(angle) * radius;
    const pitch = Math.max(
      -Math.PI * 0.49,
      Math.min(Math.PI * 0.49, basePitch + this.recoilPitch + Math.sin(angle) * radius),
    );
    const cosPitch = Math.cos(pitch);

    return {
      x: -Math.sin(yaw) * cosPitch,
      y: Math.sin(pitch),
      z: -Math.cos(yaw) * cosPitch,
    };
  }

  getSnapshot(): WeaponSnapshot {
    return {
      ammo: this.ammo,
      reserve: this.reserve,
      reloading: this.reloading,
      reloadProgress: this.reloadProgress,
      recoilPitch: this.recoilPitch,
      recoilYaw: this.recoilYaw,
      viewPunchPitch: this.viewPunchPitch,
      viewPunchYaw: this.viewPunchYaw,
      spread: this.currentSpread,
      shotIndex: this.shotIndex,
      firing: this.firedThisTick,
    };
  }

  private updateRecovery(dt: number) {
    const recoilStep = this.definition.recoilRecovery * DEG_TO_RAD * dt;
    this.recoilPitch = moveToward(this.recoilPitch, 0, recoilStep);
    this.recoilYaw = moveToward(this.recoilYaw, 0, recoilStep * 1.35);
    this.bloom = Math.max(0, this.bloom - this.definition.bloomRecovery * dt);

    const spring = 74;
    const damping = 15;
    this.viewPunchVelocityPitch += -this.viewPunchPitch * spring * dt;
    this.viewPunchVelocityYaw += -this.viewPunchYaw * spring * dt;
    this.viewPunchVelocityPitch *= Math.exp(-damping * dt);
    this.viewPunchVelocityYaw *= Math.exp(-damping * dt);
    this.viewPunchPitch += this.viewPunchVelocityPitch * dt;
    this.viewPunchYaw += this.viewPunchVelocityYaw * dt;
  }

  private calculateSpread(context: WeaponContext) {
    const stance = context.crouched ? this.definition.crouchMultiplier : 1;
    const movement = this.definition.movingSpread * Math.min(1, context.speedRatio);
    const airborne = context.grounded ? 0 : this.definition.airborneSpread;
    return (this.definition.baseSpread + movement + airborne + this.bloom) * stance;
  }

  private applyShotImpulse() {
    const pattern = this.definition.recoilPattern;
    const step = pattern[Math.min(this.shotIndex, pattern.length - 1)];
    this.recoilPitch += step[0] * DEG_TO_RAD;
    this.recoilYaw += step[1] * DEG_TO_RAD;
    this.viewPunchVelocityPitch += step[0] * DEG_TO_RAD * 5.2;
    this.viewPunchVelocityYaw += step[1] * DEG_TO_RAD * 4.2;
    this.bloom = Math.min(this.definition.maxBloom, this.bloom + this.definition.bloomPerShot);
    this.shotIndex += 1;
  }

  private canReload() {
    return this.ammo < this.definition.magazineSize && this.reserve > 0;
  }

  private cancelReload() {
    this.reloading = false;
    this.reloadProgress = 0;
  }

  private finishReload() {
    const needed = this.definition.magazineSize - this.ammo;
    const transferred = Math.min(needed, this.reserve);
    this.ammo += transferred;
    this.reserve -= transferred;
    this.reloading = false;
    this.reloadProgress = 0;
  }
}
