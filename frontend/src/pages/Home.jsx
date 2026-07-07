import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PublicNav } from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { api, formatINR } from "@/lib/api";
import { Zap, ArrowRight, Sparkles, Play } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const LEADERSHIP = [
  { role: "Company MD", name: "Suma B" },
  { role: "Co-Director", name: "Venkatesh Naik" },
];

const CHIEF_GUESTS = [
  { name: "Mr Fazi", designation: "Financial Management & Training Head", category: "CHIEF_GUEST_MR_FAZI" },
  { name: "Vishal Meharvade", designation: "IT Head", category: "CHIEF_GUEST_VISHAL_MEHARVADE" },
  { name: "Srinivas", designation: "Business Head", category: "CHIEF_GUEST_SRINIVAS" },
  { name: "Hemanth Kumar", designation: "Marketing Head", category: "CHIEF_GUEST_HEMANTH_KUMAR" },
];

function PlaceholderAvatar({ initial }) {
  return (
    <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-[#7C3AED]/40 to-[#D4A93A]/30 border border-[#D4A93A]/30 flex items-center justify-center">
      <span className="font-heading text-5xl gold-text">{initial}</span>
    </div>
  );
}

async function fetchCategory(cat) {
  try {
    const { data } = await api.get(`/media?category=${cat}`);
    return data.media || [];
  } catch (_) { return []; }
}

export default function Home() {
  const [cfg, setCfg] = useState({ company_name: "Dreampick Private Limited", gst_number: "29AAMCD4327L1Z6", plan_price: 54999 });
  const [logo, setLogo] = useState(null);
  const [heroScooter, setHeroScooter] = useState(null);
  const [heroBg, setHeroBg] = useState(null);
  const [aboutImg, setAboutImg] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [chiefMedia, setChiefMedia] = useState({});
  const [leadershipMedia, setLeadershipMedia] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const c = await api.get("/config"); setCfg(c.data);
      } catch (_) {}
      const [lgo, hero, hbg, about, gImg, gVid, lead] = await Promise.all([
        fetchCategory("COMPANY_LOGO"),
        fetchCategory("HERO_SCOOTER"),
        fetchCategory("HERO_BACKGROUND"),
        fetchCategory("ABOUT_US"),
        fetchCategory("GALLERY_IMAGE"),
        fetchCategory("GALLERY_VIDEO"),
        // Legacy: any items uploaded via old section=leadership (rare after v4 wipe)
        api.get("/media?category=LEADERSHIP").then(r => r.data.media || []).catch(() => []),
      ]);
      setLogo(lgo[0] || null);
      setHeroScooter(hero[0] || null);
      setHeroBg(hbg[0] || null);
      setAboutImg(about[0] || null);
      setGallery([...gImg, ...gVid].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
      setLeadershipMedia(lead);
      const cg = {};
      for (const g of CHIEF_GUESTS) {
        const arr = await fetchCategory(g.category);
        cg[g.category] = arr[0] || null;
      }
      setChiefMedia(cg);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#0F0A1F] text-white">
      <PublicNav logoUrl={logo ? `${BACKEND}${logo.url}` : null} />

      {/* Hero */}
      <section id="hero" className="hero-gradient relative overflow-hidden">
        {heroBg && (
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            <img src={`${BACKEND}${heroBg.url}`} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-24 grid lg:grid-cols-12 gap-10 items-center relative">
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
          <div className="lg:col-span-5 relative flex items-center justify-center min-h-[380px]">
            <div className="dp-glow-behind w-full max-w-md">
              {heroScooter ? (
                <img src={`${BACKEND}${heroScooter.url}`} alt="EV Scooter" className="w-full rounded-2xl border border-[#D4A93A]/25 dp-float dp-tilt object-cover aspect-square" data-testid="home-hero-scooter-image" />
              ) : (
                <div className="dp-card p-6 h-96 flex flex-col items-center justify-center gap-4 border-[#D4A93A]/30 dp-float">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#7C3AED]/40 to-[#D4A93A]/30 flex items-center justify-center border border-[#D4A93A]/30">
                    <Zap className="w-12 h-12 text-[#F4D06F]" />
                  </div>
                  <div className="text-center">
                    <div className="overline text-[#D4A93A]">EV Scooter Placeholder</div>
                    <div className="font-heading text-2xl mt-1">Basic EV Scooter Plan</div>
                    <div className="text-white/60 text-sm mt-2 max-w-xs">Hero product image will appear here after upload from the admin media manager.</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* About Us — Vision & Mission bilingual + optional image */}
      <section id="about-us" className="py-20 border-t border-[#D4A93A]/10 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="overline text-[#D4A93A]">About Us</div>
          <h2 className="font-heading text-4xl mt-2 mb-8">Vision · Mission · Values</h2>
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              {aboutImg ? (
                <img src={`${BACKEND}${aboutImg.url}`} alt="About Dreampick" className="w-full rounded-2xl border border-[#D4A93A]/20 dp-tilt object-cover aspect-[4/5]" data-testid="home-about-image" />
              ) : (
                <div className="dp-card h-full min-h-[300px] flex items-center justify-center dp-hover-lift">
                  <div className="text-center text-white/50 p-6">
                    <Sparkles className="w-8 h-8 text-[#F4D06F] mx-auto mb-2" />
                    <div className="overline text-[#D4A93A]">About Us Image</div>
                    <div className="text-xs mt-2 text-white/40">Upload from admin media manager (category: ABOUT_US)</div>
                  </div>
                </div>
              )}
            </div>
            <div className="lg:col-span-7 space-y-4">
              <div className="dp-card p-6 dp-hover-lift">
                <div className="overline text-[#D4A93A]">Vision · ದೃಷ್ಟಿ</div>
                <p className="text-white/75 leading-relaxed mt-3">To make affordable electric mobility accessible to every household while creating transparent and sustainable earning opportunities through responsible EV ownership.</p>
                <p className="text-white/55 leading-relaxed mt-3 text-sm" lang="kn">ಪ್ರತಿ ಕುಟುಂಬಕ್ಕೂ ಕೈಗೆಟುಕುವ ವಿದ್ಯುತ್ ವಾಹನ ಸೌಲಭ್ಯವನ್ನು ತಲುಪಿಸುವುದರ ಜೊತೆಗೆ, ಜವಾಬ್ದಾರಿಯುತ ಇವಿ ಮಾಲೀಕತ್ವದ ಮೂಲಕ ಪಾರದರ್ಶಕ ಮತ್ತು ಸ್ಥಿರ ಆದಾಯದ ಅವಕಾಶಗಳನ್ನು ಸೃಷ್ಟಿಸುವುದು ನಮ್ಮ ದೃಷ್ಟಿಯಾಗಿದೆ.</p>
              </div>
              <div className="dp-card p-6 dp-hover-lift">
                <div className="overline text-[#D4A93A]">Mission · ಧ್ಯೇಯ</div>
                <p className="text-white/75 leading-relaxed mt-3">To provide quality EV scooters, clear customer support, flexible loan assistance, and a transparent digital platform for managing purchases, rewards, referrals, and payouts.</p>
                <p className="text-white/55 leading-relaxed mt-3 text-sm" lang="kn">ಗುಣಮಟ್ಟದ ಇವಿ ಸ್ಕೂಟರ್‌ಗಳು, ಸ್ಪಷ್ಟ ಗ್ರಾಹಕ ಸಹಾಯ, ಸುಲಭ ಸಾಲ ಸೌಲಭ್ಯ ಮತ್ತು ಖರೀದಿ, ಬಹುಮಾನ, ರೆಫರಲ್ ಹಾಗೂ ಪಾವತಿಗಳನ್ನು ಪಾರದರ್ಶಕವಾಗಿ ನಿರ್ವಹಿಸುವ ಡಿಜಿಟಲ್ ವೇದಿಕೆಯನ್ನು ಒದಗಿಸುವುದು ನಮ್ಮ ಧ್ಯೇಯವಾಗಿದೆ.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* GST */}
      <section className="py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="dp-card-gold rounded-2xl p-6 flex flex-wrap justify-between items-center gap-4 dp-hover-lift" data-testid="home-gst-card">
            <div>
              <div className="overline text-[#D4A93A]">GST Number</div>
              <div className="font-heading text-2xl mt-1 font-mono text-[#F4D06F]">{cfg.gst_number}</div>
            </div>
            <div className="text-sm text-white/60">Registered under {cfg.company_name}</div>
          </div>
        </div>
      </section>

      {/* Leadership */}
      <section id="leadership" className="py-16 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="overline text-[#D4A93A]">Leadership</div>
          <h2 className="font-heading text-4xl mt-2 mb-8">Guided by experienced leadership.</h2>
          <div className="grid sm:grid-cols-2 gap-6" data-testid="home-leadership-grid">
            {LEADERSHIP.map((p) => {
              const media = leadershipMedia.find(m => (m.title || "").toLowerCase() === p.name.toLowerCase());
              return (
                <div key={p.name} className="dp-card p-6 flex gap-4 items-center dp-hover-lift">
                  <div className="w-24 h-24 shrink-0">
                    {media?.url ? (
                      <img src={`${BACKEND}${media.url}`} alt={p.name} className="w-24 h-24 rounded-xl object-cover border border-[#D4A93A]/30 dp-tilt" />
                    ) : <PlaceholderAvatar initial={p.name[0]} />}
                  </div>
                  <div>
                    <div className="overline text-[#D4A93A]">{p.role}</div>
                    <div className="font-heading text-2xl mt-1">{p.name}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Chief Guests */}
      <section id="chief-guests" className="py-16 border-y border-[#D4A93A]/10 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="overline text-[#D4A93A]">Chief Guests</div>
          <h2 className="font-heading text-4xl mt-2 mb-6">Our distinguished chief guests.</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto lg:overflow-visible" data-testid="home-chief-guests-grid">
            {CHIEF_GUESTS.map((g) => {
              const m = chiefMedia[g.category];
              return (
                <div key={g.name} className="dp-card p-4 dp-hover-lift dp-tilt" data-testid={`chief-guest-${g.category}`}>
                  <div className="w-full aspect-square">
                    {m?.url ? (
                      <img src={`${BACKEND}${m.url}`} alt={g.name} className="w-full h-full rounded-lg object-cover border border-[#D4A93A]/20" />
                    ) : <PlaceholderAvatar initial={g.name[0]} />}
                  </div>
                  <div className="mt-3 text-center">
                    <div className="font-heading text-lg">{g.name}</div>
                    <div className="text-xs text-[#F4D06F] mt-1">{g.designation}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section id="gallery" className="py-16 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="overline text-[#D4A93A]">Gallery</div>
          <h2 className="font-heading text-4xl mt-2 mb-6">Photos & videos.</h2>
          {gallery.length === 0 ? (
            <div className="dp-card p-10 text-center text-white/50" data-testid="home-gallery-empty">
              No gallery media uploaded yet. Approved photos and videos will appear here.
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2" data-testid="home-gallery-slider">
              {gallery.map((g) => (
                <div key={g._id} className="dp-card p-3 w-72 shrink-0 dp-gallery-item">
                  {g.media_type === "video" ? (
                    <div className="relative">
                      <video controls className="w-full h-40 rounded-lg object-cover bg-black" src={`${BACKEND}${g.url}`} />
                      <Play className="absolute inset-0 m-auto w-10 h-10 text-white/70 pointer-events-none opacity-40" />
                    </div>
                  ) : (
                    <img src={`${BACKEND}${g.url}`} alt={g.title || "Gallery"} className="w-full h-40 rounded-lg object-cover" />
                  )}
                  <div className="dp-gallery-overlay rounded-lg">
                    <div>
                      {g.title && <div className="font-medium text-sm">{g.title}</div>}
                      {g.caption && <div className="text-xs text-white/60">{g.caption}</div>}
                    </div>
                  </div>
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
