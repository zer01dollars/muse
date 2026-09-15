"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
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

function tintMaterials(root: THREE.Object3D, params: TwinParams) {
  const skinHex = skinColorFromParams(params.skinTone, params.undertone);
  const skinColor = new THREE.Color(skinHex);
  const gloss = 0.25 + params.gloss * 0.45;
  const freckleDarken = params.freckles * 0.08;

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (
        !(mat instanceof THREE.MeshStandardMaterial) &&
        !(mat instanceof THREE.MeshPhysicalMaterial)
      ) {
        continue;
      }
      const name = `${mat.name || ""} ${mesh.name || ""}`.toLowerCase();
      const isCloth =
        name.includes("cloth") ||
        name.includes("fabric") ||
        name.includes("plane") ||
        name.includes("shirt");
      const isEye =
        name.includes("eye") ||
        name.includes("iris") ||
        name.includes("sclera") ||
        name.includes("cornea");
      const isHair = name.includes("hair");
      const isMouth =
        name.includes("mouth") ||
        name.includes("tooth") ||
        name.includes("gum");

      try {
        if (isCloth) {
          mat.color.set("#1a1528");
          mat.roughness = 0.75;
          mat.metalness = 0.05;
        } else if (isEye) {
          if (!name.includes("shadow") && !name.includes("lash")) {
            mat.color.set(params.irisColor);
          }
          mat.roughness = 0.18;
        } else if (isHair) {
          mat.color.set(params.hairColor);
        } else if (!isMouth) {
          const c = skinColor.clone();
          c.offsetHSL(0, 0, -freckleDarken);
          mat.color.copy(c);
          mat.roughness = Math.min(0.95, Math.max(0.25, 1 - gloss));
          mat.metalness = 0.02;
        }
        mat.needsUpdate = true;
      } catch {
        /* ignore */
      }
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

function setBoneScale(
  root: THREE.Object3D,
  name: string,
  sx: number,
  sy: number,
  sz: number
) {
  const bone = root.getObjectByName(name);
  // Clamp hard — extreme scales explode Mixamo skinning into blobs
  if (bone) {
    bone.scale.set(
      THREE.MathUtils.clamp(sx, 0.75, 1.35),
      THREE.MathUtils.clamp(sy, 0.75, 1.35),
      THREE.MathUtils.clamp(sz, 0.75, 1.35)
    );
  }
}

function setBoneRot(
  root: THREE.Object3D,
  name: string,
  x: number,
  y: number,
  z: number
) {
  const bone = root.getObjectByName(name);
  if (bone) {
    bone.rotation.x = x;
    bone.rotation.y = y;
    bone.rotation.z = z;
  }
}

function applyMorphs(root: THREE.Object3D, params: TwinParams) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences)
      return;
    const dict = mesh.morphTargetDictionary;
    const influences = mesh.morphTargetInfluences;
    for (const [key, fn] of Object.entries(MORPH_MAP)) {
      const idx = dict[key];
      if (idx !== undefined) {
        influences[idx] = THREE.MathUtils.clamp(fn(params), 0, 1);
      }
    }
  });
}

function safeClone(scene: THREE.Object3D) {
  try {
    return SkeletonUtils.clone(scene);
  } catch {
    return scene.clone(true);
  }
}

function BodyModel() {
  const group = useRef<THREE.Group>(null);
  const hairAnchor = useRef<THREE.Group>(null);
  const params = useTwinStore((s) => s.params);
  const { scene, animations } = useGLTF("/models/vitruvian_body.glb");
  const cloned = useMemo(() => safeClone(scene), [scene]);
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    try {
      const preferred =
        params.posePreset === "Wave"
          ? names.find((n) => /wave/i.test(n))
          : params.posePreset === "Confident"
            ? names.find((n) => /happy|sway/i.test(n))
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

  useFrame(() => {
    if (!group.current) return;
    const p = useTwinStore.getState().params;
    const root = group.current;

    // Overall height only — avoid cascading bone scale explosions
    const h = 0.92 + p.height * 0.16;
    root.scale.setScalar(h);

    // Gentle regional tweaks (clamped in setBoneScale)
    const sh = 0.92 + p.shoulders * 0.16;
    setBoneScale(root, "mixamorig:LeftShoulder", sh, 1, sh);
    setBoneScale(root, "mixamorig:RightShoulder", sh, 1, sh);

    const chest = 0.94 + p.chest * 0.12 + p.muscle * 0.06;
    setBoneScale(root, "mixamorig:Spine2", chest, 1, 0.96 + p.chest * 0.08);

    const waist = 0.92 + p.waist * 0.14;
    setBoneScale(root, "mixamorig:Spine", waist, 1, waist);

    // Face width via head bone (subtle)
    const fw = 0.94 + p.faceWidth * 0.12;
    const fh = 0.96 + (p.chin - 0.5) * 0.06 + (p.jaw - 0.5) * 0.04;
    setBoneScale(root, "mixamorig:Head", fw, fh, 0.98 + (p.noseLength - 0.5) * 0.04);

    const lean = p.torsoLean * 0.25;
    setBoneRot(root, "mixamorig:Spine1", lean, 0, 0);

    if (p.posePreset !== "Wave") {
      setBoneRot(
        root,
        "mixamorig:LeftArm",
        0.1 + p.armL * 0.6,
        0,
        0.15 + p.armL * 0.35
      );
      setBoneRot(
        root,
        "mixamorig:RightArm",
        0.1 + p.armR * 0.6,
        0,
        -0.15 - p.armR * 0.35
      );
    }

    applyMorphs(root, p);
    tintMaterials(root, p);

    const headBone = root.getObjectByName("mixamorig:Head");
    if (headBone && hairAnchor.current) {
      headBone.getWorldPosition(hairAnchor.current.position);
      headBone.getWorldQuaternion(hairAnchor.current.quaternion);
      const parentScale = new THREE.Vector3();
      root.getWorldScale(parentScale);
      const inv = 1 / Math.max(parentScale.x, 1e-4);
      hairAnchor.current.scale.set(inv, inv, inv);
    }
  });

  const hairStyle = useTwinStore((s) => s.params.hairStyle);
  const hairLength = useTwinStore((s) => s.params.hairLength);
  const hairColor = useTwinStore((s) => s.params.hairColor);
  const hairVolume = useTwinStore((s) => s.params.hairVolume);

  return (
    <>
      <group ref={group} dispose={null}>
        <primitive object={cloned} />
      </group>
      <group ref={hairAnchor}>
        <ProceduralHair
          style={hairStyle}
          length={hairLength}
          color={hairColor}
          volume={hairVolume}
        />
      </group>
    </>
  );
}

export function TwinAvatar() {
  const rotateY = useTwinStore((s) => s.params.rotateY);
  return (
    <group rotation={[0, rotateY, 0]} position={[0, 0, 0]}>
      <BodyModel />
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
