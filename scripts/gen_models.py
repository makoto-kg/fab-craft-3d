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


def pbr(color: str, metallic: float = 0.55, rough: float = 0.28):
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
                    px, py, pz, C_FOUP_SHELL, mt=0.05, ro=0.60))

    # ── Front door (slightly darker brown panel, face_sgn side) ──
    door_x = px + face_sgn * (FD / 2 + 0.005)
    parts.append(bx(0.012, fh * 0.86, fw * 0.82,
                    door_x, py, pz, C_FOUP_DOOR, mt=0.05, ro=0.55))

    # ── Door recess frame (thin dark border) ─────────────────────
    parts.append(bx(0.006, fh * 0.90, fw * 0.88,
                    door_x - face_sgn * 0.004, py, pz,
                    C_FOUP_RECESS, mt=0.55, ro=0.40))

    # ── Top handle bar ────────────────────────────────────────────
    parts.append(bx(FD * 0.32, 0.048, fw * 0.50,
                    px, py + fh / 2 + 0.024, pz,
                    C_FOUP_HANDLE, mt=0.85, ro=0.28))
    # Handle mounting stubs
    for sz in (-fw * 0.14, fw * 0.14):
        parts.append(bx(FD * 0.10, 0.030, 0.018,
                        px, py + fh / 2 + 0.005, pz + sz,
                        C_FOUP_HANDLE, mt=0.85, ro=0.28))

    # ── White label area on door ──────────────────────────────────
    parts.append(bx(0.007, fh * 0.22, fw * 0.44,
                    door_x + face_sgn * 0.004, py + fh * 0.10, pz,
                    C_FOUP_LABEL, mt=0.02, ro=0.80))

    # ── Latch indicator dot (green = loaded/ready) ────────────────
    parts.append(bx(0.007, 0.030, 0.030,
                    door_x + face_sgn * 0.004, py - fh * 0.28, pz,
                    C_LED_GREEN, mt=0.02, ro=0.40))

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

# ─── Colour constants ────────────────────────────────────────────────────────

# Common colours (shared across all models)
C_BODY       = "#fafbfd"   # main frame / body panels
# C_BODY       = "#ffffff"   # main frame / body panels
C_TRIM       = "#d0d4d8"   # cable trays, signal-tower pole
C_PANEL_LINE = "#c8cdd2"   # decorative panel lines
C_DARK       = "#263238"   # vacuum pumps, chillers
C_DARK_VENT  = "#1a202c"   # chiller vents
C_STEEL_DARK = "#37474f"   # top lids
C_STEEL_MID  = "#546e7a"   # ribs, arms
C_STEEL      = "#607d8b"   # leveling feet
C_STEEL_LT   = "#78909c"   # granite, glass posts
C_STEEL_PALE = "#90a4ae"   # wafer chuck
C_ROBOT      = "#d8dde2"   # ATM robot
C_LAMP_OFF   = "#1a1a1a"   # signal-tower lamp (OFF / dynamic override)
C_LED_GREEN  = "#22c55e"   # status LED
C_SCREEN     = "#1565c0"   # display screen face

# Load-port / FOUP colours
C_LP_FRAME   = "#2d3748"   # LP port frame
C_LP_COLUMN  = "#dde4ec"   # vertical column
C_LP_TABLE   = "#c8d8e8"   # table top slab
C_FOUP_SHELL = "#8b6538"   # FOUP shell (warm brown)
C_FOUP_DOOR  = "#7a5830"   # FOUP door
C_FOUP_RECESS= "#5a4020"   # door recess frame
C_FOUP_HANDLE= "#3a4a5a"   # handle bar
C_FOUP_LABEL = "#f5f5f5"   # label area

# EUV theme
C_EUV_WINDOW = "#0d47a1"   # CO₂ laser output window

# CVD theme (green)
C_CVD_PRI    = "#2e7d32"   # primary green (top caps)
C_CVD_DARK   = "#1b5e20"   # dark green (domes, vacuum)
C_CVD_LIGHT  = "#a5d6a7"   # light green (viewport)
C_CVD_ACCENT = "#388e3c"   # accent green (pipes, turbo exhaust)

