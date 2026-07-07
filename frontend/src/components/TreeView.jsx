import React from "react";

/**
 * Iterative binary tree renderer that flattens nodes by depth.
 * Avoids recursive JSX to be compatible with the visual-edits babel plugin.
 */
export function TreeView({ tree, onNodeClick }) {
  if (!tree) {
    return (
      <div className="text-center text-white/50 py-10" data-testid="tree-empty">
        No tree data. Complete a payment to appear in the tree.
      </div>
    );
  }

  // Flatten into rows by depth. Each row: array of {node, hasParent, side}.
  const rows = [];
  let current = [{ node: tree, isEmpty: false }];
  const MAX_DEPTH = 4;
  for (let d = 0; d <= MAX_DEPTH; d++) {
    rows.push(current);
    const anyChildren = current.some((x) => !x.isEmpty && (x.node?.left || x.node?.right || x.node?.has_left || x.node?.has_right));
    if (!anyChildren) break;
    const next = [];
    for (const item of current) {
      if (item.isEmpty) {
        next.push({ isEmpty: true });
        next.push({ isEmpty: true });
      } else {
        const n = item.node;
        next.push(n.left ? { node: n.left, isEmpty: false, side: "LEFT" } : { isEmpty: true, side: "LEFT" });
        next.push(n.right ? { node: n.right, isEmpty: false, side: "RIGHT" } : { isEmpty: true, side: "RIGHT" });
      }
    }
    current = next;
  }

  const renderItem = (item, key) => {
    if (item.isEmpty) {
      return (
        <div key={key} className="border border-dashed border-white/10 rounded-lg px-3 py-2 min-w-[120px] text-center text-white/30 text-xs">
          Empty {item.side === "LEFT" ? "L" : item.side === "RIGHT" ? "R" : ""}
        </div>
      );
    }
    const n = item.node;
    const sideCls = n.placement_side === "LEFT" ? "left" : n.placement_side === "RIGHT" ? "right" : "";
    const activeCls = n.status === "ACTIVE" ? "active" : "";
    return (
      <button
        key={key}
        onClick={() => onNodeClick?.(n)}
        className={`tree-node ${sideCls} ${activeCls} px-3 py-2 min-w-[130px] text-left`}
        data-testid={`tree-node-${n.user_code}`}
      >
        <div className="text-[10px] font-mono text-white/50">{n.user_code}</div>
        <div className="text-sm text-white truncate max-w-[120px]">{n.full_name}</div>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-white/50">
          <span>L: {n.left_count}</span>
          <span>R: {n.right_count}</span>
          <span className="text-[#F4D06F]">MP: {n.matched_pairs}</span>
        </div>
      </button>
    );
  };

  return (
    <div className="overflow-auto p-6" data-testid="tree-wrap">
      <div className="min-w-max mx-auto">
        {rows.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-3 mb-6">
            {row.map((item, i) => renderItem(item, `${ri}-${i}`))}
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-6 justify-center text-xs text-white/60">
        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#F4D06F]"></span> Left branch</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#F4D06F]"></span> Right branch</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 border border-dashed border-white/30"></span> Empty slot</div>
      </div>
    </div>
  );
}
