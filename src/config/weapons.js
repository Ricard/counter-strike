// Definicions d'armes - patró determinista estil CS
// Unitats: recoil en graus (pitch/yaw)

function genAKPattern() {
  // Patró aproximat AK-47 CS:GO 30 bales: puja fort vertical, lleuger zigzag horitzontal
  const pattern = [];
  // Dades inspirades en CS:GO spray (simplificat però determinista)
  const raw = [
    [0.0, 0.35], [0.05, 0.45], [-0.08, 0.50], [0.10, 0.55], [-0.12, 0.55],
    [0.15, 0.50], [-0.18, 0.48], [0.20, 0.45], [-0.22, 0.40], [0.18, 0.38],
    [-0.15, 0.35], [0.12, 0.33], [-0.10, 0.30], [0.08, 0.28], [-0.05, 0.25],
    [0.04, 0.24], [-0.03, 0.22], [0.02, 0.20], [-0.02, 0.18], [0.01, 0.16],
    [-0.01, 0.15], [0.00, 0.14], [0.02, 0.13], [-0.02, 0.12], [0.03, 0.11],
    [-0.03, 0.10], [0.02, 0.09], [-0.01, 0.08], [0.01, 0.07], [0.00, 0.06]
  ];
  for (let i=0;i<raw.length;i++) {
    pattern.push({ x: raw[i][0], y: raw[i][1] }); // x = yaw, y = pitch
  }
  return pattern;
}

function genM4Pattern() {
  const raw = [
    [0,0.28],[0.02,0.32],[-0.03,0.34],[0.03,0.36],[-0.04,0.34],
    [0.05,0.32],[-0.06,0.30],[0.07,0.28],[-0.08,0.26],[0.06,0.24],
    [-0.05,0.22],[0.04,0.20],[-0.03,0.18],[0.02,0.16],[-0.01,0.14],
    [0,0.12],[0.01,0.11],[-0.01,0.10],[0,0.09],[0,0.08]
  ];
  return raw.map(r=>({x:r[0], y:r[1]}));
}

function genDeaglePattern() {
  return [{x:0, y:0.9}];
}

export const WEAPONS = {
  ak47: {
    id: 'ak47',
    name: 'AK-47',
    role: 'RIFLE',
    damage: 36,
    headshotMultiplier: 3.5,
    fireRate: 600, // RPM
    magazine: 30,
    reserve: 90,
    reloadTime: 2.4,
    baseSpread: 0.0015, // radians
    moveSpread: 0.015,
    airSpread: 0.03,
    crouchSpreadMult: 0.7,
    spreadPerShot: 0.0028,
    maxSpread: 0.06,
    spreadRecovery: 8.0, // per second
    recoilPattern: genAKPattern(),
    recoilRecovery: 6.5,
    recoilResetTime: 0.4,
    viewPunchScale: 0.9,
    range: 200,
    wallPenetration: false,
    adsFov: 65,
    price: 2700
  },
  m4a1: {
    id: 'm4a1',
    name: 'M4A1-S',
    role: 'RIFLE',
    damage: 32,
    headshotMultiplier: 3.2,
    fireRate: 666,
    magazine: 20,
    reserve: 80,
    reloadTime: 2.0,
    baseSpread: 0.0010,
    moveSpread: 0.012,
    airSpread: 0.025,
    crouchSpreadMult: 0.65,
    spreadPerShot: 0.0018,
    maxSpread: 0.045,
    spreadRecovery: 9.0,
    recoilPattern: genM4Pattern(),
    recoilRecovery: 7.0,
    recoilResetTime: 0.35,
    viewPunchScale: 0.65,
    range: 200,
    adsFov: 65
  },
  glock: {
    id: 'glock',
    name: 'GLOCK-18',
    role: 'PISTOL',
    damage: 22,
    headshotMultiplier: 3.0,
    fireRate: 400,
    magazine: 20,
    reserve: 120,
    reloadTime: 1.5,
    baseSpread: 0.002,
    moveSpread: 0.018,
    airSpread: 0.035,
    crouchSpreadMult: 0.8,
    spreadPerShot: 0.004,
    maxSpread: 0.05,
    spreadRecovery: 10.0,
    recoilPattern: [{x:0,y:0.4},{x:0.05,y:0.35},{x:-0.05,y:0.3}],
    recoilRecovery: 9.0,
    recoilResetTime: 0.3,
    viewPunchScale: 0.5,
    range: 80
  },
  awp: {
    id: 'awp',
    name: 'AWP',
    role: 'SNIPER',
    damage: 115,
    headshotMultiplier: 1.5,
    fireRate: 41,
    magazine: 10,
    reserve: 30,
    reloadTime: 3.5,
    baseSpread: 0.0002,
    moveSpread: 0.08,
    airSpread: 0.15,
    crouchSpreadMult: 0.5,
    spreadPerShot: 0.05,
    maxSpread: 0.1,
    spreadRecovery: 3.0,
    recoilPattern: [{x:0,y:2.0}],
    recoilRecovery: 2.5,
    recoilResetTime: 1.2,
    viewPunchScale: 2.5,
    range: 400,
    adsFov: 25
  }
};

// Per MVP només ak47, però deixem les altres definides
export const DEFAULT_WEAPON = 'ak47';

export function getFireInterval(weapon) {
  return 60 / weapon.fireRate; // segons
}
