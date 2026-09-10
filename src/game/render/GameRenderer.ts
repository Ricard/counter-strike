import * as THREE from "three";
import { MATERIAL_PALETTE, PLAYER_CONFIG, VIEW_CONFIG } from "../config";
import { TRAINING_GROUND, type SurfaceMaterial } from "../maps/trainingGround";
import type { GameEvent, SimulationSnapshot } from "../types";
import type { LookDelta } from "../input/InputManager";

interface TargetVisual {
  group: THREE.Group;
  material: THREE.MeshStandardMaterial;
}

interface TimedEffect {
  object: THREE.Object3D;
  ttl: number;
  dispose?: () => void;
}

const damp = (current: number, target: number, lambda: number, dt: number) =>
  THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));

export class GameRenderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(VIEW_CONFIG.fov, 1, 0.025, 180);
  readonly renderer: THREE.WebGLRenderer;

  private readonly canvas: HTMLCanvasElement;
  private readonly surfaceMaterials = new Map<SurfaceMaterial, THREE.MeshStandardMaterial>();
  private readonly targetVisuals = new Map<string, TargetVisual>();
  private readonly effects: TimedEffect[] = [];
  private readonly weaponRig = new THREE.Group();
  private readonly muzzleFlash: THREE.Mesh;
  private readonly impactGeometry = new THREE.OctahedronGeometry(0.065, 0);
  private readonly impactWorldMaterial = new THREE.MeshBasicMaterial({ color: 0xe9ff58 });
  private readonly impactTargetMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private width = 0;
  private height = 0;
  private bobTime = 0;
  private swayX = 0;
  private swayY = 0;
  private weaponKick = 0;
  private landingKick = 0;
  private currentFov: number = VIEW_CONFIG.fov;
  private muzzleTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("webgl2", {
      alpha: false,
      antialias: true,
      depth: true,
      stencil: false,
      powerPreference: "high-performance",
    });
    if (!context) throw new Error("WebGL2 no està disponible en aquest navegador.");

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = false;

    this.scene.background = new THREE.Color(0x111a1e);
    this.scene.fog = new THREE.Fog(0x111a1e, 28, 82);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);

    this.createMaterials();
    this.createLighting();
    this.createEnvironment();
    this.createTargets();
    this.muzzleFlash = this.createWeapon();
    this.resize();
  }

  render(
    snapshot: SimulationSnapshot,
    alpha: number,
    dt: number,
    lookDelta: LookDelta,
    scoped: boolean,
  ) {
    this.resize();
    const t = THREE.MathUtils.clamp(alpha, 0, 1);
    const x = THREE.MathUtils.lerp(snapshot.previousPosition.x, snapshot.position.x, t);
    const y = THREE.MathUtils.lerp(snapshot.previousPosition.y, snapshot.position.y, t);
    const z = THREE.MathUtils.lerp(snapshot.previousPosition.z, snapshot.position.z, t);
    const crouchOffset = snapshot.crouched ? 0.18 : 0;

    this.landingKick = damp(this.landingKick, 0, 11, dt);
    this.camera.position.set(x, y + PLAYER_CONFIG.eyeOffset - crouchOffset - this.landingKick, z);
    this.camera.rotation.set(
      snapshot.pitch + snapshot.weapon.recoilPitch + snapshot.weapon.viewPunchPitch,
      snapshot.yaw + snapshot.weapon.recoilYaw + snapshot.weapon.viewPunchYaw,
      0,
    );

    const targetFov = scoped ? VIEW_CONFIG.scopedFov : VIEW_CONFIG.fov;
    this.currentFov = damp(this.currentFov, targetFov, scoped ? 20 : 15, dt);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.01) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    this.updateWeapon(snapshot, dt, lookDelta, scoped);
    this.updateTargets(snapshot);
    this.updateEffects(dt);
    this.renderer.render(this.scene, this.camera);
  }

  handleEvents(events: GameEvent[]) {
    for (const event of events) {
      if (event.type === "shot") {
        this.weaponKick = Math.min(0.15, this.weaponKick + 0.075);
        this.muzzleTime = 0.045;
        this.createTracer(event.origin, event.end, event.hitTarget);
        if (event.hit) this.createImpact(event.end, event.normal, event.hitTarget);
      } else if (event.type === "land") {
        this.landingKick = 0.016 * event.intensity;
      }
    }
  }

  dispose() {
    for (const effect of this.effects) effect.dispose?.();
    this.effects.length = 0;
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
    this.renderer.dispose();
  }

  private createMaterials() {
    const colors: Record<SurfaceMaterial, number> = {
      concrete: MATERIAL_PALETTE.concrete,
      darkConcrete: MATERIAL_PALETTE.darkConcrete,
      metal: MATERIAL_PALETTE.metal,
      cover: MATERIAL_PALETTE.cover,
      ground: MATERIAL_PALETTE.ground,
    };

    for (const [name, color] of Object.entries(colors) as [SurfaceMaterial, number][]) {
      this.surfaceMaterials.set(
        name,
        new THREE.MeshStandardMaterial({
          color,
          flatShading: true,
          roughness: name === "metal" ? 0.54 : 0.9,
          metalness: name === "metal" ? 0.38 : 0.02,
        }),
      );
    }
  }

  private createLighting() {
    const hemisphere = new THREE.HemisphereLight(0xb7dce5, 0x172024, 2.15);
    this.scene.add(hemisphere);

    const key = new THREE.DirectionalLight(0xfff4d6, 2.7);
    key.position.set(-12, 24, 9);
    this.scene.add(key);

    const coolFill = new THREE.DirectionalLight(0x7ad7e8, 0.65);
    coolFill.position.set(15, 7, -18);
    this.scene.add(coolFill);
  }

  private createEnvironment() {
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: MATERIAL_PALETTE.outline,
      transparent: true,
      opacity: 0.74,
    });

    for (const block of TRAINING_GROUND.blocks) {
      const geometry = new THREE.BoxGeometry(block.size.x, block.size.y, block.size.z);
      const mesh = new THREE.Mesh(geometry, this.surfaceMaterials.get(block.material));
      mesh.position.set(block.position.x, block.position.y, block.position.z);
      this.scene.add(mesh);

      if (block.id !== "floor") {
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 24), outlineMaterial);
        edges.position.copy(mesh.position);
        edges.scale.setScalar(1.0015);
        this.scene.add(edges);
      }
    }

    const grid = new THREE.GridHelper(40, 40, 0x52636a, 0x28363b);
    grid.position.y = 0.008;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const material of gridMaterials) {
      material.transparent = true;
      material.opacity = 0.42;
    }
    this.scene.add(grid);

    const laneGeometry = new THREE.BoxGeometry(0.08, 0.025, 18);
    const laneMaterial = new THREE.MeshBasicMaterial({ color: 0xb6cf3e });
    for (const x of [-8.35, 8.35]) {
      const stripe = new THREE.Mesh(laneGeometry, laneMaterial);
      stripe.position.set(x, 0.025, 1);
      this.scene.add(stripe);
    }

    const beaconMaterial = new THREE.MeshBasicMaterial({ color: MATERIAL_PALETTE.accent });
    const beaconGeometry = new THREE.BoxGeometry(0.09, 1.5, 0.05);
    for (const x of [-6.1, 6.1]) {
      const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
      beacon.position.set(x, 2.25, -23.66);
      this.scene.add(beacon);
    }
  }

  private createTargets() {
    for (const target of TRAINING_GROUND.targets) {
      const group = new THREE.Group();
      group.position.set(target.position.x, target.position.y, target.position.z);
      group.rotation.y = target.yaw;

      const material = new THREE.MeshStandardMaterial({
        color: MATERIAL_PALETTE.target,
        emissive: 0x25100b,
        flatShading: true,
        roughness: 0.72,
      });
      const dark = new THREE.MeshStandardMaterial({
        color: 0x252f33,
        flatShading: true,
        roughness: 0.8,
      });

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.12, 0.3), material);
      torso.position.y = -0.1;
      group.add(torso);

      const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.265, 0), material);
      head.position.y = 0.66;
      group.add(head);

      const legGeometry = new THREE.BoxGeometry(0.22, 0.42, 0.24);
      for (const x of [-0.21, 0.21]) {
        const leg = new THREE.Mesh(legGeometry, dark);
        leg.position.set(x, -0.74, 0);
        group.add(leg);
      }

      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 0.1, 8), dark);
      base.position.y = -0.96;
      group.add(base);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.49, 0.025, 4, 18),
        new THREE.MeshBasicMaterial({ color: MATERIAL_PALETTE.accent }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.895;
      group.add(ring);

      this.targetVisuals.set(target.id, { group, material });
      this.scene.add(group);
    }
  }

  private createWeapon() {
    const rifle = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: MATERIAL_PALETTE.weapon,
      flatShading: true,
      roughness: 0.58,
      metalness: 0.34,
    });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: MATERIAL_PALETTE.accent,
      flatShading: true,
      roughness: 0.64,
      metalness: 0.18,
    });
    const gripMaterial = new THREE.MeshStandardMaterial({
      color: 0x101719,
      flatShading: true,
      roughness: 0.96,
    });

    const addBox = (
      size: [number, number, number],
      position: [number, number, number],
      material: THREE.Material = bodyMaterial,
      rotation: [number, number, number] = [0, 0, 0],
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      rifle.add(mesh);
      return mesh;
    };

    addBox([0.2, 0.17, 0.56], [0, 0, -0.06]);
    addBox([0.135, 0.12, 0.42], [0, 0.005, -0.53], gripMaterial);
    addBox([0.06, 0.06, 0.42], [0, 0.025, -0.92], bodyMaterial);
    addBox([0.11, 0.1, 0.2], [0, 0.008, -1.13], accentMaterial);
    addBox([0.14, 0.3, 0.12], [0, -0.2, -0.08], gripMaterial, [-0.18, 0, 0]);
    addBox([0.14, 0.3, 0.15], [0, -0.2, -0.34], accentMaterial, [0.12, 0, 0]);
    addBox([0.19, 0.15, 0.35], [0, 0.005, 0.38], gripMaterial);
    addBox([0.055, 0.05, 0.42], [0, 0.14, -0.24], accentMaterial);

    const sight = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 5, 12), accentMaterial);
    sight.position.set(0, 0.19, -0.27);
    sight.rotation.y = Math.PI / 2;
    rifle.add(sight);

    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xffee82,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const flash = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.42, 5), flashMaterial);
    flash.rotation.x = -Math.PI / 2;
    flash.position.set(0, 0.025, -1.38);
    flash.visible = false;
    rifle.add(flash);

    rifle.scale.setScalar(0.8);
    this.weaponRig.add(rifle);
    this.camera.add(this.weaponRig);
    return flash;
  }

  private updateWeapon(
    snapshot: SimulationSnapshot,
    dt: number,
    lookDelta: LookDelta,
    scoped: boolean,
  ) {
    const movementRatio = Math.min(1, snapshot.speed / 5.6);
    if (snapshot.grounded && movementRatio > 0.05) this.bobTime += dt * (8.8 + movementRatio * 3.2);

    this.swayX += -lookDelta.x * 0.00016;
    this.swayY += lookDelta.y * 0.00013;
    this.swayX = damp(this.swayX, 0, 13, dt);
    this.swayY = damp(this.swayY, 0, 13, dt);
    this.weaponKick = damp(this.weaponKick, 0, 18, dt);

    const scopeFactor = scoped ? 0.16 : 1;
    const bobX = Math.sin(this.bobTime) * 0.009 * movementRatio * scopeFactor;
    const bobY = Math.abs(Math.cos(this.bobTime)) * 0.007 * movementRatio * scopeFactor;
    const reload = snapshot.weapon.reloading
      ? Math.sin(snapshot.weapon.reloadProgress * Math.PI)
      : 0;

    const targetX = scoped ? 0 : 0.34;
    const targetY = scoped ? -0.2 : -0.3;
    const targetZ = scoped ? -0.68 : -0.62;
    this.weaponRig.position.x = damp(
      this.weaponRig.position.x,
      targetX + bobX + this.swayX * scopeFactor,
      18,
      dt,
    );
    this.weaponRig.position.y = damp(
      this.weaponRig.position.y,
      targetY - bobY + this.swayY * scopeFactor - reload * 0.11,
      18,
      dt,
    );
    this.weaponRig.position.z = damp(
      this.weaponRig.position.z,
      targetZ + this.weaponKick + reload * 0.09,
      20,
      dt,
    );
    this.weaponRig.rotation.set(
      -0.03 - reload * 0.35,
      -0.04 + this.swayX * 0.35,
      bobX * 0.8 + reload * 0.48,
    );

    this.muzzleTime = Math.max(0, this.muzzleTime - dt);
    this.muzzleFlash.visible = this.muzzleTime > 0;
    const flashMaterial = this.muzzleFlash.material as THREE.MeshBasicMaterial;
    flashMaterial.opacity = Math.min(1, this.muzzleTime * 28);
    this.muzzleFlash.rotation.z += dt * 28;
  }

  private updateTargets(snapshot: SimulationSnapshot) {
    for (const target of snapshot.targets) {
      const visual = this.targetVisuals.get(target.id);
      if (!visual) continue;
      visual.group.visible = target.active;
      const healthRatio = Math.max(0, target.health / target.maxHealth);
      visual.group.scale.y = 0.985 + healthRatio * 0.015;
      visual.material.color
        .setHex(MATERIAL_PALETTE.target)
        .lerp(new THREE.Color(MATERIAL_PALETTE.targetHit), target.hitFlash);
      visual.material.emissive.setHex(target.hitFlash > 0.05 ? 0x8a2515 : 0x25100b);
    }
  }

  private createTracer(start: { x: number; y: number; z: number }, end: { x: number; y: number; z: number }, target: boolean) {
    const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, end.z - start.z);
    const visualStart = new THREE.Vector3(start.x, start.y - 0.16, start.z).addScaledVector(
      direction.normalize(),
      0.7,
    );
    const visualEnd = new THREE.Vector3(end.x, end.y, end.z);
    const geometry = new THREE.BufferGeometry().setFromPoints([visualStart, visualEnd]);
    const material = new THREE.LineBasicMaterial({
      color: target ? 0xffffff : MATERIAL_PALETTE.accent,
      transparent: true,
      opacity: 0.7,
    });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this.effects.push({
      object: line,
      ttl: 0.055,
      dispose: () => {
        geometry.dispose();
        material.dispose();
      },
    });
  }

  private createImpact(
    position: { x: number; y: number; z: number },
    normal: { x: number; y: number; z: number },
    target: boolean,
  ) {
    const marker = new THREE.Mesh(
      this.impactGeometry,
      target ? this.impactTargetMaterial : this.impactWorldMaterial,
    );
    marker.position.set(
      position.x + normal.x * 0.018,
      position.y + normal.y * 0.018,
      position.z + normal.z * 0.018,
    );
    marker.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(normal.x, normal.y, normal.z).normalize(),
    );
    this.scene.add(marker);
    this.effects.push({ object: marker, ttl: target ? 0.16 : 0.1 });
  }

  private updateEffects(dt: number) {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.ttl -= dt;
      const material = (effect.object as THREE.Mesh).material;
      if (material && !Array.isArray(material) && "opacity" in material) {
        (material as THREE.Material).opacity = Math.min(1, effect.ttl * 15);
      }
      if (effect.ttl > 0) continue;
      effect.object.removeFromParent();
      effect.dispose?.();
      this.effects.splice(index, 1);
    }
  }

  private resize() {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
