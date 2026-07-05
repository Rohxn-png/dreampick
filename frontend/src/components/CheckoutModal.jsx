import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, formatApiError, formatINR } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export function CheckoutModal({ open, onClose, order, onPaid }) {
  const [loading, setLoading] = useState(null); // 'success' | 'fail'

  const doSimulate = async (kind) => {
    if (!order) return;
    setLoading(kind);
    try {
      const endpoint = kind === "success" ? "simulate-payment-success" : "simulate-payment-failure";
      const { data } = await api.post(`/orders/${order._id}/${endpoint}`);
      if (kind === "success") {
        toast.success("Payment successful — you are now an ACTIVE member.");
        onPaid?.(data);
      } else {
        toast.error("Payment failed (simulated).");
      }
      onClose?.();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="bg-[#0C1222] border-white/10 text-white sm:max-w-md" data-testid="checkout-modal">
        <DialogHeader>
          <DialogTitle className="brand-logo text-xl">Mock Checkout</DialogTitle>
          <p className="text-xs text-white/50 mt-1">Demo mode — no real payment will be charged.</p>
        </DialogHeader>
        {order && (
          <div className="space-y-3">
            <div className="dp-card p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Order</span>
                <span className="font-mono text-white" data-testid="checkout-order-number">{order.order_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Product</span>
                <span>Dream Pick Volt X1</span>
              </div>
              <div className="flex justify-between text-lg pt-2 border-t border-white/10">
                <span className="text-white/60">Total</span>
                <span className="text-[#00E5FF] font-medium" data-testid="checkout-amount">{formatINR(order.amount)}</span>
              </div>
            </div>
            <p className="text-xs text-white/50">
              Use one of the demo actions below to test the flow. On success, you become an ACTIVE member and will be placed in the binary tree.
            </p>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            className="border border-white/10 text-white hover:bg-white/5"
            onClick={() => doSimulate("fail")}
            disabled={!!loading}
            data-testid="checkout-simulate-fail-btn"
          >
            {loading === "fail" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
            Simulate Failure
          </Button>
          <Button
            className="btn-primary"
            onClick={() => doSimulate("success")}
            disabled={!!loading}
            data-testid="checkout-simulate-success-btn"
          >
            {loading === "success" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Simulate Successful Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
