import type { InputCommand } from "../types";

export interface LookDelta {
  x: number;
  y: number;
}

export class InputManager {
  private readonly canvas: HTMLCanvasElement;
  private readonly keys = new Set<string>();
  private lookX = 0;
  private lookY = 0;
  private fire = false;
  private aim = false;
  private jumpQueued = false;
  private reloadQueued = false;
  private slotQueued: number | null = null;
  private locked = false;
  private disposed = false;
  private readonly onLockChange: (locked: boolean) => void;

  constructor(canvas: HTMLCanvasElement, onLockChange: (locked: boolean) => void) {
    this.canvas = canvas;
    this.onLockChange = onLockChange;

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.clearButtons);
    document.addEventListener("mousemove", this.handleMouseMove, { passive: true });
    document.addEventListener("mousedown", this.handleMouseDown);
    document.addEventListener("mouseup", this.handleMouseUp);
    document.addEventListener("pointerlockchange", this.handlePointerLockChange);
    document.addEventListener("pointerlockerror", this.handlePointerLockError);
    canvas.addEventListener("contextmenu", this.preventContextMenu);
    canvas.addEventListener("click", this.handleCanvasClick);
  }

  get isLocked() {
    return this.locked;
  }

  get isAiming() {
    return this.aim;
  }

  get isFiring() {
    return this.fire;
  }

  requestLock() {
    if (this.disposed || document.pointerLockElement === this.canvas) return;
    try {
      const request = this.canvas.requestPointerLock({ unadjustedMovement: true });
      request?.catch(() => {
        if (!this.disposed) void this.canvas.requestPointerLock();
      });
    } catch {
      void this.canvas.requestPointerLock();
    }
  }

  consumeLookDelta(): LookDelta {
    const delta = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return delta;
  }

  createCommand(yaw: number, pitch: number): InputCommand {
    const command: InputCommand = {
      forward: Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS")),
      right: Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA")),
      jumpPressed: this.jumpQueued,
      crouch: this.keys.has("ControlLeft") || this.keys.has("ControlRight") || this.keys.has("KeyC"),
      fire: this.fire,
      aim: this.aim,
      reloadPressed: this.reloadQueued,
      weaponSlotPressed: this.slotQueued,
      yaw,
      pitch,
    };

    this.jumpQueued = false;
    this.reloadQueued = false;
    this.slotQueued = null;
    return command;
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.clearButtons);
    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("mousedown", this.handleMouseDown);
    document.removeEventListener("mouseup", this.handleMouseUp);
    document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
    document.removeEventListener("pointerlockerror", this.handlePointerLockError);
    this.canvas.removeEventListener("contextmenu", this.preventContextMenu);
    this.canvas.removeEventListener("click", this.handleCanvasClick);
    this.clearButtons();
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (!this.locked) return;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ControlLeft", "ControlRight"].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat && event.code === "Space") this.jumpQueued = true;
    if (!event.repeat && event.code === "KeyR") this.reloadQueued = true;
    if (!event.repeat && /^Digit[1-5]$/.test(event.code)) {
      this.slotQueued = Number(event.code.slice(5));
    }
    this.keys.add(event.code);
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private handleMouseMove = (event: MouseEvent) => {
    if (!this.locked) return;
    this.lookX += event.movementX;
    this.lookY += event.movementY;
  };

  private handleMouseDown = (event: MouseEvent) => {
    if (!this.locked) return;
    if (event.button === 0) this.fire = true;
    if (event.button === 2) this.aim = true;
  };

  private handleMouseUp = (event: MouseEvent) => {
    if (event.button === 0) this.fire = false;
    if (event.button === 2) this.aim = false;
  };

  private handlePointerLockChange = () => {
    this.locked = document.pointerLockElement === this.canvas;
    if (!this.locked) this.clearButtons();
    this.onLockChange(this.locked);
  };

  private handlePointerLockError = () => {
    this.locked = false;
    this.onLockChange(false);
  };

  private handleCanvasClick = () => {
    if (!this.locked) this.requestLock();
  };

  private clearButtons = () => {
    this.keys.clear();
    this.fire = false;
    this.aim = false;
    this.jumpQueued = false;
    this.reloadQueued = false;
    this.slotQueued = null;
  };

  private preventContextMenu = (event: MouseEvent) => event.preventDefault();
}
