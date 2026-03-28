"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function ProfitEngine() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalCOGS: 0,
    grossProfit: 0,
    netMargin: 0,
    totalSalaryBurn: 0,
    totalOpEx: 0,
    totalFixedBurn: 0,
    orderCount: 0,
  });

  const [channelData, setChannelData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ NEW: Breakdown details for UI display
  const [breakdownDetails, setBreakdownDetails] = useState({
    fixedExpenses: 0,
    salariedExpenses: 0,
    paidLeaveCost: 0,
    totalCommissions: 0,
  });

  // ✅ NEW: Error state
  const [error, setError] = useState(null);

  useEffect(() => {
    calculateEngineMetrics();
  }, []);

  const calculateEngineMetrics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // ✅ FIX #1: Fetch all required data including leave_requests
      const [ordersRes, itemsRes, productsRes, hrRes, expensesRes, expenseClaimsRes, leaveRes] =
        await Promise.all([
          supabase.from("orders").select("*"),
          supabase.from("order_items").select("*"),
          supabase.from("products").select("id, landed_cost"),
          supabase.from("employees").select("base_salary, status, commission_rate, full_name, id"),
          supabase.from("expenses").select("amount"),
          supabase.from("expense_claims").select("amount, status"),
          supabase.from("leave_requests").select("*").eq("leave_type", "Paid Leave"),
        ]);

      // ✅ FIX #2: Check ALL error responses including leaveRes
      if (ordersRes.error || itemsRes.error || productsRes.error || hrRes.error || expensesRes.error || expenseClaimsRes.error || leaveRes.error) {
        throw new Error("Critical Data Fetch Failure");
      }

      // ✅ FIX #3: Safe array operations with null checks
      const activeSalaries = (hrRes.data || [])
        .filter((emp) => emp.status === "Active")
        .reduce((sum, emp) => sum + (Number(emp.base_salary) || 0), 0);

      // ✅ Calculate Fixed Expenses
      const fixedExpenses = (expensesRes.data || []).reduce(
        (sum, exp) => sum + (Number(exp.amount) || 0),
        0
      );

      // ✅ Calculate Approved Salesman Expense Claims
      const salariedExpenses = (expenseClaimsRes.data || [])
        .filter(claim => claim.status === "Approved")
        .reduce((sum, claim) => sum + (Number(claim.amount) || 0), 0);

      // ✅ Calculate Paid Leave Costs
      let paidLeaveCost = 0;
      (leaveRes.data || []).forEach(leave => {
        const emp = (hrRes.data || []).find(e => e.id === leave.employee_id);
        if (emp) {
          const start = new Date(leave.start_date);
          const end = new Date(leave.end_date);
          const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
          const perDayWage = (Number(emp.base_salary) || 0) / 30;
          paidLeaveCost += days * perDayWage;
        }
      });

      // ✅ FIX #4: Safe commission calculation with multiple null checks
      const totalCommissions = (ordersRes.data || []).reduce((sum, order) => {
        if (!hrRes.data || !order.sales_rep || !order.total_amount) return sum;
        const salesRep = hrRes.data.find(e => e.full_name === order.sales_rep);
        if (salesRep) {
          const commission = Number(order.total_amount) * (Number(salesRep.commission_rate || 0) / 100);
          return sum + commission;
        }
        return sum;
      }, 0);

      // ✅ Calculate Total Operating Expenses
      const totalOpEx = fixedExpenses + salariedExpenses + paidLeaveCost;

      // ✅ Calculate Total Fixed Burn (all liabilities)
      const totalFixedBurn = activeSalaries + totalOpEx + totalCommissions;

      const products = productsRes.data || [];
      const productCostLookup = {};
      products.forEach((p) => { productCostLookup[p.id] = Number(p.landed_cost) || 0; });

      let totalRevenue = 0;
      let totalCOGS = 0;
      const channelMap = {};
      const orders = ordersRes.data || [];
      const allItems = itemsRes.data || [];

      orders.forEach((order) => {
        totalRevenue += Number(order.total_amount) || 0;
        const channel = order.sales_channel || "Retailer";
        if (!channelMap[channel]) channelMap[channel] = { rev: 0, cost: 0 };

        allItems
          .filter((item) => item.order_id === order.id)
          .forEach((item) => {
            const cost = (productCostLookup[item.product_id] || 0) * (Number(item.quantity) || 0);
            totalCOGS += cost;
            channelMap[channel].rev += Number(item.unit_price) * (Number(item.quantity) || 0);
            channelMap[channel].cost += cost;
          });
      });

      const grossProfit = totalRevenue - totalCOGS;

      // ✅ Store breakdown for UI display
      setBreakdownDetails({
        fixedExpenses,
        salariedExpenses,
        paidLeaveCost,
        totalCommissions,
      });

      setStats({
        totalRevenue,
        totalCOGS,
        grossProfit,
        netMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
        totalSalaryBurn: activeSalaries,
        totalOpEx,
        totalFixedBurn,
        orderCount: orders.length,
      });

      setChannelData(
        Object.entries(channelMap).map(([name, data]) => ({
          name,
          revenue: data.rev,
          profit: data.rev - data.cost,
          margin: data.rev > 0 ? ((data.rev - data.cost) / data.rev) * 100 : 0,
        }))
      );
    } catch (err) {
      console.error("Engine Error:", err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const totalNetProfit = stats.grossProfit - stats.totalFixedBurn;
  const isProfit = totalNetProfit >= 0;
  const breakEvenProgress = stats.totalFixedBurn > 0
    ? Math.min((stats.grossProfit / stats.totalFixedBurn) * 100, 100)
    : 100;
  const revenuePerBurn = (stats.totalRevenue / (stats.totalFixedBurn || 1)).toFixed(2);
  const totalChannelRev = channelData.reduce((s, c) => s + c.revenue, 0);

  if (isLoading) {
    return (
      <div style={{ background: "#0c0e10", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
          <div style={{ width: "2.25rem", height: "2.25rem", borderRadius: "50%", border: "2px solid rgba(161,250,255,0.2)", borderTopColor: "#a1faff", animation: "spin 0.8s linear infinite" }} />
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#a1faff", fontSize: "0.6875rem", letterSpacing: "0.5em", textTransform: "uppercase" }}>
            Syncing Financials...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: "#0c0e10", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div style={{ background: "rgba(255,113,108,0.1)", border: "1px solid rgba(255,113,108,0.3)", borderRadius: "0.75rem", padding: "2rem", maxWidth: "500px", textAlign: "center" }}>
          <p style={{ color: "#ff716c", fontSize: "0.875rem", margin: 0, marginBottom: "0.5rem" }}>⚠️ Error Loading Profit Engine</p>
          <p style={{ color: "#aaabad", fontSize: "0.75rem", margin: 0 }}>{error}</p>
          <button
            onClick={() => calculateEngineMetrics()}
            style={{
              background: "#ff716c",
              color: "white",
              border: "none",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              marginTop: "1rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        
        .font-headline { font-family: 'Space Grotesk', sans-serif; }
        
        * {
          box-sizing: border-box;
        }
        
        /* Mobile-first responsive approach */
        @media (max-width: 768px) {
          .card-grid { grid-template-columns: 1fr !important; }
          .breakdown-item { flex-direction: column; align-items: flex-start !important; }
          .breakdown-value { align-self: flex-end; margin-top: 0.5rem; }
          .channel-grid { grid-template-columns: 1fr !important; }
        }

        @media (max-width: 480px) {
          .card-grid { padding: 0 !important; gap: 0.75rem !important; }
        }
      `}</style>

      {/* ✅ FIXED: Removed excessive top padding */}
      <main style={{ 
        background: "#0c0e10", 
        color: "#eeeef0", 
        minHeight: "100vh", 
        padding: "1rem",
        paddingLeft: "clamp(1rem, 3vw, 2rem)",
        paddingRight: "clamp(1rem, 3vw, 2rem)",
        paddingBottom: "3rem"
      }}>
        
        {/* HEADER - Mobile Responsive */}
        <section style={{ marginBottom: "clamp(1.5rem, 5vw, 2rem)" }}>
          <h1 className="font-headline" style={{
            fontSize: "clamp(1.25rem, 5vw, 2.75rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#a1faff",
            margin: 0,
            marginBottom: "0.5rem"
          }}>
            PROFIT ENGINE
          </h1>
          <p style={{ fontSize: "clamp(0.75rem, 2vw, 0.875rem)", color: "#aaabad", margin: 0 }}>
            Real-time financial metrics & channel profitability analysis
          </p>
        </section>

        {/* TOP METRICS GRID - Mobile Friendly */}
        <div className="card-grid" style={{ 
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "clamp(0.75rem, 2vw, 1rem)",
          marginBottom: "clamp(1.5rem, 4vw, 2rem)",
          padding: "0"
        }}>
          {/* Total Revenue */}
          <div style={{
            background: "rgba(23, 26, 28, 0.6)",
            backdropFilter: "blur(32px)",
            border: "1px solid rgba(161, 250, 255, 0.1)",
            borderRadius: "1rem",
            padding: "clamp(1rem, 3vw, 1.5rem)",
            boxShadow: "0 0 20px rgba(0, 244, 254, 0.08)",
            transition: "transform 0.2s ease, box-shadow 0.2s ease"
          }} onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
            <p style={{ fontSize: "clamp(0.625rem, 1.5vw, 0.75rem)", color: "#a1faff", textTransform: "uppercase", letterSpacing: "0.2em", margin: 0, marginBottom: "0.5rem", fontWeight: 700 }}>
              Monthly Revenue
            </p>
            <p style={{ fontSize: "clamp(1.25rem, 4vw, 1.75rem)", fontFamily: "'Space Grotesk', monospace", fontWeight: 700, color: "#00f4fe", margin: 0 }}>
              ₹{Math.round(stats.totalRevenue).toLocaleString()}
            </p>
            <p style={{ fontSize: "clamp(0.65rem, 1.5vw, 0.75rem)", color: "#aaabad", marginTop: "0.5rem", margin: 0 }}>
              {stats.orderCount} orders
            </p>
          </div>

          {/* Gross Profit */}
          <div style={{
            background: "rgba(23, 26, 28, 0.6)",
            backdropFilter: "blur(32px)",
            border: "1px solid rgba(161, 250, 255, 0.1)",
            borderRadius: "1rem",
            padding: "clamp(1rem, 3vw, 1.5rem)",
            boxShadow: "0 0 20px rgba(0, 244, 254, 0.08)",
            transition: "transform 0.2s ease, box-shadow 0.2s ease"
          }} onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
            <p style={{ fontSize: "clamp(0.625rem, 1.5vw, 0.75rem)", color: "#34d399", textTransform: "uppercase", letterSpacing: "0.2em", margin: 0, marginBottom: "0.5rem", fontWeight: 700 }}>
              Gross Profit
            </p>
            <p style={{ fontSize: "clamp(1.25rem, 4vw, 1.75rem)", fontFamily: "'Space Grotesk', monospace", fontWeight: 700, color: "#34d399", margin: 0 }}>
              ₹{Math.round(stats.grossProfit).toLocaleString()}
            </p>
            <p style={{ fontSize: "clamp(0.65rem, 1.5vw, 0.75rem)", color: "#aaabad", marginTop: "0.5rem", margin: 0 }}>
              {stats.netMargin.toFixed(1)}% margin
            </p>
          </div>

          {/* Net Profit */}
          <div style={{
            background: "rgba(23, 26, 28, 0.6)",
            backdropFilter: "blur(32px)",
            border: `1px solid ${isProfit ? "rgba(52, 211, 153, 0.2)" : "rgba(255, 113, 108, 0.2)"}`,
            borderRadius: "1rem",
            padding: "clamp(1rem, 3vw, 1.5rem)",
            boxShadow: `0 0 20px ${isProfit ? "rgba(52, 211, 153, 0.08)" : "rgba(255, 113, 108, 0.08)"}`,
            transition: "transform 0.2s ease, box-shadow 0.2s ease"
          }} onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
            <p style={{ fontSize: "clamp(0.625rem, 1.5vw, 0.75rem)", color: isProfit ? "#34d399" : "#ff716c", textTransform: "uppercase", letterSpacing: "0.2em", margin: 0, marginBottom: "0.5rem", fontWeight: 700 }}>
              Net Profit
            </p>
            <p style={{ fontSize: "clamp(1.25rem, 4vw, 1.75rem)", fontFamily: "'Space Grotesk', monospace", fontWeight: 700, color: isProfit ? "#34d399" : "#ff716c", margin: 0 }}>
              ₹{Math.round(totalNetProfit).toLocaleString()}
            </p>
            <p style={{ fontSize: "clamp(0.65rem, 1.5vw, 0.75rem)", color: "#aaabad", marginTop: "0.5rem", margin: 0 }}>
              {isProfit ? "✅ Profitable" : "❌ Loss"}
            </p>
          </div>

          {/* Break Even */}
          <div style={{
            background: "rgba(23, 26, 28, 0.6)",
            backdropFilter: "blur(32px)",
            border: "1px solid rgba(161, 250, 255, 0.1)",
            borderRadius: "1rem",
            padding: "clamp(1rem, 3vw, 1.5rem)",
            boxShadow: "0 0 20px rgba(0, 244, 254, 0.08)",
            transition: "transform 0.2s ease, box-shadow 0.2s ease"
          }} onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
            <p style={{ fontSize: "clamp(0.625rem, 1.5vw, 0.75rem)", color: "#a1faff", textTransform: "uppercase", letterSpacing: "0.2em", margin: 0, marginBottom: "0.5rem", fontWeight: 700 }}>
              Break Even
            </p>
            <p style={{ fontSize: "clamp(1.25rem, 4vw, 1.75rem)", fontFamily: "'Space Grotesk', monospace", fontWeight: 700, color: "#a1faff", margin: 0 }}>
              {breakEvenProgress.toFixed(0)}%
            </p>
            <div style={{ width: "100%", height: "4px", background: "rgba(161, 250, 255, 0.1)", borderRadius: "2px", marginTop: "0.75rem", overflow: "hidden" }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg, #a1faff, #00f4fe)", width: `${breakEvenProgress}%`, borderRadius: "2px", transition: "width 0.3s ease" }} />
            </div>
          </div>
        </div>

        {/* ✅ MONTHLY LIABILITY BREAKDOWN - Mobile Friendly */}
        <section style={{
          background: "rgba(35, 38, 41, 0.4)",
          border: "1px solid rgba(249, 115, 22, 0.2)",
          borderRadius: "1rem",
          padding: "clamp(1rem, 3vw, 1.5rem)",
          marginBottom: "clamp(1.5rem, 4vw, 2rem)",
          boxShadow: "0 0 20px rgba(249, 115, 22, 0.05)"
        }}>
          <h2 className="font-headline" style={{
            fontSize: "clamp(0.875rem, 3vw, 1.25rem)",
            fontWeight: 700,
            color: "#f97316",
            margin: 0,
            marginBottom: "clamp(1rem, 2vw, 1.5rem)",
            fontStyle: "italic",
            letterSpacing: "-0.01em"
          }}>
            Monthly Liability Subtotal
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.75rem, 2vw, 1rem)" }}>
            {/* Base Salaries */}
            <div className="breakdown-item" style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "clamp(0.75rem, 2vw, 1rem)",
              borderBottom: "1px solid rgba(161, 250, 255, 0.1)"
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "clamp(0.65rem, 1.5vw, 0.75rem)", color: "#e5e7eb", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.1em", margin: 0, marginBottom: "0.25rem" }}>
                  Base Salaries
                </p>
                <p style={{ fontSize: "clamp(0.6rem, 1.2vw, 0.7rem)", color: "#9ca3af", margin: 0 }}>
                  Fixed commitment
                </p>
              </div>
              <p style={{ fontSize: "clamp(0.875rem, 3vw, 1.25rem)", fontFamily: "'Space Grotesk', monospace", color: "#d1d5db", fontWeight: 700, margin: 0, textAlign: "right", marginLeft: "0.5rem", whiteSpace: "nowrap" }}>
                ₹{Math.round(stats.totalSalaryBurn).toLocaleString()}
              </p>
            </div>

            {/* Commissions */}
            <div className="breakdown-item" style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "clamp(0.75rem, 2vw, 1rem)",
              borderBottom: "1px solid rgba(161, 250, 255, 0.1)"
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "clamp(0.65rem, 1.5vw, 0.75rem)", color: "#06b6d4", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.1em", margin: 0, marginBottom: "0.25rem" }}>
                  + Commissions
                </p>
                <p style={{ fontSize: "clamp(0.6rem, 1.2vw, 0.7rem)", color: "#22d3ee", margin: 0 }}>
                  From sales
                </p>
              </div>
              <p style={{ fontSize: "clamp(0.875rem, 3vw, 1.25rem)", fontFamily: "'Space Grotesk', monospace", color: "#06b6d4", fontWeight: 700, margin: 0, textAlign: "right", marginLeft: "0.5rem", whiteSpace: "nowrap" }}>
                + ₹{Math.round(breakdownDetails.totalCommissions).toLocaleString()}
              </p>
            </div>

            {/* Fixed OpEx */}
            <div className="breakdown-item" style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "clamp(0.75rem, 2vw, 1rem)",
              borderBottom: "1px solid rgba(161, 250, 255, 0.1)"
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "clamp(0.65rem, 1.5vw, 0.75rem)", color: "#eab308", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.1em", margin: 0, marginBottom: "0.25rem" }}>
                  + Fixed OpEx
                </p>
                <p style={{ fontSize: "clamp(0.6rem, 1.2vw, 0.7rem)", color: "#ca8a04", margin: 0 }}>
                  Rent, utilities
                </p>
              </div>
              <p style={{ fontSize: "clamp(0.875rem, 3vw, 1.25rem)", fontFamily: "'Space Grotesk', monospace", color: "#eab308", fontWeight: 700, margin: 0, textAlign: "right", marginLeft: "0.5rem", whiteSpace: "nowrap" }}>
                + ₹{Math.round(breakdownDetails.fixedExpenses).toLocaleString()}
              </p>
            </div>

            {/* Salesman Expenses */}
            <div className="breakdown-item" style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "clamp(0.75rem, 2vw, 1rem)",
              borderBottom: "1px solid rgba(161, 250, 255, 0.1)"
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "clamp(0.65rem, 1.5vw, 0.75rem)", color: "#f97316", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.1em", margin: 0, marginBottom: "0.25rem" }}>
                  + Salesman Claims
                </p>
                <p style={{ fontSize: "clamp(0.6rem, 1.2vw, 0.7rem)", color: "#ea580c", margin: 0 }}>
                  Approved only
                </p>
              </div>
              <p style={{ fontSize: "clamp(0.875rem, 3vw, 1.25rem)", fontFamily: "'Space Grotesk', monospace", color: "#f97316", fontWeight: 700, margin: 0, textAlign: "right", marginLeft: "0.5rem", whiteSpace: "nowrap" }}>
                + ₹{Math.round(breakdownDetails.salariedExpenses).toLocaleString()}
              </p>
            </div>

            {/* Paid Leave - Only show if > 0 */}
            {breakdownDetails.paidLeaveCost > 0 && (
              <div className="breakdown-item" style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: "clamp(0.75rem, 2vw, 1rem)",
                borderBottom: "1px solid rgba(161, 250, 255, 0.1)"
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "clamp(0.65rem, 1.5vw, 0.75rem)", color: "#ef4444", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.1em", margin: 0, marginBottom: "0.25rem" }}>
                    + Paid Leave
                  </p>
                  <p style={{ fontSize: "clamp(0.6rem, 1.2vw, 0.7rem)", color: "#dc2626", margin: 0 }}>
                    Salary continuation
                  </p>
                </div>
                <p style={{ fontSize: "clamp(0.875rem, 3vw, 1.25rem)", fontFamily: "'Space Grotesk', monospace", color: "#ef4444", fontWeight: 700, margin: 0, textAlign: "right", marginLeft: "0.5rem", whiteSpace: "nowrap" }}>
                  + ₹{Math.round(breakdownDetails.paidLeaveCost).toLocaleString()}
                </p>
              </div>
            )}

            {/* TOTAL LIABILITY */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: "clamp(0.75rem, 2vw, 1rem)",
              paddingBottom: "clamp(0.75rem, 2vw, 1rem)",
              paddingLeft: "clamp(0.75rem, 2vw, 1rem)",
              paddingRight: "clamp(0.75rem, 2vw, 1rem)",
              background: "rgba(249, 115, 22, 0.1)",
              borderTop: "2px solid #f97316",
              borderRadius: "0.5rem",
              marginTop: "0.5rem"
            }}>
              <p className="font-headline" style={{
                fontSize: "clamp(0.75rem, 1.5vw, 0.875rem)",
                fontWeight: 700,
                color: "#f97316",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                margin: 0
              }}>
                TOTAL LIABILITY
              </p>
              <p style={{ fontSize: "clamp(1rem, 3vw, 1.5rem)", fontFamily: "'Space Grotesk', monospace", color: "#f97316", fontWeight: 700, margin: 0, textAlign: "right", whiteSpace: "nowrap" }}>
                ₹{Math.round(stats.totalFixedBurn).toLocaleString()}
              </p>
            </div>

            {/* NET PROFIT */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: "clamp(0.75rem, 2vw, 1rem)",
              paddingBottom: "clamp(0.75rem, 2vw, 1rem)",
              paddingLeft: "clamp(0.75rem, 2vw, 1rem)",
              paddingRight: "clamp(0.75rem, 2vw, 1rem)",
              background: isProfit ? "rgba(52, 211, 153, 0.1)" : "rgba(255, 113, 108, 0.1)",
              borderTop: `2px solid ${isProfit ? "#34d399" : "#ff716c"}`,
              borderRadius: "0.5rem"
            }}>
              <p className="font-headline" style={{
                fontSize: "clamp(0.75rem, 1.5vw, 0.875rem)",
                fontWeight: 700,
                color: isProfit ? "#34d399" : "#ff716c",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                margin: 0
              }}>
                NET PROFIT
              </p>
              <p style={{ fontSize: "clamp(1rem, 3vw, 1.5rem)", fontFamily: "'Space Grotesk', monospace", color: isProfit ? "#34d399" : "#ff716c", fontWeight: 700, margin: 0, textAlign: "right", whiteSpace: "nowrap" }}>
                ₹{Math.round(totalNetProfit).toLocaleString()}
              </p>
            </div>
          </div>
        </section>

        {/* CHANNEL PROFITABILITY */}
        <section style={{ marginBottom: "clamp(1.5rem, 4vw, 2rem)" }}>
          <h2 className="font-headline" style={{
            fontSize: "clamp(0.875rem, 3vw, 1.25rem)",
            fontWeight: 700,
            color: "#a1faff",
            margin: 0,
            marginBottom: "clamp(0.75rem, 2vw, 1rem)",
            letterSpacing: "-0.01em"
          }}>
            Channel Profitability
          </h2>

          <div className="channel-grid" style={{ 
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "clamp(0.75rem, 2vw, 1rem)"
          }}>
            {channelData.length > 0 ? (
              channelData.map((channel) => (
                <div key={channel.name} style={{
                  background: "rgba(23, 26, 28, 0.6)",
                  backdropFilter: "blur(32px)",
                  border: "1px solid rgba(161, 250, 255, 0.1)",
                  borderRadius: "1rem",
                  padding: "clamp(1rem, 3vw, 1.5rem)",
                  boxShadow: "0 0 20px rgba(0, 244, 254, 0.08)",
                  transition: "transform 0.2s ease"
                }} onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
                  <p style={{ fontSize: "clamp(0.625rem, 1.5vw, 0.75rem)", color: "#a1faff", textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, margin: 0, marginBottom: "clamp(0.75rem, 2vw, 1rem)" }}>
                    {channel.name}
                  </p>

                  <div style={{ marginBottom: "clamp(0.75rem, 2vw, 1rem)" }}>
                    <p style={{ fontSize: "clamp(0.625rem, 1.2vw, 0.75rem)", color: "#aaabad", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, marginBottom: "0.25rem" }}>
                      Revenue
                    </p>
                    <p style={{ fontSize: "clamp(1rem, 3vw, 1.25rem)", fontFamily: "'Space Grotesk', monospace", color: "#00f4fe", fontWeight: 700, margin: 0 }}>
                      ₹{Math.round(channel.revenue).toLocaleString()}
                    </p>
                  </div>

                  <div style={{ marginBottom: "clamp(0.75rem, 2vw, 1rem)" }}>
                    <p style={{ fontSize: "clamp(0.625rem, 1.2vw, 0.75rem)", color: "#aaabad", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, marginBottom: "0.25rem" }}>
                      Profit
                    </p>
                    <p style={{ fontSize: "clamp(1rem, 3vw, 1.25rem)", fontFamily: "'Space Grotesk', monospace", color: "#34d399", fontWeight: 700, margin: 0 }}>
                      ₹{Math.round(channel.profit).toLocaleString()}
                    </p>
                  </div>

                  <div style={{ marginBottom: "clamp(0.75rem, 2vw, 1rem)" }}>
                    <p style={{ fontSize: "clamp(0.625rem, 1.2vw, 0.75rem)", color: "#aaabad", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, marginBottom: "0.25rem" }}>
                      Margin
                    </p>
                    <p style={{ fontSize: "clamp(1rem, 3vw, 1.25rem)", fontFamily: "'Space Grotesk', monospace", color: "#f59e0b", fontWeight: 700, margin: 0 }}>
                      {channel.margin.toFixed(1)}%
                    </p>
                  </div>

                  <div style={{ width: "100%", height: "3px", background: "rgba(161, 250, 255, 0.1)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      background: `linear-gradient(90deg, #a1faff, #00f4fe)`,
                      width: `${Math.max(0, Math.min(channel.margin, 100))}%`,
                      borderRadius: "2px",
                      transition: "width 0.3s ease"
                    }} />
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: "#aaabad", fontSize: "0.875rem" }}>No channel data available</p>
            )}
          </div>
        </section>

        {/* KEY INDICATORS - Mobile Friendly */}
        <section style={{ marginBottom: "clamp(1.5rem, 4vw, 2rem)" }}>
          <h2 className="font-headline" style={{
            fontSize: "clamp(0.875rem, 3vw, 1.25rem)",
            fontWeight: 700,
            color: "#a1faff",
            margin: 0,
            marginBottom: "clamp(0.75rem, 2vw, 1rem)",
            letterSpacing: "-0.01em"
          }}>
            Key Indicators
          </h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "clamp(0.75rem, 2vw, 1rem)"
          }}>
            {/* COGS */}
            <div style={{
              background: "rgba(23, 26, 28, 0.6)",
              backdropFilter: "blur(32px)",
              border: "1px solid rgba(161, 250, 255, 0.1)",
              borderRadius: "1rem",
              padding: "clamp(1rem, 3vw, 1.5rem)",
              transition: "transform 0.2s ease"
            }} onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
              <p style={{ fontSize: "clamp(0.625rem, 1.2vw, 0.75rem)", color: "#a1faff", textTransform: "uppercase", letterSpacing: "0.2em", margin: 0, marginBottom: "0.5rem", fontWeight: 700 }}>
                COGS
              </p>
              <p style={{ fontSize: "clamp(1rem, 3vw, 1.25rem)", fontFamily: "'Space Grotesk', monospace", fontWeight: 700, color: "#f97316", margin: 0 }}>
                ₹{Math.round(stats.totalCOGS).toLocaleString()}
              </p>
            </div>

            {/* OpEx */}
            <div style={{
              background: "rgba(23, 26, 28, 0.6)",
              backdropFilter: "blur(32px)",
              border: "1px solid rgba(161, 250, 255, 0.1)",
              borderRadius: "1rem",
              padding: "clamp(1rem, 3vw, 1.5rem)",
              transition: "transform 0.2s ease"
            }} onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
              <p style={{ fontSize: "clamp(0.625rem, 1.2vw, 0.75rem)", color: "#a1faff", textTransform: "uppercase", letterSpacing: "0.2em", margin: 0, marginBottom: "0.5rem", fontWeight: 700 }}>
                Total OpEx
              </p>
              <p style={{ fontSize: "clamp(1rem, 3vw, 1.25rem)", fontFamily: "'Space Grotesk', monospace", fontWeight: 700, color: "#ef4444", margin: 0 }}>
                ₹{Math.round(stats.totalOpEx).toLocaleString()}
              </p>
            </div>

            {/* Revenue Ratio */}
            <div style={{
              background: "rgba(23, 26, 28, 0.6)",
              backdropFilter: "blur(32px)",
              border: "1px solid rgba(161, 250, 255, 0.1)",
              borderRadius: "1rem",
              padding: "clamp(1rem, 3vw, 1.5rem)",
              transition: "transform 0.2s ease"
            }} onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
              <p style={{ fontSize: "clamp(0.625rem, 1.2vw, 0.75rem)", color: "#a1faff", textTransform: "uppercase", letterSpacing: "0.2em", margin: 0, marginBottom: "0.5rem", fontWeight: 700 }}>
                Revenue/Burn
              </p>
              <p style={{ fontSize: "clamp(1rem, 3vw, 1.25rem)", fontFamily: "'Space Grotesk', monospace", fontWeight: 700, color: "#8b5cf6", margin: 0 }}>
                {revenuePerBurn}x
              </p>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{
          marginTop: "clamp(2rem, 5vw, 4rem)",
          paddingTop: "clamp(1rem, 3vw, 2rem)",
          borderTop: "1px solid rgba(161, 250, 255, 0.1)",
          display: "flex",
          flexDirection: "column",
          gap: "clamp(0.75rem, 2vw, 1rem)",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.4
        }}>
          <p style={{ fontSize: "clamp(0.65rem, 1.5vw, 0.75rem)", color: "#aaabad", margin: 0, textAlign: "center" }}>
            © 2026 CONQRETE // PROFIT ENGINE v2.1
          </p>
          <div style={{ display: "flex", gap: "clamp(1rem, 3vw, 2rem)", fontSize: "clamp(0.625rem, 1.2vw, 0.75rem)", color: "#aaabad", flexWrap: "wrap", justifyContent: "center" }}>
            <span>METRICS UPDATED: NOW</span>
            <span>STATUS: OPERATIONAL</span>
          </div>
        </footer>

      </main>
    </>
  );
}