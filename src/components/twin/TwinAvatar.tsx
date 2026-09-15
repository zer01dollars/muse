"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, Html } from "@react-three/drei";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import {
  skinColorFromParams,
  useTwinStore,
  type TwinParams,
} from "@/store/twinStore";
import { ProceduralHair } from "./ProceduralHair";

useGLTF.preload("/models/vitruvian_body.glb");
useGLTF.preload("/models/vitruvian_head.glb");

const LIP_COLOR = "#c45a6a";
const IRIS_GLOSS = 0.12;

const MORPH_MAP: Record<string, (p: TwinParams) => number> = {
  // Softer jaw: only engage when jaw is high (masculine square)
  Jaw_Lower: (p) => Math.max(0, (p.jaw - 0.55) * 0.4),
  Lips_Up_Funnel: (p) => Math.max(0, (p.lipFullness - 0.35) * 0.55),
  Smile_Lips_Closed: (p) => 0.06 + Math.max(0, (p.lipFullness - 0.4) * 0.35),
  Kiss: (p) => Math.max(0, (p.lipFullness - 0.55) * 0.45),
  Eyebrows_Raised_Left: (p) => Math.max(0, (p.brow - 0.5) * 0.55),
  Eyebrows_Raised_Right: (p) => Math.max(0, (p.brow - 0.5) * 0.55),
  Eyebrows_Frown_Left: (p) => Math.max(0, (0.5 - p.brow) * 0.4),
  Eyebrows_Frown_Right: (p) => Math.max(0, (0.5 - p.brow) * 0.4),
  Eyes_Closed_Max: (p) => Math.max(0, 1 - p.eyeOpenness) * 0.95,
  Eyes_Opened_Max_Left: (p) => Math.max(0, (p.eyeOpenness - 0.65) * 0.9),
  Eyes_Opened_Max_Right: (p) => Math.max(0, (p.eyeOpenness - 0.65) * 0.9),
  Eyes_Squint: (p) => Math.max(0, (0.5 - p.eyeSize) * 0.45),
  Happy: () => 0.08,
};

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

/** Prettier feminine face: MeshPhysical skin, warm lips, glossy iris */
function paintHead(root: THREE.Object3D, params: TwinParams) {
  const skin = skinColorFromParams(params.skinTone, params.undertone);
  const gloss = 0.28 + params.gloss * 0.5;
  const freckle = params.freckles * 0.07;

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.visible = true;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const matName =
      (Array.isArray(mesh.material)
        ? mesh.material.map((m) => m?.name || "").join(" ")
        : (mesh.material as THREE.Material | undefined)?.name) || "";
    const n = `${mesh.name} ${matName}`.toLowerCase();

    const isIris = n.includes("iris");
    const isSclera = n.includes("sclera") || n.includes("eyeback");
    const isCornea = n.includes("cornea") || n.includes("tear");
    const isMouth =
      n.includes("mouth") ||
      n.includes("lip") ||
      n.includes("tooth") ||
      n.includes("gum");
    const isShadow = n.includes("eyeshadow") || n.includes("lash");
    const isEyePart =
      isIris || isSclera || isCornea || n.includes("eye") || n.includes("caruncle");

    let material: THREE.Material;

    if (isIris) {
      material = new THREE.MeshPhysicalMaterial({
        color: params.irisColor,
        roughness: IRIS_GLOSS,
        metalness: 0.15,
        clearcoat: 0.65,
        clearcoatRoughness: 0.12,
        sheen: 0.4,
        sheenColor: new THREE.Color(params.irisColor).offsetHSL(0, 0.1, 0.2),
        envMapIntensity: 0.8,
        side: THREE.DoubleSide,
      });
    } else if (isSclera) {
      material = new THREE.MeshPhysicalMaterial({
        color: "#f4f0ea",
        roughness: 0.35,
        metalness: 0,
        clearcoat: 0.25,
        clearcoatRoughness: 0.3,
        side: THREE.DoubleSide,
      });
    } else if (isCornea) {
      material = new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        roughness: 0.08,
        metalness: 0,
        transmission: 0.15,
        thickness: 0.2,
        transparent: true,
        opacity: 0.35,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        side: THREE.DoubleSide,
      });
    } else if (isMouth) {
      material = new THREE.MeshPhysicalMaterial({
        color: LIP_COLOR,
        roughness: 0.28,
        metalness: 0.02,
        clearcoat: 0.45,
        clearcoatRoughness: 0.2,
        sheen: 0.6,
        sheenColor: new THREE.Color("#e8909a"),
        envMapIntensity: 0.55,
        side: THREE.DoubleSide,
      });
    } else if (isShadow) {
      material = new THREE.MeshPhysicalMaterial({
        color: "#2a1820",
        roughness: 0.55,
        metalness: 0,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      });
    } else if (isEyePart) {
      material = new THREE.MeshPhysicalMaterial({
        color: params.irisColor,
        roughness: 0.2,
        metalness: 0.05,
        clearcoat: 0.4,
        side: THREE.DoubleSide,
      });
    } else {
      // Skin — soft feminine gloss
      const c = new THREE.Color(skin);
      c.offsetHSL(0.01, 0.04, -freckle);
      material = new THREE.MeshPhysicalMaterial({
        color: c,
        roughness: Math.min(0.72, Math.max(0.28, 0.78 - gloss)),
        metalness: 0.0,
        clearcoat: 0.06 + params.gloss * 0.14,
        clearcoatRoughness: 0.45,
        sheen: 0.35,
        sheenRoughness: 0.55,
        sheenColor: new THREE.Color("#e8b4a8"),
        envMapIntensity: 0.45,
        side: THREE.DoubleSide,
      });
    }

    mesh.material = material;

    // Slightly larger eyes for feminine defaults
    if (n.includes("eye") && !isShadow) {
      const eyeS = 0.96 + params.eyeSize * 0.12;
      mesh.scale.setScalar(eyeS);
    }
  });
}

