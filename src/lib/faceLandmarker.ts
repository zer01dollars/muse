"use client";

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { averageMetrics, metricsFromLandmarks } from "@/lib/faceMetrics";
import type { TwinParams } from "@/store/twinStore";

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load selfie"));
    img.src = url;
  });
}

export async function detectFace(
  imageUrl: string
): Promise<FaceLandmarkerResult> {
  const landmarker = await getFaceLandmarker();
  const img = await loadImage(imageUrl);
  return landmarker.detect(img);
}

export type BuildProgressFn = (
  status: "loading" | "detecting" | "mapping" | "ready" | "error",
  progress: number,
  message: string
) => void;

/**
 * Run Face Landmarker on 1–3 selfies and map landmarks → twin face params.
 */
export async function buildTwinFromSelfies(
  selfieUrls: string[],
  onProgress?: BuildProgressFn
): Promise<Partial<TwinParams>> {
  if (!selfieUrls.length) {
    throw new Error("Add at least one selfie");
  }

  onProgress?.("loading", 8, "Loading Face Landmarker…");
  await getFaceLandmarker();
  onProgress?.("loading", 22, "Vision model ready");

  const runs: Partial<TwinParams>[] = [];
  for (let i = 0; i < selfieUrls.length; i++) {
    const pct = 25 + Math.round((i / selfieUrls.length) * 50);
    onProgress?.(
      "detecting",
      pct,
      `Analyzing selfie ${i + 1} of ${selfieUrls.length}…`
    );
    const result = await detectFace(selfieUrls[i]!);
    const face = result.faceLandmarks?.[0];
    if (!face?.length) {
      continue;
    }
    runs.push(metricsFromLandmarks(face));
  }

  if (!runs.length) {
    onProgress?.("error", 100, "No face detected — try a clearer frontal selfie");
    throw new Error("No face detected in selfies");
  }

  onProgress?.("mapping", 85, "Mapping facial metrics to your twin…");
  // slight delay for premium feel
  await new Promise((r) => setTimeout(r, 420));
  const averaged = averageMetrics(runs);
  onProgress?.("ready", 100, "Twin ready — refine with sliders");
  return averaged;
}
