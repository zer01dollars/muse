"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Html } from "@react-three/drei";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { useTwinStore, type PosePreset, type TwinParams } from "@/store/twinStore";
import { GlamWardrobe, applyGlamOutfit } from "@/components/twin/GlamOutfit";

/** Single complete photoreal female (Avaturn) — body + head + hair + outfit. */
const TWIN_URL = "/models/muse_twin.glb";
useGLTF.preload(TWIN_URL);

/** Map Muse face sliders → ARKit / Avaturn morph targets. */
const MORPH_MAP: Record<string, (p: TwinParams) => number> = {
  jawOpen: (p) => Math.max(0, (p.jaw - 0.55) * 0.25),
  jawForward: (p) => Math.max(0, (p.chin - 0.45) * 0.35),
  mouthSmile: (p) => 0.12 + Math.max(0, (p.lipFullness - 0.35) * 0.45),
  mouthSmileLeft: (p) => 0.1 + Math.max(0, (p.lipFullness - 0.35) * 0.4),
  mouthSmileRight: (p) => 0.1 + Math.max(0, (p.lipFullness - 0.35) * 0.4),
  mouthPucker: (p) => Math.max(0, (p.lipFullness - 0.55) * 0.35),
  mouthFunnel: (p) => Math.max(0, (p.lipFullness - 0.6) * 0.3),
  mouthClose: (p) => Math.max(0, (0.45 - p.lipFullness) * 0.2),
  browInnerUp: (p) => Math.max(0, (p.brow - 0.5) * 0.55),
  browOuterUpLeft: (p) => Math.max(0, (p.brow - 0.5) * 0.5),
  browOuterUpRight: (p) => Math.max(0, (p.brow - 0.5) * 0.5),
  browDownLeft: (p) => Math.max(0, (0.5 - p.brow) * 0.4),
  browDownRight: (p) => Math.max(0, (0.5 - p.brow) * 0.4),
  eyeBlinkLeft: (p) => Math.max(0, 1 - p.eyeOpenness) * 0.95,
  eyeBlinkRight: (p) => Math.max(0, 1 - p.eyeOpenness) * 0.95,
  eyesClosed: (p) => Math.max(0, 1 - p.eyeOpenness) * 0.9,
  eyeWideLeft: (p) => Math.max(0, (p.eyeOpenness - 0.7) * 0.7 + (p.eyeSize - 0.5) * 0.35),
  eyeWideRight: (p) => Math.max(0, (p.eyeOpenness - 0.7) * 0.7 + (p.eyeSize - 0.5) * 0.35),
  eyeSquintLeft: (p) => Math.max(0, (0.5 - p.eyeSize) * 0.4),
  eyeSquintRight: (p) => Math.max(0, (0.5 - p.eyeSize) * 0.4),
  cheekSquintLeft: (p) => Math.max(0, (p.cheekbones - 0.5) * 0.35),
  cheekSquintRight: (p) => Math.max(0, (p.cheekbones - 0.5) * 0.35),
  noseSneerLeft: (p) => Math.max(0, (p.noseWidth - 0.5) * 0.2),
  noseSneerRight: (p) => Math.max(0, (p.noseWidth - 0.5) * 0.2),
};

function safeClone(scene: THREE.Object3D) {
  try {
    return SkeletonUtils.clone(scene);
  } catch {
    return scene.clone(true);
  }
}

function findBone(root: THREE.Object3D, base: string): THREE.Bone | null {
  const candidates = [`mixamorig:${base}`, `mixamorig${base}`, base];
  for (const name of candidates) {
    const o = root.getObjectByName(name);
    if (o) return o as THREE.Bone;
  }
  return null;
}

function setBoneScale(
  root: THREE.Object3D,
  base: string,
  sx: number,
  sy: number,
  sz: number
) {
  const bone = findBone(root, base);
  if (!bone) return;
  bone.scale.set(
    THREE.MathUtils.clamp(sx, 0.72, 1.38),
    THREE.MathUtils.clamp(sy, 0.72, 1.38),
    THREE.MathUtils.clamp(sz, 0.72, 1.38)
  );
}

