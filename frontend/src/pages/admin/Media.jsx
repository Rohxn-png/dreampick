import React, { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { api, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, Upload, Image as ImageIcon, FileText, ExternalLink } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";

const CORE_SINGLE_SLOTS = [
  { cat: "COMPANY_LOGO", label: "Company Logo", desc: "Shown in navbar and login screen" },
  { cat: "HERO_SCOOTER", label: "Hero Section Scooter Image", desc: "Home page hero product image" },
  { cat: "HERO_BACKGROUND", label: "Hero Background Image", desc: "Optional decorative background" },
  { cat: "ABOUT_US", label: "About Us Image", desc: "Displayed in the About Us section" },
];

const LEADERSHIP_SLOTS = [
  { cat: "COMPANY_MD_PHOTO", label: "Managing Director — Suma B", desc: "Portrait shown large on the Home leadership card" },
  { cat: "CO_DIRECTOR_PHOTO", label: "Co-Director — Venkatesh Naik", desc: "Portrait shown large on the Home leadership card" },
];

const CHIEF_GUEST_SLOTS = [
  { cat: "CHIEF_GUEST_MR_FAZI", label: "Chief Guest — Mr Fazi", desc: "Financial Management & Training Head" },
  { cat: "CHIEF_GUEST_VISHAL_MEHARVADE", label: "Chief Guest — Vishal Meharvade", desc: "IT Head" },
  { cat: "CHIEF_GUEST_SRINIVAS", label: "Chief Guest — Srinivas", desc: "Business Head" },
  { cat: "CHIEF_GUEST_HEMANTH_KUMAR", label: "Chief Guest — Hemanth Kumar", desc: "Marketing Head" },
];

const LICENSE_SLOTS = Array.from({ length: 6 }).map((_, i) => ({
  cat: `COMPANY_LICENSE_${i + 1}`,
  label: `License / Certificate ${i + 1}`,
  desc: "Upload an image (JPG/PNG/WEBP) or a PDF document",
  license: true,
}));

const MULTI_SLOTS = [
  { cat: "GALLERY_IMAGE", label: "Gallery Image", desc: "Photos for the gallery slider" },
  { cat: "GALLERY_VIDEO", label: "Gallery Video", desc: "Videos for the gallery slider" },
];

function MediaThumb({ m, className = "w-24 h-16" }) {
  if (m.media_type === "video") return <video className={`${className} rounded object-cover bg-black`} src={`${BACKEND}${m.url}`} />;
  if (m.media_type === "pdf") return (
    <div className={`${className} rounded bg-[#0F0A1F] border border-[#D4A93A]/25 flex items-center justify-center`}>
      <FileText className="w-6 h-6 text-[#F4D06F]" />
    </div>
  );
  return <img src={`${BACKEND}${m.url}`} alt={m.title || "media"} className={`${className} rounded object-cover`} />;
}

function SlotUploader({ slot, current, onChange, multi = false }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [order, setOrder] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewIsPdf, setPreviewIsPdf] = useState(false);
  const [busy, setBusy] = useState(false);

  const pick = (f) => {
    setFile(f);
    if (f) {
      const isPdf = /\.pdf$/i.test(f.name || "");
      setPreviewIsPdf(isPdf);
      setPreviewUrl(isPdf ? null : URL.createObjectURL(f));
    }
  };

  const upload = async () => {
    if (!file) { toast.error("Choose a file first"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("category", slot.cat);
      if (title) fd.append("title", title);
      if (caption) fd.append("caption", caption);
      if (description) fd.append("description", description);
      if (issueDate) fd.append("issue_date", issueDate);
      if (expiryDate) fd.append("expiry_date", expiryDate);
      fd.append("display_order", String(order));
      fd.append("visible", "true");
      fd.append("file", file);
      const token = localStorage.getItem("dp_access_token");
      const res = await fetch(`${API_BASE}/admin/media/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(`${slot.label} uploaded`);
      setFile(null); setTitle(""); setCaption(""); setDescription("");
      setIssueDate(""); setExpiryDate(""); setPreviewUrl(null); setPreviewIsPdf(false); setOrder(0);
      onChange();
    } catch (e) { toast.error(e.message || "Upload failed"); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this media?")) return;
    await api.delete(`/admin/media/${id}`);
    toast.success("Deleted");
    onChange();
  };

  const items = Array.isArray(current) ? current : (current ? [current] : []);
  const isVideo = slot.cat === "GALLERY_VIDEO";
  const isLicense = !!slot.license;
  const accept = isVideo
    ? "video/*"
    : (slot.cat === "GALLERY_IMAGE"
        ? "image/*,video/*"
        : (isLicense ? "image/*,application/pdf" : "image/*"));

  return (
    <div className="dp-card p-5 space-y-4" data-testid={`slot-${slot.cat}`}>
      <div>
        <div className="overline text-[#D4A93A]">{slot.label}</div>
        <div className="text-xs text-white/50 mt-1">{slot.desc}</div>
      </div>
      {/* Current media preview */}
      <div className="grid gap-2">
        {items.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-white/40">
            <ImageIcon className="w-6 h-6 mx-auto mb-2 opacity-50" />
            No media uploaded
          </div>
        )}
        {items.map((m) => (
          <div key={m._id} className="flex items-center gap-3 p-2 rounded-lg border border-white/10" data-testid={`current-media-${m._id.slice(0,8)}`}>
            <MediaThumb m={m} />
            <div className="flex-1 text-xs text-white/60 min-w-0">
              <div className="text-white/85 text-sm truncate">{m.title || "Untitled"}</div>
              {isLicense && m.description && <div className="truncate">{m.description}</div>}
              {!isLicense && m.caption && <div className="truncate">{m.caption}</div>}
              {isLicense && (
                <div className="text-[10px] text-white/40 flex gap-3 mt-0.5">
                  {m.issue_date && <span>Issued {m.issue_date}</span>}
                  {m.expiry_date && <span>Expires {m.expiry_date}</span>}
                  {m.media_type && <span className="uppercase text-[#F4D06F]/70">{m.media_type}</span>}
                </div>
              )}
            </div>
            {m.media_type === "pdf" && (
              <a href={`${BACKEND}${m.url}`} target="_blank" rel="noreferrer" className="text-xs text-[#F4D06F] hover:underline flex items-center gap-1" data-testid={`open-pdf-${m._id.slice(0,8)}`}>
                <ExternalLink className="w-3 h-3" /> Open
              </a>
            )}
            <Button size="sm" variant="ghost" className="text-red-400 text-xs" onClick={() => remove(m._id)} data-testid={`delete-media-${m._id.slice(0,8)}`}><Trash2 className="w-3 h-3" /></Button>
          </div>
        ))}
      </div>
      {/* Upload form */}
      <div className="space-y-2 border-t border-white/5 pt-3">
        {isLicense && (
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-xs text-white/60">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., GST Certificate" className="bg-[#0F0A1F] border-white/10 h-9 mt-1" data-testid={`${slot.cat}-title-input`} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-white/60">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this document" className="bg-[#0F0A1F] border-white/10 mt-1 min-h-[64px]" data-testid={`${slot.cat}-description-input`} />
            </div>
            <div>
              <Label className="text-xs text-white/60">Issue date</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="bg-[#0F0A1F] border-white/10 h-9 mt-1" data-testid={`${slot.cat}-issue-date`} />
            </div>
            <div>
              <Label className="text-xs text-white/60">Expiry date</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="bg-[#0F0A1F] border-white/10 h-9 mt-1" data-testid={`${slot.cat}-expiry-date`} />
            </div>
          </div>
        )}
        {multi && !isLicense && (
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs text-white/60">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-[#0F0A1F] border-white/10 h-9 mt-1" data-testid={`${slot.cat}-title-input`} /></div>
            <div><Label className="text-xs text-white/60">Display order</Label><Input type="number" value={order} onChange={(e) => setOrder(parseInt(e.target.value || 0))} className="bg-[#0F0A1F] border-white/10 h-9 mt-1" /></div>
            <div className="col-span-2"><Label className="text-xs text-white/60">Caption</Label><Input value={caption} onChange={(e) => setCaption(e.target.value)} className="bg-[#0F0A1F] border-white/10 h-9 mt-1" /></div>
          </div>
        )}
        <input type="file" accept={accept}
          onChange={(e) => pick(e.target.files[0])}
          className="w-full text-xs text-white/80 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-[#7C3AED] file:text-white"
          data-testid={`${slot.cat}-file-input`} />
        {previewUrl && !isVideo && !previewIsPdf && <img src={previewUrl} alt="preview" className="w-full h-40 object-cover rounded border border-[#D4A93A]/30" data-testid={`${slot.cat}-preview`} />}
        {previewIsPdf && (
          <div className="w-full h-24 rounded border border-[#D4A93A]/30 bg-[#0F0A1F] flex items-center justify-center gap-3 text-[#F4D06F] text-sm">
            <FileText className="w-6 h-6" /> PDF selected — ready to upload
          </div>
        )}
        {previewUrl && isVideo && <video src={previewUrl} controls className="w-full h-40 rounded" />}
        <Button className="btn-primary w-full" onClick={upload} disabled={busy || !file} data-testid={`${slot.cat}-upload-btn`}>
          <Upload className="w-4 h-4 mr-2" /> {items.length > 0 && !multi ? "Replace" : "Upload"}
        </Button>
      </div>
    </div>
  );
}

function PreviewPanel({ byCat }) {
  const groups = [
    { title: "Company", cats: CORE_SINGLE_SLOTS.map(s => s.cat) },
    { title: "Leadership", cats: LEADERSHIP_SLOTS.map(s => s.cat) },
    { title: "Chief Guests", cats: CHIEF_GUEST_SLOTS.map(s => s.cat) },
    { title: "Licenses", cats: LICENSE_SLOTS.map(s => s.cat) },
    { title: "Gallery", cats: MULTI_SLOTS.map(s => s.cat) },
  ];
  return (
    <div className="dp-card p-5" data-testid="media-preview-panel">
      <div className="overline text-[#D4A93A] mb-3">Live Preview — all current media</div>
      <div className="space-y-4">
        {groups.map((g) => {
          const items = g.cats.flatMap((c) => byCat[c] || []);
          return (
            <div key={g.title}>
              <div className="text-xs uppercase tracking-widest text-white/40 mb-2">{g.title}</div>
              {items.length === 0 ? (
                <div className="text-xs text-white/30 italic">No {g.title.toLowerCase()} uploaded yet.</div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {items.map((m) => (
                    <div key={m._id} className="w-32 shrink-0 text-center" data-testid={`preview-item-${m.category}`}>
                      <div className="w-32 h-20"><MediaThumb m={m} className="w-32 h-20" /></div>
                      <div className="text-[10px] text-white/60 mt-1 truncate">{m.title || m.category}</div>
                      <div className="text-[9px] text-[#F4D06F]/70 truncate">{m.category}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminMedia() {
  const [byCat, setByCat] = useState({});
  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/media");
      const grouped = {};
      for (const m of (data.media || [])) {
        if (!grouped[m.category]) grouped[m.category] = [];
        grouped[m.category].push(m);
      }
      setByCat(grouped);
    } catch (_e) { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const section = (title, slots, multi = false) => (
    <div>
      <div className="overline text-white/50 mb-3">{title}</div>
      <div className="grid md:grid-cols-2 gap-4">
        {slots.map((s) => (
          <SlotUploader
            key={s.cat}
            slot={s}
            current={multi ? (byCat[s.cat] || []) : (byCat[s.cat]?.[0] || null)}
            onChange={load}
            multi={multi}
          />
        ))}
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-media-page">
        <div>
          <div className="overline text-[#D4A93A]">Media Manager</div>
          <h1 className="font-heading text-3xl mt-1">Upload & manage media</h1>
          <p className="text-xs text-white/50 mt-2">Each media category maps to exactly one place on the website. Single-slot uploads auto-replace previous uploads. Licenses accept images or PDF documents.</p>
        </div>

        <PreviewPanel byCat={byCat} />

        {section("Company (Logo, Hero, About)", CORE_SINGLE_SLOTS)}
        {section("Leadership (MD & Co-Director)", LEADERSHIP_SLOTS)}
        {section("Chief Guests", CHIEF_GUEST_SLOTS)}
        {section("Licenses & Certificates (image or PDF, 6 slots)", LICENSE_SLOTS)}
        {section("Gallery (multiple entries allowed)", MULTI_SLOTS, true)}
      </div>
    </AdminLayout>
  );
}
