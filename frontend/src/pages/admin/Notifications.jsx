import React, { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { api, formatApiError, shortDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AdminNotifications() {
  const [rows, setRows] = useState([]);
  const load = async () => {
    try { const { data } = await api.get("/admin/notifications"); setRows(data.notifications || []); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);
  const markRead = async (id) => { await api.patch(`/admin/notifications/${id}/read`); load(); };
  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-notifications-page">
        <div>
          <div className="overline text-[#D4A93A]">Notifications</div>
          <h1 className="font-heading text-3xl mt-1">Admin activity feed</h1>
        </div>
        <div className="dp-card p-4">
          {rows.length === 0 && <div className="p-6 text-white/40 text-center">Nothing here yet.</div>}
          {rows.map(n => (
            <div key={n._id} className={`p-4 border-b border-white/5 last:border-none flex justify-between gap-3 ${n.read ? "opacity-60" : ""}`}>
              <div>
                <div className="font-medium">{n.title}</div>
                <div className="text-sm text-white/70">{n.body}</div>
                <div className="text-xs text-white/40 mt-1">{shortDate(n.created_at)} · {n.kind}</div>
              </div>
              <div className="flex flex-col gap-2 items-end">
                {n.link && <a href={n.link} className="text-xs text-[#F4D06F] hover:underline">Open</a>}
                {!n.read && <Button size="sm" variant="ghost" className="btn-outline-dp text-xs" onClick={() => markRead(n._id)}>Mark read</Button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
