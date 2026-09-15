"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import {
  skinColorFromParams,
  useTwinStore,
  type TwinParams,
} from "@/store/twinStore";
import { ProceduralHair } from "./ProceduralHair";

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

function applySkinMaterial(root: THREE.Object3D, params: TwinParams) {
  const skin = skinColorFromParams(params.skinTone, params.undertone);
  const skinColor = new THREE.Color(skin);
  const gloss = 0.25 + params.gloss * 0.45;
  const freckleDarken = params.freckles * 0.08;

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((mat) => {
      if (
        !(mat instanceof THREE.MeshStandardMaterial) &&
        !(mat instanceof THREE.MeshPhysicalMaterial)
      ) {
        return;
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
        name.includes("cornea") ||
        name.includes("eyeshadow");
      const isHair = name.includes("hair");
      const isMouth =
        name.includes("mouth") ||
        name.includes("tooth") ||
        name.includes("gum") ||
        name.includes("caruncle") ||
        name.includes("tear");

      if (isCloth) {
        mat.color.set("#1a1528");
        mat.roughness = 0.75;
        mat.metalness = 0.05;
        return;
      }
      if (isEye) {
        if (!name.includes("shadow") && !name.includes("lash")) {
          mat.color.set(params.irisColor);
        }
        mat.roughness = 0.18;
        if (mat instanceof THREE.MeshPhysicalMaterial) {
          mat.clearcoat = 0.9;
          mat.clearcoatRoughness = 0.12;
        }
        return;
      }
      if (isHair) {
        mat.color.set(params.hairColor);
        return;
      }
      if (isMouth) return;

      const c = skinColor.clone();
      c.offsetHSL(0, 0, -freckleDarken);
      mat.color.copy(c);
      mat.roughness = Math.min(0.95, Math.max(0.2, 1 - gloss));
      mat.metalness = 0.02;
      if (mat instanceof THREE.MeshPhysicalMaterial) {
        mat.sheen = 0.55 + params.gloss * 0.3;
        mat.sheenRoughness = 0.55;
        mat.sheenColor = c.clone().offsetHSL(0.02, 0.1, 0.08);
        mat.clearcoat = 0.08 + params.gloss * 0.12;
        mat.clearcoatRoughness = 0.45;
        mat.thickness = 0.4;
        mat.attenuationColor = c.clone().offsetHSL(0.02, 0.15, 0.05);
        mat.attenuationDistance = 0.45;
      }
      mat.needsUpdate = true;
    });
  });
}

function upgradeMaterials(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const upgrade = (mat: THREE.Material) => {
      if (
        mat instanceof THREE.MeshStandardMaterial &&
        !(mat instanceof THREE.MeshPhysicalMaterial)
      ) {
        const phys = new THREE.MeshPhysicalMaterial();
        phys.copy(mat);
        phys.map = mat.map;
        phys.normalMap = mat.normalMap;
        phys.roughnessMap = mat.roughnessMap;
        phys.metalnessMap = mat.metalnessMap;
        phys.aoMap = mat.aoMap;
        phys.envMapIntensity = 0.85;
        return phys;
      }
      return mat;
    };
    m.material = Array.isArray(m.material)
      ? m.material.map(upgrade)
      : upgrade(m.material);
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
  if (bone) bone.scale.set(sx, sy, sz);
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
    Object.entries(MORPH_MAP).forEach(([key, fn]) => {
      const idx = dict[key];
      if (idx !== undefined) {
        influences[idx] = THREE.MathUtils.clamp(fn(params), 0, 1);
      }
    });
  });
}

