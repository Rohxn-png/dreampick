import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PublicNav } from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, formatINR } from "@/lib/api";
import { Zap, ArrowRight, Sparkles, Play, FileText, ExternalLink, Download, X, ShieldCheck } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const LEADERSHIP = [
  { role: "Managing Director", name: "Suma B", category: "COMPANY_MD_PHOTO", initial: "S" },
  { role: "Co-Director", name: "Venkatesh Naik", category: "CO_DIRECTOR_PHOTO", initial: "V" },
];

const CHIEF_GUESTS = [
  { name: "Mr Fazi", designation: "Financial Management & Training Head", category: "CHIEF_GUEST_MR_FAZI" },
  { name: "Vishal Meharvade", designation: "IT Head", category: "CHIEF_GUEST_VISHAL_MEHARVADE" },
  { name: "Srinivas", designation: "Business Head", category: "CHIEF_GUEST_SRINIVAS" },
  { name: "Hemanth Kumar", designation: "Marketing Head", category: "CHIEF_GUEST_HEMANTH_KUMAR" },
];

const LICENSE_SLOTS = [
  { category: "COMPANY_LICENSE_1", index: 1 },
  { category: "COMPANY_LICENSE_2", index: 2 },
  { category: "COMPANY_LICENSE_3", index: 3 },
  { category: "COMPANY_LICENSE_4", index: 4 },
  { category: "COMPANY_LICENSE_5", index: 5 },
  { category: "COMPANY_LICENSE_6", index: 6 },
];

function PlaceholderAvatar({ initial, size = "text-5xl" }) {
  return (
    <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#7C3AED]/40 to-[#D4A93A]/30 border border-[#D4A93A]/30 flex items-center justify-center">
      <span className={`font-heading ${size} gold-text`}>{initial}</span>
    </div>
  );
}

