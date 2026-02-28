import { EquipmentDef, EquipmentType } from './types';

export const EQUIPMENT_DEFS: Record<EquipmentType, EquipmentDef> = {
  EUV: {
    name: 'EUV Lithography',
    sub: 'ASML NXE-style',
    W: 13.5,
    D: 3.6,
    color: '#1565c0',
    specs: {
      'フットプリント': '13.5 × 3.6 m',
      '重量': '~180,000 kg',
      '消費電力': '~1.2 MW',
      'EUV波長': '13.5 nm',
      'スループット': '170 wph',
    },
  },
  CVD: {
    name: 'CVD / ALD System',
    sub: 'クラスタツール型',
    W: 3.8,
    D: 3.2,
    color: '#1b5e20',
    specs: {
      'フットプリント': '3.8 × 3.2 m',
      'チャンバー数': '4–8',
      '温度範囲': '25–1200 °C',
      'ガス系': '多種 ALD/CVD',
    },
  },
  CMP: {
    name: 'CMP System',
    sub: '化学機械研磨',
    W: 4.8,
    D: 3.2,
    color: '#e65100',
    specs: {
      'フットプリント': '4.8 × 3.2 m',
      'プラテン数': '3–4',
      'ウェーハ径': '300 mm',
      'スラリー': '多種対応',
    },
  },
  ETCH: {
    name: 'Dry Etch System',
    sub: 'プラズマエッチング',
    W: 3.2,
    D: 2.8,
    color: '#b71c1c',
    specs: {
      'フットプリント': '3.2 × 2.8 m',
      'チャンバー数': '2–4',
      'プラズマ': 'ICP / CCP',
      '周波数': '2 / 13.56 / 60 MHz',
    },
  },
  SEM: {
    name: 'CD-SEM / Review SEM',
    sub: '電子顕微鏡検査',
    W: 2.2,
    D: 2.0,
    color: '#4a148c',
    specs: {
      'フットプリント': '2.2 × 2.0 m',
      '分解能': '< 1 nm',
      '加速電圧': '0.1–30 kV',
      'ビーム電流': '1 pA–1 µA',
    },
  },
};

export const EQUIPMENT_TYPES = Object.keys(EQUIPMENT_DEFS) as EquipmentType[];
