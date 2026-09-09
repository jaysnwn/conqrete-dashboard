"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import { generateInvoicePDF } from "@/lib/generateInvoice";

export default function RetailerLedger() {
  const params = useParams(); // Get the ID from the URL
  const id = params?.id; 
  const router = useRouter();
  
  const [retailer, setRetailer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("UPI");

  useEffect(() => {
    if (id) {
      fetchLedgerData();
    }
  }, [id]);

  const fetchLedgerData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch the Retailer Info
      const { data: retRes, error: retErr } = await supabase
        .from("retailers")
        .select("*")
        .eq("id", id)
        .single();
      
      if (retErr || !retRes) throw new Error("Retailer not found");

      // 2. Fetch Orders (Matching by store name)
      const { data: ordRes } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_name", retRes.store_name)
        .order("created_at", { ascending: false });

      // 3. Fetch Payments
      const { data: payRes } = await supabase
        .from("retailer_payments")
        .select("*")
        .eq("retailer_id", id)
        .order("received_at", { ascending: false });

      setRetailer(retRes);
      setOrders(ordRes || []);
      setPayments(payRes || []);
    } catch (err) {
      console.error("Ledger Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = async (order) => {
    // Safety check to ensure order items are fetched before printing
    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);
    
    generateInvoicePDF(order, items || []);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;

    const { error: payErr } = await supabase.from("retailer_payments").insert([{
      retailer_id: id,
      amount: amount,
      payment_method: payMethod
    }]);

    if (payErr) return alert("Payment failed: " + payErr.message);

    // Update retailer totals
    await supabase.from("retailers").update({
      total_paid: Number(retailer.total_paid || 0) + amount,
      total_pending: Number(retailer.total_pending || 0) - amount
    }).eq("id", id);

    setPayAmount("");
    setIsPayModalOpen(false);
    fetchLedgerData();
  };

  // --- SAFETY RENDER ---
  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-[#0EA5E9]/30 border-t-[#0EA5E9] rounded-full animate-spin mb-4"></div>
        <p className="text-[#6B7280] font-medium text-sm">Loading ledger...</p>
      </div>
    );
  }

  if (!retailer) {
    return (
      <div className="p-8 text-center text-[#991B1B] font-semibold bg-[#FEE2E2] border border-[#FECACA] rounded-md m-8">
        Error: Retailer Data Missing
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 bg-[#F8F9FA] min-h-screen">
      <button 
        onClick={() => router.back()} 
        className="text-[#6B7280] hover:text-[#111827] text-sm font-medium mb-6 flex items-center gap-2 transition-colors"
      >
        ← Back to Directory
      </button>

      {/* RETAILER HEADER CARD */}
      <div className="bg-white border border-[#E5E7EB] p-6 rounded-lg shadow-sm mb-8 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">{retailer.store_name}</h1>
          <div className="flex gap-4 mt-2">
            <p className="text-sm text-[#6B7280] font-medium">{retailer.location}</p>
            <p className="text-sm text-[#0EA5E9] font-medium">Net {retailer.payment_cycle_days || 0} Days</p>
          </div>
        </div>
        <div className="text-left md:text-right mt-6 md:mt-0">
          <p className="text-sm text-[#6B7280] font-medium mb-1">Outstanding Balance</p>
          <p className="text-3xl font-bold text-[#991B1B]">
            ₹{Number(retailer.total_pending || 0).toLocaleString()}
          </p>
          <button 
            onClick={() => setIsPayModalOpen(true)} 
            className="mt-4 bg-[#0EA5E9] text-white px-6 py-2 rounded-md font-semibold hover:bg-[#0284C7] transition-colors shadow-sm"
          >
            Record Payment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* INVOICE HISTORY */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E5E7EB] flex justify-between items-center bg-[#F9FAFB]">
            <h3 className="text-sm font-semibold text-[#111827]">Sales History</h3>
            <span className="text-xs bg-[#E5E7EB] px-2 py-1 rounded-md text-[#4B5563] font-medium">
              Count: {orders.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#F9FAFB] text-[#6B7280] text-xs font-semibold uppercase tracking-wider border-b border-[#E5E7EB]">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Invoice #</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  <th className="px-6 py-3 text-center">Docs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-6 py-4 text-sm text-[#6B7280] whitespace-nowrap">
                      {new Date(o.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-[#111827]">
                      {o.order_number}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-[#111827]">
                      ₹{Number(o.total_amount || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handlePrint(o)} 
                        className="text-xs text-[#0EA5E9] border border-[#0EA5E9] px-2 py-1 rounded hover:bg-[#0EA5E9] hover:text-white transition-colors font-medium"
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAYMENT LEDGER */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E5E7EB] flex justify-between items-center bg-[#F9FAFB]">
            <h3 className="text-sm font-semibold text-[#111827]">Credit Ledger</h3>
            <span className="text-xs font-semibold text-[#065F46] bg-[#D1FAE5] px-2 py-1 rounded-md border border-[#A7F3D0]">
              Lifetime Paid: ₹{Number(retailer.total_paid || 0).toLocaleString()}
            </span>
          </div>
          <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
            {payments.map(p => (
              <div key={p.id} className="flex justify-between items-center p-4 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors">
                <div>
                  <p className="text-sm font-semibold text-[#111827] uppercase">{p.payment_method}</p>
                  <p className="text-xs text-[#6B7280] mt-1">
                    {new Date(p.received_at).toLocaleDateString()} @ {new Date(p.received_at).toLocaleTimeString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-[#065F46]">+₹{Number(p.amount || 0).toLocaleString()}</p>
                  <p className="text-xs text-[#065F46] mt-1 font-medium">Entry Confirmed</p>
                </div>
              </div>
            ))}
            {payments.length === 0 && (
              <div className="text-center py-10">
                <p className="text-sm text-[#6B7280] font-medium">No Payment Entries Found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PAYMENT MODAL */}
      {isPayModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white border border-[#E5E7EB] rounded-lg w-full max-w-sm p-6 shadow-xl relative">
            <button 
              onClick={() => setIsPayModalOpen(false)} 
              className="absolute top-4 right-4 text-[#6B7280] hover:text-[#111827] text-xl"
            >
              &times;
            </button>
            <h2 className="text-lg font-bold text-[#111827] mb-6 border-b border-[#E5E7EB] pb-3">Record Entry</h2>
            <form onSubmit={handleRecordPayment} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#6B7280] mb-1">Amount Received (₹)</label>
                <input 
                  required 
                  type="number" 
                  autoFocus 
                  placeholder="0.00" 
                  value={payAmount} 
                  onChange={e => setPayAmount(e.target.value)} 
                  className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none text-lg font-semibold" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6B7280] mb-1">Transaction Method</label>
                <select 
                  value={payMethod} 
                  onChange={e => setPayMethod(e.target.value)} 
                  className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none"
                >
                  <option>UPI</option>
                  <option>Cash</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                </select>
              </div>
              <button 
                type="submit" 
                className="w-full bg-[#0EA5E9] text-white py-2 rounded-md font-semibold hover:bg-[#0284C7] transition-colors"
              >
                Confirm & Sync
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}