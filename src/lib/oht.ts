/**
 * oht.ts — Overhead Hoist Transport simulation
 *
 * Rail network is built automatically from placed-equipment load-port positions.
 * OHT vehicles navigate the grid with Manhattan (L-shaped) routing and simulate
 * FOUP pick-up / delivery at each load port.
 *
 * Coordinate system: Y-up, matches Three.js / GLTF.
 */

import * as THREE from 'three';
import type { EquipmentType, PlacedEquipment } from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Height of the OHT rail (m).  Keeps clear of the tallest model parts. */
export const RAIL_H = 6.2;

/** OHT travel speed (m/s). */
const OHT_SPEED = 1.6;

// ── FOUP hoist animation ──────────────────────────────────────────────────────

/** World-Y of the docked FOUP centre (table top 1.09 m + FOUP half-height 0.19 m). */
const FOUP_FLOOR_Y  = 1.28;

/** OHT-local Y of the FOUP while the vehicle is travelling. */
const TRAVEL_FOUP_Y = -0.55;

/** OHT-local Y of the FOUP when fully docked at a load port (≈ -4.92 m). */
const DOCKED_FOUP_Y = FOUP_FLOOR_Y - RAIL_H;

/** Duration of the lowering animation (seconds). */
const LOWER_SECS  = 2.2;

/** Dwell time at the load port (seconds). */
const DOCKED_SECS = 1.2;

/** Duration of the raising animation (seconds). */
const RAISE_SECS  = 2.2;

/** OHT-local Y of the hoist drum centre. */
const DRUM_Y = -0.37;

/** Half-height of the FOUP mesh (BoxGeometry height = 0.38 m → half = 0.19). */
const FOUP_HALF_H = 0.19;

/**
 * Load-port offsets in equipment-local frame (before rotation is applied).
 *  dx — forward (+X when rot=0)
 *  dz — lateral
 * Derived from the geometry in gen_models.py.
 */
