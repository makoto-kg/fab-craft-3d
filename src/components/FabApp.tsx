'use client';

import React, { useCallback, useRef, useState } from 'react';
import { FabCanvas, FabCanvasHandle } from './FabCanvas';
import { Sidebar } from './Sidebar';
import { Toolbar } from './Toolbar';
import { PropsPanel } from './PropsPanel';
import { AppMode, EquipmentType, MouseCoord, PlacedEquipment, TooltipState } from '@/lib/types';
import { EQUIPMENT_DEFS } from '@/lib/equipmentDefs';

export default function FabApp() {
  // ── UI state ──────────────────────────────────────────────────
  const [mode, setModeState]         = useState<AppMode>('select');
  const [placingType, setPlacingType]= useState<EquipmentType | null>(null);
  const [placed, setPlaced]          = useState<PlacedEquipment[]>([]);
  const [selected, setSelected]      = useState<PlacedEquipment | null>(null);
  const [mouseCoord, setMouseCoord]  = useState<MouseCoord>({ x: 0, z: 0 });
  const [tooltip, setTooltip]        = useState<TooltipState | null>(null);
  const [ohtCount, setOhtCount]      = useState(4);

  const canvasRef = useRef<FabCanvasHandle | null>(null);

  // ── Sidebar actions ───────────────────────────────────────────
  const handleSelectType = useCallback((type: EquipmentType) => {
    setPlacingType(type);
    setModeState('place');
    setSelected(null);
    canvasRef.current?.startPlacement(type);
  }, []);

  const handleCancelPlace = useCallback(() => {
    setPlacingType(null);
    setModeState('select');
    canvasRef.current?.cancelPlacement();
  }, []);

  // ── Toolbar actions ───────────────────────────────────────────
  const handleSetMode = useCallback((m: 'select' | 'move') => {
    setModeState(m);
    if (placingType) {
      setPlacingType(null);
      canvasRef.current?.cancelPlacement();
    }
    canvasRef.current?.setMode(m);
  }, [placingType]);

  const handleClearAll = useCallback(() => {
    if (!confirm('全ての装置を削除しますか？')) return;
    canvasRef.current?.clearAll();
    setPlaced([]);
    setSelected(null);
  }, []);

  const handleSaveLayout = useCallback(() => {
    canvasRef.current?.exportLayout();
  }, []);

  const handleLoadLayout = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target!.result as string);
        canvasRef.current?.importLayout(data);
      } catch (err) {
        alert('読み込みエラー: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
  }, []);

  // ── Canvas callbacks ──────────────────────────────────────────
  const handlePlacedChange = useCallback((list: PlacedEquipment[]) => {
    setPlaced(list);
  }, []);

  const handleSelected = useCallback((eq: PlacedEquipment | null) => {
    setSelected(eq);
  }, []);

  const handleMouseMove = useCallback((coord: MouseCoord) => {
    setMouseCoord(coord);
  }, []);

  const handleHover = useCallback((state: TooltipState | null) => {
    setTooltip(state);
  }, []);

  // ── Props panel actions ───────────────────────────────────────
  const handleRotateSelected = useCallback(() => {
    canvasRef.current?.rotateSelected();
  }, []);

  const handleDeleteSelected = useCallback(() => {
    canvasRef.current?.deleteSelected();
    setSelected(null);
  }, []);

  // ── Keyboard shortcuts (global) ───────────────────────────────
  // Handled inside FabCanvas, but Escape also resets UI mode
  const handleEscapeKey = useCallback(() => {
    setPlacingType(null);
    setModeState('select');
  }, []);

  const handleOhtCountChange = useCallback((count: number) => {
    setOhtCount(count);
    canvasRef.current?.setOhtCount(count);
  }, []);

  // ── Count chips for sidebar ───────────────────────────────────
  const counts: Partial<Record<EquipmentType, number>> = {};
  placed.forEach((e) => { counts[e.type] = (counts[e.type] ?? 0) + 1; });

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ── Left sidebar ── */}
      <Sidebar
        counts={counts}
        placingType={placingType}
        onSelectType={handleSelectType}
        onSave={handleSaveLayout}
        onLoadFile={handleLoadLayout}
      />

      {/* ── Main canvas area ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Toolbar */}
        <Toolbar
          mode={mode}
          equipmentCount={placed.length}
          ohtCount={ohtCount}
          onSetMode={handleSetMode}
          onResetCamera={() => canvasRef.current?.resetCamera()}
          onSnapEyeHeight={() => canvasRef.current?.snapEyeHeight()}
          onTopView={() => canvasRef.current?.topView()}
          onPerspView={() => canvasRef.current?.perspView()}
          onClearAll={handleClearAll}
          onOhtCountChange={handleOhtCountChange}
        />

        {/* Three.js Canvas */}
        <FabCanvas
          ref={canvasRef}
          onPlacedChange={handlePlacedChange}
          onSelected={handleSelected}
          onMouseMove={handleMouseMove}
          onHover={handleHover}
          onEscapeKey={handleEscapeKey}
        />

        {/* Mode placement banner */}
        {placingType && (
          <div style={{
            position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(13,71,161,.92)', color: '#e3f2fd',
            padding: '6px 22px', borderRadius: 20, fontSize: 13, fontWeight: 600,
            zIndex: 8, border: '1px solid #1565c0', pointerEvents: 'none',
            backdropFilter: 'blur(4px)',
          }}>
            配置モード: {EQUIPMENT_DEFS[placingType].name} — クリックで設置 | Esc でキャンセル
          </div>
        )}

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'absolute',
            left: tooltip.clientX + 18,
            top: tooltip.clientY + 18,
            background: 'rgba(10,15,40,.97)',
            border: '1px solid #2962ff',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 11,
            lineHeight: 1.65,
            pointerEvents: 'none',
            zIndex: 20,
            minWidth: 180,
          }}>
            <div style={{ color: '#4fc3f7', fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
              {tooltip.equipment.name}
            </div>
            {Object.entries(EQUIPMENT_DEFS[tooltip.equipment.type].specs).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: '#607d8b' }}>{k}</span>
                <span style={{ color: '#e2e8f0' }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Properties panel */}
        {selected && (
          <PropsPanel
            equipment={selected}
            onRotate={handleRotateSelected}
            onDelete={handleDeleteSelected}
            onClose={() => setSelected(null)}
          />
        )}

        {/* Status bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(12,12,30,.92)', borderTop: '1px solid #1e2d5a',
          padding: '5px 16px', display: 'flex', gap: 24, alignItems: 'center',
          fontSize: 11, color: '#546e8a', zIndex: 5, backdropFilter: 'blur(4px)',
        }}>
          <span>
            座標: (<span style={{ color: '#4fc3f7' }}>{mouseCoord.x}</span>,{' '}
            <span style={{ color: '#4fc3f7' }}>{mouseCoord.z}</span>) m
          </span>
          <span>
            左クリック=配置/選択 &nbsp;|&nbsp; 右ドラッグ=回転 &nbsp;|&nbsp; ホイール=ズーム
          </span>
          <span style={{ marginLeft: 'auto' }}>
            R=90°回転 &nbsp;|&nbsp; Del=削除 &nbsp;|&nbsp; Home=目線に戻す &nbsp;|&nbsp; Esc=キャンセル
          </span>
        </div>
      </div>
    </div>
  );
}
