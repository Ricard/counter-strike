// PlayerController - moviment CS style amb càpsula física, acceleració, fricció
import * as THREE from 'three';
import { SETTINGS } from '../config/settings.js';
import { accelerate, applyFriction, clamp } from '../utils/math.js';

export class PlayerController {
  constructor(physicsSystem, cameraController) {
    this.physics = physicsSystem;
    this.camera = cameraController;

    this.position = new THREE.Vector3(0, 3, 0);
    this.prevPosition = new THREE.Vector3(0, 3, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.onGround = false;
    this.isCrouching = false;
    this.isWalking = false;
    this.eyeHeight = SETTINGS.CAMERA.eyeHeight;
    this.prevEyeHeight = this.eyeHeight;
    this.speed = 0;

    this._wishDir = new THREE.Vector3();
    this._jumpPressedLast = false;
    this._crouchTransition = 0; // 0 erecte, 1 ajupit
  }

  spawn(pos, yaw = 0) {
    this.position.set(pos.x, pos.y, pos.z);
    this.prevPosition.copy(this.position);
    this.velocity.set(0,0,0);
    this.camera.setYawPitch(yaw, 0);
    this.physics.setPlayerPosition({ x: pos.x, y: pos.y, z: pos.z });
  }

  // Fixed update 64Hz - moviment determinista
  fixedUpdate(inputCmd, dt) {
    this.prevPosition.copy(this.position);
    this.prevEyeHeight = this.eyeHeight;

    // Actualitzar crouch
    this.isCrouching = inputCmd.crouch;
    this.isWalking = inputCmd.walk;

    // Transició eye height
    const targetCrouch = this.isCrouching ? 1 : 0;
    this._crouchTransition = THREE.MathUtils.lerp(this._crouchTransition, targetCrouch, dt * 10);
    const targetEye = THREE.MathUtils.lerp(SETTINGS.CAMERA.eyeHeight, SETTINGS.CAMERA.crouchEyeHeight, this._crouchTransition);
    this.eyeHeight = THREE.MathUtils.lerp(this.eyeHeight, targetEye, dt * 12);

    // Aplicar mouse look (raw, sense smoothing)
    if (inputCmd.mouseDelta) {
      const sens = inputCmd.effectiveSensitivity ?? SETTINGS.CAMERA.sensitivity;
      this.camera.applyMouseDelta(inputCmd.mouseDelta.x, inputCmd.mouseDelta.y, sens);
    }

    // Calcular wish direction des de camera yaw (no pitch)
    const yaw = this.camera.yaw; // sense recoil per moviment
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    this._wishDir.set(0,0,0);
    if (inputCmd.forward !== 0) this._wishDir.addScaledVector(forward, inputCmd.forward);
    if (inputCmd.right !== 0) this._wishDir.addScaledVector(right, inputCmd.right);
    if (this._wishDir.lengthSq() > 0.001) this._wishDir.normalize();

    // Velocitats objectiu
    let wishSpeed = SETTINGS.PLAYER.maxSpeed;
    if (this.isCrouching) wishSpeed = SETTINGS.PLAYER.crouchSpeed;
    else if (this.isWalking) wishSpeed = SETTINGS.PLAYER.walkSpeed;

    // En aire, limitar control
    const isAir = !this.onGround;

    // Fricció només a terra
    if (this.onGround) {
      // Aplicar fricció al pla horitzontal
      const horizVel = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
      applyFriction(horizVel, SETTINGS.PLAYER.groundFriction, dt, SETTINGS.PLAYER.stopSpeed);
      this.velocity.x = horizVel.x;
      this.velocity.z = horizVel.z;

      // Acceleració terra
      accelerate(this.velocity, this._wishDir, wishSpeed, SETTINGS.PLAYER.groundAccel, dt);
    } else {
      // Aire: acceleració limitada + air control
      // Source-like air control: només si wishDir no oposada
      const airAccel = SETTINGS.PLAYER.airAccel * (this.isCrouching ? 0.7 : 1);
      // Limitar wishSpeed en aire a max
      const airWishSpeed = Math.min(wishSpeed, SETTINGS.PLAYER.airMaxSpeed);
      accelerate(this.velocity, this._wishDir, airWishSpeed, airAccel, dt);
      
      // Air control addicional per strafe
      if (this._wishDir.lengthSq() > 0) {
        const dot = this.velocity.dot(this._wishDir);
        if (dot < 0) {
          // Reduir velocitat oposada
        }
      }
    }

    // Gravetat
    if (!this.onGround) {
      this.velocity.y += SETTINGS.GRAVITY * dt;
    }

    // Salt
    const jumpEdge = inputCmd.jump && !this._jumpPressedLast;
    this._jumpPressedLast = inputCmd.jump;
    if (jumpEdge && this.onGround) {
      this.velocity.y = SETTINGS.PLAYER.jumpImpulse;
      this.onGround = false;
      // Bunny hop: mantenir velocitat horitzontal
    }

    // Calcular desplaçament desitjat
    const desiredMove = new THREE.Vector3(
      this.velocity.x * dt,
      this.velocity.y * dt,
      this.velocity.z * dt
    );

    // Aplicar via physics character controller (col·lisions)
    const result = this.physics.moveCharacter(desiredMove);
    const corrected = result.translation;

    // Actualitzar posició real des de física (nextPos ja calculat)
    if (result.nextPos) {
      this.position.set(result.nextPos.x, result.nextPos.y, result.nextPos.z);
    } else {
      const physPos = this.physics.getPlayerPosition();
      this.position.set(physPos.x, physPos.y, physPos.z);
    }

    // Si col·lisió vertical, ajustar velocitat
    if (Math.abs(corrected.y) < Math.abs(desiredMove.y) * 0.9) {
      if (desiredMove.y < 0 && result.grounded) {
        this.velocity.y = 0;
      } else if (desiredMove.y > 0) {
        this.velocity.y = 0;
      }
    }

    // Ground check actualitzat
    this.onGround = result.grounded;

    // Si a terra però velocitat y negativa petita, clamp
    if (this.onGround && this.velocity.y < 0) this.velocity.y = -0.1;

    // Speed per bob
    const horizSpeed = Math.sqrt(this.velocity.x*this.velocity.x + this.velocity.z*this.velocity.z);
    this.speed = horizSpeed;
  }

  getStateForRender() {
    return {
      position: this.position,
      prevPosition: this.prevPosition,
      velocity: this.velocity,
      onGround: this.onGround,
      isMoving: this.speed > 0.1,
      speed: this.speed,
      eyeHeight: this.eyeHeight,
      prevEyeHeight: this.prevEyeHeight,
      isCrouching: this.isCrouching
    };
  }

  getEyePosition() {
    return new THREE.Vector3(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z
    );
  }
}
