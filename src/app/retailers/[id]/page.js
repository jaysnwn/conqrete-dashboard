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
      <div className="p-10 flex flex-col items-center justify-center min-h-screen bg-black">
        <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-cyan-400 font-mono tracking-widest uppercase text-xs">Decrypting Ledger...</p>
      </div>
    );
  }

  if (!retailer) {
    return <div className="p-20 text-center text-red-500 font-bold uppercase">Error: Retailer Data Missing</div>;
  }

  return (
    <div className="p-8 text-white bg-black min-h-screen">
      <button onClick={() => router.back()} className="text-[10px] text-gray-600 mb-6 flex items-center gap-2 font-bold uppercase tracking-widest hover:text-white transition-all">
        ← BACK TO DIRECTORY
      </button>

      {/* RETAILER HEADER CARD */}
      <div className="bg-[#0a0a0a] border border-gray-800 p-8 rounded-2xl mb-10 flex flex-col md:flex-row justify-between items-start md:items-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400"></div>
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">{retailer.store_name}</h1>
          <div className="flex gap-4 mt-2">
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em]">{retailer.location}</p>
            <p className="text-[10px] text-cyan-500 uppercase font-black tracking-[0.2em]">Net-{retailer.payment_cycle_days || 0} Days</p>
          </div>
        </div>
        <div className="text-left md:text-right mt-6 md:mt-0">
          <p className="text-[10px] text-red-500 uppercase font-black tracking-[0.3em] mb-1">Outstanding Balance</p>
          <p className="text-5xl font-mono text-red-500 font-black">
            ₹{Number(retailer.total_pending || 0).toLocaleString()}
          </p>
          <button 
            onClick={() => setIsPayModalOpen(true)} 
            className="mt-6 bg-emerald-500 text-black px-8 py-3 rounded-full font-black hover:bg-emerald-400 transition-all uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-500/10"
          >
            Record Payment Received
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        {/* INVOICE HISTORY */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-6 bg-[#111] border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Sales History</h3>
            <span className="text-[10px] bg-black px-3 py-1 rounded-full font-mono text-gray-600 border border-gray-800">Count: {orders.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] text-gray-600 uppercase border-b border-gray-800 font-black tracking-widest">
                  <th className="p-6">Date</th>
                  <th className="p-6">Invoice #</th>
                  <th className="p-6 text-right">Amount</th>
                  <th className="p-6 text-center">Docs</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-b border-gray-800/30 hover:bg-white/[0.02] transition-colors group">
                    <td className="p-6 text-[11px] text-gray-500 font-mono">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="p-6 text-xs text-white font-bold tracking-tight">{o.order_number}</td>
                    <td className="p-6 text-right font-mono text-white text-sm font-black">₹{Number(o.total_amount || 0).toLocaleString()}</td>
                    <td className="p-6 text-center">
                      <button onClick={() => handlePrint(o)} className="text-[9px] bg-black border border-gray-800 px-3 py-1 rounded text-gray-500 hover:border-cyan-400 hover:text-white transition-all font-black uppercase tracking-tighter">PDF</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAYMENT LEDGER */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-6 bg-[#111] border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-xs font-black text-emerald-500 uppercase tracking-[0.2em]">Credit Ledger</h3>
            <span className="text-[10px] text-emerald-500 font-black tracking-widest uppercase">Lifetime Paid: ₹{Number(retailer.total_paid || 0).toLocaleString()}</span>
          </div>
          <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
            {payments.map(p => (
              <div key={p.id} className="flex justify-between items-center bg-black p-5 rounded-xl border border-gray-800/50 group hover:border-emerald-500/30 transition-all">
                <div>
                  <p className="text-[11px] font-black text-white uppercase tracking-widest">{p.payment_method}</p>
                  <p className="text-[10px] text-gray-600 font-mono mt-1">{new Date(p.received_at).toLocaleDateString()} @ {new Date(p.received_at).toLocaleTimeString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-mono text-emerald-500 font-black">+₹{Number(p.amount || 0).toLocaleString()}</p>
                  <p className="text-[9px] text-emerald-900 uppercase font-black tracking-widest">Entry Confirmed</p>
                </div>
              </div>
            ))}
            {payments.length === 0 && (
              <div className="text-center py-20">
                <p className="text-[10px] text-gray-700 font-black uppercase tracking-[0.3em]">No Payment Entries Found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PAYMENT MODAL */}
      {isPayModalOpen && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-50 backdrop-blur-xl">
          <div className="bg-[#0a0a0a] border border-emerald-500/30 rounded-3xl w-full max-w-sm p-8 shadow-2xl relative">
            <button onClick={() => setIsPayModalOpen(false)} className="absolute top-6 right-6 text-gray-600 hover:text-white text-xl">×</button>
            <h2 className="text-sm font-black text-white mb-8 uppercase tracking-[0.3em] border-b border-gray-800 pb-4">Record Entry</h2>
            <form onSubmit={handleRecordPayment} className="space-y-6">
              <div>
                <label className="block text-[10px] text-gray-600 mb-2 uppercase tracking-widest font-black">Amount Received (₹)</label>
                <input required type="number" autoFocus placeholder="0.00" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full bg-black border border-gray-800 rounded-xl p-5 text-3xl font-mono text-emerald-400 focus:border-emerald-500 focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-600 mb-2 uppercase tracking-widest font-black">Transaction Method</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-white text-[11px] font-black uppercase tracking-widest">
                  <option>UPI</option>
                  <option>Cash</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-emerald-500 text-black py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20">
                Confirm & Sync
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}