# CMP theme (orange)
C_CMP_TOP    = "#e64a19"   # main frame top
C_CMP_TOP2   = "#bf360c"   # cleaning module top
C_CMP_PLATEN = "#6d2813"   # platen disk
C_CMP_PAD    = "#8d3b14"   # polishing pad
C_CMP_PRI    = "#a04000"   # primary orange (arms, carousel)
C_CMP_DARK   = "#7b3500"   # dark orange (conditioning disk, carousel)
C_CMP_NOZZLE = "#bf4500"   # slurry nozzle arm
C_CMP_NZTIP  = "#d4500c"   # nozzle tip
C_CMP_ARM    = "#5a1505"   # touchscreen arm
C_CMP_FRAME  = "#3d1505"   # touchscreen frame

# ETCH theme (red)
C_ETCH_PRI   = "#991b1b"   # primary red (top cap, gas lines)
C_ETCH_DARK  = "#7f1d1d"   # dark red (chamber tops, gate valves)
C_ETCH_DEEP  = "#5a1010"   # deep red (ICP domes)
C_ETCH_CABLE = "#6b1515"   # RF cable
C_ETCH_VP    = "#fca5a5"   # viewport (light red)

# SEM theme (purple)
C_SEM_PRI    = "#6a1fc2"   # primary purple (top, isolators)
C_SEM_DARK   = "#4a148c"   # dark purple (desk top, turbo pump)
C_SEM_GUN    = "#381371"   # electron gun
C_SEM_DEEP   = "#1e0840"   # gun tip, air-lock
C_SEM_LIGHT  = "#8b5cf6"   # aperture disc
C_SEM_FRAME  = "#1e1b4b"   # monitor frame, keyboard
C_SEM_SCREEN = "#312e81"   # monitor screen


# ─── Common sub-assembly helpers ─────────────────────────────────────────────

def _load_port(foup_x, z, face_sgn, fh=0.38, col_w=0.13, table_w=0.50):
    """
    Load-port assembly: port frame + pedestal column + table slab + LED + FOUP.

    foup_x   : X centre of the FOUP
    z        : Z centre of the load port
    face_sgn : +1 → FOUP door faces +X,  -1 → FOUP door faces -X
    fh       : FOUP height (m)
    col_w    : column width (X extent)
    table_w  : table slab width (X extent)
    """
    wall_x = foup_x - face_sgn * 0.128
    led_x  = foup_x + face_sgn * 0.060
    parts = []
    parts.append(bx(0.015, 0.44, 0.44, wall_x, 1.28, z, C_LP_FRAME, mt=0.70, ro=0.30))
    parts.append(bx(col_w, 1.02, 0.44, foup_x, 0.51, z, C_LP_COLUMN, mt=0.58, ro=0.40))
    parts.append(bx(table_w, 0.08, 0.46, foup_x, 1.05, z, C_LP_TABLE, mt=0.62, ro=0.28))
    parts.append(cy(0.030, 0.04, led_x, 0.86, z, C_LED_GREEN, segs=8, axis="z", **_LED))
    parts += _foup(foup_x, 1.28, z, face_sgn, fh)
    return parts


def _signal_tower(x, z, pole_y, pole_h, y_green,
                  pole_r=0.05, lamp_r=0.08, lamp_h=0.12):
    """
    Signal tower: pole + 3 lamps (green / yellow / red, bottom to top).

    x, z     : horizontal position
    pole_y   : Y centre of the pole cylinder
    pole_h   : pole height
    y_green  : Y centre of the bottom (green) lamp
    pole_r   : pole radius
    lamp_r   : lamp radius
    lamp_h   : lamp height
    """
    parts = []
    parts.append(cy(pole_r, pole_h, x, pole_y, z, C_TRIM, segs=8, **_BRS))
    parts.append(cy(lamp_r, lamp_h, x, y_green,       z, C_LAMP_OFF, segs=8, **_LED))
    parts.append(cy(lamp_r, lamp_h, x, y_green + 0.15, z, C_LAMP_OFF, segs=8, **_LED))
    parts.append(cy(lamp_r, lamp_h, x, y_green + 0.30, z, C_LAMP_OFF, segs=8, **_LED))
    return parts


