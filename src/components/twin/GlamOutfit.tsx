"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OutfitPreset } from "@/store/twinStore";

function findBone(root: THREE.Object3D, base: string): THREE.Bone | null {
  const candidates = [`mixamorig:${base}`, `mixamorig${base}`, base];
  for (const name of candidates) {
    const o = root.getObjectByName(name);
    if (o) return o as THREE.Bone;
  }
  return null;
}

/** Hide baked Avaturn suit; restyle shoes for heels vibe. */
export function applyBakedOutfitVisibility(root: THREE.Object3D, outfit: OutfitPreset) {
  const shoeTint: Record<OutfitPreset, THREE.Color> = {
    "glam-evening": new THREE.Color("#1a1210"),
    lingerie: new THREE.Color("#2a1820"),
    "club-bodycon": new THREE.Color("#0e0e12"),
    "sheer-glam": new THREE.Color("#c9a86a"),
  };
  const shoeMetal: Record<OutfitPreset, number> = {
    "glam-evening": 0.55,
    lingerie: 0.25,
    "club-bodycon": 0.4,
    "sheer-glam": 0.75,
  };

  root.traverse((obj) => {
    const n = obj.name.toLowerCase();
    if (n.includes("avaturn_look") || n.includes("look_0")) {
      obj.visible = false;
      return;
    }
    if (!n.includes("shoe") && !n.includes("avaturn_shoes")) return;
    obj.visible = true;
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (
        !(mat instanceof THREE.MeshStandardMaterial) &&
        !(mat instanceof THREE.MeshPhysicalMaterial)
      )
        continue;
      mat.color.copy(shoeTint[outfit]);
      mat.metalness = shoeMetal[outfit];
      mat.roughness = outfit === "sheer-glam" ? 0.28 : 0.42;
      if (mat instanceof THREE.MeshPhysicalMaterial) {
        mat.clearcoat = 0.55;
        mat.clearcoatRoughness = 0.22;
        mat.envMapIntensity = 1.1;
      }
      mat.needsUpdate = true;
    }
  });
}

function sequinMat(color: string, accent: string, sparkle = 0.9) {
  return (
    <meshPhysicalMaterial
      color={color}
      metalness={0.78 + sparkle * 0.15}
      roughness={0.18}
      clearcoat={1}
      clearcoatRoughness={0.12}
      sheen={1}
      sheenRoughness={0.25}
      sheenColor={accent}
      emissive={accent}
      emissiveIntensity={0.08 + sparkle * 0.06}
      envMapIntensity={1.55}
      side={THREE.DoubleSide}
    />
  );
}

function satinMat(color: string, sheenColor = "#f2d6e4") {
  return (
    <meshPhysicalMaterial
      color={color}
      metalness={0.08}
      roughness={0.28}
      clearcoat={0.35}
      clearcoatRoughness={0.4}
      sheen={1}
      sheenRoughness={0.32}
      sheenColor={sheenColor}
      envMapIntensity={0.95}
      side={THREE.DoubleSide}
    />
  );
}

function meshSheerMat(color: string, glow: string) {
  return (
    <meshPhysicalMaterial
      color={color}
      metalness={0.35}
      roughness={0.35}
      transmission={0.35}
      thickness={0.15}
      transparent
      opacity={0.55}
      clearcoat={0.6}
      clearcoatRoughness={0.2}
      sheen={0.8}
      sheenColor={glow}
      emissive={glow}
      emissiveIntensity={0.18}
      envMapIntensity={1.2}
      side={THREE.DoubleSide}
      depthWrite={false}
    />
  );
}

