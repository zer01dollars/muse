"use client";

import { useState } from "react";
import {
  useTwinStore,
  type HairStyle,
  type PosePreset,
  type TwinParams,
} from "@/store/twinStore";

function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-amber-100/80">
          {title}
        </span>
        <span className="text-white/40">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="space-y-3 border-t border-white/5 px-3 py-3">{children}</div>}
    </div>
  );
}

function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-[11px] text-white/55">
        <span>{label}</span>
        <span className="tabular-nums text-white/35">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="muse-range w-full"
      />
    </label>
  );
}


export function ControlPanel() {
  const params = useTwinStore((s) => s.params);
  const setParam = useTwinStore((s) => s.setParam);
  const applyPosePreset = useTwinStore((s) => s.applyPosePreset);
  const resetParams = useTwinStore((s) => s.resetParams);
  const [open, setOpen] = useState<string>("Face");

  const num = (key: keyof TwinParams) => (
    <Slider
      label={String(key)}
      value={params[key] as number}
      onChange={(v) => setParam(key, v as never)}
    />
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-xl text-white">Refine</h2>
          <p className="mt-1 text-xs text-white/45">Precision controls for your twin</p>
        </div>
        <button
          type="button"
          onClick={resetParams}
          className="rounded-lg px-2 py-1 text-[10px] uppercase tracking-wider text-white/40 hover:bg-white/5 hover:text-white/70"
        >
          Reset
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
        <Accordion title="Face" open={open === "Face"} onToggle={() => setOpen(open === "Face" ? "" : "Face")}>
          {num("faceWidth")}
          {num("jaw")}
          {num("chin")}
          {num("cheekbones")}
          {num("noseWidth")}
          {num("noseLength")}
          {num("lipFullness")}
          {num("eyeSize")}
          {num("eyeSpacing")}
          {num("brow")}
        </Accordion>

        <Accordion title="Body" open={open === "Body"} onToggle={() => setOpen(open === "Body" ? "" : "Body")}>
          {num("height")}
          {num("shoulders")}
          {num("chest")}
          {num("waist")}
          {num("hips")}
          {num("arms")}
          {num("legs")}
          {num("muscle")}
        </Accordion>

        <Accordion title="Skin" open={open === "Skin"} onToggle={() => setOpen(open === "Skin" ? "" : "Skin")}>
          <Slider label="tone" value={params.skinTone} onChange={(v) => setParam("skinTone", v)} />
          <Slider
            label="undertone"
            value={params.undertone}
            min={-1}
            max={1}
            onChange={(v) => setParam("undertone", v)}
          />
          {num("freckles")}
          {num("gloss")}
        </Accordion>

        <Accordion title="Hair" open={open === "Hair"} onToggle={() => setOpen(open === "Hair" ? "" : "Hair")}>
          <label className="block text-[11px] text-white/55">
            Style
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white"
              value={params.hairStyle}
              onChange={(e) => setParam("hairStyle", e.target.value as HairStyle)}
            >
              {(["none", "pixie", "short", "medium", "long", "bun"] as HairStyle[]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          {num("hairLength")}
          {num("hairVolume")}
          <label className="block text-[11px] text-white/55">
            Color
            <input
              type="color"
              value={params.hairColor}
              onChange={(e) => setParam("hairColor", e.target.value)}
              className="mt-1 h-8 w-full cursor-pointer rounded border border-white/10 bg-transparent"
            />
          </label>
        </Accordion>

        <Accordion title="Eyes" open={open === "Eyes"} onToggle={() => setOpen(open === "Eyes" ? "" : "Eyes")}>
          <label className="block text-[11px] text-white/55">
            Iris color
            <input
              type="color"
              value={params.irisColor}
              onChange={(e) => setParam("irisColor", e.target.value)}
              className="mt-1 h-8 w-full cursor-pointer rounded border border-white/10 bg-transparent"
            />
          </label>
          {num("eyeOpenness")}
        </Accordion>

        <Accordion title="Pose" open={open === "Pose"} onToggle={() => setOpen(open === "Pose" ? "" : "Pose")}>
          <div className="flex flex-wrap gap-1.5">
            {(["Neutral", "Confident", "Wave", "Three-quarter"] as PosePreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPosePreset(p)}
                className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ring-1 transition ${
                  params.posePreset === p
                    ? "bg-amber-300/20 text-amber-100 ring-amber-300/40"
                    : "text-white/50 ring-white/10 hover:bg-white/5"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <Slider
            label="rotateY"
            value={params.rotateY}
            min={-Math.PI}
            max={Math.PI}
            step={0.01}
            onChange={(v) => setParam("rotateY", v)}
          />
          {num("armL")}
          {num("armR")}
          <Slider
            label="torsoLean"
            value={params.torsoLean}
            min={-1}
            max={1}
            onChange={(v) => setParam("torsoLean", v)}
          />
        </Accordion>
      </div>
    </div>
  );
}
