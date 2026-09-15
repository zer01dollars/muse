"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations, Html } from "@react-three/drei";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import {
  skinColorFromParams,
  useTwinStore,
  type TwinParams,
} from "@/store/twinStore";
import { ProceduralHair } from "./ProceduralHair";
import { loadSkinTextures } from "./skinTextures";

useGLTF.preload("/models/vitruvian_body.glb");
useGLTF.preload("/models/vitruvian_head.glb");

const LIP_COLOR = "#c45a6a";
const IRIS_GLOSS = 0.12;

const MORPH_MAP: Record<string, (p: TwinParams) => number> = {
  Jaw_Lower: (p) => Math.max(0, (p.jaw - 0.55) * 0.35),
  Lips_Up_Funnel: (p) => Math.max(0, (p.lipFullness - 0.3) * 0.65),
  Smile_Lips_Closed: (p) => 0.08 + Math.max(0, (p.lipFullness - 0.35) * 0.4),
  Kiss: (p) => Math.max(0, (p.lipFullness - 0.5) * 0.5),
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


/** Soft skin tint multiply — keeps albedo detail, shifts tone/undertone. */
function skinTintColor(params: TwinParams): THREE.Color {
  const skin = skinColorFromParams(params.skinTone, params.undertone);
  const c = new THREE.Color(skin);
  // Pull toward mid-gray so map detail remains; freckles slightly darken
  c.lerp(new THREE.Color("#e8c4b0"), 0.35);
  c.offsetHSL(0.005, 0.02, -params.freckles * 0.06);
  return c;
}

function makeSkinPhysical(
  map: THREE.Texture | null,
  tint: THREE.Color,
  params: TwinParams
): THREE.MeshPhysicalMaterial {
  const gloss = 0.28 + params.gloss * 0.5;
  return new THREE.MeshPhysicalMaterial({
    map: map ?? undefined,
    color: map ? tint : new THREE.Color(skinColorFromParams(params.skinTone, params.undertone)),
    roughness: Math.min(0.68, Math.max(0.32, 0.72 - gloss * 0.55)),
    metalness: 0.0,
    clearcoat: 0.08 + params.gloss * 0.18,
    clearcoatRoughness: 0.42,
    sheen: 0.42,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color("#f0c4b4"),
    envMapIntensity: 0.55,
    side: THREE.DoubleSide,
  });
}

/**
 * Photoreal head: keep high-res face albedo on skin; only override lips / eyes.
 * Previously wiped maps with flat MeshPhysical colors — that killed photorealism.
 */
function paintHead(
  root: THREE.Object3D,
  params: TwinParams,
  faceMap: THREE.Texture | null
) {
  const tint = skinTintColor(params);

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
        clearcoat: 0.85,
        clearcoatRoughness: 0.08,
        sheen: 0.45,
        sheenColor: new THREE.Color(params.irisColor).offsetHSL(0, 0.1, 0.2),
        envMapIntensity: 1.0,
        side: THREE.DoubleSide,
      });
    } else if (isSclera) {
      material = new THREE.MeshPhysicalMaterial({
        color: "#f6f1ea",
        roughness: 0.32,
        metalness: 0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.28,
        side: THREE.DoubleSide,
      });
    } else if (isCornea) {
      // Subtle cornea sheen (transmission-ish without breaking export)
      material = new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        roughness: 0.05,
        metalness: 0,
        transmission: 0.35,
        thickness: 0.35,
        ior: 1.4,
        transparent: true,
        opacity: 0.28,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 1.2,
        side: THREE.DoubleSide,
      });
    } else if (isMouth) {
      const isTooth = n.includes("tooth") || n.includes("teeth");
      const isGum = n.includes("gum");
      material = new THREE.MeshPhysicalMaterial({
        color: isTooth ? "#f2eee6" : isGum ? "#c4787a" : LIP_COLOR,
        roughness: isTooth ? 0.22 : 0.26,
        metalness: 0.02,
        clearcoat: isTooth ? 0.55 : 0.55,
        clearcoatRoughness: isTooth ? 0.15 : 0.18,
        sheen: isTooth ? 0.15 : 0.7,
        sheenColor: new THREE.Color(isTooth ? "#ffffff" : "#e8909a"),
        envMapIntensity: 0.65,
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
        roughness: 0.18,
        metalness: 0.05,
        clearcoat: 0.5,
        side: THREE.DoubleSide,
      });
    } else {
      // Skin — photoreal albedo + physical skin response
      material = makeSkinPhysical(faceMap, tint, params);
    }

    mesh.material = material;

    if (n.includes("eye") && !isShadow) {
      const eyeS = 0.96 + params.eyeSize * 0.12;
      mesh.scale.setScalar(eyeS);
    }
  });
}

