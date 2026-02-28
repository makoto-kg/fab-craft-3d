'use client';

import React, { useRef } from 'react';
import { EQUIPMENT_DEFS, EQUIPMENT_TYPES } from '@/lib/equipmentDefs';
import { EquipmentType } from '@/lib/types';

interface SidebarProps {
  counts: Partial<Record<EquipmentType, number>>;
  placingType: EquipmentType | null;
  onSelectType(type: EquipmentType): void;
  onSave(): void;
  onLoadFile(file: File): void;
}

// Group definitions for display in the sidebar
const SECTIONS: { label: string; types: EquipmentType[] }[] = [
  { label: '露光装置 Lithography', types: ['EUV'] },
  { label: '成膜装置 Deposition',  types: ['CVD'] },
  { label: 'CMP',                  types: ['CMP'] },
  { label: 'エッチング Etching',    types: ['ETCH'] },
  { label: '検査装置 Inspection',   types: ['SEM'] },
];

export function Sidebar({ counts, placingType, onSelectType, onSave, onLoadFile }: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalCount = EQUIPMENT_TYPES.reduce((s, t) => s + (counts[t] ?? 0), 0);

  return (
    <aside style={{
      width: 232,
      minWidth: 232,
      background: '#12122a',
      borderRight: '1px solid #1e2d5a',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      zIndex: 10,
    }}>
      {/* Header */}
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        padding: '14px 16px',
        background: 'linear-gradient(135deg,#0f3460,#1a237e)',
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: '#4fc3f7',
        borderBottom: '1px solid #1e2d5a',
      }}>
        🏭 Fab Craft 3D
      </div>

      {/* Equipment sections */}
      {SECTIONS.map(({ label, types }) => (
        <div key={label}>
          <div style={{
            fontSize: 10, color: '#546e8a', padding: '10px 16px 4px',
            textTransform: 'uppercase', letterSpacing: 1,
          }}>
            {label}
          </div>
          {types.map((type) => {
            const def = EQUIPMENT_DEFS[type];
            const active = placingType === type;
            return (
              <button
                key={type}
                onClick={() => onSelectType(type)}
                style={{
                  display: 'flex', alignItems: 'center', padding: '9px 14px',
                  border: 'none', borderBottom: '1px solid #1a1a3a',
                  background: active ? '#0d47a1' : 'transparent',
                  color: active ? '#fff' : '#cfd8e3',
                  cursor: 'pointer', width: '100%', textAlign: 'left', gap: 10,
                  transition: 'background .15s',
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = '#1a2a4a';
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <div style={{
                  width: 34, height: 20, borderRadius: 3,
                  background: def.color, flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{def.name}</div>
                  <div style={{ fontSize: 10, color: active ? '#90caf9' : '#7a9abc', marginTop: 1 }}>
                    {def.sub}
                  </div>
                </div>
                {(counts[type] ?? 0) > 0 && (
                  <span style={{
                    marginLeft: 'auto', background: def.color + '44',
                    color: '#90caf9', fontSize: 10, padding: '1px 6px',
                    borderRadius: 10, border: '1px solid ' + def.color + '66',
                  }}>
                    ×{counts[type]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Summary */}
      {totalCount > 0 && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid #1e2d5a' }}>
          <div style={{ fontSize: 10, color: '#546e8a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
            装置一覧
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {EQUIPMENT_TYPES.filter((t) => (counts[t] ?? 0) > 0).map((t) => (
              <span key={t} style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10,
                background: '#1a2a4a', color: '#90caf9', border: '1px solid #1e3a5a',
              }}>
                {t} ×{counts[t]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Layout management */}
      <div style={{ padding: 12, borderTop: '1px solid #1e2d5a' }}>
        <div style={{ fontSize: 10, color: '#546e8a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          レイアウト管理
        </div>
        <button onClick={onSave} style={sbBtnStyle}>💾 保存 (JSON)</button>
        <button onClick={() => fileInputRef.current?.click()} style={sbBtnStyle}>📂 読み込み</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onLoadFile(f);
            e.target.value = '';
          }}
        />
      </div>
    </aside>
  );
}

const sbBtnStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '7px 10px', marginBottom: 6,
  border: '1px solid #1e3a5a', background: 'transparent', color: '#90a4ae',
  borderRadius: 5, cursor: 'pointer', fontSize: 12, textAlign: 'center',
};
