#!/usr/bin/env python3
"""
gen_models.py — Generate GLB equipment models for Fab Craft 3D.

Coordinate system (matches Three.js / GLTF):
  X → right   Y → up   Z → toward viewer
  All dimensions in metres.

Usage:
  python3 scripts/gen_models.py
Outputs:
  public/models/EUV.glb
  public/models/CVD.glb
  public/models/CMP.glb
  public/models/ETCH.glb
  public/models/SEM.glb
"""

import os
import numpy as np
import trimesh
from trimesh import creation
from trimesh.transformations import (
    rotation_matrix as rotm,
    translation_matrix as transm,
)

OUTPUT = os.path.join(os.path.dirname(__file__), "..", "public", "models")
os.makedirs(OUTPUT, exist_ok=True)

# ─── Material helpers ─────────────────────────────────────────────────────────

def _rgb(h: str):
    h = h.lstrip("#")
    return [int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4)]


def pbr(color: str, metallic: float = 0.82, rough: float = 0.28):
    """
    PBR material.
    Defaults → brushed stainless steel / anodised aluminium finish.
    Override metallic / rough per-part as needed:
      Polished metal   : metallic≈0.95, rough≈0.08
      Brushed steel    : metallic≈0.82, rough≈0.28  (default)
      Painted metal    : metallic≈0.55, rough≈0.45
      Plastic / rubber : metallic≈0.02, rough≈0.55
      Viewport glass   : metallic≈0.05, rough≈0.04
    """
    return trimesh.visual.material.PBRMaterial(
        baseColorFactor=[*_rgb(color), 1.0],
        metallicFactor=metallic,
        roughnessFactor=rough,
    )


def _apply_mat(mesh: trimesh.Trimesh, color: str,
               mt: float = None, ro: float = None) -> trimesh.Trimesh:
    kw = {}
    if mt is not None: kw["metallic"] = mt
    if ro is not None: kw["rough"]    = ro
    mesh.visual = trimesh.visual.TextureVisuals(material=pbr(color, **kw))
    return mesh


# ─── Geometry primitives ──────────────────────────────────────────────────────

_part_counter = 0


def _uid():
    global _part_counter
    _part_counter += 1
    return f"p{_part_counter:05d}"


def bx(
    w: float, h: float, d: float,
    x: float = 0, y: float = 0, z: float = 0,
    c: str = "#607080",
    rx: float = None, ry: float = None, rz: float = None,
    mt: float = None, ro: float = None,   # metallic / roughness overrides
) -> trimesh.Trimesh:
    """Axis-aligned box, optionally rotated then translated."""
    m = creation.box(extents=[w, h, d])
    if rz is not None:
        m.apply_transform(rotm(rz, [0, 0, 1]))
    if ry is not None:
        m.apply_transform(rotm(ry, [0, 1, 0]))
    if rx is not None:
        m.apply_transform(rotm(rx, [1, 0, 0]))
    m.apply_translation([x, y, z])
    return _apply_mat(m, c, mt=mt, ro=ro)


def cy(
    r: float, h: float,
    x: float = 0, y: float = 0, z: float = 0,
    c: str = "#607080",
    segs: int = 16,
    axis: str = "y",   # 'y'=vertical  'x'=horiz-X  'z'=horiz-Z
    mt: float = None, ro: float = None,   # metallic / roughness overrides
) -> trimesh.Trimesh:
    """Cylinder.  Default axis='y' (vertical, like Three.js CylinderGeometry)."""
    m = creation.cylinder(radius=r, height=h, sections=segs)
    # trimesh cylinder default axis = Z  →  rotate to desired axis
    if axis == "y":
        m.apply_transform(rotm(np.pi / 2, [1, 0, 0]))   # Z → Y
    elif axis == "x":
        m.apply_transform(rotm(np.pi / 2, [0, 1, 0]))   # Z → X
    # axis == 'z' : keep as-is
    m.apply_translation([x, y, z])
    return _apply_mat(m, c, mt=mt, ro=ro)


def gbx(
    w: float, h: float, d: float,
    x: float = 0, y: float = 0, z: float = 0,
) -> trimesh.Trimesh:
    """Transparent glass box (GLTF alphaMode=BLEND, double-sided)."""
    m = creation.box(extents=[w, h, d])
    m.apply_translation([x, y, z])
    mat = trimesh.visual.material.PBRMaterial(
        baseColorFactor=[0.80, 0.93, 1.0, 0.18],
        metallicFactor=0.0,
        roughnessFactor=0.04,
        alphaMode="BLEND",
        doubleSided=True,
    )
    m.visual = trimesh.visual.TextureVisuals(material=mat)
    return m


