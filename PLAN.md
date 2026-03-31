# T-Track Bolt Insert Configurator — Implementation Plan

## Context

Building a static single-page web app from scratch. Users configure a parametric T-track sliding bolt insert, preview it in 3D, and download an STL. No code exists yet — only SPEC.md and CLAUDE.md.

## ~~Step 1: OpenSCAD Model (`scad/insert.scad`)~~ ✅

Write the parametric .scad file that generates the insert geometry. This is the core of the project — everything else is UI around it.

**Geometry construction:**
1. Start with the T-shaped body: a union of two rectangles (narrow top matching slot width, wider bottom matching lip width)
2. Subtract the hex bolt head pocket from the underside (a `cylinder($fn=6)` sized to head width/height)
3. Subtract the clearance hole through the full height (cylinder sized to shaft diameter)
4. Apply 1mm fixed chamfers on edges

**Parameters (with defaults):**
- `slot_width = 19`
- `lip_width = 30`
- `track_depth = 11`
- `head_width = 10` (flat-to-flat)
- `head_height = 4`
- `shaft_diameter = 6`
- `insert_length = 25`

Test this file locally with desktop OpenSCAD to validate geometry before wiring up the web app.

## ~~Step 2: HTML + CSS (`docs/index.html`)~~ ✅

Single HTML file with embedded CSS (or a linked stylesheet). Contains:

- **Left panel**: Parameter input fields grouped into sections (Track, Bolt, Insert), unit toggle (mm/in), and Download STL button
- **Right panel**: `<canvas>` element for Three.js 3D preview
- Loading spinner / status indicator for when OpenSCAD is compiling
- Responsive layout: flexbox, side-by-side on desktop, stacked on mobile

External script imports via CDN/ES module:
- Three.js, STLLoader, OrbitControls
- openscad-wasm

## ~~Step 3: Three.js Viewer (`docs/viewer.js`)~~ ✅

Module that manages the 3D preview:

- Initialize scene, camera, renderer, lights, OrbitControls on the canvas
- `updateModel(stlArrayBuffer)` — parse STL with STLLoader, replace current mesh, auto-center and fit to view
- Handle window resize
- Neutral material color, basic lighting (hemisphere + directional)

## ~~Step 4: OpenSCAD Worker (`docs/openscad-worker.js`)~~ ✅

Web Worker that runs OpenSCAD WASM:

- Import openscad-wasm ES module
- On message: receive parameter object, build SCAD source string with interpolated values, write to virtual FS, call `callMain()`, read STL output, post back the ArrayBuffer
- Post status messages (loading, compiling, done, error)

## ~~Step 5: Main App Logic (`docs/app.js`)~~ ✅

Glue code:

- Read parameter values from form inputs
- Unit toggle: store values internally in mm, convert display values by ×25.4
- Debounced parameter change handler → post message to worker
- Receive STL from worker → pass to viewer + store for download
- Download button → create Blob from STL, trigger download
- Loading/error state management

## Step 6: Integration & Testing

- Copy/reference `scad/insert.scad` (the worker will inline the SCAD template in JS, substituting parameters)
- Test full flow: adjust params → see preview update → download STL → open in slicer
- Test unit switching
- Test on mobile viewport

## File Structure

```
/scad/insert.scad          — OpenSCAD source (reference/development)
/docs/index.html           — Entry point (GitHub Pages serves this)
/docs/app.js               — Main application logic
/docs/viewer.js            — Three.js 3D viewer
/docs/openscad-worker.js   — Web Worker for OpenSCAD WASM
/docs/style.css            — Styles (optional, could be inline)
```

## Verification

1. Open `docs/index.html` via a local HTTP server (needed for ES modules / workers)
2. Confirm 3D preview renders the default insert shape
3. Adjust each parameter — preview should update after debounce
4. Toggle mm/inches — values convert correctly
5. Click Download — valid STL file opens in a slicer (PrusaSlicer, Cura, etc.)
6. Test on narrow viewport for mobile layout