function GlamEveningLook() {
  return (
    <group>
      {/* Sequin bodice */}
      <mesh position={[0, 0.22, 0.01]} castShadow>
        <cylinderGeometry args={[0.125, 0.145, 0.26, 40, 1, true]} />
        {sequinMat("#140c1c", "#e8c878", 1)}
      </mesh>
      {/* Mini skirt flare */}
      <mesh position={[0, 0.02, 0.01]} castShadow>
        <cylinderGeometry args={[0.145, 0.2, 0.2, 40, 1, true]} />
        {sequinMat("#1a1024", "#f0d090", 0.95)}
      </mesh>
      {/* Side slit accent strip */}
      <mesh position={[0.12, 0.06, 0.04]} rotation={[0, 0.4, 0.08]} castShadow>
        <boxGeometry args={[0.02, 0.28, 0.08]} />
        {sequinMat("#c9a86a", "#fff0c8", 1)}
      </mesh>
      {/* Necklace */}
      <mesh position={[0, 0.4, 0.07]} rotation={[0.35, 0, 0]}>
        <torusGeometry args={[0.07, 0.006, 10, 40]} />
        <meshPhysicalMaterial
          color="#e8c878"
          metalness={1}
          roughness={0.15}
          clearcoat={1}
          envMapIntensity={1.6}
        />
      </mesh>
      {/* Pendant */}
      <mesh position={[0, 0.34, 0.1]}>
        <octahedronGeometry args={[0.018, 0]} />
        <meshPhysicalMaterial
          color="#f5e6b8"
          metalness={1}
          roughness={0.1}
          emissive="#e8c878"
          emissiveIntensity={0.25}
        />
      </mesh>
      {/* Earrings (approx head-relative — also mirrored in jewelry follow) */}
      <mesh position={[-0.09, 0.52, 0.02]}>
        <sphereGeometry args={[0.012, 12, 12]} />
        <meshPhysicalMaterial color="#e8c878" metalness={1} roughness={0.12} />
      </mesh>
      <mesh position={[0.09, 0.52, 0.02]}>
        <sphereGeometry args={[0.012, 12, 12]} />
        <meshPhysicalMaterial color="#e8c878" metalness={1} roughness={0.12} />
      </mesh>
    </group>
  );
}