# ═══════════════════════════════════════════════════════════════════════════════
#  EUV Lithography (ASML NXE-style)
#  Footprint: 13.5 × 3.6 m,  Height: ~4.5 m (including reticle stage)
# ═══════════════════════════════════════════════════════════════════════════════

def make_euv():
    p = []
    H = 2.4   # main frame height

    # ── Main frame ──────────────────────────────────────────────
    p.append(bx(8.5, H, 3.4,    -1,   H/2,  0,     C_BODY, **_BRS))
    # Panel lines (thin decorative strips)
    p.append(bx(8.5, 0.05, 0.02, -1, H*0.7,  1.65, C_PANEL_LINE, **_BRS))
    p.append(bx(8.5, 0.05, 0.02, -1, H*0.7, -1.65, C_PANEL_LINE, **_BRS))

    # ── LPS (Light Source Pod) ───────────────────────────────────
    p.append(bx(3.8, 2.6, 3.0,  -6.5, 1.30,  0,    C_BODY, **_BRS))
    p.append(bx(3.8, 0.15,3.0,  -6.5, 2.68,  0,    C_STEEL_DARK, **_BRS))   # top lid
    # CO₂ laser output window
    p.append(bx(0.05,0.42,0.42, -4.60,1.60,  0,    C_EUV_WINDOW, **_VPT))
    # Beam duct  (horizontal box, X-direction)
    p.append(bx(1.0, 0.50,0.50, -4.0, 1.60,  0,    C_BODY, **_BRS))
    # Tin nozzle  (horizontal cylinder along X)
    p.append(cy(0.08,0.85, -5.2, 1.60,  0,   C_STEEL_MID, segs=8,  axis="x", **_POL))
    # LPS leveling feet
    for fx, fz in [(-5.8,-1.3),(-7.2,-1.3),(-5.8,1.3),(-7.2,1.3)]:
        p.append(cy(0.12, 0.07,  fx, 0.035, fz, C_STEEL, segs=8, **_BRS))

    # ── Illumination column ──────────────────────────────────────
    p.append(bx(0.8, 1.4, 0.8, -2.5, H+0.70,  0,  C_BODY, **_BRS))
    p.append(cy(0.35,0.90, -2.5, H+1.65, 0,        C_BODY, segs=20, **_BRS))

    # ── Projection Optics Box (POB) ──────────────────────────────
    p.append(bx(2.8, 2.0, 2.6,  0.5, H+1.00,  0,  C_BODY, **_BRS))
    p.append(cy(0.60,1.80,  0.5, H+0.90,  0,       C_BODY, segs=24, **_BRS))  # mirror housing
    p.append(bx(1.0, 0.50,1.0,  0.5, H+2.20,  0,  C_STEEL_DARK, **_BRS))  # top slab
    # Ribs
    for rz in [-0.9, 0.0, 0.9]:
        p.append(bx(0.10,0.30,0.10, 0.5, H+2.00, rz, C_STEEL_MID, **_BRS))

    # ── Reticle Stage ────────────────────────────────────────────
    p.append(bx(3.4, 0.70,2.8,  0.4, H+2.65,  0,  C_BODY, **_BRS))
    p.append(bx(1.8, 0.12,1.6,  0.4, H+3.02,  0,  C_STEEL_MID, **_POL))  # clamp
    p.append(bx(0.15,0.15,1.8,  0.4, H+2.95,  0,  C_STEEL, **_POL))  # handler arm
    # Reticle library (SMIF pod)
    p.append(bx(1.4, 1.80,1.4,  2.2, H+2.20, 0.8, C_BODY, **_BRS))
    p.append(bx(0.05,1.40,1.2,  2.95,H+2.20, 0.8, C_TRIM, **_BRS))

    # ── Wafer Stage ──────────────────────────────────────────────
    p.append(bx(4.2, 1.60,3.4,  4.0, 0.80,   0,   C_BODY, **_BRS))
    p.append(bx(2.4, 0.18,2.4,  4.0, 1.69,   0,   C_STEEL_LT, **_POL))  # granite platform
    p.append(cy(0.16,0.05,  4.0, 1.78,  0,         C_STEEL_PALE, segs=32, **_POL))  # wafer chuck
    # Interferometer blocks
    for ox, oz in [(-1,1),(1,1),(1,-1),(-1,-1)]:
        p.append(bx(0.12,0.12,0.12, 4.0+ox, 1.85, oz, C_STEEL_MID, **_POL))
    # Linear motor rails
    for rx_,rz_ in [(3.0,-1.4),(5.0,-1.4),(3.0,1.4),(5.0,1.4)]:
        p.append(bx(0.15,0.15,3.2, rx_, 1.68, rz_, C_BODY, **_BRS))

    # ── EFEM ─────────────────────────────────────────────────────
    p.append(bx(2.6, 2.2, 3.4,  6.9,  1.10,  0,   C_BODY, **_BRS))
    p.append(bx(1.8, 1.0, 1.8,  6.9,  0.80, 0.2,  C_BODY, **_BRS))   # robot housing
    # ATM robot
    p.append(cy(0.18,0.80,  6.9,  0.60,  0,        C_ROBOT, segs=12, **_BRS))
    p.append(bx(0.60,0.06,0.08, 7.2, 0.90,  0,    C_STEEL_MID, **_POL))
    p.append(bx(0.40,0.06,0.08, 7.6, 0.90,  0,    C_STEEL, **_POL))
    p.append(cy(0.14,0.03,  7.9, 0.90,  0,         C_STEEL_LT, segs=16, **_POL))
    # FOUP load ports ×3
    for z_lp in [-1.0, 0.0, 1.0]:
        p += _load_port(8.335, z_lp, -1, col_w=0.15, table_w=0.52)

    # ── Vacuum pumps × 4 (rear) ──────────────────────────────────
    for vx in [-5.0, -2.5, 0.0, 2.5]:
        p.append(cy(0.28, 1.40, vx, 0.70, -2.20,      C_DARK, segs=12, **_BRS))
        p.append(cy(0.18, 0.28, vx, 1.54, -2.20,      C_STEEL_DARK, segs=12, **_POL))

    # ── Chillers (rear) ──────────────────────────────────────────
    for cx in [1.0, 3.5]:
        p.append(bx(1.8, 1.90, 0.90, cx, 0.95, -2.30, C_DARK, **_BRS))
        for i in range(5):
            p.append(bx(1.6, 0.04, 0.02, cx, 0.30+i*0.32, -1.88, C_DARK_VENT, **_ANO))

    # ── Gas cabinet ──────────────────────────────────────────────
    p.append(bx(0.9, 2.30, 0.9, -6.2,  1.15, -1.4,   C_BODY, **_BRS))

    # ── Control rack ─────────────────────────────────────────────
    p.append(bx(0.85,2.20,0.9,  8.0,  1.10, -1.35,   C_BODY, **_BRS))
    for i in range(5):
        p.append(bx(0.72,0.16,0.02, 8.0, 0.28+i*0.4, -0.92, C_SCREEN, **_SCR))

    # ── Cable trays ──────────────────────────────────────────────
    p.append(bx(10.0,0.14,0.36, -1.0, H+0.07,  1.60, C_TRIM, **_BRS))
    p.append(bx(10.0,0.14,0.36, -1.0, H+0.07, -1.60, C_TRIM, **_BRS))

    # ── Signal tower light ───────────────────────────────────────
    p += _signal_tower(6.5, 1.5, H+0.35, 0.70, H+0.78)

    # ── Leveling pads ─────────────────────────────────────────────
    for px, pz in [(-6,-1.5),(-6,1.5),(-1,-1.7),(-1,1.7),(4,-1.7),(4,1.7),(7.5,-1.5),(7.5,1.5)]:
        p.append(cy(0.14, 0.06, px, 0.03, pz,         C_STEEL_MID, segs=8, **_POL))

    return build_scene(p)


