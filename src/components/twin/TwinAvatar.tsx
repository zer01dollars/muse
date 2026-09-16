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
/** Mixamo clips retargeted to Avaturn bone names (Hips, LeftArm, …). */
const ANIMS_URL = "/models/muse_anims.glb";
useGLTF.preload(TWIN_URL);
useGLTF.preload(ANIMS_URL);

/** Pose chip → animation clip name in muse_anims.glb */
const POSE_CLIP: Record<PosePreset, string> = {
  "soft-idle": "soft-idle",
  "hand-on-hip": "hand-on-hip",
  "over-shoulder": "over-shoulder",
  "s-curve": "s-curve",
  "club-sway": "club-sway",
  "hair-toss": "hair-toss",
};

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
  eyeWideLeft: (p) =>
    Math.max(0, (p.eyeOpenness - 0.7) * 0.7 + (p.eyeSize - 0.5) * 0.35),
  eyeWideRight: (p) =>
    Math.max(0, (p.eyeOpenness - 0.7) * 0.7 + (p.eyeSize - 0.5) * 0.35),
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

/** Soft silhouette scales — never touch arm bone scales (breaks Mixamo clips). */
function applyFeminineSilhouette(root: THREE.Object3D, p: TwinParams) {
  const sh = 0.92 + p.shoulders * 0.1;
  setBoneScale(root, "LeftShoulder", sh, 1, sh);
  setBoneScale(root, "RightShoulder", sh, 1, sh);

  setBoneScale(root, "Spine2", 1.0, 1.0, 0.98 + p.chest * 0.06);

  const waist = 0.94 + p.waist * 0.08;
  setBoneScale(root, "Spine1", waist, 1, waist);

  const hips = 1.0 + p.hips * 0.1;
  setBoneScale(root, "Hips", hips, 1, 1.0);

  // Force arm scales identity — prior versions left sticky non-1 scales
  for (const n of [
    "LeftArm",
    "RightArm",
    "LeftForeArm",
    "RightForeArm",
    "LeftHand",
    "RightHand",
  ]) {
    const b = findBone(root, n);
    if (b) b.scale.set(1, 1, 1);
  }

  const legs = 1.0 + p.legs * 0.04;
  setBoneScale(root, "LeftLeg", 1, legs, 1);
  setBoneScale(root, "RightLeg", 1, legs, 1);
}

function skinTint(params: TwinParams): THREE.Color {
  const c = new THREE.Color("#fff6f0");
  c.offsetHSL(params.undertone * 0.015, 0.015 + Math.abs(params.undertone) * 0.02, 0);
  c.offsetHSL(0, 0, -params.freckles * 0.03);
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

function TwinRig() {
  const wrap = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const activeClipRef = useRef<string | null>(null);
  const params = useTwinStore((s) => s.params);
  const logged = useRef(false);

  const twinGltf = useGLTF(TWIN_URL);
  const animsGltf = useGLTF(ANIMS_URL);
  const twin = useMemo(() => safeClone(twinGltf.scene), [twinGltf.scene]);

  // Build AnimationMixer once — drives Mixamo clips on Avaturn bones
  useLayoutEffect(() => {
    const mixer = new THREE.AnimationMixer(twin);
    mixerRef.current = mixer;
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const clip of animsGltf.animations) {
      const action = mixer.clipAction(clip);
      action.enabled = true;
      action.setEffectiveWeight(1);
      // Loops for idle / sway; one-shots still loop gently so pose chips stay alive
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
      actions[clip.name] = action;
    }
    actionsRef.current = actions;

    // Start soft-idle immediately so default view is never T-pose
    const startName = POSE_CLIP[useTwinStore.getState().params.posePreset] ?? "soft-idle";
    const start =
      actions[startName] ?? actions["soft-idle"] ?? Object.values(actions)[0];
    if (start) {
      start.reset().fadeIn(0.01).play();
      activeClipRef.current = start.getClip().name;
      console.info("[Muse] AnimationMixer ready", {
        clips: Object.keys(actions),
        playing: activeClipRef.current,
      });
    }

    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
      actionsRef.current = {};
      activeClipRef.current = null;
    };
  }, [twin, animsGltf.animations]);

  useLayoutEffect(() => {
    const p0 = useTwinStore.getState().params;
    enhanceMaterials(twin, p0);
    applyGlamOutfit(twin, p0.outfitPreset);
    applyMorphs(twin, p0);
    applyFeminineSilhouette(twin, p0);

    if (!logged.current) {
      logged.current = true;
      const meshNames: string[] = [];
      twin.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshNames.push(o.name);
      });
      twin.traverse((o) => {
        if (/hair_1/i.test(o.name)) o.visible = false;
      });
      console.info("[Muse] twin loaded (native bind + Mixamo mixer)", {
        meshes: meshNames,
      });
    }
  }, [twin]);

  useEffect(() => {
    enhanceMaterials(twin, params);
    applyGlamOutfit(twin, params.outfitPreset);
    applyMorphs(twin, params);
    applyFeminineSilhouette(twin, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- granular param deps
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

  // Crossfade when pose chip changes
  useEffect(() => {
    const actions = actionsRef.current;
    const clipName = POSE_CLIP[params.posePreset] ?? "soft-idle";
    const next =
      actions[clipName] ?? actions["soft-idle"] ?? Object.values(actions)[0];
    if (!next) return;
    if (activeClipRef.current === next.getClip().name) return;

    const prevName = activeClipRef.current;
    const prev = prevName ? actions[prevName] : null;
    next.reset();
    // Club sway slightly faster / higher energy
    next.timeScale = params.posePreset === "club-sway" ? 1.05 : 1;
    next.setEffectiveWeight(1);
    next.play();
    if (prev && prev !== next) {
      prev.crossFadeTo(next, 0.45, false);
    } else {
      next.fadeIn(0.35);
    }
    activeClipRef.current = next.getClip().name;
  }, [params.posePreset]);

  useFrame((_, delta) => {
    if (!wrap.current) return;
    const p = useTwinStore.getState().params;
    wrap.current.scale.setScalar(0.95 + p.height * 0.1);
    // Real animation — no Euler pose driver, no skeleton.pose()
    mixerRef.current?.update(delta);
    // Re-assert arm scale identity after mixer (some clips touch scale channels we stripped)
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