function applyMorphs(root: THREE.Object3D, params: TwinParams) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences)
      return;
    for (const [key, fn] of Object.entries(MORPH_MAP)) {
      const idx = mesh.morphTargetDictionary[key];
      if (idx !== undefined) {
        mesh.morphTargetInfluences[idx] = THREE.MathUtils.clamp(fn(params), 0, 1);
      }
    }
  });
}

function applyFeminineSilhouette(root: THREE.Object3D, p: TwinParams) {
  // Gentle scales only — Avaturn is already feminine; hard scales shear hair/clothes
  const sh = 0.92 + p.shoulders * 0.1;
  setBoneScale(root, "LeftShoulder", sh, 1, sh);
  setBoneScale(root, "RightShoulder", sh, 1, sh);

  setBoneScale(root, "Spine2", 1.0, 1.0, 0.98 + p.chest * 0.06);

  const waist = 0.94 + p.waist * 0.08;
  setBoneScale(root, "Spine1", waist, 1, waist);

  const hips = 1.0 + p.hips * 0.1;
  setBoneScale(root, "Hips", hips, 1, 1.0);

  const arms = 0.92 + p.arms * 0.1;
  setBoneScale(root, "LeftArm", arms, 1, arms);
  setBoneScale(root, "RightArm", arms, 1, arms);

  const legs = 1.0 + p.legs * 0.04;
  setBoneScale(root, "LeftLeg", 1, legs, 1);
  setBoneScale(root, "RightLeg", 1, legs, 1);
}

function skinTint(params: TwinParams): THREE.Color {
  const c = new THREE.Color("#fff6f0");
  c.offsetHSL(params.undertone * 0.015, 0.015 + Math.abs(params.undertone) * 0.02, 0);
  c.offsetHSL(0, 0, -params.freckles * 0.03);
  // Mild lightness from skinTone (0 deep → 1 fair) without crushing albedo
  c.offsetHSL(0, 0, (params.skinTone - 0.5) * 0.06);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  if (hsl.l < 0.86) c.setHSL(hsl.h, hsl.s, 0.86);
  if (hsl.l > 0.98) c.setHSL(hsl.h, hsl.s, 0.98);
  return c;
}

