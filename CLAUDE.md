# T-Track Insert Configurator

## What
Static website that lets users configure a parametric T-track 
bolt insert, preview it in 3D, and download an STL file.
Built with HTML/JS/CSS, uses OpenSCAD WASM for client-side 
rendering. Hosted on GitHub Pages.

## Stack
- Vanilla JS or lightweight framework (no heavy dependencies)
- OpenSCAD WASM for parametric model generation and STL export
- Single-page app, no backend

## Architecture  
- /src: application code
- /scad: OpenSCAD model files  
- /docs: GitHub Pages deploy target (or use gh-pages branch)

## Commands
- Local dev: open index.html or use a local server
- Deploy: push to main, GitHub Pages serves from /docs

## Rules
- All OpenSCAD parameters must have sensible defaults
- STL generation happens client-side only
- Keep the UI simple — parameter inputs, preview, download button
- Mobile-friendly layout
- Mark functionalities as implemented after done