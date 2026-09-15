"use client";

import * as THREE from "three";

let faceMap: THREE.Texture | null = null;
let bodyMap: THREE.Texture | null = null;
let loading: Promise<[THREE.Texture, THREE.Texture]> | null = null;

function prep(tex: THREE.Texture, anisotropy = 16) {
  tex.colorSpace = THREE.SRGBColorSpace;
  // GLB UVs expect flipY=false (same as embedded GLTF textures)
  tex.flipY = false;
  tex.anisotropy = anisotropy;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** Shared high-res Vitruvian albedo maps (CC0). Safe to reuse across clones. */
export function loadSkinTextures(
  maxAnisotropy = 16
): Promise<[THREE.Texture, THREE.Texture]> {
  if (faceMap && bodyMap) {
    faceMap.anisotropy = maxAnisotropy;
    bodyMap.anisotropy = maxAnisotropy;
    return Promise.resolve([faceMap, bodyMap]);
  }
  if (loading) return loading;

  const loader = new THREE.TextureLoader();
  loading = Promise.all([
    loader.loadAsync("/models/vit_face_bc.png"),
    loader.loadAsync("/models/vit_body_bc.png"),
  ]).then(([face, body]) => {
    faceMap = prep(face, maxAnisotropy);
    bodyMap = prep(body, maxAnisotropy);
    return [faceMap, bodyMap] as [THREE.Texture, THREE.Texture];
  });
  return loading;
}

export function getSkinTextures(): {
  face: THREE.Texture | null;
  body: THREE.Texture | null;
} {
  return { face: faceMap, body: bodyMap };
}
