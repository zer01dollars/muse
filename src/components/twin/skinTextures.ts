"use client";

import * as THREE from "three";

export const FACE_ALBEDO_URL = "/models/vit_face_bc.png";
export const BODY_ALBEDO_URL = "/models/vit_body_bc.png";

/** Prep albedo for GLB UVs + PBR — call once after useTexture resolves. */
export function prepSkinTexture(tex: THREE.Texture, anisotropy = 16) {
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

export function prepSkinTextures(
  face: THREE.Texture,
  body: THREE.Texture,
  maxAnisotropy = 16
) {
  prepSkinTexture(face, maxAnisotropy);
  prepSkinTexture(body, maxAnisotropy);
  console.info("[Muse] skin maps loaded", {
    face: `${(face.image as HTMLImageElement | undefined)?.width ?? "?"}x${
      (face.image as HTMLImageElement | undefined)?.height ?? "?"
    }`,
    body: `${(body.image as HTMLImageElement | undefined)?.width ?? "?"}x${
      (body.image as HTMLImageElement | undefined)?.height ?? "?"
    }`,
    flipY: face.flipY,
    via: "useTexture",
  });
}
