# Counter-Strike WebGL — MVP FPS Tàctic

FPS tàctic inspirat en Counter-Strike, 100% navegador, amb prioritat en **game feel**: aim precís, físiques consistents, 120+ FPS objectiu.

## Stack obligatori (com demanat)

- **Renderer:** Three.js sobre WebGL2 (sense WebGPU)
- **Físiques:** `@dimforge/rapier3d-compat` (WASM) — character controller càpsula + raycasting hitscan
- **Input:** Pointer Lock API natiu amb `unadjustedMovement: true` i `movementX/Y` raw
- **IA futura:** Yuka (preparat al package.json)

## Arquitectura 3 capes (estricta des del primer commit)

1. **Simulació / Físiques — 64Hz fix**
   - `PhysicsSystem` (Rapier world, character controller)
   - `PlayerController` (CS accel/fricció, salt, crouch, air control)
   - `WeaponSystem` (recoil determinista, bloom, reload, fire rate)
   - `GameLoop` amb accumulator, max 4 substeps, evita spiral of death

2. **Render — interpolat**
   - `RenderSystem` (Three.js, flat shading, sense textures, fog, grid)
   - Interpolació `prevPos` ↔ `currPos` amb `alpha` per evitar jitter
   - Viewmodel low-poly AK, muzzle flash, impactes, targets amb wireframe outline
   - Weapon bob/sway independent del recoil

3. **Input / UI — cada frame**
   - `InputSystem` captura tecles + mouse raw, comanda immutable per tick
   - `CrosshairSystem` DOM dinàmic que reflecteix spread real
   - `HUD` + `DebugOverlay` + `AudioSystem` procedural

Aquesta separació permet afegir reconciliació client-servidor i bots sense reescriure nucli.

## Mecàniques MVP implementades

- **Moviment:** càpsula 0.35m radi, 1.8m alçada, fricció terra 8.0 vs aire, accel terra 20 / aire 12, jump 5.8 m/s, crouch 50% speed, walk (Shift) 2.8 m/s, airControl 0.4. CS-style `accelerate()` i `applyFriction()`.
- **Càmera:** yaw/pitch sense smoothing, clamp -89/89, FOV base 90 configurable, sensibilitat `0.0022 rad/px * mult`. Zoom (RMB) redueix FOV a 65/55 sense canviar sensibilitat efectiva (raw input consistent, com CS).
- **Crosshair:** 4 línies DOM, gap = base + speed*8 + air 10 + spread*400 + shotsFired*1.2. Color verd → groc → vermell segons bloom/tret.
- **Recoil determinista:** patró AK-47 30 bales (vertical climb + zigzag horitzontal), M4, Glock, AWP definits. `recoilIndex` i `recoilAccum` deterministes, mateix input → mateix resultat. Recovery 6.5/s, reset 0.4s.
- **View punch / sway:** `recoilPunch` lerp cap a 0, sway per mouse amb decay `pow(0.01, dt)`, weapon bob sinusoïdal 8Hz quan et mous.
- **Cicle dispar:** RPM per arma (AK 600 → 100ms), spread base 0.0015 + per-shot 0.0028 + moviment/aire, max 0.06, recovery 8/s. Crouch redueix 0.7x.
- **Recàrrega:** temporitzada (AK 2.4s), amb progrés, interrompible canviant arma (futur).
- **Hitscan:** `world.castRayAndGetNormal` des de eyePos, direcció = forward + bloom aleatori dins disc (mulberry32 determinista) + recoil pattern. Detecció targets via collider handle map, headshot multiplier 3.5x. Impactes paret amb CircleGeometry.
- **Mapa bloc-out:** 100x100 terra, parets exteriors, plataformes, cobertures, línies llargues/curtes. Funció `createDust2Approx()` preparada amb layout A/B, mid, tunnels.

## Controls

