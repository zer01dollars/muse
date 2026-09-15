"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { HairStyle } from "@/store/twinStore";

interface Props {
  style: HairStyle;
  length: number;
  color: string;
  volume: number;
}

/** Long wavy feminine hair — layered strands parented under the seated head. */
export function ProceduralHair({ style, length, color, volume }: Props) {
  const group = useRef<THREE.Group>(null);

  const mats = useMemo(() => {
    const base = new THREE.Color(color);
    return new THREE.MeshPhysicalMaterial({
      color: base,
      roughness: 0.38,
      metalness: 0.04,
      sheen: 1,
      sheenRoughness: 0.28,
      sheenColor: base.clone().offsetHSL(0.02, 0.05, 0.18),
      clearcoat: 0.22,
      clearcoatRoughness: 0.35,
      envMapIntensity: 0.55,
    });
  }, [color]);

  if (style === "none") return null;

  const vol = 0.78 + volume * 0.55;
  const len = 0.2 + length * 0.95;
  const long = style === "long";
  const mediumish = style === "medium" || long;

  // Layered side/back strand layout for a fuller feminine silhouette
  const sideLayers = long
    ? [
        { y: -0.06, z: 0.02, s: 0.95, rot: 0.12 },
        { y: -0.12, z: 0.0, s: 1.15, rot: 0.18 },
        { y: -0.18, z: -0.02, s: 1.35, rot: 0.22 },
        { y: -0.1, z: 0.04, s: 0.75, rot: 0.08 },
      ]
    : [
        { y: -0.05, z: 0.01, s: 0.85, rot: 0.12 },
        { y: -0.1, z: -0.01, s: 1.05, rot: 0.18 },
      ];

  const backLayers = long
    ? [
        { x: 0, y: -0.08, z: -0.09, sx: 1.05, sy: 1.55, sz: 0.55, rx: 0.32 },
        { x: -0.04, y: -0.14, z: -0.07, sx: 0.7, sy: 1.7, sz: 0.45, rx: 0.38 },
        { x: 0.04, y: -0.14, z: -0.07, sx: 0.7, sy: 1.7, sz: 0.45, rx: 0.38 },
        { x: 0, y: -0.2, z: -0.05, sx: 0.85, sy: 1.85, sz: 0.4, rx: 0.42 },
        { x: -0.055, y: -0.1, z: -0.04, sx: 0.5, sy: 1.4, sz: 0.35, rx: 0.28 },
        { x: 0.055, y: -0.1, z: -0.04, sx: 0.5, sy: 1.4, sz: 0.35, rx: 0.28 },
      ]
    : [
        { x: 0, y: -0.08, z: -0.08, sx: 0.95, sy: 1.1, sz: 0.5, rx: 0.3 },
        { x: -0.035, y: -0.1, z: -0.06, sx: 0.55, sy: 1.15, sz: 0.4, rx: 0.34 },
        { x: 0.035, y: -0.1, z: -0.06, sx: 0.55, sy: 1.15, sz: 0.4, rx: 0.34 },
      ];

  // Parent MuseHairAnchor is already at scalp top — keep group near origin
  // so the crown hemisphere cups the skull instead of floating away.
  return (
    <group ref={group} position={[0, -0.02, 0.01]} name="MuseProceduralHair">
      {/* scalp / crown volume — sits ON the scalp */}
      <mesh castShadow position={[0, 0.01, -0.01]} scale={[1.18 * vol, 1.05, 1.22 * vol]}>
        <sphereGeometry args={[0.118, 36, 28, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <primitive object={mats} attach="material" />
      </mesh>
      {/* under-crown fill so bald skull never shows */}
      <mesh castShadow position={[0, -0.02, -0.005]} scale={[1.08 * vol, 0.7, 1.1 * vol]}>
        <sphereGeometry args={[0.11, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <primitive object={mats.clone()} attach="material" />
      </mesh>
      {/* fringe / bangs soft layer */}
      <mesh
        castShadow
        position={[0, -0.01, 0.085]}
        rotation={[0.55, 0, 0]}
        scale={[0.95 * vol, 0.35 + volume * 0.15, 0.45]}
      >
        <sphereGeometry args={[0.09, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
        <primitive object={mats.clone()} attach="material" />
      </mesh>

      {(style === "short" || style === "pixie") && (
        <mesh castShadow position={[0, 0.0, -0.01]} scale={[1.1 * vol, 0.72 + length * 0.28, 1.14]}>
          <sphereGeometry args={[0.114, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <primitive object={mats.clone()} attach="material" />
        </mesh>
      )}

      {mediumish && (
        <>
          {sideLayers.map((layer, i) =>
            [-1, 1].map((side) => (
              <mesh
                key={`side-${side}-${i}`}
                castShadow
                position={[side * (0.085 + i * 0.012) * vol, layer.y * len, layer.z]}
                rotation={[layer.rot, side * 0.08, side * (0.22 + i * 0.04)]}
                scale={[0.48 * vol * layer.s, len * (long ? 1.25 : 0.85) * layer.s, 0.42]}
              >
                <capsuleGeometry args={[0.048, 0.2, 6, 12]} />
                <primitive object={mats.clone()} attach="material" />
              </mesh>
            ))
          )}
          {backLayers.map((layer, i) => (
            <mesh
              key={`back-${i}`}
              castShadow
              position={[layer.x * vol, layer.y * len, layer.z]}
              rotation={[layer.rx, 0, layer.x * 0.8]}
              scale={[
                layer.sx * vol,
                len * (long ? layer.sy : layer.sy * 0.72),
                layer.sz,
              ]}
            >
              <capsuleGeometry args={[0.055, 0.22, 6, 14]} />
              <primitive object={mats.clone()} attach="material" />
            </mesh>
          ))}
          {/* soft shoulder-wave tips for long */}
          {long &&
            [-1, 1].map((side) => (
              <mesh
                key={`wave-${side}`}
                castShadow
                position={[side * 0.11 * vol, -0.28 * len, 0.02]}
                rotation={[0.55, 0, side * 0.55]}
                scale={[0.4 * vol, 0.55 * len, 0.35]}
              >
                <capsuleGeometry args={[0.04, 0.12, 4, 10]} />
                <primitive object={mats.clone()} attach="material" />
              </mesh>
            ))}
        </>
      )}

      {style === "bun" && (
        <>
          <mesh castShadow position={[0, 0.12, -0.05]} scale={[vol, vol, vol]}>
            <sphereGeometry args={[0.075 + length * 0.03, 24, 20]} />
            <primitive object={mats.clone()} attach="material" />
          </mesh>
          <mesh
            castShadow
            position={[0, 0.02, -0.02]}
            scale={[1.05 * vol, 0.85, 1.08 * vol]}
          >
            <sphereGeometry args={[0.11, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <primitive object={mats.clone()} attach="material" />
          </mesh>
        </>
      )}
    </group>
  );
}