export const LP_OFFSETS: Record<EquipmentType, Array<{ dx: number; dz: number }>> = {
  EUV:  [{ dx:  8.335, dz: -1.0 }, { dx:  8.335, dz:  0.0 }, { dx:  8.335, dz:  1.0 }],
  CVD:  [{ dx:  3.735, dz: -1.0 }, { dx:  3.735, dz:  1.0 }],
  CMP:  [{ dx: -3.385, dz: -0.45 }, { dx: -3.385, dz:  0.45 }],
  ETCH: [{ dx:  2.585, dz: -1.0 }, { dx:  2.585, dz:  1.0 }],
  SEM:  [{ dx:  1.1,   dz:  0.0 }],
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoadPort {
  eqId:        number;
  railPos:     THREE.Vector3;   // world position projected onto the rail plane
  /**
   * World-space Y-rotation the OHT FOUP mesh must have when docked here so
   * that its door (on the mesh –X face) presses against the equipment wall.
   *
   * Derivation (Three.js R_y convention, door on mesh –X face):
   *   LP on +X local side (dx>0):  facingAngle = –eq.rot
   *   LP on –X local side (dx<0):  facingAngle =  π – eq.rot
   */
  facingAngle: number;
}

export interface OHTVehicleData {
  mesh:          THREE.Group;
  foupMesh:      THREE.Mesh;
  hoistMesh:     THREE.Mesh;    // vertical cable between drum and FOUP top
  waypoints:     THREE.Vector3[];
  wpIdx:         number;
  /**
   * Phase transitions:
   *   wait (initial stagger) → travel → lower → docked → raise → travel → …
   */
  phase:         'travel' | 'wait' | 'lower' | 'docked' | 'raise';
  waitLeft:      number;        // seconds remaining in initial wait stagger
  phaseT:        number;        // elapsed seconds in lower / docked / raise phase
  transferred:   boolean;       // FOUP hand-off done this docked phase
  carrying:      boolean;
  ports:         LoadPort[];       // shared reference — updated on rebuild
  targetPortIdx: number;
  occupiedPorts: Set<number>;      // shared reference — ports currently in use
}

// ─── Load-port computation ────────────────────────────────────────────────────

export function computeLoadPorts(placed: PlacedEquipment[]): LoadPort[] {
  const ports: LoadPort[] = [];
  for (const eq of placed) {
    for (const { dx, dz } of LP_OFFSETS[eq.type]) {
      const c  = Math.cos(eq.rot);
      const s  = Math.sin(eq.rot);
      const wx = eq.x + dx * c - dz * s;
      const wz = eq.z + dx * s + dz * c;
      // FOUP door is on mesh –X face.  To press it against the equipment wall:
      //   LP on +X local side (dx>0): door must face local –X  → facingAngle = –eq.rot
      //   LP on –X local side (dx<0): door must face local +X  → facingAngle =  π – eq.rot
      const facingAngle = dx >= 0 ? -eq.rot : (Math.PI - eq.rot);
      ports.push({
        eqId:        eq.id,
        railPos:     new THREE.Vector3(wx, RAIL_H, wz),
        facingAngle,
      });
    }
  }
  return ports;
}

// ─── Rail grid geometry ───────────────────────────────────────────────────────

/**
 * Build Three.js rail geometry for the given set of load ports.
 *
 * Strategy: snap each LP's X/Z to a 0.5 m grid, collect unique X lanes and
 * Z lanes, then extrude beam segments to span the full equipment bounding box.
 * A rectangular border loop connects the outer edges.
 */
export function buildRailGroup(ports: LoadPort[]): THREE.Group {
  const group = new THREE.Group();
  group.name  = 'oht-rails';
  if (ports.length < 2) return group;

  const snap = (v: number) => Math.round(v * 2) / 2;

  const xs = Array.from(new Set(ports.map(p => snap(p.railPos.x)))).sort((a, b) => a - b);
  const zs = Array.from(new Set(ports.map(p => snap(p.railPos.z)))).sort((a, b) => a - b);

  const margin = 4;
  const minX = xs[0]  - margin, maxX = xs[xs.length - 1] + margin;
  const minZ = zs[0]  - margin, maxZ = zs[zs.length - 1] + margin;
  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;

  const railMat = new THREE.MeshStandardMaterial({
    color:     0x5a7a9a,
    metalness: 0.82,
    roughness: 0.25,
  });

  // ── X-direction beams (one per Z lane) ──
  for (const z of zs) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(spanX, 0.09, 0.15), railMat);
    beam.position.set(midX, RAIL_H, z);
    group.add(beam);
  }

  // ── Z-direction beams (one per X lane) ──
  for (const x of xs) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, spanZ), railMat);
    beam.position.set(x, RAIL_H, midZ);
    group.add(beam);
  }

  // ── Outer rectangular loop ──
  const loopMat = new THREE.MeshStandardMaterial({
    color:     0x405870,
    metalness: 0.82,
    roughness: 0.30,
  });
  const addLoop = (w: number, d: number, x: number, z: number) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, d), loopMat);
    beam.position.set(x, RAIL_H, z);
    group.add(beam);
  };
  addLoop(spanX + margin * 2, 0.15,   midX, minZ);         // south
  addLoop(spanX + margin * 2, 0.15,   midX, maxZ);         // north
  addLoop(0.15, spanZ + margin * 2,   minX, midZ);         // west
  addLoop(0.15, spanZ + margin * 2,   maxX, midZ);         // east

  // ── Ceiling-mount brackets (every ~8 m along each beam) ──
  const bracketMat = new THREE.MeshStandardMaterial({
    color:     0x607888,
    metalness: 0.7,
    roughness: 0.4,
  });
  const CEILING = 6.5;
  const bracketH = CEILING - RAIL_H;

  const addBrackets = (positions: Array<[number, number]>) => {
    for (const [x, z] of positions) {
      const stem = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, bracketH, 0.06),
        bracketMat,
      );
      stem.position.set(x, RAIL_H + bracketH / 2, z);
      group.add(stem);
    }
  };
  const bspacing = 8;
  for (const z of zs) {
    for (let x = minX; x <= maxX; x += bspacing) addBrackets([[x, z]]);
  }
  for (const x of xs) {
    for (let z = minZ; z <= maxZ; z += bspacing) addBrackets([[x, z]]);
  }

  // ── Load-port station markers (amber ring on rail) ──
  const markerMat = new THREE.MeshStandardMaterial({
    color:            0xffb300,
    emissive:         new THREE.Color(0xff8f00),
    emissiveIntensity: 0.9,
    metalness:        0,
    roughness:        0.5,
  });
  for (const port of ports) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.04, 8, 20),
      markerMat,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(port.railPos.x, RAIL_H - 0.10, port.railPos.z);
    group.add(ring);
  }

  return group;
}

// ─── OHT vehicle geometry ─────────────────────────────────────────────────────