function enhanceMaterials(root: THREE.Object3D, params: TwinParams) {
  const tint = skinTint(params);
  const gloss = 0.28 + params.gloss * 0.45;
  const hairCol = new THREE.Color(params.hairColor);
  const iris = new THREE.Color(params.irisColor);

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const n = `${mesh.name} ${(mats[0] as THREE.Material)?.name || ""}`.toLowerCase();

    for (const mat of mats) {
      if (
        !(mat instanceof THREE.MeshStandardMaterial) &&
        !(mat instanceof THREE.MeshPhysicalMaterial)
      )
        continue;

      // Keep embedded PBR maps — only polish factors
      if (n.includes("hair")) {
        mat.color.copy(hairCol).lerp(new THREE.Color("#ffffff"), 0.45);
        mat.roughness = Math.min(0.95, Math.max(0.62, mat.roughness ?? 0.88));
        mat.metalness = Math.min(0.08, mat.metalness ?? 0.05);
        mat.side = THREE.DoubleSide;
        if (mat instanceof THREE.MeshPhysicalMaterial) {
          mat.sheen = 0.4;
          mat.sheenRoughness = 0.55;
          mat.sheenColor = hairCol.clone().offsetHSL(0, 0.04, 0.12);
          mat.envMapIntensity = 0.65;
        }
        // Hair cards: alpha test (not blend) avoids frizzy halo sorting
        mat.transparent = false;
        mat.depthWrite = true;
        mat.alphaTest = 0.55;
        if (n.includes("hair_1")) {
          mat.transparent = true;
          mat.depthWrite = false;
          mat.alphaTest = 0.4;
          mat.opacity = 0.92;
        }
      } else if (n.includes("eye") && !n.includes("lash") && !n.includes("ao")) {
        // Iris tint multiply — keep eye albedo detail
        mat.color.copy(iris).lerp(new THREE.Color("#ffffff"), 0.55);
        mat.roughness = Math.min(0.25, mat.roughness ?? 0.2);
        mat.metalness = 0.05;
        if (mat instanceof THREE.MeshPhysicalMaterial) {
          mat.clearcoat = 0.9;
          mat.clearcoatRoughness = 0.08;
          mat.envMapIntensity = 1.1;
        }
      } else if (n.includes("lash") || n.includes("eyeao")) {
        mat.transparent = true;
        mat.depthWrite = false;
        mat.side = THREE.DoubleSide;
      } else if (
        n.includes("head") ||
        n.includes("body") ||
        n.includes("skin") ||
        n.includes("avatar")
      ) {
        mat.color.copy(tint);
        // Keep skin matte-soft — high clearcoat reads as plastic mannequin
        mat.roughness = Math.min(0.82, Math.max(0.48, 0.78 - gloss * 0.28));
        mat.metalness = 0;
        mat.metalnessMap = null;
        if (mat instanceof THREE.MeshPhysicalMaterial) {
          mat.clearcoat = 0.02 + params.gloss * 0.06;
          mat.clearcoatRoughness = 0.62;
          mat.sheen = 0.22;
          mat.sheenRoughness = 0.62;
          mat.sheenColor = new THREE.Color("#e8b8a8");
          mat.envMapIntensity = 0.55;
        } else {
          mat.envMapIntensity = 0.55;
        }
      } else if (n.includes("look") || n.includes("outfit") || n.includes("cloth")) {
        // Owned by GlamOutfit.applyGlamOutfit — do not stomp sequin/sheer styling
        continue;
      } else if (n.includes("shoe")) {
        mat.roughness = Math.min(0.55, mat.roughness ?? 0.5);
        mat.metalness = Math.min(0.35, mat.metalness ?? 0.15);
      } else if (n.includes("teeth") || n.includes("tongue")) {
        mat.roughness = Math.min(0.35, mat.roughness ?? 0.3);
        if (mat instanceof THREE.MeshPhysicalMaterial) {
          mat.clearcoat = 0.45;
          mat.clearcoatRoughness = 0.2;
        }
      }

      mat.needsUpdate = true;
    }
  });
}

type BoneDelta = [number, number, number];

/** Bones with wild Mixamo bind quats — never Euler-delta these (causes stick arms). */
const SKIP_EULER_BONES = new Set([
  "LeftShoulder",
  "RightShoulder",
  "LeftUpLeg",
  "RightUpLeg",
  "LeftLeg",
  "RightLeg",
]);

const _poseEuler = new THREE.Euler();
const _poseQDelta = new THREE.Quaternion();

function ensureBindQuats(root: THREE.Object3D) {
  if (root.userData.museBindQuats) return;
  resetSkeletonPose(root);
  const map: Record<string, THREE.Quaternion> = {};
  for (const base of [
    "Hips",
    "Spine",
    "Spine1",
    "Spine2",
    "Neck",
    "Head",
    "LeftArm",
    "LeftForeArm",
    "LeftHand",
    "RightArm",
    "RightForeArm",
    "RightHand",
  ]) {
    const b = findBone(root, base);
    if (b) map[base] = b.quaternion.clone();
  }
  root.userData.museBindQuats = map;
}

function resetSkeletonPose(root: THREE.Object3D) {
  root.traverse((o) => {
    const skin = o as THREE.SkinnedMesh;
    if (skin.isSkinnedMesh && skin.skeleton) {
      skin.skeleton.pose();
    }
  });
}

function clampDelta(name: string, dx: number, dy: number, dz: number): BoneDelta {
  // Forearms may bend more; arms/spine stay modest to avoid T-pose sticks
  const isFore = /ForeArm|Hand/i.test(name);
  const lim = isFore ? 1.25 : 0.72;
  return [
    THREE.MathUtils.clamp(dx, -lim, lim),
    THREE.MathUtils.clamp(dy, -lim * 0.85, lim * 0.85),
    THREE.MathUtils.clamp(dz, -lim, lim),
  ];
}

/**
 * Static glam pose offsets — Mixamo A-pose local Euler deltas (radians).
 * Applied as bindQuat * deltaQuat so shoulder bind stays intact.
 * Bone names verified on muse_twin.glb: Hips, Spine*, Neck, Head, Left/RightArm, ForeArm, Hand.
 */
