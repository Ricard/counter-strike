export const SETTINGS = {
  // Simulation
  TICK_RATE: 64,
  FIXED_DT: 1/64,
  GRAVITY: -18.0, // tuned for CS feel (source ~800 units, here m/s)
  
  // Player physics
  PLAYER: {
    height: 1.8,
    crouchHeight: 1.2,
    radius: 0.35,
    mass: 80,
    maxSpeed: 5.2, // ~260 units CS => 5.2 m/s (scale)
    crouchSpeed: 2.6,
    walkSpeed: 2.8, // shift walk
    airMaxSpeed: 5.2,
    groundAccel: 20.0,
    airAccel: 12.0,
    groundFriction: 8.0,
    stopSpeed: 0.5,
    jumpImpulse: 5.8,
    airControl: 0.4, // factor control en aire
    stepOffset: 0.4,
    skinWidth: 0.08
  },

  // Camera / Input
  CAMERA: {
    baseFov: 90, // vertical? we will use 74 vertical for 90 horiz, but configurable as vertical in three
    zoomFov: 55,
    near: 0.1,
    far: 500,
    sensitivity: 0.0022, // rad per pixel
    pitchMin: -89,
    pitchMax: 89,
    eyeHeight: 1.62,
    crouchEyeHeight: 1.05
  },

  // Game feel
  VIEW_BOB_FREQ: 9.5,
  VIEW_BOB_AMP: 0.035,
  WEAPON_BOB_FREQ: 8.0,
  WEAPON_BOB_AMP: 0.08
};
