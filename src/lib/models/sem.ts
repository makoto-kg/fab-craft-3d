/** CD-SEM / Review SEM — electron optical column + workstation */
import * as THREE from 'three';
import { B, C, add } from './helpers';

export function makeSEM(): THREE.Group {
  const g = new THREE.Group();
  g.userData.type = 'SEM';

  // ── Main column body ─────────────────────────────────────────
  add(g, B(1.5, 1.85, 1.5, '#4a148c', { shininess: 60 }), 0, 0.925, 0);
  add(g, B(1.5, 0.15, 1.5, '#6a1fc2'), 0, 1.9, 0);
  // Anti-vibration isolators ×4
  for (const [ix, iz] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]] as [number,number][]) {
    add(g, C(0.09, 0.11, 0.1, 8, '#6a1fc2'), ix, 0.05, iz);
  }

  // ── Electron optical column ───────────────────────────────────
  add(g, C(0.28, 0.3, 1.3, 20, '#5b21b6', { shininess: 70 }), -0.2, 2.55, -0.15);
  // Electron gun
  add(g, C(0.18, 0.28, 0.42, 20, '#4a148c'), -0.2, 3.41, -0.15);
  add(g, C(0.12, 0.18, 0.38, 16, '#381371'), -0.2, 3.84, -0.15);
  add(g, C(0.06, 0.06, 0.1, 8, '#1e0840'), -0.2, 4.05, -0.15);
  // Detector
  add(g, B(0.22, 0.22, 0.3, '#6d28d9'), 0.12, 2.4, 0);
  // Aperture disc
  add(g, C(0.06, 0.06, 0.04, 16, '#8b5cf6', { shininess: 200 }), -0.2, 2.15, -0.15);
  // Column ribs
  for (let i = 0; i < 3; i++) {
    add(g, B(0.04, 0.04, 0.62, '#7c3aed'),
      -0.2 + 0.26 * (i < 2 ? 1 : -1), 2.4 + i * 0.2, -0.15 + 0.22 * (i % 2 ? 1 : -1));
  }

  // ── Sample chamber ────────────────────────────────────────────
  add(g, B(0.85, 0.55, 0.85, '#311864', { shininess: 45 }), -0.2, 1.52, -0.15);
  // Chamber door
  add(g, B(0.02, 0.45, 0.75, '#4a148c'), 0.22, 1.52, -0.15);
  // Air lock
  add(g, B(0.3, 0.3, 0.3, '#6d28d9'), 0.62, 1.6, -0.15);
  add(g, C(0.09, 0.09, 0.06, 12, '#1e0840'), 0.77, 1.6, -0.15, 0, 0, Math.PI / 2);

  // ── Workstation desk ─────────────────────────────────────────
  add(g, B(0.88, 1.05, 1.65, '#2d1f5c'), 1.1, 0.525, 0);
  add(g, B(0.88, 0.06, 1.65, '#4a148c'), 1.1, 1.08, 0);
  // Monitor arm + display
  add(g, B(0.32, 0.05, 0.05, '#5b21b6'), 1.18, 1.35, 0);
  add(g, B(0.05, 0.5, 0.82, '#1e1b4b'), 1.35, 1.36, 0);
  add(g, B(0.03, 0.42, 0.72, '#312e81', {
    emissive: new THREE.Color('#1e1b4b'), emissiveIntensity: 0.55,
  }), 1.37, 1.36, 0);
  // Keyboard
  const kb = B(0.02, 0.05, 0.55, '#1e1b4b');
  kb.rotation.x = 0.18;
  add(g, kb, 1.1, 1.14, 0.06);

  // ── Vacuum controller rack ────────────────────────────────────
  add(g, B(0.45, 0.95, 0.55, '#2d1f5c'), -1.1, 0.475, 0.55);
  for (let i = 0; i < 3; i++) {
    add(g, B(0.38, 0.16, 0.05, '#1565c0', {
      emissive: new THREE.Color('#0d3070'), emissiveIntensity: 0.4,
    }), -1.1, 0.2 + i * 0.3, 0.8);
  }

  // ── Turbo pump ────────────────────────────────────────────────
  add(g, C(0.2, 0.22, 0.6, 12, '#4a148c'), -1.1, 0.3, -0.45);

  // ── Signal tower light ───────────────────────────────────────
  add(g, C(0.04, 0.04, 0.38, 8, '#2d1f5c'), -0.5, 2.45, 0.58);
  add(g, C(0.07, 0.07, 0.1, 8, '#22c55e', {
    emissive: new THREE.Color('#14532d'), emissiveIntensity: 0.9,
  }), -0.5, 2.69, 0.58);

  return g;
}
