// AudioSystem bàsic - funcional, no prioritari, però amb WebAudio procedural
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this._footstepTimer = 0;
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.enabled = true;
    } catch (e) {
      console.warn('[Audio] WebAudio no disponible', e);
    }
  }

  _playTone(freq, duration, type='sine', volume=0.2, attack=0.01, decay=0.1) {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playShoot(weapon) {
    // So tret: soroll curt + to baix
    if (!this.enabled) return;
    const baseFreq = weapon.role === 'RIFLE' ? 180 : weapon.role === 'PISTOL' ? 300 : 120;
    this._playTone(baseFreq, 0.12, 'square', 0.35, 0.001, 0.08);
    setTimeout(() => this._playTone(baseFreq*2.5, 0.06, 'sawtooth', 0.15, 0.001, 0.04), 10);
  }

  playReload() {
    if (!this.enabled) return;
    this._playTone(600, 0.15, 'triangle', 0.2);
    setTimeout(() => this._playTone(400, 0.15, 'triangle', 0.2), 150);
  }

  playFootstep(speed) {
    if (!this.enabled) return;
    // Evitar spam
    const now = performance.now();
    if (now - this._footstepTimer < 350 / (speed || 1)) return;
    this._footstepTimer = now;
    this._playTone(80 + Math.random()*40, 0.08, 'sine', 0.08);
  }

  playHit(isHeadshot) {
    if (!this.enabled) return;
    this._playTone(isHeadshot ? 900 : 500, 0.1, 'sine', 0.25);
  }

  playEmpty() {
    if (!this.enabled) return;
    this._playTone(200, 0.15, 'square', 0.15);
  }
}