function tintBody(
  root: THREE.Object3D,
  params: TwinParams,
  bodyMap: THREE.Texture | null
) {
  const tint = skinTintColor(params);
  const skinHex = skinColorFromParams(params.skinTone, params.undertone);

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
        mat.color.set("#121018");
        mat.roughness = 0.58;
        mat.metalness = 0.05;
        if (mat instanceof THREE.MeshPhysicalMaterial) {
          mat.sheen = 0.3;
          mat.sheenColor = new THREE.Color("#3a3048");
        }
      } else if (name.includes("pant")) {
        mat.color.set("#1c2736");
        mat.roughness = 0.76;
        mat.metalness = 0.02;
      } else if (name.includes("shoe")) {
        mat.color.set("#0a0a0c");
        mat.roughness = 0.5;
      } else {
        // Skin / body — apply high-res albedo, tint via color multiply
        if (bodyMap) {
          mat.map = bodyMap;
        }
        mat.color.copy(bodyMap ? tint : new THREE.Color(skinHex));
        mat.roughness = Math.min(0.78, Math.max(0.38, 0.7 - params.gloss * 0.28));
        mat.metalness = 0;
        if (mat instanceof THREE.MeshPhysicalMaterial) {
          mat.clearcoat = 0.06 + params.gloss * 0.12;
          mat.clearcoatRoughness = 0.48;
          mat.sheen = 0.32;
          mat.sheenRoughness = 0.55;
          mat.sheenColor = new THREE.Color("#e8b4a8");
          mat.envMapIntensity = 0.5;
        }
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

let loggedMixamoBones = false;

function logMixamoBonesOnce(root: THREE.Object3D) {
  if (loggedMixamoBones) return;
  loggedMixamoBones = true;
  const names: string[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone || o.type === "Bone" || /^mixamorig/i.test(o.name)) {
      names.push(o.name);
    }
  });
  console.info("[Muse] Mixamo bones", names);
}

function applyFeminineSilhouette(root: THREE.Object3D, p: TwinParams) {
  logMixamoBonesOnce(root);

  const sh = 0.7 + p.shoulders * 0.2;
  setBoneScale(root, "LeftShoulder", sh, 1, sh * 0.95);
  setBoneScale(root, "RightShoulder", sh, 1, sh * 0.95);

  const chest = 1.0 + p.chest * 0.2;
  setBoneScale(root, "Spine2", chest * 0.98, 1.0, 0.95 + p.chest * 0.18);

  const waist = 0.84 + p.waist * 0.16;
  setBoneScale(root, "Spine1", waist, 1, waist * 0.98);

  const hips = 1.1 + p.hips * 0.28;
  setBoneScale(root, "Hips", hips, 1, 0.96 + p.hips * 0.1);
  const thigh = 1.08 + p.hips * 0.16;
  setBoneScale(root, "LeftUpLeg", thigh, 1, 0.98 + p.hips * 0.1);
  setBoneScale(root, "RightUpLeg", thigh, 1, 0.98 + p.hips * 0.1);

  const arms = 0.76 + p.arms * 0.18;
  setBoneScale(root, "LeftArm", arms, 1, arms);
  setBoneScale(root, "RightArm", arms, 1, arms);
  setBoneScale(root, "LeftForeArm", arms * 0.96, 1, arms * 0.96);
  setBoneScale(root, "RightForeArm", arms * 0.96, 1, arms * 0.96);

  const legs = 0.98 + p.legs * 0.08;
  setBoneScale(root, "LeftLeg", 1, legs, 1);
  setBoneScale(root, "RightLeg", 1, legs, 1);

  applyFeminineClothingScale(root, p);
}

function applyFeminineClothingScale(root: THREE.Object3D, p: TwinParams) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const n = mesh.name.toLowerCase();
    if (n === "shirt") {
      mesh.scale.set(
        0.86 + p.waist * 0.1 + p.shoulders * 0.04,
        1.0,
        0.9 + p.chest * 0.1
      );
    } else if (n === "pants") {
      mesh.scale.set(1.04 + p.hips * 0.14, 1.0, 1.02 + p.hips * 0.08);
    }
  });
}

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

