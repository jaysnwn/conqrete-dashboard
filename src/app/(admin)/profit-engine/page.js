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
    orderCount: 0
  });

  const [channelData, setChannelData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    calculateEngineMetrics();
  }, []);

  const calculateEngineMetrics = async () => {
    setIsLoading(true);
    try {
      // 1. FETCH DATA
      const [ordersRes, itemsRes, productsRes, hrRes, expensesRes] = await Promise.all([
        supabase.from("orders").select("*"),
        supabase.from("order_items").select("*"),
        supabase.from("products").select("id, landed_cost"),
        supabase.from("employees").select("base_salary, status"),
        supabase.from("expenses").select("amount") 
      ]);

      if (ordersRes.error || itemsRes.error || productsRes.error || hrRes.error) {
        throw new Error("Critical Data Fetch Failure");
      }

      // 2. EXTRACT LIVE COSTS (HR + OpEx)
      const activeSalaries = hrRes.data
        .filter(emp => emp.status === "Active")
        .reduce((sum, emp) => sum + (Number(emp.base_salary) || 0), 0);

      const totalOpEx = (expensesRes.data || [])
        .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

      const totalFixedBurn = activeSalaries + totalOpEx;

      const products = productsRes.data || [];
      const productCostLookup = {};
      products.forEach(p => { productCostLookup[p.id] = Number(p.landed_cost) || 0; });

      let totalRevenue = 0;
      let totalCOGS = 0;
      const channelMap = {};

      // 3. PROCESS ORDERS
      const orders = ordersRes.data || [];
      const allItems = itemsRes.data || [];

      orders.forEach(order => {
        const orderRev = Number(order.total_amount) || 0;
        totalRevenue += orderRev;
        
        const channel = order.sales_channel || "Retailer";
        if (!channelMap[channel]) channelMap[channel] = { rev: 0, cost: 0 };

        const relatedItems = allItems.filter(item => item.order_id === order.id);
        relatedItems.forEach(item => {
          const cost = (productCostLookup[item.product_id] || 0) * (Number(item.quantity) || 0);
          totalCOGS += cost;
          channelMap[channel].rev += (Number(item.unit_price) * (Number(item.quantity) || 0));
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
        orderCount: orders.length
      });

      setChannelData(Object.entries(channelMap).map(([name, data]) => ({
        name,
        profit: data.rev - data.cost,
        margin: data.rev > 0 ? ((data.rev - data.cost) / data.rev * 100).toFixed(1) : 0
      })));

    } catch (err) {
      console.error("Engine Error:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // NEW MATH: ALL Expenses subtracted from Gross Profit
  const totalNetProfit = stats.grossProfit - stats.totalFixedBurn;
  
  const breakEvenProgress = stats.totalFixedBurn > 0 
    ? Math.min((stats.grossProfit / stats.totalFixedBurn) * 100, 100) 
    : 100;

  if (isLoading) return (
    <div className="bg-black min-h-screen flex items-center justify-center">
      <div className="text-cyan-400 font-mono text-xs animate-pulse tracking-[0.5em]">SYNCING FINANCIALS...</div>
    </div>
  );

  return (
    <div className="p-8 bg-black min-h-screen text-white font-sans">
      
      {/* TOP BAR: THE REALITY CHECK */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6 border-b border-gray-900 pb-10">
        <div>
          <h1 className="text-6xl font-black italic tracking-tighter uppercase leading-none">
            PROFIT<span className="text-cyan-400">ENGINE</span>
          </h1>
          <p className="text-gray-600 font-mono text-[10px] mt-2 uppercase tracking-[0.4em]">Live Personnel & OpEx Integration</p>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <div className="bg-[#0a0a0a] border border-orange-900/30 px-6 py-4 rounded-2xl text-right hidden sm:block">
            <p className="text-[9px] text-orange-500/70 uppercase font-black tracking-widest">OpEx Burn</p>
            <p className="text-2xl font-mono text-orange-400">₹{stats.totalOpEx.toLocaleString()}</p>
          </div>
          <div className="bg-[#0a0a0a] border border-gray-800 px-6 py-4 rounded-2xl text-right">
            <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Active Payroll</p>
            <p className="text-2xl font-mono text-white">₹{stats.totalSalaryBurn.toLocaleString()}</p>
          </div>
          <div className={`px-6 py-4 rounded-2xl text-right border ${totalNetProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <p className="text-[9px] uppercase font-black tracking-widest opacity-70">Total Net Profit</p>
            <p className={`text-2xl font-mono font-black ${totalNetProfit >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>
              ₹{totalNetProfit.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* CORE STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        <div className="bg-[#0a0a0a] border border-gray-800 p-10 rounded-[2.5rem]">
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-4">Total Sales</p>
          <h2 className="text-5xl font-black italic tracking-tighter">₹{stats.totalRevenue.toLocaleString()}</h2>
          <p className="text-[10px] text-gray-700 mt-4 font-mono uppercase tracking-widest italic">{stats.orderCount} Verified Orders</p>
        </div>

        <div className="bg-[#0a0a0a] border border-gray-800 p-10 rounded-[2.5rem] relative overflow-hidden group">
          <p className="text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-4">Gross Profit (GP)</p>
          <h2 className="text-5xl font-black italic tracking-tighter text-cyan-400">₹{stats.grossProfit.toLocaleString()}</h2>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity">
            <span className="text-xs font-mono">MARGIN: {stats.netMargin.toFixed(1)}%</span>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-gray-800 p-10 rounded-[2.5rem] flex flex-col justify-between">
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-4">Break-Even Progress</p>
          <div className="flex items-end gap-3">
            <h2 className="text-5xl font-black italic tracking-tighter font-mono">{breakEvenProgress.toFixed(0)}%</h2>
            <p className="text-[10px] text-gray-500 uppercase font-black mb-2 pb-1">Covered</p>
          </div>
          <div className="w-full bg-gray-900 h-1.5 rounded-full mt-6 overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${breakEvenProgress >= 100 ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-cyan-500 shadow-[0_0_10px_#06b6d4]'}`}
              style={{ width: `${breakEvenProgress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* LOWER GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-[3rem] p-12">
          <h3 className="text-xs font-black uppercase tracking-[0.4em] text-gray-500 mb-12">Channel Contribution</h3>
          <div className="space-y-10">
            {channelData.map(channel => (
              <div key={channel.name}>
                <div className="flex justify-between mb-4 items-end">
                  <span className="text-xl font-black uppercase italic tracking-tighter">{channel.name}</span>
                  <span className="text-sm font-mono text-cyan-400 font-bold tracking-widest">{channel.margin}%</span>
                </div>
                <div className="w-full bg-[#111] h-3 rounded-full overflow-hidden border border-gray-900">
                  <div 
                    className="bg-cyan-400 h-full transition-all duration-1000" 
                    style={{ width: `${Math.min(Number(channel.margin) * 2, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LOGIC CARD */}
        <div className="bg-white text-black rounded-[3rem] p-12 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-4 opacity-40">Operating Efficiency</p>
            <h4 className="text-3xl font-black italic tracking-tighter uppercase leading-tight mb-8">
              Every ₹1 of fixed burn generates <span className="text-cyan-600">₹{(stats.totalRevenue / (stats.totalFixedBurn || 1)).toFixed(2)}</span> in sales.
            </h4>
          </div>
          <div className="space-y-4">
             <div className="flex justify-between border-b border-black/10 pb-4">
               <span className="text-xs font-bold uppercase tracking-widest">Gross Profit</span>
               <span className="font-mono font-bold">₹{stats.grossProfit.toLocaleString()}</span>
             </div>
             <div className="flex justify-between border-b border-black/10 pb-4">
               <span className="text-xs font-bold uppercase tracking-widest text-red-600">HR Obligations</span>
               <span className="font-mono font-bold">- ₹{stats.totalSalaryBurn.toLocaleString()}</span>
             </div>
             <div className="flex justify-between border-b border-black/10 pb-4">
               <span className="text-xs font-bold uppercase tracking-widest text-orange-600">OpEx Liabilities</span>
               <span className="font-mono font-bold">- ₹{stats.totalOpEx.toLocaleString()}</span>
             </div>
             <div className="flex justify-between pt-4">
               <span className="text-sm font-black uppercase tracking-widest">Total Net Profit</span>
               <span className="text-2xl font-black font-mono">₹{totalNetProfit.toLocaleString()}</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}