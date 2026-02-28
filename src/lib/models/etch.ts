/** Dry Etch System — 4-chamber ICP/CCP cluster */
import * as THREE from 'three';
import { B, C, add } from './helpers';

export function makeEtch(): THREE.Group {
  const g = new THREE.Group();
  g.userData.type = 'ETCH';

  // ── Central transfer module ───────────────────────────────────
  add(g, B(1.5, 1.6, 1.5, '#7f1d1d', { shininess: 50 }), 0, 0.8, 0);
  add(g, B(1.6, 0.2, 1.6, '#991b1b'), 0, 1.7, 0);

  // ── 4 etch chambers ──────────────────────────────────────────
  const chamberPositions: [number, number][] = [
    [1.7, 0.65], [1.7, -0.65], [-1.7, 0.65], [-1.7, -0.65],
  ];
  chamberPositions.forEach(([px, pz]) => {
    add(g, B(1.1, 1.55, 1.1, '#6b1515', { shininess: 55 }), px, 0.775, pz);
    add(g, B(1.2, 0.18, 1.2, '#7f1d1d'), px, 1.64, pz);
    // ICP dome
    add(g, C(0.5, 0.5, 0.4, 20, '#5a1010'), px, 1.82, pz);
    // RF matching network
    add(g, B(0.5, 0.42, 0.5, '#450a0a'), px + (px > 0 ? 0.85 : -0.85), 0.55, pz);
    // RF cable
    add(g, C(0.04, 0.04, 0.4, 8, '#6b1515'),
      px + (px > 0 ? 0.6 : -0.6), 0.5, pz, 0, 0, Math.PI / 2);
    // Turbo pump
    add(g, C(0.2, 0.24, 0.8, 12, '#7f1d1d'), px, 0.35, pz + (pz > 0 ? 0.75 : -0.75));
    // Exhaust foreline
    add(g, C(0.07, 0.07, 0.5, 8, '#991b1b'), px, 0, pz + (pz > 0 ? 0.85 : -0.85));
    // Viewport
    add(g, C(0.07, 0.07, 0.05, 12, '#fca5a5', { shininess: 200 }),
      px + (px > 0 ? 0.57 : -0.57), 0.9, pz, 0, 0, Math.PI / 2);
    // Gate valve connector
    add(g, B(0.22, 0.3, 0.22, '#7f1d1d'), px * 0.6, 0.8, pz * 0.6);
  });

  // ── EFEM ─────────────────────────────────────────────────────
  add(g, B(1.5, 2.0, 2.8, '#6b1515'), 1.7, 1.0, 0);
  add(g, B(1.6, 0.16, 2.8, '#7f1d1d'), 1.7, 2.08, 0);
  for (const z of [-1, 1]) {
    add(g, B(0.55, 0.62, 0.4, '#450a0a'), 2.55, 0.55, z);
    add(g, C(0.2, 0.2, 0.05, 24, '#200505'), 2.82, 0.55, z, Math.PI / 2);
    add(g, C(0.04, 0.04, 0.04, 8, '#22c55e', {
      emissive: new THREE.Color('#14532d'), emissiveIntensity: 0.8,
    }), 2.28, 0.55 + 0.38, z, Math.PI / 2);
  }

  // ── Gas delivery cabinet ─────────────────────────────────────
  add(g, B(0.9, 2.2, 1.3, '#6b1515'), -2.3, 1.1, 0);
  for (let i = 0; i < 5; i++) {
    add(g, B(0.08, 0.08, 0.08, '#7f1d1d'), -1.88, 1.6 + i * 0.1, (i - 0.2) * 0.2);
  }
  for (let i = 0; i < 4; i++) {
    add(g, C(0.03, 0.03, 1.0, 8, '#991b1b'), -1.9, 1.3 + i * 0.14, -0.05, Math.PI / 2);
  }

  // ── Dry pump ─────────────────────────────────────────────────
  add(g, B(0.8, 1.0, 1.4, '#5a1010'), -2.3, 0.5, -1.1);

  // ── Signal tower light ───────────────────────────────────────
  add(g, C(0.05, 0.05, 0.6, 8, '#6b1515'), 0.8, 2.35, 0.5);
  add(g, C(0.08, 0.08, 0.12, 8, '#22c55e', {
    emissive: new THREE.Color('#14532d'), emissiveIntensity: 0.9,
  }), 0.8, 2.73, 0.5);
  add(g, C(0.08, 0.08, 0.12, 8, '#eab308', {
    emissive: new THREE.Color('#713f12'), emissiveIntensity: 0.5,
  }), 0.8, 2.88, 0.5);
  add(g, C(0.08, 0.08, 0.12, 8, '#ef4444', {
    emissive: new THREE.Color('#7f1d1d'), emissiveIntensity: 0.4,
  }), 0.8, 3.03, 0.5);

  return g;
}
