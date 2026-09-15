"use client";

import { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  SMAA,
  N8AO,
} from "@react-three/postprocessing";
import { StudioLights } from "@/components/twin/StudioEnvironment";
import { TwinAvatar, TwinLoadingFallback } from "@/components/twin/TwinAvatar";

export type CanvasHandle = { gl: HTMLCanvasElement | null };

function StudioPostFX() {
  // Mild AO/bloom — aggressive N8AO was crushing albedo into gray mush
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO
        aoRadius={0.35}
        intensity={0.42}
        distanceFalloff={1.1}
        quality="medium"
        halfRes
        color="#1a1220"
      />
      <Bloom
        luminanceThreshold={0.9}
        luminanceSmoothing={0.4}
        intensity={0.22}
        mipmapBlur
      />
      <Vignette offset={0.32} darkness={0.35} />
      <SMAA />
    </EffectComposer>
  );
}

export function TwinCanvas({
  canvasRef,
}: {
  canvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
}) {
  const localRef = useRef<HTMLCanvasElement | null>(null);

  return (
    <div className="relative h-full w-full min-h-[320px] overflow-hidden rounded-2xl bg-[#06060a] ring-1 ring-white/10">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0.12, 1.48, 2.05], fov: 30, near: 0.1, far: 50 }}
        gl={{
          preserveDrawingBuffer: true,
          antialias: false, // SMAA handles AA; avoids MSAA+post conflict
          powerPreference: "high-performance",
          stencil: false,
        }}
        onCreated={({ gl }) => {
          const el = gl.domElement;
          localRef.current = el;
          if (canvasRef) canvasRef.current = el;
        }}
      >
        <Suspense fallback={<TwinLoadingFallback />}>
          <StudioLights />
          <TwinAvatar />
          <OrbitControls
            makeDefault
            enablePan={false}
            minPolarAngle={Math.PI * 0.35}
            maxPolarAngle={Math.PI * 0.58}
            minDistance={1.2}
            maxDistance={3.8}
            target={[0, 1.35, 0]}
          />
          <StudioPostFX />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
      <div className="pointer-events-none absolute left-4 top-4 text-[10px] uppercase tracking-[0.25em] text-amber-200/50">
        Muse Studio
      </div>
    </div>
  );
}