/** Deep clone preserving skeletons */
function skeletonClone(source: THREE.Object3D) {
  const clone = source.clone(true);
  const sourceMeshes: THREE.SkinnedMesh[] = [];
  const destMeshes: THREE.SkinnedMesh[] = [];
  source.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh)
      sourceMeshes.push(o as THREE.SkinnedMesh);
  });
  clone.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh)
      destMeshes.push(o as THREE.SkinnedMesh);
  });
  for (let i = 0; i < sourceMeshes.length; i++) {
    const src = sourceMeshes[i]!;
    const dst = destMeshes[i]!;
    if (!src.skeleton) continue;
    const bones: THREE.Bone[] = [];
    src.skeleton.bones.forEach((b) => {
      const found = clone.getObjectByName(b.name);
      if (found) bones.push(found as THREE.Bone);
    });
    dst.bind(
      new THREE.Skeleton(
        bones,
        src.skeleton.boneInverses.map((m) => m.clone())
      ),
      dst.bindMatrix
    );
    if (src.morphTargetInfluences) {
      dst.morphTargetInfluences = [...src.morphTargetInfluences];
    }
    if (src.morphTargetDictionary) {
      dst.morphTargetDictionary = { ...src.morphTargetDictionary };
    }
  }
  return clone;
}

function BodyModel({ headAnchor }: { headAnchor: React.RefObject<THREE.Group | null> }) {
  const group = useRef<THREE.Group>(null);
  const params = useTwinStore((s) => s.params);
  const { scene, animations } = useGLTF("/models/vitruvian_body.glb");
  const cloned = useMemo(() => {
    const c = skeletonClone(scene);
    upgradeMaterials(c);
    return c;
  }, [scene]);

  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    const preferred =
      params.posePreset === "Wave"
        ? names.find((n) => /wave/i.test(n))
        : params.posePreset === "Confident"
          ? names.find((n) => /happy|sway/i.test(n))
          : names.find((n) => /^idle$/i.test(n)) ||
            names.find((n) => /idle/i.test(n));
    Object.values(actions).forEach((a) => a?.fadeOut(0.35));
    if (preferred && actions[preferred]) {
      actions[preferred].reset().fadeIn(0.4).play();
      actions[preferred].setLoop(THREE.LoopRepeat, Infinity);
    }
  }, [actions, names, params.posePreset]);

  useFrame(() => {
    if (!group.current) return;
    const p = useTwinStore.getState().params;
    const root = group.current;

    const h = 0.88 + p.height * 0.28;
    root.scale.setScalar(h);

    const sh = 0.85 + p.shoulders * 0.4;
    setBoneScale(root, "mixamorig:LeftShoulder", sh, 1, sh);
    setBoneScale(root, "mixamorig:RightShoulder", sh, 1, sh);

    const chest = 0.9 + p.chest * 0.3 + p.muscle * 0.12;
    setBoneScale(root, "mixamorig:Spine2", chest, 1, 0.92 + p.chest * 0.2);
    setBoneScale(root, "mixamorig:Spine1", 0.95 + p.chest * 0.15, 1, 0.95);

    const waist = 0.85 + p.waist * 0.35;
    setBoneScale(root, "mixamorig:Spine", waist, 1, waist * 0.95);

    const hips = 0.88 + p.hips * 0.35;
    setBoneScale(root, "mixamorig:Hips", hips, 1, hips * 0.95);

    const arms = 0.88 + p.arms * 0.3 + p.muscle * 0.1;
    setBoneScale(root, "mixamorig:LeftArm", 1, arms, arms);
    setBoneScale(root, "mixamorig:RightArm", 1, arms, arms);
    setBoneScale(root, "mixamorig:LeftForeArm", 1, arms * 0.95, arms * 0.95);
    setBoneScale(root, "mixamorig:RightForeArm", 1, arms * 0.95, arms * 0.95);

    const legs = 0.9 + p.legs * 0.28 + p.muscle * 0.08;
    setBoneScale(root, "mixamorig:LeftUpLeg", legs, 1, legs);
    setBoneScale(root, "mixamorig:RightUpLeg", legs, 1, legs);
    setBoneScale(root, "mixamorig:LeftLeg", legs * 0.98, 1, legs * 0.98);
    setBoneScale(root, "mixamorig:RightLeg", legs * 0.98, 1, legs * 0.98);

    // Collapse body skull so Vitruvian morph head reads cleanly
    setBoneScale(root, "mixamorig:Head", 0.02, 0.02, 0.02);

    const lean = p.torsoLean * 0.4;
    setBoneRot(root, "mixamorig:Spine1", lean, 0, 0);

    if (p.posePreset !== "Wave") {
      setBoneRot(
        root,
        "mixamorig:LeftArm",
        0.15 + p.armL * 0.9,
        0,
        0.2 + p.armL * 0.5
      );
      setBoneRot(
        root,
        "mixamorig:RightArm",
        0.15 + p.armR * 0.9,
        0,
        -0.2 - p.armR * 0.5
      );
    }

    applySkinMaterial(root, p);

    const headBone = root.getObjectByName("mixamorig:Head");
    if (headBone && headAnchor.current) {
      headBone.getWorldPosition(headAnchor.current.position);
      headBone.getWorldQuaternion(headAnchor.current.quaternion);
      // undo tiny head bone scale for our replacement head
      const parentScale = new THREE.Vector3();
      root.getWorldScale(parentScale);
      headAnchor.current.scale.set(
        1 / Math.max(parentScale.x, 1e-4),
        1 / Math.max(parentScale.y, 1e-4),
        1 / Math.max(parentScale.z, 1e-4)
      );
    }
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={cloned} />
    </group>
  );
}

