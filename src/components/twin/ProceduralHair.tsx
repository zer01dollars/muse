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

/** Soft vertical strand alpha for hair cards. */
function makeStrandTexture(): THREE.CanvasTexture {
  const w = 48;
  const h = 192;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);

  for (let x = 0; x < w; x++) {
    const nx = (x + 0.5) / w;
    const edge = Math.sin(nx * Math.PI);
    for (let y = 0; y < h; y++) {
      const ny = y / h;
      const strand =
        0.55 +
        0.45 *
          Math.sin(x * 1.7 + Math.sin(y * 0.08) * 2.2) *
          Math.sin(x * 0.55 + 1.3);
      const tipFade = 1 - Math.pow(ny, 1.35) * 0.55;
      const rootBoost = 0.75 + (1 - ny) * 0.25;
      const a = Math.max(0, Math.min(1, strand * edge * tipFade * rootBoost));
      const shade = Math.floor(180 + strand * 60);
      ctx.fillStyle = `rgba(${shade},${shade - 8},${shade - 20},${a})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

type CardSpec = {
  pos: [number, number, number];
  rot: [number, number, number];
  scale: [number, number, number];
  key: string;
};

/**
 * Slim hair cards around the scalp — keeps face readable (photoreal skin visible).
 * Parent: MuseHairAnchor at scalp top.
 */
export function ProceduralHair({ style, length, color, volume }: Props) {
  const group = useRef<THREE.Group>(null);
  const strandMap = useMemo(() => makeStrandTexture(), []);

  const mats = useMemo(() => {
    const base = new THREE.Color(color);
    const highlight = base.clone().offsetHSL(0.02, 0.08, 0.22);
    return new THREE.MeshPhysicalMaterial({
      map: strandMap,
      alphaMap: strandMap,
      color: base,
      roughness: 0.42,
      metalness: 0.02,
      sheen: 1,
      sheenRoughness: 0.22,
      sheenColor: highlight,
      clearcoat: 0.18,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.7,
      transparent: true,
      alphaTest: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, [color, strandMap]);

  const solidMat = useMemo(() => {
    const base = new THREE.Color(color);
    return new THREE.MeshPhysicalMaterial({
      color: base,
      roughness: 0.45,
      metalness: 0.03,
      sheen: 0.85,
      sheenRoughness: 0.3,
      sheenColor: base.clone().offsetHSL(0.02, 0.05, 0.15),
      clearcoat: 0.15,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.5,
      side: THREE.DoubleSide,
    });
  }, [color]);

  const cards = useMemo((): CardSpec[] => {
    if (style === "none") return [];
    const vol = 0.72 + volume * 0.4;
    const len = 0.18 + length * 0.75;
    const long = style === "long";
    const mediumish = style === "medium" || long;
    const list: CardSpec[] = [];

    // Smaller crown ring — cup scalp without covering forehead/face
    const crownN = long ? 8 : style === "short" || style === "pixie" ? 6 : 7;
    for (let i = 0; i < crownN; i++) {
      const a = (i / crownN) * Math.PI * 2;
      // Bias slightly rearward so front face stays clear
      const r = 0.042 * vol;
      list.push({
        key: `crown-${i}`,
        pos: [Math.sin(a) * r, 0.015, Math.cos(a) * r - 0.02],
        rot: [0.12 + Math.cos(a) * 0.06, a, Math.sin(a) * 0.08],
        scale: [0.06 * vol, 0.07 + volume * 0.03, 1],
      });
    }

    // Light fringe only — short bangs that don't obliterate the face
    if (style !== "bun" && style !== "pixie") {
      for (let i = -1; i <= 1; i++) {
        list.push({
          key: `bang-${i}`,
          pos: [i * 0.022 * vol, -0.01, 0.06],
          rot: [0.55 + Math.abs(i) * 0.03, i * 0.03, i * 0.05],
          scale: [0.038 * vol, 0.055 + volume * 0.03, 1],
        });
      }
    }

    if (style === "short" || style === "pixie") {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        list.push({
          key: `short-${i}`,
          pos: [
            Math.sin(a) * 0.055 * vol,
            -0.005,
            Math.cos(a) * 0.05 * vol - 0.025,
          ],
          rot: [0.3, a, 0],
          scale: [0.05 * vol, 0.055 + length * 0.04, 1],
        });
      }
      return list;
    }

    if (style === "bun") {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        list.push({
          key: `bun-side-${i}`,
          pos: [
            Math.sin(a) * 0.06 * vol,
            -0.01,
            Math.cos(a) * 0.055 * vol - 0.025,
          ],
          rot: [0.35, a, 0],
          scale: [0.045 * vol, 0.07, 1],
        });
      }
      return list;
    }

    if (mediumish) {
      const sideLayers = long ? 3 : 2;
      for (let layer = 0; layer < sideLayers; layer++) {
        for (const side of [-1, 1] as const) {
          const t = layer / Math.max(1, sideLayers - 1);
          list.push({
            key: `side-${side}-${layer}`,
            pos: [
              side * (0.08 + layer * 0.01) * vol,
              -0.03 - t * len * 0.45,
              0.0 - t * 0.03,
            ],
            rot: [0.2 + t * 0.3, side * 0.1, side * (0.3 + t * 0.2)],
            scale: [
              0.05 * vol * (1 - t * 0.12),
              len * (long ? 0.7 : 0.45) * (0.9 + t * 0.15),
              1,
            ],
          });
        }
      }

      const backN = long ? 5 : 3;
      for (let i = 0; i < backN; i++) {
        const u = (i / (backN - 1)) * 2 - 1;
        const t = Math.abs(u);
        list.push({
          key: `back-${i}`,
          pos: [
            u * 0.055 * vol,
            -0.04 - (long ? 0.08 : 0.03) * len,
            -0.075 + t * 0.015,
          ],
          rot: [0.35 + (long ? 0.15 : 0.08), u * 0.12, u * 0.15],
          scale: [0.055 * vol * (1 - t * 0.15), len * (long ? 0.85 : 0.55), 1],
        });
      }

      if (long) {
        for (const side of [-1, 1] as const) {
          list.push({
            key: `wave-${side}`,
            pos: [side * 0.095 * vol, -0.16 * len, -0.01],
            rot: [0.5, side * 0.04, side * 0.5],
            scale: [0.04 * vol, 0.28 * len, 1],
          });
        }
      }
    }

    return list;
  }, [style, length, volume]);

  if (style === "none") return null;

  const vol = 0.72 + volume * 0.4;

  return (
    <group ref={group} position={[0, -0.015, 0]} name="MuseProceduralHair">
      {/* Compact scalp fill — sits on crown, leaves forehead/face clear */}
      <mesh
        castShadow
        position={[0, 0.005, -0.02]}
        scale={[0.95 * vol, 0.88, 1.0 * vol]}
      >
        <sphereGeometry
          args={[0.1, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.48]}
        />
        <primitive object={solidMat} attach="material" />
      </mesh>

      {cards.map((c) => (
        <mesh
          key={c.key}
          castShadow
          position={c.pos}
          rotation={c.rot}
          scale={c.scale}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1, 1, 2]} />
          <primitive object={mats.clone()} attach="material" />
        </mesh>
      ))}

      {style === "bun" && (
        <mesh castShadow position={[0, 0.1, -0.045]} scale={[vol, vol, vol]}>
          <sphereGeometry args={[0.065 + length * 0.025, 20, 16]} />
          <primitive object={solidMat.clone()} attach="material" />
        </mesh>
      )}
    </group>
  );
}
