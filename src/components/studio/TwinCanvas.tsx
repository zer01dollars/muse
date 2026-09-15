"use client";

import { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { StudioLights } from "@/components/twin/StudioEnvironment";
import { TwinAvatar, TwinLoadingFallback } from "@/components/twin/TwinAvatar";

export type CanvasHandle = { gl: HTMLCanvasElement | null };

export function TwinCanvas({
  canvasRef,
}: {
  canvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
}) {
  const localRef = useRef<HTMLCanvasElement | null>(null);

  return (
    <div className="relative h-full w-full min-h-[320px] overflow-hidden rounded-2xl bg-[#07070c] ring-1 ring-white/10">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 1.2, 2.8], fov: 35, near: 0.1, far: 50 }}
        gl={{
          preserveDrawingBuffer: true,
          antialias: true,
          powerPreference: "high-performance",
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
            minPolarAngle={Math.PI * 0.28}
            maxPolarAngle={Math.PI * 0.52}
            minDistance={1.6}
            maxDistance={4.2}
            target={[0, 1.0, 0]}
          />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
      <div className="pointer-events-none absolute left-4 top-4 text-[10px] uppercase tracking-[0.25em] text-amber-200/50">
        Muse Studio
      </div>
    </div>
  );
}
