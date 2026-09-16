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

type BodyFit = {
  hipY: number;
  spine2Y: number;
  neckY: number;
  hipWidth: number;
  shoulderWidth: number;
  torsoLen: number;
  hipRadius: number;
  waistRadius: number;
  chestRadius: number;
};

/** Measure twin once from bones + body mesh cross-sections (bind / current pose). */
function measureBodyFit(root: THREE.Object3D): BodyFit {
  const hips = findBone(root, "Hips");
  const spine2 = findBone(root, "Spine2");
  const neck = findBone(root, "Neck");
  const lArm = findBone(root, "LeftArm");
  const rArm = findBone(root, "RightArm");
  const lUp = findBone(root, "LeftUpLeg");
  const rUp = findBone(root, "RightUpLeg");

  const wp = (b: THREE.Bone | null, fallback: THREE.Vector3) => {
    if (!b) return fallback.clone();
    const p = new THREE.Vector3();
    b.getWorldPosition(p);
    return p;
  };

  const hipsP = wp(hips, new THREE.Vector3(0, 1.01, 0));
  const spine2P = wp(spine2, new THREE.Vector3(0, 1.38, 0));
  const neckP = wp(neck, new THREE.Vector3(0, 1.54, 0));
  const lArmP = wp(lArm, new THREE.Vector3(0.17, 1.53, 0));
  const rArmP = wp(rArm, new THREE.Vector3(-0.17, 1.53, 0));
  const lUpP = wp(lUp, new THREE.Vector3(0.09, 0.99, 0));
  const rUpP = wp(rUp, new THREE.Vector3(-0.09, 0.99, 0));

  // Default radii from bind-pose body sampling (Avaturn muse_twin)
  let hipRadius = 0.19;
  let waistRadius = 0.14;
  let chestRadius = 0.17;

  let body: THREE.Mesh | null = null;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && /body/i.test(o.name)) body = o as THREE.Mesh;
  });
  if (body) {
    const mesh = body as THREE.Mesh;
    const pos = mesh.geometry.attributes.position;
    const v = new THREE.Vector3();
    const sample = (hy: number, pad = 0.035) => {
      let maxR = 0;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        if (Math.abs(v.y - hy) > pad) continue;
        const r = Math.hypot(v.x - hipsP.x, v.z - hipsP.z);
        if (r > maxR) maxR = r;
      }
      return maxR;
    };
    const hr = sample(hipsP.y);
    const wr = sample((hipsP.y + spine2P.y) * 0.5);
    const cr = sample(spine2P.y);
    if (hr > 0.05) hipRadius = hr * 1.02;
    if (wr > 0.05) waistRadius = wr * 1.02;
    if (cr > 0.05) chestRadius = Math.min(cr, hipRadius * 1.15) * 1.02;
  }

  return {
    hipY: hipsP.y,
    spine2Y: spine2P.y,
    neckY: neckP.y,
    hipWidth: Math.max(0.14, lUpP.distanceTo(rUpP)),
    shoulderWidth: Math.max(0.28, lArmP.distanceTo(rArmP)),
    torsoLen: Math.max(0.35, neckP.y - hipsP.y),
    hipRadius,
    waistRadius,
    chestRadius,
  };
}

/** Bind-pose Y clip → sleeveless mini from full Avaturn suit (skinned, hugs body). */
function installMiniDressClip(mat: THREE.Material, hemY = 0.9, armX = 0.21) {
  mat.userData.museHemY = hemY;
  mat.userData.museArmX = armX;
  if (mat.userData.museMiniClip) {
    const sh = mat.userData.shader as { uniforms?: Record<string, { value: number }> } | undefined;
    if (sh?.uniforms?.uHemY) sh.uniforms.uHemY.value = hemY;
    if (sh?.uniforms?.uArmX) sh.uniforms.uArmX.value = armX;
    return;
  }
  mat.userData.museMiniClip = true;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uHemY = { value: mat.userData.museHemY };
    shader.uniforms.uArmX = { value: mat.userData.museArmX };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vMuseBindPos;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vMuseBindPos = position;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vMuseBindPos;
uniform float uHemY;
uniform float uArmX;`
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
// Mini hem — reveal thighs
if (vMuseBindPos.y < uHemY) discard;
// Sleeveless — drop long sleeves / arm tubes
if (abs(vMuseBindPos.x) > uArmX && vMuseBindPos.y > 1.02 && vMuseBindPos.y < 1.56) discard;`
      );
    mat.userData.shader = shader;
  };
  mat.needsUpdate = true;
}


