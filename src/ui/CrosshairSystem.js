// CrosshairSystem - creueta dinàmica que reflecteix dispersió real
export class CrosshairSystem {
  constructor() {
    this.el = document.getElementById('crosshair');
    this.lines = {
      left: document.getElementById('ch-left'),
      right: document.getElementById('ch-right'),
      top: document.getElementById('ch-top'),
      bottom: document.getElementById('ch-bottom')
    };
    this.dot = document.getElementById('crosshair-dot');

    this.baseGap = 3;
    this.currentGap = this.baseGap;
    this.targetGap = this.baseGap;
  }

  setBaseGap(gap) {
    this.baseGap = gap;
  }

  // Actualitza cada frame de render
  update(weaponState, playerState, settings) {
    // Gap = base + moviment + dispersió + tret
    let gap = this.baseGap;

    // Moviment
    if (playerState.isMoving) {
      const speedFactor = playerState.speed / 5.2;
      gap += speedFactor * 8;
    }

    // Aire
    if (!playerState.onGround) gap += 10;

    // Ajupit redueix
    if (playerState.isCrouching) gap *= 0.7;

    // Dispersió arma (spread)
    const spread = weaponState.spread || 0;
    gap += spread * 400; // escalar a pixels

    // Shots fired
    gap += weaponState.shotsFired * 1.2;

    // Reload
    if (weaponState.isReloading) gap += 5;

    this.targetGap = gap;
    // Lerp suau per evitar jitter, però mantenir reactivitat
    this.currentGap += (this.targetGap - this.currentGap) * 0.2;

    const g = this.currentGap;
    const lineLen = 12;
    const thickness = 2;

    // Posicionar línies
    this.lines.left.style.transform = `translate(calc(-50% - ${g + lineLen/2}px), -50%)`;
    this.lines.right.style.transform = `translate(calc(-50% + ${g + lineLen/2}px), -50%)`;
    this.lines.top.style.transform = `translate(-50%, calc(-50% - ${g + lineLen/2}px))`;
    this.lines.bottom.style.transform = `translate(-50%, calc(-50% + ${g + lineLen/2}px))`;

    // Color segons estat: verd normal, vermell si disparant ràfega
    const isFiring = weaponState.muzzleFlashTimer > 0;
    const color = isFiring ? '#ff4444' : (weaponState.spread > 0.02 ? '#ffcc00' : '#00ff88');
    Object.values(this.lines).forEach(el => {
      el.style.background = color;
      el.style.boxShadow = `0 0 3px ${color}`;
    });

    // Dot només si no estem en moviment extrem
    this.dot.style.opacity = gap > 15 ? '0' : '1';
  }

  setVisible(v) {
    this.el.style.display = v ? 'block' : 'none';
  }
}
