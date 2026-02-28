// ─── Core domain types ────────────────────────────────────────

export type EquipmentType = 'EUV' | 'CVD' | 'CMP' | 'ETCH' | 'SEM';
export type AppMode = 'select' | 'move' | 'place';

export interface EquipmentDef {
  name: string;
  sub: string;
  /** Footprint width along X axis (meters) */
  W: number;
  /** Footprint depth along Z axis (meters) */
  D: number;
  /** CSS color string used in UI */
  color: string;
  specs: Record<string, string>;
}

export interface PlacedEquipment {
  id: number;
  type: EquipmentType;
  name: string;
  /** Snapped X position on fab floor (meters) */
  x: number;
  /** Snapped Z position on fab floor (meters) */
  z: number;
  /** Y-axis rotation in radians */
  rot: number;
}

// ─── Layout persistence ───────────────────────────────────────

export interface FabLayout {
  version: string;
  timestamp: string;
  equipment: PlacedEquipment[];
}

// ─── Component prop types ─────────────────────────────────────

export interface TooltipState {
  equipment: PlacedEquipment;
  clientX: number;
  clientY: number;
}

export interface MouseCoord {
  x: number;
  z: number;
}
