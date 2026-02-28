/**
 * EUV Lithography Model (ASML NXE-style)
 *
 * Layout (top view, X-axis = length, Z-axis = width):
 *
 *  LPS | beam-duct | Main Frame (POB + reticle stage) | Wafer Stage | EFEM
 *  ←──────────────────── 13.5 m ──────────────────────────────────────────→
 */
import * as THREE from 'three';
import { B, C, add } from './helpers';

export function makeEUV(): THREE.Group {
  const g = new THREE.Group();
  g.userData.type = 'EUV';

  const H = 2.4; // main frame height

  // ── Main frame ──────────────────────────────────────────────
  add(g, B(8.5, H, 3.4, '#37474f', { shininess: 50 }), -1, H / 2, 0);
  // Panel detail lines
  for (const z of [-0.5, 0.5]) {
    add(g, B(8.5, 0.05, 0.01, '#455a64'), -1, H * 0.7, z * 1.6);
  }

  // ── Light Source Pod (LPS) ───────────────────────────────────
  add(g, B(3.8, 2.6, 3.0, '#263238', { shininess: 40 }), -6.5, 1.3, 0);
  // LPS top panel
  add(g, B(3.8, 0.15, 3.0, '#37474f'), -6.5, 2.68, 0);
  // CO₂ laser output window
  add(g, B(0.05, 0.4, 0.4, '#01579b', {
    shininess: 200,
    emissive: new THREE.Color('#003366'),
    emissiveIntensity: 0.6,
  }), -4.6, 1.6, 0);
  // LPS→main beam duct
  add(g, B(1.0, 0.5, 0.5, '#455a64'), -4.0, 1.6, 0);
  // Tin target nozzle
  add(g, C(0.08, 0.08, 0.8, 8, '#546e7a'), -5.2, 1.6, 0, 0, 0, Math.PI / 2);
  // LPS leveling feet
  for (const [lx, lz] of [[-5.8, -1.3], [-7.2, -1.3], [-5.8, 1.3], [-7.2, 1.3]] as [number,number][]) {
    add(g, C(0.12, 0.15, 0.08, 8, '#607d8b'), lx, 0.04, lz);
  }

  // ── Illumination connection ──────────────────────────────────
  add(g, B(0.8, 1.4, 0.8, '#455a64'), -2.5, H + 0.7, 0);
  add(g, C(0.35, 0.35, 0.9, 16, '#546e7a'), -2.5, H + 1.65, 0);

  // ── Projection Optics Box (POB) ──────────────────────────────
  add(g, B(2.8, 2.0, 2.6, '#4a5568', { shininess: 60 }), 0.5, H + 1.0, 0);
  add(g, C(0.6, 0.6, 1.8, 24, '#5a6a7a', { shininess: 70 }), 0.5, H + 0.9, 0);
  add(g, B(1.0, 0.5, 1.0, '#37474f'), 0.5, H + 2.2, 0);
  // Column ribs
  for (const z of [-0.9, 0, 0.9]) {
    add(g, B(0.1, 0.3, 0.1, '#546e7a'), 0.5, H + 2.0, z);
  }

  // ── Reticle Stage ────────────────────────────────────────────
  add(g, B(3.4, 0.7, 2.8, '#37474f'), 0.4, H + 2.65, 0);
  add(g, B(1.8, 0.12, 1.6, '#546e7a', { shininess: 80 }), 0.4, H + 3.02, 0);
  add(g, B(0.15, 0.15, 1.8, '#607d8b'), 0.4, H + 2.95, 0, 0, Math.PI / 2);
  // Reticle library (SMIF pod)
  add(g, B(1.4, 1.8, 1.4, '#2d3748'), 2.2, H + 2.2, 0.8);
  add(g, B(0.05, 1.4, 1.2, '#1a202c'), 2.95, H + 2.2, 0.8);

  // ── Wafer Stage ──────────────────────────────────────────────
  add(g, B(4.2, 1.6, 3.4, '#2d3748', { shininess: 60 }), 4.0, 0.8, 0);
  // Granite-like stage platform
  add(g, B(2.4, 0.18, 2.4, '#78909c', { shininess: 100 }), 4.0, 1.69, 0);
  // Wafer chuck
  add(g, C(0.16, 0.16, 0.05, 32, '#90a4ae', { shininess: 120 }), 4.0, 1.78, 0);
  // Interferometer mirror blocks
  for (const [ox, oz] of [[-1, 1], [1, 1], [1, -1], [-1, -1]] as [number,number][]) {
    add(g, B(0.12, 0.12, 0.12, '#546e7a', { shininess: 80 }), 4.0 + ox, 1.85, oz);
  }
  // Linear motor rails
  for (const [rx, rz] of [[3.0, -1.4], [5.0, -1.4], [3.0, 1.4], [5.0, 1.4]] as [number,number][]) {
    add(g, B(0.15, 0.15, 3.2, '#455a64'), rx, 1.68, rz);
  }

  // ── EFEM (Equipment Front End Module) ────────────────────────
  add(g, B(2.6, 2.2, 3.4, '#37474f', { shininess: 40 }), 6.9, 1.1, 0);
  // ATM robot arm housing
  add(g, B(1.8, 1.0, 1.8, '#2d3748'), 6.9, 0.8, 0.2);
  // ATM robot
  add(g, C(0.18, 0.18, 0.8, 12, '#455a64'), 6.9, 0.6, 0);
  add(g, B(0.6, 0.06, 0.08, '#546e7a'), 7.2, 0.9, 0);
  add(g, B(0.4, 0.06, 0.08, '#607d8b'), 7.6, 0.9, 0);
  add(g, C(0.14, 0.14, 0.03, 16, '#78909c', { shininess: 120 }), 7.9, 0.9, 0);
  // FOUP load ports ×3
  for (const [i, z] of [[-1.0], [0], [1.0]].map((v, i) => [i, v[0]] as [number, number])) {
    add(g, B(0.7, 0.72, 0.42, '#1a202c'), 8.3, 0.62, z);
    add(g, C(0.22, 0.22, 0.06, 24, '#0d1117'), 8.62, 0.62, z, Math.PI / 2);
    add(g, C(0.045, 0.045, 0.04, 8, '#22c55e', {
      emissive: new THREE.Color('#14532d'), emissiveIntensity: 0.8,
    }), 8.28, 0.62 + 0.42, z, Math.PI / 2);
    add(g, B(0.04, 0.6, 0.38, '#263238'), 8.0, 0.62, z);
    void i; // suppress unused var
  }

  // ── Vacuum pumps (rear ×4) ────────────────────────────────────
  for (const vx of [-5, -2.5, 0, 2.5]) {
    add(g, C(0.28, 0.32, 1.4, 12, '#263238'), vx, 0.7, -2.2);
    add(g, C(0.18, 0.28, 0.28, 12, '#37474f'), vx, 1.54, -2.2);
    add(g, C(0.05, 0.05, 0.5, 8, '#455a64'), vx + 0.25, 1.2, -1.95);
  }

  // ── Chillers (rear) ──────────────────────────────────────────
  for (const cx of [1, 3.5]) {
    add(g, B(1.8, 1.9, 0.9, '#263238'), cx, 0.95, -2.3);
    for (let i = 0; i < 5; i++) {
      add(g, B(1.6, 0.04, 0.02, '#1a202c'), cx, 0.3 + i * 0.32, -1.88);
    }
  }

  // ── Gas cabinet ──────────────────────────────────────────────
  add(g, B(0.9, 2.3, 0.9, '#37474f'), -6.2, 1.15, -1.4);
  add(g, B(0.02, 2.0, 0.8, '#2d3748'), -5.75, 1.2, -1.4);

  // ── Control rack (right rear) ────────────────────────────────
  add(g, B(0.85, 2.2, 0.9, '#263238'), 8.0, 1.1, -1.35);
  for (let i = 0; i < 5; i++) {
    add(g, B(0.72, 0.16, 0.02, '#1565c0', {
      emissive: new THREE.Color('#0d3070'), emissiveIntensity: 0.4,
    }), 8.0, 0.28 + i * 0.4, -0.92);
    add(g, B(0.60, 0.10, 0.01, '#1e88e5', {
      emissive: new THREE.Color('#0d47a1'), emissiveIntensity: 0.6,
    }), 8.0, 0.28 + i * 0.4, -0.91);
  }

  // ── Cable trays ──────────────────────────────────────────────
  add(g, B(10.0, 0.14, 0.36, '#37474f'), -1, H + 0.07, 1.6);
  add(g, B(10.0, 0.14, 0.36, '#37474f'), -1, H + 0.07, -1.6);

  // ── Signal tower light ───────────────────────────────────────
  add(g, C(0.05, 0.05, 0.7, 8, '#37474f'), 6.5, H + 0.35, 1.5);
  add(g, C(0.08, 0.08, 0.12, 8, '#22c55e', {
    emissive: new THREE.Color('#14532d'), emissiveIntensity: 0.9,
  }), 6.5, H + 0.78, 1.5);
  add(g, C(0.08, 0.08, 0.12, 8, '#eab308', {
    emissive: new THREE.Color('#713f12'), emissiveIntensity: 0.5,
  }), 6.5, H + 0.93, 1.5);
  add(g, C(0.08, 0.08, 0.12, 8, '#ef4444', {
    emissive: new THREE.Color('#7f1d1d'), emissiveIntensity: 0.4,
  }), 6.5, H + 1.08, 1.5);

  // ── Leveling pads ────────────────────────────────────────────
  for (const [px, pz] of [
    [-6, -1.5], [-6, 1.5], [-1, -1.7], [-1, 1.7],
    [4, -1.7], [4, 1.7], [7.5, -1.5], [7.5, 1.5],
  ] as [number, number][]) {
    add(g, C(0.14, 0.18, 0.06, 8, '#546e7a'), px, 0.03, pz);
  }

  return g;
}