function LingerieLook() {
  return (
    <group>
      {/* Soft satin bra cups */}
      <mesh position={[-0.055, 0.28, 0.06]} rotation={[0.15, 0.15, -0.1]} castShadow>
        <sphereGeometry args={[0.055, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
        {satinMat("#2a1520", "#e8b8c8")}
      </mesh>
      <mesh position={[0.055, 0.28, 0.06]} rotation={[0.15, -0.15, 0.1]} castShadow>
        <sphereGeometry args={[0.055, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
        {satinMat("#2a1520", "#e8b8c8")}
      </mesh>
      {/* Band */}
      <mesh position={[0, 0.22, 0.02]} castShadow>
        <cylinderGeometry args={[0.13, 0.135, 0.035, 32, 1, true]} />
        {satinMat("#1e1018", "#d4a0b0")}
      </mesh>
      {/* Straps */}
      <mesh position={[-0.09, 0.34, 0]} rotation={[0, 0, 0.25]}>
        <boxGeometry args={[0.012, 0.14, 0.008]} />
        {satinMat("#2a1520")}
      </mesh>
      <mesh position={[0.09, 0.34, 0]} rotation={[0, 0, -0.25]}>
        <boxGeometry args={[0.012, 0.14, 0.008]} />
        {satinMat("#2a1520")}
      </mesh>
      {/* Matching bottoms */}
      <mesh position={[0, -0.02, 0.01]} castShadow>
        <cylinderGeometry args={[0.14, 0.155, 0.1, 32, 1, true]} />
        {satinMat("#24141c", "#e8b8c8")}
      </mesh>
      <mesh position={[0, -0.08, 0.02]} castShadow>
        <cylinderGeometry args={[0.12, 0.1, 0.05, 28, 1, true]} />
        {satinMat("#1a1016", "#d4a0b0")}
      </mesh>
      {/* Tiny waist bow accent */}
      <mesh position={[0, 0.04, 0.12]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.04, 0.015, 0.01]} />
        {satinMat("#c898a8", "#ffe0ec")}
      </mesh>
    </group>
  );
}

function ClubBodyconLook() {
  return (
    <group>
      {/* Tight bodycon sheath */}
      <mesh position={[0, 0.12, 0.01]} castShadow>
        <cylinderGeometry args={[0.12, 0.155, 0.52, 40, 1, true]} />
        <meshPhysicalMaterial
          color="#0a0a10"
          metalness={0.25}
          roughness={0.32}
          clearcoat={0.7}
          clearcoatRoughness={0.2}
          sheen={0.6}
          sheenColor="#ff4d7a"
          envMapIntensity={1.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Side cutout panels (sheer windows) */}
      <mesh position={[-0.11, 0.18, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.1, 0.16]} />
        <meshPhysicalMaterial
          color="#1a0810"
          transparent
          opacity={0.25}
          transmission={0.5}
          roughness={0.2}
          metalness={0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0.11, 0.18, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.1, 0.16]} />
        <meshPhysicalMaterial
          color="#1a0810"
          transparent
          opacity={0.25}
          transmission={0.5}
          roughness={0.2}
          metalness={0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Metallic hip belt */}
      <mesh position={[0, 0.02, 0.01]}>
        <cylinderGeometry args={[0.148, 0.15, 0.025, 40, 1, true]} />
        <meshPhysicalMaterial
          color="#d0d4dc"
          metalness={1}
          roughness={0.18}
          clearcoat={1}
          envMapIntensity={1.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Neon-pink metallic strap accents */}
      <mesh position={[0, 0.32, 0.08]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.18, 0.012, 0.01]} />
        <meshPhysicalMaterial
          color="#ff2d6a"
          metalness={0.9}
          roughness={0.2}
          emissive="#ff2d6a"
          emissiveIntensity={0.35}
        />
      </mesh>
      <mesh position={[-0.06, 0.05, 0.12]} rotation={[0, 0.3, 0.6]}>
        <boxGeometry args={[0.01, 0.22, 0.008]} />
        <meshPhysicalMaterial
          color="#c0c4cc"
          metalness={1}
          roughness={0.15}
          emissive="#8890a0"
          emissiveIntensity={0.1}
        />
      </mesh>
    </group>
  );
}

function SheerGlamLook() {
  return (
    <group>
      {/* Base mesh dress */}
      <mesh position={[0, 0.14, 0.01]} castShadow>
        <cylinderGeometry args={[0.122, 0.175, 0.48, 40, 1, true]} />
        {meshSheerMat("#2a1838", "#c9a0ff")}
      </mesh>
      {/* Opaque panel bands */}
      <mesh position={[0, 0.3, 0.01]}>
        <cylinderGeometry args={[0.12, 0.125, 0.06, 36, 1, true]} />
        {sequinMat("#1a1028", "#e0c0ff", 0.7)}
      </mesh>
      <mesh position={[0, 0.05, 0.01]}>
        <cylinderGeometry args={[0.14, 0.15, 0.05, 36, 1, true]} />
        {sequinMat("#1a1028", "#e0c0ff", 0.7)}
      </mesh>
      {/* Glow edge rings */}
      <mesh position={[0, 0.34, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.122, 0.006, 8, 48]} />
        <meshPhysicalMaterial
          color="#e8d0ff"
          emissive="#b488ff"
          emissiveIntensity={0.7}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, -0.08, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.17, 0.006, 8, 48]} />
        <meshPhysicalMaterial
          color="#e8d0ff"
          emissive="#b488ff"
          emissiveIntensity={0.55}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      {/* Chest glow gem */}
      <mesh position={[0, 0.3, 0.12]}>
        <octahedronGeometry args={[0.02, 0]} />
        <meshPhysicalMaterial
          color="#f0e8ff"
          emissive="#c9a0ff"
          emissiveIntensity={0.85}
          metalness={0.6}
          roughness={0.15}
        />
      </mesh>
    </group>
  );
}

/**
 * Procedural glam wardrobe — follows hips (primary) with a soft spine blend
 * so dresses stay body-fitted while the twin poses.
 */