# ═══════════════════════════════════════════════════════════════════════════════
#  CVD / ALD Cluster Tool
# ═══════════════════════════════════════════════════════════════════════════════

def make_cvd():
    p = []

    # ── Central transfer chamber (hexagonal) ─────────────────────
    p.append(cy(1.15, 1.70, 0, 0.85, 0,  C_BODY, segs=6, **_BRS))
    p.append(cy(1.25, 0.18, 0, 1.76, 0,  C_CVD_PRI, segs=6, **_POL))  # top cap
    p.append(cy(1.25, 0.12, 0, 0.05, 0,  C_BODY, segs=6, **_BRS))

    # ── 4 Process chambers ───────────────────────────────────────
    for px, pz in [(1.9,0.8),(1.9,-0.8),(-1.9,0.8),(-1.9,-0.8)]:
        p.append(bx(1.3,1.6,1.3, px,  0.80, pz, C_BODY, **_BRS))
        p.append(bx(1.4,0.18,1.4,px,  1.67, pz, C_CVD_PRI, **_POL))  # top
        p.append(cy(0.55,0.40, px, 1.85, pz,    C_CVD_DARK, segs=20, **_POL))  # dome
        # RF matching unit
        side = 0.88 if px > 0 else -0.88
        p.append(bx(0.40,0.42,0.40, px+side, 0.60, pz, C_BODY, **_BRS))
        # Viewport
        vz = pz + (0.67 if pz > 0 else -0.67)
        p.append(cy(0.09,0.06, px, 0.95, vz,    C_CVD_LIGHT, segs=12, axis="z", **_VPT))
        # Gate valve connector to center
        p.append(bx(0.25,0.30,0.25, px*0.5, 0.80, pz*0.5, C_BODY, **_BRS))
        # Turbo pump exhaust
        ex_side = 0.62 if pz > 0 else -0.62
        p.append(cy(0.07,0.60, px, 0.20, pz+ex_side, C_CVD_ACCENT, segs=8, axis="z", **_BRS))

    # ── EFEM ─────────────────────────────────────────────────────
    p.append(bx(1.6,2.0,3.0, 2.8, 1.0, 0,  C_BODY, **_BRS))
    p.append(bx(1.7,0.16,3.1,2.8, 2.08,0,  C_CVD_PRI, **_POL))  # top
    # FOUP load ports ×2
    for z_lp in [-1.0, 1.0]:
        p += _load_port(3.735, z_lp, -1)

    # ── Gas cabinet ──────────────────────────────────────────────
    p.append(bx(0.85,2.2,1.1, -2.5, 1.1, 0.7,  C_BODY, **_BRS))
    for i in range(4):
        p.append(cy(0.03,1.1, -2.1, 1.15+i*0.18, -0.15, C_CVD_ACCENT, segs=8, axis="z", **_BRS))

    # ── Vacuum system ─────────────────────────────────────────────
    p.append(bx(1.1,1.6,2.8, -2.5, 0.8, -0.8, C_BODY, **_BRS))
    p.append(cy(0.28,1.0, -2.5, 0.5, -0.9,    C_CVD_DARK, segs=12, **_BRS))
    p.append(cy(0.28,1.0, -2.5, 0.5,  0.3,    C_CVD_DARK, segs=12, **_BRS))

    # ── Signal tower ─────────────────────────────────────────────
    p += _signal_tower(0, 0, 2.30, 0.90, 2.58)

    return build_scene(p)


