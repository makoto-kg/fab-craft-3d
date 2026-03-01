'use client';

/**
 * FabCanvas — Three.js 3D canvas component
 *
 * Equipment models are loaded from /public/models/{TYPE}.glb via GLTFLoader.
 * All models are preloaded on mount and cached; placed instances are deep-clones.
 */

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { preloadAllModels, cloneModel, applyGhostMaterial } from '@/lib/models';
import { OHTSystem } from '@/lib/oht';
import {
  AppMode,
  EquipmentType,
  FabLayout,
  MouseCoord,
  PlacedEquipment,
  TooltipState,
} from '@/lib/types';

// ─── Public handle ────────────────────────────────────────────────────────────

export interface FabCanvasHandle {
  startPlacement(type: EquipmentType): void;
  cancelPlacement(): void;
  setMode(mode: 'select' | 'move'): void;
  rotateSelected(): void;
  deleteSelected(): void;
  clearAll(): void;
  resetCamera(): void;
  snapEyeHeight(): void;
  topView(): void;
  perspView(): void;
  exportLayout(): void;
  importLayout(layout: FabLayout): void;
  setOhtCount(count: number): void;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FabCanvasProps {
  onPlacedChange(list: PlacedEquipment[]): void;
  onSelected(eq: PlacedEquipment | null): void;
  onMouseMove(coord: MouseCoord): void;
  onHover(state: TooltipState | null): void;
  onEscapeKey(): void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FAB_SIZE  = 70;
const CEILING_H = 6.5;   // cleanroom ceiling height (m)
const EYE_H     = 1.65;  // human eye height (m) for walk-mode camera
const WALK_SPD  = 6.0;   // walk speed (m/s)
const TURN_SPD  = Math.PI * 0.75;  // yaw rotation speed (rad/s) for arrow left/right
const snap = (v: number) => Math.round(v);

const DEMO_LAYOUT: { type: EquipmentType; x: number; z: number }[] = [
  { type: 'EUV',  x: -16, z: -8 },
  { type: 'EUV',  x: -16, z:  8 },
  { type: 'CVD',  x:   4, z: -10 },
  { type: 'CVD',  x:   4, z:  -4 },
  { type: 'CMP',  x:   4, z:   4 },
  { type: 'ETCH', x:  12, z:  -8 },
  { type: 'ETCH', x:  12, z:   2 },
  { type: 'SEM',  x:  20, z:   0 },
  { type: 'SEM',  x:  20, z:  -8 },
];

// ─── Signal-tower dynamic lamps ───────────────────────────────────────────────

/**
 * GLB signal-tower lamp shells are baked as dark "#1a1a1a" (off).
 * We overlay Three.js cylinder meshes that emit colour each frame,
 * driven by OHT port occupancy: busy → green lit, idle → yellow lit.
 */
type SignalLamps = { g: THREE.Mesh; y: THREE.Mesh; r: THREE.Mesh };

// Shared geometry (dispose never needed — lives for the app lifetime).
const LAMP_GEO = new THREE.CylinderGeometry(0.09, 0.09, 0.14, 12);

/**
 * How long (ms) to keep a signal-tower lamp GREEN after the OHT vehicle
 * leaves the load port, simulating in-process wafer time inside the tool.
 */
const PROCESSING_MS = 20_000;

/** Equipment-local (x, baseY, z) of the bottom (green) lamp centre. */
const SIGNAL_TOWER: Record<EquipmentType, { x: number; baseY: number; z: number }> = {
  EUV:  { x:  6.5, baseY: 3.18, z:  1.5  },
  CVD:  { x:  0.0, baseY: 2.58, z:  0.0  },
  CMP:  { x:  3.0, baseY: 2.65, z:  1.2  },
  ETCH: { x:  0.8, baseY: 2.73, z:  0.5  },
  SEM:  { x: -0.5, baseY: 2.69, z:  0.58 },
};

function makeLampMesh(color: number): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive:          new THREE.Color(color),
    emissiveIntensity: 0,   // driven each frame
    metalness: 0.05,
    roughness: 0.45,
  });
  const m = new THREE.Mesh(LAMP_GEO, mat);
  m.frustumCulled = false;
  return m;
}

