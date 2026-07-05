import React from "react";
import { Link } from "react-router-dom";
import { PublicNav } from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/api";
import { Zap, Battery, Gauge, Sparkles, ShieldCheck, ArrowRight, GitBranch, Users, Wallet } from "lucide-react";

const HERO_IMG = "https://images.unsplash.com/photo-1623079398118-11b5da627a00?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzZ8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBFViUyMHNjb290ZXIlMjBzdHVkaW8lMjBsaWdodGluZyUyMGRhcmslMjBiYWNrZ3JvdW5kfGVufDB8fHx8MTc4MzI0OTk2Nnww&ixlib=rb-4.1.0&q=85";
const LIFESTYLE = "https://images.unsplash.com/photo-1772456595053-98eb00580bb9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHwxfHxwZXJzb24lMjByaWRpbmclMjBlbGVjdHJpYyUyMHNjb290ZXIlMjBjaXR5JTIwbmlnaHR8ZW58MHx8fHwxNzgzMjQ5OTY2fDA&ixlib=rb-4.1.0&q=85";

const specs = [
  { label: "Range", value: "120 km", icon: Battery },
  { label: "Top Speed", value: "80 km/h", icon: Gauge },
  { label: "Battery", value: "3.2 kWh LFP", icon: Zap },
  { label: "Warranty", value: "3 years", icon: ShieldCheck },
];

const faqs = [
  { q: "How does the referral program work?", a: "When you purchase a Dream Pick scooter, you become an active member. You get a unique referral code. Every person who joins through your code is placed in either your LEFT or RIGHT branch, forming a binary tree. When your left and right team counts match up (1:1 pair), you earn ₹2,700 per matched pair." },
  { q: "Is this a real payment or demo?", a: "This is a DEMO application. No real money is processed. Payments and payouts are simulated for testing the binary tree logic and commission workflow." },
  { q: "What is the scooter price?", a: "The Dream Pick Volt X1 is priced at ₹54,999. This purchase is what activates your membership and finalizes your placement in the binary tree." },
  { q: "How are commissions paid?", a: "In this demo, commissions accrue as PENDING once a matched pair is created. An admin then approves, marks paid, or rejects them. You can request withdrawals from your available (approved) balance." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      <PublicNav />
      {/* Hero */}
      <section className="hero-gradient relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-28 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 border border-white/10 rounded-full px-4 py-1.5 text-xs text-white/70">
              <Sparkles className="w-3 h-3 text-[#00E5FF]" /> Demo Mode — Payments Simulated
            </div>
            <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight font-light" data-testid="home-hero-title">
              Ride the <br />
              <span className="text-[#00E5FF]">electric future.</span><br />
              Refer. Earn. Repeat.
            </h1>
            <p className="text-white/70 text-lg max-w-lg leading-relaxed">
              Dream Pick Volt X1 — premium EV scooter with a binary matching reward program. Every matched pair in your team pays you <span className="text-[#00FFA3]">₹2,700</span>.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Link to="/scooter">
                <Button className="btn-primary rounded-full px-8 py-6 text-base" data-testid="home-buy-btn">
                  Buy Scooter — {formatINR(54999)} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="ghost" className="btn-outline-dp rounded-full px-8 py-6 text-base" data-testid="home-register-btn">
                  Register
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/5 rounded-full px-6 py-6" data-testid="home-login-btn">
                  Login
                </Button>
              </Link>
            </div>
          </div>
          <div className="lg:col-span-6 relative">
            <div className="absolute -inset-6 bg-gradient-to-br from-[#00E5FF]/10 to-[#0055FF]/5 blur-3xl rounded-full"></div>
            <img src={HERO_IMG} alt="Dream Pick EV Scooter" className="relative rounded-3xl border border-white/10 aspect-[4/5] w-full object-cover" data-testid="home-hero-image" />
            <div className="absolute bottom-6 left-6 right-6 glass-card rounded-2xl p-4 flex items-center gap-4">
              <div>
                <div className="overline text-[#00E5FF]">Volt X1</div>
                <div className="font-heading text-xl">Urban Electric Icon</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs text-white/50">Starts at</div>
                <div className="font-heading text-2xl text-[#00E5FF]">{formatINR(54999)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Specs strip */}
      <section className="py-14 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {specs.map((s, i) => (
            <div key={i} className="dp-card p-6" data-testid={`home-spec-${i}`}>
              <s.icon className="w-6 h-6 text-[#00E5FF] mb-3" strokeWidth={1.5} />
              <div className="overline text-white/50">{s.label}</div>
              <div className="mt-1 font-heading text-2xl">{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-4">
              <div className="overline text-[#00E5FF] mb-3">Referral Program</div>
              <h2 className="font-heading text-4xl lg:text-5xl tracking-tight font-medium">
                A binary tree that pays you for balance.
              </h2>
              <p className="mt-4 text-white/60 leading-relaxed">
                Buy the scooter. Get a unique referral code. Every person who joins through you gets placed on your LEFT or RIGHT branch. Every 1:1 matched pair pays you ₹2,700.
              </p>
            </div>
            <div className="lg:col-span-8 grid md:grid-cols-3 gap-4">
              {[
                { icon: Zap, title: "Buy & Activate", desc: "Purchase the Volt X1 to activate your Dream Pick membership.", tid: "how-1" },
                { icon: GitBranch, title: "Refer + Place", desc: "Share your code. New members join your LEFT or RIGHT branch.", tid: "how-2" },
                { icon: Wallet, title: "Earn on Pairs", desc: "Get ₹2,700 for every matched left–right pair in your team.", tid: "how-3" },
              ].map((s, i) => (
                <div key={i} className="dp-card p-6" data-testid={s.tid}>
                  <s.icon className="w-6 h-6 text-[#00FFA3] mb-4" strokeWidth={1.5} />
                  <div className="font-heading text-lg mb-2">{s.title}</div>
                  <div className="text-white/60 text-sm leading-relaxed">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Lifestyle image */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="relative rounded-3xl overflow-hidden border border-white/10">
            <img src={LIFESTYLE} alt="EV ride" className="w-full h-[420px] object-cover" data-testid="home-lifestyle-image"/>
            <div className="absolute inset-0 bg-gradient-to-r from-[#070B14] via-[#070B14]/60 to-transparent flex items-center">
              <div className="p-10 max-w-lg">
                <div className="overline text-[#00E5FF]">Own the streets</div>
                <h3 className="font-heading text-3xl lg:text-4xl mt-2">Silent. Smart. Yours.</h3>
                <p className="mt-3 text-white/70">Zero emissions. Zero noise. Full charge in under 4 hours.</p>
                <Link to="/scooter">
                  <Button className="btn-primary rounded-full mt-6 px-6" data-testid="home-lifestyle-cta">
                    Explore the Volt X1 <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 lg:px-10">
          <div className="overline text-[#00E5FF] mb-3">FAQ</div>
          <h2 className="font-heading text-4xl mb-10">Questions answered.</h2>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <details key={i} className="dp-card p-5 group" data-testid={`home-faq-${i}`}>
                <summary className="cursor-pointer list-none flex justify-between items-center font-heading text-lg">
                  {f.q}
                  <span className="text-[#00E5FF] group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-white/60 text-sm leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-10 text-center text-white/40 text-xs">
        <div className="brand-logo text-xl text-white mb-2">Dream<span className="text-[#00E5FF]">Pick</span></div>
        © {new Date().getFullYear()} Dream Pick — Demo application. No real payments are processed.
      </footer>
    </div>
  );
}