def _foup(px: float, py: float, pz: float,
          face_sgn: float, fh: float,
          fw: float = 0.40) -> list:
    """
    FOUP assembly centred at (px, py, pz).

    face_sgn : +1 → front door on +X face,  -1 → front door on -X face
    fh       : FOUP height  (m)
    fw       : FOUP width   (m, parallel to equipment face / Z axis)

    Dimensions follow SEMI E47.1 standard for 300 mm wafer FOUP:
      Depth  FD = 0.26 m  (X direction, perpendicular to equipment face)
      Width  fw = 0.40 m  (Z direction, parallel to equipment face)
      Height fh = 0.38 m  (Y direction)
    """
    FD = 0.26          # depth  (X direction)  SEMI std ≈ 260 mm
    parts = []

    # ── Shell (warm brown) ───────────────────────────────────────
    parts.append(bx(FD, fh, fw,
                    px, py, pz, "#8b6538", mt=0.05, ro=0.60))

    # ── Front door (slightly darker brown panel, face_sgn side) ──
    door_x = px + face_sgn * (FD / 2 + 0.005)
    parts.append(bx(0.012, fh * 0.86, fw * 0.82,
                    door_x, py, pz, "#7a5830", mt=0.05, ro=0.55))

    # ── Door recess frame (thin dark border) ─────────────────────
    parts.append(bx(0.006, fh * 0.90, fw * 0.88,
                    door_x - face_sgn * 0.004, py, pz,
                    "#5a4020", mt=0.55, ro=0.40))

    # ── Top handle bar ────────────────────────────────────────────
    parts.append(bx(FD * 0.32, 0.048, fw * 0.50,
                    px, py + fh / 2 + 0.024, pz,
                    "#3a4a5a", mt=0.85, ro=0.28))
    # Handle mounting stubs
    for sz in (-fw * 0.14, fw * 0.14):
        parts.append(bx(FD * 0.10, 0.030, 0.018,
                        px, py + fh / 2 + 0.005, pz + sz,
                        "#3a4a5a", mt=0.85, ro=0.28))

    # ── White label area on door ──────────────────────────────────
    parts.append(bx(0.007, fh * 0.22, fw * 0.44,
                    door_x + face_sgn * 0.004, py + fh * 0.10, pz,
                    "#f5f5f5", mt=0.02, ro=0.80))

    # ── Latch indicator dot (green = loaded/ready) ────────────────
    parts.append(bx(0.007, 0.030, 0.030,
                    door_x + face_sgn * 0.004, py - fh * 0.28, pz,
                    "#22c55e", mt=0.02, ro=0.40))

    return parts


def build_scene(parts: list) -> trimesh.Scene:
    scene = trimesh.Scene()
    for m in parts:
        scene.add_geometry(m, geom_name=_uid())
    return scene


def export(scene: trimesh.Scene, name: str):
    path = os.path.join(OUTPUT, f"{name}.glb")
    data = scene.export(file_type="glb")
    with open(path, "wb") as f:
        f.write(data)
    size_kb = len(data) / 1024
    print(f"  ✓  {name}.glb   {size_kb:.0f} KB")


# ─── Shared shorthand constants ───────────────────────────────────────────────

# Metallic / roughness presets used across models
_POL = dict(mt=0.95, ro=0.08)   # polished metal  (mirrors, wafer chuck, platen)
_BRS = dict(mt=0.82, ro=0.28)   # brushed steel   (default structural)
_ANO = dict(mt=0.78, ro=0.35)   # anodised colour (side panels, darker covers)
_PNT = dict(mt=0.55, ro=0.48)   # painted metal   (heavier housings)
_PAD = dict(mt=0.40, ro=0.70)   # polishing pad   (rough abrasive surface)
_VPT = dict(mt=0.05, ro=0.04)   # viewport glass
_LED = dict(mt=0.02, ro=0.45)   # indicator LED / signal light (coloured plastic)
_SCR = dict(mt=0.02, ro=0.80)   # display screen


# ═══════════════════════════════════════════════════════════════════════════════
#  EUV Lithography (ASML NXE-style)
#  Footprint: 13.5 × 3.6 m,  Height: ~4.5 m (including reticle stage)
# ═══════════════════════════════════════════════════════════════════════════════

