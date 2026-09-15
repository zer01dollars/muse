import type { TwinParams } from "@/store/twinStore";

/** MediaPipe Face Landmarker landmark indices (478 with iris). */
const L = {
  // face oval
  leftCheek: 234,
  rightCheek: 454,
  chin: 152,
  forehead: 10,
  // jaw
  jawLeft: 172,
  jawRight: 397,
  // nose
  noseTip: 1,
  noseBridge: 6,
  noseLeft: 98,
  noseRight: 327,
  // lips
  upperLip: 13,
  lowerLip: 14,
  mouthLeft: 61,
  mouthRight: 291,
  // eyes
  leftEyeOuter: 33,
  leftEyeInner: 133,
  leftEyeTop: 159,
  leftEyeBot: 145,
  rightEyeOuter: 263,
  rightEyeInner: 362,
  rightEyeTop: 386,
  rightEyeBot: 374,
  // brows
  leftBrowInner: 107,
  leftBrowOuter: 70,
  rightBrowInner: 336,
  rightBrowOuter: 300,
  // iris (when available)
  leftIris: 468,
  rightIris: 473,
} as const;

type Pt = { x: number; y: number; z?: number };

function dist(a: Pt, b: Pt) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.hypot(dx, dy, dz);
}

function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z ?? 0) + (b.z ?? 0)) / 2 };
}

/** Normalize raw ratio into 0–1 slider space around 0.5 */
function norm(value: number, lo: number, hi: number) {
  const t = (value - lo) / (hi - lo);
  return Math.max(0, Math.min(1, t));
}

/**
 * Derive Muse twin face/body-ish params from MediaPipe landmarks.
 * Values are normalized to ~0.5 for an average face.
 */
export function metricsFromLandmarks(
  landmarks: Pt[]
): Partial<TwinParams> {
  if (!landmarks || landmarks.length < 468) {
    // Still try with 468 without iris
    if (!landmarks || landmarks.length < 400) return {};
  }

  const faceW = dist(landmarks[L.leftCheek], landmarks[L.rightCheek]);
  const faceH = dist(landmarks[L.forehead], landmarks[L.chin]);
  const aspect = faceW / Math.max(faceH, 1e-6);

  const jawW = dist(landmarks[L.jawLeft], landmarks[L.jawRight]);
  const jawRatio = jawW / Math.max(faceW, 1e-6);

  const chinDrop =
    dist(mid(landmarks[L.jawLeft], landmarks[L.jawRight]), landmarks[L.chin]) /
    Math.max(faceH, 1e-6);

  const cheekY =
    (landmarks[L.leftCheek].y + landmarks[L.rightCheek].y) / 2 -
    landmarks[L.forehead].y;
  const cheekRel = cheekY / Math.max(faceH, 1e-6);

  const noseW = dist(landmarks[L.noseLeft], landmarks[L.noseRight]) / Math.max(faceW, 1e-6);
  const noseLen =
    dist(landmarks[L.noseBridge], landmarks[L.noseTip]) / Math.max(faceH, 1e-6);

  const lipH = dist(landmarks[L.upperLip], landmarks[L.lowerLip]) / Math.max(faceH, 1e-6);
  const mouthW = dist(landmarks[L.mouthLeft], landmarks[L.mouthRight]) / Math.max(faceW, 1e-6);

  const leftEyeW = dist(landmarks[L.leftEyeOuter], landmarks[L.leftEyeInner]);
  const rightEyeW = dist(landmarks[L.rightEyeOuter], landmarks[L.rightEyeInner]);
  const eyeSize = ((leftEyeW + rightEyeW) / 2) / Math.max(faceW, 1e-6);

  const leftEyeH = dist(landmarks[L.leftEyeTop], landmarks[L.leftEyeBot]);
  const rightEyeH = dist(landmarks[L.rightEyeTop], landmarks[L.rightEyeBot]);
  const eyeOpen =
    ((leftEyeH + rightEyeH) / 2) / Math.max((leftEyeW + rightEyeW) / 2, 1e-6);

  const eyeSpacing =
    dist(
      mid(landmarks[L.leftEyeOuter], landmarks[L.leftEyeInner]),
      mid(landmarks[L.rightEyeOuter], landmarks[L.rightEyeInner])
    ) / Math.max(faceW, 1e-6);

  const browLeftY = (landmarks[L.leftBrowInner].y + landmarks[L.leftBrowOuter].y) / 2;
  const browRightY = (landmarks[L.rightBrowInner].y + landmarks[L.rightBrowOuter].y) / 2;
  const eyeLineY =
    (landmarks[L.leftEyeTop].y + landmarks[L.rightEyeTop].y) / 2;
  const browGap = (eyeLineY - (browLeftY + browRightY) / 2) / Math.max(faceH, 1e-6);

  // Rough skin tone from average landmark isn't available — leave tone alone.
  // Estimate shoulder proxy from face width (very soft heuristic).
  const shoulders = norm(aspect, 0.65, 0.95);

  return {
    faceWidth: norm(aspect, 0.68, 0.92),
    jaw: norm(jawRatio, 0.62, 0.88),
    chin: norm(chinDrop, 0.08, 0.22),
    cheekbones: norm(cheekRel, 0.35, 0.55),
    noseWidth: norm(noseW, 0.12, 0.28),
    noseLength: norm(noseLen, 0.12, 0.28),
    lipFullness: norm(lipH * 2 + mouthW * 0.3, 0.04, 0.14),
    eyeSize: norm(eyeSize, 0.12, 0.22),
    eyeSpacing: norm(eyeSpacing, 0.28, 0.42),
    brow: norm(browGap, 0.04, 0.12),
    eyeOpenness: norm(eyeOpen, 0.15, 0.45),
    shoulders,
  };
}

/** Average multiple selfie metric runs */
export function averageMetrics(
  runs: Partial<TwinParams>[]
): Partial<TwinParams> {
  if (!runs.length) return {};
  const keys = Object.keys(runs[0]!) as (keyof TwinParams)[];
  const out: Partial<TwinParams> = {};
  for (const k of keys) {
    const vals = runs
      .map((r) => r[k])
      .filter((v): v is number => typeof v === "number");
    if (vals.length) {
      (out as Record<string, number>)[k as string] =
        vals.reduce((a, b) => a + b, 0) / vals.length;
    }
  }
  return out;
}