/** Card with mouse-driven 3D tilt & premium glow. */
function TiltCard({ children, onClick, testId, className = "" }) {
  const ref = React.useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const rx = (py - 0.5) * -10;
    const ry = (px - 0.5) * 12;
    el.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px) scale(1.02)`;
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
  };
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      className={`dp-leader-card group relative cursor-pointer rounded-2xl overflow-hidden ${className}`}
      data-testid={testId}
      style={{ transition: "transform 0.35s cubic-bezier(.2,.9,.3,1)" }}
    >
      {children}
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
  const [leadershipMedia, setLeadershipMedia] = useState({});
  const [licenses, setLicenses] = useState({});
  const [lightbox, setLightbox] = useState(null); // { type: 'leader'|'license', ...data }

  useEffect(() => {
    (async () => {
      try {
        const c = await api.get("/config"); setCfg(c.data);
      } catch (_e) { /* keep defaults */ }
      const [lgo, hero, hbg, about, gImg, gVid] = await Promise.all([
        fetchCategory("COMPANY_LOGO"),
        fetchCategory("HERO_SCOOTER"),
        fetchCategory("HERO_BACKGROUND"),
        fetchCategory("ABOUT_US"),
        fetchCategory("GALLERY_IMAGE"),
        fetchCategory("GALLERY_VIDEO"),
      ]);
      setLogo(lgo[0] || null);
      setHeroScooter(hero[0] || null);
      setHeroBg(hbg[0] || null);
      setAboutImg(about[0] || null);
      setGallery([...gImg, ...gVid].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));

      // Leadership (MD + Co-Director) — dedicated categories
      const leadMap = {};
      for (const p of LEADERSHIP) {
        const arr = await fetchCategory(p.category);
        leadMap[p.category] = arr[0] || null;
      }
      setLeadershipMedia(leadMap);

      const cg = {};
      for (const g of CHIEF_GUESTS) {
        const arr = await fetchCategory(g.category);
        cg[g.category] = arr[0] || null;
      }
      setChiefMedia(cg);

      // Licenses
      const licMap = {};
      for (const l of LICENSE_SLOTS) {
        const arr = await fetchCategory(l.category);
        licMap[l.category] = arr[0] || null;
      }
      setLicenses(licMap);
    })();
  }, []);

  const openLeader = (p) => setLightbox({ type: "leader", ...p, media: leadershipMedia[p.category] });
  const openLicense = (l, media) => setLightbox({ type: "license", ...l, media });

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

      {/* Leadership — larger cards with 3D tilt + click to open lightbox */}
      <section id="leadership" className="py-20 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="overline text-[#D4A93A]">Leadership</div>
          <h2 className="font-heading text-4xl mt-2 mb-3">Guided by experienced leadership.</h2>
          <p className="text-white/55 text-sm max-w-xl mb-10">Meet the leaders steering Dreampick. Tap on a photo to view the full portrait.</p>
          <div className="grid md:grid-cols-2 gap-8" data-testid="home-leadership-grid">
            {LEADERSHIP.map((p) => {
              const media = leadershipMedia[p.category];
              return (
                <TiltCard key={p.category} onClick={() => openLeader(p)} testId={`leader-card-${p.category}`}>
                  {/* Halo glow */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-70 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background:
                        "radial-gradient(600px circle at var(--mx, 50%) var(--my, 50%), rgba(212,169,58,0.25), rgba(124,58,237,0.15) 40%, transparent 60%)",
                    }}
                  />
                  <div className="relative dp-card !bg-gradient-to-b !from-[#1F1836]/95 !to-[#150C2D]/95 p-6 md:p-8 border !border-[#D4A93A]/25 rounded-2xl">
                    <div className="w-full aspect-[4/5] md:aspect-square rounded-xl overflow-hidden border border-[#D4A93A]/30 relative bg-black/20">
                      {media?.url ? (
                        <img
                          src={`${BACKEND}${media.url}`}
                          alt={p.name}
                          className="w-full h-full object-cover"
                          data-testid={`leader-photo-${p.category}`}
                        />
                      ) : (
                        <PlaceholderAvatar initial={p.initial} size="text-8xl" />
                      )}
                      {/* Corner badge */}
                      <div className="absolute top-3 left-3 backdrop-blur-md bg-[#0F0A1F]/60 border border-[#D4A93A]/40 rounded-full px-3 py-1 text-[10px] uppercase tracking-widest text-[#F4D06F]">
                        {p.role}
                      </div>
                      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md bg-[#0F0A1F]/70 border border-[#D4A93A]/50 rounded-full px-3 py-1 text-[10px] text-white/90 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> View
                      </div>
                    </div>
                    <div className="mt-5">
                      <div className="font-heading text-3xl md:text-4xl leading-tight" data-testid={`leader-name-${p.category}`}>{p.name}</div>
                      <div className="mt-2 text-sm text-[#F4D06F]">{p.role}</div>
                    </div>
                  </div>
                </TiltCard>
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="home-chief-guests-grid">
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

      {/* Licenses (below Gallery) */}
      <section id="license" className="py-20 border-t border-[#D4A93A]/10 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="overline text-[#D4A93A] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Licenses & Certifications
          </div>
          <h2 className="font-heading text-4xl mt-2 mb-3">Registered, compliant & transparent.</h2>
          <p className="text-white/55 text-sm max-w-2xl mb-10">
            Our official licenses and certifications. Click any tile to preview the image or view/download the PDF.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="home-license-grid">
            {LICENSE_SLOTS.map((l) => {
              const m = licenses[l.category];
              if (!m) {
                return (
                  <div key={l.category} className="dp-card p-6 text-center flex flex-col items-center justify-center min-h-[220px] opacity-70" data-testid={`license-empty-${l.index}`}>
                    <FileText className="w-8 h-8 text-[#F4D06F]/40 mb-3" />
                    <div className="overline text-[#D4A93A]">License Slot {l.index}</div>
                    <div className="text-xs text-white/40 mt-1">Awaiting upload</div>
                  </div>
                );
              }
              const isPdf = m.media_type === "pdf";
              return (
                <div
                  key={l.category}
                  className="dp-card overflow-hidden dp-hover-lift cursor-pointer group"
                  onClick={() => openLicense(l, m)}
                  data-testid={`license-card-${l.index}`}
                >
                  <div className="relative h-44 bg-[#0F0A1F]">
                    {isPdf ? (
                      <div className="w-full h-full flex flex-col items-center justify-center text-center px-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7C3AED]/30 to-[#D4A93A]/30 flex items-center justify-center border border-[#D4A93A]/30 mb-2">
                          <FileText className="w-7 h-7 text-[#F4D06F]" />
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-[#F4D06F]">PDF Document</div>
                      </div>
                    ) : (
                      <img src={`${BACKEND}${m.url}`} alt={m.title || `License ${l.index}`} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0F0A1F] via-transparent to-transparent opacity-70" />
                    <div className="absolute top-3 right-3 backdrop-blur-md bg-[#0F0A1F]/70 border border-[#D4A93A]/40 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-widest text-[#F4D06F]">
                      {isPdf ? "PDF" : "Image"}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="font-heading text-lg leading-tight truncate" data-testid={`license-title-${l.index}`}>
                      {m.title || `License ${l.index}`}
                    </div>
                    {m.description && (
                      <p className="text-xs text-white/55 mt-1 line-clamp-2">{m.description}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between text-[10px] text-white/40">
                      <span>{m.issue_date ? `Issued ${m.issue_date}` : ""}</span>
                      <span>{m.expiry_date ? `Expires ${m.expiry_date}` : ""}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Leader/License Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-3xl bg-[#150C2D] border border-[#D4A93A]/30 text-white p-0 overflow-hidden" data-testid="lightbox-modal">
          {lightbox && (
            <div>
              <button
                onClick={() => setLightbox(null)}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black flex items-center justify-center text-white"
                data-testid="lightbox-close"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="grid md:grid-cols-2">
                <div className="bg-[#0F0A1F] flex items-center justify-center min-h-[320px]">
                  {lightbox.type === "leader" ? (
                    lightbox.media?.url ? (
                      <img src={`${BACKEND}${lightbox.media.url}`} alt={lightbox.name} className="max-h-[70vh] w-full object-contain" />
                    ) : (
                      <div className="w-full h-96"><PlaceholderAvatar initial={lightbox.initial} size="text-9xl" /></div>
                    )
                  ) : lightbox.media?.media_type === "pdf" ? (
                    <div className="p-8 text-center">
                      <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#7C3AED]/40 to-[#D4A93A]/40 flex items-center justify-center border border-[#D4A93A]/30 mb-4">
                        <FileText className="w-10 h-10 text-[#F4D06F]" />
                      </div>
                      <div className="text-sm text-white/60">PDF Document</div>
                      <div className="mt-4 flex flex-col gap-2">
                        <a href={`${BACKEND}${lightbox.media.url}`} target="_blank" rel="noreferrer">
                          <Button className="btn-primary w-full" data-testid="lightbox-view-pdf"><ExternalLink className="w-4 h-4 mr-2" /> View in new tab</Button>
                        </a>
                        <a href={`${BACKEND}${lightbox.media.url}`} download>
                          <Button variant="ghost" className="btn-outline-dp w-full" data-testid="lightbox-download-pdf"><Download className="w-4 h-4 mr-2" /> Download</Button>
                        </a>
                      </div>
                    </div>
                  ) : lightbox.media?.url ? (
                    <img src={`${BACKEND}${lightbox.media.url}`} alt={lightbox.media?.title || "License"} className="max-h-[70vh] w-full object-contain" />
                  ) : null}
                </div>
                <div className="p-6 md:p-8 space-y-3">
                  {lightbox.type === "leader" ? (
                    <>
                      <div className="overline text-[#D4A93A]">{lightbox.role}</div>
                      <DialogTitle className="font-heading text-4xl leading-tight" data-testid="lightbox-title">{lightbox.name}</DialogTitle>
                      <DialogDescription className="text-white/60 text-sm">
                        Dreampick Private Limited leadership team member.
                      </DialogDescription>
                    </>
                  ) : (
                    <>
                      <div className="overline text-[#D4A93A]">License · Slot {lightbox.index}</div>
                      <DialogTitle className="font-heading text-3xl leading-tight" data-testid="lightbox-title">
                        {lightbox.media?.title || `License ${lightbox.index}`}
                      </DialogTitle>
                      <DialogDescription className="text-white/60 text-sm">
                        {lightbox.media?.description || "Official document"}
                      </DialogDescription>
                      <div className="grid grid-cols-2 gap-3 pt-3 text-xs">
                        <div className="dp-card p-3">
                          <div className="overline text-white/40 mb-1">Issue Date</div>
                          <div className="text-white/85">{lightbox.media?.issue_date || "—"}</div>
                        </div>
                        <div className="dp-card p-3">
                          <div className="overline text-white/40 mb-1">Expiry Date</div>
                          <div className="text-white/85">{lightbox.media?.expiry_date || "—"}</div>
                        </div>
                      </div>
                      {lightbox.media?.media_type !== "pdf" && lightbox.media?.url && (
                        <a href={`${BACKEND}${lightbox.media.url}`} download className="inline-block pt-2">
                          <Button className="btn-primary" data-testid="lightbox-download-img"><Download className="w-4 h-4 mr-2" /> Download image</Button>
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <footer className="border-t border-[#D4A93A]/15 py-8 text-center text-white/40 text-xs">
        <div className="brand-logo text-lg text-white mb-1"><span className="gold-text">Dreampick</span> Private Limited</div>
        © {new Date().getFullYear()} — GST {cfg.gst_number}
      </footer>
    </div>
  );
}
