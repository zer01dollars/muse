"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, Html } from "@react-three/drei";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import {
  skinColorFromParams,
  useTwinStore,
  type TwinParams,
} from "@/store/twinStore";

useGLTF.preload("/models/vitruvian_body.glb");
useGLTF.preload("/models/vitruvian_head.glb");

const MORPH_MAP: Record<string, (p: TwinParams) => number> = {
  Jaw_Lower: (p) => Math.max(0, (p.jaw - 0.5) * 0.35),
  Lips_Up_Funnel: (p) => Math.max(0, (p.lipFullness - 0.5) * 0.4),
  Smile_Lips_Closed: (p) => Math.max(0, (p.lipFullness - 0.45) * 0.25),
  Eyebrows_Raised_Left: (p) => Math.max(0, (p.brow - 0.5) * 0.6),
  Eyebrows_Raised_Right: (p) => Math.max(0, (p.brow - 0.5) * 0.6),
  Eyebrows_Frown_Left: (p) => Math.max(0, (0.5 - p.brow) * 0.45),
  Eyebrows_Frown_Right: (p) => Math.max(0, (0.5 - p.brow) * 0.45),
  Eyes_Closed_Max: (p) => Math.max(0, 1 - p.eyeOpenness) * 0.95,
  Eyes_Opened_Max_Left: (p) => Math.max(0, (p.eyeOpenness - 0.7) * 0.8),
  Eyes_Opened_Max_Right: (p) => Math.max(0, (p.eyeOpenness - 0.7) * 0.8),
  Eyes_Squint: (p) => Math.max(0, (0.55 - p.eyeSize) * 0.5),
  Happy: () => 0.04,
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

/** Make every head mesh unmistakably visible */
function paintHead(root: THREE.Object3D, params: TwinParams) {
  const skin = skinColorFromParams(params.skinTone, params.undertone);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.visible = true;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const n = `${mesh.name}`.toLowerCase();
    let color = skin;
    if (n.includes("eye") || n.includes("iris") || n.includes("sclera")) {
      color = params.irisColor;
    } else if (n.includes("mouth") || n.includes("tooth") || n.includes("gum")) {
      color = "#c97878";
    }

    // BasicMaterial can't disappear due to lights/maps
    mesh.material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0.0,
      side: THREE.DoubleSide,
      envMapIntensity: 0.4,
    });
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
      if (name.includes("shirt") || name.includes("cloth")) mat.color.set("#1a1528");
      else if (name.includes("pant")) mat.color.set("#8a7a5c");
      else if (name.includes("shoe")) mat.color.set("#111111");
      else if (!mat.map) mat.color.set(skin);
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

function findHeadBone(root: THREE.Object3D): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (found) return;
    if (
      o.name === "mixamorig:Head" ||
      o.name === "mixamorigHead" ||
      o.name === "Head"
    ) {
      found = o;
    }
  });
  return found;
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
      return;
    }

    seatHeadOnBone(bone, head);
    paintHead(head, useTwinStore.getState().params);
    tintBody(body, useTwinStore.getState().params);
    applyMorphs(head, useTwinStore.getState().params);

    // Remove old debug markers if any
    const old = bone.getObjectByName("MuseHeadMarker");
    if (old) bone.remove(old);

    return () => {
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
    const base = (head.userData.baseScale as number[] | undefined) || [1, 1, 1];
    const fw = 0.96 + params.faceWidth * 0.1;
    const fh = 0.97 + (params.chin - 0.5) * 0.06 + (params.jaw - 0.5) * 0.04;
    const fd = 0.98 + (params.noseLength - 0.5) * 0.05;
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
  ]);

  useFrame(() => {
    if (!wrap.current) return;
    const p = useTwinStore.getState().params;
    wrap.current.scale.setScalar(0.95 + p.height * 0.12);
  });

  return (
    <group ref={wrap} dispose={null}>
      <group ref={bodyRef}>
        <primitive object={body} />
      </group>
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