function styleAsPhysical(
  mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
  opts: {
    color: string;
    metalness: number;
    roughness: number;
    sheen?: number;
    sheenColor?: string;
    sheenRoughness?: number;
    clearcoat?: number;
    clearcoatRoughness?: number;
    emissive?: string;
    emissiveIntensity?: number;
    opacity?: number;
    transmission?: number;
    thickness?: number;
    envMapIntensity?: number;
  }
) {
  // Promote to physical when we need sheen / transmission / clearcoat
  let m: THREE.MeshPhysicalMaterial;
  if (mat instanceof THREE.MeshPhysicalMaterial) {
    m = mat;
  } else {
    m = new THREE.MeshPhysicalMaterial();
    m.map = mat.map;
    m.normalMap = mat.normalMap;
    m.roughnessMap = mat.roughnessMap;
    m.metalnessMap = mat.metalnessMap;
    m.aoMap = mat.aoMap;
    m.emissiveMap = mat.emissiveMap;
    m.alphaMap = mat.alphaMap;
    m.name = mat.name;
  }

  m.color.set(opts.color);
  // Keep albedo map but tint strongly toward glam color
  if (m.map) {
    m.color.lerp(new THREE.Color(opts.color), 0.15);
  }
  m.metalness = opts.metalness;
  m.roughness = opts.roughness;
  m.sheen = opts.sheen ?? 0;
  m.sheenColor = new THREE.Color(opts.sheenColor ?? "#ffffff");
  m.sheenRoughness = opts.sheenRoughness ?? 0.3;
  m.clearcoat = opts.clearcoat ?? 0;
  m.clearcoatRoughness = opts.clearcoatRoughness ?? 0.25;
  m.emissive = new THREE.Color(opts.emissive ?? "#000000");
  m.emissiveIntensity = opts.emissiveIntensity ?? 0;
  m.envMapIntensity = opts.envMapIntensity ?? 1.2;
  m.side = THREE.DoubleSide;

  if (opts.opacity !== undefined && opts.opacity < 1) {
    m.transparent = true;
    m.opacity = opts.opacity;
    m.depthWrite = opts.opacity > 0.7;
  } else {
    m.transparent = false;
    m.opacity = 1;
    m.depthWrite = true;
  }
  m.transmission = opts.transmission ?? 0;
  m.thickness = opts.thickness ?? 0.2;
  m.needsUpdate = true;
  return m;
}

function styleShoes(mesh: THREE.Mesh, outfit: OutfitPreset) {
  const shoeTint: Record<OutfitPreset, string> = {
    "glam-evening": "#1a1210",
    lingerie: "#2a1820",
    "club-bodycon": "#0e0e12",
    "sheer-glam": "#c9a86a",
  };
  const shoeMetal: Record<OutfitPreset, number> = {
    "glam-evening": 0.55,
    lingerie: 0.25,
    "club-bodycon": 0.4,
    "sheer-glam": 0.75,
  };
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (let i = 0; i < mats.length; i++) {
    const mat = mats[i];
    if (
      !(mat instanceof THREE.MeshStandardMaterial) &&
      !(mat instanceof THREE.MeshPhysicalMaterial)
    )
      continue;
    mat.color.set(shoeTint[outfit]);
    mat.metalness = shoeMetal[outfit];
    mat.roughness = outfit === "sheer-glam" ? 0.28 : 0.42;
    if (mat instanceof THREE.MeshPhysicalMaterial) {
      mat.clearcoat = 0.55;
      mat.clearcoatRoughness = 0.22;
      mat.envMapIntensity = 1.1;
    }
    mat.needsUpdate = true;
  }
}

