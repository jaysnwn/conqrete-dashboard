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
    try {
      const [ordRes, retRes] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("retailers").select("*").order("total_pending", { ascending: false })
      ]);

      setOrders(ordRes.data || []);
      setRetailers(retRes.data || []);
    } catch (error) {
      console.error("Error fetching finance data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalOutstanding = retailers.reduce((sum, r) => sum + Number(r.total_pending || 0), 0);
    const totalCollected = orders.reduce((sum, o) => sum + Number(o.amount_paid || 0), 0);
    const unpaidInvoices = orders.filter(o => o.payment_status !== 'Paid').length;

    return { totalOutstanding, totalCollected, unpaidInvoices };
  }, [orders, retailers]);

  const handleLogPayment = async (e) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    
    if (!amount || amount <= 0) return alert("Please enter a valid payment amount.");

    const currentPaid = Number(selectedOrder.amount_paid || 0);
    const orderTotal = Number(selectedOrder.total_amount);
    const newAmountPaid = currentPaid + amount;
    
    let newStatus = "Partial";
    if (newAmountPaid >= orderTotal) {
      newStatus = "Paid";
    }

    try {
      const { error: orderErr } = await supabase
        .from("orders")
        .update({ amount_paid: newAmountPaid, payment_status: newStatus })
        .eq("id", selectedOrder.id);

      if (orderErr) throw orderErr;

      const retailer = retailers.find(r => r.store_name === selectedOrder.customer_name);
      if (retailer) {
        const newPending = Math.max(0, Number(retailer.total_pending || 0) - amount); 
        await supabase
          .from("retailers")
          .update({ total_pending: newPending })
          .eq("id", retailer.id);
      }

      setIsPaymentModalOpen(false);
      setPaymentAmount("");
      setSelectedOrder(null);
      fetchFinanceData(); 

    } catch (err) {
      alert("Error logging payment: " + err.message);
    }
  };

  const openPaymentModal = (order) => {
    setSelectedOrder(order);
    const remaining = Number(order.total_amount) - Number(order.amount_paid || 0);
    setPaymentAmount(remaining);
    setIsPaymentModalOpen(true);
  };

  const activeInvoices = orders.filter(o => o.payment_status !== 'Paid');

  const getInitials = (name) => {
    if (!name) return "NA";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  if (isLoading) return (
    <div className="min-h-[60vh] flex items-center justify-center bg-[#F8F9FA]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-[#E5E7EB] border-t-[#0EA5E9] animate-spin" />
        <p className="text-[#6B7280] text-sm font-medium uppercase tracking-wider">
          Syncing Ledgers...
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-4 md:p-8 text-[#111827] font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* PAGE HEADER */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[#111827]">
            Accounts Receivable
          </h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            Cash flow, ledger payments, and outstanding debt. Monitor your liquidity real-time.
          </p>
        </div>

        {/* SUMMARY CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
                Total Market Debt (Outstanding)
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#111827]">
                  ₹{stats.totalOutstanding.toLocaleString('en-IN')}
                </span>
                <span className="text-sm font-medium text-[#6B7280]">INR</span>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2">
              <span className="flex items-center px-2.5 py-1 text-xs font-medium bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] rounded-full">
                Requires Collection
              </span>
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
                Total Cash Collected
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#111827]">
                  ₹{stats.totalCollected.toLocaleString('en-IN')}
                </span>
                <span className="text-sm font-medium text-[#6B7280]">INR</span>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2">
              <span className="flex items-center px-2.5 py-1 text-xs font-medium bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] rounded-full">
                Liquid Assets Secured
              </span>
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
                Active Unpaid Invoices
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#111827]">
                  {stats.unpaidInvoices}
                </span>
                <span className="text-sm font-medium text-[#6B7280]">Documents</span>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2">
              <span className="flex items-center px-2.5 py-1 text-xs font-medium bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] rounded-full">
                Awaiting Reconciliation
              </span>
            </div>
          </div>

        </div>

        {/* MAIN LAYOUT GRID (Table + Sidebar) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          <section className="lg:col-span-2 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-[#111827]">Invoices Awaiting Payment</h3>
            
            <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-x-auto shadow-sm">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    {["Invoice Ref", "Client Entity", "Total Bill", "Remaining", "Actions"].map((header, i) => (
                      <th key={header} className={`py-3 px-4 text-[#6B7280] text-xs font-semibold uppercase tracking-wider ${i === 4 ? "text-right" : "text-left"}`}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {activeInvoices.map((o) => {
                    const total = Number(o.total_amount);
                    const paid = Number(o.amount_paid || 0);
                    const remaining = total - paid;

                    return (
                      <tr key={o.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-4 px-4">
                          <div className="text-sm font-semibold text-[#111827]">{o.order_number}</div>
                          <div className="text-xs text-[#6B7280] mt-1 uppercase tracking-wide">
                            {o.created_at ? `Issued ${new Date(o.created_at).toLocaleDateString()}` : "Issued Recently"}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#F3F4F6] text-[#4B5563] flex items-center justify-center text-xs font-bold shrink-0">
                              {getInitials(o.customer_name)}
                            </div>
                            <span className="text-sm font-semibold text-[#111827]">{o.customer_name}</span>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-sm font-medium text-[#111827]">
                          ₹{total.toLocaleString('en-IN')}
                        </td>

                        <td className="py-4 px-4">
                          <span className="px-2.5 py-1 bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] rounded-full text-xs font-medium whitespace-nowrap">
                            ₹{remaining.toLocaleString('en-IN')} Unpaid
                          </span>
                        </td>

                        <td className="py-4 px-4 text-right">
                          <button 
                            onClick={() => openPaymentModal(o)}
                            className="bg-white border border-[#D1D5DB] text-[#111827] text-xs font-medium px-4 py-1.5 rounded-md hover:bg-[#F3F4F6] transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/50"
                          >
                            Log Payment
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {activeInvoices.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-8 px-4 text-center text-[#6B7280] text-sm">
                        All invoices are fully paid.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="lg:col-span-1 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-[#111827]">Top Debtors</h3>

            <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm p-6 flex flex-col gap-6">
              {retailers.filter(r => r.total_pending > 0).slice(0, 5).map((r, idx) => (
                <div key={r.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center text-sm font-bold shrink-0 ${idx === 0 ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#F9FAFB] border border-[#E5E7EB] text-[#6B7280]"}`}>
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-[#111827] text-sm truncate">{r.store_name}</h4>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        Net-{r.payment_cycle_days || 30} Terms
                      </p>
                    </div>
                  </div>
                  <span className={`text-base font-bold shrink-0 ml-4 ${idx === 0 ? "text-[#92400E]" : "text-[#111827]"}`}>
                    ₹{Number(r.total_pending).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}

              {retailers.filter(r => r.total_pending > 0).length === 0 && (
                <p className="text-sm text-[#6B7280] italic">No outstanding retailer debt.</p>
              )}
            </div>
          </aside>
        </div>
      </div>

      {isPaymentModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-[#111827]/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-lg shadow-xl p-6 relative border border-[#E5E7EB]">
            
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#E5E7EB]">
              <h2 className="text-lg font-bold text-[#111827]">Receive Payment</h2>
              <button 
                onClick={() => setIsPaymentModalOpen(false)} 
                className="text-[#6B7280] hover:text-[#111827] text-2xl leading-none focus:outline-none"
              >
                &times;
              </button>
            </div>
            
            <div className="bg-[#F9FAFB] p-4 rounded-md mb-6 border border-[#E5E7EB]">
              <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider mb-1">Invoice Info</p>
              <p className="text-[#111827] font-semibold text-sm">{selectedOrder.order_number}</p>
              <p className="text-[#0EA5E9] text-sm font-semibold mt-1">{selectedOrder.customer_name}</p>
            </div>

            <form onSubmit={handleLogPayment} className="flex flex-col gap-6">
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-2 uppercase tracking-wider">
                  Payment Amount Received (₹)
                </label>
                <input 
                  type="number" 
                  autoFocus
                  required 
                  min="1"
                  max={Number(selectedOrder.total_amount) - Number(selectedOrder.amount_paid || 0)} 
                  value={paymentAmount} 
                  onChange={e => setPaymentAmount(e.target.value)} 
                  className="w-full px-4 py-3 bg-white border border-[#D1D5DB] rounded-md text-[#111827] text-xl font-semibold focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none transition-shadow box-border"
                />
                <p className="text-xs text-[#6B7280] mt-2 font-medium">
                  Remaining Balance: ₹{(Number(selectedOrder.total_amount) - Number(selectedOrder.amount_paid || 0)).toLocaleString('en-IN')}
                </p>
              </div>

              <button 
                type="submit" 
                className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white py-3 px-4 rounded-md font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/50 focus:ring-offset-2"
              >
                Confirm & Log Payment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}