# ═══════════════════════════════════════════════════════════════════════════════
#  CMP System
# ═══════════════════════════════════════════════════════════════════════════════

def make_cmp():
    p = []

    # ── Main frame ───────────────────────────────────────────────
    p.append(bx(4.8,1.65,3.0, 0, 0.825, 0, C_BODY, **_BRS))
    p.append(bx(4.8,0.16, 3.0, 0, 1.73,  0, C_CMP_TOP, **_POL))  # top

    # ── 3 polishing platens ──────────────────────────────────────
    # Glass enclosure: GX=±2.22, GZF=+0.30, GZB=-1.10, GZC=-0.40
    # Platen radii reduced to stay well inside glass faces
    for px in [-1.4, 0.0, 1.4]:
        p.append(cy(0.58,0.14, px, 1.81,-0.4, C_CMP_PLATEN, segs=32, **_POL))   # platen disk
        p.append(cy(0.53,0.06, px, 1.87,-0.4, C_CMP_PAD, segs=32, **_PAD))      # polishing pad
        # Conditioning arm + disk
        p.append(bx(0.72,0.05,0.08, px+0.24, 1.93,-0.4, C_CMP_PRI, **_POL))
        p.append(cy(0.11,0.06, px+0.60, 1.93,-0.4, C_CMP_DARK, segs=16, **_POL))
        # Slurry nozzle arm
        p.append(bx(0.50,0.04,0.04, px-0.15, 1.95,-0.05, C_CMP_NOZZLE, **_BRS))
        p.append(cy(0.03,0.12, px-0.38, 1.90, 0,  C_CMP_NZTIP, segs=8, axis="z", **_BRS))

    # ── Polish head carousel ─────────────────────────────────────
    p.append(cy(0.10,0.90, 0, 2.25,-0.4, C_CMP_PRI, segs=8, **_BRS))
    p.append(cy(0.62,0.08, 0, 2.70,-0.4, C_CMP_DARK, segs=24, **_POL))

    # ── Slurry delivery system ───────────────────────────────────
    p.append(bx(0.85,1.3,0.7,  -2.7, 0.65, 0.7, C_BODY, **_BRS))
    for i in range(3):
        p.append(cy(0.14,0.65, -2.7+i*0.38-0.38, 1.60, 0.7, C_CMP_PRI, segs=12, **_BRS))

    # ── Wafer cleaning module ────────────────────────────────────
    p.append(bx(2.2,1.55,3.0,  3.0, 0.775, 0, C_BODY, **_BRS))
    p.append(bx(2.2,0.15, 3.0,  3.0, 1.625, 0, C_CMP_TOP2, **_POL))  # top
    for bz in [-1.0, 1.0]:
        p.append(bx(0.65,1.3,0.65, 3.5, 0.75, bz, C_BODY, **_BRS))
        p.append(cy(0.20,0.80, 3.5, 1.40, bz,     C_CMP_PRI, segs=12, **_BRS))

    # ── Load station ─────────────────────────────────────────────
    p.append(bx(1.1,1.6,1.4, -2.7, 0.80,-0.75, C_BODY, **_BRS))
    # FOUP load ports ×2
    for fz in [-1.2, -0.3]:
        p += _load_port(-3.385, fz+0.75, +1, col_w=0.13, table_w=0.46)

    # ── Control touchscreen ──────────────────────────────────────
    p.append(bx(0.06, 0.06, 0.42, 3.0, 1.62, 1.71, C_CMP_ARM, **_BRS))   # arm
    p.append(bx(0.04, 1.2, 0.85, 3.000, 1.40, 1.90,  C_CMP_FRAME, ry=-0.39, **_ANO))  # frame
    p.append(bx(0.03, 0.95,0.70, 3.032, 1.40, 1.913, C_SCREEN, ry=-0.39, **_SCR))  # screen

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
            p.append(bx(0.04, GH, 0.04, cx, GYC, cz, C_STEEL_LT, **_POL))
    p.append(bx(GW, 0.04, 0.04,  0, GY0+GH, GZF, C_STEEL_LT, **_POL))
    p.append(bx(GW, 0.04, 0.04,  0, GY0+GH, GZB, C_STEEL_LT, **_POL))
    p.append(bx(0.04, 0.04, GD, -GX, GY0+GH, GZC, C_STEEL_LT, **_POL))
    p.append(bx(0.04, 0.04, GD,  GX, GY0+GH, GZC, C_STEEL_LT, **_POL))
    p.append(bx(GW, 0.04, 0.04,  0, GY0, GZF, C_STEEL_LT, **_POL))
    p.append(bx(GW, 0.04, 0.04,  0, GY0, GZB, C_STEEL_LT, **_POL))
    p.append(bx(0.04, 0.04, GD, -GX, GY0, GZC, C_STEEL_LT, **_POL))
    p.append(bx(0.04, 0.04, GD,  GX, GY0, GZC, C_STEEL_LT, **_POL))

    # ── Signal tower ─────────────────────────────────────────────
    p += _signal_tower(3.0, 1.2, 2.40, 0.90, 2.65)

    return build_scene(p)


