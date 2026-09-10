// CameraController - mouse-look sense suavitzat, raw input, FOV configurable
import { SETTINGS } from '../config/settings.js';
import { clamp } from '../utils/math.js';

export class CameraController {
  constructor() {
    this.yaw = 0; // radians, horitzontal
    this.pitch = 0; // vertical
    this.targetFov = SETTINGS.CAMERA.baseFov;
    this.baseFov = SETTINGS.CAMERA.baseFov;
    this.zoomFov = SETTINGS.CAMERA.zoomFov;
    this.isZoomed = false;

    // Sway per mouse movement (view punch independent)
    this.sway = { x: 0, y: 0 };
    this._swayVel = { x: 0, y: 0 };

    // Recoil punch recuperable
    this.recoilOffset = { x: 0, y: 0 };
    this._recoilVel = { x: 0, y: 0 };
  }

  // Input directe sense smoothing - latència mínima
  applyMouseDelta(dx, dy, sensitivity) {
    // dx,dy en pixels, sensitivity rad/px
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    this.pitch = clamp(this.pitch, SETTINGS.CAMERA.pitchMin * Math.PI/180, SETTINGS.CAMERA.pitchMax * Math.PI/180);

    // Sway subtil per moviment mouse (no afecta aim real, només visual arma)
    this._swayVel.x += dx * 0.0005;
    this._swayVel.y += dy * 0.0005;
  }

  // Actualitza sway i recoil recovery cada fixed step
  update(dt) {
    // Sway decay
    this.sway.x += this._swayVel.x;
    this.sway.y += this._swayVel.y;
    this._swayVel.x *= Math.pow(0.01, dt);
    this._swayVel.y *= Math.pow(0.01, dt);
    this.sway.x *= Math.pow(0.01, dt);
    this.sway.y *= Math.pow(0.01, dt);
    this.sway.x = clamp(this.sway.x, -0.5, 0.5);
    this.sway.y = clamp(this.sway.y, -0.5, 0.5);

    // Recoil recovery (smooth damp)
    // simple lerp cap a 0
    const recovSpeed = 6.0;
    this.recoilOffset.x = THREE_Math_lerp(this.recoilOffset.x, 0, recovSpeed * dt);
    this.recoilOffset.y = THREE_Math_lerp(this.recoilOffset.y, 0, recovSpeed * dt);
  }

  addRecoilPunch(yawAmount, pitchAmount) {
    // yawAmount, pitchAmount en graus -> rad
    const radX = yawAmount * Math.PI/180;
    const radY = pitchAmount * Math.PI/180;
    this.recoilOffset.x += radX;
    this.recoilOffset.y += radY;
    // També afegeix a sway per weapon kick
    this._swayVel.x += yawAmount * 0.02;
    this._swayVel.y += pitchAmount * 0.02;
  }

  getFinalYaw() {
    return this.yaw + this.recoilOffset.x;
  }

  getFinalPitch() {
    return this.pitch + this.recoilOffset.y;
  }

  // Forward vector des de yaw/pitch finals
  getForward() {
    const yaw = this.getFinalYaw();
    const pitch = this.getFinalPitch();
    const cosPitch = Math.cos(pitch);
    return {
      x: -Math.sin(yaw) * cosPitch,
      y: Math.sin(pitch),
      z: -Math.cos(yaw) * cosPitch
    };
  }

  getRight() {
    const yaw = this.getFinalYaw();
    return {
      x: Math.cos(yaw),
      y: 0,
      z: -Math.sin(yaw)
    };
  }

  setZoomed(zoomed, fovOverride = null) {
    this.isZoomed = zoomed;
    if (fovOverride !== null) {
      this.targetFov = zoomed ? fovOverride : this.baseFov;
    } else {
      this.targetFov = zoomed ? this.zoomFov : this.baseFov;
    }
  }

  setFov(fov) {
    this.baseFov = fov;
    if (!this.isZoomed) this.targetFov = fov;
  }

  setYawPitch(yaw, pitch) {
    this.yaw = yaw;
    this.pitch = pitch;
  }
}

function THREE_Math_lerp(a,b,t) { return a + (b-a)*t; }
