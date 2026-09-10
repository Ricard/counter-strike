// RenderSystem - capa Render, interpolat entre steps de física per evitar jitter
import * as THREE from 'three';
import { SETTINGS } from '../config/settings.js';
import { createFlatMaterial, createTargetMaterial, createWeaponMaterial } from '../game/Materials.js';

export class RenderSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101412);
    this.scene.fog = new THREE.Fog(0x101412, 60, 180);

    this.camera = new THREE.PerspectiveCamera(
      SETTINGS.CAMERA.baseFov,
      canvas.clientWidth / canvas.clientHeight,
      SETTINGS.CAMERA.near,
      SETTINGS.CAMERA.far
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // perf
      powerPreference: 'high-performance',
      stencil: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false; // desactivat per perf MVP, fàcil activar després

    // Lights - flat shading, sense textures
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(30, 50, 20);
    this.scene.add(dirLight);
    const hemi = new THREE.HemisphereLight(0x88ccaa, 0x222222, 0.4);
    this.scene.add(hemi);

    // Grups
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    this.targetsGroup = new THREE.Group();
    this.scene.add(this.targetsGroup);

    this.viewModelGroup = new THREE.Group();
    // Viewmodel ha d'estar com a fill de camera per no moure's amb interpolació món
    this.camera.add(this.viewModelGroup);
    this.scene.add(this.camera);

    // Weapon viewmodel mesh
    this.weaponMesh = null;
    this.muzzleFlash = null;
    this._createViewModel();

    // Interpolació posicions
    this._prevPlayerPos = new THREE.Vector3();
    this._currPlayerPos = new THREE.Vector3();

    // View bob / sway
    this._bobTime = 0;

    // Resize
    window.addEventListener('resize', () => this.resize());
  }

  _createViewModel() {
    // Low-poly AK-47 amb primitives - sense textures
    const group = new THREE.Group();

    const matBody = createWeaponMaterial(0x2a2a2a);
    const matWood = createWeaponMaterial(0x5a3a2a);
    const matMetal = createWeaponMaterial(0x888888);

    // Cos principal
    const bodyGeo = new THREE.BoxGeometry(0.08, 0.06, 0.45);
    const body = new THREE.Mesh(bodyGeo, matBody);
    body.position.set(0, -0.05, -0.25);
    group.add(body);

    // Canó
    const barrelGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.6, 8);
    barrelGeo.rotateX(Math.PI/2);
    const barrel = new THREE.Mesh(barrelGeo, matMetal);
    barrel.position.set(0, -0.02, -0.65);
    group.add(barrel);

    // Culata
    const stockGeo = new THREE.BoxGeometry(0.06, 0.08, 0.25);
    const stock = new THREE.Mesh(stockGeo, matWood);
    stock.position.set(0, -0.02, 0.05);
    group.add(stock);

    // Mira
    const sightGeo = new THREE.BoxGeometry(0.02, 0.04, 0.02);
    const sight = new THREE.Mesh(sightGeo, matMetal);
    sight.position.set(0, 0.02, -0.35);
    group.add(sight);

    // Carregador
    const magGeo = new THREE.BoxGeometry(0.05, 0.15, 0.08);
    const mag = new THREE.Mesh(magGeo, matBody);
    mag.position.set(0, -0.14, -0.2);
    mag.rotation.x = 0.15;
    group.add(mag);

    group.position.set(0.22, -0.18, -0.35);
    group.rotation.set(0, 0.05, 0);

    this.viewModelGroup.add(group);
    this.weaponMesh = group;

    // Muzzle flash - petit con
    const flashGeo = new THREE.ConeGeometry(0.04, 0.12, 6);
    flashGeo.rotateX(-Math.PI/2);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent:true, opacity:0 });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.set(0, -0.02, -0.95);
    group.add(flash);
    this.muzzleFlash = flash;
    this._flashMat = flashMat;
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  // Mapa bloc-out
  buildMap(mapData) {
    // Netejar
    while (this.worldGroup.children.length) {
      const c = this.worldGroup.children[0];
      this.worldGroup.remove(c);
      if (c.geometry) c.geometry.dispose();
    }

    mapData.boxes.forEach(box => {
      const geo = new THREE.BoxGeometry(box.size.x, box.size.y, box.size.z);
      // Color per tipus
      let color = 0x2a3a32;
      if (box.type === 'floor') color = 0x1e2e28;
      if (box.type === 'wall') color = 0x3a4a42;
      if (box.type === 'cover') color = 0x4a5a52;
      if (box.type === 'platform') color = 0x2e3e36;
      const mat = createFlatMaterial(color, box.type === 'cover' ? 0.15 : 0);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(box.pos.x, box.pos.y, box.pos.z);
      mesh.userData.type = box.type;
      mesh.userData.collider = box.colliderRef || null;
      this.worldGroup.add(mesh);
    });

    // Terra grid helper
    const grid = new THREE.GridHelper(200, 40, 0x00ff88, 0x1a2a24);
    grid.position.y = 0.01;
    this.worldGroup.add(grid);
  }

  addTarget(pos, id) {
    const group = new THREE.Group();
    group.position.set(pos.x, pos.y, pos.z);

    // Cos - capsula simplificada amb cilindre + esfera
    const bodyGeo = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
    const mat = createTargetMaterial();
    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.position.y = 0.9;
    bodyMesh.userData.isTarget = true;
    bodyMesh.userData.targetId = id;
    group.add(bodyMesh);

    // Cap
    const headGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const headMesh = new THREE.Mesh(headGeo, mat);
    headMesh.position.y = 1.8;
    headMesh.userData.isTarget = true;
    headMesh.userData.isHead = true;
    headMesh.userData.targetId = id;
    group.add(headMesh);

    // Outline wireframe
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true, transparent:true, opacity:0.3 });
    const outlineBody = new THREE.Mesh(bodyGeo.clone(), outlineMat);
    outlineBody.position.copy(bodyMesh.position);
    outlineBody.scale.set(1.02,1.02,1.02);
    group.add(outlineBody);
    const outlineHead = new THREE.Mesh(headGeo.clone(), outlineMat);
    outlineHead.position.copy(headMesh.position);
    outlineHead.scale.set(1.15,1.15,1.15);
    group.add(outlineHead);

    group.userData.targetId = id;
    group.userData.isTargetGroup = true;
    this.targetsGroup.add(group);
    return group;
  }

  removeTarget(id) {
    const obj = this.targetsGroup.children.find(c => c.userData.targetId === id);
    if (obj) {
      this.targetsGroup.remove(obj);
    }
  }

  updateTargetHit(id, isDead) {
    const obj = this.targetsGroup.children.find(c => c.userData.targetId === id);
    if (!obj) return;
    obj.traverse(m => {
      if (m.isMesh && m.material && !m.material.wireframe) {
        m.material.color.set(isDead ? 0x550000 : 0xff3333);
        setTimeout(() => {
          if (!isDead && m.material) m.material.color.set(0xdddddd);
        }, 120);
      }
    });
    if (isDead) {
      // animació caiguda
      obj.rotation.z = Math.PI/2;
      obj.position.y -= 0.8;
    }
  }

  // Render amb interpolació
  render(alpha, playerState, weaponState, cameraState) {
    // Interpolació posició jugador entre prev i curr
    const interpPos = new THREE.Vector3().lerpVectors(this._prevPlayerPos, this._currPlayerPos, alpha);

    // Camera pos = interp + eye height
    const eyeHeight = THREE.MathUtils.lerp(
      playerState.prevEyeHeight ?? SETTINGS.CAMERA.eyeHeight,
      playerState.eyeHeight,
      alpha
    );

    this.camera.position.set(interpPos.x, interpPos.y + eyeHeight, interpPos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = cameraState.yaw;
    this.camera.rotation.x = cameraState.pitch;

    // FOV lerp per zoom suau (però input sense smoothing)
    const targetFov = cameraState.targetFov;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.15);
    this.camera.updateProjectionMatrix();

    // View bob basat en moviment
    if (playerState.isMoving && playerState.onGround) {
      this._bobTime += 0.016 * SETTINGS.VIEW_BOB_FREQ * (playerState.speed / SETTINGS.PLAYER.maxSpeed);
      const bobX = Math.sin(this._bobTime) * SETTINGS.VIEW_BOB_AMP * 0.5;
      const bobY = Math.sin(this._bobTime * 2) * SETTINGS.VIEW_BOB_AMP;
      this.camera.position.x += bobX;
      this.camera.position.y += bobY;
    }

    // Weapon sway / bob - independent del recoil
    if (this.weaponMesh) {
      const basePos = { x: 0.22, y: -0.18, z: -0.35 };
      let swayX = 0, swayY = 0, bobX = 0, bobY = 0;

      // Sway per mouse movement (view punch independent)
      swayX = -cameraState.sway.x * 0.15;
      swayY = -cameraState.sway.y * 0.15;

      // Bob per moviment
      if (playerState.isMoving && playerState.onGround) {
        bobX = Math.sin(this._bobTime * SETTINGS.WEAPON_BOB_FREQ * 0.5) * SETTINGS.WEAPON_BOB_AMP;
        bobY = Math.sin(this._bobTime * SETTINGS.WEAPON_BOB_FREQ) * SETTINGS.WEAPON_BOB_AMP * 0.5;
      }

      // Recoil punch - moviment de l'arma cap amunt
      const recoilPunch = weaponState.recoilPunch || { x:0, y:0 };
      const punchY = recoilPunch.y * 0.08;
      const punchX = recoilPunch.x * 0.08;

      // Reload anim
      let reloadOffset = 0;
      if (weaponState.isReloading) {
        const t = weaponState.reloadProgress; // 0-1
        reloadOffset = Math.sin(t * Math.PI) * -0.15;
      }

      this.weaponMesh.position.set(
        basePos.x + swayX + bobX + punchX,
        basePos.y + swayY + bobY + reloadOffset + punchY * 0.5,
        basePos.z + reloadOffset * 0.5
      );
      // Rotació per recoil
      this.weaponMesh.rotation.set(
        punchY * 0.5,
        0.05 + punchX * 0.3,
        punchX * 0.2 + bobX * 0.5
      );

      // FOV weapon independent (per evitar distorsió en zoom)
      // No canviem, però podríem
    }

    // Muzzle flash
    if (weaponState.muzzleFlashTimer > 0) {
      this._flashMat.opacity = weaponState.muzzleFlashTimer * 8;
      this.muzzleFlash.scale.setScalar(1 + Math.random()*0.5);
      this.muzzleFlash.visible = true;
    } else {
      this._flashMat.opacity = 0;
      this.muzzleFlash.visible = false;
    }

    this.renderer.render(this.scene, this.camera);
  }

  setPrevCurrPos(prev, curr) {
    this._prevPlayerPos.copy(prev);
    this._currPlayerPos.copy(curr);
  }

  // Efecte impacte
  spawnImpact(pos, normal) {
    // Petit quadre flat per marcar impacte
    const geo = new THREE.CircleGeometry(0.06, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y, pos.z);
    // Orientar segons normal
    const up = new THREE.Vector3(0,0,1);
    const n = new THREE.Vector3(normal.x, normal.y, normal.z);
    mesh.quaternion.setFromUnitVectors(up, n);
    mesh.position.addScaledVector(n, 0.01);
    this.worldGroup.add(mesh);
    setTimeout(() => {
      this.worldGroup.remove(mesh);
      geo.dispose();
      mat.dispose();
    }, 3000);
  }

  getScene() { return this.scene; }
  getCamera() { return this.camera; }
}
