import RAPIER from "@dimforge/rapier3d-compat";
import { FIXED_TIMESTEP, PLAYER_CONFIG, RIFLE } from "../config";
import { TRAINING_GROUND, type TargetDefinition } from "../maps/trainingGround";
import type { GameEvent, InputCommand, SimulationSnapshot, TargetSnapshot, Vec3 } from "../types";
import { WeaponSystem } from "./WeaponSystem";

interface TargetRuntime {
  definition: TargetDefinition;
  collider: RAPIER.Collider;
  health: number;
  active: boolean;
  respawnAt: number;
  hitFlash: number;
}

const copyVec = (value: Vec3): Vec3 => ({ x: value.x, y: value.y, z: value.z });

const approachVector = (
  x: number,
  z: number,
  targetX: number,
  targetZ: number,
  maxDelta: number,
): [number, number] => {
  const dx = targetX - x;
  const dz = targetZ - z;
  const length = Math.hypot(dx, dz);
  if (length <= maxDelta || length === 0) return [targetX, targetZ];
  const scale = maxDelta / length;
  return [x + dx * scale, z + dz * scale];
};

export class GameSimulation {
  readonly world: RAPIER.World;

  private readonly playerBody: RAPIER.RigidBody;
  private readonly playerCollider: RAPIER.Collider;
  private readonly characterController: RAPIER.KinematicCharacterController;
  private readonly weapon = new WeaponSystem(RIFLE);
  private readonly targets: TargetRuntime[] = [];
  private readonly targetByCollider = new Map<number, TargetRuntime>();
  private readonly events: GameEvent[] = [];

  private tick = 0;
  private simulationTime = 0;
  private previousPosition: Vec3 = copyVec(PLAYER_CONFIG.spawn);
  private position: Vec3 = copyVec(PLAYER_CONFIG.spawn);
  private velocity: Vec3 = { x: 0, y: 0, z: 0 };
  private grounded = false;
  private crouched = false;
  private yaw = 0;
  private pitch = 0;
  private score = 0;
  private streak = 0;
  private shotEventId = 0;

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = FIXED_TIMESTEP;

    for (const block of TRAINING_GROUND.blocks) {
      const collider = RAPIER.ColliderDesc.cuboid(
        block.size.x * 0.5,
        block.size.y * 0.5,
        block.size.z * 0.5,
      ).setTranslation(block.position.x, block.position.y, block.position.z);
      this.world.createCollider(collider);
    }