def make_euv():
    p = []
    H = 2.4   # main frame height

    # ── Main frame ──────────────────────────────────────────────
    p.append(bx(8.5, H, 3.4,    -1,   H/2,  0,     "#fafbfd", **_BRS))
    # Panel lines (thin decorative strips)
    p.append(bx(8.5, 0.05, 0.02, -1, H*0.7,  1.65, "#c8cdd2", **_BRS))
    p.append(bx(8.5, 0.05, 0.02, -1, H*0.7, -1.65, "#c8cdd2", **_BRS))

    # ── LPS (Light Source Pod) ───────────────────────────────────
    p.append(bx(3.8, 2.6, 3.0,  -6.5, 1.30,  0,    "#fafbfd", **_BRS))
    p.append(bx(3.8, 0.15,3.0,  -6.5, 2.68,  0,    "#37474f", **_BRS))   # top lid — keep EUV color
    # CO₂ laser output window
    p.append(bx(0.05,0.42,0.42, -4.60,1.60,  0,    "#0d47a1", **_VPT))
    # Beam duct  (horizontal box, X-direction)
    p.append(bx(1.0, 0.50,0.50, -4.0, 1.60,  0,    "#fafbfd", **_BRS))
    # Tin nozzle  (horizontal cylinder along X)
    p.append(cy(0.08,0.85, -5.2, 1.60,  0,   "#546e7a", segs=8,  axis="x", **_POL))
    # LPS leveling feet
    for fx, fz in [(-5.8,-1.3),(-7.2,-1.3),(-5.8,1.3),(-7.2,1.3)]:
        p.append(cy(0.12, 0.07,  fx, 0.035, fz, "#607d8b", segs=8, **_BRS))

    # ── Illumination column ──────────────────────────────────────
    p.append(bx(0.8, 1.4, 0.8, -2.5, H+0.70,  0,  "#fafbfd", **_BRS))
    p.append(cy(0.35,0.90, -2.5, H+1.65, 0,        "#fafbfd", segs=20, **_BRS))

    # ── Projection Optics Box (POB) ──────────────────────────────
    p.append(bx(2.8, 2.0, 2.6,  0.5, H+1.00,  0,  "#fafbfd", **_BRS))
    p.append(cy(0.60,1.80,  0.5, H+0.90,  0,       "#fafbfd", segs=24, **_BRS))  # mirror housing
    p.append(bx(1.0, 0.50,1.0,  0.5, H+2.20,  0,  "#37474f", **_BRS))  # top slab — keep EUV color
    # Ribs
    for rz in [-0.9, 0.0, 0.9]:
        p.append(bx(0.10,0.30,0.10, 0.5, H+2.00, rz, "#546e7a", **_BRS))

    # ── Reticle Stage ────────────────────────────────────────────
    p.append(bx(3.4, 0.70,2.8,  0.4, H+2.65,  0,  "#fafbfd", **_BRS))
    p.append(bx(1.8, 0.12,1.6,  0.4, H+3.02,  0,  "#546e7a", **_POL))  # clamp
    p.append(bx(0.15,0.15,1.8,  0.4, H+2.95,  0,  "#607d8b", **_POL))  # handler arm
    # Reticle library (SMIF pod)
    p.append(bx(1.4, 1.80,1.4,  2.2, H+2.20, 0.8, "#fafbfd", **_BRS))
    p.append(bx(0.05,1.40,1.2,  2.95,H+2.20, 0.8, "#d0d4d8", **_BRS))

    # ── Wafer Stage ──────────────────────────────────────────────
    p.append(bx(4.2, 1.60,3.4,  4.0, 0.80,   0,   "#fafbfd", **_BRS))
    p.append(bx(2.4, 0.18,2.4,  4.0, 1.69,   0,   "#78909c", **_POL))  # granite platform
    p.append(cy(0.16,0.05,  4.0, 1.78,  0,         "#90a4ae", segs=32, **_POL))  # wafer chuck
    # Interferometer blocks
    for ox, oz in [(-1,1),(1,1),(1,-1),(-1,-1)]:
        p.append(bx(0.12,0.12,0.12, 4.0+ox, 1.85, oz, "#546e7a", **_POL))
    # Linear motor rails
    for rx_,rz_ in [(3.0,-1.4),(5.0,-1.4),(3.0,1.4),(5.0,1.4)]:
        p.append(bx(0.15,0.15,3.2, rx_, 1.68, rz_, "#fafbfd", **_BRS))

    # ── EFEM ─────────────────────────────────────────────────────
    p.append(bx(2.6, 2.2, 3.4,  6.9,  1.10,  0,   "#fafbfd", **_BRS))
    p.append(bx(1.8, 1.0, 1.8,  6.9,  0.80, 0.2,  "#fafbfd", **_BRS))   # robot housing
    # ATM robot
    p.append(cy(0.18,0.80,  6.9,  0.60,  0,        "#d8dde2", segs=12, **_BRS))
    p.append(bx(0.60,0.06,0.08, 7.2, 0.90,  0,    "#546e7a", **_POL))
    p.append(bx(0.40,0.06,0.08, 7.6, 0.90,  0,    "#607d8b", **_POL))
    p.append(cy(0.14,0.03,  7.9, 0.90,  0,         "#78909c", segs=16, **_POL))
    # FOUP load ports ×3  (台 / table-pedestal style, door flush against EFEM wall)
    # EFEM wall face at x=8.20; FD=0.26, door offset=0.135 → FOUP centre px=8.335
    # SEMI E47.1: width=0.40 m (Z), depth=0.26 m (X), height=0.38 m
    for z_lp in [-1.0, 0.0, 1.0]:
        p.append(bx(0.015, 0.44, 0.44, 8.207, 1.28, z_lp, "#2d3748", mt=0.70, ro=0.30))  # LP port frame on EFEM wall
        p.append(bx(0.15, 1.02, 0.44, 8.335, 0.51, z_lp, "#dde4ec", mt=0.58, ro=0.40))   # vertical column
        p.append(bx(0.52, 0.08, 0.46, 8.335, 1.05, z_lp, "#c8d8e8", mt=0.62, ro=0.28))   # table top slab
        p.append(cy(0.030, 0.04, 8.395, 0.86, z_lp, "#22c55e", segs=8, axis="z", **_LED)) # status LED
        p += _foup(8.335, 1.28, z_lp, -1, 0.38)  # FOUP door flush with EFEM wall

    # ── Vacuum pumps × 4 (rear) ──────────────────────────────────
    for vx in [-5.0, -2.5, 0.0, 2.5]:
        p.append(cy(0.28, 1.40, vx, 0.70, -2.20,      "#263238", segs=12, **_BRS))
        p.append(cy(0.18, 0.28, vx, 1.54, -2.20,      "#37474f", segs=12, **_POL))

    # ── Chillers (rear) ──────────────────────────────────────────
    for cx in [1.0, 3.5]:
        p.append(bx(1.8, 1.90, 0.90, cx, 0.95, -2.30, "#263238", **_BRS))
        for i in range(5):
            p.append(bx(1.6, 0.04, 0.02, cx, 0.30+i*0.32, -1.88, "#1a202c", **_ANO))

    # ── Gas cabinet ──────────────────────────────────────────────
    p.append(bx(0.9, 2.30, 0.9, -6.2,  1.15, -1.4,   "#fafbfd", **_BRS))

    # ── Control rack ─────────────────────────────────────────────
    p.append(bx(0.85,2.20,0.9,  8.0,  1.10, -1.35,   "#fafbfd", **_BRS))
    for i in range(5):
        p.append(bx(0.72,0.16,0.02, 8.0, 0.28+i*0.4, -0.92, "#1565c0", **_SCR))

    # ── Cable trays ──────────────────────────────────────────────
    p.append(bx(10.0,0.14,0.36, -1.0, H+0.07,  1.60, "#d0d4d8", **_BRS))
    p.append(bx(10.0,0.14,0.36, -1.0, H+0.07, -1.60, "#d0d4d8", **_BRS))

    # ── Signal tower light ───────────────────────────────────────
    # top=red(H+1.08), mid=yellow(H+0.93), bottom=green(H+0.78)
    # Lamp colors set to dark "#1a1a1a" — Three.js dynamic lamps overlay these.
    p.append(cy(0.05, 0.70, 6.5, H+0.35, 1.5,        "#d0d4d8", segs=8, **_BRS))
    p.append(cy(0.08, 0.12, 6.5, H+0.78, 1.5,        "#1a1a1a", segs=8, **_LED))
    p.append(cy(0.08, 0.12, 6.5, H+0.93, 1.5,        "#1a1a1a", segs=8, **_LED))
    p.append(cy(0.08, 0.12, 6.5, H+1.08, 1.5,        "#1a1a1a", segs=8, **_LED))

    # ── Leveling pads ─────────────────────────────────────────────
    for px, pz in [(-6,-1.5),(-6,1.5),(-1,-1.7),(-1,1.7),(4,-1.7),(4,1.7),(7.5,-1.5),(7.5,1.5)]:
        p.append(cy(0.14, 0.06, px, 0.03, pz,         "#546e7a", segs=8, **_POL))

    return build_scene(p)