# ═══════════════════════════════════════════════════════════════════════════════
#  Dry Etch System
# ═══════════════════════════════════════════════════════════════════════════════

def make_etch():
    p = []

    # ── Central transfer module ───────────────────────────────────
    p.append(bx(1.5,1.60,1.5, 0, 0.80, 0, C_BODY, **_BRS))
    p.append(bx(1.6,0.20,1.6, 0, 1.70, 0, C_ETCH_PRI, **_POL))  # top

    # ── 4 etch chambers ──────────────────────────────────────────
    for px, pz in [(1.7,0.65),(1.7,-0.65),(-1.7,0.65),(-1.7,-0.65)]:
        p.append(bx(1.1,1.55,1.1, px, 0.775, pz, C_BODY, **_BRS))
        p.append(bx(1.2,0.18,1.2, px, 1.640, pz, C_ETCH_DARK, **_POL))  # top
        p.append(cy(0.50,0.40, px, 1.82, pz,     C_ETCH_DEEP, segs=20, **_POL))  # ICP dome
        # RF matching network
        side = 0.85 if px > 0 else -0.85
        p.append(bx(0.50,0.42,0.50, px+side, 0.55, pz, C_BODY, **_BRS))
        # RF cable
        p.append(cy(0.04,0.40, px+(side*0.7), 0.50, pz, C_ETCH_CABLE, segs=8, axis="x" if px>0 else "x", **_BRS))
        # Turbo pump
        vz = pz + (0.75 if pz > 0 else -0.75)
        p.append(cy(0.20,0.80, px, 0.35, vz,     C_ETCH_DARK, segs=12, **_BRS))
        # Viewport
        vp_side = 0.57 if px > 0 else -0.57
        p.append(cy(0.07,0.05, px+vp_side, 0.90, pz, C_ETCH_VP, segs=12, axis="x", **_VPT))
        # Gate valve
        p.append(bx(0.22,0.30,0.22, px*0.6, 0.80, pz*0.6, C_ETCH_DARK, **_BRS))

    # ── EFEM ─────────────────────────────────────────────────────
    p.append(bx(1.5,2.0,2.8, 1.7, 1.0, 0, C_BODY, **_BRS))
    p.append(bx(1.6,0.16,2.8,1.7, 2.08,0, C_ETCH_DARK, **_POL))  # top
    # FOUP load ports ×2
    for z_lp in [-1.0, 1.0]:
        p += _load_port(2.585, z_lp, -1)

    # ── Gas delivery cabinet ─────────────────────────────────────
    p.append(bx(0.9,2.2,1.3, -2.3, 1.1, 0, C_BODY, **_BRS))
    for i in range(4):
        p.append(cy(0.03,1.0, -1.9, 1.3+i*0.14, -0.05, C_ETCH_PRI, segs=8, axis="z", **_BRS))

    # ── Dry pump ─────────────────────────────────────────────────
    p.append(bx(0.8,1.0,1.4, -2.3, 0.5, -1.1, C_BODY, **_BRS))

    # ── Signal tower ─────────────────────────────────────────────
    p += _signal_tower(0.8, 0.5, 2.35, 0.60, 2.73)

    return build_scene(p)


