// Materials pipeline - flat shading, fàcil substituir per textures reals futur
import * as THREE from 'three';

const materialCache = new Map();

export function createFlatMaterial(color, roughnessOffset = 0) {
  const key = `flat_${color}_${roughnessOffset}`;
  if (materialCache.has(key)) return materialCache.get(key);
  const mat = new THREE.MeshLambertMaterial({
    color: color,
    flatShading: true
  });
  // Pipeline preparat per textures: si en futur hi ha map, només afegir aquí
  // mat.map = textureLoader.load(...)
  materialCache.set(key, mat);
  return mat;
}

export function createWireframeMaterial(color) {
  const key = `wire_${color}`;
  if (materialCache.has(key)) return materialCache.get(key);
  const mat = new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity: 0.4
  });
  materialCache.set(key, mat);
  return mat;
}

export function createTargetMaterial() {
  const key = 'target';
  if (materialCache.has(key)) return materialCache.get(key);
  const mat = new THREE.MeshLambertMaterial({
    color: 0xdddddd,
    flatShading: true
  });
  materialCache.set(key, mat);
  return mat;
}

export function createWeaponMaterial(color) {
  const key = `weapon_${color}`;
  if (materialCache.has(key)) return materialCache.get(key);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.2,
    flatShading: true
  });
  materialCache.set(key, mat);
  return mat;
}

// Per futur: funció per carregar textures sense tocar nucli
export function setMaterialTexture(material, textureUrl) {
  // Placeholder: carregar textura i assignar
  const loader = new THREE.TextureLoader();
  loader.load(textureUrl, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    material.map = tex;
    material.needsUpdate = true;
  });
}