# ═══════════════════════════════════════════════════════════════════════════════
#  CVD / ALD Cluster Tool
# ═══════════════════════════════════════════════════════════════════════════════

def make_cvd():
    p = []

    # ── Central transfer chamber (hexagonal) ─────────────────────
    p.append(cy(1.15, 1.70, 0, 0.85, 0,  "#fafbfd", segs=6, **_BRS))
    p.append(cy(1.25, 0.18, 0, 1.76, 0,  "#2e7d32", segs=6, **_POL))  # top cap — keep green
    p.append(cy(1.25, 0.12, 0, 0.05, 0,  "#fafbfd", segs=6, **_BRS))

    # ── 4 Process chambers ───────────────────────────────────────
    for px, pz in [(1.9,0.8),(1.9,-0.8),(-1.9,0.8),(-1.9,-0.8)]:
        p.append(bx(1.3,1.6,1.3, px,  0.80, pz, "#fafbfd", **_BRS))
        p.append(bx(1.4,0.18,1.4,px,  1.67, pz, "#2e7d32", **_POL))  # top — keep green
        p.append(cy(0.55,0.40, px, 1.85, pz,    "#1b5e20", segs=20, **_POL))  # dome — keep green
        # RF matching unit
        side = 0.88 if px > 0 else -0.88
        p.append(bx(0.40,0.42,0.40, px+side, 0.60, pz, "#fafbfd", **_BRS))
        # Viewport
        vz = pz + (0.67 if pz > 0 else -0.67)
        p.append(cy(0.09,0.06, px, 0.95, vz,    "#a5d6a7", segs=12, axis="z", **_VPT))
        # Gate valve connector to center
        p.append(bx(0.25,0.30,0.25, px*0.5, 0.80, pz*0.5, "#fafbfd", **_BRS))
        # Turbo pump exhaust
        ex_side = 0.62 if pz > 0 else -0.62
        p.append(cy(0.07,0.60, px, 0.20, pz+ex_side, "#388e3c", segs=8, axis="z", **_BRS))

    # ── EFEM ─────────────────────────────────────────────────────
    p.append(bx(1.6,2.0,3.0, 2.8, 1.0, 0,  "#fafbfd", **_BRS))
    p.append(bx(1.7,0.16,3.1,2.8, 2.08,0,  "#2e7d32", **_POL))  # top — keep green
    # EFEM wall face at x=3.60; FD=0.26, door offset=0.135 → FOUP centre px=3.735
    for z_lp in [-1.0, 1.0]:
        p.append(bx(0.015, 0.44, 0.44, 3.607, 1.28, z_lp, "#2d3748", mt=0.70, ro=0.30))  # LP port frame on EFEM wall
        p.append(bx(0.13, 1.02, 0.44, 3.735, 0.51, z_lp, "#dde4ec", mt=0.58, ro=0.40))   # vertical column
        p.append(bx(0.50, 0.08, 0.46, 3.735, 1.05, z_lp, "#c8d8e8", mt=0.62, ro=0.28))   # table top slab
        p.append(cy(0.030, 0.04, 3.795, 0.86, z_lp, "#22c55e", segs=8, axis="z", **_LED)) # status LED
        p += _foup(3.735, 1.28, z_lp, -1, 0.38)  # FOUP door flush with EFEM wall

    # ── Gas cabinet ──────────────────────────────────────────────
    p.append(bx(0.85,2.2,1.1, -2.5, 1.1, 0.7,  "#fafbfd", **_BRS))
    for i in range(4):
        p.append(cy(0.03,1.1, -2.1, 1.15+i*0.18, -0.15, "#388e3c", segs=8, axis="z", **_BRS))

    # ── Vacuum system ─────────────────────────────────────────────
    p.append(bx(1.1,1.6,2.8, -2.5, 0.8, -0.8, "#fafbfd", **_BRS))
    p.append(cy(0.28,1.0, -2.5, 0.5, -0.9,    "#1b5e20", segs=12, **_BRS))
    p.append(cy(0.28,1.0, -2.5, 0.5,  0.3,    "#1b5e20", segs=12, **_BRS))

    # ── Signal tower ─────────────────────────────────────────────
    # top=red(2.88), mid=yellow(2.73), bottom=green(2.58); lamps dark for dynamic override
    p.append(cy(0.05,0.90, 0, 2.30, 0, "#d0d4d8", segs=8, **_BRS))
    p.append(cy(0.08,0.12, 0, 2.58, 0, "#1a1a1a", segs=8, **_LED))
    p.append(cy(0.08,0.12, 0, 2.73, 0, "#1a1a1a", segs=8, **_LED))
    p.append(cy(0.08,0.12, 0, 2.88, 0, "#1a1a1a", segs=8, **_LED))

    return build_scene(p)