function makeOHTMesh(): THREE.Group {
  const g = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xdde2e8, metalness: 0.35, roughness: 0.45,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x1565c0, metalness: 0.2, roughness: 0.6,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, metalness: 0.9, roughness: 0.2,
  });

  // Runner (rides on top of rail beam)
  const runner = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.11, 0.20), darkMat);
  runner.position.y = -0.055;
  g.add(runner);

  // Main body (hangs below runner)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.24, 0.44), bodyMat);
  body.position.y = -0.23;
  g.add(body);

  // Blue accent stripe on front
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.08, 0.03), accentMat);
  stripe.position.set(0, -0.23, 0.225);
  g.add(stripe);

  // Hoist drum (centred at bottom of body)
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.22, 12),
    darkMat,
  );
  drum.rotation.z = Math.PI / 2;
  drum.position.set(0, DRUM_Y, 0);
  g.add(drum);

  // Status LED (green when running)
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x00e676, emissive: new THREE.Color(0x00e676), emissiveIntensity: 2.5,
  });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), ledMat);
  led.position.set(0.26, -0.16, 0.225);
  g.add(led);

  return g;
}

function makeFOUPMesh(): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8b6538, metalness: 0.05, roughness: 0.60,   // warm brown
  });
  // SEMI E47.1 300 mm FOUP: depth=0.26 m (X), height=0.38 m (Y), width=0.40 m (Z).
  // Door is on the –X face; rotation.y is set per-port when docking.
  const foup = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.38, 0.40), mat);
  // Disable frustum culling so the FOUP is never incorrectly hidden
  // when moving between positions (e.g. DOCKED_FOUP_Y → TRAVEL_FOUP_Y).
  foup.frustumCulled = false;
  // Finger grip ridge (darker brown) — spans the width (Z)
  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x7a5830, metalness: 0.05, roughness: 0.55 });
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.04, 0.42), ridgeMat);
  ridge.position.set(0, 0.22, 0);
  ridge.frustumCulled = false;
  foup.add(ridge);
  return foup;
}

/** Thin vertical hoist cable (OHT-local space). Scaled & repositioned each frame. */
function makeHoistCable(): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color:     0x888899,
    metalness: 0.7,
    roughness: 0.3,
  });
  // Base height = 1 m; scale.y is set dynamically each frame.
  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1.0, 0.025), mat);
  cable.visible = false;
  return cable;
}

// ─── Easing ───────────────────────────────────────────────────────────────────

/** Smooth ease-in-out, t ∈ [0,1]. */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─── Hoist cable update ───────────────────────────────────────────────────────

/**
 * Resize and reposition the hoist cable to connect the drum to the FOUP top.
 * Both positions are in OHT-local space.
 */
function updateHoist(v: OHTVehicleData): void {
  const foupTopY  = v.foupMesh.position.y + FOUP_HALF_H;
  const cableLen  = DRUM_Y - foupTopY;            // always > 0 when lowered

  if (cableLen > 0.01) {
    v.hoistMesh.visible   = true;
    v.hoistMesh.scale.y   = cableLen;             // scale the unit-height geometry
    v.hoistMesh.position.y = (DRUM_Y + foupTopY) / 2;
  } else {
    v.hoistMesh.visible = false;
  }
}

// ─── Routing ──────────────────────────────────────────────────────────────────

/** Manhattan (L-shaped) route from `from` to `to`, staying on the grid. */
function route(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
  const EPS = 0.05;
  const sameX = Math.abs(from.x - to.x) < EPS;
  const sameZ = Math.abs(from.z - to.z) < EPS;
  if (sameX || sameZ) return [to.clone()];                 // already aligned
  const turn = new THREE.Vector3(to.x, RAIL_H, from.z);   // X first, then Z
  return [turn, to.clone()];
}

// ─── Port selection ───────────────────────────────────────────────────────────

/**
 * Pick the next load-port index for a vehicle to travel to.
 *
 * Rules (in priority order):
 *  1. Must NOT be in occupiedPorts (port-exclusion lock).
 *  2. Prefer ports ≥ MIN_DIST away to keep travel visually interesting.
 *  3. Fall back to any free port if no far one is found.
 *  4. Last resort: ignore occupancy (prevents deadlock when all ports are busy).
 */
function pickNextPort(v: OHTVehicleData, excludeIdx: number): number {
  const n           = v.ports.length;
  const MIN_DIST    = 4.0;
  const MAX_ATTEMPTS = 20;

  // Pass 1 — free AND far
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = (excludeIdx + 1 + Math.floor(Math.random() * (n - 1))) % n;
    if (!v.occupiedPorts.has(candidate) &&
        v.ports[candidate].railPos.distanceTo(v.mesh.position) >= MIN_DIST) {
      return candidate;
    }
  }

  // Pass 2 — any free port (sequential scan)
  for (let i = 1; i < n; i++) {
    const candidate = (excludeIdx + i) % n;
    if (!v.occupiedPorts.has(candidate)) return candidate;
  }

  // Pass 3 — all ports occupied; pick any far port to avoid deadlock
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = (excludeIdx + 1 + Math.floor(Math.random() * (n - 1))) % n;
    if (v.ports[candidate].railPos.distanceTo(v.mesh.position) >= MIN_DIST) {
      return candidate;
    }
  }

  return (excludeIdx + 1) % n;   // absolute last resort
}

