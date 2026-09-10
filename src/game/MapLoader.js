// MapLoader - genera mapa bloc-out geomètric amb col·lisions Rapier
// Fase 1: mapa propi senzill amb cobertures, línies llargues i curtes
// Fase 2: aproximació Dust II (deixem funció per futur)

export class MapLoader {
  constructor(physicsSystem) {
    this.physics = physicsSystem;
  }

  // Mapa MVP: 80x80, parets, plataformes, cobertures
  createBlockoutMap() {
    const boxes = [];

    // Terra principal
    boxes.push({
      pos: { x: 0, y: -0.5, z: 0 },
      size: { x: 100, y: 1, z: 100 },
      type: 'floor'
    });

    // Parets exteriors
    const wallH = 8;
    const wallT = 1;
    boxes.push({ pos: { x: 0, y: wallH/2, z: 50 }, size: { x: 100, y: wallH, z: wallT }, type: 'wall' }); // nord
    boxes.push({ pos: { x: 0, y: wallH/2, z: -50 }, size: { x: 100, y: wallH, z: wallT }, type: 'wall' }); // sud
    boxes.push({ pos: { x: 50, y: wallH/2, z: 0 }, size: { x: wallT, y: wallH, z: 100 }, type: 'wall' }); // est
    boxes.push({ pos: { x: -50, y: wallH/2, z: 0 }, size: { x: wallT, y: wallH, z: 100 }, type: 'wall' }); // oest

    // Cobertures interiors - línia visió llarga (mid)
    // Caixa central per trencar línia
    boxes.push({ pos: { x: 0, y: 1, z: 0 }, size: { x: 6, y: 2, z: 2 }, type: 'cover' });
    boxes.push({ pos: { x: 0, y: 1, z: 12 }, size: { x: 4, y: 2, z: 4 }, type: 'cover' });
    boxes.push({ pos: { x: 0, y: 1, z: -12 }, size: { x: 4, y: 2, z: 4 }, type: 'cover' });

    // Lado A - estructura elevada
    boxes.push({ pos: { x: 25, y: 0.5, z: 25 }, size: { x: 12, y: 1, z: 12 }, type: 'platform' });
    boxes.push({ pos: { x: 25, y: 2, z: 30 }, size: { x: 2, y: 3, z: 6 }, type: 'cover' });
    boxes.push({ pos: { x: 30, y: 2, z: 25 }, size: { x: 6, y: 3, z: 2 }, type: 'cover' });

    // Lado B
    boxes.push({ pos: { x: -25, y: 0.5, z: -25 }, size: { x: 14, y: 1, z: 14 }, type: 'platform' });
    boxes.push({ pos: { x: -25, y: 2, z: -30 }, size: { x: 6, y: 3, z: 2 }, type: 'cover' });
    boxes.push({ pos: { x: -30, y: 2, z: -25 }, size: { x: 2, y: 3, z: 6 }, type: 'cover' });

    // Corredors laterals
    boxes.push({ pos: { x: 15, y: 1.5, z: -10 }, size: { x: 2, y: 3, z: 20 }, type: 'wall' });
    boxes.push({ pos: { x: -15, y: 1.5, z: 10 }, size: { x: 2, y: 3, z: 20 }, type: 'wall' });

    // Caixes petites per cover
    const smallCovers = [
      { x: 10, z: 5 }, { x: 12, z: 6 }, { x: -10, z: -5 },
      { x: -12, z: -6 }, { x: 5, z: -18 }, { x: -5, z: 18 },
      { x: 35, z: 0 }, { x: -35, z: 0 }, { x: 0, z: 35 }, { x: 0, z: -35 }
    ];
    smallCovers.forEach(p => {
      boxes.push({
        pos: { x: p.x, y: 1, z: p.z },
        size: { x: 2, y: 2, z: 2 },
        type: 'cover'
      });
    });

    // Torres / plataformes altes per validar salt
    boxes.push({ pos: { x: -35, y: 1.5, z: 35 }, size: { x: 6, y: 3, z: 6 }, type: 'platform' });
    boxes.push({ pos: { x: 35, y: 1.5, z: -35 }, size: { x: 6, y: 3, z: 6 }, type: 'platform' });

    // Crear col·lisions Rapier
    boxes.forEach(b => {
      const { body, collider } = this.physics.createStaticBox(b.pos, b.size);
      b.colliderRef = collider;
      b.bodyRef = body;
    });

    return { boxes, spawnPoints: this._getSpawnPoints() };
  }

  _getSpawnPoints() {
    return [
      { pos: { x: -40, y: 2, z: -40 }, yaw: 45 * Math.PI/180, name: 'CT Spawn' },
      { pos: { x: 40, y: 2, z: 40 }, yaw: -135 * Math.PI/180, name: 'T Spawn' },
      { pos: { x: 0, y: 2, z: -45 }, yaw: 0, name: 'Mid' }
    ];
  }

