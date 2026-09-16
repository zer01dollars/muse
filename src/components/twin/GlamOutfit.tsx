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

type ClipOpts = {
  /** Gentle hem only — never band-discard torso (look mesh IS the clothed body). */
  hemY: number;
  armX: number;
};

/**
 * Bind-pose clip on skinned avaturn_look:
 * sleeveless hemmed dress / teddy — keeps FULL torso (no bra/panty band discard).
 */
function installOutfitClip(mat: THREE.Material, opts: ClipOpts) {
  mat.userData.museClipOpts = opts;
  const sync = () => {
    const sh = mat.userData.shader as
      | {
          uniforms?: Record<string, { value: number }>;
        }
      | undefined;
    if (!sh?.uniforms) return;
    const o = mat.userData.museClipOpts as ClipOpts;
    if (sh.uniforms.uHemY) sh.uniforms.uHemY.value = o.hemY;
    if (sh.uniforms.uArmX) sh.uniforms.uArmX.value = o.armX;
    // Force legacy lingerie band mode OFF if a prior compile left it on
    if (sh.uniforms.uClipMode) sh.uniforms.uClipMode.value = 0;
  };

  if (mat.userData.museClipInstalled) {
    sync();
    return;
  }
  mat.userData.museClipInstalled = true;
  mat.userData.museMiniClip = true;

  mat.onBeforeCompile = (shader) => {
    const o = mat.userData.museClipOpts as ClipOpts;
    shader.uniforms.uHemY = { value: o.hemY };
    shader.uniforms.uArmX = { value: o.armX };

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
float by = vMuseBindPos.y;
float bx = abs(vMuseBindPos.x);
// Mini / teddy hem + sleeveless only — NEVER discard chest/torso bands
if (by < uHemY) discard;
if (bx > uArmX && by > 1.02 && by < 1.56) discard;`
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
    lingerie: "#2a1020",
    "club-bodycon": "#0e0e12",
    "sheer-glam": "#c9a86a",
  };
  const shoeMetal: Record<OutfitPreset, number> = {
    "glam-evening": 0.55,
    lingerie: 0.35,
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

function isBodySkinOrHair(n: string) {
  return (
    n.includes("body") ||
    n.includes("head") ||
    n.includes("hair") ||
    n.includes("eye") ||
    n.includes("teeth") ||
    n.includes("tongue") ||
    n.includes("skin")
  );
}

/**
 * Apply glam outfit to the twin:
 * - ALWAYS keep body / hair / shoes / head visible
 * - Evening / club / sheer → restyle + gentle mini hem/sleeves
 * - Lingerie → satin teddy / fitted bodysuit restyle of FULL look mesh
 *   (same gentle hem only — NEVER band-clip discard chest/torso)
 */
export function applyGlamOutfit(root: THREE.Object3D, outfit: OutfitPreset) {
  root.traverse((obj) => {
    const n = obj.name.toLowerCase();
    const mesh = obj as THREE.Mesh;

    if (isBodySkinOrHair(n)) {
      if (!/hair_1/i.test(obj.name)) obj.visible = true;
    }

    if (n.includes("shoe") || n.includes("avaturn_shoes")) {
      obj.visible = true;
      if (mesh.isMesh) styleShoes(mesh, outfit);
      return;
    }

    const isLook = n.includes("avaturn_look") || n.includes("look_0");
    if (!isLook) return;

    // Keep full suit mesh for ALL outfits — look IS the clothed body surface
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
      let clip: ClipOpts;

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
        clip = { hemY: 0.88, armX: 0.205 };
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
        clip = { hemY: 0.82, armX: 0.205 };
      } else if (outfit === "sheer-glam") {
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
        clip = { hemY: 0.86, armX: 0.205 };
      } else {
        // lingerie — satin teddy / fitted bodysuit over FULL torso (no band discard)
        styled = styleAsPhysical(mat, {
          color: "#c4185a",
          metalness: 0.12,
          roughness: 0.18,
          sheen: 1,
          sheenColor: "#ffb8d4",
          sheenRoughness: 0.18,
          clearcoat: 0.85,
          clearcoatRoughness: 0.15,
          emissive: "#8a1040",
          emissiveIntensity: 0.08,
          opacity: 0.92,
          envMapIntensity: 1.35,
        });
        // Same gentle mini hem as evening — keeps chest/torso geometry intact
        clip = { hemY: 0.9, armX: 0.2 };
      }

      installOutfitClip(styled, clip);
      next.push(styled);
    }

    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
}

/** @deprecated use applyGlamOutfit */
export function applyBakedOutfitVisibility(root: THREE.Object3D, outfit: OutfitPreset) {
  applyGlamOutfit(root, outfit);
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
 * Glam wardrobe — restyles skinned Avaturn look for all outfits (incl. lingerie teddy).
 * Lingerie keeps full torso; no floating band scraps.
 */
export function GlamWardrobe({
  twin,
  outfit,
}: {
  twin: THREE.Object3D;
  outfit: OutfitPreset;
}) {
  const jewelry = useRef<THREE.Group>(null);
  const headPos = useMemo(() => new THREE.Vector3(), []);
  const headQuat = useMemo(() => new THREE.Quaternion(), []);
  const parentQ = useMemo(() => new THREE.Quaternion(), []);

  useLayoutEffect(() => {
    applyGlamOutfit(twin, outfit);
  }, [twin, outfit]);

  useFrame(() => {
    const head = findBone(twin, "Head");
    if (
      jewelry.current &&
      head &&
      (outfit === "glam-evening" || outfit === "sheer-glam")
    ) {
      head.getWorldPosition(headPos);
      head.getWorldQuaternion(headQuat);
      if (jewelry.current.parent) {
        jewelry.current.parent.worldToLocal(headPos);
      }
      jewelry.current.position.copy(headPos);
      if (jewelry.current.parent) {
        jewelry.current.parent.getWorldQuaternion(parentQ);
        jewelry.current.quaternion.copy(parentQ).invert().multiply(headQuat);
      } else {
        jewelry.current.quaternion.copy(headQuat);
      }
    }
  });

  return (
    <>
      {(outfit === "glam-evening" || outfit === "sheer-glam") && (
        <group ref={jewelry} name="muse-glam-jewelry">
          <GlamEarrings tone={outfit === "sheer-glam" ? "violet" : "gold"} />
        </group>
      )}
    </>
  );
}
