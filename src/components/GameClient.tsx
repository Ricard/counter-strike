"use client";

import { useEffect, useRef, useState } from "react";
import type { GameEngine as GameEngineType } from "@/game/GameEngine";
import type { HudTelemetry } from "@/game/types";

const INITIAL_HUD: HudTelemetry = {
  fps: 0,
  frameMs: 0,
  ammo: 30,
  reserve: 90,
  reloading: false,
  reloadProgress: 0,
  speed: 0,
  grounded: false,
  score: 0,
  streak: 0,
  activeTargets: 6,
  spreadPixels: 4,
  scoped: false,
};

export default function GameClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngineType | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const hitMarkerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"booting" | "ready" | "error">("booting");
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const [hud, setHud] = useState(INITIAL_HUD);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const boot = async () => {
      try {
        const { GameEngine } = await import("@/game/GameEngine");
        const engine = await GameEngine.create(canvas, {
          onReady: () => {
            if (!cancelled) setStatus("ready");
          },
          onLockChange: (isLocked) => {
            if (!cancelled) setLocked(isLocked);
          },
          onHud: (telemetry) => {
            if (!cancelled) setHud(telemetry);
          },
          onFrame: (telemetry) => {
            if (cancelled) return;
            crosshairRef.current?.style.setProperty("--cross-gap", `${telemetry.spreadPixels.toFixed(2)}px`);
            const root = rootRef.current;
            if (root) {
              root.dataset.scoped = String(telemetry.scoped);
              root.dataset.firing = String(telemetry.firing);
              root.dataset.reloading = String(telemetry.reloading);
            }
            if (telemetry.hitPulse && hitMarkerRef.current) {
              hitMarkerRef.current.animate(
                [
                  { opacity: 1, transform: "translate(-50%, -50%) scale(.7)" },
                  { opacity: 0, transform: "translate(-50%, -50%) scale(1.35)" },
                ],
                { duration: 155, easing: "cubic-bezier(.2,.8,.2,1)" },
              );
            }
          },
          onError: (message) => {
            if (!cancelled) {
              setError(message);
              setStatus("error");
              setLocked(false);
            }
          },
        });
        if (cancelled) engine.dispose();
        else engineRef.current = engine;
      } catch (bootError) {
        if (!cancelled) {
          setError(bootError instanceof Error ? bootError.message : "No s’ha pogut iniciar el motor");
          setStatus("error");
        }
      }
    };

    void boot();
    return () => {
      cancelled = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const enterGame = () => engineRef.current?.requestPointerLock();
  const fpsClass = hud.fps >= 100 ? "excellent" : hud.fps >= 60 ? "good" : "warn";

  return (
    <main ref={rootRef} className="game-shell" data-scoped="false" data-firing="false" data-reloading="false">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Sector 07 tactical FPS viewport" />

      <div className="world-vignette" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <div className="scope-layer" aria-hidden="true">
        <span className="scope-line scope-line-h" />
        <span className="scope-line scope-line-v" />
        <span className="scope-ring" />
      </div>

      {status === "ready" && (
        <div className={`hud-layer ${locked ? "is-live" : "is-paused"}`}>
          <header className="hud-top">
            <section className="brand-lockup" aria-label="Game title">
              <span className="brand-mark">V//</span>
              <div>
                <strong>VECTOR STRIKE</strong>
                <small>PROTOCOL · 07</small>
              </div>
            </section>

            <section className="mission-chip">
              <small>EXERCICI ACTIU</small>
              <strong>SECTOR 07 — KILLHOUSE</strong>
              <span><i /> DIANES {hud.activeTargets}/6</span>
            </section>

            <section className="performance-panel">
              <div>
                <small>RENDER</small>
                <strong className={fpsClass}>{hud.fps || "—"} <em>FPS</em></strong>
              </div>
              <div>
                <small>FRAME</small>
                <strong>{hud.frameMs ? hud.frameMs.toFixed(1) : "—"} <em>MS</em></strong>
              </div>
              <span className="tick-badge">64 TICK</span>
            </section>
          </header>

          <aside className="radar" aria-label="Mapa tàctic">
            <div className="radar-head"><span>MAPA TÀCTIC</span><b>N</b></div>
            <div className="radar-map">
              <span className="radar-lane lane-a" />
              <span className="radar-lane lane-b" />
              <span className="radar-lane lane-c" />
              <i className="radar-player" />
              <i className="radar-ping ping-one" />
              <i className="radar-ping ping-two" />
              <i className="radar-ping ping-three" />
            </div>
            <small>SIM LOCAL · 0% PÈRDUA</small>
          </aside>

          <div ref={crosshairRef} className="crosshair" aria-hidden="true">
            <span className="cross-line cross-top" />
            <span className="cross-line cross-right" />
            <span className="cross-line cross-bottom" />
            <span className="cross-line cross-left" />
            <span className="cross-dot" />
          </div>
          <div ref={hitMarkerRef} className="hit-marker" aria-hidden="true">
            <i /><i /><i /><i />
          </div>

          <section className="hud-bottom-left">
            <div className="vital-block">
              <span className="vital-icon">+</span>
              <div><small>SALUT</small><strong>100</strong></div>
            </div>
            <div className="vital-block armor">
              <span className="shield-icon" />
              <div><small>ARMADURA</small><strong>100</strong></div>
            </div>
            <div className="movement-readout">
              <small>VELOCITAT</small>
              <strong>{Math.round(hud.speed * 18)} <em>u/s</em></strong>
              <span className={hud.grounded ? "grounded" : "airborne"}>
                {hud.grounded ? "CONTACTE" : "AIRE"}
              </span>
            </div>
          </section>

          <section className="score-panel">
            <small>PUNTUACIÓ D’ENTRENAMENT</small>
            <strong>{hud.score.toString().padStart(6, "0")}</strong>
            <span className={hud.streak > 1 ? "streak active" : "streak"}>
              RATXA ×{Math.max(1, hud.streak)}
            </span>
          </section>

          <section className="weapon-panel">
            <div className="weapon-name">
              <span>PRIMÀRIA / 01</span>
              <strong>VX-7</strong>
              <small>AUTO · 5.56</small>
            </div>
            <div className="ammo-count">
              <strong className={hud.ammo <= 7 ? "low" : ""}>{hud.ammo.toString().padStart(2, "0")}</strong>
              <span>/ {hud.reserve.toString().padStart(2, "0")}</span>
            </div>
            <div className={`reload-track ${hud.reloading ? "active" : ""}`}>
              <i style={{ transform: `scaleX(${hud.reloadProgress})` }} />
              <span>{hud.reloading ? "RECARREGANT" : "ARMA PREPARADA"}</span>
            </div>
          </section>

          <div className="input-hint">R <span>RECARREGA</span> · RMB <span>MIRA</span> · ESC <span>PAUSA</span></div>
        </div>
      )}

      {(!locked || status !== "ready") && (
        <section className="entry-layer" aria-live="polite">
          <div className="entry-grid" />
          <div className="entry-panel">
            <div className="entry-kicker">
              <span>ITERACIÓ 01</span>
              <i />
              <span>MVP JUGABLE</span>
            </div>
            <p className="entry-eyebrow">VECTOR STRIKE // TACTICAL SIMULATION</p>
            <h1>SECTOR<br /><em>07</em></h1>
            <p className="entry-copy">
              Entra al killhouse. Domina el moviment, controla el patró del VX-7 i elimina les sis dianes reactives.
            </p>

            {status === "booting" && (
              <div className="boot-status"><i /><span>INICIALITZANT RAPIER + WEBGL2</span></div>
            )}
            {status === "error" && (
              <div className="error-status"><strong>ERROR DEL MOTOR</strong><span>{error}</span></div>
            )}
            {status === "ready" && (
              <button className="deploy-button" type="button" onClick={enterGame}>
                <span>ENTRAR AL KILLHOUSE</span>
                <b>↗</b>
              </button>
            )}

            <div className="controls-grid">
              <div><kbd>WASD</kbd><span>MOVIMENT</span></div>
              <div><kbd>RATOLÍ</kbd><span>APUNTAR</span></div>
              <div><kbd>LMB</kbd><span>DISPARAR</span></div>
              <div><kbd>RMB</kbd><span>SCOPE</span></div>
              <div><kbd>ESPAI</kbd><span>SALTAR</span></div>
              <div><kbd>CTRL / C</kbd><span>AJUPIR-SE</span></div>
              <div><kbd>R</kbd><span>RECARREGAR</span></div>
              <div><kbd>1</kbd><span>CANCEL·LAR</span></div>
            </div>
          </div>
          <footer className="entry-footer">
            <span>WEBGL2</span><span>RAPIER 3D</span><span>64 HZ FIXED SIM</span>
            <b>ESCRIPTORI + RATOLÍ RECOMANATS</b>
          </footer>
        </section>
      )}
    </main>
  );
}
