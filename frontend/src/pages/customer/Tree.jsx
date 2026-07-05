import React, { useEffect, useState } from "react";
import { CustomerLayout } from "@/components/CustomerLayout";
import { api, formatApiError } from "@/lib/api";
import { TreeView } from "@/components/TreeView";
import { toast } from "sonner";

export default function CustomerTree() {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/customer/tree?depth=4");
        setTree(data.tree);
      } catch (e) {
        toast.error(formatApiError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <CustomerLayout>
      <div className="space-y-6" data-testid="customer-tree-page">
        <div>
          <div className="overline text-[#00E5FF]">Binary Tree</div>
          <h1 className="font-heading text-3xl mt-1">My Team</h1>
          <p className="text-white/60 text-sm mt-1">Interactive view of your team — scroll and click nodes to explore.</p>
        </div>
        <div className="dp-card min-h-[420px]">
          {loading ? <div className="p-10 text-white/40 animate-pulse">Loading tree…</div> : <TreeView tree={tree} />}
        </div>
      </div>
    </CustomerLayout>
  );
}
