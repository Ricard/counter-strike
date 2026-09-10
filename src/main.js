// Main - orquestra les 3 capes: Simulació (64Hz) / Render (interpolat) / Input/UI
import * as THREE from 'three';
import { InputSystem } from './engine/InputSystem.js';
import { PhysicsSystem } from './engine/PhysicsSystem.js';
import { RenderSystem } from './engine/RenderSystem.js';
import { GameLoop } from './engine/GameLoop.js';
import { PlayerController } from './game/PlayerController.js';
import { CameraController } from './game/CameraController.js';
import { WeaponSystem } from './game/WeaponSystem.js';
import { MapLoader } from './game/MapLoader.js';
import { CrosshairSystem } from './ui/CrosshairSystem.js';
import { HUD } from './ui/HUD.js';
import { DebugOverlay } from './ui/DebugOverlay.js';
import { AudioSystem } from './game/AudioSystem.js';
import { SETTINGS } from './config/settings.js';
import { WEAPONS } from './config/weapons.js';

const canvas = document.getElementById('canvas');
const playBtn = document.getElementById('play-btn');
const menuOverlay = document.getElementById('menu-overlay');
const sensRange = document.getElementById('sens-range');
const sensVal = document.getElementById('sens-val');
const fovRange = document.getElementById('fov-range');
const fovVal = document.getElementById('fov-val');
const chGapRange = document.getElementById('ch-gap-range');
const chGapVal = document.getElementById('ch-gap-val');

let game = null;

class Game {
  constructor() {
    this.input = new InputSystem(canvas);
    this.physics = new PhysicsSystem();
    this.render = new RenderSystem(canvas);
    this.cameraCtrl = new CameraController();
    this.crosshair = new CrosshairSystem();
    this.hud = new HUD();
    this.debug = new DebugOverlay();
    this.audio = new AudioSystem();

    this.player = null;
    this.weapons = null;
    this.mapLoader = null;
    this.mapData = null;

    this.targets = new Map(); // id -> { pos, health, mesh, colliderBody, colliderHead? }
    this.targetIdCounter = 0;
    this._targetColliderMap = new Map(); // collider handle -> { id, isHead }

    this.playerHealth = 100;
    this.isRunning = false;

    this._lastInputCmd = null;
    this._sensitivityMult = 1.0;

    this.loop = new GameLoop({
      fixedUpdate: (dt) => this.fixedUpdate(dt),
      render: (alpha) => this.renderFrame(alpha),
      onFpsUpdate: (fps) => this.hud.updateFps(fps)
    });

    this._setupUI();
  }

  async init() {
    console.log('[Game] Init...');
    await this.physics.init();
    this.mapLoader = new MapLoader(this.physics);
    
    // Triar mapa: blockout per MVP, però deixem opció Dust2
    const useDust2 = false; // canviar a true per provar Dust2 approx
    this.mapData = useDust2 ? this.mapLoader.createDust2Approx() : this.mapLoader.createBlockoutMap();
    this.render.buildMap(this.mapData);

    this.player = new PlayerController(this.physics, this.cameraCtrl);
    this.weapons = new WeaponSystem(this.cameraCtrl, this.physics, this.render);

    // Spawn inicial
    const spawn = this.mapData.spawnPoints[0];
    this.player.spawn(spawn.pos, spawn.yaw);

    // Inicialitzar posicions render
    const pos = this.player.position;
    this.render.setPrevCurrPos(pos, pos);

    // Targets
    this._spawnTargets();

    // Weapon callbacks
    this.weapons.onShoot = (origin, dir, hit, weapon, spread) => this._onShoot(origin, dir, hit, weapon, spread);
    this.weapons.onHitTarget = (hit, weapon) => this._onHitTarget(hit, weapon);
    this.weapons.onReloadStart = () => {
      this.audio.playReload();
      this.hud.showCenterMessage('RECARREGANT...', 1000);
    };

    this.audio.init();

    // Input sensitivity des de UI
    this._sensitivityMult = parseFloat(sensRange.value);
    this.cameraCtrl.setFov(parseInt(fovRange.value));
    this.crosshair.setBaseGap(parseFloat(chGapRange.value));

    console.log('[Game] Ready - MVP jugable');
  }

