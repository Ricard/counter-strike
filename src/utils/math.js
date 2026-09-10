// Math utils deterministes i helpers per CS-style movement
export const RAD2DEG = 180 / Math.PI;
export const DEG2RAD = Math.PI / 180;

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothDamp(current, target, velocityRef, smoothTime, dt, maxSpeed = Infinity) {
  // Unity-like SmoothDamp per recuperació de recoil
  smoothTime = Math.max(0.0001, smoothTime);
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const originalTo = target;
  const maxChange = maxSpeed * smoothTime;
  change = clamp(change, -maxChange, maxChange);
  target = current - change;
  const temp = (velocityRef.value + omega * change) * dt;
  velocityRef.value = (velocityRef.value - omega * temp) * exp;
  let output = target + (change + temp) * exp;
  if ((originalTo - current > 0) === (output > originalTo)) {
    output = originalTo;
    velocityRef.value = (output - originalTo) / dt;
  }
  return output;
}

// CS style accelerate
export function accelerate(vel, wishDir, wishSpeed, accel, dt) {
  const currentSpeed = vel.dot(wishDir);
  let addSpeed = wishSpeed - currentSpeed;
  if (addSpeed <= 0) return;
  let accelSpeed = accel * dt * wishSpeed;
  if (accelSpeed > addSpeed) accelSpeed = addSpeed;
  vel.addScaledVector(wishDir, accelSpeed);
}

export function applyFriction(vel, friction, dt, stopSpeed = 0.1) {
  const speed = vel.length();
  if (speed < 0.001) {
    vel.set(0,0,0);
    return;
  }
  let control = speed < stopSpeed ? stopSpeed : speed;
  let drop = control * friction * dt;
  let newSpeed = Math.max(0, speed - drop);
  if (newSpeed !== speed) {
    newSpeed /= speed;
    vel.multiplyScalar(newSpeed);
  }
}

// Deterministic pseudo random per recoil bloom (mulberry32)
export function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
