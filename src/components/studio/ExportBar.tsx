"use client";

import { useTwinStore } from "@/store/twinStore";

export function ExportBar({
  canvasRef,
}: {
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
}) {
  const proUnlocked = useTwinStore((s) => s.proUnlocked);
  const unlockPro = useTwinStore((s) => s.unlockPro);

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (proUnlocked) {
      const a = document.createElement("a");
      a.download = `muse-twin-${Date.now()}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
      return;
    }

    // Watermark for Free
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0);
    ctx.font = `${Math.max(14, out.width * 0.028)}px Georgia, serif`;
    ctx.fillStyle = "rgba(255, 220, 160, 0.55)";
    ctx.textAlign = "right";
    ctx.fillText("Muse · Free", out.width - 24, out.height - 24);
    const a = document.createElement("a");
    a.download = `muse-twin-free-${Date.now()}.png`;
    a.href = out.toDataURL("image/png");
    a.click();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={exportPng} className="btn-gold !px-4 !py-2 text-sm">
        Export PNG
      </button>
      {!proUnlocked ? (
        <button
          type="button"
          onClick={unlockPro}
          className="rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-100 transition hover:bg-violet-500/20"
        >
          Unlock Pro (demo)
        </button>
      ) : (
        <span className="rounded-full bg-amber-300/15 px-3 py-1.5 text-[10px] uppercase tracking-widest text-amber-100">
          Pro · no watermark
        </span>
      )}
    </div>
  );
}
