import React, { useEffect, useState } from "react";
import { CustomerLayout } from "@/components/CustomerLayout";
import { api, formatApiError, shortDate } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "sonner";

export default function CustomerReferrals() {
  const [directs, setDirects] = useState([]);
  const [downline, setDownline] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/customer/referrals");
        setDirects(data.direct_referrals || []);
        setDownline(data.downline || []);
      } catch (e) {
        toast.error(formatApiError(e));
      } finally { setLoading(false); }
    })();
  }, []);

  const filter = (rows) => {
    if (!q) return rows;
    const ql = q.toLowerCase();
    return rows.filter(r =>
      (r.full_name || "").toLowerCase().includes(ql) ||
      (r.email || "").toLowerCase().includes(ql) ||
      (r.user_code || "").toLowerCase().includes(ql)
    );
  };

  return (
    <CustomerLayout>
      <div className="space-y-6" data-testid="customer-referrals-page">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="overline text-[#00E5FF]">Referrals</div>
            <h1 className="font-heading text-3xl mt-1">Your Team Members</h1>
          </div>
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs bg-[#0C1222] border-white/10" data-testid="customer-referrals-search" />
        </div>

        <div className="dp-card p-6">
          <div className="overline text-white/50 mb-3">Direct referrals ({directs.length})</div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-white/60">User Code</TableHead>
                  <TableHead className="text-white/60">Name</TableHead>
                  <TableHead className="text-white/60">Email</TableHead>
                  <TableHead className="text-white/60">Joined</TableHead>
                  <TableHead className="text-white/60">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={5} className="text-white/40">Loading…</TableCell></TableRow>}
                {filter(directs).map(r => (
                  <TableRow key={r._id} className="border-white/5" data-testid={`referral-row-${r.user_code}`}>
                    <TableCell className="font-mono text-xs">{r.user_code}</TableCell>
                    <TableCell>{r.full_name}</TableCell>
                    <TableCell className="text-white/70">{r.email}</TableCell>
                    <TableCell className="text-white/70">{shortDate(r.created_at)}</TableCell>
                    <TableCell><span className="text-[#00FFA3]">{r.status}</span></TableCell>
                  </TableRow>
                ))}
                {!loading && filter(directs).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-white/40">No direct referrals.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="dp-card p-6">
          <div className="overline text-white/50 mb-3">Full downline ({downline.length})</div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-white/60">User Code</TableHead>
                  <TableHead className="text-white/60">Name</TableHead>
                  <TableHead className="text-white/60">Placement Side</TableHead>
                  <TableHead className="text-white/60">Depth</TableHead>
                  <TableHead className="text-white/60">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filter(downline).map(r => (
                  <TableRow key={r._id} className="border-white/5" data-testid={`downline-row-${r.user_code}`}>
                    <TableCell className="font-mono text-xs">{r.user_code}</TableCell>
                    <TableCell>{r.full_name}</TableCell>
                    <TableCell>
                      <span className={r.placement_side === "LEFT" ? "text-[#00E5FF]" : "text-[#00FFA3]"}>
                        {r.placement_side || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{r.depth ?? "-"}</TableCell>
                    <TableCell><span className="text-[#00FFA3]">{r.status}</span></TableCell>
                  </TableRow>
                ))}
                {!loading && filter(downline).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-white/40">No downline members.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