  _setupUI() {
    sensRange.addEventListener('input', () => {
      this._sensitivityMult = parseFloat(sensRange.value);
      sensVal.textContent = this._sensitivityMult.toFixed(1);
      if (this.input) this.input.setSensitivity(this._sensitivityMult);
    });
    fovRange.addEventListener('input', () => {
      const v = parseInt(fovRange.value);
      fovVal.textContent = v;
      this.cameraCtrl.setFov(v);
    });
    chGapRange.addEventListener('input', () => {
      const v = parseFloat(chGapRange.value);
      chGapVal.textContent = v;
      this.crosshair.setBaseGap(v);
    });

    playBtn.addEventListener('click', async () => {
      menuOverlay.classList.add('hidden');
      await this.input.requestPointerLock();
      this.start();
    });

    // Si es fa ESC i es surt de pointer lock, mostrar menú
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement) {
        // No mostrar menú automàticament si estem en joc, només si health 0 o manual ESC
        // Però per UX, si l'usuari prem ESC, mostrem menú
        if (this.isRunning) {
          // Pausar?
          // this.pause();
        }
      }
    });

    canvas.addEventListener('click', async () => {
      if (!this.isRunning) return;
      if (!this.input.pointerLocked) {
        await this.input.requestPointerLock();
      }
    });

    // Tecla ESC per menú
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.isRunning && this.input.pointerLocked) {
          // Deixar que pointer lock surti, mostrar menú
          menuOverlay.classList.remove('hidden');
          this.input.exitPointerLock();
        } else if (!this.isRunning) {
          // ja al menú
        }
      }
      // Toggle debug amb F3
      if (e.code === 'F3') {
        this.debug.setEnabled(!this.debug.enabled);
      }
      // Respawn amb tecla R si mort? No, R és reload
      // Canvi mapa amb M (debug)
      if (e.code === 'KeyM' && e.shiftKey) {
        this._switchMap();
      }
    });
  }

  _spawnTargets() {
    // Spawn 8 bots estàtics tipus diana
    const positions = [
      { x: 10, y: 0, z: 20 },
      { x: -10, y: 0, z: -20 },
      { x: 25, y: 0, z: 0 },
      { x: -25, y: 0, z: 5 },
      { x: 0, y: 0, z: 30 },
      { x: 35, y: 0, z: -30 },
      { x: -35, y: 0, z: 30 },
      { x: 0, y: 0, z: -30 }
    ];

    positions.forEach(p => {
      const id = this.targetIdCounter++;
      const mesh = this.render.addTarget(p, id);
      
      // Crear colliders Rapier per target (per hit detection via Rapier)
      // Body collider
      const bodyPos = { x: p.x, y: 0.9, z: p.z };
      const bodySize = { x: 0.6, y: 1.2, z: 0.6 };
      const { collider: bodyCol } = this.physics.createStaticBox(bodyPos, bodySize, 0.5);
      // Cap: esfera aproximada amb cuboid petit
      const headPos = { x: p.x, y: 1.8, z: p.z };
      const headSize = { x: 0.5, y: 0.5, z: 0.5 };
      const { collider: headCol } = this.physics.createStaticBox(headPos, headSize, 0.5);

      this._targetColliderMap.set(bodyCol.handle, { id, isHead: false });
      this._targetColliderMap.set(headCol.handle, { id, isHead: true });

      this.targets.set(id, {
        id,
        pos: p,
        health: 100,
        mesh,
        colliders: [bodyCol, headCol],
        isDead: false
      });
    });
  }

  _switchMap() {
    // Netejar colliders antics (simplificat: recrear món)
    console.log('[Game] Switching map...');
    // Per MVP, no implementem neteja completa, només missatge
    this.hud.showCenterMessage('CANVI MAPA NO IMPLEMENTAT AL MVP - RELOAD', 2000);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.loop.start();
    this.hud.showCenterMessage('GO! GO! GO!', 1200);
    console.log('[Game] Started');
  }

  pause() {
    this.isRunning = false;
    this.loop.stop();
    menuOverlay.classList.remove('hidden');
  }

  // FIXED UPDATE 64Hz - Simulación
  fixedUpdate(dt) {
    // Captura input cada fixed step (però input system captura cada frame, aquí agafem últim)
    // Per max baixa latència, capturem input just abans de fixedUpdate des del render loop? 
    // En aquest disseny, capturem aquí per simplicitat, però InputSystem acumula mouseDelta cada render.
    // Per tant necessitem obtenir comanda aquí
    const inputCmd = this.input.getFrameCommand();
    // Afegir sensibilitat efectiva
    inputCmd.effectiveSensitivity = this.input.getEffectiveSensitivity();
    inputCmd._reloadLast = this._lastInputCmd ? this._lastInputCmd._reloadLast : false;
    this._lastInputCmd = inputCmd;

    // Actualitzar camera sway/recoil recovery
    this.cameraCtrl.update(dt);

    // Player movement
    this.player.fixedUpdate(inputCmd, dt);

    // Physics step
    this.physics.step(dt);

    // Weapon update - necessita player state
    const eyePos = this.player.getEyePosition();
    const playerState = {
      ...this.player.getStateForRender(),
      eyePos: { x: eyePos.x, y: eyePos.y, z: eyePos.z }
    };
    this.weapons.fixedUpdate(inputCmd, playerState, dt);

    // Audio passos
    if (playerState.isMoving && playerState.onGround) {
      this.audio.playFootstep(playerState.speed);
    }
  }

  // RENDER - interpolat, alta freqüència
  renderFrame(alpha) {
    const playerRenderState = this.player.getStateForRender();
    const weaponRenderState = this.weapons.getStateForRender();
    const cameraRenderState = {
      yaw: this.cameraCtrl.getFinalYaw(),
      pitch: this.cameraCtrl.getFinalPitch(),
      targetFov: this.cameraCtrl.targetFov,
      sway: this.cameraCtrl.sway,
      isZoomed: this.cameraCtrl.isZoomed
    };

    // Actualitzar posicions per interpolació
    this.render.setPrevCurrPos(playerRenderState.prevPosition, playerRenderState.position);

    // Render
    this.render.render(alpha, playerRenderState, weaponRenderState, cameraRenderState);

    // UI updates (cada frame render)
    this.crosshair.update(weaponRenderState, playerRenderState, SETTINGS);
    this.hud.updateWeapon(weaponRenderState);
    this.hud.updateHealth(this.playerHealth);

    // Debug
    this.debug.update({
      player: {
        position: this.player.position,
        velocity: this.player.velocity,
        onGround: this.player.onGround,
        isCrouching: this.player.isCrouching
      },
      camera: {
        yaw: this.cameraCtrl.yaw,
        pitch: this.cameraCtrl.pitch,
        targetFov: Math.round(this.render.camera.fov)
      },
      weapon: weaponRenderState,
      fps: this.loop.getFps(),
      sensitivity: this._sensitivityMult
    });
  }

  _onShoot(origin, dir, hit, weapon, spread) {
    this.audio.playShoot(weapon);

    if (!hit) return;

    // Comprovar si és target via collider map
    const colliderHandle = hit.collider?.handle;
    if (colliderHandle !== undefined && this._targetColliderMap.has(colliderHandle)) {
      // Ja gestionat a _onHitTarget
      return;
    }

    // Impacte paret - efecte visual
    this.render.spawnImpact(hit.point, hit.normal);

    // Opcional: so impacte
  }

  _onHitTarget(hit, weapon) {
    const handle = hit.collider?.handle;
    if (handle === undefined) return;
    const info = this._targetColliderMap.get(handle);
    if (!info) return;

    const target = this.targets.get(info.id);
    if (!target || target.isDead) return;

    const isHead = info.isHead;
    let damage = weapon.damage;
    if (isHead) damage *= weapon.headshotMultiplier;

    target.health -= damage;
    this.audio.playHit(isHead);
    this.hud.showHitMarker(isHead);
    this.render.updateTargetHit(target.id, false);

    // Efecte impacte sang
    this.render.spawnImpact(hit.point, hit.normal);

    if (target.health <= 0) {
      target.isDead = true;
      target.health = 0;
      this.render.updateTargetHit(target.id, true);
      this.hud.showCenterMessage(isHead ? `ENEMIC ELIMINAT - HEADSHOT!` : `ENEMIC ELIMINAT`, 800);
      // Respawn després de 3s
      setTimeout(() => {
        target.health = 100;
        target.isDead = false;
        // Reset mesh
        const mesh = this.render.targetsGroup.children.find(c => c.userData.targetId === target.id);
        if (mesh) {
          mesh.rotation.z = 0;
          mesh.position.y = target.pos.y;
          mesh.traverse(m => {
            if (m.isMesh && m.material && !m.material.wireframe) {
              m.material.color.set(0xdddddd);
            }
          });
        }
      }, 3000);
    } else {
      // Feedback dany
      // console.log(`Hit target ${target.id} - ${isHead?'HEAD':'BODY'} - HP ${target.health}`);
    }
  }
}

// Bootstrap
(async () => {
  game = new Game();
  await game.init();

  // Auto start si ja hi ha pointer lock? No, esperar menú
  console.log('[Bootstrap] Game init complete. Prem JUGAR.');
})();
