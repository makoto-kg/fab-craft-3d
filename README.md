# Fab Craft 3D

Interactive 3D layout tool for semiconductor fab equipment. Place, move, and arrange cleanroom equipment in a realistic 3D environment with an automated OHT (Overhead Hoist Transport) simulation.

## Features

- **3D Equipment Placement** — Drag-and-drop placement of semiconductor equipment on a grid-snapped cleanroom floor (70 m x 70 m).
- **Equipment Library** — Five equipment types with realistic GLB models and specs:
  - EUV Lithography (ASML NXE-style)
  - CVD / ALD System (cluster tool)
  - CMP System (chemical mechanical polishing)
  - Dry Etch System (plasma etching)
  - CD-SEM / Review SEM
- **OHT Simulation** — Overhead hoist transport vehicles travel an auto-generated rail network, pick up and deliver FOUPs to equipment load ports with animated hoist lowering/raising sequences. Vehicle count is adjustable (1–20).
- **Signal Tower Lamps** — Dynamic green/yellow status indicators on each equipment respond to OHT docking activity in real time.
- **Walk-Through Mode** — First-person navigation with WASD + arrow keys at human eye height (1.65 m).
- **Multiple Camera Views** — Eye-level, top-down plan view, and perspective view with orbit controls.
- **Layout Persistence** — Save and load equipment layouts as JSON files.
- **Cleanroom Environment** — Ceiling LED panels, semi-transparent walls, grid floor, and fog for a realistic cleanroom atmosphere.

## Tech Stack

- [Next.js](https://nextjs.org/) 16 (static export)
- [React](https://react.dev/) 19
- [Three.js](https://threejs.org/) (vanilla, no R3F)
- TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build       # static export to out/
npm run serve       # serve the static build locally
```

#### Sub-path Deployment

```bash
BASE_PATH=/fab-craft-3d npm run build
BASE_PATH=/fab-craft-3d npm run serve
```

## Controls

| Input | Action |
|---|---|
| Left Click | Place equipment / Select equipment |
| Right Drag | Orbit camera |
| Scroll Wheel | Zoom |
| W / A / S / D | Walk forward / left / back / right |
| Arrow Up / Down | Walk forward / back |
| Arrow Left / Right | Turn camera left / right |
| R | Rotate selected equipment 90° |
| Delete / Backspace | Delete selected equipment |
| Home | Snap camera to eye height |
| Escape | Cancel placement mode |

## Project Structure

```
src/
  app/
    layout.tsx          # Root layout with metadata
    page.tsx            # Entry page
  components/
    FabApp.tsx          # Main app orchestrator
    FabCanvas.tsx       # Three.js 3D canvas (scene, camera, controls, rendering)
    Sidebar.tsx         # Equipment palette & layout management
    Toolbar.tsx         # Mode switching, camera views, OHT controls
    PropsPanel.tsx      # Selected equipment properties panel
  lib/
    types.ts            # Core domain types
    equipmentDefs.ts    # Equipment definitions & specs
    oht.ts              # OHT rail network, vehicle simulation, FOUP transport
    models/             # Procedural GLB model builders
public/
  models/               # Pre-generated GLB equipment models
scripts/
  gen_models.py         # Python script to regenerate GLB models
```

## Generating Equipment Models

GLB models can be regenerated with the Python script:

```bash
pip install trimesh numpy
python3 scripts/gen_models.py
```

## License

Private
