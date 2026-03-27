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

  useEffect(() => {
    calculateEngineMetrics();
  }, []);

  const calculateEngineMetrics = async () => {
    setIsLoading(true);
    try {
      const [ordersRes, itemsRes, productsRes, hrRes, expensesRes] =
        await Promise.all([
          supabase.from("orders").select("*"),
          supabase.from("order_items").select("*"),
          supabase.from("products").select("id, landed_cost"),
          supabase.from("employees").select("base_salary, status"),
          supabase.from("expenses").select("amount"),
        ]);

      if (ordersRes.error || itemsRes.error || productsRes.error || hrRes.error)
        throw new Error("Critical Data Fetch Failure");

      const activeSalaries = hrRes.data
        .filter((emp) => emp.status === "Active")
        .reduce((sum, emp) => sum + (Number(emp.base_salary) || 0), 0);

      const totalOpEx = (expensesRes.data || []).reduce(
        (sum, exp) => sum + (Number(exp.amount) || 0),
        0
      );

      const totalFixedBurn = activeSalaries + totalOpEx;
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

  if (isLoading) return (
    <div style={{ background: "#0c0e10", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid rgba(161,250,255,0.2)", borderTopColor: "#a1faff", animation: "spin 0.8s linear infinite" }} />
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#a1faff", fontSize: 11, letterSpacing: "0.5em", textTransform: "uppercase" }}>
          Syncing Financials...
        </p>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap');

        .pe-root { font-family: 'Manrope', sans-serif; background: #0c0e10; color: #eeeef0; }
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

        @keyframes fillBar { from{width:0%} to{width:var(--w)} }
        .bar-anim { animation: fillBar 1.4s cubic-bezier(0.22,1,0.36,1) forwards; }
      `}</style>

      <div className="pe-root" style={{ padding: "56px 48px 72px" }}>

        {/* HERO TITLE */}
        <div className="fu fu1" style={{ marginBottom: 48 }}>
          <h1 className="sg" style={{ fontSize: 72, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
            PROFIT ENGINE
            <span style={{ height: 6, width: 128, background: "#a1faff", borderRadius: 99, display: "inline-block", boxShadow: "0 0 24px rgba(161,250,255,0.65)" }} />
          </h1>
          <p style={{ marginTop: 14, fontSize: 11, color: "#747578", textTransform: "uppercase", letterSpacing: "0.28em" }}>
            Real-time Financial Orchestration &amp; Margin Control
          </p>
        </div>

        {/* TOP KPI ROW */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginBottom: 20 }}>
          {/* OpEx */}
          <div className="glass pe-lift fu fu2" style={{ borderRadius: 16, padding: "28px 30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <span style={{ fontSize: 9, color: "#747578", textTransform: "uppercase", letterSpacing: "0.22em", fontWeight: 700 }}>OpEx Burn</span>
              <span className="ms" style={{ color: "rgba(161,250,255,0.45)" }}>local_fire_department</span>
            </div>
            <div className="sg" style={{ fontSize: 34, fontWeight: 700 }}>₹{stats.totalOpEx.toLocaleString()}</div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#a1faff", fontWeight: 600 }}>Operational expenses</div>
          </div>

          {/* Payroll */}
          <div className="glass pe-lift fu fu3" style={{ borderRadius: 16, padding: "28px 30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <span style={{ fontSize: 9, color: "#747578", textTransform: "uppercase", letterSpacing: "0.22em", fontWeight: 700 }}>Active Payroll</span>
              <span className="ms" style={{ color: "#9f8eff" }}>group</span>
            </div>
            <div className="sg" style={{ fontSize: 34, fontWeight: 700 }}>₹{stats.totalSalaryBurn.toLocaleString()}</div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#747578" }}>Monthly liability</div>
          </div>

          {/* Net Profit */}
          <div className="glass pe-lift fu fu4" style={{ borderRadius: 16, padding: "28px 30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <span style={{ fontSize: 9, color: "#747578", textTransform: "uppercase", letterSpacing: "0.22em", fontWeight: 700 }}>Total Net Profit</span>
              <span className="ms" style={{ color: isProfit ? "#34d399" : "#ff716c" }}>{isProfit ? "trending_up" : "trending_down"}</span>
            </div>
            <div className="sg" style={{ fontSize: 34, fontWeight: 700, color: isProfit ? "#34d399" : "#ff716c" }}>
              {totalNetProfit < 0 ? "-" : ""}₹{Math.abs(totalNetProfit).toLocaleString()}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: isProfit ? "#34d399" : "#ff716c", fontWeight: 600 }}>
              {isProfit ? "Above threshold" : "Below threshold"}
            </div>
          </div>
        </div>

        {/* MIDDLE ROW: Sales + GP + Donut */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 20 }}>
          {/* Total Sales */}
          <div className="glass pe-lift fu fu3" style={{ borderRadius: 20, padding: "30px 34px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: -12, bottom: -12, opacity: 0.04, pointerEvents: "none" }}>
              <span className="ms" style={{ fontSize: 130 }}>shopping_cart</span>
            </div>
            <span style={{ fontSize: 9, color: "#747578", textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, display: "block", marginBottom: 14 }}>Total Sales</span>
            <div className="sg" style={{ fontSize: 48, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, textShadow: "0 0 18px rgba(161,250,255,0.3)" }}>
              ₹{stats.totalRevenue.toLocaleString()}
            </div>
            <div style={{ marginTop: 10, fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: "0.15em" }}>
              {stats.orderCount} verified orders
            </div>
          </div>

          {/* Gross Profit */}
          <div className="glass pe-lift fu fu4" style={{ borderRadius: 20, padding: "30px 34px", position: "relative", overflow: "hidden", boxShadow: "0 0 40px rgba(0,245,255,0.06)" }}>
            <div style={{ position: "absolute", right: -12, bottom: -12, opacity: 0.04, pointerEvents: "none" }}>
              <span className="ms" style={{ fontSize: 130 }}>account_balance_wallet</span>
            </div>
            <span style={{ fontSize: 9, color: "#747578", textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, display: "block", marginBottom: 14 }}>Gross Profit (GP)</span>
            <div className="sg" style={{ fontSize: 48, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: "#a1faff", textShadow: "0 0 24px rgba(161,250,255,0.4)" }}>
              ₹{stats.grossProfit.toLocaleString()}
            </div>
            <div style={{ marginTop: 10, fontSize: 9, color: "#a1faff", opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.15em" }}>
              Margin: {stats.netMargin.toFixed(1)}%
            </div>
          </div>

          {/* Channel Donut */}
          <div className="glass pe-lift fu fu5" style={{ borderRadius: 20, padding: "28px 28px" }}>
            <span style={{ fontSize: 9, color: "#747578", textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, display: "block", marginBottom: 20 }}>Channel Contribution</span>
            <div style={{ display: "flex", justifyContent: "center", position: "relative", width: 130, height: 130, margin: "0 auto 20px" }}>
              <svg viewBox="0 0 100 100" style={{ width: 130, height: 130, transform: "rotate(-90deg)" }}>
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="11" />
                {(() => {
                  const colors = ["#a1faff", "#9f8eff", "#ff59e3", "#34d399"];
                  const total = totalChannelRev || 1;
                  const circ = 2 * Math.PI * 38;
                  let offset = 0;
                  return channelData.map((ch, i) => {
                    const pct = ch.revenue / total;
                    const el = (
                      <circle key={ch.name} cx="50" cy="50" r="38" fill="transparent"
                        stroke={colors[i % colors.length]} strokeWidth="11"
                        strokeDasharray={`${pct * circ} ${circ}`}
                        strokeDashoffset={-offset * circ}
                        style={{ filter: `drop-shadow(0 0 5px ${colors[i % colors.length]}66)` }}
                      />
                    );
                    offset += pct;
                    return el;
                  });
                })()}
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span className="sg" style={{ fontSize: 22, fontWeight: 700 }}>
                  {channelData.length > 0 ? ((channelData[0].revenue / (totalChannelRev || 1)) * 100).toFixed(0) : 0}%
                </span>
                <span style={{ fontSize: 8, color: "#747578", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {channelData[0]?.name || "—"}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {channelData.map((ch, i) => {
                const colors = ["#a1faff", "#9f8eff", "#ff59e3", "#34d399"];
                return (
                  <div key={ch.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: colors[i % colors.length] }} />
                      <span style={{ fontSize: 11, color: "#aaabad" }}>{ch.name}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: colors[i % colors.length] }}>
                      {((ch.revenue / (totalChannelRev || 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* BREAK-EVEN BAR */}
        <div className="glass pe-lift fu fu5" style={{ borderRadius: 20, padding: "32px 36px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
            <div>
              <span style={{ fontSize: 9, color: "#747578", textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, display: "block", marginBottom: 8 }}>Break-even Progress</span>
              <div className="sg" style={{ fontSize: 26, fontWeight: 700 }}>{breakEvenProgress.toFixed(0)}% Covered</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 9, color: "#747578", textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: 4 }}>Target</span>
              <span className="sg" style={{ fontSize: 16, fontWeight: 600 }}>₹{stats.totalFixedBurn.toLocaleString()}</span>
            </div>
          </div>
          <div style={{ width: "100%", height: 10, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden", border: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="bar-anim" style={{
              "--w": `${breakEvenProgress}%`, height: "100%", borderRadius: 99,
              background: breakEvenProgress >= 100 ? "linear-gradient(90deg,#34d399,#10b981)" : "linear-gradient(90deg,#a1faff,#00e5ee)",
              boxShadow: breakEvenProgress >= 100 ? "0 0 14px rgba(52,211,153,0.5)" : "0 0 14px rgba(161,250,255,0.4)",
            }} />
          </div>
          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: "0.15em" }}>
            <span>Initiation</span><span>Stability Point</span><span>Profit Horizon</span>
          </div>
        </div>

        {/* OPERATING EFFICIENCY */}
        <div className="glass fu fu6" style={{ borderRadius: 24, padding: "48px 52px", position: "relative", overflow: "hidden", border: "1px solid rgba(161,250,255,0.06)" }}>
          <div style={{ position: "absolute", top: -80, left: -80, width: 360, height: 360, background: "radial-gradient(circle, rgba(161,250,255,0.04), transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
            <div>
              <span style={{ fontSize: 9, color: "#a1faff", textTransform: "uppercase", letterSpacing: "0.3em", fontWeight: 700, display: "block", marginBottom: 14 }}>Operating Efficiency Index</span>
              <h2 className="sg" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2 }}>
                EVERY ₹1 OF FIXED BURN GENERATES{" "}
                <span style={{ color: "#a1faff", textShadow: "0 0 20px rgba(161,250,255,0.4)" }}>₹{revenuePerBurn}</span>{" "}
                IN SALES
              </h2>
              <p style={{ marginTop: 18, fontSize: 13, color: "#747578", lineHeight: 1.75, maxWidth: 380 }}>
                {parseFloat(revenuePerBurn) < 1.5
                  ? "Capital velocity is in 'Active Recovery' phase. A 15% increase in the sales-to-burn ratio will trigger break-even acceleration."
                  : "Capital velocity is healthy. Focus on margin expansion to convert gross gains into sustained net profit."}
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,0.04)", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.04)" }}>
              {[
                { label: "Gross Profit", value: `₹${stats.grossProfit.toLocaleString()}`, color: "#eeeef0" },
                { label: "HR Obligations", value: `₹${stats.totalSalaryBurn.toLocaleString()}`, color: "#ff716c" },
                { label: "OpEx Liabilities", value: `₹${stats.totalOpEx.toLocaleString()}`, color: "#ff9f43" },
                { label: "Total Net Profit", value: `${totalNetProfit < 0 ? "-" : ""}₹${Math.abs(totalNetProfit).toLocaleString()}`, color: isProfit ? "#34d399" : "#ff716c" },
              ].map((row) => (
                <div key={row.label} style={{ background: "rgba(17,20,22,0.5)", padding: "18px 22px" }}>
                  <span style={{ fontSize: 8, color: "#555", textTransform: "uppercase", letterSpacing: "0.15em", display: "block", marginBottom: 6 }}>{row.label}</span>
                  <div className="sg" style={{ fontSize: 18, fontWeight: 700, color: row.color }}>{row.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}