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
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-9 h-9 rounded-full border-2 border-[#E5E7EB] border-t-[#0EA5E9] animate-spin" />
          <p className="text-[#6B7280] text-xs font-semibold uppercase tracking-wider">
            Syncing Financials...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
        <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-lg p-8 max-w-lg text-center">
          <p className="text-[#991B1B] text-sm font-semibold mb-2">⚠️ Error Loading Profit Engine</p>
          <p className="text-[#991B1B] text-xs opacity-80">{error}</p>
          <button
            onClick={() => calculateEngineMetrics()}
            className="mt-4 px-4 py-2 bg-[#991B1B] text-white rounded-md text-xs font-semibold hover:bg-[#7F1D1D] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F9FA] text-[#111827] p-4 sm:p-6 lg:p-8 pb-12">
      {/* HEADER */}
      <section className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#111827] mb-1">
          Profit Engine
        </h1>
        <p className="text-sm text-[#6B7280]">
          Real-time financial metrics & channel profitability analysis
        </p>
      </section>

      {/* TOP METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Revenue */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
            Monthly Revenue
          </p>
          <p className="text-2xl font-bold text-[#111827]">
            ₹{Math.round(stats.totalRevenue).toLocaleString()}
          </p>
          <p className="text-xs text-[#6B7280] mt-2">
            {stats.orderCount} orders
          </p>
        </div>

        {/* Gross Profit */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
            Gross Profit
          </p>
          <p className="text-2xl font-bold text-[#111827]">
            ₹{Math.round(stats.grossProfit).toLocaleString()}
          </p>
          <p className="text-xs text-[#6B7280] mt-2">
            {stats.netMargin.toFixed(1)}% margin
          </p>
        </div>

        {/* Net Profit */}
        <div className={`bg-white border ${isProfit ? 'border-[#A7F3D0]' : 'border-[#FECACA]'} rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow`}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isProfit ? 'text-[#065F46]' : 'text-[#991B1B]'}`}>
            Net Profit
          </p>
          <p className={`text-2xl font-bold ${isProfit ? 'text-[#065F46]' : 'text-[#991B1B]'}`}>
            ₹{Math.round(totalNetProfit).toLocaleString()}
          </p>
          <p className="text-xs text-[#6B7280] mt-2">
            {isProfit ? "✅ Profitable" : "❌ Loss"}
          </p>
        </div>

        {/* Break Even */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
            Break Even
          </p>
          <p className="text-2xl font-bold text-[#111827]">
            {breakEvenProgress.toFixed(0)}%
          </p>
          <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full mt-3 overflow-hidden">
            <div 
              className="h-full bg-[#0EA5E9] rounded-full transition-all duration-300"
              style={{ width: `${breakEvenProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* MONTHLY LIABILITY BREAKDOWN */}
      <section className="bg-white border border-[#E5E7EB] rounded-lg p-5 sm:p-6 mb-8 shadow-sm">
        <h2 className="text-lg font-bold text-[#111827] mb-4">
          Monthly Liability Subtotal
        </h2>

        <div className="flex flex-col gap-3">
          {/* Base Salaries */}
          <div className="flex justify-between items-center pb-3 border-b border-[#F3F4F6]">
            <div>
              <p className="text-sm font-semibold text-[#111827] mb-0.5">Base Salaries</p>
              <p className="text-xs text-[#6B7280]">Fixed commitment</p>
            </div>
            <p className="text-base font-semibold text-[#111827]">
              ₹{Math.round(stats.totalSalaryBurn).toLocaleString()}
            </p>
          </div>

          {/* Commissions */}
          <div className="flex justify-between items-center pb-3 border-b border-[#F3F4F6]">
            <div>
              <p className="text-sm font-semibold text-[#111827] mb-0.5">+ Commissions</p>
              <p className="text-xs text-[#6B7280]">From sales</p>
            </div>
            <p className="text-base font-semibold text-[#111827]">
              + ₹{Math.round(breakdownDetails.totalCommissions).toLocaleString()}
            </p>
          </div>

          {/* Fixed OpEx */}
          <div className="flex justify-between items-center pb-3 border-b border-[#F3F4F6]">
            <div>
              <p className="text-sm font-semibold text-[#111827] mb-0.5">+ Fixed OpEx</p>
              <p className="text-xs text-[#6B7280]">Rent, utilities</p>
            </div>
            <p className="text-base font-semibold text-[#111827]">
              + ₹{Math.round(breakdownDetails.fixedExpenses).toLocaleString()}
            </p>
          </div>

          {/* Salesman Expenses */}
          <div className="flex justify-between items-center pb-3 border-b border-[#F3F4F6]">
            <div>
              <p className="text-sm font-semibold text-[#111827] mb-0.5">+ Salesman Claims</p>
              <p className="text-xs text-[#6B7280]">Approved only</p>
            </div>
            <p className="text-base font-semibold text-[#111827]">
              + ₹{Math.round(breakdownDetails.salariedExpenses).toLocaleString()}
            </p>
          </div>

          {/* Paid Leave */}
          {breakdownDetails.paidLeaveCost > 0 && (
            <div className="flex justify-between items-center pb-3 border-b border-[#F3F4F6]">
              <div>
                <p className="text-sm font-semibold text-[#111827] mb-0.5">+ Paid Leave</p>
                <p className="text-xs text-[#6B7280]">Salary continuation</p>
              </div>
              <p className="text-base font-semibold text-[#111827]">
                + ₹{Math.round(breakdownDetails.paidLeaveCost).toLocaleString()}
              </p>
            </div>
          )}

          {/* TOTAL LIABILITY */}
          <div className="flex justify-between items-center p-3 bg-[#F9FAFB] border-t-2 border-[#E5E7EB] rounded-md mt-2">
            <p className="text-sm font-bold text-[#374151] uppercase tracking-wider">
              Total Liability
            </p>
            <p className="text-lg font-bold text-[#111827]">
              ₹{Math.round(stats.totalFixedBurn).toLocaleString()}
            </p>
          </div>

          {/* NET PROFIT */}
          <div className={`flex justify-between items-center p-3 rounded-md mt-2 border-l-4 ${isProfit ? 'bg-[#D1FAE5] border-[#065F46]' : 'bg-[#FEE2E2] border-[#991B1B]'}`}>
            <p className={`text-sm font-bold uppercase tracking-wider ${isProfit ? 'text-[#065F46]' : 'text-[#991B1B]'}`}>
              Net Profit
            </p>
            <p className={`text-lg font-bold ${isProfit ? 'text-[#065F46]' : 'text-[#991B1B]'}`}>
              ₹{Math.round(totalNetProfit).toLocaleString()}
            </p>
          </div>
        </div>
      </section>

      {/* CHANNEL PROFITABILITY */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-[#111827] mb-4">
          Channel Profitability
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {channelData.length > 0 ? (
            channelData.map((channel) => (
              <div key={channel.name} className="bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-sm font-bold text-[#111827] mb-4 uppercase tracking-wider">
                  {channel.name}
                </p>

                <div className="mb-3">
                  <p className="text-xs text-[#6B7280] uppercase tracking-wider mb-1">Revenue</p>
                  <p className="text-base font-semibold text-[#111827]">
                    ₹{Math.round(channel.revenue).toLocaleString()}
                  </p>
                </div>

                <div className="mb-3">
                  <p className="text-xs text-[#6B7280] uppercase tracking-wider mb-1">Profit</p>
                  <p className="text-base font-semibold text-[#111827]">
                    ₹{Math.round(channel.profit).toLocaleString()}
                  </p>
                </div>

                <div className="mb-3">
                  <p className="text-xs text-[#6B7280] uppercase tracking-wider mb-1">Margin</p>
                  <p className="text-base font-semibold text-[#0EA5E9]">
                    {channel.margin.toFixed(1)}%
                  </p>
                </div>

                <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#0EA5E9] rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(channel.margin, 100))}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-[#6B7280]">No channel data available</p>
          )}
        </div>
      </section>

      {/* KEY INDICATORS */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-[#111827] mb-4">
          Key Indicators
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* COGS */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-4 shadow-sm">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">COGS</p>
            <p className="text-lg font-bold text-[#111827]">₹{Math.round(stats.totalCOGS).toLocaleString()}</p>
          </div>

          {/* OpEx */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-4 shadow-sm">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Total OpEx</p>
            <p className="text-lg font-bold text-[#111827]">₹{Math.round(stats.totalOpEx).toLocaleString()}</p>
          </div>

          {/* Revenue Ratio */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-4 shadow-sm">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Revenue/Burn</p>
            <p className="text-lg font-bold text-[#111827]">{revenuePerBurn}x</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-12 pt-6 border-t border-[#E5E7EB] flex flex-col gap-2 items-center justify-center text-[#6B7280]">
        <p className="text-xs text-center">
          © 2026 CONQRETE ERP // Profit Engine v2.1
        </p>
        <div className="flex gap-4 text-[10px] uppercase tracking-wider">
          <span>Metrics Updated: Now</span>
          <span>Status: Operational</span>
        </div>
      </footer>
    </main>
  );
}