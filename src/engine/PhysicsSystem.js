// PhysicsSystem - capa Simulació/Físiques, step fix 64Hz, Rapier3D
// Gestiona món físic, character controller, raycasting

import * as RAPIER from '@dimforge/rapier3d-compat';
import { SETTINGS } from '../config/settings.js';

export class PhysicsSystem {
  constructor() {
    this.world = null;
    this.characterController = null;
    this.playerBody = null;
    this.playerCollider = null;
    this.staticBodies = [];
    this._initialized = false;
  }

  async init() {
    await RAPIER.init();
    const gravity = { x: 0, y: SETTINGS.GRAVITY, z: 0 };
    this.world = new RAPIER.World(gravity);
    
    // Character controller per jugador - offset és skin width
    this.characterController = this.world.createCharacterController(SETTINGS.PLAYER.skinWidth);
    this.characterController.enableAutostep(SETTINGS.PLAYER.stepOffset, 0.2, true);
    this.characterController.enableSnapToGround(0.5);
    this.characterController.setApplyImpulsesToDynamicBodies(true);

    // Crear cos cinemàtic per jugador
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(0, 3, 0)
      .setLinearDamping(0)
      .setAngularDamping(0);
    this.playerBody = this.world.createRigidBody(bodyDesc);
    
    const halfHeight = (SETTINGS.PLAYER.height / 2) - SETTINGS.PLAYER.radius;
    const capsuleDesc = RAPIER.ColliderDesc.capsule(halfHeight, SETTINGS.PLAYER.radius)
      .setFriction(0)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    this.playerCollider = this.world.createCollider(capsuleDesc, this.playerBody);

    this._initialized = true;
    console.log('[Physics] Rapier init, world gravity', gravity);
  }

  // Crea collider estàtic per mapa
  createStaticBox(pos, size, friction = 0.8) {
    if (!this._initialized) throw new Error('Physics not init');
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);
    const body = this.world.createRigidBody(bodyDesc);
    const colDesc = RAPIER.ColliderDesc.cuboid(size.x/2, size.y/2, size.z/2)
      .setFriction(friction)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max);
    const collider = this.world.createCollider(colDesc, body);
    this.staticBodies.push({ body, collider, pos: { ...pos }, size: { ...size } });
    return { body, collider };
  }

  // Per compatibilitat amb targets mòbils (bots futurs)
  createDynamicBox(pos, size, mass = 1) {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z);
    const body = this.world.createRigidBody(bodyDesc);
    const colDesc = RAPIER.ColliderDesc.cuboid(size.x/2, size.y/2, size.z/2).setMass(mass);
    const collider = this.world.createCollider(colDesc, body);
    return { body, collider };
  }

  // Mou el jugador amb col·lisions, retorna moviment corregit i si està a terra
  moveCharacter(desiredTranslation) {
    if (!this._initialized) return { translation: desiredTranslation, grounded: false, nextPos: desiredTranslation };
    
    // Rapier espera objecte plain {x,y,z}
    const desired = {
      x: desiredTranslation.x,
      y: desiredTranslation.y,
      z: desiredTranslation.z
    };

    this.characterController.computeColliderMovement(
      this.playerCollider,
      desired
    );
    const corrected = this.characterController.computedMovement();
    const grounded = this.characterController.computedGrounded();

    // Aplicar al rigidbody
    const currentPos = this.playerBody.translation();
    const nextPos = {
      x: currentPos.x + corrected.x,
      y: currentPos.y + corrected.y,
      z: currentPos.z + corrected.z
    };
    this.playerBody.setNextKinematicTranslation(nextPos);
    // Per tenir posició immediata sense esperar step, també actualitzem translation directament
    // Això evita 1 frame de lag en interpolació
    this.playerBody.setTranslation(nextPos, true);

    return {
      translation: corrected,
      desired: desiredTranslation,
      grounded,
      nextPos,
      wouldHit: corrected.x !== desired.x ||
                corrected.y !== desired.y ||
                corrected.z !== desired.z
    };
  }

  // Teleport directe (spawn)
  setPlayerPosition(pos) {
    this.playerBody.setNextKinematicTranslation(pos);
    // També set immediat per evitar un frame de lag
    this.playerBody.setTranslation(pos, true);
  }

  getPlayerPosition() {
    const t = this.playerBody.translation();
    return { x: t.x, y: t.y, z: t.z };
  }

  // Raycasting per hitscan - retorna hit info
  raycast(origin, direction, maxDist = 200, solid = true) {
    if (!this._initialized) return null;
    const ray = new RAPIER.Ray(origin, direction);
    const hit = this.world.castRayAndGetNormal(ray, maxDist, solid);
    if (!hit) return null;
    const point = {
      x: origin.x + direction.x * hit.timeOfImpact,
      y: origin.y + direction.y * hit.timeOfImpact,
      z: origin.z + direction.z * hit.timeOfImpact
    };
    return {
      timeOfImpact: hit.timeOfImpact,
      point,
      normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
      collider: hit.collider,
      distance: hit.timeOfImpact
    };
  }

  // Raycast que retorna tots els hits (per wallbang futur, ara no usat)
  raycastAll(origin, direction, maxDist = 200) {
    // Rapier no té multi-hit directe en compat, iterem amb exclusió simple
    const hits = [];
    let currentOrigin = { ...origin };
    let remaining = maxDist;
    let iterations = 0;
    while (remaining > 0.01 && iterations < 5) {
      const hit = this.raycast(currentOrigin, direction, remaining, true);
      if (!hit) break;
      hits.push(hit);
      // Avançar una mica més enllà del hit per buscar següent
      currentOrigin = {
        x: hit.point.x + direction.x * 0.01,
        y: hit.point.y + direction.y * 0.01,
        z: hit.point.z + direction.z * 0.01
      };
      remaining -= hit.distance + 0.01;
      iterations++;
    }
    return hits;
  }

  step(dt) {
    if (!this._initialized) return;
    this.world.timestep = dt;
    this.world.step();
  }

  // Per debug / futur navmesh
  getWorld() { return this.world; }
}
