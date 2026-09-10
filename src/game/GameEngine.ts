import RAPIER from "@dimforge/rapier3d-compat";
import { FIXED_TIMESTEP, MAX_FRAME_DELTA, VIEW_CONFIG } from "./config";
import { InputManager, type LookDelta } from "./input/InputManager";
import { GameRenderer } from "./render/GameRenderer";
import { GameSimulation } from "./simulation/GameSimulation";
import type { FrameTelemetry, HudTelemetry } from "./types";

export interface GameEngineCallbacks {
  onReady: () => void;
  onLockChange: (locked: boolean) => void;
  onHud: (telemetry: HudTelemetry) => void;
  onFrame: (telemetry: FrameTelemetry) => void;
  onError: (message: string) => void;
}

let rapierInitialization: Promise<void> | null = null;

const initializeRapier = () => {
  if (!rapierInitialization) rapierInitialization = RAPIER.init();
  return rapierInitialization;
};

export class GameEngine {
  private readonly callbacks: GameEngineCallbacks;
  private readonly input: InputManager;
  private readonly simulation: GameSimulation;
  private readonly visual: GameRenderer;
  private animationFrame = 0;
  private lastFrameTime = 0;
  private accumulator = 0;
  private yaw = 0;
  private pitch = 0;
  private disposed = false;
  private fps = 0;
  private frameMs = 0;
  private fpsFrames = 0;
  private fpsElapsed = 0;
  private hudElapsed = 0;

  private constructor(canvas: HTMLCanvasElement, callbacks: GameEngineCallbacks) {
    this.callbacks = callbacks;
    this.visual = new GameRenderer(canvas);
    this.simulation = new GameSimulation();
    this.input = new InputManager(canvas, callbacks.onLockChange);
  }

  static async create(canvas: HTMLCanvasElement, callbacks: GameEngineCallbacks) {
    await initializeRapier();
    const engine = new GameEngine(canvas, callbacks);
    engine.start();
    callbacks.onReady();
    return engine;
  }

  requestPointerLock() {
    this.input.requestLock();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.input.dispose();
    this.simulation.dispose();
    this.visual.dispose();
  }

  private start() {
    this.lastFrameTime = performance.now();
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    try {
      const rawDelta = (now - this.lastFrameTime) / 1000;
      const delta = Math.min(MAX_FRAME_DELTA, Math.max(0, rawDelta));
      this.lastFrameTime = now;
      let lookDelta: LookDelta = { x: 0, y: 0 };

      if (this.input.isLocked) {
        lookDelta = this.input.consumeLookDelta();
        this.yaw -= lookDelta.x * VIEW_CONFIG.sensitivity;
        this.pitch = Math.max(
          VIEW_CONFIG.minPitch,
          Math.min(VIEW_CONFIG.maxPitch, this.pitch - lookDelta.y * VIEW_CONFIG.sensitivity),
        );
        this.simulation.setView(this.yaw, this.pitch);
        this.accumulator += delta;

        let safetySteps = 0;
        while (this.accumulator >= FIXED_TIMESTEP && safetySteps < 8) {
          const command = this.input.createCommand(this.yaw, this.pitch);
          this.simulation.step(command);
          this.accumulator -= FIXED_TIMESTEP;
          safetySteps += 1;
        }
        if (safetySteps === 8) this.accumulator = 0;
      } else {
        this.accumulator = 0;
      }

      const snapshot = this.simulation.getSnapshot();
      const events = this.simulation.drainEvents();
      const hitPulse = events.some((event) => event.type === "shot" && event.hitTarget);
      this.visual.handleEvents(events);
      this.visual.render(
        snapshot,
        this.accumulator / FIXED_TIMESTEP,
        delta,
        lookDelta,
        this.input.isAiming,
      );

      const viewportHeight = Math.max(1, this.visual.renderer.domElement.clientHeight);
      const activeFov = this.input.isAiming ? VIEW_CONFIG.scopedFov : VIEW_CONFIG.fov;
      const focalPixels = viewportHeight / (2 * Math.tan((activeFov * Math.PI) / 360));
      const spreadPixels = Math.min(54, 4 + Math.tan(snapshot.weapon.spread) * focalPixels);

      this.callbacks.onFrame({
        spreadPixels,
        firing: this.input.isFiring,
        reloading: snapshot.weapon.reloading,
        scoped: this.input.isAiming,
        hitPulse,
      });

      this.updatePerformance(delta, snapshot, spreadPixels);
      this.animationFrame = requestAnimationFrame(this.frame);
    } catch (error) {
      this.callbacks.onError(error instanceof Error ? error.message : "Error inesperat del motor");
      this.dispose();
    }
  };

  private updatePerformance(
    delta: number,
    snapshot: ReturnType<GameSimulation["getSnapshot"]>,
    spreadPixels: number,
  ) {
    this.fpsFrames += 1;
    this.fpsElapsed += delta;
    this.hudElapsed += delta;
    this.frameMs = this.frameMs === 0 ? delta * 1000 : this.frameMs * 0.88 + delta * 1000 * 0.12;

    if (this.fpsElapsed >= 0.35) {
      this.fps = Math.round(this.fpsFrames / this.fpsElapsed);
      this.fpsFrames = 0;
      this.fpsElapsed = 0;
    }

    if (this.hudElapsed < 0.1) return;
    this.hudElapsed = 0;
    this.callbacks.onHud({
      fps: this.fps,
      frameMs: this.frameMs,
      ammo: snapshot.weapon.ammo,
      reserve: snapshot.weapon.reserve,
      reloading: snapshot.weapon.reloading,
      reloadProgress: snapshot.weapon.reloadProgress,
      speed: snapshot.speed,
      grounded: snapshot.grounded,
      score: snapshot.score,
      streak: snapshot.streak,
      activeTargets: snapshot.targets.filter((target) => target.active).length,
      spreadPixels,
      scoped: this.input.isAiming,
    });
  }
}
