/** CVD / ALD Cluster Tool — hexagonal transfer chamber + 4 process chambers */
import * as THREE from 'three';
import { B, C, add } from './helpers';

export function makeCVD(): THREE.Group {
  const g = new THREE.Group();
  g.userData.type = 'CVD';

  // ── Central transfer chamber (hexagonal) ─────────────────────
  add(g, C(1.15, 1.15, 1.7, 6, '#1b5e20', { shininess: 55 }), 0, 0.85, 0);
  add(g, C(1.25, 1.15, 0.18, 6, '#2e7d32'), 0, 1.76, 0);
  add(g, C(1.25, 1.25, 0.12, 6, '#155724'), 0, 0.05, 0);

  // ── 4 process chambers ───────────────────────────────────────
  const chamberPositions: [number, number][] = [
    [1.9, 0.8], [1.9, -0.8], [-1.9, 0.8], [-1.9, -0.8],
  ];
  chamberPositions.forEach(([px, pz]) => {
    add(g, B(1.3, 1.6, 1.3, '#1a4a22', { shininess: 50 }), px, 0.8, pz);
    add(g, B(1.4, 0.18, 1.4, '#2e7d32'), px, 1.67, pz);
    // Dome lid
    add(g, C(0.55, 0.55, 0.4, 20, '#1b5e20'), px, 1.85, pz);
    // Viewport
    add(g, C(0.09, 0.09, 0.06, 12, '#a5d6a7', { shininess: 200 }),
      px, 0.95, pz + (pz > 0 ? 0.67 : -0.67), Math.PI / 2);
    // RF matching unit
    add(g, B(0.4, 0.42, 0.4, '#0d3318'), px + (px > 0 ? 0.88 : -0.88), 0.6, pz);
    // Exhaust pipe
    add(g, C(0.07, 0.07, 0.6, 8, '#388e3c'),
      px + (px > 0 ? 0.5 : -0.5), 0.2, pz, Math.PI / 2);
    // Gate valve to transfer
    add(g, B(0.25, 0.3, 0.25, '#2e7d32'), px * 0.5, 0.8, pz * 0.5);
  });

  // ── EFEM ─────────────────────────────────────────────────────
  add(g, B(1.6, 2.0, 3.0, '#1a3d1e'), 2.8, 1.0, 0);
  add(g, B(1.7, 0.16, 3.1, '#2e7d32'), 2.8, 2.08, 0);
  // Load ports ×2
  for (const z of [-1, 1]) {
    add(g, B(0.58, 0.65, 0.42, '#0d2012'), 3.7, 0.55, z);
    add(g, C(0.21, 0.21, 0.05, 24, '#061209'), 4.0, 0.55, z, Math.PI / 2);
    add(g, C(0.04, 0.04, 0.04, 8, '#22c55e', {
      emissive: new THREE.Color('#14532d'), emissiveIntensity: 0.8,
    }), 3.43, 0.55 + 0.38, z, Math.PI / 2);
  }

  // ── Gas cabinet ──────────────────────────────────────────────
  add(g, B(0.85, 2.2, 1.1, '#143317'), -2.5, 1.1, 0.7);
  for (let i = 0; i < 4; i++) {
    add(g, C(0.03, 0.03, 1.1, 8, '#388e3c'), -2.1, 1.15 + i * 0.18, -0.15, Math.PI / 2);
  }

  // ── Vacuum system ─────────────────────────────────────────────
  add(g, B(1.1, 1.6, 2.8, '#143317'), -2.5, 0.8, -0.8);
  add(g, C(0.28, 0.32, 1.0, 12, '#1b5e20'), -2.5, 0.5, -0.9);
  add(g, C(0.28, 0.32, 1.0, 12, '#1b5e20'), -2.5, 0.5, 0.3);

  // ── Signal tower light ───────────────────────────────────────
  add(g, C(0.05, 0.05, 0.6, 8, '#1b5e20'), 0, 2.2, 0);
  add(g, C(0.08, 0.08, 0.12, 8, '#22c55e', {
    emissive: new THREE.Color('#14532d'), emissiveIntensity: 0.9,
  }), 0, 2.58, 0);
  add(g, C(0.08, 0.08, 0.12, 8, '#eab308', {
    emissive: new THREE.Color('#713f12'), emissiveIntensity: 0.5,
  }), 0, 2.73, 0);

  return g;
}