- WASD moure, SPACE salt, CTRL/C ajupir, SHIFT caminar lent
- MOUSE apunta (Pointer Lock), CLICK ESQ dispara, CLICK DRET zoom
- R recarrega, ESC menú, F3 toggle debug, Shift+M (debug) canviar mapa
- Sliders menú: sensibilitat, FOV, crosshair gap

## Criteris acceptació MVP

- [x] FPS counter, objectiu 120+ (antialias off, no shadows, flat shading, pixelRatio max 2)
- [x] Input sense retard, unadjustedMovement, sense smoothing
- [x] Recoil/sway reproduïble, determinista (seeded rng, patró fix)
- [x] Codi modular: `engine/`, `game/`, `config/`, `ui/`, `utils/` — afegir arma = editar `weapons.js` sense tocar nucli
- [x] Pipeline materials preparat per textures (`setMaterialTexture`)

## Roadmap implementat / futur

1. **MVP jugable en solitari** ✅ AQUESTA ITERACIÓ
2. **Ampliació armes** — definicions ja presents (AK, M4, Glock, AWP), falta viewmodel per cada i sistema switch (1-4)
3. **Granades** — preparat `PhysicsSystem.createDynamicBox`, trajectòria parabòlica amb Rapier
4. **Bots Yuka** — Yuka al package, navmesh per generar des de boxes
5. **Multijugador** — arquitectura ja preparada: fixed tick 64Hz + comandes immutables + interpolació → fàcil afegir servidor autoritatiu, predicció client, reconciliació
6. **Polit final** — textures, il·luminació, Dust II complet, so avançat

## Provar localment

```bash
npm install
npm run dev
# obre http://localhost:5173
# click JUGAR, click canvas per lock, ESC per menú
```

Build producció:
```bash
npm run build
npm run preview
```

## Decisions tècniques clau

- **KinematicCharacterController vs Dynamic:** triat kinematic per control precís CS-style, amb autostep i snapToGround, evita sliding no desitjat de dynamic bodies. Futur: canviar a dynamic si volem push per granades.
- **Fixed 64Hz:** igual que servidors CS:GO, facilita multijugador. Render interpolat evita jitter visual encara que FPS sigui 144+.
- **Recoil separat en 2 capes:** `camera.recoilOffset` (afecta aim real) + `weapon.recoilPunch` (visual viewmodel) + `crosshair gap` (feedback). Això permet view punch sense trencar determinisme.
- **Bloom determinista amb mulberry32:** mateixa seqüència de trets amb mateix moviment → mateixa dispersió, però variació suficient per no ser làser.
- **Sense textures:** `MeshLambert` flat, colors sòlids, wireframe per targets. `Materials.js` centralitza creació, substituir per `MeshStandard` amb map és trivial.
- **Audio procedural:** WebAudio oscillators, sense assets, funcional per MVP, latència mínima.

## Estructura fitxers

```
src/
  engine/
    GameLoop.js        # fixed timestep accumulator
    InputSystem.js     # raw pointer lock
    PhysicsSystem.js   # Rapier world + raycast
    RenderSystem.js    # Three.js + interpolació
  game/
    PlayerController.js
    CameraController.js
    WeaponSystem.js
    MapLoader.js       # bloc-out + Dust2 approx
    Materials.js       # pipeline
    AudioSystem.js
  config/
    settings.js        # TICK_RATE, PLAYER, CAMERA
    weapons.js         # AK, M4, Glock, AWP + patrons
  ui/
    CrosshairSystem.js
    HUD.js
    DebugOverlay.js
  utils/math.js
  main.js              # bootstrap 3 capes
```

## Notes multijugador futur (proposta)

Servidor autoritatiu Node + Rapier (mateix codi física), clients envien comandes cada tick (forward/right/jump + mouseDelta + fire). Servidor simula 64Hz, envia snapshot posicions + events hit. Client fa predicció local i reconciliació (replay comandes no ack). Render ja interpolat, només cal afegir buffer d'estats servidor i lerp. Armes deterministes faciliten anti-cheat server-side.

---

FET AMB ❤️ PER MVP — Iteració 1 completa, jugable, extensible.
