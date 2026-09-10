// WeaponSystem - recoil determinista, spray pattern, bloom, reload, view punch
import * as THREE from 'three';
import { WEAPONS, DEFAULT_WEAPON, getFireInterval } from '../config/weapons.js';
import { clamp, mulberry32 } from '../utils/math.js';

function lerp(a,b,t){ return a + (b-a)*t; }

export class WeaponSystem {
  constructor(cameraController, physicsSystem, renderSystem) {
    this.camera = cameraController;
    this.physics = physicsSystem;
    this.render = renderSystem;

    this.currentWeaponId = DEFAULT_WEAPON;
    this.weapon = WEAPONS[this.currentWeaponId];

    this.ammoInMag = this.weapon.magazine;
    this.reserveAmmo = this.weapon.reserve;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.reloadProgress = 0;

    this.shotsFired = 0; // dins ràfega actual
    this.timeSinceLastShot = 999;
    this.fireCooldown = 0;

    this.spread = this.weapon.baseSpread;
    this.recoilIndex = 0;
    this.recoilAccum = { x: 0, y: 0 }; // per crosshair logic
    this.recoilPunch = { x: 0, y: 0 }; // per viewmodel

    this.muzzleFlashTimer = 0;

    // Random determinista per bloom (seed fixe)
    this._rng = mulberry32(12345);
    this._bloomRng = mulberry32(67890);

    this.onShoot = null; // callback (origin, dir, hit)
    this.onHitTarget = null;
    this.onReloadStart = null;
    this.onReloadEnd = null;

    this._firePressedLast = false;
  }

  switchWeapon(id) {
    if (!WEAPONS[id]) return;
    if (this.isReloading) {
      // Interromp recàrrega
      this.isReloading = false;
      this.reloadTimer = 0;
    }
    this.currentWeaponId = id;
    this.weapon = WEAPONS[id];
    this.ammoInMag = this.weapon.magazine;
    this.reserveAmmo = this.weapon.reserve;
    this.shotsFired = 0;
    this.recoilIndex = 0;
    this.spread = this.weapon.baseSpread;
  }

  // Fixed update
  fixedUpdate(inputCmd, playerState, dt) {
    this.timeSinceLastShot += dt;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.muzzleFlashTimer > 0) this.muzzleFlashTimer -= dt;

    // Recovery de spread
    if (this.timeSinceLastShot > 0.05) {
      this.spread = Math.max(
        this.weapon.baseSpread,
        this.spread - this.weapon.spreadRecovery * dt * 0.02
      );
    }

    // Recovery de recoil pattern si passa temps
    if (this.timeSinceLastShot > this.weapon.recoilResetTime) {
      if (this.shotsFired > 0) {
        this.shotsFired = 0;
        this.recoilIndex = 0;
        this.recoilAccum = { x: 0, y: 0 };
      }
    }

    // Recoil punch recovery
    const recov = this.weapon.recoilRecovery;
    this.recoilPunch.x = lerp(this.recoilPunch.x, 0, recov * dt);
    this.recoilPunch.y = lerp(this.recoilPunch.y, 0, recov * dt);

    // Reload logic
    if (this.isReloading) {
      this.reloadTimer -= dt;
      this.reloadProgress = 1 - (this.reloadTimer / this.weapon.reloadTime);
      if (this.reloadTimer <= 0) {
        this._finishReload();
      }
    }

    // Input reload (edge)
    const reloadEdge = inputCmd.reload && !inputCmd._reloadLast;
    inputCmd._reloadLast = inputCmd.reload;
    if (reloadEdge && !this.isReloading && this.ammoInMag < this.weapon.magazine && this.reserveAmmo > 0) {
      this._startReload();
    }

    // Fire logic
    const wantsFire = inputCmd.fire;
    const fireEdge = wantsFire && !this._firePressedLast;
    this._firePressedLast = wantsFire;

    // Per rifles: permet mantenir premut; per pistoles/AWP: només edge si volem semi-auto, però per MVP deixem auto per tot
    const isSemi = this.weapon.role === 'SNIPER' || this.weapon.role === 'PISTOL';
    let shouldFire = false;
    if (isSemi) {
      shouldFire = fireEdge;
    } else {
      shouldFire = wantsFire;
    }

    if (shouldFire && this.fireCooldown <= 0 && !this.isReloading) {
      if (this.ammoInMag > 0) {
        this._fire(playerState, inputCmd);
      } else {
        // Click buit - auto reload si hi ha reserva
        if (this.reserveAmmo > 0) this._startReload();
      }
    }

