/** CMP (Chemical Mechanical Planarization) System */
import * as THREE from 'three';
import { B, C, add } from './helpers';

export function makeCMP(): THREE.Group {
  const g = new THREE.Group();
  g.userData.type = 'CMP';

  // ── Main frame ───────────────────────────────────────────────
  add(g, B(4.8, 1.65, 3.0, '#bf360c', { shininess: 40 }), 0, 0.825, 0);
  add(g, B(4.8, 0.16, 3.0, '#e64a19'), 0, 1.73, 0);

  // ── 3 polishing platens ──────────────────────────────────────
  for (const px of [-1.4, 0, 1.4]) {
    // Platen disk
    add(g, C(0.65, 0.65, 0.14, 32, '#6d2813', { shininess: 60 }), px, 1.81, -0.4);
    // Polishing pad
    add(g, C(0.60, 0.60, 0.06, 32, '#8d3b14', { shininess: 12 }), px, 1.87, -0.4);
    // Conditioning arm + disk
    add(g, B(0.8, 0.05, 0.08, '#a04000'), px + 0.28, 1.93, -0.4);
    add(g, C(0.14, 0.14, 0.06, 16, '#7b3500'), px + 0.68, 1.93, -0.4);
    // Slurry arm + nozzle
    add(g, B(0.5, 0.04, 0.04, '#bf4500'), px - 0.15, 1.95, -0.05);
    add(g, C(0.03, 0.03, 0.12, 8, '#d4500c'), px - 0.38, 1.90, 0, Math.PI * 1.1);
  }

  // ── Polish head carousel ─────────────────────────────────────
  add(g, C(0.1, 0.1, 0.9, 8, '#a04000'), 0, 2.25, -0.4);
  add(g, C(0.7, 0.7, 0.08, 24, '#7b3500'), 0, 2.7, -0.4);

  // ── Slurry delivery ──────────────────────────────────────────
  add(g, B(0.85, 1.3, 0.7, '#7b2500'), -2.7, 0.65, 0.7);
  for (let i = 0; i < 3; i++) {
    add(g, C(0.14, 0.14, 0.65, 12, '#a04000'), -2.7 + i * 0.38 - 0.38, 1.6, 0.7);
  }

  // ── Wafer cleaning module ────────────────────────────────────
  add(g, B(2.2, 1.55, 3.0, '#7b2500'), 3.0, 0.775, 0);
  add(g, B(2.2, 0.15, 3.0, '#bf360c'), 3.0, 1.625, 0);
  for (const bz of [-1, 1]) {
    add(g, B(0.65, 1.3, 0.65, '#8d3b14'), 3.5, 0.75, bz);
    add(g, C(0.2, 0.2, 0.8, 12, '#a04000'), 3.5, 1.4, bz);
  }

  // ── Load station + FOUP holders ─────────────────────────────
  add(g, B(1.1, 1.6, 1.4, '#7b2500'), -2.7, 0.8, -0.75);
  for (const fz of [-1.2, -0.3]) {
    add(g, B(0.42, 0.55, 0.32, '#3d1505'), -3.3, 0.55, fz + 0.75);
    add(g, C(0.19, 0.19, 0.05, 24, '#1a0800'), -3.54, 0.55, fz + 0.75, Math.PI / 2);
  }

  // ── Control touchscreen ──────────────────────────────────────
  add(g, B(0.04, 1.2, 0.85, '#3d1505'), 3.0, 1.4, 1.4, 0, -Math.PI / 8);
  add(g, B(0.03, 0.95, 0.7, '#1565c0', {
    emissive: new THREE.Color('#0d47a1'), emissiveIntensity: 0.5,
  }), 3.04, 1.4, 1.42, 0, -Math.PI / 8);

  // ── Signal tower light ───────────────────────────────────────
  add(g, C(0.05, 0.05, 0.55, 8, '#7b2500'), 3.0, 2.3, 1.2);
  add(g, C(0.08, 0.08, 0.12, 8, '#22c55e', {
    emissive: new THREE.Color('#14532d'), emissiveIntensity: 0.9,
  }), 3.0, 2.65, 1.2);

  return g;
}