function tintBody(root: THREE.Object3D, params: TwinParams) {
  const skin = skinColorFromParams(params.skinTone, params.undertone);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (
        !(mat instanceof THREE.MeshStandardMaterial) &&
        !(mat instanceof THREE.MeshPhysicalMaterial)
      )
        continue;
      const name = `${mat.name || ""} ${mesh.name || ""}`.toLowerCase();
      if (name.includes("shirt") || name.includes("cloth")) {
        // Fitted dark top — feminine casual
        mat.color.set("#121018");
        mat.roughness = 0.62;
        mat.metalness = 0.04;
        if ("sheen" in mat) {
          (mat as THREE.MeshPhysicalMaterial).sheen = 0.25;
          (mat as THREE.MeshPhysicalMaterial).sheenColor = new THREE.Color("#3a3048");
        }
      } else if (name.includes("pant")) {
        // Slim dark jeans
        mat.color.set("#1c2736");
        mat.roughness = 0.78;
        mat.metalness = 0.02;
      } else if (name.includes("shoe")) {
        mat.color.set("#0a0a0c");
        mat.roughness = 0.55;
      } else if (!mat.map) {
        mat.color.set(skin);
        mat.roughness = Math.min(0.85, Math.max(0.35, 0.75 - params.gloss * 0.3));
      }
      mat.needsUpdate = true;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

function safeClone(scene: THREE.Object3D) {
  try {
    return SkeletonUtils.clone(scene);
  } catch {
    return scene.clone(true);
  }
}

/** Resolve Mixamo bone whether named with or without colon. */
function findBone(root: THREE.Object3D, base: string): THREE.Object3D | null {
  return (
    root.getObjectByName(`mixamorig:${base}`) ||
    root.getObjectByName(`mixamorig${base}`) ||
    root.getObjectByName(base) ||
    null
  );
}

function findHeadBone(root: THREE.Object3D): THREE.Object3D | null {
  return findBone(root, "Head");
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

/**
 * Feminine silhouette via Mixamo bone scales.
 * Strong feminine bias + twin params (chest/waist/hips/shoulders/arms).
 */
function applyFeminineSilhouette(root: THREE.Object3D, p: TwinParams) {
  // Narrower shoulders
  const sh = 0.78 + p.shoulders * 0.22;
  setBoneScale(root, "LeftShoulder", sh, 1, sh * 0.98);
  setBoneScale(root, "RightShoulder", sh, 1, sh * 0.98);

  // Fuller chest / breast area (Spine2)
  const chest = 1.0 + p.chest * 0.28;
  setBoneScale(root, "Spine2", chest, 1.0 + p.chest * 0.06, 0.98 + p.chest * 0.18);

  // Cinched waist (Spine + Spine1)
  const waist = 0.76 + p.waist * 0.22;
  setBoneScale(root, "Spine", waist, 1, waist * 0.96);
  setBoneScale(root, "Spine1", waist * 1.02, 1, waist);

  // Wider hips
  const hips = 1.04 + p.hips * 0.26;
  setBoneScale(root, "Hips", hips, 1, 0.98 + p.hips * 0.12);
  const thigh = 1.02 + p.hips * 0.14;
  setBoneScale(root, "LeftUpLeg", thigh, 1, 0.98 + p.hips * 0.08);
  setBoneScale(root, "RightUpLeg", thigh, 1, 0.98 + p.hips * 0.08);

  // Softer, slimmer arms
  const arms = 0.82 + p.arms * 0.2;
  setBoneScale(root, "LeftArm", arms, 1, arms);
  setBoneScale(root, "RightArm", arms, 1, arms);
  setBoneScale(root, "LeftForeArm", arms * 0.98, 1, arms * 0.98);
  setBoneScale(root, "RightForeArm", arms * 0.98, 1, arms * 0.98);

  // Slightly longer / modelesque legs
  const legs = 0.98 + p.legs * 0.08;
  setBoneScale(root, "LeftLeg", 1, legs, 1);
  setBoneScale(root, "RightLeg", 1, legs, 1);

  // Soften upper torso width a touch when muscle is low
  const soft = 1 - p.muscle * 0.08;
  setBoneScale(root, "Neck", soft, 1, soft);
}

/** Place head so its bounding-box center sits just above the neck bone. */
function seatHeadOnBone(bone: THREE.Object3D, head: THREE.Object3D) {
  if (head.parent) head.parent.remove(head);

  head.position.set(0, 0, 0);
  head.rotation.set(0, 0, 0);
  head.scale.set(1, 1, 1);
  bone.add(head);

  bone.updateWorldMatrix(true, true);
  head.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(head);
  if (box.isEmpty()) {
    console.warn("[Muse] empty head bbox");
    head.position.set(0, 0.15, 0.05);
    return;
  }
  const centerWorld = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(centerWorld);
  box.getSize(size);

  const boneWorld = new THREE.Vector3();
  bone.getWorldPosition(boneWorld);
  const boneQuat = new THREE.Quaternion();
  bone.getWorldQuaternion(boneQuat);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(boneQuat);
  const desired = boneWorld.clone().addScaledVector(up, size.y * 0.42);

  const inv = new THREE.Matrix4().copy(bone.matrixWorld).invert();
  const localCenter = centerWorld.clone().applyMatrix4(inv);
  const localDesired = desired.clone().applyMatrix4(inv);
  head.position.add(localDesired.sub(localCenter));

  head.userData.baseScale = [1, 1, 1];
  console.info("[Muse] seated head", {
    size: size.toArray(),
    headLocalPos: head.position.toArray(),
  });
}

function TwinRig() {
  const wrap = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const [hairHost, setHairHost] = useState<THREE.Object3D | null>(null);
  const params = useTwinStore((s) => s.params);

  const bodyGltf = useGLTF("/models/vitruvian_body.glb");
  const headGltf = useGLTF("/models/vitruvian_head.glb");

  const body = useMemo(() => safeClone(bodyGltf.scene), [bodyGltf.scene]);
  const head = useMemo(() => headGltf.scene.clone(true), [headGltf.scene]);

  const { actions, names } = useAnimations(bodyGltf.animations, bodyRef);

  useLayoutEffect(() => {
    const bone = findHeadBone(body);
    if (!bone) {
      console.error("[Muse] no head bone");
      setHairHost(null);
      return;
    }

    seatHeadOnBone(bone, head);
    const p0 = useTwinStore.getState().params;
    paintHead(head, p0);
    tintBody(body, p0);
    applyMorphs(head, p0);
    applyFeminineSilhouette(body, p0);

    // Hair parents under seated head (follows Head bone; avoids React primitive reparent)
    setHairHost(head);

    const old = bone.getObjectByName("MuseHeadMarker");
    if (old) bone.remove(old);

    return () => {
      setHairHost(null);
      bone.remove(head);
    };
  }, [body, head]);

  useEffect(() => {
    try {
      const preferred =
        params.posePreset === "Wave"
          ? names.find((n) => /wave/i.test(n))
          : params.posePreset === "Confident"
            ? names.find((n) => /happy|sway|idle/i.test(n))
            : names.find((n) => /^idle$/i.test(n)) ||
              names.find((n) => /idle/i.test(n));
      Object.values(actions).forEach((a) => a?.fadeOut(0.25));
      if (preferred && actions[preferred]) {
        actions[preferred].reset().fadeIn(0.3).play();
        actions[preferred].setLoop(THREE.LoopRepeat, Infinity);
      }
    } catch {
      /* optional */
    }
  }, [actions, names, params.posePreset]);

  useEffect(() => {
    paintHead(head, params);
    tintBody(body, params);
    applyMorphs(head, params);
    applyFeminineSilhouette(body, params);

    const base = (head.userData.baseScale as number[] | undefined) || [1, 1, 1];
    // Soften face scale defaults — slightly narrower + higher cheek presence
    const fw =
      0.9 + params.faceWidth * 0.1 + (params.cheekbones - 0.5) * 0.06;
    const fh =
      0.94 +
      (params.chin - 0.5) * 0.05 +
      (params.jaw - 0.5) * 0.035 -
      (params.cheekbones - 0.5) * 0.02;
    const fd =
      0.96 +
      (params.noseLength - 0.5) * 0.045 +
      (params.cheekbones - 0.5) * 0.03;
    head.scale.set(base[0] * fw, base[1] * fh, base[2] * fd);
  }, [
    body,
    head,
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
  ]);

  useFrame(() => {
    if (!wrap.current) return;
    const p = useTwinStore.getState().params;
    // Slightly modelesque overall scale
    wrap.current.scale.setScalar(0.93 + p.height * 0.12);
  });

  return (
    <group ref={wrap} dispose={null}>
      <group ref={bodyRef}>
        <primitive object={body} />
      </group>
      {hairHost &&
        createPortal(
          <ProceduralHair
            style={params.hairStyle}
            length={params.hairLength}
            color={params.hairColor}
            volume={params.hairVolume}
          />,
          hairHost
        )}
    </group>
  );
}

export function TwinAvatar() {
  const rotateY = useTwinStore((s) => s.params.rotateY);
  return (
    <group rotation={[0, rotateY, 0]}>
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