function poseStaticOffsets(preset: PosePreset, p: TwinParams): Record<string, BoneDelta> {
  const armL = THREE.MathUtils.clamp(p.armL, -0.5, 0.7);
  const armR = THREE.MathUtils.clamp(p.armR, -0.5, 0.7);
  const lean = THREE.MathUtils.clamp(p.torsoLean, -0.35, 0.35);

  switch (preset) {
    case "hand-on-hip":
      // Model pose: left hand rests near hip, right arm soft at side — no shoulder Euler
      return {
        Hips: [0.015, 0.05, 0.03],
        Spine: [0.03, 0.04, lean * 0.06],
        Spine1: [0.02, 0.03, 0.015],
        Spine2: [0.015, 0.02, -0.015],
        Neck: [-0.03, -0.06, 0.015],
        Head: [-0.015, -0.08, 0.015],
        // Left: upper arm slightly back/in, elbow bends so hand meets hip
        LeftArm: [0.35 + armL * 0.08, 0.12, -0.42],
        LeftForeArm: [0.05, 0.08, -1.05],
        LeftHand: [0.08, 0.12, -0.15],
        // Right: relaxed, slightly away from T
        RightArm: [0.12 + armR * 0.05, -0.04, 0.22],
        RightForeArm: [0.04, -0.02, 0.18],
      };
    case "over-shoulder":
      return {
        Hips: [0.01, -0.08, -0.02],
        Spine: [0.025, -0.12, lean * 0.04],
        Spine1: [0.015, -0.08, -0.03],
        Spine2: [0.015, -0.07, -0.015],
        Neck: [-0.04, -0.32, 0.04],
        Head: [-0.03, -0.38, 0.05],
        LeftArm: [0.08, 0.04, -0.22 + armL * 0.06],
        LeftForeArm: [0.04, 0, -0.12],
        RightArm: [-0.12 + armR * 0.05, 0.15, 0.38],
        RightForeArm: [-0.35, 0.06, 0.15],
        RightHand: [0, 0.1, 0.08],
      };
    case "s-curve":
      return {
        Hips: [0.02, 0.05, 0.06],
        Spine: [0.035, 0.04, lean * 0.08],
        Spine1: [0.025, -0.03, -0.05],
        Spine2: [0.02, 0.03, 0.04],
        Neck: [-0.025, -0.05, -0.03],
        Head: [-0.015, -0.07, 0.02],
        LeftArm: [0.1, 0.08, -0.28 + armL * 0.08],
        LeftForeArm: [-0.04, 0.04, -0.28],
        RightArm: [0.08, -0.08, 0.32 + armR * 0.08],
        RightForeArm: [0.04, -0.04, 0.2],
      };
    case "club-sway":
      return {
        Hips: [0.015, 0, 0],
        Spine: [0.02, 0, lean * 0.03],
        Spine1: [0.015, 0, 0],
        Spine2: [0.01, 0, 0],
        Neck: [-0.015, -0.03, 0],
        Head: [-0.01, -0.04, 0],
        LeftArm: [0.06, 0.05, -0.22 + armL * 0.06],
        LeftForeArm: [-0.06, 0.03, -0.15],
        RightArm: [0.06, -0.05, 0.22 + armR * 0.06],
        RightForeArm: [-0.06, -0.03, 0.15],
      };
    case "hair-toss":
      // Arms raised without wrenching Shoulder bind quats
      return {
        Hips: [0.015, -0.04, -0.015],
        Spine: [0.04, -0.05, lean * 0.04],
        Spine1: [0.04, -0.04, 0],
        Spine2: [0.05, -0.03, 0],
        Neck: [-0.1, 0.06, 0],
        Head: [-0.15, 0.1, 0.03],
        LeftArm: [-0.65 + armL * 0.08, 0.15, -0.2],
        LeftForeArm: [-0.25, 0.06, -0.12],
        RightArm: [-0.65 + armR * 0.08, -0.15, 0.2],
        RightForeArm: [-0.25, -0.06, 0.12],
      };
    case "soft-idle":
    default:
      return {
        Hips: [0, 0, 0],
        Spine: [0.02, 0, lean * 0.03],
        Spine1: [0.015, 0, 0],
        Spine2: [0.008, 0, 0],
        Neck: [-0.015, -0.025, 0],
        Head: [-0.01, -0.04, 0],
        // Soft natural A-pose tuck (not T-stick)
        LeftArm: [0.06, 0.02, -0.18 + armL * 0.08],
        LeftForeArm: [-0.02, 0.02, -0.08],
        RightArm: [0.06, -0.02, 0.18 + armR * 0.08],
        RightForeArm: [-0.02, -0.02, 0.08],
      };
  }
}

