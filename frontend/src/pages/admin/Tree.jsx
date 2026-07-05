import React, { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { api, formatApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TreeView } from "@/components/TreeView";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle } from "lucide-react";

export default function AdminTree() {
  const [tree, setTree] = useState(null);
  const [userCode, setUserCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [integrity, setIntegrity] = useState(null);

  const load = async (id) => {
    setLoading(true);
    try {
      const params = id ? { user_id: id, depth: 4 } : { depth: 4 };
      const { data } = await api.get("/admin/tree", { params });
      setTree(data.tree);
    } catch (e) { toast.error(formatApiError(e)); setTree(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const searchByCode = async () => {
    if (!userCode.trim()) { load(); return; }
    try {
      const { data } = await api.get("/admin/users", { params: { q: userCode.trim() } });
      const target = (data.users || []).find(u => u.user_code === userCode.trim().toUpperCase() || u.user_code === userCode.trim());
      if (!target) return toast.error("User not found");
      load(target._id);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const runIntegrity = async () => {
    try {
      const { data } = await api.get("/admin/tree/integrity-check");
      setIntegrity(data);
      toast[data.ok ? "success" : "warning"](data.ok ? "Tree is healthy" : `Issues: ${data.issues.length}`);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-tree-page">
        <div>
          <div className="overline text-[#00E5FF]">Tree Explorer</div>
          <h1 className="font-heading text-3xl mt-1">Binary Tree</h1>
        </div>
        <div className="dp-card p-4 flex flex-wrap gap-3">
          <Input placeholder="Search by user code (e.g., DP00003)" value={userCode} onChange={(e) => setUserCode(e.target.value)}
            className="max-w-xs bg-[#070B14] border-white/10" data-testid="admin-tree-search-input" />
          <Button className="btn-primary" onClick={searchByCode} data-testid="admin-tree-search-btn">Search</Button>
          <Button variant="ghost" className="btn-outline-dp" onClick={() => { setUserCode(""); load(); }} data-testid="admin-tree-reset-btn">Reset to root</Button>
          <Button variant="ghost" className="btn-outline-dp ml-auto" onClick={runIntegrity} data-testid="admin-tree-integrity-btn">Run Integrity Check</Button>
        </div>

        {integrity && (
          <div className={`dp-card p-4 flex gap-3 items-start ${integrity.ok ? "border-[#00FFA3]/30" : "border-yellow-400/30"}`} data-testid="admin-integrity-result">
            {integrity.ok ? <CheckCircle2 className="w-5 h-5 text-[#00FFA3]" /> : <AlertCircle className="w-5 h-5 text-yellow-400" />}
            <div>
              <div className="font-heading">{integrity.ok ? "Tree healthy" : `Found ${integrity.issues.length} issues`}</div>
              {!integrity.ok && (
                <ul className="text-xs text-white/60 mt-2 space-y-1">
                  {integrity.issues.slice(0, 5).map((i, k) => <li key={k}>• {i.type}: {JSON.stringify(i)}</li>)}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="dp-card min-h-[460px]">
          {loading ? <div className="p-10 text-white/40 animate-pulse">Loading tree…</div> : <TreeView tree={tree} />}
        </div>
      </div>
    </AdminLayout>
  );
}
