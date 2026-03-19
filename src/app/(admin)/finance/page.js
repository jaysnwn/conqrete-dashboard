"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

export default function FinancePage() {
  const [orders, setOrders] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const fetchFinanceData = async () => {
    setIsLoading(true);
    const [ordRes, retRes] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("retailers").select("*").order("total_pending", { ascending: false })
    ]);

    setOrders(ordRes.data || []);
    setRetailers(retRes.data || []);
    setIsLoading(false);
  };

  // --- FINANCIAL METRICS ---
  const stats = useMemo(() => {
    const totalOutstanding = retailers.reduce((sum, r) => sum + Number(r.total_pending || 0), 0);
    const totalCollected = orders.reduce((sum, o) => sum + Number(o.amount_paid || 0), 0);
    const unpaidInvoices = orders.filter(o => o.payment_status !== 'Paid').length;

    return { totalOutstanding, totalCollected, unpaidInvoices };
  }, [orders, retailers]);

  // --- HANDLE INCOMING PAYMENT ---
  const handleLogPayment = async (e) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    
    if (!amount || amount <= 0) return alert("Please enter a valid payment amount.");

    const currentPaid = Number(selectedOrder.amount_paid || 0);
    const orderTotal = Number(selectedOrder.total_amount);
    const newAmountPaid = currentPaid + amount;
    
    // Determine new status
    let newStatus = "Partial";
    if (newAmountPaid >= orderTotal) {
      newStatus = "Paid";
    }

    try {
      // 1. Update the Order
      const { error: orderErr } = await supabase
        .from("orders")
        .update({ 
          amount_paid: newAmountPaid,
          payment_status: newStatus 
        })
        .eq("id", selectedOrder.id);

      if (orderErr) throw orderErr;

      // 2. Update the Retailer's Total Pending Debt
      const retailer = retailers.find(r => r.store_name === selectedOrder.customer_name);
      if (retailer) {
        const newPending = Math.max(0, Number(retailer.total_pending || 0) - amount); // Prevent negative debt
        await supabase
          .from("retailers")
          .update({ total_pending: newPending })
          .eq("id", retailer.id);
      }

      alert(`₹${amount.toLocaleString()} logged successfully for ${selectedOrder.order_number}!`);
      setIsPaymentModalOpen(false);
      setPaymentAmount("");
      setSelectedOrder(null);
      fetchFinanceData(); // Refresh everything

    } catch (err) {
      alert("Error logging payment: " + err.message);
    }
  };

  const openPaymentModal = (order) => {
    setSelectedOrder(order);
    // Auto-fill the remaining balance to make it faster for the user
    const remaining = Number(order.total_amount) - Number(order.amount_paid || 0);
    setPaymentAmount(remaining);
    setIsPaymentModalOpen(true);
  };

  // Only show unpaid or partial orders in the active queue
  const activeInvoices = orders.filter(o => o.payment_status !== 'Paid');

  return (
    <div className="text-gray-200 pb-10">
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-wider uppercase">Accounts Receivable</h1>
        <p className="text-sm text-gray-500 mt-1">Cash flow, ledger payments, and outstanding debt</p>
      </div>

      {/* FINANCE STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-[#111] border border-red-900/30 p-6 rounded-lg shadow-lg relative overflow-hidden">
          <p className="text-xs text-red-500 font-bold tracking-widest mb-1 uppercase">Total Market Debt (Outstanding)</p>
          <p className="text-4xl font-mono text-red-400 font-black">₹{stats.totalOutstanding.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-[#111] border border-emerald-900/30 p-6 rounded-lg shadow-lg relative overflow-hidden">
          <p className="text-xs text-emerald-500 font-bold tracking-widest mb-1 uppercase">Total Cash Collected</p>
          <p className="text-4xl font-mono text-emerald-400 font-black">₹{stats.totalCollected.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-[#111] border border-gray-800 p-6 rounded-lg shadow-lg relative overflow-hidden">
          <p className="text-xs text-gray-500 font-bold tracking-widest mb-1 uppercase">Active Unpaid Invoices</p>
          <p className="text-4xl font-mono text-white font-black">{stats.unpaidInvoices}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: ACTIVE INVOICES */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#111] border border-gray-800 rounded-lg p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Invoices Awaiting Payment</h3>
            
            {isLoading ? (
              <p className="text-cyan-400 animate-pulse font-mono text-sm">Syncing Ledgers...</p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-[10px] text-gray-500 uppercase tracking-widest">
                    <th className="pb-3 font-bold">Invoice Ref</th>
                    <th className="pb-3 font-bold">Client</th>
                    <th className="pb-3 text-right font-bold">Total Bill</th>
                    <th className="pb-3 text-right font-bold">Remaining</th>
                    <th className="pb-3 text-center font-bold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {activeInvoices.map(o => {
                    const total = Number(o.total_amount);
                    const paid = Number(o.amount_paid || 0);
                    const remaining = total - paid;
                    const statusColor = o.payment_status === 'Partial' ? 'text-orange-400' : 'text-red-400';

                    return (
                      <tr key={o.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4">
                          <p className="font-mono text-cyan-400 text-sm font-bold">{o.order_number}</p>
                          <p className={`text-[9px] uppercase font-bold mt-1 ${statusColor}`}>{o.payment_status || 'Unpaid'}</p>
                        </td>
                        <td className="py-4 text-sm font-bold text-gray-300 uppercase">{o.customer_name}</td>
                        <td className="py-4 text-right font-mono text-gray-400">₹{total.toLocaleString()}</td>
                        <td className="py-4 text-right font-mono text-white font-black">₹{remaining.toLocaleString()}</td>
                        <td className="py-4 text-center">
                          <button 
                            onClick={() => openPaymentModal(o)}
                            className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-black transition-all"
                          >
                            Log Payment
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {activeInvoices.length === 0 && (
                    <tr><td colSpan="5" className="py-8 text-center text-gray-500 text-sm">All invoices are fully paid!</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: RETAILER DEBT LEADERBOARD */}
        <div className="space-y-6">
          <div className="bg-[#111] border border-gray-800 rounded-lg p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Top Debtors</h3>
            <div className="space-y-4">
              {retailers.filter(r => r.total_pending > 0).slice(0, 8).map(r => (
                <div key={r.id} className="flex justify-between items-center border-b border-gray-800/50 pb-3">
                  <div>
                    <p className="text-sm font-bold text-white uppercase">{r.store_name}</p>
                    <p className="text-[10px] text-gray-500 font-mono">Net-{r.payment_cycle_days}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-black text-red-400">₹{Number(r.total_pending).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {retailers.filter(r => r.total_pending > 0).length === 0 && (
                <p className="text-[10px] text-emerald-500 italic uppercase">No outstanding retailer debt.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* LOG PAYMENT MODAL */}
      {isPaymentModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl w-full max-w-md p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
              <h2 className="text-lg font-black text-white uppercase tracking-widest">Receive Payment</h2>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            
            <div className="bg-[#111] p-4 rounded-xl mb-6 border border-gray-800">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Invoice Info</p>
              <p className="text-white font-mono font-bold">{selectedOrder.order_number}</p>
              <p className="text-cyan-400 text-sm font-bold uppercase mt-1">{selectedOrder.customer_name}</p>
            </div>

            <form onSubmit={handleLogPayment} className="space-y-6">
              <div>
                <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Payment Amount Received (₹)</label>
                <input 
                  type="number" 
                  autoFocus
                  required 
                  min="1"
                  max={Number(selectedOrder.total_amount) - Number(selectedOrder.amount_paid || 0)} // Can't overpay
                  value={paymentAmount} 
                  onChange={e => setPaymentAmount(e.target.value)} 
                  className="w-full bg-black border border-gray-700 p-4 rounded-xl text-emerald-400 text-2xl font-mono font-black outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-gray-500 mt-2 font-mono">Remaining Balance: ₹{(Number(selectedOrder.total_amount) - Number(selectedOrder.amount_paid || 0)).toLocaleString()}</p>
              </div>

              <button type="submit" className="w-full bg-emerald-500 text-black py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 active:scale-95">
                Confirm & Log Payment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}