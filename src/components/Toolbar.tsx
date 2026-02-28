'use client';

import React from 'react';
import { AppMode } from '@/lib/types';

interface ToolbarProps {
  mode: AppMode;
  equipmentCount: number;
  ohtCount: number;
  onSetMode(mode: 'select' | 'move'): void;
  onResetCamera(): void;
  onSnapEyeHeight(): void;
  onTopView(): void;
  onPerspView(): void;
  onClearAll(): void;
  onOhtCountChange(count: number): void;
}

export function Toolbar({
  mode,
  equipmentCount,
  ohtCount,
  onSetMode,
  onResetCamera,
  onSnapEyeHeight,
  onTopView,
  onPerspView,
  onClearAll,
  onOhtCountChange,
}: ToolbarProps) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 46,
      background: 'rgba(12,12,30,.92)', display: 'flex', alignItems: 'center',
      padding: '0 14px', gap: 6, borderBottom: '1px solid #1e2d5a', zIndex: 5,
      backdropFilter: 'blur(4px)',
    }}>
      <TBtn active={mode === 'select'} onClick={() => onSetMode('select')}>🖱 選択</TBtn>
      <TBtn active={mode === 'move'}   onClick={() => onSetMode('move')}>✥ 移動</TBtn>

      <Sep />

      <TBtn onClick={onResetCamera}>⌂ リセット</TBtn>
      <TBtn onClick={onSnapEyeHeight} title="目線の高さに戻す (Home)">👁 目線</TBtn>
      <TBtn onClick={onTopView}>📐 平面図</TBtn>
      <TBtn onClick={onPerspView}>🎲 透視図</TBtn>

      <Sep />

      <TBtn onClick={onClearAll} style={{ color: '#ef9a9a' }}>🗑 全削除</TBtn>

      <Sep />

      <span style={{ color: '#546e8a', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
        OHT:&nbsp;
        <button
          onClick={() => onOhtCountChange(Math.max(1, ohtCount - 1))}
          style={{
            width: 22, height: 22, padding: 0,
            border: '1px solid #1e3a5a', background: 'transparent',
            color: '#90a4ae', cursor: 'pointer', borderRadius: 3,
            fontSize: 14, lineHeight: '20px', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >-</button>
        <span style={{ color: '#4fc3f7', fontWeight: 700, minWidth: 18, textAlign: 'center' }}>
          {ohtCount}
        </span>
        <button
          onClick={() => onOhtCountChange(Math.min(20, ohtCount + 1))}
          style={{
            width: 22, height: 22, padding: 0,
            border: '1px solid #1e3a5a', background: 'transparent',
            color: '#90a4ae', cursor: 'pointer', borderRadius: 3,
            fontSize: 14, lineHeight: '20px', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >+</button>
      </span>

      <div style={{ flex: 1 }} />

      <span style={{ color: '#546e8a', fontSize: 12 }}>
        装置数:&nbsp;
        <span style={{ color: '#4fc3f7', fontWeight: 700 }}>{equipmentCount}</span>
      </span>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function TBtn({
  children,
  active,
  onClick,
  style,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick(): void;
  style?: React.CSSProperties;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '5px 13px',
        border: '1px solid #1e3a5a',
        background: active ? '#0d47a1' : 'transparent',
        color: active ? '#fff' : '#90a4ae',
        cursor: 'pointer',
        borderRadius: 4,
        fontSize: 12,
        whiteSpace: 'nowrap',
        transition: 'background .15s, color .15s',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = '#1a2a4a';
          (e.currentTarget as HTMLButtonElement).style.color = '#fff';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = style?.color ?? '#90a4ae';
        }
      }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 22, background: '#1e2d5a', margin: '0 4px' }} />;
}
