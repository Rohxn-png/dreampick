import React, { useEffect, useState } from "react";
import { CustomerLayout } from "@/components/CustomerLayout";
import { api, formatApiError, shortDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell } from "lucide-react";

export default function CustomerNotifications() {
  const [rows, setRows] = useState([]);
  const load = async () => {
    try { const { data } = await api.get("/customer/notifications"); setRows(data.notifications || []); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);
  const markRead = async (id) => {
    try { await api.patch(`/customer/notifications/${id}/read`); load(); } catch (_) {}
  };
  return (
    <CustomerLayout>
      <div className="space-y-6" data-testid="customer-notifications-page">
        <div>
          <div className="overline text-[#D4A93A]">Notifications</div>
          <h1 className="font-heading text-3xl mt-1">Your updates</h1>
        </div>
        <div className="dp-card p-4">
          {rows.length === 0 && <div className="p-6 text-white/40 text-center">You're all caught up.</div>}
          {rows.map(n => (
            <div key={n._id} className={`p-4 border-b border-white/5 last:border-none flex justify-between gap-3 ${n.read ? "opacity-60" : ""}`} data-testid={`notif-${n._id.slice(0,8)}`}>
              <div className="flex gap-3">
                <Bell className="w-5 h-5 text-[#F4D06F] shrink-0 mt-1" />
                <div>
                  <div className="font-medium">{n.title}</div>
                  <div className="text-sm text-white/70">{n.body}</div>
                  <div className="text-xs text-white/40 mt-1">{shortDate(n.created_at)}</div>
                </div>
              </div>
              {!n.read && <Button size="sm" variant="ghost" className="btn-outline-dp text-xs shrink-0" onClick={() => markRead(n._id)}>Mark read</Button>}
            </div>
          ))}
        </div>
      </div>
    </CustomerLayout>
  );
}