export function GlamWardrobe({
  twin,
  outfit,
}: {
  twin: THREE.Object3D;
  outfit: OutfitPreset;
}) {
  const group = useRef<THREE.Group>(null);
  const jewelry = useRef<THREE.Group>(null);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);
  const spinePos = useMemo(() => new THREE.Vector3(), []);
  const spineQuat = useMemo(() => new THREE.Quaternion(), []);
  const headPos = useMemo(() => new THREE.Vector3(), []);

  useLayoutEffect(() => {
    applyBakedOutfitVisibility(twin, outfit);
  }, [twin, outfit]);

  useFrame(() => {
    const hips = findBone(twin, "Hips");
    const spine2 = findBone(twin, "Spine2");
    const head = findBone(twin, "Head");
    if (!hips || !group.current) return;

    hips.getWorldPosition(tmpPos);
    hips.getWorldQuaternion(tmpQuat);
    if (spine2) {
      spine2.getWorldPosition(spinePos);
      spine2.getWorldQuaternion(spineQuat);
      // Soft blend toward spine so bodice tracks torso lean
      tmpQuat.slerp(spineQuat, 0.35);
      tmpPos.lerp(spinePos, 0.15);
    }

    group.current.position.copy(tmpPos);
    group.current.quaternion.copy(tmpQuat);
    // Counter typical Mixamo hip scale so dress stays human-sized
    group.current.scale.set(1, 1, 1);

    if (jewelry.current && head) {
      head.getWorldPosition(headPos);
      jewelry.current.position.copy(headPos);
      head.getWorldQuaternion(tmpQuat);
      jewelry.current.quaternion.copy(tmpQuat);
    }
  });

  const look =
    outfit === "glam-evening" ? (
      <GlamEveningLook />
    ) : outfit === "lingerie" ? (
      <LingerieLook />
    ) : outfit === "club-bodycon" ? (
      <ClubBodyconLook />
    ) : (
      <SheerGlamLook />
    );

  return (
    <>
      <group ref={group} name="muse-glam-wardrobe">
        {/* Local offset: hips → mid-torso clothing frame */}
        <group position={[0, 0.05, 0]}>{look}</group>
      </group>
      {/* Extra sparkle earrings that stick to head for evening / sheer */}
      {(outfit === "glam-evening" || outfit === "sheer-glam") && (
        <group ref={jewelry} name="muse-glam-jewelry">
          <mesh position={[-0.085, -0.02, 0.02]}>
            <sphereGeometry args={[0.01, 10, 10]} />
            <meshPhysicalMaterial
              color={outfit === "sheer-glam" ? "#e0c0ff" : "#e8c878"}
              metalness={1}
              roughness={0.1}
              emissive={outfit === "sheer-glam" ? "#b488ff" : "#e8c878"}
              emissiveIntensity={0.35}
            />
          </mesh>
          <mesh position={[0.085, -0.02, 0.02]}>
            <sphereGeometry args={[0.01, 10, 10]} />
            <meshPhysicalMaterial
              color={outfit === "sheer-glam" ? "#e0c0ff" : "#e8c878"}
              metalness={1}
              roughness={0.1}
              emissive={outfit === "sheer-glam" ? "#b488ff" : "#e8c878"}
              emissiveIntensity={0.35}
            />
          </mesh>
          <mesh position={[-0.085, -0.05, 0.015]}>
            <capsuleGeometry args={[0.004, 0.03, 4, 8]} />
            <meshPhysicalMaterial
              color={outfit === "sheer-glam" ? "#d0b0ff" : "#f0d090"}
              metalness={1}
              roughness={0.15}
            />
          </mesh>
          <mesh position={[0.085, -0.05, 0.015]}>
            <capsuleGeometry args={[0.004, 0.03, 4, 8]} />
            <meshPhysicalMaterial
              color={outfit === "sheer-glam" ? "#d0b0ff" : "#f0d090"}
              metalness={1}
              roughness={0.15}
            />
          </mesh>
        </group>
      )}
    </>
  );
}
