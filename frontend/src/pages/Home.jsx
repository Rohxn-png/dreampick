import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PublicNav } from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { api, formatINR } from "@/lib/api";
import { Zap, Battery, Gauge, ShieldCheck, ArrowRight, ScrollText } from "lucide-react";

const LEADERSHIP = [
  { role: "Company MD", name: "Suma B" },
  { role: "Co-Director", name: "Venkatesh Naik" },
];
const MANAGERS = ["Santhosh", "Durgesh Koli", "Manjunath Mudhol", "Hanumanth Raj", "Maruthi Ganti"];

function PlaceholderAvatar({ initial }) {
  return (
    <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-[#7C3AED]/30 to-[#D4A93A]/20 border border-[#D4A93A]/20 flex items-center justify-center">
      <span className="font-heading text-4xl gold-text">{initial}</span>
    </div>
  );
}

export default function Home() {
  const [cfg, setCfg] = useState({ company_name: "Dreampick Private Limited", gst_number: "29AAMCD4327L1Z6", plan_price: 54999 });
  const [galleryMedia, setGalleryMedia] = useState([]);
  const [managerMedia, setManagerMedia] = useState([]);
  const [leadershipMedia, setLeadershipMedia] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const c = await api.get("/config");
        setCfg(c.data);
        const [g, m, l] = await Promise.all([
          api.get("/media?section=gallery"),
          api.get("/media?section=managers"),
          api.get("/media?section=leadership"),
        ]);
        setGalleryMedia(g.data.media || []);
        setManagerMedia(m.data.media || []);
        setLeadershipMedia(l.data.media || []);
      } catch (_) {}
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#0F0A1F] text-white">
      <PublicNav />

      {/* Hero */}
      <section className="hero-gradient">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-24 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 border border-[#D4A93A]/40 rounded-full px-4 py-1.5 text-xs text-[#F4D06F]">
              <span className="w-1.5 h-1.5 bg-[#D4A93A] rounded-full animate-pulse"></span> {cfg.company_name}
            </div>
            <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl leading-[0.95]" data-testid="home-hero-title">
              Affordable electric<br />
              mobility with a <span className="gold-text">transparent</span><br />
              earning platform.
            </h1>
            <p className="text-white/70 text-lg max-w-lg leading-relaxed">
              Buy the Basic EV Scooter Plan, share your referral, and earn structured monthly cashback, direct referral commissions, and 1:1 matching income — all manually paid, fully audited.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/plans"><Button className="btn-primary rounded-full px-8 py-6 text-base" data-testid="home-view-plans-btn">View Plans <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
              <Link to="/register"><Button variant="ghost" className="btn-outline-dp rounded-full px-8 py-6 text-base" data-testid="home-register-btn">Register</Button></Link>
              <Link to="/login"><Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/5 rounded-full px-6 py-6" data-testid="home-login-btn">Login</Button></Link>
            </div>
            <div className="flex items-center gap-6 pt-4 text-xs text-white/50">
              <div><span className="text-[#F4D06F]">GST</span> · {cfg.gst_number}</div>
              <div><span className="text-[#F4D06F]">Plan Price</span> · {formatINR(cfg.plan_price)} + GST</div>
            </div>
          </div>
          <div className="lg:col-span-5 relative">
            <div className="dp-card p-6 h-96 flex flex-col items-center justify-center gap-4 border-[#D4A93A]/30">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#7C3AED]/40 to-[#D4A93A]/30 flex items-center justify-center border border-[#D4A93A]/30">
                <Zap className="w-12 h-12 text-[#F4D06F]" />
              </div>
              <div className="text-center">
                <div className="overline text-[#D4A93A]">EV Scooter Placeholder</div>
                <div className="font-heading text-2xl mt-1">Basic EV Scooter Plan</div>
                <div className="text-white/60 text-sm mt-2 max-w-xs">Hero product image will appear here after upload from the admin media manager.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vision & Mission (bilingual) */}
      <section className="py-20 border-t border-[#D4A93A]/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-6">
          <div className="dp-card p-8">
            <div className="overline text-[#D4A93A]">Vision · ದೃಷ್ಟಿ</div>
            <h2 className="font-heading text-3xl mt-3">Electric mobility for every household.</h2>
            <p className="text-white/75 leading-relaxed mt-4">To make affordable electric mobility accessible to every household while creating transparent and sustainable earning opportunities through responsible EV ownership.</p>
            <p className="text-white/60 leading-relaxed mt-3" lang="kn">ಪ್ರತಿ ಕುಟುಂಬಕ್ಕೂ ಕೈಗೆಟುಕುವ ವಿದ್ಯುತ್ ವಾಹನ ಸೌಲಭ್ಯವನ್ನು ತಲುಪಿಸುವುದರ ಜೊತೆಗೆ, ಜವಾಬ್ದಾರಿಯುತ ಇವಿ ಮಾಲೀಕತ್ವದ ಮೂಲಕ ಪಾರದರ್ಶಕ ಮತ್ತು ಸ್ಥಿರ ಆದಾಯದ ಅವಕಾಶಗಳನ್ನು ಸೃಷ್ಟಿಸುವುದು ನಮ್ಮ ದೃಷ್ಟಿಯಾಗಿದೆ.</p>
          </div>
          <div className="dp-card p-8">
            <div className="overline text-[#D4A93A]">Mission · ಧ್ಯೇಯ</div>
            <h2 className="font-heading text-3xl mt-3">Transparent digital rewards platform.</h2>
            <p className="text-white/75 leading-relaxed mt-4">To provide quality EV scooters, clear customer support, flexible loan assistance, and a transparent digital platform for managing purchases, rewards, referrals, and payouts.</p>
            <p className="text-white/60 leading-relaxed mt-3" lang="kn">ಗುಣಮಟ್ಟದ ಇವಿ ಸ್ಕೂಟರ್‌ಗಳು, ಸ್ಪಷ್ಟ ಗ್ರಾಹಕ ಸಹಾಯ, ಸುಲಭ ಸಾಲ ಸೌಲಭ್ಯ ಮತ್ತು ಖರೀದಿ, ಬಹುಮಾನ, ರೆಫರಲ್ ಹಾಗೂ ಪಾವತಿಗಳನ್ನು ಪಾರದರ್ಶಕವಾಗಿ ನಿರ್ವಹಿಸುವ ಡಿಜಿಟಲ್ ವೇದಿಕೆಯನ್ನು ಒದಗಿಸುವುದು ನಮ್ಮ ಧ್ಯೇಯವಾಗಿದೆ.</p>
          </div>
        </div>
      </section>

      {/* GST */}
      <section className="py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="dp-card-gold rounded-2xl p-6 flex flex-wrap justify-between items-center gap-4" data-testid="home-gst-card">
            <div>
              <div className="overline text-[#D4A93A]">GST Number</div>
              <div className="font-heading text-2xl mt-1 font-mono text-[#F4D06F]">{cfg.gst_number}</div>
            </div>
            <div className="text-sm text-white/60">Registered under {cfg.company_name}</div>
          </div>
        </div>
      </section>

      {/* Leadership */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="overline text-[#D4A93A]">Leadership</div>
          <h2 className="font-heading text-4xl mt-2 mb-8">Guided by experienced leadership.</h2>
          <div className="grid sm:grid-cols-2 gap-6" data-testid="home-leadership-grid">
            {LEADERSHIP.map((p) => {
              const media = leadershipMedia.find(m => (m.person_name || "").toLowerCase() === p.name.toLowerCase());
              return (
                <div key={p.name} className="dp-card p-6 flex gap-4 items-center">
                  <div className="w-24 h-24 shrink-0">
                    {media?.url ? (
                      <img src={`${process.env.REACT_APP_BACKEND_URL}${media.url}`} alt={p.name} className="w-24 h-24 rounded-xl object-cover border border-[#D4A93A]/30" />
                    ) : <PlaceholderAvatar initial={p.name[0]} />}
                  </div>
                  <div>
                    <div className="overline text-[#D4A93A]">{p.role}</div>
                    <div className="font-heading text-2xl mt-1">{p.name}</div>
                    {!media && <div className="text-xs text-white/40 mt-2">Photo pending upload from admin.</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Managers carousel */}
      <section className="py-16 border-y border-[#D4A93A]/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="overline text-[#D4A93A]">Managers</div>
          <h2 className="font-heading text-4xl mt-2 mb-6">Meet our regional managers.</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2" data-testid="home-managers-carousel">
            {MANAGERS.map((name) => {
              const media = managerMedia.find(m => (m.person_name || "").toLowerCase() === name.toLowerCase());
              return (
                <div key={name} className="dp-card p-4 w-48 shrink-0">
                  {media?.url ? (
                    <img src={`${process.env.REACT_APP_BACKEND_URL}${media.url}`} alt={name} className="w-full aspect-square rounded-lg object-cover border border-[#D4A93A]/20" />
                  ) : <PlaceholderAvatar initial={name[0]} />}
                  <div className="mt-3 font-heading text-lg text-center">{name}</div>
                  {!media && <div className="text-[10px] text-white/40 text-center mt-1">Photo pending</div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="overline text-[#D4A93A]">Gallery</div>
          <h2 className="font-heading text-4xl mt-2 mb-6">Photos & videos.</h2>
          {galleryMedia.length === 0 ? (
            <div className="dp-card p-10 text-center text-white/50" data-testid="home-gallery-empty">
              Gallery is empty. Approved photos and videos uploaded from the admin portal will appear here.
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2" data-testid="home-gallery-slider">
              {galleryMedia.map((g) => (
                <div key={g._id} className="dp-card p-3 w-72 shrink-0">
                  {g.media_type === "video" ? (
                    <video controls className="w-full h-40 rounded-lg object-cover bg-black" src={`${process.env.REACT_APP_BACKEND_URL}${g.url}`} />
                  ) : (
                    <img src={`${process.env.REACT_APP_BACKEND_URL}${g.url}`} alt={g.title || "Gallery"} className="w-full h-40 rounded-lg object-cover" />
                  )}
                  {g.title && <div className="mt-2 font-medium text-sm">{g.title}</div>}
                  {g.caption && <div className="text-xs text-white/60">{g.caption}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-[#D4A93A]/15 py-8 text-center text-white/40 text-xs">
        <div className="brand-logo text-lg text-white mb-1"><span className="gold-text">Dreampick</span> Private Limited</div>
        © {new Date().getFullYear()} — GST {cfg.gst_number}
      </footer>
    </div>
  );
}
