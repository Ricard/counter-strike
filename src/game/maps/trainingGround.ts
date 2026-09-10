import type { Vec3 } from "../types";

export type SurfaceMaterial = "concrete" | "darkConcrete" | "metal" | "cover" | "ground";

export interface MapBlock {
  id: string;
  position: Vec3;
  size: Vec3;
  material: SurfaceMaterial;
  wireframe?: boolean;
}

export interface TargetDefinition {
  id: string;
  position: Vec3;
  yaw: number;
  maxHealth: number;
}

const box = (
  id: string,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  material: SurfaceMaterial,
  wireframe = false,
): MapBlock => ({
  id,
  position: { x, y, z },
  size: { x: sx, y: sy, z: sz },
  material,
  wireframe,
});

export const TRAINING_GROUND = {
  name: "Sector 07 / Killhouse",
  blocks: [
    box("floor", 0, -0.3, 0, 40, 0.6, 48, "ground"),
    box("north-wall", 0, 2.4, -24, 40, 4.8, 0.6, "darkConcrete"),
    box("south-wall-l", -13.5, 2.4, 24, 13, 4.8, 0.6, "darkConcrete"),
    box("south-wall-r", 13.5, 2.4, 24, 13, 4.8, 0.6, "darkConcrete"),
    box("west-wall", -20, 2.4, 0, 0.6, 4.8, 48, "darkConcrete"),
    box("east-wall", 20, 2.4, 0, 0.6, 4.8, 48, "darkConcrete"),

    box("spawn-barrier", 0, 1.1, 13.4, 6.2, 2.2, 0.7, "metal"),
    box("spawn-crate-l", -5.7, 0.75, 16.2, 2.2, 1.5, 2.2, "cover", true),
    box("spawn-crate-r", 6.0, 1.15, 17.0, 2.6, 2.3, 2.6, "cover", true),

    box("left-lane-wall-a", -8.3, 1.7, 7.4, 0.65, 3.4, 10.5, "concrete"),
    box("left-lane-wall-b", -8.3, 1.7, -11.5, 0.65, 3.4, 11.5, "concrete"),
    box("right-lane-wall-a", 8.3, 1.7, 10.0, 0.65, 3.4, 7.0, "concrete"),
    box("right-lane-wall-b", 8.3, 1.7, -8.5, 0.65, 3.4, 14.0, "concrete"),

    box("mid-cover-a", -2.4, 0.75, 7.0, 2.2, 1.5, 2.2, "cover", true),
    box("mid-cover-b", 2.5, 1.15, 2.5, 2.5, 2.3, 1.3, "metal", true),
    box("mid-cover-c", -2.0, 0.55, -3.2, 3.4, 1.1, 1.2, "cover", true),
    box("mid-tall", 3.8, 1.6, -8.6, 1.5, 3.2, 4.0, "metal"),
    box("mid-cover-d", -3.8, 0.9, -13.0, 3.0, 1.8, 2.0, "cover", true),

    box("left-pocket", -14.2, 1.7, 2.0, 6.8, 3.4, 0.65, "concrete"),
    box("left-cover", -14.5, 0.8, -5.0, 2.4, 1.6, 3.2, "cover", true),
    box("right-pocket", 14.0, 1.7, 4.4, 6.8, 3.4, 0.65, "concrete"),
    box("right-cover", 14.0, 1.25, -1.8, 3.2, 2.5, 1.6, "metal", true),

    box("back-platform", 0, 0.35, -19.5, 12, 0.7, 5.5, "concrete"),
    box("back-step", 0, 0.15, -16.3, 5.0, 0.3, 1.1, "concrete"),
    box("back-pillar-l", -7.2, 2.0, -20.0, 1.3, 4.0, 1.3, "metal"),
    box("back-pillar-r", 7.2, 2.0, -20.0, 1.3, 4.0, 1.3, "metal"),
  ] as MapBlock[],
  targets: [
    { id: "alpha", position: { x: 0, y: 1.0, z: 10.7 }, yaw: 0, maxHealth: 68 },
    { id: "bravo", position: { x: -5.4, y: 1.0, z: 4.2 }, yaw: 0.15, maxHealth: 68 },
    { id: "charlie", position: { x: 5.8, y: 1.0, z: -0.2 }, yaw: -0.18, maxHealth: 68 },
    { id: "delta", position: { x: -13.2, y: 1.0, z: -9.5 }, yaw: 0.3, maxHealth: 68 },
    { id: "echo", position: { x: 0.2, y: 1.7, z: -20.0 }, yaw: 0, maxHealth: 102 },
    { id: "foxtrot", position: { x: 13.8, y: 1.0, z: -7.2 }, yaw: -0.3, maxHealth: 68 },
  ] as TargetDefinition[],
} as const;