# ═══════════════════════════════════════════════════════════════════════════════
#  CMP System
# ═══════════════════════════════════════════════════════════════════════════════

def make_cmp():
    p = []

    # ── Main frame ───────────────────────────────────────────────
    p.append(bx(4.8,1.65,3.0, 0, 0.825, 0, "#fafbfd", **_BRS))
    p.append(bx(4.8,0.16, 3.0, 0, 1.73,  0, "#e64a19", **_POL))  # top — keep orange-red

    # ── 3 polishing platens ──────────────────────────────────────
    # Glass enclosure: GX=±2.22, GZF=+0.30, GZB=-1.10, GZC=-0.40
    # Platen radii reduced to stay well inside glass faces
    for px in [-1.4, 0.0, 1.4]:
        p.append(cy(0.58,0.14, px, 1.81,-0.4, "#6d2813", segs=32, **_POL))   # platen disk (was 0.65)
        p.append(cy(0.53,0.06, px, 1.87,-0.4, "#8d3b14", segs=32, **_PAD))   # polishing pad (was 0.60)
        # Conditioning arm + disk (arm shortened; disk radius reduced to clear side glass)
        p.append(bx(0.72,0.05,0.08, px+0.24, 1.93,-0.4, "#a04000", **_POL))
        p.append(cy(0.11,0.06, px+0.60, 1.93,-0.4, "#7b3500", segs=16, **_POL))  # was r=0.14 at x+0.68
        # Slurry nozzle arm
        p.append(bx(0.50,0.04,0.04, px-0.15, 1.95,-0.05, "#bf4500", **_BRS))
        p.append(cy(0.03,0.12, px-0.38, 1.90, 0,  "#d4500c", segs=8, axis="z", **_BRS))

    # ── Polish head carousel ─────────────────────────────────────
    # Carousel disk radius reduced from 0.70→0.62: was exactly at GZF/GZB glass faces
    p.append(cy(0.10,0.90, 0, 2.25,-0.4, "#a04000", segs=8, **_BRS))
    p.append(cy(0.62,0.08, 0, 2.70,-0.4, "#7b3500", segs=24, **_POL))

    # ── Slurry delivery system ───────────────────────────────────
    p.append(bx(0.85,1.3,0.7,  -2.7, 0.65, 0.7, "#fafbfd", **_BRS))
    for i in range(3):
        p.append(cy(0.14,0.65, -2.7+i*0.38-0.38, 1.60, 0.7, "#a04000", segs=12, **_BRS))

    # ── Wafer cleaning module ────────────────────────────────────
    p.append(bx(2.2,1.55,3.0,  3.0, 0.775, 0, "#fafbfd", **_BRS))
    p.append(bx(2.2,0.15, 3.0,  3.0, 1.625, 0, "#bf360c", **_POL))  # top — keep orange-red
    for bz in [-1.0, 1.0]:
        p.append(bx(0.65,1.3,0.65, 3.5, 0.75, bz, "#fafbfd", **_BRS))
        p.append(cy(0.20,0.80, 3.5, 1.40, bz,     "#a04000", segs=12, **_BRS))

    # ── Load station ─────────────────────────────────────────────
    p.append(bx(1.1,1.6,1.4, -2.7, 0.80,-0.75, "#fafbfd", **_BRS))
    # Load station left wall face at x=-3.25; FD=0.26, door offset=0.135 → FOUP centre px=-3.385
    # LP z positions: fz+0.75 ∈ {-0.45, 0.45}
    for fz in [-1.2, -0.3]:
        p.append(bx(0.015, 0.44, 0.44, -3.257, 1.28, fz+0.75, "#2d3748", mt=0.70, ro=0.30))  # LP port frame on wall
        p.append(bx(0.13, 1.02, 0.44, -3.385, 0.51, fz+0.75, "#dde4ec", mt=0.58, ro=0.40))   # vertical column
        p.append(bx(0.46, 0.08, 0.46, -3.385, 1.05, fz+0.75, "#c8d8e8", mt=0.62, ro=0.28))   # table top slab
        p.append(cy(0.030, 0.04, -3.445, 0.86, fz+0.75, "#22c55e", segs=8, axis="z", **_LED)) # status LED
        p += _foup(-3.385, 1.28, fz+0.75, +1, 0.38)  # FOUP door flush with load station wall

    # ── Control touchscreen ──────────────────────────────────────
    p.append(bx(0.06, 0.06, 0.42, 3.0, 1.62, 1.71, "#5a1505", **_BRS))   # arm
    p.append(bx(0.04, 1.2, 0.85, 3.000, 1.40, 1.90,  "#3d1505", ry=-0.39, **_ANO))  # frame
    p.append(bx(0.03, 0.95,0.70, 3.032, 1.40, 1.913, "#1565c0", ry=-0.39, **_SCR))  # screen

    # ── Polishing-area glass enclosure ───────────────────────────
    GY0 = 1.82; GH  = 1.23; GYC = GY0 + GH/2
    GX  = 2.22; GZF = 0.30; GZB = -1.10
    GW  = GX * 2; GD  = GZF - GZB; GT  = 0.025; GZC = (GZF + GZB) / 2

    p.append(gbx(GW, GH, GT,   0,   GYC, GZF))
    p.append(gbx(GW, GH, GT,   0,   GYC, GZB))
    p.append(gbx(GT, GH, GD, -GX,   GYC, GZC))
    p.append(gbx(GT, GH, GD,  GX,   GYC, GZC))
    p.append(gbx(GW, GT, GD,   0, GY0+GH, GZC))

    # Aluminium corner posts & horizontal rails
    for cx in (-GX, GX):
        for cz in (GZF, GZB):
            p.append(bx(0.04, GH, 0.04, cx, GYC, cz, "#78909c", **_POL))
    p.append(bx(GW, 0.04, 0.04,  0, GY0+GH, GZF, "#78909c", **_POL))
    p.append(bx(GW, 0.04, 0.04,  0, GY0+GH, GZB, "#78909c", **_POL))
    p.append(bx(0.04, 0.04, GD, -GX, GY0+GH, GZC, "#78909c", **_POL))
    p.append(bx(0.04, 0.04, GD,  GX, GY0+GH, GZC, "#78909c", **_POL))
    p.append(bx(GW, 0.04, 0.04,  0, GY0, GZF, "#78909c", **_POL))
    p.append(bx(GW, 0.04, 0.04,  0, GY0, GZB, "#78909c", **_POL))
    p.append(bx(0.04, 0.04, GD, -GX, GY0, GZC, "#78909c", **_POL))
    p.append(bx(0.04, 0.04, GD,  GX, GY0, GZC, "#78909c", **_POL))

    # ── Signal tower ─────────────────────────────────────────────
    # top=red(2.95), mid=yellow(2.80), bottom=green(2.65); lamps dark for dynamic override
    p.append(cy(0.05,0.90, 3.0, 2.40, 1.2, "#d0d4d8", segs=8, **_BRS))
    p.append(cy(0.08,0.12, 3.0, 2.65, 1.2, "#1a1a1a", segs=8, **_LED))
    p.append(cy(0.08,0.12, 3.0, 2.80, 1.2, "#1a1a1a", segs=8, **_LED))
    p.append(cy(0.08,0.12, 3.0, 2.95, 1.2, "#1a1a1a", segs=8, **_LED))

    return build_scene(p)


