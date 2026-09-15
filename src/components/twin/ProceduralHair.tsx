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

/** Canvas-generated strand alpha — soft vertical fibers for hair cards. */
function makeStrandTexture(): THREE.CanvasTexture {
  const w = 64;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Transparent base
  ctx.clearRect(0, 0, w, h);

  // Soft vertical density falloff (root → tip)
  for (let x = 0; x < w; x++) {
    const nx = (x + 0.5) / w;
    const edge = Math.sin(nx * Math.PI); // soft side fade
    for (let y = 0; y < h; y++) {
      const ny = y / h;
      // Strand noise — thin vertical lines
      const strand =
        0.55 +
        0.45 * Math.sin(x * 1.7 + Math.sin(y * 0.08) * 2.2) *
          Math.sin(x * 0.55 + 1.3);
      const tipFade = 1 - Math.pow(ny, 1.35) * 0.55;
      const rootBoost = 0.75 + (1 - ny) * 0.25;
      const a = Math.max(0, Math.min(1, strand * edge * tipFade * rootBoost));
      const shade = Math.floor(180 + strand * 60);
      ctx.fillStyle = `rgba(${shade},${shade - 8},${shade - 20},${a})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // A few brighter highlight streaks
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 5; i++) {
    const x = 8 + i * 11 + (i % 2) * 3;
    const grad = ctx.createLinearGradient(x, 0, x, h);
    grad.addColorStop(0, "rgba(255,240,210,0.35)");
    grad.addColorStop(0.5, "rgba(255,230,190,0.12)");
    grad.addColorStop(1, "rgba(255,220,170,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, 2, h);
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
 * Layered hair *cards* (alpha planes) around the scalp —
 * far more photoreal than capsule blobs while staying procedural.
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
      alphaTest: 0.12,
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
    const vol = 0.78 + volume * 0.55;
    const len = 0.22 + length * 0.95;
    const long = style === "long";
    const mediumish = style === "medium" || long;
    const list: CardSpec[] = [];

    // Crown ring — overlapping cards cup the scalp
    const crownN = long ? 14 : style === "short" || style === "pixie" ? 10 : 12;
    for (let i = 0; i < crownN; i++) {
      const a = (i / crownN) * Math.PI * 2;
      const r = 0.055 * vol;
      list.push({
        key: `crown-${i}`,
        pos: [Math.sin(a) * r, 0.02, Math.cos(a) * r - 0.01],
        rot: [0.15 + Math.cos(a) * 0.08, a, Math.sin(a) * 0.12],
        scale: [0.09 * vol, 0.1 + volume * 0.04, 1],
      });
    }

    // Fringe / bangs
    if (style !== "bun") {
      for (let i = -3; i <= 3; i++) {
        list.push({
          key: `bang-${i}`,
          pos: [i * 0.028 * vol, -0.02, 0.08],
          rot: [0.75 + Math.abs(i) * 0.04, i * 0.04, i * 0.08],
          scale: [0.055 * vol, 0.09 + volume * 0.05, 1],
        });
      }
    }

    if (style === "short" || style === "pixie") {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        list.push({
          key: `short-${i}`,
          pos: [Math.sin(a) * 0.07 * vol, -0.01, Math.cos(a) * 0.06 * vol - 0.02],
          rot: [0.35, a, 0],
          scale: [0.07 * vol, 0.08 + length * 0.06, 1],
        });
      }
      return list;
    }

    if (style === "bun") {
      // Tight sides + bun mass uses solid sphere separately
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        list.push({
          key: `bun-side-${i}`,
          pos: [Math.sin(a) * 0.08 * vol, -0.02, Math.cos(a) * 0.07 * vol - 0.02],
          rot: [0.4, a, 0],
          scale: [0.065 * vol, 0.1, 1],
        });
      }
      return list;
    }

    if (mediumish) {
      // Side cascades
      const sideLayers = long ? 5 : 3;
      for (let layer = 0; layer < sideLayers; layer++) {
        for (const side of [-1, 1]) {
          const t = layer / Math.max(1, sideLayers - 1);
          list.push({
            key: `side-${side}-${layer}`,
            pos: [
              side * (0.09 + layer * 0.012) * vol,
              -0.04 - t * len * 0.55,
              0.02 - t * 0.04,
            ],
            rot: [
              0.25 + t * 0.35,
              side * 0.12,
              side * (0.35 + t * 0.25),
            ],
            scale: [
              0.07 * vol * (1 - t * 0.15),
              len * (long ? 0.85 : 0.55) * (0.9 + t * 0.2),
              1,
            ],
          });
        }
      }

      // Back curtain
      const backN = long ? 9 : 5;
      for (let i = 0; i < backN; i++) {
        const u = (i / (backN - 1)) * 2 - 1;
        const t = Math.abs(u);
        list.push({
          key: `back-${i}`,
          pos: [u * 0.07 * vol, -0.06 - (long ? 0.12 : 0.05) * len, -0.09 + t * 0.02],
          rot: [0.4 + (long ? 0.2 : 0.1), u * 0.15, u * 0.2],
          scale: [
            0.075 * vol * (1 - t * 0.2),
            len * (long ? 1.05 : 0.7),
            1,
          ],
        });
      }

      // Extra long tips / shoulder waves
      if (long) {
        for (const side of [-1, 1]) {
          for (let k = 0; k < 3; k++) {
            list.push({
              key: `wave-${side}-${k}`,
              pos: [
                side * (0.1 + k * 0.015) * vol,
                -0.22 * len - k * 0.04,
                0.0 + k * 0.01,
              ],
              rot: [0.55 + k * 0.08, side * 0.05, side * (0.55 + k * 0.1)],
              scale: [0.055 * vol, 0.35 * len, 1],
            });
          }
        }
      }
    }

    return list;
  }, [style, length, volume]);

  if (style === "none") return null;

  const vol = 0.78 + volume * 0.55;

  return (
    <group ref={group} position={[0, -0.02, 0.01]} name="MuseProceduralHair">
      {/* Opaque scalp fill — prevents bald skull peeking through cards */}
      <mesh castShadow position={[0, 0.01, -0.01]} scale={[1.15 * vol, 1.02, 1.2 * vol]}>
        <sphereGeometry args={[0.115, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
        <primitive object={solidMat} attach="material" />
      </mesh>
      <mesh castShadow position={[0, -0.015, -0.005]} scale={[1.05 * vol, 0.65, 1.08 * vol]}>
        <sphereGeometry args={[0.108, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <primitive object={solidMat.clone()} attach="material" />
      </mesh>

      {/* Hair cards */}
      {cards.map((c) => (
        <mesh
          key={c.key}
          castShadow
          position={c.pos}
          rotation={c.rot}
          scale={c.scale}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1, 1, 4]} />
          <primitive object={mats.clone()} attach="material" />
        </mesh>
      ))}

      {style === "bun" && (
        <>
          <mesh castShadow position={[0, 0.12, -0.05]} scale={[vol, vol, vol]}>
            <sphereGeometry args={[0.075 + length * 0.03, 24, 20]} />
            <primitive object={solidMat.clone()} attach="material" />
          </mesh>
          <mesh
            castShadow
            position={[0, 0.02, -0.02]}
            scale={[1.05 * vol, 0.85, 1.08 * vol]}
          >
            <sphereGeometry args={[0.11, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <primitive object={solidMat.clone()} attach="material" />
          </mesh>
        </>
      )}
    </group>
  );
}