/** Create three lamp meshes (green / yellow / red) and add as children of model. */
function addSignalLamps(model: THREE.Group, type: EquipmentType): SignalLamps {
  const { x, baseY, z } = SIGNAL_TOWER[type];
  const g = makeLampMesh(0x22c55e);   // green  – busy (processing)
  const y = makeLampMesh(0xeab308);   // yellow – idle
  const r = makeLampMesh(0xef4444);   // red    – always off (reserved for future alarm)
  g.position.set(x, baseY,        z);
  y.position.set(x, baseY + 0.15, z);
  r.position.set(x, baseY + 0.30, z);
  model.add(g, y, r);
  return { g, y, r };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const FabCanvas = forwardRef<FabCanvasHandle, FabCanvasProps>(
  function FabCanvas({ onPlacedChange, onSelected, onMouseMove, onHover, onEscapeKey }, ref) {
    const mountRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);

    // Three.js object refs (don't trigger re-render)
    const sceneRef     = useRef<THREE.Scene | null>(null);
    const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef  = useRef<OrbitControls | null>(null);
    const floorRef     = useRef<THREE.Mesh | null>(null);
    const ghostRef     = useRef<THREE.Group | null>(null);
    const selBoxRef    = useRef<THREE.Mesh | null>(null);
    const raycasterRef = useRef(new THREE.Raycaster());
    const mposRef      = useRef(new THREE.Vector2());
    const rafRef       = useRef<number>(0);

    // GLB model cache: loaded once on mount
    const modelCacheRef = useRef<Map<EquipmentType, THREE.Group>>(new Map());

    // OHT simulation
    const ohtSystemRef = useRef<OHTSystem | null>(null);
    const clockRef     = useRef(new THREE.Clock());

    // Walk keys currently held down
    const keysRef = useRef<Set<string>>(new Set());

    // App state kept in refs so closures always read latest without re-render
    const placedRef   = useRef<PlacedEquipment[]>([]);
    const modelsRef   = useRef<Map<number, THREE.Group>>(new Map());
    const selectedRef = useRef<PlacedEquipment | null>(null);
    const modeRef     = useRef<AppMode>('select');
    const placingRef  = useRef<EquipmentType | null>(null);
    const draggingRef = useRef(false);
    const nextIdRef   = useRef(1);

    // Signal-tower lamp meshes: eqId → { g, y, r }
    const lampRefs    = useRef<Map<number, SignalLamps>>(new Map());

    // OHT vehicle count (user-configurable)
    const ohtCountRef = useRef<number | undefined>(undefined);

    // eqId → performance.now() timestamp at which green lamp should turn off.
    // Set whenever an OHT visits the equipment's load port.
    // const processingEndRef = useRef<Map<number, number>>(new Map());

    // Animation (OHT simulation) pause state.
    // The ref is read inside the animation loop; the state drives the button UI.
    const [simPaused, setSimPaused] = useState(false);
    const simPausedRef = useRef(false);

    // Stable callback refs
    const cbPlaced    = useRef(onPlacedChange);
    const cbSelected  = useRef(onSelected);
    const cbMouseMove = useRef(onMouseMove);
    const cbHover     = useRef(onHover);
    const cbEscape    = useRef(onEscapeKey);
    useEffect(() => { cbPlaced.current    = onPlacedChange; }, [onPlacedChange]);
    useEffect(() => { cbSelected.current  = onSelected;     }, [onSelected]);
    useEffect(() => { cbMouseMove.current = onMouseMove;    }, [onMouseMove]);
    useEffect(() => { cbHover.current     = onHover;        }, [onHover]);
    useEffect(() => { cbEscape.current    = onEscapeKey;    }, [onEscapeKey]);

    // ── Internal helpers ──────────────────────────────────────────────────────

    function notifyPlaced() {
      cbPlaced.current([...placedRef.current]);
    }

    function refreshSelBox(model: THREE.Group) {
      const scene = sceneRef.current!;
      if (selBoxRef.current) scene.remove(selBoxRef.current);
      const bb = new THREE.Box3().setFromObject(model);
      const sz = new THREE.Vector3(), ct = new THREE.Vector3();
      bb.getSize(sz); bb.getCenter(ct);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(sz.x + 0.35, sz.y + 0.35, sz.z + 0.35),
        new THREE.MeshBasicMaterial({ color: 0x29b6f6, wireframe: true, transparent: true, opacity: 0.55 }),
      );
      mesh.position.copy(ct);
      scene.add(mesh);
      selBoxRef.current = mesh;
    }

    function clearSelBox() {
      if (selBoxRef.current) { sceneRef.current?.remove(selBoxRef.current); selBoxRef.current = null; }
    }

    function selectEntry(entry: PlacedEquipment | null) {
      selectedRef.current = entry;
      if (entry) {
        const model = modelsRef.current.get(entry.id);
        if (model) refreshSelBox(model);
        cbSelected.current({ ...entry });
      } else {
        clearSelBox();
        cbSelected.current(null);
      }
    }

    /** Clone a cached GLB and place it in the scene */
    function spawnModel(type: EquipmentType, x: number, z: number): PlacedEquipment {
      const model = cloneModel(modelCacheRef.current, type);
      model.position.set(x, 0, z);
      model.userData.id = nextIdRef.current;
      sceneRef.current!.add(model);

      const existing = placedRef.current.filter((e) => e.type === type).length;
      const entry: PlacedEquipment = {
        id: nextIdRef.current++,
        type,
        name: `${type} #${existing + 1}`,
        x, z, rot: 0,
      };
      placedRef.current = [...placedRef.current, entry];
      modelsRef.current.set(entry.id, model);
      lampRefs.current.set(entry.id, addSignalLamps(model, type));
      notifyPlaced();
      ohtSystemRef.current?.rebuild(placedRef.current, ohtCountRef.current);
      return entry;
    }

    function removeEquipment(id: number) {
      const model = modelsRef.current.get(id);
      if (model) sceneRef.current?.remove(model);
      modelsRef.current.delete(id);
      lampRefs.current.delete(id);
      // processingEndRef.current.delete(id);
      placedRef.current = placedRef.current.filter((e) => e.id !== id);
      notifyPlaced();
      ohtSystemRef.current?.rebuild(placedRef.current, ohtCountRef.current);
    }

    /** Rebuild OHT rail network whenever placement changes. */
    function rebuildOHT() {
      ohtSystemRef.current?.rebuild(placedRef.current, ohtCountRef.current);
    }

    // ── Raycasting helpers ────────────────────────────────────────────────────

    function getFloorPoint(e: MouseEvent): THREE.Vector3 | null {
      const rect = mountRef.current!.getBoundingClientRect();
      mposRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mposRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mposRef.current, cameraRef.current!);
      const hits = raycasterRef.current.intersectObject(floorRef.current!);
      return hits.length > 0 ? hits[0].point : null;
    }

    function getEquipmentAtMouse(e: MouseEvent): PlacedEquipment | null {
      const rect = mountRef.current!.getBoundingClientRect();
      mposRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mposRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mposRef.current, cameraRef.current!);

      const meshes: THREE.Object3D[] = [];
      modelsRef.current.forEach((model) =>
        model.traverse((c) => { if ((c as THREE.Mesh).isMesh) meshes.push(c); }),
      );
      const hits = raycasterRef.current.intersectObjects(meshes);
      if (!hits.length) return null;

      let obj: THREE.Object3D | null = hits[0].object;
      while (obj) {
        const found = Array.from(modelsRef.current.entries()).find(([, m]) => m === obj);
        if (found) return placedRef.current.find((e) => e.id === found[0]) ?? null;
        obj = obj.parent;
      }
      return null;
    }

    // ── DOM event handlers ────────────────────────────────────────────────────

    function handleMouseMove(e: MouseEvent) {
      const fp = getFloorPoint(e);
      if (fp) {
        const sx = snap(fp.x), sz = snap(fp.z);
        cbMouseMove.current({ x: sx, z: sz });

        if (ghostRef.current && placingRef.current) ghostRef.current.position.set(sx, 0, sz);

        if (draggingRef.current && selectedRef.current && modeRef.current === 'move') {
          const model = modelsRef.current.get(selectedRef.current.id);
          if (model) { model.position.set(sx, 0, sz); refreshSelBox(model); }
          placedRef.current = placedRef.current.map((e) =>
            e.id === selectedRef.current!.id ? { ...e, x: sx, z: sz } : e,
          );
          selectedRef.current = { ...selectedRef.current, x: sx, z: sz };
          cbSelected.current({ ...selectedRef.current });
        }
      }

      const eq = getEquipmentAtMouse(e);
      const rect = mountRef.current!.getBoundingClientRect();
      if (eq && modeRef.current === 'select') {
        cbHover.current({ equipment: eq, clientX: e.clientX - rect.left, clientY: e.clientY - rect.top });
      } else {
        cbHover.current(null);
      }
    }

    function handleMouseDown(e: MouseEvent) {
      if (e.button !== 0) return;
      if (modeRef.current === 'place' && placingRef.current) {
        const fp = getFloorPoint(e);
        if (fp) spawnModel(placingRef.current, snap(fp.x), snap(fp.z));
      } else if (modeRef.current === 'move') {
        draggingRef.current = true;
        if (controlsRef.current) controlsRef.current.enabled = false;
      }
    }

    function handleMouseUp() {
      if (draggingRef.current) {
        draggingRef.current = false;
        if (controlsRef.current) controlsRef.current.enabled = true;
        notifyPlaced();
      }
    }

    function handleClick(e: MouseEvent) {
      if (modeRef.current === 'select') selectEntry(getEquipmentAtMouse(e) ?? null);
    }

    function handleKeyDown(e: KeyboardEvent) {
      // ── Walk keys: track which keys are currently held ──────────────────────
      // Skip when the user is typing in an input / textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        const WALK_KEYS = ['w','W','a','A','s','S','d','D',
                           'ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
        if (WALK_KEYS.includes(e.key)) {
          keysRef.current.add(e.key);
          // Prevent arrow keys from scrolling the page
          if (e.key.startsWith('Arrow')) e.preventDefault();
        }
      }

      // ── App shortcuts ────────────────────────────────────────────────────────
      if (e.key === 'Home') {
        // Snap camera Y back to eye height, keep horizontal position & direction
        e.preventDefault();
        const cam  = cameraRef.current;
        const ctrl = controlsRef.current;
        if (cam && ctrl) {
          cam.position.y = EYE_H;
          ctrl.target.y  = EYE_H;
          ctrl.update();
        }
      }
      if (e.key === 'Escape') {
        if (ghostRef.current) { sceneRef.current?.remove(ghostRef.current); ghostRef.current = null; }
        placingRef.current = null; modeRef.current = 'select'; cbEscape.current();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = selectedRef.current;
        if (sel) { selectEntry(null); removeEquipment(sel.id); }
      }
      if (e.key === 'r' || e.key === 'R') {
        const sel = selectedRef.current;
        if (!sel) return;
        const newRot = sel.rot + Math.PI / 2;
        const model = modelsRef.current.get(sel.id);
        if (model) { model.rotation.y = newRot; refreshSelBox(model); }
        placedRef.current = placedRef.current.map((e) => e.id === sel.id ? { ...e, rot: newRot } : e);
        selectedRef.current = { ...sel, rot: newRot };
        cbSelected.current({ ...selectedRef.current });
        notifyPlaced();
        rebuildOHT();
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      keysRef.current.delete(e.key);
    }

    // ── Imperative handle ─────────────────────────────────────────────────────

    useImperativeHandle(ref, () => ({
      startPlacement(type: EquipmentType) {
        if (ghostRef.current) sceneRef.current?.remove(ghostRef.current);
        placingRef.current = type; modeRef.current = 'place';
        const g = cloneModel(modelCacheRef.current, type);
        applyGhostMaterial(g);
        g.userData.ghost = true;
        sceneRef.current?.add(g);
        ghostRef.current = g;
        selectEntry(null);
      },
      cancelPlacement() {
        if (ghostRef.current) { sceneRef.current?.remove(ghostRef.current); ghostRef.current = null; }
        placingRef.current = null; modeRef.current = 'select';
      },
      setMode(m: 'select' | 'move') {
        modeRef.current = m;
        if (controlsRef.current) controlsRef.current.enabled = true;
      },
      rotateSelected() {
        const sel = selectedRef.current;
        if (!sel) return;
        const newRot = sel.rot + Math.PI / 2;
        const model = modelsRef.current.get(sel.id);
        if (model) { model.rotation.y = newRot; refreshSelBox(model); }
        placedRef.current = placedRef.current.map((e) => e.id === sel.id ? { ...e, rot: newRot } : e);
        selectedRef.current = { ...sel, rot: newRot };
        cbSelected.current({ ...selectedRef.current });
        notifyPlaced();
        rebuildOHT();
      },
      deleteSelected() {
        const sel = selectedRef.current;
        if (sel) { selectEntry(null); removeEquipment(sel.id); }
      },
      clearAll() {
        Array.from(modelsRef.current.values()).forEach((m) => sceneRef.current?.remove(m));
        modelsRef.current.clear(); lampRefs.current.clear(); // processingEndRef.current.clear();
        placedRef.current = []; selectEntry(null); notifyPlaced();
        rebuildOHT();
      },
      resetCamera() {
        cameraRef.current?.position.set(0, EYE_H, 30);
        controlsRef.current?.target.set(0, EYE_H, 0);
        controlsRef.current?.update();
      },
      snapEyeHeight() {
        const cam  = cameraRef.current;
        const ctrl = controlsRef.current;
        if (!cam || !ctrl) return;
        // Keep horizontal position & look direction; snap only Y to eye height
        cam.position.y  = EYE_H;
        ctrl.target.y   = EYE_H;
        ctrl.update();
      },
      topView() {
        cameraRef.current?.position.set(0, 90, 0.001); cameraRef.current?.lookAt(0, 0, 0);
        controlsRef.current?.target.set(0, 0, 0); controlsRef.current?.update();
      },
      perspView() {
        cameraRef.current?.position.set(25, 35, 45); cameraRef.current?.lookAt(0, 0, 0);
        controlsRef.current?.target.set(0, 0, 0); controlsRef.current?.update();
      },
      exportLayout() {
        const layout: FabLayout = { version: '1.1', timestamp: new Date().toISOString(), equipment: [...placedRef.current] };
        const a = document.createElement('a');
        a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(layout, null, 2));
        a.download = `fab_layout_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
      },
      importLayout(layout: FabLayout) {
        Array.from(modelsRef.current.values()).forEach((m) => sceneRef.current?.remove(m));
        modelsRef.current.clear(); lampRefs.current.clear(); // processingEndRef.current.clear();
        placedRef.current = []; selectEntry(null);
        layout.equipment.forEach((item) => {
          const model = cloneModel(modelCacheRef.current, item.type);
          model.position.set(item.x, 0, item.z);
          model.rotation.y = item.rot ?? 0;
          model.userData.id = item.id;
          sceneRef.current?.add(model);
          modelsRef.current.set(item.id, model);
          lampRefs.current.set(item.id, addSignalLamps(model, item.type));
          placedRef.current.push({ ...item });
          if (item.id >= nextIdRef.current) nextIdRef.current = item.id + 1;
        });
        notifyPlaced();
        rebuildOHT();
      },
      setOhtCount(count: number) {
        ohtCountRef.current = count;
        rebuildOHT();
      },
    }));

    // ── Three.js initialization + GLB preload ─────────────────────────────────

    useEffect(() => {
      // Reset all placement-tracking refs before each mount.
      // React StrictMode intentionally double-invokes effects (mount → unmount → remount)
      // to detect side-effects; if refs keep values from the first mount the second mount
      // would start with stale data, causing the sidebar count to double while the 3D
      // scene only shows the expected number of models.
      placedRef.current        = [];
      modelsRef.current        = new Map();
      lampRefs.current         = new Map();
      // processingEndRef.current = new Map();
      nextIdRef.current        = 1;
      selectedRef.current      = null;

      const div = mountRef.current!;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.9;
      renderer.setClearColor(0x0d0d1f);
      renderer.setSize(div.clientWidth, div.clientHeight);
      div.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Scene
      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x0d0d1f, 90, 180);
      sceneRef.current = scene;
      RectAreaLightUniformsLib.init();

      // Camera — start at human eye height, looking horizontally into the fab
      const camera = new THREE.PerspectiveCamera(70, div.clientWidth / div.clientHeight, 0.1, 500);
      camera.position.set(0, EYE_H, 30);
      camera.lookAt(0, EYE_H, 0);
      cameraRef.current = camera;

      // Controls — target at eye height so orbit is horizontal by default
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping  = true;
      controls.dampingFactor  = 0.07;
      controls.minDistance    = 0.5;
      controls.maxDistance    = 140;
      controls.minPolarAngle  = 0.06;              // allow looking almost straight up
      controls.maxPolarAngle  = Math.PI - 0.06;    // allow looking almost straight down
      controls.target.set(0, EYE_H, 0);
      controls.update();
      controlsRef.current = controls;

      // ── Environment map (for metallic PBR reflections) ───────────────────
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      envScene.add(new THREE.AmbientLight(0xd8eeff, 2.0));
      const envDir = new THREE.DirectionalLight(0xffffff, 1.5);
      envDir.position.set(1, 3, 2);
      envScene.add(envDir);
      envScene.background = new THREE.Color(0x202838);
      scene.environment = pmrem.fromScene(envScene, 0.04).texture;
      pmrem.dispose();

      // ── Cleanroom lighting ─────────────────────────────────────────────────
      // Ambient fill — subtle cool white; kept low so directional shadows read clearly
      scene.add(new THREE.AmbientLight(0xd8e4f0, 1.6));
      // scene.add(new THREE.AmbientLight(0xd8e4f0, 0.6));

      // Directional key light — angled for clear shadow definition
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
      keyLight.position.set(10, 20, 8);
      keyLight.castShadow = true;
      keyLight.shadow.camera.left   = -60; keyLight.shadow.camera.right  =  60;
      keyLight.shadow.camera.top    =  60; keyLight.shadow.camera.bottom = -60;
      keyLight.shadow.mapSize.set(2048, 2048);
      scene.add(keyLight);

      // 5 × 5 grid of RectAreaLights — bay LED panels on ceiling
      // Cool white (≈ 5500 K) typical of semiconductor cleanrooms
      const LIGHT_Y    = CEILING_H - 0.06;
      const PANEL_W    = 2.8;   // fixture width  (m)
      const PANEL_D    = 0.5;   // fixture depth  (m)
      const LIGHT_STEP = 12;    // spacing between fixtures (m)
      const LIGHT_COL  = 0xd8eeff;

      for (let lx = -24; lx <= 24; lx += LIGHT_STEP) {
        for (let lz = -24; lz <= 24; lz += LIGHT_STEP) {
          // RectAreaLight — emits downward
          const al = new THREE.RectAreaLight(LIGHT_COL, 22, PANEL_W, PANEL_D);
          al.position.set(lx, LIGHT_Y, lz);
          al.rotation.x = -Math.PI / 2;   // face downward
          scene.add(al);

          // Emissive panel mesh — visual light fixture on ceiling
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(PANEL_W, 0.04, PANEL_D),
            new THREE.MeshStandardMaterial({
              color: 0xffffff,
              emissive: new THREE.Color(LIGHT_COL),
              emissiveIntensity: 6.0,
            }),
          );
          panel.position.set(lx, CEILING_H - 0.02, lz);
          scene.add(panel);
        }
      }

      // Floor — light epoxy-coated surface typical of cleanrooms
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(FAB_SIZE, FAB_SIZE),
        new THREE.MeshStandardMaterial({ color: 0x6e7e8e, metalness: 0.06, roughness: 0.52 }),
      );
      floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.name = 'floor';
      scene.add(floor); floorRef.current = floor;

      // Ceiling — clean white T-bar grid panel surface
      const ceiling = new THREE.Mesh(
        new THREE.PlaneGeometry(FAB_SIZE, FAB_SIZE),
        new THREE.MeshStandardMaterial({ color: 0xb8c8d8, roughness: 0.92, metalness: 0 }),
      );
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.y = CEILING_H;
      scene.add(ceiling);

      // Grids
      scene.add(new THREE.GridHelper(FAB_SIZE, FAB_SIZE, 0x3a4a5a, 0x2a3a4a));
      const cg = new THREE.GridHelper(FAB_SIZE, FAB_SIZE / 5, 0x4a5a6a, 0x4a5a6a);
      cg.position.y = 0.005; scene.add(cg);

      // Fab walls — semi-transparent cleanroom panels
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.8, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
      ([
        [0, -FAB_SIZE / 2, FAB_SIZE, 0.3],
        [0,  FAB_SIZE / 2, FAB_SIZE, 0.3],
        [-FAB_SIZE / 2, 0, 0.3, FAB_SIZE],
        [ FAB_SIZE / 2, 0, 0.3, FAB_SIZE],
      ] as [number, number, number, number][]).forEach(([x, z, w, d]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, CEILING_H, d), wallMat);
        m.position.set(x, CEILING_H / 2, z); scene.add(m);
      });

      // OHT system (initialised here; populated after GLB preload)
      ohtSystemRef.current = new OHTSystem(scene);
      clockRef.current.start();

      // ── Helper vectors reused every frame (allocated once) ──────────────────
      const _fwd   = new THREE.Vector3();
      const _right = new THREE.Vector3();
      const _move  = new THREE.Vector3();
      const _UP    = new THREE.Vector3(0, 1, 0);

      // Render loop
      function animate() {
        rafRef.current = requestAnimationFrame(animate);
        // Clamp delta so vehicles don't jump after a long pause / tab switch.
        const delta = Math.min(clockRef.current.getDelta(), 0.1);

        // ── WASD / Arrow-key walk + turn (horizontal only) ───────────────────
        const k = keysRef.current;
        const goFwd    = k.has('w') || k.has('W') || k.has('ArrowUp');
        const goBack   = k.has('s') || k.has('S') || k.has('ArrowDown');
        const goLeft   = k.has('a') || k.has('A');   // A/D → strafe
        const goRgt    = k.has('d') || k.has('D');
        const turnLeft = k.has('ArrowLeft');           // ← → → in-place yaw
        const turnRight= k.has('ArrowRight');

        // ── Forward direction (XZ projection) ─────────────────────────────────
        if (goFwd || goBack || goLeft || goRgt || turnLeft || turnRight) {
          _fwd.subVectors(controls.target, camera.position);
          _fwd.y = 0;
          if (_fwd.lengthSq() < 1e-6) {
            // Camera pointing straight up/down — use camera -Z projected to XZ
            _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
            _fwd.y = 0;
          }
          _fwd.normalize();
        }

        // ── Translate (W/S/A/D) ───────────────────────────────────────────────
        if (goFwd || goBack || goLeft || goRgt) {
          _right.crossVectors(_fwd, _UP).normalize();

          _move.set(0, 0, 0);
          if (goFwd)  _move.addScaledVector(_fwd,    WALK_SPD * delta);
          if (goBack) _move.addScaledVector(_fwd,   -WALK_SPD * delta);
          if (goLeft) _move.addScaledVector(_right, -WALK_SPD * delta);
          if (goRgt)  _move.addScaledVector(_right,  WALK_SPD * delta);

          camera.position.add(_move);
          controls.target.add(_move);
        }

        // ── In-place yaw rotation (← →) ──────────────────────────────────────
        if (turnLeft || turnRight) {
          const angle = (turnLeft ? 1 : -1) * TURN_SPD * delta;
          // Rotate the target around the camera's current position (Y axis only)
          const dir = _fwd.clone().multiplyScalar(
            controls.target.distanceTo(camera.position),
          );
          dir.applyAxisAngle(_UP, angle);
          controls.target.copy(camera.position).add(dir);
        }

        controls.update();

        // ── OHT simulation + signal-tower lamps (skipped when paused) ──────────
        if (!simPausedRef.current) {
          ohtSystemRef.current?.update(delta);

          // Green = equipment processing (OHT docking OR departed within PROCESSING_MS)
          // Yellow = idle
          const busyIds = ohtSystemRef.current?.getBusyEqIds() ?? new Set<number>();
          const nowMs   = performance.now();

          // Extend the green window each frame the port is occupied.
          // busyIds.forEach((eqId) => {
          //   processingEndRef.current.set(eqId, nowMs + PROCESSING_MS);
          // });

          lampRefs.current.forEach((lamps, eqId) => {
            const busy = busyIds.has(eqId);
            (lamps.g.material as THREE.MeshStandardMaterial).emissiveIntensity = busy ? 2.5 : 0;
            (lamps.y.material as THREE.MeshStandardMaterial).emissiveIntensity = busy ? 0   : 2.5;
          });
        }

        renderer.render(scene, camera);
      }
      animate();

      // Resize handler
      function onResize() {
        const w = div.clientWidth, h = div.clientHeight;
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
      }
      window.addEventListener('resize', onResize);

      // Input events
      div.addEventListener('mousemove', handleMouseMove);
      div.addEventListener('mousedown', handleMouseDown);
      div.addEventListener('mouseup',   handleMouseUp);
      div.addEventListener('click',     handleClick);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup',   handleKeyUp);

      // Preload all GLB models, then populate demo layout.
      // `cancelled` guards against React StrictMode's double-invocation: the
      // first mount's cleanup sets it to true so its in-flight promise callback
      // is skipped, preventing equipment from being spawned twice.
      let cancelled = false;
      preloadAllModels()
        .then((cache) => {
          if (cancelled) return;
          modelCacheRef.current = cache;
          DEMO_LAYOUT.forEach(({ type, x, z }) => spawnModel(type, x, z));
          ohtSystemRef.current?.rebuild(placedRef.current, ohtCountRef.current);
          setLoading(false);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error('Model preload failed:', err);
          setLoading(false);
        });

      return () => {
        cancelled = true;
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener('resize',  onResize);
        div.removeEventListener('mousemove',  handleMouseMove);
        div.removeEventListener('mousedown',  handleMouseDown);
        div.removeEventListener('mouseup',    handleMouseUp);
        div.removeEventListener('click',      handleClick);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup',   handleKeyUp);
        ohtSystemRef.current?.dispose();
        controls.dispose(); renderer.dispose();
        if (div.contains(renderer.domElement)) div.removeChild(renderer.domElement);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div
        ref={mountRef}
        style={{
          position: 'absolute', inset: 0,
          top: 46,    // toolbar height
          bottom: 28, // status bar height
          cursor: placingRef.current ? 'crosshair' : 'default',
        }}
      >
        {/* Loading overlay — shown while GLB files are being fetched */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'rgba(10,10,25,.88)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 16, backdropFilter: 'blur(4px)',
          }}>
            <div style={{
              width: 44, height: 44,
              border: '3px solid #1e3a5a', borderTop: '3px solid #4fc3f7',
              borderRadius: '50%', animation: 'fab-spin 0.9s linear infinite',
            }} />
            <span style={{ color: '#4fc3f7', fontSize: 14, letterSpacing: 1 }}>
              3D モデルを読み込み中…
            </span>
            <style>{`@keyframes fab-spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* OHT simulation start / stop button */}
        {!loading && (
          <div style={{
            position: 'absolute', bottom: 10, right: 10, zIndex: 20,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {/* Status indicator dot */}
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: simPaused ? '#ef4444' : '#22c55e',
              boxShadow: simPaused
                ? '0 0 6px #ef4444'
                : '0 0 6px #22c55e',
              transition: 'background 0.3s, box-shadow 0.3s',
            }} />
            <button
              onClick={() => {
                const next = !simPausedRef.current;
                simPausedRef.current = next;
                setSimPaused(next);
                if (!next) {
                  // Drain accumulated time so vehicles don't jump on resume.
                  clockRef.current.getDelta();
                }
              }}
              style={{
                padding: '5px 14px',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.5px',
                color: '#e0eeff',
                background: simPaused ? 'rgba(34,80,40,0.82)' : 'rgba(60,40,40,0.82)',
                border: `1px solid ${simPaused ? '#22c55e55' : '#ef444455'}`,
                borderRadius: 6,
                cursor: 'pointer',
                backdropFilter: 'blur(6px)',
                transition: 'background 0.25s, border 0.25s',
                userSelect: 'none',
              }}
            >
              {simPaused ? '▶ 開始' : '⏸ 停止'}
            </button>
          </div>
        )}
      </div>
    );
  },
);