// ─── Vehicle lifecycle ────────────────────────────────────────────────────────

export function makeOHTVehicle(
  ports: LoadPort[],
  startIdx: number,
  occupiedPorts: Set<number>,
): OHTVehicleData {
  const mesh      = makeOHTMesh();
  const foupMesh  = makeFOUPMesh();
  const hoistMesh = makeHoistCable();

  foupMesh.position.set(0, TRAVEL_FOUP_Y, 0);
  foupMesh.visible = true;   // OHT always carries a FOUP (swap at each load port)
  mesh.add(foupMesh);
  mesh.add(hoistMesh);

  const sp     = ports[startIdx];
  mesh.position.copy(sp.railPos);

  const nextIdx   = (startIdx + 1) % ports.length;
  const waypoints = route(sp.railPos, ports[nextIdx].railPos);

  return {
    mesh,
    foupMesh,
    hoistMesh,
    waypoints,
    wpIdx: 0,
    phase:        'wait',
    waitLeft:     startIdx * 1.8,   // stagger initial departure times
    phaseT:       0,
    transferred:  false,
    carrying:      true,             // always carrying — OHT swaps FOUP at each port
    ports,
    targetPortIdx: nextIdx,
    occupiedPorts,
  };
}

export function tickOHT(v: OHTVehicleData, delta: number): void {

  // ── Initial stagger wait ──────────────────────────────────────────────────
  if (v.phase === 'wait') {
    v.waitLeft -= delta;
    if (v.waitLeft > 0) return;

    // Stagger expired → begin travelling to first target port
    v.phase = 'travel';
    return;
  }

  // ── Travel ───────────────────────────────────────────────────────────────
  if (v.phase === 'travel') {
    // Defensive: always keep FOUP visibility in sync with carrying state.
    // This guards against any edge-case where visible was set incorrectly
    // during a previous phase transition.
    v.foupMesh.visible = v.carrying;

    const target = v.waypoints[v.wpIdx];
    const diff   = target.clone().sub(v.mesh.position);
    const dist   = diff.length();
    const step   = OHT_SPEED * delta;

    if (step >= dist) {
      v.mesh.position.copy(target);
      v.wpIdx++;
      if (v.wpIdx >= v.waypoints.length) {
        // Arrived above target port.
        // If another vehicle is already using this port, re-route immediately.
        if (v.occupiedPorts.has(v.targetPortIdx)) {
          const alt = pickNextPort(v, v.targetPortIdx);
          v.targetPortIdx = alt;
          v.waypoints     = route(v.mesh.position.clone(), v.ports[alt].railPos);
          v.wpIdx         = 0;
          // Stay in travel phase — no return so we fall through to the next tick
        } else {
          // Port is free — lock it and begin lowering sequence
          v.occupiedPorts.add(v.targetPortIdx);
          v.phase       = 'lower';
          v.phaseT      = 0;
          v.transferred = false;
          v.foupMesh.visible    = true;
          v.foupMesh.position.y = TRAVEL_FOUP_Y;
          // Orient FOUP so its door (–X face) presses against the equipment wall.
          // foupMesh is a child of the vehicle group, so compensate for vehicle rotation:
          //   foupMesh.rotation.y (local) = facingAngle (world) – vehicle.rotation.y
          const fa = v.ports[v.targetPortIdx].facingAngle;
          v.foupMesh.rotation.y = fa - v.mesh.rotation.y;
          updateHoist(v);
        }
      }
    } else {
      const dir = diff.divideScalar(dist);
      v.mesh.position.addScaledVector(dir, step);
      v.mesh.rotation.y = Math.atan2(dir.x, dir.z);   // face direction of travel
    }
    return;
  }

  // ── Lower FOUP ───────────────────────────────────────────────────────────
  if (v.phase === 'lower') {
    v.phaseT += delta;
    const t  = Math.min(v.phaseT / LOWER_SECS, 1);
    const et = easeInOut(t);
    v.foupMesh.position.y = TRAVEL_FOUP_Y + (DOCKED_FOUP_Y - TRAVEL_FOUP_Y) * et;
    updateHoist(v);

    if (t >= 1) {
      v.foupMesh.position.y = DOCKED_FOUP_Y;
      v.phase  = 'docked';
      v.phaseT = 0;
    }
    return;
  }

  // ── Docked at load port ───────────────────────────────────────────────────
  if (v.phase === 'docked') {
    v.phaseT += delta;

    // FOUP swap occurs at 45 % of dwell time.
    // The OHT always carries a FOUP (it exchanges the one at the load port),
    // so carrying stays true — only the transferred flag is set to mark the
    // moment of the hand-off for any future logic that needs it.
    if (!v.transferred && v.phaseT / DOCKED_SECS >= 0.45) {
      v.transferred = true;
      // carrying remains true: the outgoing FOUP is immediately replaced
      // by the one waiting at the load port.
    }

    if (v.phaseT >= DOCKED_SECS) {
      v.phase  = 'raise';
      v.phaseT = 0;
    }
    return;
  }

  // ── Raise FOUP ───────────────────────────────────────────────────────────
  if (v.phase === 'raise') {
    v.phaseT += delta;
    const t  = Math.min(v.phaseT / RAISE_SECS, 1);
    const et = easeInOut(t);
    v.foupMesh.position.y = DOCKED_FOUP_Y + (TRAVEL_FOUP_Y - DOCKED_FOUP_Y) * et;
    updateHoist(v);

    if (t >= 1) {
      // Fully raised — unlock the port, finalise state and pick next port
      v.foupMesh.position.y = TRAVEL_FOUP_Y;
      v.foupMesh.visible    = v.carrying;
      v.foupMesh.rotation.y = 0;   // reset to neutral; vehicle rotation handles travel orientation
      v.hoistMesh.visible   = false;

      // Release the port so other vehicles can use it
      v.occupiedPorts.delete(v.targetPortIdx);

      // Pick next free port (favours far ports; avoids occupied ones)
      const next      = pickNextPort(v, v.targetPortIdx);
      v.targetPortIdx = next;
      v.waypoints     = route(v.mesh.position.clone(), v.ports[next].railPos);
      v.wpIdx         = 0;
      v.phase         = 'travel';
    }
    return;
  }
}

