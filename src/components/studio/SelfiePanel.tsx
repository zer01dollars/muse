"use client";

import { useCallback, useRef, useState } from "react";
import { buildTwinFromSelfies } from "@/lib/faceLandmarker";
import { useTwinStore } from "@/store/twinStore";

export function SelfiePanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const selfies = useTwinStore((s) => s.selfies);
  const addSelfie = useTwinStore((s) => s.addSelfie);
  const removeSelfie = useTwinStore((s) => s.removeSelfie);
  const setParams = useTwinStore((s) => s.setParams);
  const setTwinReady = useTwinStore((s) => s.setTwinReady);
  const buildStatus = useTwinStore((s) => s.buildStatus);
  const buildProgress = useTwinStore((s) => s.buildProgress);
  const buildMessage = useTwinStore((s) => s.buildMessage);
  const setBuildProgress = useTwinStore((s) => s.setBuildProgress);
  const [dragOver, setDragOver] = useState(false);

  const onFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      list.slice(0, 3 - selfies.length).forEach((file) => {
        const url = URL.createObjectURL(file);
        addSelfie(url);
      });
    },
    [addSelfie, selfies.length]
  );

  const build = async () => {
    if (!selfies.length) return;
    try {
      const metrics = await buildTwinFromSelfies(selfies, setBuildProgress);
      setParams(metrics);
      setTwinReady(true);
    } catch (e) {
      setBuildProgress(
        "error",
        100,
        e instanceof Error ? e.message : "Build failed"
      );
    }
  };

  const busy =
    buildStatus === "loading" ||
    buildStatus === "detecting" ||
    buildStatus === "mapping";

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h2 className="font-serif text-xl text-white">Selfies</h2>
        <p className="mt-1 text-xs text-white/45">
          Upload 1–3 clear frontal photos. Muse maps facial geometry in-browser —
          nothing leaves your device.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`glass-panel cursor-pointer rounded-2xl border border-dashed p-5 text-center transition ${
          dragOver
            ? "border-amber-300/60 bg-amber-300/10"
            : "border-white/15 hover:border-violet-300/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && onFiles(e.target.files)}
        />
        <div className="text-2xl text-amber-200/70">⊕</div>
        <p className="mt-2 text-sm text-white/70">Drop selfies or click to upload</p>
        <p className="mt-1 text-[10px] uppercase tracking-widest text-white/35">
          {selfies.length}/3 images
        </p>
      </div>

      {selfies.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {selfies.map((url, i) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-xl ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSelfie(i);
                }}
                className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={!selfies.length || busy}
        onClick={build}
        className="btn-gold disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Building…" : "Build twin"}
      </button>

      {(busy || buildStatus === "ready" || buildStatus === "error") && (
        <div className="space-y-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                buildStatus === "error"
                  ? "bg-rose-400"
                  : "bg-gradient-to-r from-violet-400 to-amber-300"
              }`}
              style={{ width: `${buildProgress}%` }}
            />
          </div>
          <p
            className={`text-xs ${
              buildStatus === "error" ? "text-rose-300" : "text-white/50"
            }`}
          >
            {buildMessage}
          </p>
        </div>
      )}

      <p className="text-[11px] text-white/35">
        Twin loads automatically. Upload selfies + Build to match your face.
      </p>
    </div>
  );
}