# ═══════════════════════════════════════════════════════════════════════════════
#  Dry Etch System
# ═══════════════════════════════════════════════════════════════════════════════

def make_etch():
    p = []

    # ── Central transfer module ───────────────────────────────────
    p.append(bx(1.5,1.60,1.5, 0, 0.80, 0, "#fafbfd", **_BRS))
    p.append(bx(1.6,0.20,1.6, 0, 1.70, 0, "#991b1b", **_POL))  # top — keep red

    # ── 4 etch chambers ──────────────────────────────────────────
    for px, pz in [(1.7,0.65),(1.7,-0.65),(-1.7,0.65),(-1.7,-0.65)]:
        p.append(bx(1.1,1.55,1.1, px, 0.775, pz, "#fafbfd", **_BRS))
        p.append(bx(1.2,0.18,1.2, px, 1.640, pz, "#7f1d1d", **_POL))  # top — keep red
        p.append(cy(0.50,0.40, px, 1.82, pz,     "#5a1010", segs=20, **_POL))  # ICP dome — keep red
        # RF matching network
        side = 0.85 if px > 0 else -0.85
        p.append(bx(0.50,0.42,0.50, px+side, 0.55, pz, "#fafbfd", **_BRS))
        # RF cable
        p.append(cy(0.04,0.40, px+(side*0.7), 0.50, pz, "#6b1515", segs=8, axis="x" if px>0 else "x", **_BRS))
        # Turbo pump
        vz = pz + (0.75 if pz > 0 else -0.75)
        p.append(cy(0.20,0.80, px, 0.35, vz,     "#7f1d1d", segs=12, **_BRS))
        # Viewport
        vp_side = 0.57 if px > 0 else -0.57
        p.append(cy(0.07,0.05, px+vp_side, 0.90, pz, "#fca5a5", segs=12, axis="x", **_VPT))
        # Gate valve
        p.append(bx(0.22,0.30,0.22, px*0.6, 0.80, pz*0.6, "#7f1d1d", **_BRS))

    # ── EFEM ─────────────────────────────────────────────────────
    p.append(bx(1.5,2.0,2.8, 1.7, 1.0, 0, "#fafbfd", **_BRS))
    p.append(bx(1.6,0.16,2.8,1.7, 2.08,0, "#7f1d1d", **_POL))  # top — keep red
    # EFEM wall face at x=2.45; FD=0.26, door offset=0.135 → FOUP centre px=2.585
    for z_lp in [-1.0, 1.0]:
        p.append(bx(0.015, 0.44, 0.44, 2.457, 1.28, z_lp, "#2d3748", mt=0.70, ro=0.30))  # LP port frame on EFEM wall
        p.append(bx(0.13, 1.02, 0.44, 2.585, 0.51, z_lp, "#dde4ec", mt=0.58, ro=0.40))   # vertical column
        p.append(bx(0.50, 0.08, 0.46, 2.585, 1.05, z_lp, "#c8d8e8", mt=0.62, ro=0.28))   # table top slab
        p.append(cy(0.030, 0.04, 2.645, 0.86, z_lp, "#22c55e", segs=8, axis="z", **_LED)) # status LED
        p += _foup(2.585, 1.28, z_lp, -1, 0.38)  # FOUP door flush with EFEM wall

    # ── Gas delivery cabinet ─────────────────────────────────────
    p.append(bx(0.9,2.2,1.3, -2.3, 1.1, 0, "#fafbfd", **_BRS))
    for i in range(4):
        p.append(cy(0.03,1.0, -1.9, 1.3+i*0.14, -0.05, "#991b1b", segs=8, axis="z", **_BRS))

    # ── Dry pump ─────────────────────────────────────────────────
    p.append(bx(0.8,1.0,1.4, -2.3, 0.5, -1.1, "#fafbfd", **_BRS))

    # ── Signal tower ─────────────────────────────────────────────
    # top=red(3.03), mid=yellow(2.88), bottom=green(2.73); lamps dark for dynamic override
    p.append(cy(0.05,0.60, 0.8, 2.35, 0.5, "#d0d4d8", segs=8, **_BRS))
    p.append(cy(0.08,0.12, 0.8, 2.73, 0.5, "#1a1a1a", segs=8, **_LED))
    p.append(cy(0.08,0.12, 0.8, 2.88, 0.5, "#1a1a1a", segs=8, **_LED))
    p.append(cy(0.08,0.12, 0.8, 3.03, 0.5, "#1a1a1a", segs=8, **_LED))

    return build_scene(p)