// ─── OHTSystem ────────────────────────────────────────────────────────────────

export class OHTSystem {
  private readonly scene:  THREE.Scene;
  private readonly group:  THREE.Group;
  private vehicles:      OHTVehicleData[] = [];
  private ports:         LoadPort[]       = [];
  private occupiedPorts: Set<number>      = new Set();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'oht-system';
    scene.add(this.group);
  }

  rebuild(placed: PlacedEquipment[], vehicleCount?: number): void {
    // Remove old children (rails + vehicles)
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    this.vehicles = [];

    if (placed.length === 0) return;

    const ports = computeLoadPorts(placed);
    if (ports.length < 2) return;

    // Rails
    this.group.add(buildRailGroup(ports));

    // Shared port-occupancy set — prevents two vehicles using the same port
    const occupiedPorts = new Set<number>();
    // Store references for getBusyEqIds()
    this.ports         = ports;
    this.occupiedPorts = occupiedPorts;

    // Vehicles: use explicit count if given, else ~1 per 3 load ports (2–6)
    const count = vehicleCount ?? Math.min(Math.max(2, Math.ceil(ports.length / 3)), 6);
    for (let i = 0; i < count; i++) {
      const startIdx = Math.floor((i * ports.length) / count);
      const v = makeOHTVehicle(ports, startIdx, occupiedPorts);
      this.group.add(v.mesh);
      this.vehicles.push(v);
    }
  }

  update(delta: number): void {
    this.vehicles.forEach((v) => tickOHT(v, delta));
  }

  /**
   * Returns the set of equipment IDs that currently have a vehicle in the
   * lower / docked / raise phase at one of their load ports.
   *
   * Implementation note: reads each vehicle's `phase` directly instead of
   * consulting `occupiedPorts`.  This is more robust during the multi-rebuild
   * sequence that occurs when the demo layout is first spawned (each of the 9
   * spawnModel() calls triggers a rebuild() that replaces occupiedPorts with a
   * new empty Set, which can cause a reference-mismatch on the very first
   * docking event).
   */
  getBusyEqIds(): Set<number> {
    const busy = new Set<number>();
    this.vehicles.forEach((v) => {
      if (v.phase === 'lower' || v.phase === 'docked' || v.phase === 'raise') {
        const port = v.ports[v.targetPortIdx];
        if (port) busy.add(port.eqId);
      }
    });
    return busy;
  }

  dispose(): void {
    this.scene.remove(this.group);
  }
}
