// GameLoop - separa Simulació (fixed 64Hz) / Render (interpolat) / Input/UI
import { SETTINGS } from '../config/settings.js';

export class GameLoop {
  constructor({ fixedUpdate, render, onFpsUpdate }) {
    this.fixedUpdate = fixedUpdate; // (dt) => void
    this.render = render; // (alpha) => void
    this.onFpsUpdate = onFpsUpdate;

    this.fixedDt = SETTINGS.FIXED_DT; // 1/64
    this.maxSubSteps = 4; // evitar spiral of death

    this._accumulator = 0;
    this._lastTime = 0;
    this._running = false;
    this._rafId = null;

    // FPS tracking
    this._frameCount = 0;
    this._lastFpsTime = 0;
    this._fps = 0;
  }

  start() {
    this._running = true;
    this._lastTime = performance.now() / 1000;
    this._lastFpsTime = this._lastTime;
    this._loop(this._lastTime);
  }

  stop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  _loop = (nowSec) => {
    if (!this._running) return;
    this._rafId = requestAnimationFrame((nowMs) => {
      const now = nowMs / 1000;
      this._loop(now);
    });

    let frameTime = nowSec - this._lastTime;
    this._lastTime = nowSec;
    // Clamp per evitar salt gran si tab inactiu
    frameTime = Math.min(frameTime, 0.25);

    this._accumulator += frameTime;

    let subSteps = 0;
    while (this._accumulator >= this.fixedDt && subSteps < this.maxSubSteps) {
      this.fixedUpdate(this.fixedDt);
      this._accumulator -= this.fixedDt;
      subSteps++;
    }

    // Si encara queda molt, descartar (evitar spiral)
    if (this._accumulator > this.fixedDt * this.maxSubSteps) {
      this._accumulator = 0;
    }

    const alpha = this._accumulator / this.fixedDt;
    this.render(alpha);

    // FPS counter
    this._frameCount++;
    if (nowSec - this._lastFpsTime >= 0.5) {
      this._fps = Math.round(this._frameCount / (nowSec - this._lastFpsTime));
      this._frameCount = 0;
      this._lastFpsTime = nowSec;
      if (this.onFpsUpdate) this.onFpsUpdate(this._fps);
    }
  };

  getFps() { return this._fps; }
}
