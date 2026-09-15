# Muse

**Realistic digital twin from selfies.**  
Made By Zer01 — Artificially Intelligent, Digitally Enhanced.

Muse is a premium consumer web app that builds a poseable 3D twin from your photos. Face analysis runs **entirely in the browser** via MediaPipe Face Landmarker. The twin is rendered with React Three Fiber using a CC0 Vitruvian humanoid base, photoreal PBR skin maps, studio HDRI + beauty lighting, N8AO/Bloom postprocessing, and layered hair cards.

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
- **3D** — Vitruvian body (Mixamo rig + clips) + Vitruvian head (FACS morphs), photoreal albedo maps, hair cards, ACES + soft shadows + post FX
- **Export** — canvas PNG; Free watermark `Muse · Free`; Pro demo unlock via localStorage

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · React Three Fiber · Drei · Three.js · `@react-three/postprocessing` · Zustand · MediaPipe Tasks Vision · Framer Motion (available)

## Models & textures

CC0 Vitruvian assets (head + body GLB) from the open Vitruvian / CharMorph lineage, vendored under `public/models/`.

High-res albedo maps also CC0 (same lineage):

- `public/models/vit_face_bc.png` — face diffuse (~7.8MB)
- `public/models/vit_body_bc.png` — body diffuse (~7MB)

Applied as `map` on MeshPhysicalMaterial skin (tint via `material.color` multiply). Lips / iris / cornea keep stylized overrides.

Hair is procedural **cards** (canvas strand alpha texture), parented to `MuseHairAnchor` on the seated head scalp — not a third-party hair GLB.

## Photoreal pipeline (v6)

1. PBR skin maps + MeshPhysical clearcoat/sheen  
2. Beauty lighting (soft key / cool fill / warm rim) + studio HDRI  
3. EffectComposer: N8AO, mild Bloom, Vignette, SMAA  
4. Hair cards with strand alpha instead of capsule blobs  

## Brand

Made By Zer01 / Artificially Intelligent, Digitally Enhanced.
