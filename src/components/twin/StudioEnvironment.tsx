"use client";

import { Environment, ContactShadows, AccumulativeShadows, RandomizedLight } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

export function StudioToneMapping() {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
  }, [gl]);
  return null;
}

export function StudioLights() {
  return (
    <>
      <StudioToneMapping />
      <color attach="background" args={["#07070c"]} />
      <fog attach="fog" args={["#07070c", 6, 16]} />
      <ambientLight intensity={0.22} color="#c8b8ff" />
      <directionalLight
        castShadow
        position={[2.5, 5.5, 2]}
        intensity={1.35}
        color="#fff5e8"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={20}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-3, 2, -2]} intensity={0.45} color="#8b6cff" />
      <spotLight
        position={[0, 4, 3]}
        angle={0.45}
        penumbra={0.7}
        intensity={0.8}
        color="#ffe6c8"
        castShadow
      />
      <Environment preset="studio" environmentIntensity={0.55} />
      <AccumulativeShadows
        temporal
        frames={48}
        color="#1a1028"
        colorBlend={1.6}
        opacity={0.55}
        scale={8}
        position={[0, 0.001, 0]}
      >
        <RandomizedLight
          amount={6}
          radius={3}
          ambient={0.4}
          intensity={1.1}
          position={[2, 4.5, 2]}
          bias={0.001}
        />
      </AccumulativeShadows>
      <ContactShadows
        position={[0, 0.002, 0]}
        opacity={0.45}
        scale={8}
        blur={2.4}
        far={4}
        color="#000000"
      />
      {/* soft ground disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[3.2, 64]} />
        <meshStandardMaterial color="#0c0c14" metalness={0.2} roughness={0.85} />
      </mesh>
    </>
  );
}
