import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { api, formatApiError, shortDate } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Shield, Ban, Check, Search } from "lucide-react";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (status !== "all") params.status = status;
      if (role !== "all") params.role = role;
      const { data } = await api.get("/admin/users", { params });
      setUsers(data.users);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [status, role]);

  const openDetail = async (u) => {
    setSelected(u);
    setDetail(null);
    try {
      const { data } = await api.get(`/admin/users/${u._id}`);
      setDetail(data);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const updateStatus = async (uid, newStatus) => {
    try {
      await api.patch(`/admin/users/${uid}/status`, { status: newStatus });
      toast.success(`User status updated to ${newStatus}`);
      load();
      if (selected?._id === uid) setSelected(null);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-users-page">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="overline text-[#F4D06F]">Users</div>
            <h1 className="font-heading text-3xl mt-1">Members ({users.length})</h1>
          </div>
        </div>

        <div className="dp-card p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[240px]">
            <div className="overline text-white/50 mb-1">Search</div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-white/40" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
                placeholder="Name, email, phone, user code, referral…" className="pl-9 bg-[#0F0A1F] border-white/10" data-testid="admin-users-search" />
            </div>
          </div>
          <div>
            <div className="overline text-white/50 mb-1">Status</div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-[#0F0A1F] border-white/10 w-40" data-testid="admin-users-status-filter"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1F1836] border-white/10 text-white">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="overline text-white/50 mb-1">Role</div>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="bg-[#0F0A1F] border-white/10 w-40" data-testid="admin-users-role-filter"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1F1836] border-white/10 text-white">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="CUSTOMER">Customer</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="btn-primary" onClick={load} data-testid="admin-users-search-btn">Search</Button>
        </div>

        <div className="dp-card p-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/60">Code</TableHead>
                <TableHead className="text-white/60">Name</TableHead>
                <TableHead className="text-white/60">Email</TableHead>
                <TableHead className="text-white/60">Role</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">L/R</TableHead>
                <TableHead className="text-white/60">Pairs</TableHead>
                <TableHead className="text-white/60">Joined</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={9} className="text-white/40">Loading…</TableCell></TableRow>}
              {users.map(u => (
                <TableRow key={u._id} className="border-white/5" data-testid={`admin-user-row-${u.user_code}`}>
                  <TableCell className="font-mono text-xs">{u.user_code}</TableCell>
                  <TableCell>{u.full_name}</TableCell>
                  <TableCell className="text-white/70">{u.email}</TableCell>
                  <TableCell><span className="text-[#F4D06F]">{u.role}</span></TableCell>
                  <TableCell><span className={u.status === "ACTIVE" ? "text-[#F4D06F]" : u.status === "PENDING" ? "text-yellow-300" : "text-red-400"}>{u.status}</span></TableCell>
                  <TableCell className="font-mono">{u.left_count}/{u.right_count}</TableCell>
                  <TableCell>{u.matched_pairs}</TableCell>
                  <TableCell className="text-white/70">{shortDate(u.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Link to={`/admin/users/${u._id}`}><Button size="sm" variant="ghost" className="btn-outline-dp text-xs" data-testid={`admin-user-view-${u.user_code}`}>View</Button></Link>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && users.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-white/40">No users found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-[#1F1836] border-white/10 text-white max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="admin-user-detail-modal">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {selected?.full_name} <span className="text-white/50 text-sm font-mono">({selected?.user_code})</span>
            </DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>Email: <span className="text-white/70">{detail.user.email}</span></div>
                <div>Phone: <span className="text-white/70">{detail.user.phone}</span></div>
                <div>Status: <span className="text-[#F4D06F]">{detail.user.status}</span></div>
                <div>Referral: <span className="font-mono">{detail.user.referral_code}</span></div>
                <div>Left Count: {detail.tree_node?.left_count ?? "-"}</div>
                <div>Right Count: {detail.tree_node?.right_count ?? "-"}</div>
                <div>Matched Pairs: {detail.tree_node?.matched_pairs ?? "-"}</div>
                <div>Depth: {detail.tree_node?.depth ?? "-"}</div>
              </div>
              <div className="border-t border-white/5 pt-3">
                <div className="overline text-white/50">Orders ({detail.orders.length})</div>
                <div className="mt-2 space-y-1">{detail.orders.slice(0, 5).map(o => (
                  <div key={o._id} className="flex justify-between text-xs"><span>{o.order_number}</span><span>{o.payment_status}</span></div>
                ))}</div>
              </div>
              <div className="border-t border-white/5 pt-3">
                <div className="overline text-white/50">Commissions ({detail.commissions.length})</div>
                <div className="mt-2 space-y-1">{detail.commissions.slice(0, 5).map(c => (
                  <div key={c._id} className="flex justify-between text-xs"><span>Pair #{c.matched_pair_number}</span><span>{c.status}</span></div>
                ))}</div>
              </div>
            </div>
          ) : <div className="text-white/40 py-6">Loading…</div>}
          <DialogFooter className="gap-2">
            {selected?.status !== "BLOCKED" && (
              <Button variant="ghost" onClick={() => updateStatus(selected._id, "BLOCKED")} className="border border-red-400/30 text-red-400 hover:bg-red-400/10" data-testid="admin-user-block-btn">
                <Ban className="w-4 h-4 mr-2" /> Block
              </Button>
            )}
            {selected?.status === "BLOCKED" && (
              <Button variant="ghost" onClick={() => updateStatus(selected._id, "ACTIVE")} className="btn-outline-dp" data-testid="admin-user-unblock-btn">
                <Check className="w-4 h-4 mr-2" /> Unblock
              </Button>
            )}
            {selected?.status === "PENDING" && (
              <Button className="btn-primary" onClick={() => updateStatus(selected._id, "ACTIVE")} data-testid="admin-user-activate-btn">
                <Shield className="w-4 h-4 mr-2" /> Activate
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
