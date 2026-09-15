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

export function ProceduralHair({ style, length, color, volume }: Props) {
  const group = useRef<THREE.Group>(null);

  const mats = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color),
      roughness: 0.45,
      metalness: 0.05,
      sheen: 1,
      sheenRoughness: 0.35,
      sheenColor: new THREE.Color(color).offsetHSL(0, 0, 0.15),
      clearcoat: 0.15,
      clearcoatRoughness: 0.4,
    });
  }, [color]);

  if (style === "none") return null;

  const vol = 0.7 + volume * 0.55;
  const len = 0.15 + length * 0.85;

  return (
    <group ref={group} position={[0, 0.12, 0]}>
      {/* scalp cap */}
      <mesh castShadow position={[0, 0.02, -0.02]} scale={[1.05 * vol, 0.95, 1.1 * vol]}>
        <sphereGeometry args={[0.11, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <primitive object={mats} attach="material" />
      </mesh>

      {(style === "short" || style === "pixie") && (
        <mesh castShadow position={[0, 0.0, -0.01]} scale={[1.08 * vol, 0.7 + length * 0.3, 1.12]}>
          <sphereGeometry args={[0.112, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <primitive object={mats.clone()} attach="material" />
        </mesh>
      )}

      {(style === "medium" || style === "long") && (
        <>
          {/* side falls */}
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              castShadow
              position={[side * 0.09 * vol, -0.08 * len, 0.01]}
              rotation={[0.15, 0, side * 0.25]}
              scale={[0.55 * vol, len * (style === "long" ? 1.35 : 0.9), 0.5]}
            >
              <capsuleGeometry args={[0.055, 0.22, 6, 12]} />
              <primitive object={mats.clone()} attach="material" />
            </mesh>
          ))}
          {/* back fall */}
          <mesh
            castShadow
            position={[0, -0.1 * len, -0.08]}
            rotation={[0.35, 0, 0]}
            scale={[0.95 * vol, len * (style === "long" ? 1.5 : 1), 0.55]}
          >
            <capsuleGeometry args={[0.07, 0.25, 6, 14]} />
            <primitive object={mats.clone()} attach="material" />
          </mesh>
        </>
      )}

      {style === "bun" && (
        <mesh castShadow position={[0, 0.12, -0.04]} scale={[vol, vol, vol]}>
          <sphereGeometry args={[0.07 + length * 0.03, 24, 20]} />
          <primitive object={mats.clone()} attach="material" />
        </mesh>
      )}
    </group>
  );
}
