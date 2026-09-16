# Muse

**Realistic digital twin from selfies.**  
Made By Zer01 — Artificially Intelligent, Digitally Enhanced.

Muse is a premium consumer web app that builds a poseable 3D twin from your photos. Face analysis runs **entirely in the browser** via MediaPipe Face Landmarker. The twin is rendered with React Three Fiber using a **photoreal Avaturn female**, a **glam outfit lane** (material restyles), Mixamo-driven pose clips via `AnimationMixer`, studio HDRI + beauty lighting, and mild N8AO/Bloom postprocessing.

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
- **3D** — Avaturn `muse_twin.glb` + Mixamo clips in `muse_anims.glb` (Happy Idle / Hip Hop / Looking Around / …)
- **Export** — canvas PNG; Free watermark `Muse · Free`; Pro demo unlock via localStorage

## Glam outfits

Skinned Avaturn suit (`avaturn_look_0`) is restyled with glam materials only — **no shader discard / hem clips** (those caused floating arm scraps). Full suit mesh stays intact in glam colors. Body, hair, and shoes always stay visible.

1. **Glam evening** — sequin purple/gold sheen, gold earrings, heels-tint shoes
2. **Lingerie** — hot pink satin teddy colors on the **full** look mesh
3. **Club bodycon** — glossy black + pink sheen
4. **Sheer glam** — translucent violet glow + violet earrings

## Glam poses

Real Mixamo animation clips (retargeted `mixamorig*` → Avaturn `Hips` / `LeftArm` / …) played with `THREE.AnimationMixer`. Broken per-frame Euler pose drivers and `skeleton.pose()` loops were removed.

1. **Soft idle** — Happy Idle loop (default — alive, not T-pose)
2. **Hand on hip** — Standing Idle (best-effort)
3. **Over-shoulder** — Looking Around
4. **S-curve** — Weight Shift
5. **Club sway** — Hip Hop Dancing
6. **Hair toss** — Hand Raising

Default: **glam evening + soft idle**. Persist key: `muse-twin-v11`.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · React Three Fiber · Drei · Three.js · `@react-three/postprocessing` · Zustand · MediaPipe Tasks Vision · Framer Motion (available)

## Models & textures

Default twin (`public/models/muse_twin.glb`):

- Photoreal female avatar from **Avaturn**, vendored via the [TalkingHead](https://github.com/met4citizen/TalkingHead) example set (`avatars/avaturn.glb`)
- Includes skinned body, head, eyes, teeth, dual hair meshes, outfit, shoes, and ARKit morph targets
- See `public/models/LICENSE.txt` for credit / non-commercial notes

Animation pack (`public/models/muse_anims.glb`):

- Mixamo motion clips (Idle / Happy Idle / Breathing Idle / Weight Shift / Hip Hop / House Dancing / Looking Around / Hand Raising / Standing Idle), bone names stripped to match Avaturn

Legacy / animation donor (still shipped):

- CC0 Vitruvian body + head + albedo PNGs (CharMorph / Antonia Polygon lineage)

## Photoreal pipeline (v11)

1. One complete character GLB (no head-seating / procedural hair by default)
2. Preserve embedded PBR maps; soft skin tint + hair/iris recolor from ControlPanel
3. Restyle skinned suit into glam colors (full mesh — no discard clips)
4. Beauty lighting (soft key / cool fill / warm rim) + studio HDRI
5. EffectComposer: mild N8AO, glam Bloom, Vignette, SMAA
6. Six pose chips → Mixamo `AnimationMixer` clips (`muse_anims.glb`)

## Brand

Made By Zer01 / Artificially Intelligent, Digitally Enhanced.
