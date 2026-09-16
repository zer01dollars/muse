# Muse

**Realistic digital twin from selfies.**  
Made By Zer01 — Artificially Intelligent, Digitally Enhanced.

Muse is a premium consumer web app that builds a poseable 3D twin from your photos. Face analysis runs **entirely in the browser** via MediaPipe Face Landmarker. The twin is rendered with React Three Fiber using a **photoreal Avaturn female**, a **glam outfit lane** (procedural sequin / satin / bodycon / sheer), six live pose presets, studio HDRI + beauty lighting, and mild N8AO/Bloom postprocessing.

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
- **Glam lane** — 4 outfits + 6 poses selectable as chips in the Refine panel (Outfit / Pose)
- **Face AI** — MediaPipe Tasks Vision Face Landmarker (WASM from CDN) → normalized face metrics → sliders
- **3D** — Avaturn `muse_twin.glb` with real hair cards, PBR maps, ARKit face morphs; procedural glam wardrobe + bone-driven poses
- **Export** — canvas PNG; Free watermark `Muse · Free`; Pro demo unlock via localStorage

## Glam outfits

Baked Avaturn suit mesh (`avaturn_look_0`) is hidden; procedural body-fitted MeshPhysical looks follow the hips/spine:

1. **Glam evening** — sequin mini, gold jewelry sheen, heels-tint shoes
2. **Lingerie** — matching satin bra + bottoms (tasteful-hot)
3. **Club bodycon** — tight sheath, side cutouts, metallic / neon accents
4. **Sheer glam** — mesh panel dress with glow edge rings

## Glam poses

Bone Euler deltas on the Mixamo/Avaturn skeleton (bind reset + lerp-friendly offsets each frame):

1. **Soft idle** — breath + gentle sway (default)
2. **Hand on hip** — confident weight shift
3. **Over-shoulder** — glance back
4. **S-curve** — contrapposto silhouette
5. **Club sway** — looping groove
6. **Hair toss** — arms up pulse

Default: **glam evening + soft idle**. Persist key: `muse-twin-v8`.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · React Three Fiber · Drei · Three.js · `@react-three/postprocessing` · Zustand · MediaPipe Tasks Vision · Framer Motion (available)

## Models & textures

Default twin (`public/models/muse_twin.glb`):

- Photoreal female avatar from **Avaturn**, vendored via the [TalkingHead](https://github.com/met4citizen/TalkingHead) example set (`avatars/avaturn.glb`)
- Includes skinned body, head, eyes, teeth, dual hair meshes, outfit, shoes, and ARKit morph targets
- See `public/models/LICENSE.txt` for credit / non-commercial notes

Legacy / animation donor (still shipped):

- CC0 Vitruvian body + head + albedo PNGs (CharMorph / Antonia Polygon lineage)

## Photoreal pipeline (v8)

1. One complete character GLB (no head-seating / procedural hair by default)
2. Preserve embedded PBR maps; soft skin tint + hair/iris recolor from ControlPanel
3. Hide baked suit → procedural glam wardrobe parented to hips/spine
4. Beauty lighting (soft key / cool fill / warm rim) + studio HDRI
5. EffectComposer: mild N8AO, glam Bloom, Vignette, SMAA
6. Six bone-driven pose presets with soft idle / club / hair-toss loops

## Brand

Made By Zer01 / Artificially Intelligent, Digitally Enhanced.
