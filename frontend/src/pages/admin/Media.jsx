import React, { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { api, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2, Upload, Image as ImageIcon } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const SINGLE_SLOTS = [
  { cat: "COMPANY_LOGO", label: "Company Logo", desc: "Shown in navbar and login screen" },
  { cat: "HERO_SCOOTER", label: "Hero Section Scooter Image", desc: "Home page hero product image" },
  { cat: "HERO_BACKGROUND", label: "Hero Background Image", desc: "Optional decorative background" },
  { cat: "ABOUT_US", label: "About Us Image", desc: "Displayed in the About Us section" },
  { cat: "CHIEF_GUEST_MR_FAZI", label: "Chief Guest — Mr Fazi", desc: "Financial Management & Training Head" },
  { cat: "CHIEF_GUEST_VISHAL_MEHARVADE", label: "Chief Guest — Vishal Meharvade", desc: "IT Head" },
  { cat: "CHIEF_GUEST_SRINIVAS", label: "Chief Guest — Srinivas", desc: "Business Head" },
  { cat: "CHIEF_GUEST_HEMANTH_KUMAR", label: "Chief Guest — Hemanth Kumar", desc: "Marketing Head" },
];

const MULTI_SLOTS = [
  { cat: "GALLERY_IMAGE", label: "Gallery Image", desc: "Photos for the gallery slider" },
  { cat: "GALLERY_VIDEO", label: "Gallery Video", desc: "Videos for the gallery slider" },
];

function SlotUploader({ slot, current, onChange, multi = false }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [order, setOrder] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [busy, setBusy] = useState(false);

  const pick = (f) => {
    setFile(f);
    if (f) setPreviewUrl(URL.createObjectURL(f));
  };

  const upload = async () => {
    if (!file) { toast.error("Choose a file first"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("category", slot.cat);
      if (title) fd.append("title", title);
      if (caption) fd.append("caption", caption);
      fd.append("display_order", String(order));
      fd.append("visible", "true");
      fd.append("file", file);
      const token = localStorage.getItem("dp_access_token");
      const res = await fetch(`${API_BASE}/admin/media/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(`${slot.label} uploaded`);
      setFile(null); setTitle(""); setCaption(""); setPreviewUrl(null); setOrder(0);
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
            {m.media_type === "video" ? (
              <video className="w-24 h-16 rounded object-cover bg-black" src={`${BACKEND}${m.url}`} />
            ) : (
              <img src={`${BACKEND}${m.url}`} alt={m.title || slot.label} className="w-24 h-16 rounded object-cover" />
            )}
            <div className="flex-1 text-xs text-white/60 truncate">
              <div className="text-white/80 text-sm truncate">{m.title || "Untitled"}</div>
              {m.caption && <div className="truncate">{m.caption}</div>}
            </div>
            <Button size="sm" variant="ghost" className="text-red-400 text-xs" onClick={() => remove(m._id)} data-testid={`delete-media-${m._id.slice(0,8)}`}><Trash2 className="w-3 h-3" /></Button>
          </div>
        ))}
      </div>
      {/* Upload form */}
      <div className="space-y-2 border-t border-white/5 pt-3">
        {multi && (
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs text-white/60">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-[#0F0A1F] border-white/10 h-9 mt-1" data-testid={`${slot.cat}-title-input`} /></div>
            <div><Label className="text-xs text-white/60">Display order</Label><Input type="number" value={order} onChange={(e) => setOrder(parseInt(e.target.value || 0))} className="bg-[#0F0A1F] border-white/10 h-9 mt-1" /></div>
            <div className="col-span-2"><Label className="text-xs text-white/60">Caption</Label><Input value={caption} onChange={(e) => setCaption(e.target.value)} className="bg-[#0F0A1F] border-white/10 h-9 mt-1" /></div>
          </div>
        )}
        <input type="file" accept={isVideo ? "video/*" : (slot.cat === "GALLERY_IMAGE" ? "image/*,video/*" : "image/*")}
          onChange={(e) => pick(e.target.files[0])}
          className="w-full text-xs text-white/80 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-[#7C3AED] file:text-white"
          data-testid={`${slot.cat}-file-input`} />
        {previewUrl && !isVideo && <img src={previewUrl} alt="preview" className="w-full h-40 object-cover rounded border border-[#D4A93A]/30" data-testid={`${slot.cat}-preview`} />}
        {previewUrl && isVideo && <video src={previewUrl} controls className="w-full h-40 rounded" />}
        <Button className="btn-primary w-full" onClick={upload} disabled={busy || !file} data-testid={`${slot.cat}-upload-btn`}>
          <Upload className="w-4 h-4 mr-2" /> {items.length > 0 && !multi ? "Replace" : "Upload"}
        </Button>
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
    } catch (_) {}
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-media-page">
        <div>
          <div className="overline text-[#D4A93A]">Media Manager</div>
          <h1 className="font-heading text-3xl mt-1">Upload & manage media</h1>
          <p className="text-xs text-white/50 mt-2">Each media category maps to exactly one place on the website. Single-slot uploads (logo, hero, chief guests, about) auto-replace previous uploads. Gallery accepts multiple.</p>
        </div>

        <div>
          <div className="overline text-white/50 mb-3">Single slots</div>
          <div className="grid md:grid-cols-2 gap-4">
            {SINGLE_SLOTS.map((s) => (
              <SlotUploader key={s.cat} slot={s} current={byCat[s.cat]?.[0] || null} onChange={load} />
            ))}
          </div>
        </div>

        <div>
          <div className="overline text-white/50 mb-3">Gallery (multiple entries allowed)</div>
          <div className="grid md:grid-cols-2 gap-4">
            {MULTI_SLOTS.map((s) => (
              <SlotUploader key={s.cat} slot={s} current={byCat[s.cat] || []} onChange={load} multi />
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
