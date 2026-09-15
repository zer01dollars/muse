"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TwinCanvas } from "./TwinCanvas";
import { SelfiePanel } from "./SelfiePanel";
import { ControlPanel } from "./ControlPanel";
import { ExportBar } from "./ExportBar";
import { useTwinStore } from "@/store/twinStore";

export function StudioApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mobileWarned = useTwinStore((s) => s.mobileWarned);
  const setMobileWarned = useTwinStore((s) => s.setMobileWarned);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#050508] text-white">
      {/* ambient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-0 h-96 w-96 rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-amber-500/10 blur-[100px]" />
      </div>

      <header className="relative z-20 flex items-center justify-between border-b border-white/5 px-4 py-3 md:px-6">
        <Link href="/" className="group flex items-baseline gap-3">
          <span className="font-serif text-2xl tracking-tight text-white">Muse</span>
          <span className="hidden text-[10px] uppercase tracking-[0.25em] text-white/35 sm:inline">
            Studio
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <ExportBar canvasRef={canvasRef} />
          <Link
            href="/"
            className="hidden text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 sm:inline"
          >
            Home
          </Link>
        </div>
      </header>

      {narrow && !mobileWarned && (
        <div className="relative z-20 mx-4 mt-3 flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-50/90 md:mx-6">
          <span className="mt-0.5">✦</span>
          <p className="flex-1">
            Muse Studio is designed for desktop. You can still build a twin on mobile —
            rotate to landscape for the best view.
          </p>
          <button
            type="button"
            className="text-amber-100/70"
            onClick={() => setMobileWarned(true)}
          >
            ✕
          </button>
        </div>
      )}

      <main className="relative z-10 grid flex-1 gap-3 p-3 md:grid-cols-[280px_1fr_300px] md:gap-4 md:p-4 lg:grid-cols-[300px_1fr_320px]">
        <aside className="glass-panel order-2 max-h-[50vh] overflow-y-auto rounded-2xl p-4 md:order-1 md:max-h-[calc(100vh-5.5rem)]">
          <SelfiePanel />
        </aside>

        <section className="order-1 min-h-[50vh] md:order-2 md:min-h-0">
          <TwinCanvas canvasRef={canvasRef} />
        </section>

        <aside className="glass-panel order-3 max-h-[50vh] overflow-hidden rounded-2xl p-4 md:max-h-[calc(100vh-5.5rem)]">
          <ControlPanel />
        </aside>
      </main>

      <footer className="relative z-10 border-t border-white/5 px-4 py-2 text-center text-[10px] tracking-[0.2em] text-white/25">
        MADE BY ZER01 · ARTIFICIALLY INTELLIGENT, DIGITALLY ENHANCED
      </footer>
    </div>
  );
}
