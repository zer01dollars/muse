"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type HairStyle = "none" | "short" | "medium" | "long" | "bun" | "pixie";
export type PosePreset = "Neutral" | "Confident" | "Wave" | "Three-quarter";

export interface TwinParams {
  // Face
  faceWidth: number;
  jaw: number;
  chin: number;
  cheekbones: number;
  noseWidth: number;
  noseLength: number;
  lipFullness: number;
  eyeSize: number;
  eyeSpacing: number;
  brow: number;
  // Body
  height: number;
  shoulders: number;
  chest: number;
  waist: number;
  hips: number;
  arms: number;
  legs: number;
  muscle: number;
  // Skin
  skinTone: number; // 0–1 hue-ish lightness/warmth blend
  undertone: number; // -1 cool … 1 warm
  freckles: number;
  gloss: number;
  // Hair
  hairStyle: HairStyle;
  hairLength: number;
  hairColor: string;
  hairVolume: number;
  // Eyes
  irisColor: string;
  eyeOpenness: number;
  // Pose
  rotateY: number;
  armL: number;
  armR: number;
  torsoLean: number;
  posePreset: PosePreset;
}

export const DEFAULT_TWIN: TwinParams = {
  faceWidth: 0.5,
  jaw: 0.5,
  chin: 0.5,
  cheekbones: 0.5,
  noseWidth: 0.5,
  noseLength: 0.5,
  lipFullness: 0.5,
  eyeSize: 0.5,
  eyeSpacing: 0.5,
  brow: 0.5,
  height: 0.5,
  shoulders: 0.5,
  chest: 0.5,
  waist: 0.5,
  hips: 0.5,
  arms: 0.5,
  legs: 0.5,
  muscle: 0.35,
  skinTone: 0.45,
  undertone: 0.15,
  freckles: 0.1,
  gloss: 0.35,
  hairStyle: "medium",
  hairLength: 0.55,
  hairColor: "#2a1a12",
  hairVolume: 0.55,
  irisColor: "#3d5a3a",
  eyeOpenness: 0.85,
  rotateY: 0,
  armL: 0,
  armR: 0,
  torsoLean: 0,
  posePreset: "Neutral",
};

export type BuildStatus = "idle" | "loading" | "detecting" | "mapping" | "ready" | "error";

interface TwinState {
  params: TwinParams;
  setParam: <K extends keyof TwinParams>(key: K, value: TwinParams[K]) => void;
  setParams: (partial: Partial<TwinParams>) => void;
  resetParams: () => void;
  applyPosePreset: (preset: PosePreset) => void;

  selfies: string[]; // object URLs
  addSelfie: (url: string) => void;
  removeSelfie: (index: number) => void;
  clearSelfies: () => void;

  buildStatus: BuildStatus;
  buildProgress: number;
  buildMessage: string;
  setBuildProgress: (status: BuildStatus, progress: number, message: string) => void;

  twinReady: boolean;
  setTwinReady: (v: boolean) => void;

  proUnlocked: boolean;
  unlockPro: () => void;

  mobileWarned: boolean;
  setMobileWarned: (v: boolean) => void;
}

const POSE_PRESETS: Record<PosePreset, Partial<TwinParams>> = {
  Neutral: { rotateY: 0, armL: 0, armR: 0, torsoLean: 0 },
  Confident: { rotateY: 0.25, armL: -0.15, armR: -0.15, torsoLean: 0.08 },
  Wave: { rotateY: -0.2, armL: 0, armR: 1.1, torsoLean: -0.05 },
  "Three-quarter": { rotateY: 0.55, armL: 0.1, armR: -0.05, torsoLean: 0.12 },
};

export const useTwinStore = create<TwinState>()(
  persist(
    (set) => ({
      params: { ...DEFAULT_TWIN },
      setParam: (key, value) =>
        set((s) => ({ params: { ...s.params, [key]: value } })),
      setParams: (partial) =>
        set((s) => ({ params: { ...s.params, ...partial } })),
      resetParams: () => set({ params: { ...DEFAULT_TWIN } }),
      applyPosePreset: (preset) =>
        set((s) => ({
          params: {
            ...s.params,
            ...POSE_PRESETS[preset],
            posePreset: preset,
          },
        })),

      selfies: [],
      addSelfie: (url) =>
        set((s) => ({
          selfies: s.selfies.length >= 3 ? s.selfies : [...s.selfies, url],
        })),
      removeSelfie: (index) =>
        set((s) => ({
          selfies: s.selfies.filter((_, i) => i !== index),
        })),
      clearSelfies: () => set({ selfies: [] }),

      buildStatus: "idle",
      buildProgress: 0,
      buildMessage: "",
      setBuildProgress: (status, progress, message) =>
        set({ buildStatus: status, buildProgress: progress, buildMessage: message }),

      twinReady: true,  // show body immediately — no capsule stub
      setTwinReady: (v) => set({ twinReady: v }),

      proUnlocked: false,
      unlockPro: () => set({ proUnlocked: true }),

      mobileWarned: false,
      setMobileWarned: (v) => set({ mobileWarned: v }),
    }),
    {
      name: "muse-twin-v3",
      partialize: (s) => ({
        params: s.params,
        proUnlocked: s.proUnlocked,
      }),
    }
  )
);

/** Map skinTone 0–1 + undertone to a hex skin color */
export function skinColorFromParams(tone: number, undertone: number): string {
  // tone: deep → fair (value), undertone: cool → warm (hue shift)
  const lightness = 0.28 + tone * 0.48;
  const warmth = undertone; // -1..1
  const r = Math.min(255, Math.round((0.55 + warmth * 0.12 + lightness * 0.55) * 255 * (0.7 + tone * 0.35)));
  const g = Math.min(255, Math.round((0.38 + lightness * 0.5 - Math.abs(warmth) * 0.04) * 255 * (0.65 + tone * 0.4)));
  const b = Math.min(255, Math.round((0.28 - warmth * 0.1 + lightness * 0.42) * 255 * (0.6 + tone * 0.45)));
  const clamp = (n: number) => Math.max(40, Math.min(245, n));
  return `#${[clamp(r), clamp(g), clamp(b)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