/** Looping motion layers — soft idle breath/sway, club groove, hair-toss pulse. */
function poseMotionLayer(
  preset: PosePreset,
  t: number
): Record<string, BoneDelta> {
  const breath = Math.sin(t * 1.05) * 0.01;
  const sway = Math.sin(t * 0.5) * 0.015;
  const headBob = Math.sin(t * 0.35) * 0.006;

  if (preset === "club-sway") {
    const g = t * 2.2;
    const hip = Math.sin(g) * 0.05;
    const bounce = Math.abs(Math.sin(g)) * 0.02;
    const armPump = Math.sin(g + 0.4) * 0.05;
    return {
      Hips: [bounce * 0.25, hip * 0.25, hip * 0.7],
      Spine: [breath + bounce, hip * 0.2, hip * 0.3],
      Spine1: [breath * 0.5, hip * 0.12, -hip * 0.15],
      Spine2: [0.008 + bounce * 0.3, hip * 0.08, hip * 0.1],
      Neck: [-0.015, -0.02 + hip * 0.15, 0],
      Head: [-0.008 + headBob, -0.03 + hip * 0.1, 0],
      LeftArm: [0.015 + armPump, 0.025, -0.03 * Math.sin(g)],
      RightArm: [0.015 - armPump, -0.025, 0.03 * Math.sin(g)],
    };
  }

  if (preset === "hair-toss") {
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.8);
    const toss = Math.sin(t * 1.8) * 0.08;
    return {
      Head: [-0.04 * pulse + toss * 0.25, toss, Math.sin(t * 2.1) * 0.03],
      Neck: [-0.03 * pulse, toss * 0.4, 0],
      Spine2: [0.015 * pulse, toss * 0.15, 0],
      LeftArm: [-0.05 * pulse, 0.03 * Math.sin(t * 2), -0.025 * pulse],
      RightArm: [-0.05 * pulse, -0.03 * Math.sin(t * 2), 0.025 * pulse],
    };
  }

  const amp = preset === "soft-idle" ? 1 : 0.45;
  return {
    Hips: [0, sway * 0.15 * amp, sway * 0.06 * amp],
    Spine: [breath * amp, sway * 0.08 * amp, 0],
    Spine1: [breath * 0.45 * amp, sway * 0.05 * amp, 0],
    Spine2: [0, sway * 0.03 * amp, 0],
    Neck: [0, sway * 0.03 * amp, 0],
    Head: [headBob * amp, sway * 0.025 * amp, 0],
  };
}

/**
 * Drive glam pose presets from bind quaternions + clamped Euler deltas.
 * Skips Shoulder bones (Mixamo bind quats break under Euler add).
 */
function applyGlamPose(root: THREE.Object3D, p: TwinParams, t: number) {
  ensureBindQuats(root);
  resetSkeletonPose(root);

  const bindMap = root.userData.museBindQuats as Record<string, THREE.Quaternion>;
  const merged: Record<string, BoneDelta> = {};

  const accumulate = (map: Record<string, BoneDelta>) => {
    for (const [name, d] of Object.entries(map)) {
      if (SKIP_EULER_BONES.has(name)) continue;
      const prev = merged[name] ?? [0, 0, 0];
      merged[name] = [prev[0] + d[0], prev[1] + d[1], prev[2] + d[2]];
    }
  };

  accumulate(poseStaticOffsets(p.posePreset, p));
  accumulate(poseMotionLayer(p.posePreset, t));

  for (const [name, d] of Object.entries(merged)) {
    const b = findBone(root, name);
    if (!b) continue;
    const [dx, dy, dz] = clampDelta(name, d[0], d[1], d[2]);
    const bind = bindMap[name];
    if (bind) {
      _poseEuler.set(dx, dy, dz, "XYZ");
      _poseQDelta.setFromEuler(_poseEuler);
      b.quaternion.copy(bind).multiply(_poseQDelta);
    } else {
      b.rotation.x += dx;
      b.rotation.y += dy;
      b.rotation.z += dz;
    }
  }
}

