// HUD - informació bàsica, munició, vida, FPS
export class HUD {
  constructor() {
    this.ammoEl = document.getElementById('ammo');
    this.healthEl = document.getElementById('health');
    this.weaponEl = document.getElementById('weapon-name');
    this.fpsEl = document.getElementById('fps-counter');
    this.centerMsgEl = document.getElementById('center-msg');
    this.vignetteEl = document.getElementById('damage-vignette');

    this.health = 100;
    this._centerMsgTimer = null;
  }

  updateWeapon(weaponState) {
    const w = weaponState.weapon;
    const ammo = `${weaponState.ammoInMag} / ${weaponState.reserveAmmo}`;
    this.ammoEl.textContent = ammo;
    this.weaponEl.textContent = `${w.name} | ${w.role}`;

    if (weaponState.isReloading) {
      this.ammoEl.style.color = '#ffaa00';
      this.ammoEl.textContent += ' [RECARREGANT]';
    } else if (weaponState.ammoInMag === 0) {
      this.ammoEl.style.color = '#ff4444';
    } else {
      this.ammoEl.style.color = '#00ff88';
    }
  }

  updateHealth(hp) {
    this.health = hp;
    this.healthEl.textContent = `HP ${Math.max(0, Math.floor(hp))}`;
    this.healthEl.style.color = hp > 50 ? '#e0e0e0' : (hp > 25 ? '#ffaa00' : '#ff4444');
  }

  updateFps(fps) {
    this.fpsEl.textContent = `FPS ${fps} | TICK 64`;
    this.fpsEl.style.color = fps >= 110 ? '#00ff88' : (fps >= 60 ? '#ffcc00' : '#ff4444');
  }

  showCenterMessage(msg, duration = 2000) {
    this.centerMsgEl.textContent = msg;
    this.centerMsgEl.classList.add('visible');
    if (this._centerMsgTimer) clearTimeout(this._centerMsgTimer);
    this._centerMsgTimer = setTimeout(() => {
      this.centerMsgEl.classList.remove('visible');
    }, duration);
  }

  flashDamage() {
    this.vignetteEl.style.opacity = '0.6';
    setTimeout(() => {
      this.vignetteEl.style.opacity = '0';
    }, 120);
  }

  showHitMarker(isHeadshot = false) {
    // Podria afegir marcador visual
    if (isHeadshot) {
      this.showCenterMessage('HEADSHOT!', 400);
    }
  }
}