# ═══════════════════════════════════════════════════════════════════════════════
#  CD-SEM / Review SEM
# ═══════════════════════════════════════════════════════════════════════════════

def make_sem():
    p = []

    # ── Main body ────────────────────────────────────────────────
    p.append(bx(1.5,1.85,1.5, 0, 0.925, 0, C_BODY, **_BRS))
    p.append(bx(1.5,0.15,1.5, 0, 1.900, 0, C_SEM_PRI, **_POL))  # top
    # Anti-vibration isolators
    for ix, iz in [(-0.5,-0.5),(0.5,-0.5),(0.5,0.5),(-0.5,0.5)]:
        p.append(cy(0.09,0.10, ix, 0.05, iz, C_SEM_PRI, segs=8, **_POL))

    # ── Electron optical column ───────────────────────────────────
    p.append(cy(0.28,1.30, -0.2, 2.55,-0.15, C_BODY, segs=20, **_BRS))
    p.append(cy(0.18,0.42, -0.2, 3.41,-0.15, C_BODY, segs=20, **_BRS))  # gun housing
    p.append(cy(0.12,0.38, -0.2, 3.84,-0.15, C_SEM_GUN, segs=16, **_POL))  # electron gun
    p.append(cy(0.06,0.10, -0.2, 4.05,-0.15, C_SEM_DEEP, segs=8,  **_POL))  # tip
    # Detector
    p.append(bx(0.22,0.22,0.30, 0.12, 2.40,  0,    C_BODY, **_BRS))
    # Aperture disc
    p.append(cy(0.06,0.04, -0.2, 2.15,-0.15, C_SEM_LIGHT, segs=16, **_POL))

    # ── Sample chamber ────────────────────────────────────────────
    p.append(bx(0.85,0.55,0.85, -0.2, 1.52,-0.15, C_BODY, **_BRS))
    p.append(bx(0.02,0.45,0.75,  0.22,1.52,-0.15, C_TRIM, **_BRS))   # door
    # Air lock
    p.append(bx(0.30,0.30,0.30,  0.62,1.60,-0.15, C_BODY, **_BRS))
    p.append(cy(0.09,0.06, 0.77, 1.60,-0.15,       C_SEM_DEEP, segs=12, axis="x", **_POL))

    # ── Workstation desk ─────────────────────────────────────────
    p.append(bx(0.88,1.05,1.65, 1.10, 0.525, 0, C_BODY, **_BRS))
    p.append(bx(0.88,0.06,1.65, 1.10, 1.080, 0, C_SEM_DARK, **_POL))  # top
    # Monitor arm + screen
    p.append(bx(0.32,0.05,0.05, 1.18, 1.35, 0, C_TRIM, **_BRS))
    p.append(bx(0.05,0.50,0.82, 1.35, 1.36, 0, C_SEM_FRAME, **_ANO))
    p.append(bx(0.03,0.42,0.72, 1.37, 1.36, 0, C_SEM_SCREEN, **_SCR))
    # Keyboard
    p.append(bx(0.02,0.05,0.55, 1.10, 1.14, 0.06, C_SEM_FRAME, rx=0.18, **_SCR))

    # ── Vacuum rack ───────────────────────────────────────────────
    p.append(bx(0.45,0.95,0.55, -1.1, 0.475, 0.55, C_BODY, **_BRS))
    for i in range(3):
        p.append(bx(0.38,0.16,0.05, -1.1, 0.20+i*0.30, 0.8, C_SCREEN, **_SCR))

    # ── Turbo pump ────────────────────────────────────────────────
    p.append(cy(0.20,0.60, -1.1, 0.30,-0.45, C_SEM_DARK, segs=12, **_BRS))

    # ── Signal tower ─────────────────────────────────────────────
    p += _signal_tower(-0.5, 0.58, 2.60, 0.70, 2.69,
                       pole_r=0.04, lamp_r=0.07, lamp_h=0.10)

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
