# Muse

**Realistic digital twin from selfies.**  
Made By Zer01 — Artificially Intelligent, Digitally Enhanced.

Muse is a premium consumer web app that builds a poseable 3D twin from your photos. Face analysis runs **entirely in the browser** via MediaPipe Face Landmarker. The twin is rendered with React Three Fiber using a **photoreal Avaturn female** (complete body + head + hair + outfit), procedural beauty idle / wave pose, studio HDRI + beauty lighting, and mild N8AO/Bloom postprocessing.

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
- **3D** — single complete female GLB (`muse_twin.glb`) with real hair cards, PBR maps, ARKit face morphs; procedural confident idle + wave
- **Export** — canvas PNG; Free watermark `Muse · Free`; Pro demo unlock via localStorage

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · React Three Fiber · Drei · Three.js · `@react-three/postprocessing` · Zustand · MediaPipe Tasks Vision · Framer Motion (available)

## Models & textures

Default twin (`public/models/muse_twin.glb`):

- Photoreal female avatar from **Avaturn**, vendored via the [TalkingHead](https://github.com/met4citizen/TalkingHead) example set (`avatars/avaturn.glb`)
- Includes skinned body, head, eyes, teeth, dual hair meshes, outfit, shoes, and ARKit morph targets
- See `public/models/LICENSE.txt` for credit / non-commercial notes

Legacy / animation donor (still shipped):

- CC0 Vitruvian body + head + albedo PNGs (CharMorph / Antonia Polygon lineage) — used to retarget Mixamo Idle / HappyIdle / Sway / Wave / Walk onto the Avaturn rig

## Photoreal pipeline (v7)

1. One complete character GLB (no head-seating / procedural hair by default)
2. Preserve embedded PBR maps; soft skin tint + hair/iris recolor from ControlPanel
3. Beauty lighting (soft key / cool fill / warm rim) + studio HDRI
4. EffectComposer: mild N8AO, Bloom, Vignette, SMAA
5. Procedural confident idle (breathing / sway / wave) — Mixamo donor retained for future

Persist key: `muse-twin-v7` (resets prior slider state once).

## Brand

Made By Zer01 / Artificially Intelligent, Digitally Enhanced.