    // Zoom FOV per arma
    if (inputCmd.ads) {
      this.camera.setZoomed(true, this.weapon.adsFov || this.weapon.adsFov);
    } else {
      if (this.camera.isZoomed) this.camera.setZoomed(false);
    }
  }

  _startReload() {
    if (this.isReloading) return;
    if (this.reserveAmmo <= 0) return;
    if (this.ammoInMag === this.weapon.magazine) return;
    this.isReloading = true;
    this.reloadTimer = this.weapon.reloadTime;
    this.reloadProgress = 0;
    this.shotsFired = 0;
    this.recoilIndex = 0;
    if (this.onReloadStart) this.onReloadStart(this.weapon);
  }

  _finishReload() {
    const needed = this.weapon.magazine - this.ammoInMag;
    const toLoad = Math.min(needed, this.reserveAmmo);
    this.ammoInMag += toLoad;
    this.reserveAmmo -= toLoad;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.reloadProgress = 0;
    if (this.onReloadEnd) this.onReloadEnd(this.weapon);
  }

  _fire(playerState, inputCmd) {
    const weapon = this.weapon;
    const interval = getFireInterval(weapon);
    this.fireCooldown = interval;
    this.timeSinceLastShot = 0;
    this.ammoInMag--;
    this.muzzleFlashTimer = 0.06;

    // Spread dinàmic segons moviment
    let movePenalty = 0;
    if (!playerState.onGround) movePenalty = weapon.airSpread;
    else if (playerState.speed > 0.5) {
      // Escalat per velocitat
      const moveFactor = playerState.speed / 5.2;
      movePenalty = weapon.moveSpread * moveFactor;
      if (playerState.isCrouching) movePenalty *= weapon.crouchSpreadMult;
    } else {
      if (playerState.isCrouching) {
        // menys spread ajupit
      }
    }

    // Increment spread per shot
    this.spread = clamp(
      this.spread + weapon.spreadPerShot,
      weapon.baseSpread,
      weapon.maxSpread
    );

    const currentSpread = this.spread + movePenalty;
    if (playerState.isCrouching && playerState.onGround) {
      // reduce
    }

    // Recoil pattern determinista
    const patternIdx = Math.min(this.recoilIndex, weapon.recoilPattern.length - 1);
    const recoilStep = weapon.recoilPattern[patternIdx] || { x:0, y:0 };
    this.recoilAccum.x += recoilStep.x;
    this.recoilAccum.y += recoilStep.y;

    // View punch (camera kick) - independent del crosshair
    const punchScale = weapon.viewPunchScale;
    this.camera.addRecoilPunch(recoilStep.x * punchScale, recoilStep.y * punchScale);
    this.recoilPunch.x += recoilStep.x * punchScale * 0.5;
    this.recoilPunch.y += recoilStep.y * punchScale * 0.5;

    this.recoilIndex++;
    this.shotsFired++;

    // Calcular direcció de tret amb bloom
    const forward = this.camera.getForward(); // ja inclou recoil offset
    // Afegir dispersió aleatòria dins cercle (determinista via rng)
    // Per mantenir determinisme: mateix input -> mateix resultat, usem rng seeded per shot
    const spreadAngle = currentSpread * (0.5 + this._bloomRng() * 0.5); // variació
    const spreadDir = this._randomSpreadDirection(spreadAngle);

    // Combinar forward + spread offset
    // Construir base ortonormal al voltant de forward
    const fwdVec = new THREE.Vector3(forward.x, forward.y, forward.z).normalize();
    const up = new THREE.Vector3(0,1,0);
    let right = new THREE.Vector3().crossVectors(fwdVec, up).normalize();
    if (right.lengthSq() < 0.001) right.set(1,0,0);
    const realUp = new THREE.Vector3().crossVectors(right, fwdVec).normalize();

    // Aplicar offset de recoil pattern a direcció (spray)
    // En CS, el recoil mou la mira, no només bloom. Aquí ja hem mogut camera via punch,
    // però també afegim lleuger offset de patró a direcció per simular spray
    const recoilYawRad = recoilStep.x * Math.PI/180 * 0.3; // reduït perquè camera ja pica
    const recoilPitchRad = recoilStep.y * Math.PI/180 * 0.3;

    // Direcció final = forward rotat per recoil + bloom
    const finalDir = fwdVec.clone();
    // Bloom
    finalDir.addScaledVector(right, spreadDir.x);
    finalDir.addScaledVector(realUp, spreadDir.y);
    finalDir.normalize();

    // Raycast hitscan
    const eyePos = playerState.eyePos || { x:0, y:0, z:0 };
    const origin = { x: eyePos.x, y: eyePos.y, z: eyePos.z };
    const dir = { x: finalDir.x, y: finalDir.y, z: finalDir.z };

    const hit = this.physics.raycast(origin, dir, weapon.range, true);

    // Callback per efectes
    if (this.onShoot) this.onShoot(origin, dir, hit, weapon, currentSpread);

    // Si hit és target, aplicar dany (gestionat externament via onHitTarget)
    if (hit && this.onHitTarget) {
      this.onHitTarget(hit, weapon);
    }
  }

  _randomSpreadDirection(maxAngleRad) {
    // Punt aleatori dins cercle de radi maxAngle
    // Usem polar: angle uniforme, radius sqrt(random) per distribució uniforme disc
    const r = Math.sqrt(this._rng()) * maxAngleRad;
    const theta = this._rng() * Math.PI * 2;
    return {
      x: r * Math.cos(theta),
      y: r * Math.sin(theta)
    };
  }

  getStateForRender() {
    return {
      weapon: this.weapon,
      ammoInMag: this.ammoInMag,
      reserveAmmo: this.reserveAmmo,
      isReloading: this.isReloading,
      reloadProgress: this.reloadProgress,
      spread: this.spread,
      recoilPunch: { ...this.recoilPunch },
      recoilAccum: { ...this.recoilAccum },
      shotsFired: this.shotsFired,
      muzzleFlashTimer: this.muzzleFlashTimer,
      fireCooldown: this.fireCooldown
    };
  }

  cancelReload() {
    if (this.isReloading) {
      this.isReloading = false;
      this.reloadTimer = 0;
      this.reloadProgress = 0;
    }
  }
}
