import React, { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { api, formatApiError, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";

const SECTIONS = ["hero", "leadership", "managers", "gallery", "logo"];
const MANAGERS = ["Santhosh", "Durgesh Koli", "Manjunath Mudhol", "Hanumanth Raj", "Maruthi Ganti"];
const LEADERSHIP = ["Suma B", "Venkatesh Naik"];

export default function AdminMedia() {
  const [rows, setRows] = useState([]);
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState({ section: "gallery", media_type: "image", title: "", caption: "", display_order: 0, visible: true, person_name: "" });

  const load = async () => {
    try { const { data } = await api.get("/admin/media"); setRows(data.media || []); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const upload = async (e) => {
    e.preventDefault();
    if (!file) { toast.error("Please choose a file"); return; }
    const fd = new FormData();
    Object.entries(meta).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append("file", file);
    try {
      const token = localStorage.getItem("dp_access_token");
      const res = await fetch(`${API_BASE}/admin/media/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      toast.success("Uploaded");
      setFile(null);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this media?")) return;
    await api.delete(`/admin/media/${id}`);
    toast.success("Deleted");
    load();
  };

  const personOptions = meta.section === "managers" ? MANAGERS : meta.section === "leadership" ? LEADERSHIP : [];

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-media-page">
        <div>
          <div className="overline text-[#D4A93A]">Media Manager</div>
          <h1 className="font-heading text-3xl mt-1">Upload photos & videos</h1>
          <p className="text-xs text-white/50 mt-1">Assign each upload to the correct section and person. Photos will not appear on the public site until uploaded and marked visible.</p>
        </div>

        <form onSubmit={upload} className="dp-card p-6 grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-white/70">Section</Label>
            <Select value={meta.section} onValueChange={(v) => setMeta({ ...meta, section: v, person_name: "" })}>
              <SelectTrigger className="bg-[#0F0A1F] border-white/10 mt-1" data-testid="media-section-select"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1F1836] border-white/10 text-white">
                {SECTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {personOptions.length > 0 && (
            <div>
              <Label className="text-xs text-white/70">Person</Label>
              <Select value={meta.person_name} onValueChange={(v) => setMeta({ ...meta, person_name: v })}>
                <SelectTrigger className="bg-[#0F0A1F] border-white/10 mt-1" data-testid="media-person-select"><SelectValue placeholder="Select person" /></SelectTrigger>
                <SelectContent className="bg-[#1F1836] border-white/10 text-white">
                  {personOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs text-white/70">Media type</Label>
            <Select value={meta.media_type} onValueChange={(v) => setMeta({ ...meta, media_type: v })}>
              <SelectTrigger className="bg-[#0F0A1F] border-white/10 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1F1836] border-white/10 text-white">
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs text-white/70">Title</Label><Input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} className="bg-[#0F0A1F] border-white/10 mt-1" data-testid="media-title-input" /></div>
          <div><Label className="text-xs text-white/70">Caption</Label><Input value={meta.caption} onChange={(e) => setMeta({ ...meta, caption: e.target.value })} className="bg-[#0F0A1F] border-white/10 mt-1" /></div>
          <div><Label className="text-xs text-white/70">Order</Label><Input type="number" value={meta.display_order} onChange={(e) => setMeta({ ...meta, display_order: parseInt(e.target.value || 0) })} className="bg-[#0F0A1F] border-white/10 mt-1" /></div>
          <div className="md:col-span-3">
            <Label className="text-xs text-white/70">File (max 25MB, images or videos)</Label>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} className="mt-1 w-full text-sm text-white/80 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-[#7C3AED] file:text-white" data-testid="media-file-input" />
          </div>
          <div className="md:col-span-3">
            <Button type="submit" className="btn-primary" data-testid="media-upload-btn"><Upload className="w-4 h-4 mr-2" /> Upload</Button>
          </div>
        </form>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {rows.map(m => (
            <div key={m._id} className="dp-card p-3">
              {m.media_type === "video" ? (
                <video controls className="w-full h-40 bg-black rounded" src={`${process.env.REACT_APP_BACKEND_URL}${m.url}`} />
              ) : (
                <img src={`${process.env.REACT_APP_BACKEND_URL}${m.url}`} alt={m.title} className="w-full h-40 object-cover rounded" />
              )}
              <div className="mt-2 text-xs">
                <div className="font-medium">{m.title || "Untitled"}</div>
                <div className="text-white/50">{m.section} {m.person_name ? `· ${m.person_name}` : ""}</div>
              </div>
              <Button size="sm" variant="ghost" className="text-red-400 mt-2 text-xs w-full" onClick={() => remove(m._id)}><Trash2 className="w-3 h-3 mr-1" /> Delete</Button>
            </div>
          ))}
          {rows.length === 0 && <div className="col-span-full text-white/40 text-center py-6">No media uploaded yet.</div>}
        </div>
      </div>
    </AdminLayout>
  );
}