  // Dust II aproximat - només geometria, sense textures
  // Layout: A site (esquerra), B site (dreta), Mid, Tunnels, CT spawn
  createDust2Approx() {
    const boxes = [];

    // Terra base gran
    boxes.push({ pos: { x: 0, y: -0.5, z: 0 }, size: { x: 120, y: 1, z: 120 }, type: 'floor' });

    // Parets exteriors Dust2
    const W = 60, H = 10;
    boxes.push({ pos: { x: 0, y: H/2, z: W }, size: { x: W*2, y: H, z: 1 }, type: 'wall' });
    boxes.push({ pos: { x: 0, y: H/2, z: -W }, size: { x: W*2, y: H, z: 1 }, type: 'wall' });
    boxes.push({ pos: { x: W, y: H/2, z: 0 }, size: { x: 1, y: H, z: W*2 }, type: 'wall' });
    boxes.push({ pos: { x: -W, y: H/2, z: 0 }, size: { x: 1, y: H, z: W*2 }, type: 'wall' });

    // Bombsite A (nord-est) - plataforma
    boxes.push({ pos: { x: 35, y: 0.25, z: 35 }, size: { x: 20, y: 0.5, z: 20 }, type: 'platform' });
    // Caixes A
    boxes.push({ pos: { x: 40, y: 1.5, z: 40 }, size: { x: 3, y: 3, z: 3 }, type: 'cover' });
    boxes.push({ pos: { x: 30, y: 1.5, z: 38 }, size: { x: 4, y: 3, z: 2 }, type: 'cover' });
    boxes.push({ pos: { x: 35, y: 1.5, z: 30 }, size: { x: 6, y: 3, z: 2 }, type: 'cover' });

    // Bombsite B (nord-oest) - túnels
    boxes.push({ pos: { x: -35, y: 0.25, z: 35 }, size: { x: 18, y: 0.5, z: 18 }, type: 'platform' });
    boxes.push({ pos: { x: -40, y: 1.5, z: 40 }, size: { x: 3, y: 3, z: 6 }, type: 'cover' });
    boxes.push({ pos: { x: -30, y: 1.5, z: 38 }, size: { x: 2, y: 3, z: 6 }, type: 'cover' });

    // Mid - porta
    boxes.push({ pos: { x: 0, y: 2, z: 10 }, size: { x: 12, y: 4, z: 1 }, type: 'wall' });
    boxes.push({ pos: { x: -6, y: 2, z: 10 }, size: { x: 1, y: 4, z: 6 }, type: 'wall' });
    boxes.push({ pos: { x: 6, y: 2, z: 10 }, size: { x: 1, y: 4, z: 6 }, type: 'wall' });
    // Caixa mid
    boxes.push({ pos: { x: 0, y: 1, z: 0 }, size: { x: 3, y: 2, z: 3 }, type: 'cover' });

    // Catwalk / Short
    boxes.push({ pos: { x: 15, y: 0.5, z: 15 }, size: { x: 4, y: 1, z: 20 }, type: 'platform' });
    boxes.push({ pos: { x: 15, y: 2, z: 25 }, size: { x: 1, y: 3, z: 8 }, type: 'wall' });

    // Tunnels
    boxes.push({ pos: { x: -15, y: 2, z: 20 }, size: { x: 6, y: 4, z: 1 }, type: 'wall' });
    boxes.push({ pos: { x: -20, y: 2, z: 30 }, size: { x: 1, y: 4, z: 20 }, type: 'wall' });
    boxes.push({ pos: { x: -10, y: 2, z: 30 }, size: { x: 1, y: 4, z: 20 }, type: 'wall' });

    // Spawns
    boxes.push({ pos: { x: 0, y: 1, z: -45 }, size: { x: 10, y: 2, z: 4 }, type: 'cover' }); // T spawn cover
    boxes.push({ pos: { x: 45, y: 1, z: -20 }, size: { x: 6, y: 2, z: 6 }, type: 'cover' }); // CT spawn

    boxes.forEach(b => {
      const { body, collider } = this.physics.createStaticBox(b.pos, b.size);
      b.colliderRef = collider;
      b.bodyRef = body;
    });

    return {
      boxes,
      spawnPoints: [
        { pos: { x: 0, y: 2, z: -50 }, yaw: 0, name: 'T Spawn' },
        { pos: { x: 50, y: 2, z: -30 }, yaw: -90 * Math.PI/180, name: 'CT Spawn' },
        { pos: { x: 35, y: 2, z: 35 }, yaw: 180 * Math.PI/180, name: 'A Site' },
        { pos: { x: -35, y: 2, z: 35 }, yaw: 0, name: 'B Site' }
      ]
    };
  }
}
