"use client";

import { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center, Html } from "@react-three/drei";
import { StudioLights } from "@/components/twin/StudioEnvironment";
import { TwinAvatar } from "@/components/twin/TwinAvatar";

export type CanvasHandle = { gl: HTMLCanvasElement | null };

export function TwinCanvas({
  canvasRef,
}: {
  canvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
}) {
  const localRef = useRef<HTMLCanvasElement | null>(null);

  return (
    <div className="relative h-full w-full min-h-[320px] rounded-2xl overflow-hidden bg-[#07070c] ring-1 ring-white/10">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 1.35, 2.6], fov: 35, near: 0.1, far: 50 }}
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
        <Suspense
          fallback={
            <Html center>
              <div className="text-xs tracking-[0.2em] uppercase text-violet-200/80">
                Loading twin…
              </div>
            </Html>
          }
        >
          <StudioLights />
          <Center top position={[0, 0, 0]}>
            <TwinAvatar />
          </Center>
          <OrbitControls
            makeDefault
            enablePan={false}
            minPolarAngle={Math.PI * 0.25}
            maxPolarAngle={Math.PI * 0.55}
            minDistance={1.4}
            maxDistance={4.5}
            target={[0, 1.1, 0]}
          />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
      <div className="pointer-events-none absolute left-4 top-4 text-[10px] tracking-[0.25em] uppercase text-amber-200/50">
        Muse Studio
      </div>
    </div>
  );
}
