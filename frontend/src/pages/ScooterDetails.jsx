import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PublicNav } from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { api, formatINR, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { CheckoutModal } from "@/components/CheckoutModal";
import { toast } from "sonner";
import { Battery, Gauge, Zap, Wrench, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";

export default function ScooterDetails() {
  const [scooter, setScooter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/scooters");
        setScooter(data.scooters?.[0] || null);
      } catch (e) {
        toast.error(formatApiError(e));
      }
    })();
  }, []);

  const handleBuyNow = async () => {
    if (!user) {
      navigate("/register");
      return;
    }
    if (user.role !== "CUSTOMER") {
      toast.error("Only customers can purchase.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/orders/create", { scooter_id: scooter?._id });
      setOrder(data.order);
      setModalOpen(true);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const onPaid = async () => {
    await refreshUser();
    navigate("/dashboard");
  };

  if (!scooter) {
    return (
      <div className="min-h-screen bg-[#0F0A1F] text-white">
        <PublicNav />
        <div className="max-w-3xl mx-auto p-10 text-white/50">Loading scooter…</div>
      </div>
    );
  }

  const specs = [
    { label: "Range", value: `${scooter.specs?.range_km} km`, icon: Battery },
    { label: "Top Speed", value: `${scooter.specs?.top_speed_kmph} km/h`, icon: Gauge },
    { label: "Battery", value: scooter.specs?.battery, icon: Zap },
    { label: "Charge Time", value: `${scooter.specs?.charge_time_hours} hrs`, icon: Wrench },
    { label: "Motor", value: scooter.specs?.motor, icon: Sparkles },
    { label: "Warranty", value: `${scooter.specs?.warranty_years} years`, icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-[#0F0A1F] text-white">
      <PublicNav />
      <section className="hero-gradient">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-6">
            <img src={scooter.image_url} alt={scooter.name} className="w-full rounded-3xl border border-white/10 aspect-square object-cover" data-testid="scooter-image" />
          </div>
          <div className="lg:col-span-6 space-y-6">
            <div>
              <div className="overline text-[#F4D06F] mb-2">Flagship Model</div>
              <h1 className="font-heading text-5xl tracking-tight" data-testid="scooter-name">{scooter.name}</h1>
              <p className="mt-3 text-white/70 leading-relaxed" data-testid="scooter-desc">{scooter.description}</p>
            </div>
            <div className="flex items-end gap-4 border-t border-white/10 pt-6">
              <div>
                <div className="overline text-white/50">Price</div>
                <div className="font-heading text-5xl text-[#F4D06F]" data-testid="scooter-price">{formatINR(scooter.price)}</div>
              </div>
              <div className="text-xs text-white/50 pb-2">Includes registration in Dream Pick binary program</div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button className="btn-primary rounded-full px-8 py-6" onClick={handleBuyNow} disabled={loading} data-testid="scooter-buy-btn">
                {loading ? "Preparing…" : "Buy Now"} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              {!user && (
                <Button variant="ghost" className="btn-outline-dp rounded-full px-8 py-6" onClick={() => navigate("/register")} data-testid="scooter-register-btn">
                  Register to buy
                </Button>
              )}
            </div>
            <div className="p-4 bg-[#F4D06F]/5 border border-[#F4D06F]/20 rounded-xl text-xs text-white/70 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-[#F4D06F] shrink-0 mt-0.5" />
              <span>This is a demo. Clicking Buy Now creates a mock order — no real payment is processed.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <h2 className="font-heading text-3xl mb-8">Specifications</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {specs.map((s, i) => (
              <div key={i} className="dp-card p-6" data-testid={`scooter-spec-${i}`}>
                <s.icon className="w-6 h-6 text-[#F4D06F] mb-3" strokeWidth={1.5} />
                <div className="overline text-white/50">{s.label}</div>
                <div className="mt-1 font-heading text-xl">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CheckoutModal open={modalOpen} onClose={() => setModalOpen(false)} order={order} onPaid={onPaid} />
    </div>
  );
}
