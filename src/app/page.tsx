import Link from "next/link";

const FEATURES = [
  {
    title: "Selfie → Twin",
    body: "In-browser Face Landmarker reads your geometry and maps it onto a studio-grade humanoid — private by design.",
  },
  {
    title: "Cinematic lighting",
    body: "ACES tone mapping, HDRI studio environment, soft accumulative shadows. Look expensive out of the box.",
  },
  {
    title: "Precision refine",
    body: "Dozens of face, body, skin, hair, eye, and pose controls. Dial in the twin you recognize.",
  },
  {
    title: "Export ready",
    body: "Capture PNG stills for moodboards, profiles, and pitches. Pro removes the Muse watermark.",
  },
];

const STEPS = [
  { n: "01", t: "Upload", d: "Drop 1–3 clear frontal selfies." },
  { n: "02", t: "Build", d: "Muse extracts facial metrics on-device." },
  { n: "03", t: "Refine", d: "Shape body, skin, hair, and pose." },
  { n: "04", t: "Export", d: "Download a studio-lit still." },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050508] text-[#f4f0ea]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-10%] h-[70vh] w-[80vw] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(155,123,255,0.22),transparent_60%)]" />
        <div className="absolute bottom-0 right-[-10%] h-[50vh] w-[50vw] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(232,196,124,0.12),transparent_65%)]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyIiBoZWlnaHQ9IjIiPjxyZWN0IHdpZHRoPSIyIiBoZWlnaHQ9IjIiIGZpbGw9IiMwNTA1MDgiLz48Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMC4zNSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvc3ZnPg==')] opacity-40" />
      </div>

      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-3xl tracking-tight">Muse</span>
          <span className="hidden text-[10px] uppercase tracking-[0.28em] text-white/35 sm:inline">
            by Zer01
          </span>
        </div>
        <nav className="flex items-center gap-3">
          <a href="#how" className="hidden text-xs text-white/50 hover:text-white/80 sm:inline">
            How it works
          </a>
          <a href="#pricing" className="hidden text-xs text-white/50 hover:text-white/80 sm:inline">
            Pricing
          </a>
          <Link href="/studio" className="btn-gold !py-2.5 !px-5 text-xs">
            Open Studio
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-10 md:pt-20">
        <p className="mb-5 text-[11px] uppercase tracking-[0.35em] text-amber-200/60">
          Artificially Intelligent · Digitally Enhanced
        </p>
        <h1 className="max-w-3xl font-serif text-5xl leading-[1.05] tracking-tight text-white md:text-7xl">
          Your face.
          <br />
          <span className="bg-gradient-to-r from-amber-100 via-violet-200 to-amber-100 bg-clip-text text-transparent">
            A living twin.
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/55 md:text-lg">
          Muse turns selfies into a realistic, poseable digital twin — studio lighting,
          skin that catches light, and controls fine enough for a creative director.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link href="/studio" className="btn-gold">
            Build your twin
          </Link>
          <a href="#how" className="btn-ghost">
            See how it works
          </a>
        </div>

        {/* Hero visual card */}
        <div className="mt-16 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent p-1 shadow-2xl shadow-violet-950/40">
          <div className="relative aspect-[16/9] overflow-hidden rounded-[1.35rem] bg-[#0a0a12]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(155,123,255,0.25),transparent_55%)]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative h-40 w-40 md:h-56 md:w-56">
                <div className="absolute inset-0 rounded-full bg-gradient-to-b from-amber-100/20 to-violet-500/20 blur-2xl" />
                <div className="absolute inset-6 rounded-full border border-white/10 bg-gradient-to-b from-[#3a2f4a] to-[#1a1528] shadow-inner" />
                <div className="absolute inset-[3.25rem] rounded-full bg-gradient-to-br from-[#c4a484] to-[#8b6345] opacity-90 md:inset-[4.5rem]" />
              </div>
              <p className="mt-6 font-serif text-2xl text-white/80 md:text-3xl">Muse Studio</p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-white/30">
                Orbit · Pose · Export
              </p>
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] uppercase tracking-[0.2em] text-white/25">
              <span>CC0 Vitruvian base</span>
              <span>MediaPipe on-device</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative z-10 border-t border-white/5 bg-black/20 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-[11px] uppercase tracking-[0.3em] text-violet-200/50">Process</p>
          <h2 className="mt-3 font-serif text-4xl text-white md:text-5xl">How it works</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="glass-panel rounded-2xl p-5">
                <div className="text-xs text-amber-200/60">{s.n}</div>
                <div className="mt-3 font-serif text-2xl text-white">{s.t}</div>
                <p className="mt-2 text-sm text-white/45">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-[11px] uppercase tracking-[0.3em] text-amber-200/50">Capabilities</p>
          <h2 className="mt-3 font-serif text-4xl text-white md:text-5xl">Built for premium</h2>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-white/8 bg-white/[0.03] p-6 transition hover:border-violet-300/25 hover:bg-white/[0.05]"
              >
                <h3 className="font-serif text-2xl text-white">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/50">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 border-t border-white/5 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-[11px] uppercase tracking-[0.3em] text-violet-200/50">Pricing</p>
          <h2 className="mt-3 font-serif text-4xl text-white md:text-5xl">Simple plans</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="glass-panel rounded-3xl p-8">
              <div className="text-xs uppercase tracking-[0.25em] text-white/40">Free</div>
              <div className="mt-4 font-serif text-5xl text-white">$0</div>
              <ul className="mt-6 space-y-2 text-sm text-white/50">
                <li>· Twin builder & refine controls</li>
                <li>· PNG export with Muse watermark</li>
                <li>· On-device face analysis</li>
              </ul>
              <Link href="/studio" className="btn-ghost mt-8 w-full">
                Start free
              </Link>
            </div>
            <div className="relative overflow-hidden rounded-3xl border border-amber-300/30 bg-gradient-to-br from-amber-300/10 via-violet-500/10 to-transparent p-8">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-300/20 blur-2xl" />
              <div className="text-xs uppercase tracking-[0.25em] text-amber-100/70">Pro</div>
              <div className="mt-4 font-serif text-5xl text-white">
                $12<span className="text-lg text-white/40">/mo</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm text-white/60">
                <li>· Everything in Free</li>
                <li>· Watermark-free exports</li>
                <li>· Priority model updates</li>
              </ul>
              <Link href="/studio" className="btn-gold mt-8 w-full">
                Try Pro in Studio
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 pb-24">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-violet-600/20 to-amber-500/10 px-8 py-14 text-center">
          <h2 className="font-serif text-4xl text-white md:text-5xl">Meet yourself, remixed.</h2>
          <p className="mx-auto mt-4 max-w-md text-white/50">
            Open the studio and build a twin in minutes. No account required for the demo.
          </p>
          <Link href="/studio" className="btn-gold mt-8 inline-flex">
            Enter Muse Studio
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 px-6 py-8 text-center">
        <p className="font-serif text-xl text-white/80">Muse</p>
        <p className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/30">
          Made By Zer01 · Artificially Intelligent, Digitally Enhanced
        </p>
      </footer>
    </div>
  );
}