function MorphHead() {
  const group = useRef<THREE.Group>(null);
  const hairStyle = useTwinStore((s) => s.params.hairStyle);
  const hairLength = useTwinStore((s) => s.params.hairLength);
  const hairColor = useTwinStore((s) => s.params.hairColor);
  const hairVolume = useTwinStore((s) => s.params.hairVolume);
  const { scene } = useGLTF("/models/vitruvian_head.glb");
  const cloned = useMemo(() => {
    const c = skeletonClone(scene);
    upgradeMaterials(c);
    return c;
  }, [scene]);

  useFrame(() => {
    if (!group.current) return;
    const p = useTwinStore.getState().params;
    applyMorphs(group.current, p);
    applySkinMaterial(group.current, p);
    const fw = 0.94 + p.faceWidth * 0.18;
    group.current.scale.set(
      fw * (0.97 + p.cheekbones * 0.08),
      0.96 + (p.chin - 0.5) * 0.12 + (p.jaw - 0.5) * 0.08,
      0.98 + (p.noseLength - 0.5) * 0.1 + (p.noseWidth - 0.5) * 0.06
    );
  });

  return (
    <group ref={group}>
      <primitive object={cloned} />
      <ProceduralHair
        style={hairStyle}
        length={hairLength}
        color={hairColor}
        volume={hairVolume}
      />
    </group>
  );
}

function PlaceholderMannequin() {
  return (
    <group>
      <mesh castShadow position={[0, 0.95, 0]}>
        <capsuleGeometry args={[0.22, 1.1, 8, 16]} />
        <meshPhysicalMaterial
          color="#2a2438"
          roughness={0.35}
          metalness={0.4}
          clearcoat={0.5}
        />
      </mesh>
      <mesh castShadow position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.16, 32, 32]} />
        <meshPhysicalMaterial color="#3a3250" roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
}

export function TwinAvatar() {
  const rotateY = useTwinStore((s) => s.params.rotateY);
  const twinReady = useTwinStore((s) => s.twinReady);
  const headAnchor = useRef<THREE.Group>(null);

  if (!twinReady) {
    return (
      <group rotation={[0, rotateY, 0]}>
        <PlaceholderMannequin />
      </group>
    );
  }

  return (
    <group rotation={[0, rotateY, 0]}>
      <BodyModel headAnchor={headAnchor} />
      <group ref={headAnchor}>
        <group position={[0, 0.06, 0.02]}>
          <MorphHead />
        </group>
      </group>
    </group>
  );
}