    const bodyDescription = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      PLAYER_CONFIG.spawn.x,
      PLAYER_CONFIG.spawn.y,
      PLAYER_CONFIG.spawn.z,
    );
    this.playerBody = this.world.createRigidBody(bodyDescription);
    this.playerCollider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(PLAYER_CONFIG.capsuleHalfHeight, PLAYER_CONFIG.capsuleRadius),
      this.playerBody,
    );

    this.characterController = this.world.createCharacterController(0.025);
    this.characterController.enableAutostep(0.38, 0.16, false);
    this.characterController.enableSnapToGround(0.28);
    this.characterController.setMaxSlopeClimbAngle((46 * Math.PI) / 180);
    this.characterController.setMinSlopeSlideAngle((52 * Math.PI) / 180);
    this.characterController.setApplyImpulsesToDynamicBodies(true);

    for (const targetDefinition of TRAINING_GROUND.targets) {
      const halfYaw = targetDefinition.yaw * 0.5;
      const colliderDescription = RAPIER.ColliderDesc.cuboid(0.43, 0.9, 0.19)
        .setTranslation(
          targetDefinition.position.x,
          targetDefinition.position.y,
          targetDefinition.position.z,
        )
        .setRotation({ x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) });
      const collider = this.world.createCollider(colliderDescription);
      const target: TargetRuntime = {
        definition: targetDefinition,
        collider,
        health: targetDefinition.maxHealth,
        active: true,
        respawnAt: 0,
        hitFlash: 0,
      };
      this.targets.push(target);
      this.targetByCollider.set(collider.handle, target);
    }
  }

  setView(yaw: number, pitch: number) {
    this.yaw = yaw;
    this.pitch = pitch;
  }

  step(command: InputCommand) {
    const dt = FIXED_TIMESTEP;
    this.tick += 1;
    this.simulationTime += dt;
    this.previousPosition = copyVec(this.position);
    this.yaw = command.yaw;
    this.pitch = command.pitch;
    this.crouched = command.crouch;

    this.updateTargets(dt);
    this.updateMovement(command, dt);

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const weaponResult = this.weapon.update(dt, this.simulationTime, command, {
      speedRatio: horizontalSpeed / PLAYER_CONFIG.walkSpeed,
      grounded: this.grounded,
      crouched: this.crouched,
    });

    if (weaponResult.reloadStarted) this.events.push({ type: "reload-start" });
    if (weaponResult.reloadFinished) this.events.push({ type: "reload-finish" });
    if (weaponResult.fired) this.fireHitscan();
  }

  getSnapshot(): SimulationSnapshot {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    return {
      tick: this.tick,
      previousPosition: copyVec(this.previousPosition),
      position: copyVec(this.position),
      velocity: copyVec(this.velocity),
      grounded: this.grounded,
      crouched: this.crouched,
      yaw: this.yaw,
      pitch: this.pitch,
      speed,
      score: this.score,
      streak: this.streak,
      weapon: this.weapon.getSnapshot(),
      targets: this.targets.map((target): TargetSnapshot => ({
        id: target.definition.id,
        position: copyVec(target.definition.position),
        health: target.health,
        maxHealth: target.definition.maxHealth,
        active: target.active,
        hitFlash: target.hitFlash,
      })),
    };
  }

  drainEvents(): GameEvent[] {
    return this.events.splice(0, this.events.length);
  }

  dispose() {
    this.characterController.free();
    this.world.free();
  }

  private updateMovement(command: InputCommand, dt: number) {
    let localForward = command.forward;
    let localRight = command.right;
    const inputLength = Math.hypot(localForward, localRight);
    if (inputLength > 1) {
      localForward /= inputLength;
      localRight /= inputLength;
    }

    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);
    const wishX = -sinYaw * localForward + cosYaw * localRight;
    const wishZ = -cosYaw * localForward - sinYaw * localRight;
    const maxSpeed = this.crouched ? PLAYER_CONFIG.crouchSpeed : PLAYER_CONFIG.walkSpeed;
    const hasInput = inputLength > 0;

    if (hasInput) {
      const acceleration = this.grounded
        ? PLAYER_CONFIG.groundAcceleration
        : PLAYER_CONFIG.airAcceleration;
      [this.velocity.x, this.velocity.z] = approachVector(
        this.velocity.x,
        this.velocity.z,
        wishX * maxSpeed,
        wishZ * maxSpeed,
        acceleration * dt,
      );
    } else {
      const friction = this.grounded ? PLAYER_CONFIG.groundFriction : PLAYER_CONFIG.airFriction;
      [this.velocity.x, this.velocity.z] = approachVector(
        this.velocity.x,
        this.velocity.z,
        0,
        0,
        friction * dt,
      );
    }

    if (command.jumpPressed && this.grounded) {
      this.velocity.y = PLAYER_CONFIG.jumpVelocity;
      this.grounded = false;
      this.events.push({ type: "jump", intensity: 1 });
    } else if (!this.grounded) {
      this.velocity.y = Math.max(
        -PLAYER_CONFIG.maxFallSpeed,
        this.velocity.y - PLAYER_CONFIG.gravity * dt,
      );
    } else if (this.velocity.y < 0) {
      this.velocity.y = -0.5;
    }

    const fallVelocity = this.velocity.y;
    const wasGrounded = this.grounded;
    this.characterController.computeColliderMovement(this.playerCollider, {
      x: this.velocity.x * dt,
      y: this.velocity.y * dt,
      z: this.velocity.z * dt,
    });
    const movement = this.characterController.computedMovement();
    const current = this.playerBody.translation();
    this.playerBody.setNextKinematicTranslation({
      x: current.x + movement.x,
      y: current.y + movement.y,
      z: current.z + movement.z,
    });
    this.world.step();

    const next = this.playerBody.translation();
    this.position = { x: next.x, y: next.y, z: next.z };
    this.grounded = this.characterController.computedGrounded();

    if (this.grounded) {
      if (!wasGrounded && fallVelocity < -2.4) {
        this.events.push({ type: "land", intensity: Math.min(1, Math.abs(fallVelocity) / 11) });
      }
      if (this.velocity.y < 0) this.velocity.y = 0;
    }

    const actualX = movement.x / dt;
    const actualZ = movement.z / dt;
    if (Math.abs(actualX) < Math.abs(this.velocity.x)) this.velocity.x = actualX;
    if (Math.abs(actualZ) < Math.abs(this.velocity.z)) this.velocity.z = actualZ;

    if (this.position.y < -6) this.respawnPlayer();
  }

  private fireHitscan() {
    const weaponSnapshot = this.weapon.getSnapshot();
    const origin = {
      x: this.position.x,
      y: this.position.y + PLAYER_CONFIG.eyeOffset - (this.crouched ? 0.18 : 0),
      z: this.position.z,
    };
    const direction = this.weapon.createShotDirection(this.yaw, this.pitch);
    const ray = new RAPIER.Ray(origin, direction);
    const hit = this.world.castRayAndGetNormal(
      ray,
      RIFLE.range,
      true,
      undefined,
      undefined,
      this.playerCollider,
    );

    let end = {
      x: origin.x + direction.x * RIFLE.range,
      y: origin.y + direction.y * RIFLE.range,
      z: origin.z + direction.z * RIFLE.range,
    };
    let normal: Vec3 = { x: -direction.x, y: -direction.y, z: -direction.z };
    let hitTarget = false;
    let targetDestroyed = false;

    if (hit) {
      end = ray.pointAt(hit.timeOfImpact);
      normal = { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z };
      const target = this.targetByCollider.get(hit.collider.handle);
      if (target?.active) {
        hitTarget = true;
        target.hitFlash = 1;
        target.health -= RIFLE.damage;
        this.score += RIFLE.damage;
        if (target.health <= 0) {
          target.active = false;
          target.collider.setEnabled(false);
          target.respawnAt = this.simulationTime + 2.4;
          targetDestroyed = true;
          this.streak += 1;
          this.score += 100 * this.streak;
        }
      } else {
        this.streak = 0;
      }
    } else {
      this.streak = 0;
    }

    this.events.push({
      type: "shot",
      id: this.shotEventId++,
      origin,
      end,
      normal,
      hit: Boolean(hit),
      hitTarget,
      targetDestroyed,
    });

    void weaponSnapshot;
  }

  private updateTargets(dt: number) {
    for (const target of this.targets) {
      target.hitFlash = Math.max(0, target.hitFlash - dt * 7);
      if (!target.active && this.simulationTime >= target.respawnAt) {
        target.active = true;
        target.health = target.definition.maxHealth;
        target.collider.setEnabled(true);
      }
    }
  }

  private respawnPlayer() {
    this.position = copyVec(PLAYER_CONFIG.spawn);
    this.previousPosition = copyVec(PLAYER_CONFIG.spawn);
    this.velocity = { x: 0, y: 0, z: 0 };
    this.playerBody.setTranslation(PLAYER_CONFIG.spawn, true);
    this.playerBody.setNextKinematicTranslation(PLAYER_CONFIG.spawn);
  }
}
