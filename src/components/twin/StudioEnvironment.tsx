"use client";

import {
  Environment,
  ContactShadows,
  } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

export function StudioToneMapping() {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    // Slightly lifted for skin — photoreal albedo reads better warm
    gl.toneMappingExposure = 1.18;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFShadowMap;
  }, [gl]);
  return null;
}

/** Beauty / product lighting — soft key, cool fill, warm rim */
export function StudioLights() {
  return (
    <>
      <StudioToneMapping />
      <color attach="background" args={["#06060a"]} />
      <fog attach="fog" args={["#06060a", 7, 18]} />

      {/* Soft ambient — lavender cool lift */}
      <ambientLight intensity={0.28} color="#d4c8f0" />
      <hemisphereLight
        intensity={0.38}
        color="#fff4ea"
        groundColor="#1a1428"
      />

      {/* Key — soft warm beauty light (high, slightly camera-right) */}
      <directionalLight
        castShadow
        position={[2.2, 5.8, 3.2]}
        intensity={1.15}
        color="#fff2e4"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={22}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.00015}
        shadow-radius={6}
      />

      {/* Fill — cooler, lower intensity (camera-left) */}
      <directionalLight
        position={[-3.2, 2.4, 1.5]}
        intensity={0.38}
        color="#a898ff"
      />

      {/* Rim / hair light — warm backlight for separation */}
      <directionalLight
        position={[-1.5, 3.5, -3.5]}
        intensity={0.55}
        color="#ffd6b0"
      />

      {/* Soft face spot */}
      <spotLight
        position={[0.4, 3.8, 3.2]}
        angle={0.42}
        penumbra={0.85}
        intensity={0.78}
        color="#ffe8d0"
        castShadow={false}
      />

      {/* Subtle under-fill so jaw/neck don't crush to black */}
      <pointLight position={[0, 0.6, 1.2]} intensity={0.22} color="#e8d4ff" distance={5} />

      <Environment preset="studio" environmentIntensity={0.72} />

      <ContactShadows
        position={[0, 0.002, 0]}
        opacity={0.45}
        scale={8}
        blur={2.2}
        far={4.5}
        color="#000000"
        frames={1}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[3.4, 64]} />
        <meshStandardMaterial color="#0a0a12" metalness={0.25} roughness={0.82} />
      </mesh>
    </>
  );
}
