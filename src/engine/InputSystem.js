// InputSystem - capa Input/UI, captura cada frame, aplica com a comandes a simulació
// Pointer Lock amb unadjustedMovement + movementX/Y

export class InputSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseButtons = new Set();
    this.mouseDelta = { x: 0, y: 0 };
    this.wheelDelta = 0;
    this.pointerLocked = false;

    this.sensitivity = 1.0; // multiplier
    this._baseSensitivity = 0.0022; // rad/px

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onContextMenu = (e) => e.preventDefault();

    this._setupListeners();

    this._commandBuffer = []; // per a futura reconciliació multijugador
    this._tick = 0;
  }

  _setupListeners() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: true });
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    this.canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    this.canvas.removeEventListener('contextmenu', this._onContextMenu);
  }

  _onKeyDown(e) {
    // Evitar repetir si ja està pressionada? Set ho gestiona
    if (e.code === 'Tab') e.preventDefault();
    this.keys.add(e.code.toLowerCase());
    // Per debug no propagar si pointer locked
    if (this.pointerLocked && ['space','keyw','keya','keys','keyd'].includes(e.code.toLowerCase())) {
      // prevent scroll
    }
  }

  _onKeyUp(e) {
    this.keys.delete(e.code.toLowerCase());
  }

  _onMouseDown(e) {
    this.mouseButtons.add(e.button);
    // Si no està bloquejat, no disparem encara, deixem que el click demani lock
    if (!this.pointerLocked && e.button === 0) {
      // El requestLock es farà des del GameLoop/UI, no aquí per evitar doble
    }
  }

  _onMouseUp(e) {
    this.mouseButtons.delete(e.button);
  }

  _onMouseMove(e) {
    if (!this.pointerLocked) return;
    // Raw input: movementX/Y, amb unadjustedMovement si suportat
    // movementX/Y ja són sense acceleració OS quan unadjustedMovement true
    this.mouseDelta.x += e.movementX || 0;
    this.mouseDelta.y += e.movementY || 0;
  }

  _onWheel(e) {
    this.wheelDelta += e.deltaY;
  }

  _onPointerLockChange() {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  }

  async requestPointerLock() {
    if (this.pointerLocked) return true;
    try {
      // unadjustedMovement evita acceleració del SO (Chrome 92+)
      await this.canvas.requestPointerLock({ unadjustedMovement: true });
      return true;
    } catch (err) {
      // fallback sense opció
      try {
        await this.canvas.requestPointerLock();
        return true;
      } catch (e2) {
        console.warn('PointerLock failed', e2);
        return false;
      }
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // Crida cada frame de render per capturar input, retorna comanda
  // Comanda = snapshot immutable per simulació
  getFrameCommand() {
    const cmd = {
      tick: this._tick++,
      forward: (this.keys.has('keyw') || this.keys.has('arrowup') ? 1 : 0) + (this.keys.has('keys') || this.keys.has('arrowdown') ? -1 : 0),
      right: (this.keys.has('keyd') || this.keys.has('arrowright') ? 1 : 0) + (this.keys.has('keya') || this.keys.has('arrowleft') ? -1 : 0),
      jump: this.keys.has('space'),
      crouch: this.keys.has('controlleft') || this.keys.has('controlright') || this.keys.has('keyc'),
      walk: this.keys.has('shiftleft') || this.keys.has('shiftright'),
      reload: this.keys.has('keyr'),
      fire: this.mouseButtons.has(0) && this.pointerLocked,
      ads: this.mouseButtons.has(2) && this.pointerLocked,
      mouseDelta: { x: this.mouseDelta.x, y: this.mouseDelta.y },
      wheel: this.wheelDelta,
      timestamp: performance.now()
    };
    // Reset acumuladors després de capturar
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    this.wheelDelta = 0;
    // Clear one-shot keys: reload hauria de ser edge, però ho gestionem amb estat
    // Per ara deixem que el consumidor detecti edge
    return cmd;
  }

  isKeyDown(code) {
    return this.keys.has(code.toLowerCase());
  }

  setSensitivity(mult) {
    this.sensitivity = mult;
  }

  getEffectiveSensitivity() {
    return this._baseSensitivity * this.sensitivity;
  }
}
