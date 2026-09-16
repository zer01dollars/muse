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
  // Gentle scales only — never scale arm bones (causes stick/T-pose artifacts)
  const sh = 0.92 + p.shoulders * 0.1;
  setBoneScale(root, "LeftShoulder", sh, 1, sh);
  setBoneScale(root, "RightShoulder", sh, 1, sh);

  setBoneScale(root, "Spine2", 1.0, 1.0, 0.98 + p.chest * 0.06);

  const waist = 0.94 + p.waist * 0.08;
  setBoneScale(root, "Spine1", waist, 1, waist);

  const hips = 1.0 + p.hips * 0.1;
  setBoneScale(root, "Hips", hips, 1, 1.0);

  // Reset arm scale to identity — prior versions scaled LeftArm/RightArm
  const la = findBone(root, "LeftArm");
  const ra = findBone(root, "RightArm");
  if (la) la.scale.set(1, 1, 1);
  if (ra) ra.scale.set(1, 1, 1);

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

/** Bones we never Euler-delta (Mixamo bind quats break under add). */
const SKIP_EULER_BONES = new Set([
  "LeftShoulder",
  "RightShoulder",
  "LeftUpLeg",
  "RightUpLeg",
  "LeftLeg",
  "RightLeg",
]);

const MANAGED_BONES = [
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
] as const;

const _poseEuler = new THREE.Euler();
const _poseQDelta = new THREE.Quaternion();

/**
 * Calibrated soft A-pose arm deltas (radians, XYZ) vs muse_twin.glb bind.
 * Logged once at capture — arms tucked clearly off T-pose without stick shear.
 */
const APOSE_ARMS: Record<string, BoneDelta> = {
  LeftArm: [0.12, 0.1, -0.62],
  LeftForeArm: [0.08, 0.06, -0.35],
  LeftHand: [0.02, 0.04, -0.06],
  RightArm: [0.12, -0.1, 0.62],
  RightForeArm: [0.08, -0.06, 0.35],
  RightHand: [0.02, -0.04, 0.06],
};

function ensureBindQuats(root: THREE.Object3D) {
  if (root.userData.museBindQuats) return;
  // One-time bind snapshot (skeleton.pose once only — never every frame)
  root.traverse((o) => {
    const skin = o as THREE.SkinnedMesh;
    if (skin.isSkinnedMesh && skin.skeleton) {
      skin.skeleton.pose();
    }
  });
  const map: Record<string, THREE.Quaternion> = {};
  for (const base of MANAGED_BONES) {
    const b = findBone(root, base);
    if (b) map[base] = b.quaternion.clone();
  }
  root.userData.museBindQuats = map;

  // Log calibrated A-pose arm quats once for QA / future Mixamo retarget
  if (!root.userData.museAposeLogged) {
    root.userData.museAposeLogged = true;
    const logged: Record<string, number[]> = {};
    for (const [name, d] of Object.entries(APOSE_ARMS)) {
      const bind = map[name];
      if (!bind) continue;
      _poseEuler.set(d[0], d[1], d[2], "XYZ");
      _poseQDelta.setFromEuler(_poseEuler);
      const q = bind.clone().multiply(_poseQDelta);
      logged[name] = q.toArray().map((n) => +n.toFixed(5));
    }
    console.info("[Muse] calibrated A-pose arm quats", logged);
  }
}

/** Restore managed bones from bind — avoids fighting Avaturn via skeleton.pose() every frame. */
function restoreBindQuats(root: THREE.Object3D) {
  const bindMap = root.userData.museBindQuats as Record<string, THREE.Quaternion> | undefined;
  if (!bindMap) return;
  for (const name of MANAGED_BONES) {
    const b = findBone(root, name);
    const q = bindMap[name];
    if (b && q) b.quaternion.copy(q);
  }
}