/**
 * Apply glam outfit to the twin:
 * - Keep body / hair / shoes / head visible
 * - Evening / club / sheer → restyle skinned avaturn_look_0 into mini (clip) + glam PBR
 * - Lingerie → hide outer look; leave skin for fitted add-ons
 */
export function applyGlamOutfit(root: THREE.Object3D, outfit: OutfitPreset) {
  const isLingerie = outfit === "lingerie";

  root.traverse((obj) => {
    const n = obj.name.toLowerCase();
    const mesh = obj as THREE.Mesh;

    // Never hide body, hair, head, eyes, shoes
    if (
      n.includes("body") ||
      n.includes("head") ||
      n.includes("hair") ||
      n.includes("eye") ||
      n.includes("teeth") ||
      n.includes("tongue")
    ) {
      // Secondary hair cards stay managed by TwinAvatar
      if (!/hair_1/i.test(obj.name)) obj.visible = true;
    }

    if (n.includes("shoe") || n.includes("avaturn_shoes")) {
      obj.visible = true;
      if (mesh.isMesh) styleShoes(mesh, outfit);
      return;
    }

    if (n.includes("avaturn_look") || n.includes("look_0")) {
      if (isLingerie) {
        obj.visible = false;
        return;
      }
      obj.visible = true;
      if (!mesh.isMesh || !mesh.material) return;

      const raw = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const next: THREE.Material[] = [];

      for (const mat of raw) {
        if (
          !(mat instanceof THREE.MeshStandardMaterial) &&
          !(mat instanceof THREE.MeshPhysicalMaterial)
        ) {
          next.push(mat);
          continue;
        }

        let styled: THREE.MeshPhysicalMaterial;
        if (outfit === "glam-evening") {
          styled = styleAsPhysical(mat, {
            color: "#1a1028",
            metalness: 0.72,
            roughness: 0.22,
            sheen: 1,
            sheenColor: "#e8c878",
            sheenRoughness: 0.2,
            clearcoat: 1,
            clearcoatRoughness: 0.12,
            emissive: "#c9a86a",
            emissiveIntensity: 0.1,
            envMapIntensity: 1.55,
          });
        } else if (outfit === "club-bodycon") {
          styled = styleAsPhysical(mat, {
            color: "#0a0a10",
            metalness: 0.35,
            roughness: 0.28,
            sheen: 0.85,
            sheenColor: "#ff4d7a",
            sheenRoughness: 0.28,
            clearcoat: 0.85,
            clearcoatRoughness: 0.18,
            emissive: "#ff2d6a",
            emissiveIntensity: 0.06,
            envMapIntensity: 1.25,
          });
        } else {
          // sheer-glam
          styled = styleAsPhysical(mat, {
            color: "#2a1838",
            metalness: 0.4,
            roughness: 0.32,
            sheen: 0.9,
            sheenColor: "#c9a0ff",
            sheenRoughness: 0.25,
            clearcoat: 0.7,
            clearcoatRoughness: 0.2,
            emissive: "#b488ff",
            emissiveIntensity: 0.22,
            opacity: 0.62,
            transmission: 0.28,
            thickness: 0.18,
            envMapIntensity: 1.35,
          });
        }

        // Mini sleeveless silhouette from full suit
        const hem =
          outfit === "glam-evening" ? 0.88 : outfit === "club-bodycon" ? 0.82 : 0.86;
        installMiniDressClip(styled, hem, 0.205);
        next.push(styled);
      }

      mesh.material = Array.isArray(mesh.material) ? next : next[0];
      return;
    }
  });
}

