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
    <div style={{ background: "transparent", minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid rgba(161,250,255,0.2)", borderTopColor: "#a1faff", animation: "spin 0.8s linear infinite" }} />
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#a1faff", fontSize: 11, letterSpacing: "0.5em", textTransform: "uppercase" }}>
          Syncing Ledgers...
        </p>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap');

        /* Stripped top padding so it sits flush under your global navbar. Added overflow-x: hidden */
        .pe-root { 
            font-family: 'Manrope', sans-serif; 
            color: #eeeef0; 
            padding: 0px 32px 72px 32px; 
            max-width: 1500px;
            margin: 0 auto;
            margin-top: 24px;
            box-sizing: border-box;
            overflow-x: hidden; 
        }

        .sg { font-family: 'Space Grotesk', sans-serif; }
        .ms {
          font-family: 'Material Symbols Outlined';
          font-size: 20px; font-style: normal; font-weight: normal; line-height: 1;
          letter-spacing: normal; text-transform: none; display: inline-block;
          white-space: nowrap; -webkit-font-smoothing: antialiased;
        }
        .glass {
          background: rgba(35,38,41,0.4);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-top: 1px solid rgba(161,250,255,0.08);
          border-left: 1px solid rgba(161,250,255,0.08);
          border-right: 1px solid rgba(255,255,255,0.04);
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .pe-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .pe-lift:hover { transform: translateY(-3px); box-shadow: 0 12px 48px rgba(0,245,255,0.07); }

        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .fu { animation: fadeUp 0.55s ease both; }
        .fu1{animation-delay:.05s} .fu2{animation-delay:.12s} .fu3{animation-delay:.19s}
        .fu4{animation-delay:.26s} .fu5{animation-delay:.33s} .fu6{animation-delay:.40s}
        
        .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #232629; border-radius: 10px; }

        /* USING minmax(0, 1fr) prevents grid blowouts! */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 24px;
            margin-bottom: 32px;
        }

        .content-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr);
            gap: 32px;
            align-items: start;
        }

        /* Responsive Breakpoints */
        @media (max-width: 1200px) {
            .content-grid { grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 24px; }
        }
        @media (max-width: 992px) {
            .content-grid { grid-template-columns: minmax(0, 1fr); }
            .pe-root { padding: 8px 16px 72px 16px; margin-top: 16px;}
        }
      `}</style>

      <div className="pe-root">

        {/* PAGE HEADER */}
        <div className="fu fu1" style={{ marginBottom: 32 }}>
          <h1 className="sg" style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1, color: "#ffffff" }}>
            ACCOUNTS RECEIVABLE
          </h1>
          <p style={{ marginTop: 12, fontSize: 16, color: "#aaabad", fontWeight: 300, maxWidth: 600 }}>
            Cash flow, ledger payments, and outstanding debt. Monitor your liquidity real-time.
          </p>
        </div>

        {/* SUMMARY CARDS GRID */}
        <div className="metrics-grid">
          
          <div className="glass pe-lift fu fu2" style={{ borderRadius: 16, padding: 32, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -64, right: -64, width: 128, height: 128, background: "rgba(255,113,108,0.1)", filter: "blur(40px)" }} />
            <div style={{ position: "relative", zIndex: 10 }}>
              <p style={{ color: "#aaabad", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, marginBottom: 16 }}>
                Total Market Debt (Outstanding)
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span className="sg" style={{ fontSize: 36, fontWeight: 700, color: "#ff716c", textShadow: "0 0 20px rgba(255,113,108,0.15)" }}>
                  ₹{stats.totalOutstanding.toLocaleString('en-IN')}
                </span>
                <span style={{ color: "rgba(255,113,108,0.6)", fontSize: 14 }}>INR</span>
              </div>
              <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 500, color: "#d7383b" }}>
                <span className="ms" style={{ fontSize: 16 }}>warning</span>
                <span>REQUIRES COLLECTION</span>
              </div>
            </div>
          </div>

          <div className="glass pe-lift fu fu3" style={{ borderRadius: 16, padding: 32, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -64, right: -64, width: 128, height: 128, background: "rgba(161,250,255,0.1)", filter: "blur(40px)" }} />
            <div style={{ position: "relative", zIndex: 10 }}>
              <p style={{ color: "#aaabad", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, marginBottom: 16 }}>
                Total Cash Collected
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span className="sg" style={{ fontSize: 36, fontWeight: 700, color: "#a1faff", textShadow: "0 0 20px rgba(0,245,255,0.15)" }}>
                  ₹{stats.totalCollected.toLocaleString('en-IN')}
                </span>
                <span style={{ color: "rgba(161,250,255,0.6)", fontSize: 14 }}>INR</span>
              </div>
              <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 500, color: "#00e5ee" }}>
                <span className="ms" style={{ fontSize: 16 }}>check_circle</span>
                <span>LIQUID ASSETS SECURED</span>
              </div>
            </div>
          </div>

          <div className="glass pe-lift fu fu4" style={{ borderRadius: 16, padding: 32, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -64, right: -64, width: 128, height: 128, background: "rgba(159,142,255,0.1)", filter: "blur(40px)" }} />
            <div style={{ position: "relative", zIndex: 10 }}>
              <p style={{ color: "#aaabad", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, marginBottom: 16 }}>
                Active Unpaid Invoices
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span className="sg" style={{ fontSize: 36, fontWeight: 700, color: "#ffffff" }}>
                  {stats.unpaidInvoices}
                </span>
                <span style={{ color: "rgba(170,171,173,0.6)", fontSize: 14 }}>DOCUMENTS</span>
              </div>
              <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 500, color: "#9f8eff" }}>
                <span className="ms" style={{ fontSize: 16 }}>pending_actions</span>
                <span>AWAITING RECONCILIATION</span>
              </div>
            </div>
          </div>

        </div>

        {/* MAIN LAYOUT GRID (Table + Sidebar) */}
        <div className="content-grid">
          
          {/* Added minWidth: 0 here to let the table scroll internally instead of stretching the page */}
          <section className="fu fu5" style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <h3 className="sg" style={{ fontSize: 24, fontWeight: 700, color: "#ffffff" }}>INVOICES AWAITING PAYMENT</h3>
            </div>
            
            <div className="glass custom-scroll" style={{ borderRadius: 12, overflowX: "auto", overflowY: "hidden" }}>
              <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse", minWidth: 600 }}>
                <thead>
                  <tr style={{ background: "rgba(29,32,34,0.5)" }}>
                    {["Invoice Ref", "Client Entity", "Total Bill", "Remaining", "Actions"].map((header, i) => (
                      <th key={header} className="sg" style={{ padding: "16px 24px", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.15em", color: "#aaabad", fontWeight: 600, textAlign: i === 4 ? "right" : "left", whiteSpace: "nowrap" }}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  {activeInvoices.map((o, idx) => {
                    const total = Number(o.total_amount);
                    const paid = Number(o.amount_paid || 0);
                    const remaining = total - paid;
                    const avatarColors = ["#00e5ee", "#9f8eff", "#ff59e3"];
                    const ringColor = avatarColors[idx % 3];

                    return (
                      <tr key={o.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(41,44,47,0.2)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        
                        <td style={{ padding: "24px 24px" }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#ffffff" }}>{o.order_number}</div>
                          <div style={{ fontSize: 10, color: "rgba(170,171,173,0.6)", marginTop: 4, textTransform: "uppercase" }}>
                            {o.created_at ? `ISSUED ${new Date(o.created_at).toLocaleDateString()}` : "ISSUED RECENTLY"}
                          </div>
                        </td>

                        <td style={{ padding: "24px 24px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#232629", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: ringColor, border: `1px solid ${ringColor}33`, flexShrink: 0 }}>
                              {getInitials(o.customer_name)}
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{o.customer_name}</span>
                          </div>
                        </td>

                        <td style={{ padding: "24px 24px", fontSize: 14 }}>
                          ₹{total.toLocaleString('en-IN')}
                        </td>

                        <td style={{ padding: "24px 24px" }}>
                          <span style={{ padding: "4px 12px", borderRadius: 99, background: "rgba(255,113,108,0.1)", color: "#ff716c", fontSize: 10, fontWeight: 700, border: "1px solid rgba(255,113,108,0.2)", whiteSpace: "nowrap" }}>
                            ₹{remaining.toLocaleString('en-IN')} UNPAID
                          </span>
                        </td>

                        <td style={{ padding: "24px 24px", textAlign: "right" }}>
                          <button 
                            onClick={() => openPaymentModal(o)}
                            style={{ background: "linear-gradient(90deg, #a1faff, #00f4fe)", color: "#00575b", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.05em", padding: "8px 16px", borderRadius: 99, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(0,245,255,0.2)", transition: "transform 0.1s", whiteSpace: "nowrap" }}
                            onMouseDown={e => e.currentTarget.style.transform = "scale(0.95)"}
                            onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
                          >
                            Log Payment
                          </button>
                        </td>

                      </tr>
                    );
                  })}
                  {activeInvoices.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ padding: "32px", textAlign: "center", color: "#aaabad", fontSize: 14 }}>
                        All invoices are fully paid.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Added minWidth: 0 here as well */}
          <aside className="fu fu6" style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="ms" style={{ color: "#ff716c", fontVariationSettings: "'FILL' 1" }}>warning</span>
              <h3 className="sg" style={{ fontSize: 24, fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.02em" }}>
                Top Debtors
              </h3>
            </div>

            <div className="glass" style={{ borderRadius: 16, padding: 32, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", bottom: -48, right: -48, width: 192, height: 192, background: "rgba(255,113,108,0.05)", filter: "blur(80px)", borderRadius: "50%" }} />
              
              <div style={{ display: "flex", flexDirection: "column", gap: 24, position: "relative", zIndex: 10 }}>
                {retailers.filter(r => r.total_pending > 0).slice(0, 5).map((r, idx) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} className="pe-lift">
                    <div style={{ display: "flex", alignItems: "center", gap: 16, overflow: "hidden" }}>
                      <div className="sg" style={{ width: 48, height: 48, borderRadius: 12, background: "#232629", border: "1px solid rgba(70,72,74,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: idx === 0 ? "#ff716c" : "rgba(255,255,255,0.4)", flexShrink: 0 }}>
                        {idx + 1}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h4 style={{ fontWeight: 700, color: "#ffffff", fontSize: 14, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.store_name}</h4>
                        <p style={{ fontSize: 10, color: "#aaabad", textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 2 }}>
                          Net-{r.payment_cycle_days || 30} Terms
                        </p>
                      </div>
                    </div>
                    <span className="sg" style={{ fontSize: 20, fontWeight: 700, color: idx === 0 ? "#ff716c" : "rgba(255,255,255,0.8)", flexShrink: 0, marginLeft: 16 }}>
                      ₹{Number(r.total_pending).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}

                {retailers.filter(r => r.total_pending > 0).length === 0 && (
                  <p style={{ fontSize: 12, color: "#00e5ee", fontStyle: "italic", textTransform: "uppercase" }}>No outstanding retailer debt.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {isPaymentModalOpen && selectedOrder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div className="glass fu" style={{ width: "100%", maxWidth: 450, borderRadius: 24, padding: 32, position: "relative", border: "1px solid rgba(161,250,255,0.2)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <h2 className="sg" style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", textTransform: "uppercase", letterSpacing: "0.1em" }}>Receive Payment</h2>
              <button onClick={() => setIsPaymentModalOpen(false)} style={{ background: "none", border: "none", color: "#aaabad", fontSize: 24, cursor: "pointer", padding: 0, lineHeight: 1 }}>&times;</button>
            </div>
            
            <div style={{ background: "rgba(17,20,22,0.8)", padding: 16, borderRadius: 12, marginBottom: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{ fontSize: 10, color: "#aaabad", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, marginBottom: 4 }}>Invoice Info</p>
              <p style={{ color: "#ffffff", fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{selectedOrder.order_number}</p>
              <p style={{ color: "#a1faff", fontSize: 14, fontWeight: 700, textTransform: "uppercase", marginTop: 4 }}>{selectedOrder.customer_name}</p>
            </div>

            <form onSubmit={handleLogPayment} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, color: "#aaabad", marginBottom: 8, textTransform: "uppercase", fontWeight: 900, letterSpacing: "0.15em" }}>
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
                  style={{ width: "100%", background: "#0c0e10", border: "1px solid #46484a", padding: 16, borderRadius: 12, color: "#a1faff", fontSize: 24, fontFamily: "monospace", fontWeight: 900, outline: "none", transition: "border 0.2s", boxSizing: "border-box" }}
                  onFocus={e => e.currentTarget.style.borderColor = "#a1faff"}
                  onBlur={e => e.currentTarget.style.borderColor = "#46484a"}
                />
                <p style={{ fontSize: 10, color: "#747578", marginTop: 8, fontFamily: "monospace" }}>
                  Remaining Balance: ₹{(Number(selectedOrder.total_amount) - Number(selectedOrder.amount_paid || 0)).toLocaleString('en-IN')}
                </p>
              </div>

              <button type="submit" style={{ width: "100%", background: "linear-gradient(90deg, #a1faff, #00f4fe)", color: "#00575b", padding: 16, borderRadius: 12, fontWeight: 900, textTransform: "uppercase", fontSize: 12, letterSpacing: "0.15em", border: "none", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,245,255,0.2)", transition: "transform 0.1s" }}
                onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
                onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
              >
                Confirm & Log Payment
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}