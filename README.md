# Muse

**Realistic digital twin from selfies.**  
Made By Zer01 — Artificially Intelligent, Digitally Enhanced.

Muse is a premium consumer web app that builds a poseable 3D twin from your photos. Face analysis runs **entirely in the browser** via MediaPipe Face Landmarker. The twin is rendered with React Three Fiber using a CC0 Vitruvian humanoid base, studio HDRI lighting, and physical skin materials.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Studio lives at `/studio`.

```bash
npm run build   # production build
npm start       # serve production build
```

## What’s included

- **Landing** — dark luxury marketing page with How it works, features, Free vs Pro ($12/mo)
- **Studio** — selfie upload (1–3), Build twin, orbitable 3D viewport, accordion refine controls
- **Face AI** — MediaPipe Tasks Vision Face Landmarker (WASM from CDN) → normalized face metrics → sliders
- **3D** — Vitruvian body (Mixamo rig + clips) + Vitruvian head (FACS morphs), procedural hair, ACES + soft shadows
- **Export** — canvas PNG; Free watermark `Muse · Free`; Pro demo unlock via localStorage

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · React Three Fiber · Drei · Three.js · Zustand · MediaPipe Tasks Vision · Framer Motion (available)

## Models

CC0 Vitruvian assets (head + body GLB) from the open Vitruvian / CharMorph lineage, vendored under `public/models/`.

## Brand

Made By Zer01 / Artificially Intelligent, Digitally Enhanced.
