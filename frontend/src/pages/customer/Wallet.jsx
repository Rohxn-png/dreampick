import React, { useEffect, useState } from "react";
import { CustomerLayout } from "@/components/CustomerLayout";
import { api, formatApiError, formatINR, shortDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "sonner";

export default function CustomerWallet() {
  const [wallet, setWallet] = useState(null);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [bankId, setBankId] = useState("");
  const [newBank, setNewBank] = useState({ account_holder: "", account_number: "", ifsc: "", bank_name: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [w, b] = await Promise.all([api.get("/customer/wallet"), api.get("/customer/bank-accounts")]);
      setWallet(w.data);
      setBanks(b.data.bank_accounts || []);
      if (b.data.bank_accounts?.length && !bankId) setBankId(b.data.bank_accounts[0]._id);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addBank = async (e) => {
    e.preventDefault();
    try {
      await api.post("/customer/bank-accounts", newBank);
      setNewBank({ account_holder: "", account_number: "", ifsc: "", bank_name: "" });
      toast.success("Bank account added");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const requestWithdrawal = async (e) => {
    e.preventDefault();
    if (!bankId) { toast.error("Please add a bank account first"); return; }
    try {
      await api.post("/customer/withdrawals", { amount: parseFloat(amount), bank_account_id: bankId });
      toast.success("Withdrawal request submitted");
      setAmount("");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  if (loading || !wallet) {
    return <CustomerLayout><div className="text-white/40 animate-pulse">Loading wallet…</div></CustomerLayout>;
  }

  return (
    <CustomerLayout>
      <div className="space-y-6" data-testid="customer-wallet-page">
        <div>
          <div className="overline text-[#F4D06F]">Wallet</div>
          <h1 className="font-heading text-3xl mt-1">Balance & Withdrawals</h1>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="dp-card p-5" data-testid="wallet-available">
            <div className="overline text-white/50">Available</div>
            <div className="font-heading text-2xl text-[#F4D06F] mt-2">{formatINR(wallet.available_balance)}</div>
          </div>
          <div className="dp-card p-5" data-testid="wallet-pending">
            <div className="overline text-white/50">Pending (commissions)</div>
            <div className="font-heading text-2xl text-yellow-300 mt-2">{formatINR(wallet.pending_balance)}</div>
          </div>
          <div className="dp-card p-5" data-testid="wallet-paid">
            <div className="overline text-white/50">Total Paid</div>
            <div className="font-heading text-2xl text-[#F4D06F] mt-2">{formatINR(wallet.total_paid)}</div>
          </div>
          <div className="dp-card p-5" data-testid="wallet-withdrawn">
            <div className="overline text-white/50">Withdrawn</div>
            <div className="font-heading text-2xl mt-2">{formatINR(wallet.total_withdrawn)}</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="dp-card p-6">
            <div className="overline text-[#F4D06F] mb-3">Bank Accounts</div>
            {banks.length > 0 && (
              <div className="space-y-2 mb-4">
                {banks.map(b => (
                  <div key={b._id} className="flex justify-between items-center border border-white/5 rounded-lg px-3 py-2 text-sm" data-testid={`bank-row-${b._id}`}>
                    <div>
                      <div>{b.bank_name}</div>
                      <div className="text-white/50 font-mono text-xs">{b.account_number}</div>
                    </div>
                    <div className="text-xs text-white/50">{b.ifsc}</div>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={addBank} className="space-y-3 border-t border-white/10 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-white/60">Bank Name</Label>
                  <Input required value={newBank.bank_name} onChange={(e) => setNewBank({ ...newBank, bank_name: e.target.value })}
                    className="bg-[#0F0A1F] border-white/10 h-10 mt-1" data-testid="bank-bank-name-input" />
                </div>
                <div>
                  <Label className="text-xs text-white/60">Holder</Label>
                  <Input required value={newBank.account_holder} onChange={(e) => setNewBank({ ...newBank, account_holder: e.target.value })}
                    className="bg-[#0F0A1F] border-white/10 h-10 mt-1" data-testid="bank-account-holder-input" />
                </div>
                <div>
                  <Label className="text-xs text-white/60">Account Number</Label>
                  <Input required value={newBank.account_number} onChange={(e) => setNewBank({ ...newBank, account_number: e.target.value })}
                    className="bg-[#0F0A1F] border-white/10 h-10 mt-1" data-testid="bank-account-number-input" />
                </div>
                <div>
                  <Label className="text-xs text-white/60">IFSC</Label>
                  <Input required value={newBank.ifsc} onChange={(e) => setNewBank({ ...newBank, ifsc: e.target.value })}
                    className="bg-[#0F0A1F] border-white/10 h-10 mt-1" data-testid="bank-ifsc-input" />
                </div>
              </div>
              <Button type="submit" className="btn-primary w-full" data-testid="bank-add-btn">Add Bank Account</Button>
              <div className="text-[10px] text-white/40">Demo only — account number is masked in all views.</div>
            </form>
          </div>

          <div className="dp-card p-6">
            <div className="overline text-[#F4D06F] mb-3">Request Withdrawal</div>
            <form onSubmit={requestWithdrawal} className="space-y-3">
              <div>
                <Label className="text-xs text-white/60">Amount</Label>
                <Input required type="number" step="0.01" min="1" value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="bg-[#0F0A1F] border-white/10 h-10 mt-1" placeholder="₹" data-testid="withdrawal-amount-input" />
              </div>
              <div>
                <Label className="text-xs text-white/60">Bank Account</Label>
                <Select value={bankId} onValueChange={setBankId}>
                  <SelectTrigger className="bg-[#0F0A1F] border-white/10 mt-1" data-testid="withdrawal-bank-select">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1F1836] border-white/10 text-white">
                    {banks.map(b => (
                      <SelectItem key={b._id} value={b._id}>{b.bank_name} · {b.account_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="btn-primary w-full" type="submit" data-testid="withdrawal-submit-btn">Submit Request</Button>
              <div className="text-[10px] text-white/40">
                Withdrawals require admin approval. Only APPROVED commission balance is withdrawable.
              </div>
            </form>
          </div>
        </div>

        <div className="dp-card p-6">
          <div className="overline text-white/50 mb-3">Withdrawal History</div>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/60">Request ID</TableHead>
                <TableHead className="text-white/60">Amount</TableHead>
                <TableHead className="text-white/60">Bank</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Requested</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wallet.withdrawal_requests.map(w => (
                <TableRow key={w._id} className="border-white/5" data-testid={`withdrawal-row-${w._id}`}>
                  <TableCell className="font-mono text-xs">{w._id.slice(0, 8)}</TableCell>
                  <TableCell>{formatINR(w.amount)}</TableCell>
                  <TableCell className="text-white/70">{w.bank_name} · {w.bank_account_masked}</TableCell>
                  <TableCell><span className="text-[#F4D06F]">{w.status}</span></TableCell>
                  <TableCell>{shortDate(w.created_at)}</TableCell>
                </TableRow>
              ))}
              {wallet.withdrawal_requests.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-white/40">No withdrawal requests yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </CustomerLayout>
  );
}