function getScalpLocalOffset(head: THREE.Object3D): THREE.Vector3 {
  head.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(head);
  if (box.isEmpty()) return new THREE.Vector3(0, 0.2, 0);

  const size = new THREE.Vector3();
  box.getSize(size);
  const topWorld = new THREE.Vector3(
    (box.min.x + box.max.x) * 0.5,
    box.max.y - size.y * 0.04,
    (box.min.z + box.max.z) * 0.5
  );
  const inv = new THREE.Matrix4().copy(head.matrixWorld).invert();
  return topWorld.applyMatrix4(inv);
}

function ensureHairAnchor(head: THREE.Object3D): THREE.Object3D {
  const existing = head.getObjectByName("MuseHairAnchor");
  if (existing) head.remove(existing);

  const anchor = new THREE.Group();
  anchor.name = "MuseHairAnchor";
  const scalp = getScalpLocalOffset(head);
  anchor.position.copy(scalp);
  head.add(anchor);
  console.info("[Muse] hair anchor at scalp", scalp.toArray());
  return anchor;
}

function TwinRig() {
  const wrap = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const [hairHost, setHairHost] = useState<THREE.Object3D | null>(null);
  const [maps, setMaps] = useState<{
    face: THREE.Texture | null;
    body: THREE.Texture | null;
  }>({ face: null, body: null });
  const params = useTwinStore((s) => s.params);
  const gl = useThree((s) => s.gl);

  const bodyGltf = useGLTF("/models/vitruvian_body.glb");
  const headGltf = useGLTF("/models/vitruvian_head.glb");

  const body = useMemo(() => safeClone(bodyGltf.scene), [bodyGltf.scene]);
  const head = useMemo(() => headGltf.scene.clone(true), [headGltf.scene]);

  const { actions, names } = useAnimations(bodyGltf.animations, bodyRef);

  // Load photoreal albedo maps once; share across skinned clones
  useEffect(() => {
    let alive = true;
    const aniso = Math.min(16, gl.capabilities.getMaxAnisotropy());
    loadSkinTextures(aniso).then(([face, bodyTex]) => {
      if (!alive) return;
      setMaps({ face, body: bodyTex });
    });
    return () => {
      alive = false;
    };
  }, [gl]);

  useLayoutEffect(() => {
    const bone = findHeadBone(body);
    if (!bone) {
      console.error("[Muse] no head bone");
      setHairHost(null);
      return;
    }

    seatHeadOnBone(bone, head);
    const p0 = useTwinStore.getState().params;
    paintHead(head, p0, maps.face);
    tintBody(body, p0, maps.body);
    applyMorphs(head, p0);
    applyFeminineSilhouette(body, p0);

    const anchor = ensureHairAnchor(head);
    setHairHost(anchor);

    const old = bone.getObjectByName("MuseHeadMarker");
    if (old) bone.remove(old);

    return () => {
      setHairHost(null);
      const a = head.getObjectByName("MuseHairAnchor");
      if (a) head.remove(a);
      bone.remove(head);
    };
  }, [body, head]);

  // Re-paint when textures arrive (first load) without reseating head
  useEffect(() => {
    if (!maps.face && !maps.body) return;
    paintHead(head, useTwinStore.getState().params, maps.face);
    tintBody(body, useTwinStore.getState().params, maps.body);
  }, [maps.face, maps.body, head, body]);

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
    paintHead(head, params, maps.face);
    tintBody(body, params, maps.body);
    applyMorphs(head, params);
    applyFeminineSilhouette(body, params);

    const base = (head.userData.baseScale as number[] | undefined) || [1, 1, 1];
    const fw =
      0.88 + params.faceWidth * 0.1 + (params.cheekbones - 0.5) * 0.05;
    const fh =
      0.93 +
      (params.chin - 0.5) * 0.045 +
      (params.jaw - 0.5) * 0.03 -
      (params.cheekbones - 0.5) * 0.025;
    const fd =
      0.95 +
      (params.noseLength - 0.5) * 0.04 +
      (params.cheekbones - 0.5) * 0.03;
    head.scale.set(base[0] * fw, base[1] * fh, base[2] * fd);
  }, [
    body,
    head,
    maps.face,
    maps.body,
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