/** @deprecated use applyGlamOutfit */
export function applyBakedOutfitVisibility(root: THREE.Object3D, outfit: OutfitPreset) {
  applyGlamOutfit(root, outfit);
}

function satinMat(color: string, sheenColor = "#f2d6e4") {
  return (
    <meshPhysicalMaterial
      color={color}
      metalness={0.06}
      roughness={0.26}
      clearcoat={0.4}
      clearcoatRoughness={0.35}
      sheen={1}
      sheenRoughness={0.3}
      sheenColor={sheenColor}
      envMapIntensity={1}
      side={THREE.DoubleSide}
    />
  );
}

/**
 * Bone-fitted lingerie — sized from measured hip/chest radii, tracked with a
 * spine-aligned frame (avoids Mixamo hip roll that made cylinders float).
 */
function FittedLingerie({ fit }: { fit: BodyFit }) {
  const cupR = Math.max(0.045, fit.chestRadius * 0.38);
  const bandR = fit.chestRadius * 0.98;
  const hipR = fit.hipRadius * 1.02;
  const briefH = Math.max(0.07, fit.torsoLen * 0.14);
  const chestLift = fit.spine2Y - fit.hipY; // local Y above hips

  return (
    <group>
      {/* Bra cups — snapped under chest */}
      <mesh
        position={[-cupR * 0.95, chestLift * 0.92, fit.chestRadius * 0.35]}
        rotation={[0.2, 0.2, -0.12]}
        castShadow
      >
        <sphereGeometry args={[cupR, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        {satinMat("#2a1520", "#e8b8c8")}
      </mesh>
      <mesh
        position={[cupR * 0.95, chestLift * 0.92, fit.chestRadius * 0.35]}
        rotation={[0.2, -0.2, 0.12]}
        castShadow
      >
        <sphereGeometry args={[cupR, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        {satinMat("#2a1520", "#e8b8c8")}
      </mesh>
      {/* Underband */}
      <mesh position={[0, chestLift * 0.72, 0.01]} castShadow>
        <cylinderGeometry args={[bandR * 0.96, bandR, 0.028, 40, 1, true]} />
        {satinMat("#1e1018", "#d4a0b0")}
      </mesh>
      {/* Straps */}
      <mesh position={[-bandR * 0.72, chestLift * 1.05, 0]} rotation={[0, 0, 0.28]}>
        <capsuleGeometry args={[0.006, chestLift * 0.28, 4, 8]} />
        {satinMat("#2a1520")}
      </mesh>
      <mesh position={[bandR * 0.72, chestLift * 1.05, 0]} rotation={[0, 0, -0.28]}>
        <capsuleGeometry args={[0.006, chestLift * 0.28, 4, 8]} />
        {satinMat("#2a1520")}
      </mesh>
      {/* Bottoms */}
      <mesh position={[0, -briefH * 0.15, 0.01]} castShadow>
        <cylinderGeometry args={[hipR * 0.92, hipR, briefH, 40, 1, true]} />
        {satinMat("#24141c", "#e8b8c8")}
      </mesh>
      <mesh position={[0, -briefH * 0.85, 0.02]} castShadow>
        <cylinderGeometry args={[hipR * 0.78, hipR * 0.62, briefH * 0.45, 32, 1, true]} />
        {satinMat("#1a1016", "#d4a0b0")}
      </mesh>
      {/* Waist bow */}
      <mesh position={[0, briefH * 0.35, hipR * 0.85]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[0.035, 0.012, 0.008]} />
        {satinMat("#c898a8", "#ffe0ec")}
      </mesh>
    </group>
  );
}

/** Small head-tracked earrings for evening / sheer. */
function GlamEarrings({ tone }: { tone: "gold" | "violet" }) {
  const color = tone === "gold" ? "#e8c878" : "#e0c0ff";
  const glow = tone === "gold" ? "#e8c878" : "#b488ff";
  const drop = tone === "gold" ? "#f0d090" : "#d0b0ff";
  return (
    <group>
      <mesh position={[-0.078, -0.015, 0.018]}>
        <sphereGeometry args={[0.009, 12, 12]} />
        <meshPhysicalMaterial
          color={color}
          metalness={1}
          roughness={0.1}
          emissive={glow}
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh position={[0.078, -0.015, 0.018]}>
        <sphereGeometry args={[0.009, 12, 12]} />
        <meshPhysicalMaterial
          color={color}
          metalness={1}
          roughness={0.1}
          emissive={glow}
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh position={[-0.078, -0.042, 0.014]}>
        <capsuleGeometry args={[0.0035, 0.022, 4, 8]} />
        <meshPhysicalMaterial color={drop} metalness={1} roughness={0.15} />
      </mesh>
      <mesh position={[0.078, -0.042, 0.014]}>
        <capsuleGeometry args={[0.0035, 0.022, 4, 8]} />
        <meshPhysicalMaterial color={drop} metalness={1} roughness={0.15} />
      </mesh>
    </group>
  );
}

/**
 * Glam wardrobe — restyles skinned Avaturn look for dresses; bone-fitted lingerie
 * only when needed. No floating tube geometry.
 */
export function GlamWardrobe({
  twin,
  outfit,
}: {
  twin: THREE.Object3D;
  outfit: OutfitPreset;
}) {
  const lingerieGrp = useRef<THREE.Group>(null);
  const jewelry = useRef<THREE.Group>(null);
  const fit = useMemo(() => measureBodyFit(twin), [twin]);

  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const spinePos = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const basis = useMemo(() => new THREE.Matrix4(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const headPos = useMemo(() => new THREE.Vector3(), []);
  const headQuat = useMemo(() => new THREE.Quaternion(), []);
  const hipQuat = useMemo(() => new THREE.Quaternion(), []);

  useLayoutEffect(() => {
    applyGlamOutfit(twin, outfit);
  }, [twin, outfit]);

  useFrame(() => {
    const hips = findBone(twin, "Hips");
    const spine2 = findBone(twin, "Spine2");
    const head = findBone(twin, "Head");

    // Spine-aligned frame for lingerie (ignores Mixamo hip twist)
    if (outfit === "lingerie" && lingerieGrp.current && hips && spine2) {
      hips.getWorldPosition(tmpPos);
      spine2.getWorldPosition(spinePos);
      up.copy(spinePos).sub(tmpPos).normalize();
      hips.getWorldQuaternion(hipQuat);
      forward.set(0, 0, 1).applyQuaternion(hipQuat);
      // Flatten forward onto plane perpendicular to spine up
      forward.addScaledVector(up, -forward.dot(up));
      if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1);
      forward.normalize();
      right.crossVectors(up, forward).normalize();
      forward.crossVectors(right, up).normalize();
      basis.makeBasis(right, up, forward);
      quat.setFromRotationMatrix(basis);
      lingerieGrp.current.position.copy(tmpPos);
      lingerieGrp.current.quaternion.copy(quat);
      lingerieGrp.current.scale.set(1, 1, 1);
    }

    if (
      jewelry.current &&
      head &&
      (outfit === "glam-evening" || outfit === "sheer-glam")
    ) {
      head.getWorldPosition(headPos);
      head.getWorldQuaternion(headQuat);
      jewelry.current.position.copy(headPos);
      jewelry.current.quaternion.copy(headQuat);
    }
  });

  return (
    <>
      {outfit === "lingerie" && (
        <group ref={lingerieGrp} name="muse-glam-lingerie">
          <FittedLingerie fit={fit} />
        </group>
      )}
      {(outfit === "glam-evening" || outfit === "sheer-glam") && (
        <group ref={jewelry} name="muse-glam-jewelry">
          <GlamEarrings tone={outfit === "sheer-glam" ? "violet" : "gold"} />
        </group>
      )}
    </>
  );
}
