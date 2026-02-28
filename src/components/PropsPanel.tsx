'use client';

import React from 'react';
import { EQUIPMENT_DEFS } from '@/lib/equipmentDefs';
import { PlacedEquipment } from '@/lib/types';

interface PropsPanelProps {
  equipment: PlacedEquipment;
  onRotate(): void;
  onDelete(): void;
  onClose(): void;
}

export function PropsPanel({ equipment, onRotate, onDelete, onClose }: PropsPanelProps) {
  const def = EQUIPMENT_DEFS[equipment.type];
  const deg = Math.round((equipment.rot * 180) / Math.PI) % 360;

  return (
    <div style={{
      position: 'absolute', right: 14, top: 58,
      width: 200,
      background: 'rgba(12,12,30,.96)',
      border: '1px solid #1e3a5a',
      borderRadius: 8,
      padding: 12,
      fontSize: 12,
      zIndex: 10,
      backdropFilter: 'blur(4px)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{
          width: 10, height: 10, borderRadius: 2,
          background: def.color, marginRight: 8, flexShrink: 0,
        }} />
        <div style={{ color: '#4fc3f7', fontWeight: 700, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {equipment.name}
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#546e8a', cursor: 'pointer', padding: '0 0 0 6px', fontSize: 14 }}
        >
          ✕
        </button>
      </div>

      {/* Properties */}
      {[
        ['タイプ', def.name],
        ['X 位置', `${equipment.x.toFixed(0)} m`],
        ['Z 位置', `${equipment.z.toFixed(0)} m`],
        ['回転角', `${deg}°`],
        ['フットプリント', `${def.W} × ${def.D} m`],
      ].map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
          <span style={{ color: '#607d8b' }}>{k}</span>
          <span style={{ color: '#e2e8f0', marginLeft: 8, textAlign: 'right' }}>{v}</span>
        </div>
      ))}

      {/* Spec divider */}
      <div style={{ borderTop: '1px solid #1e2d5a', margin: '8px 0 6px' }} />
      <div style={{ fontSize: 10, color: '#546e8a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>スペック</div>
      {Object.entries(def.specs).map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', margin: '3px 0', fontSize: 11 }}>
          <span style={{ color: '#607d8b' }}>{k}</span>
          <span style={{ color: '#b0bec5', marginLeft: 8, textAlign: 'right' }}>{v}</span>
        </div>
      ))}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <ActionBtn onClick={onRotate}>↻ 回転</ActionBtn>
        <ActionBtn onClick={onDelete} danger>✕ 削除</ActionBtn>
      </div>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick(): void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, padding: '5px 6px',
        border: `1px solid ${hovered && danger ? '#ef4444' : '#1e3a5a'}`,
        background: hovered ? (danger ? '#7f1d1d' : '#1a2a4a') : 'transparent',
        color: hovered ? '#fff' : '#90a4ae',
        borderRadius: 4, cursor: 'pointer', fontSize: 11,
        transition: 'all .15s',
      }}
    >
      {children}
    </button>
  );
}
