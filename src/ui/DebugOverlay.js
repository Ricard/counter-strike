// DebugOverlay - FPS, posició, velocitat, info física
export class DebugOverlay {
  constructor() {
    this.el = document.getElementById('debug');
    this.enabled = true;
  }

  update(data) {
    if (!this.enabled) {
      this.el.style.display = 'none';
      return;
    }
    this.el.style.display = 'block';
    const { player, camera, weapon, fps } = data;
    const pos = player.position;
    const vel = player.velocity;
    const speed = Math.sqrt(vel.x*vel.x + vel.z*vel.z).toFixed(2);
    this.el.innerHTML = `
POS ${pos.x.toFixed(1)} ${pos.y.toFixed(1)} ${pos.z.toFixed(1)}<br>
VEL ${vel.x.toFixed(1)} ${vel.y.toFixed(1)} ${vel.z.toFixed(1)} | ${speed} m/s<br>
GROUND ${player.onGround ? 'YES' : 'NO'} | CROUCH ${player.isCrouching ? 'YES' : 'NO'}<br>
YAW ${(camera.yaw*180/Math.PI).toFixed(1)} PITCH ${(camera.pitch*180/Math.PI).toFixed(1)}<br>
FOV ${camera.targetFov} | SENS ${data.sensitivity}<br>
SPREAD ${(weapon.spread*1000).toFixed(2)}mrad | SHOTS ${weapon.shotsFired}<br>
RECOIL IDX ${weapon.recoilIndex} | AMMO ${weapon.ammoInMag}/${weapon.reserveAmmo}<br>
FPS ${fps} | TICK 64Hz
    `.trim();
  }

  setEnabled(v) { this.enabled = v; }
}