# ═══════════════════════════════════════════════════════════════════════════════
#  CD-SEM / Review SEM
# ═══════════════════════════════════════════════════════════════════════════════

def make_sem():
    p = []

    # ── Main body ────────────────────────────────────────────────
    p.append(bx(1.5,1.85,1.5, 0, 0.925, 0, "#fafbfd", **_BRS))
    p.append(bx(1.5,0.15,1.5, 0, 1.900, 0, "#6a1fc2", **_POL))  # top — keep purple
    # Anti-vibration isolators
    for ix, iz in [(-0.5,-0.5),(0.5,-0.5),(0.5,0.5),(-0.5,0.5)]:
        p.append(cy(0.09,0.10, ix, 0.05, iz, "#6a1fc2", segs=8, **_POL))

    # ── Electron optical column ───────────────────────────────────
    p.append(cy(0.28,1.30, -0.2, 2.55,-0.15, "#fafbfd", segs=20, **_BRS))
    p.append(cy(0.18,0.42, -0.2, 3.41,-0.15, "#fafbfd", segs=20, **_BRS))  # gun housing
    p.append(cy(0.12,0.38, -0.2, 3.84,-0.15, "#381371", segs=16, **_POL))  # electron gun
    p.append(cy(0.06,0.10, -0.2, 4.05,-0.15, "#1e0840", segs=8,  **_POL))  # tip
    # Detector
    p.append(bx(0.22,0.22,0.30, 0.12, 2.40,  0,    "#fafbfd", **_BRS))
    # Aperture disc
    p.append(cy(0.06,0.04, -0.2, 2.15,-0.15, "#8b5cf6", segs=16, **_POL))

    # ── Sample chamber ────────────────────────────────────────────
    p.append(bx(0.85,0.55,0.85, -0.2, 1.52,-0.15, "#fafbfd", **_BRS))
    p.append(bx(0.02,0.45,0.75,  0.22,1.52,-0.15, "#d0d4d8", **_BRS))   # door
    # Air lock
    p.append(bx(0.30,0.30,0.30,  0.62,1.60,-0.15, "#fafbfd", **_BRS))
    p.append(cy(0.09,0.06, 0.77, 1.60,-0.15,       "#1e0840", segs=12, axis="x", **_POL))

    # ── Workstation desk ─────────────────────────────────────────
    p.append(bx(0.88,1.05,1.65, 1.10, 0.525, 0, "#fafbfd", **_BRS))
    p.append(bx(0.88,0.06,1.65, 1.10, 1.080, 0, "#4a148c", **_POL))  # top — keep purple
    # Monitor arm + screen
    p.append(bx(0.32,0.05,0.05, 1.18, 1.35, 0, "#d0d4d8", **_BRS))
    p.append(bx(0.05,0.50,0.82, 1.35, 1.36, 0, "#1e1b4b", **_ANO))
    p.append(bx(0.03,0.42,0.72, 1.37, 1.36, 0, "#312e81", **_SCR))
    # Keyboard
    p.append(bx(0.02,0.05,0.55, 1.10, 1.14, 0.06, "#1e1b4b", rx=0.18, **_SCR))

    # ── Vacuum rack ───────────────────────────────────────────────
    p.append(bx(0.45,0.95,0.55, -1.1, 0.475, 0.55, "#fafbfd", **_BRS))
    for i in range(3):
        p.append(bx(0.38,0.16,0.05, -1.1, 0.20+i*0.30, 0.8, "#1565c0", **_SCR))

    # ── Turbo pump ────────────────────────────────────────────────
    p.append(cy(0.20,0.60, -1.1, 0.30,-0.45, "#4a148c", segs=12, **_BRS))

    # ── Signal tower ─────────────────────────────────────────────
    # top=red(2.99), mid=yellow(2.84), bottom=green(2.69); lamps dark for dynamic override
    p.append(cy(0.04,0.70, -0.5, 2.60, 0.58, "#d0d4d8", segs=8, **_BRS))
    p.append(cy(0.07,0.10, -0.5, 2.69, 0.58, "#1a1a1a", segs=8, **_LED))
    p.append(cy(0.07,0.10, -0.5, 2.84, 0.58, "#1a1a1a", segs=8, **_LED))
    p.append(cy(0.07,0.10, -0.5, 2.99, 0.58, "#1a1a1a", segs=8, **_LED))

    return build_scene(p)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    global _part_counter

    models = {
        "EUV":  make_euv,
        "CVD":  make_cvd,
        "CMP":  make_cmp,
        "ETCH": make_etch,
        "SEM":  make_sem,
    }

    print(f"Generating {len(models)} GLB models → {OUTPUT}/")
    for name, fn in models.items():
        _part_counter = 0           # reset uid counter per model
        scene = fn()
        export(scene, name)
    print("Done.")


if __name__ == "__main__":
    main()