function clampDelta(name: string, dx: number, dy: number, dz: number): BoneDelta {
  // Modest clamps — large Euler offsets caused stick/T-pose on Avaturn bind
  const isFore = /ForeArm|Hand/i.test(name);
  const isArm = /^(Left|Right)Arm$/.test(name);
  const lim = isFore ? 0.85 : isArm ? 0.75 : 0.45;
  return [
    THREE.MathUtils.clamp(dx, -lim, lim),
    THREE.MathUtils.clamp(dy, -lim * 0.75, lim * 0.75),
    THREE.MathUtils.clamp(dz, -lim, lim),
  ];
}

/**
 * Static glam pose offsets — small safe deltas on top of calibrated A-pose arms.
 * Soft-idle uses A-pose arms only (clearly not T-pose).
 */
function poseStaticOffsets(preset: PosePreset, p: TwinParams): Record<string, BoneDelta> {
  const armL = THREE.MathUtils.clamp(p.armL, -0.5, 0.7);
  const armR = THREE.MathUtils.clamp(p.armR, -0.5, 0.7);
  const lean = THREE.MathUtils.clamp(p.torsoLean, -0.35, 0.35);

  // Always start from calibrated A-pose arms so soft-idle / others leave T-pose
  const arms: Record<string, BoneDelta> = {
    LeftArm: [
      APOSE_ARMS.LeftArm[0] + armL * 0.06,
      APOSE_ARMS.LeftArm[1],
      APOSE_ARMS.LeftArm[2],
    ],
    LeftForeArm: [...APOSE_ARMS.LeftForeArm] as BoneDelta,
    LeftHand: [...APOSE_ARMS.LeftHand] as BoneDelta,
    RightArm: [
      APOSE_ARMS.RightArm[0] + armR * 0.06,
      APOSE_ARMS.RightArm[1],
      APOSE_ARMS.RightArm[2],
    ],
    RightForeArm: [...APOSE_ARMS.RightForeArm] as BoneDelta,
    RightHand: [...APOSE_ARMS.RightHand] as BoneDelta,
  };

  switch (preset) {
    case "hand-on-hip":
      return {
        Hips: [0.01, 0.04, 0.025],
        Spine: [0.025, 0.03, lean * 0.05],
        Spine1: [0.015, 0.02, 0.01],
        Spine2: [0.01, 0.015, -0.01],
        Neck: [-0.02, -0.05, 0.01],
        Head: [-0.01, -0.06, 0.01],
        ...arms,
        // Modest hip-hand bend from A-pose (no large broken Eulers)
        LeftArm: [0.22 + armL * 0.05, 0.08, -0.48],
        LeftForeArm: [0.06, 0.05, -0.72],
        LeftHand: [0.05, 0.08, -0.1],
        RightArm: [0.1 + armR * 0.04, -0.04, 0.45],
        RightForeArm: [0.04, -0.02, 0.22],
      };
    case "over-shoulder":
      return {
        Hips: [0.008, -0.06, -0.015],
        Spine: [0.02, -0.09, lean * 0.03],
        Spine1: [0.012, -0.06, -0.02],
        Spine2: [0.01, -0.05, -0.01],
        Neck: [-0.03, -0.22, 0.03],
        Head: [-0.02, -0.28, 0.04],
        ...arms,
        LeftArm: [0.1, 0.06, -0.55 + armL * 0.05],
        RightArm: [0.05 + armR * 0.04, 0.1, 0.48],
        RightForeArm: [-0.22, 0.04, 0.12],
      };
    case "s-curve":
      return {
        Hips: [0.015, 0.04, 0.05],
        Spine: [0.03, 0.03, lean * 0.06],
        Spine1: [0.02, -0.025, -0.04],
        Spine2: [0.015, 0.025, 0.03],
        Neck: [-0.02, -0.04, -0.02],
        Head: [-0.01, -0.05, 0.015],
        ...arms,
        LeftArm: [0.1, 0.08, -0.58 + armL * 0.05],
        LeftForeArm: [0.02, 0.04, -0.32],
        RightArm: [0.1, -0.08, 0.58 + armR * 0.05],
        RightForeArm: [0.02, -0.04, 0.28],
      };
    case "club-sway":
      return {
        Hips: [0.01, 0, 0],
        Spine: [0.015, 0, lean * 0.025],
        Spine1: [0.01, 0, 0],
        Spine2: [0.008, 0, 0],
        Neck: [-0.012, -0.02, 0],
        Head: [-0.008, -0.03, 0],
        ...arms,
      };
    case "hair-toss":
      return {
        Hips: [0.01, -0.03, -0.01],
        Spine: [0.03, -0.04, lean * 0.03],
        Spine1: [0.03, -0.03, 0],
        Spine2: [0.04, -0.02, 0],
        Neck: [-0.08, 0.05, 0],
        Head: [-0.1, 0.08, 0.02],
        // Raised but clamped — avoid -0.65 stick offsets
        LeftArm: [-0.45 + armL * 0.05, 0.12, -0.28],
        LeftForeArm: [-0.18, 0.05, -0.1],
        RightArm: [-0.45 + armR * 0.05, -0.12, 0.28],
        RightForeArm: [-0.18, -0.05, 0.1],
        LeftHand: arms.LeftHand,
        RightHand: arms.RightHand,
      };
    case "soft-idle":
    default:
      return {
        Hips: [0, 0, 0],
        Spine: [0.015, 0, lean * 0.025],
        Spine1: [0.01, 0, 0],
        Spine2: [0.006, 0, 0],
        Neck: [-0.012, -0.02, 0],
        Head: [-0.008, -0.03, 0],
        // Soft idle = calibrated A-pose (not T-stick)
        ...arms,
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
    const hip = Math.sin(g) * 0.04;
    const bounce = Math.abs(Math.sin(g)) * 0.015;
    const armPump = Math.sin(g + 0.4) * 0.035;
    return {
      Hips: [bounce * 0.25, hip * 0.25, hip * 0.6],
      Spine: [breath + bounce, hip * 0.15, hip * 0.25],
      Spine1: [breath * 0.5, hip * 0.1, -hip * 0.12],
      Spine2: [0.006 + bounce * 0.25, hip * 0.06, hip * 0.08],
      Neck: [-0.01, -0.015 + hip * 0.12, 0],
      Head: [-0.006 + headBob, -0.025 + hip * 0.08, 0],
      LeftArm: [0.01 + armPump, 0.015, -0.02 * Math.sin(g)],
      RightArm: [0.01 - armPump, -0.015, 0.02 * Math.sin(g)],
    };
  }

  if (preset === "hair-toss") {
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.8);
    const toss = Math.sin(t * 1.8) * 0.06;
    return {
      Head: [-0.03 * pulse + toss * 0.2, toss, Math.sin(t * 2.1) * 0.025],
      Neck: [-0.02 * pulse, toss * 0.35, 0],
      Spine2: [0.012 * pulse, toss * 0.12, 0],
      LeftArm: [-0.03 * pulse, 0.02 * Math.sin(t * 2), -0.015 * pulse],
      RightArm: [-0.03 * pulse, -0.02 * Math.sin(t * 2), 0.015 * pulse],
    };
  }

  const amp = preset === "soft-idle" ? 1 : 0.4;
  return {
    Hips: [0, sway * 0.12 * amp, sway * 0.05 * amp],
    Spine: [breath * amp, sway * 0.06 * amp, 0],
    Spine1: [breath * 0.4 * amp, sway * 0.04 * amp, 0],
    Spine2: [0, sway * 0.025 * amp, 0],
    Neck: [0, sway * 0.025 * amp, 0],
    Head: [headBob * amp, sway * 0.02 * amp, 0],
  };
}

/**
 * Drive glam pose from bind quaternions + clamped Euler deltas.
 * No per-frame skeleton.pose() — restores managed bones from captured bind only.
 */
function applyGlamPose(root: THREE.Object3D, p: TwinParams, t: number) {
  ensureBindQuats(root);
  restoreBindQuats(root);

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