function TwinRig() {
  const wrap = useRef<THREE.Group>(null);
  const params = useTwinStore((s) => s.params);
  const logged = useRef(false);

  const twinGltf = useGLTF(TWIN_URL);
  const twin = useMemo(() => safeClone(twinGltf.scene), [twinGltf.scene]);

  useLayoutEffect(() => {
    const p0 = useTwinStore.getState().params;
    enhanceMaterials(twin, p0);
    applyGlamOutfit(twin, p0.outfitPreset);
    applyMorphs(twin, p0);
    applyFeminineSilhouette(twin, p0);

    // Capture bind rotations for head so idle never drifts into neck-break
    const head = findBone(twin, "Head");
    if (head) head.userData.baseQuat = head.quaternion.clone();

    if (!logged.current) {
      logged.current = true;
      const meshNames: string[] = [];
      twin.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshNames.push(o.name);
      });
      twin.traverse((o) => {
        // Secondary flyaway cards often read as frizz — keep main groom only
        if (/hair_1/i.test(o.name)) o.visible = false;
      });
      console.info("[Muse] twin loaded", { meshes: meshNames });
    }
  }, [twin]);

  useEffect(() => {
    enhanceMaterials(twin, params);
    applyGlamOutfit(twin, params.outfitPreset);
    applyMorphs(twin, params);
    applyFeminineSilhouette(twin, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- granular param deps avoid full-object churn
  }, [
    twin,
    params.skinTone,
    params.undertone,
    params.freckles,
    params.gloss,
    params.irisColor,
    params.hairColor,
    params.faceWidth,
    params.chin,
    params.jaw,
    params.noseLength,
    params.noseWidth,
    params.lipFullness,
    params.brow,
    params.eyeOpenness,
    params.eyeSize,
    params.cheekbones,
    params.shoulders,
    params.chest,
    params.waist,
    params.hips,
    params.arms,
    params.legs,
    params.muscle,
    params.outfitPreset,
  ]);

  useEffect(() => {
    const head = findBone(twin, "Head");
    if (!head) return;
    const fw = 0.94 + params.faceWidth * 0.08 + (params.cheekbones - 0.5) * 0.04;
    const fh =
      0.96 +
      (params.chin - 0.5) * 0.04 +
      (params.jaw - 0.5) * 0.025 -
      (params.cheekbones - 0.5) * 0.02;
    const fd =
      0.96 +
      (params.noseLength - 0.5) * 0.035 +
      (params.cheekbones - 0.5) * 0.025;
    head.scale.set(fw, fh, fd);
  }, [
    twin,
    params.faceWidth,
    params.chin,
    params.jaw,
    params.noseLength,
    params.cheekbones,
  ]);

  useFrame(({ clock }) => {
    if (!wrap.current) return;
    const p = useTwinStore.getState().params;
    wrap.current.scale.setScalar(0.95 + p.height * 0.1);
    applyGlamPose(twin, p, clock.elapsedTime);
    applyFeminineSilhouette(twin, p);
  });

  return (
    <group ref={wrap} dispose={null}>
      <primitive object={twin} />
      <GlamWardrobe twin={twin} outfit={params.outfitPreset} />
    </group>
  );
}

export function TwinAvatar() {
  const rotateY = useTwinStore((s) => s.params.rotateY);
  return (
    <group rotation={[0, rotateY, 0]} position={[0, 0, 0]}>
      <TwinRig />
    </group>
  );
}

export function TwinLoadingFallback() {
  return (
    <Html center>
      <div className="rounded-full border border-violet-300/30 bg-black/60 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-violet-100/90 backdrop-blur">
        Loading twin…
      </div>
    </Html>
  );
}
