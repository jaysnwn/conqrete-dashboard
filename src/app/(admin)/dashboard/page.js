"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function Dashboard() {
  const [data, setData] = useState({
    products: [],
    orders: [],
    logs: []
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    
    // Fetch all core data in parallel
    const [prods, ords, lgData] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("inventory_logs").select("*").order("created_at", { ascending: false }).limit(5)
    ]);

    setData({
      products: prods.data || [],
      orders: ords.data || [],
      logs: lgData.data || []
    });
    
    setTimeout(() => setIsLoading(false), 800);
  };

  // --- BUSINESS LOGIC CALCULATIONS ---
  const stats = useMemo(() => {
    const totalRevenue = data.orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const warehouseValue = data.products.reduce((sum, p) => sum + (Number(p.stock) * Number(p.landed_cost)), 0);
    const lowStockItems = data.products.filter(p => p.stock > 0 && p.stock < 50).length;
    const outOfStockItems = data.products.filter(p => p.stock <= 0).length;
    const pendingOrders = data.orders.filter(o => o.status === 'Pending').length;

    return { totalRevenue, warehouseValue, lowStockItems, outOfStockItems, pendingOrders };
  }, [data]);

  if (isLoading) {
    return (
      <div className="h-full w-full bg-transparent flex flex-col justify-center items-center font-sans min-h-[80vh]">
        <div className="w-16 h-16 border-4 border-[#a1faff]/20 border-t-[#a1faff] rounded-full animate-spin mb-6 shadow-[0_0_15px_#a1faff]"></div>
        <p className="text-[#a1faff] font-mono text-xs uppercase tracking-[0.4em] animate-pulse">Syncing Live Data...</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .glass-card {
            background: rgba(35, 38, 41, 0.4);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(161, 250, 255, 0.1);
        }
        .neon-glow-primary {
            box-shadow: 0 0 40px -10px rgba(0, 244, 254, 0.15);
        }
        .font-headline { font-family: 'Space Grotesk', sans-serif; }
        .font-body { font-family: 'Manrope', sans-serif; }
        .font-label { font-family: 'Manrope', sans-serif; }
      `}</style>

      {/* MAIN WORKSPACE ONLY (Sidebar is handled globally) */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10 font-body text-[#eeeef0]">
        
        {/* Top Bar */}
       

        {/* Content Canvas */}
        <div className="px-12 py-8 max-w-[1920px] mx-auto w-full space-y-12">
          
          {/* Hero Header */}
          <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold font-headline tracking-tighter text-white">EXECUTIVE OVERVIEW</h2>
              <div className="flex items-center gap-3 mt-4 text-[#a1faff]/80">
                <div className="h-[1px] w-12 bg-[#a1faff]/30"></div>
                <p className="font-label uppercase tracking-widest text-xs">Real-time operational intelligence</p>
              </div>
            </div>
            <div className="flex gap-4">
              <button className="bg-[#232629]/50 border border-[#a1faff]/10 px-6 py-3 rounded-full text-xs font-bold tracking-widest uppercase hover:bg-[#292c2f] transition-all">
                  Generate Report
              </button>
              <button onClick={fetchDashboardData} className="bg-gradient-to-r from-[#a1faff] to-[#00f4fe] text-[#004346] px-8 py-3 rounded-full text-xs font-bold tracking-widest uppercase shadow-lg shadow-[#a1faff]/20 hover:scale-105 transition-all">
                  System Sync
              </button>
            </div>
          </section>

          {/* Stats Cards Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Total Sales */}
            <div className="glass-card rounded-xl p-8 neon-glow-primary relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#a1faff]/5 rounded-full blur-2xl group-hover:bg-[#a1faff]/10 transition-colors"></div>
              <p className="text-[10px] font-label uppercase tracking-widest text-[#aaabad] mb-2">Total Sales Revenue</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-headline font-bold text-white">₹{stats.totalRevenue.toLocaleString('en-IN')}</h3>
              </div>
              <div className="mt-6 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full w-[70%] bg-gradient-to-r from-[#a1faff] to-[#00f4fe]"></div>
              </div>
            </div>

            {/* Asset Value */}
            <div className="glass-card rounded-xl p-8 relative overflow-hidden group">
              <p className="text-[10px] font-label uppercase tracking-widest text-[#aaabad] mb-2">Warehouse Asset Value</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-headline font-bold text-white">₹{stats.warehouseValue.toLocaleString('en-IN')}</h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Inventory</span>
              </div>
              <div className="mt-6 flex items-center gap-1">
                <span className="text-[10px] text-slate-500 font-label">— Market Volatility: Low</span>
              </div>
            </div>

            {/* Shipments */}
            <div className="glass-card rounded-xl p-8 border-[#ff59e3]/20 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#ff59e3]/5 rounded-full blur-2xl"></div>
              <p className="text-[10px] font-label uppercase tracking-widest text-[#aaabad] mb-2">Pending Shipments</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-headline font-bold text-white">{stats.pendingOrders}</h3>
                <span className="text-[10px] font-bold text-[#ff59e3] uppercase tracking-tighter">Action Req.</span>
              </div>
              <div className="mt-6">
                <Link href="/orders" className="text-[10px] font-bold uppercase tracking-widest text-[#ff59e3] hover:underline">View Logistics Queue</Link>
              </div>
            </div>

            {/* Stock Alerts */}
            <div className={`glass-card rounded-xl p-8 relative overflow-hidden group ${stats.lowStockItems + stats.outOfStockItems > 0 ? 'border-[#ff716c]/40' : 'border-[#a1faff]/20'}`}>
              <p className="text-[10px] font-label uppercase tracking-widest text-[#aaabad] mb-2">Stock Alerts</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-headline font-bold text-white">{stats.lowStockItems + stats.outOfStockItems}</h3>
                <span className={`text-[10px] font-bold uppercase tracking-tighter ${stats.lowStockItems + stats.outOfStockItems > 0 ? 'text-[#ff716c]' : 'text-[#a1faff]'}`}>
                  {stats.lowStockItems + stats.outOfStockItems > 0 ? 'Critical' : 'Healthy'}
                </span>
              </div>
              <div className="mt-6 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${stats.lowStockItems + stats.outOfStockItems > 0 ? 'bg-[#ff716c]' : 'bg-[#a1faff]'}`}></div>
                <span className="text-[10px] text-[#aaabad] font-label">
                  {stats.lowStockItems + stats.outOfStockItems > 0 ? 'Replenishment Required' : 'All nodes within threshold'}
                </span>
              </div>
            </div>
          </section>

          {/* Main Data Section */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start pb-20">
            
            {/* Recent Orders Table (66%) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-xl font-headline font-bold tracking-tight text-white">RECENT SALES ORDERS</h4>
                <Link href="/orders" className="text-[10px] font-label uppercase tracking-widest text-[#a1faff] hover:text-cyan-200 transition-colors">Export Ledger</Link>
              </div>
              <div className="glass-card rounded-lg overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-[#292c2f]/30">
                    <tr>
                      <th className="px-6 py-5 text-[10px] font-label uppercase tracking-[0.2em] text-[#aaabad]">ID</th>
                      <th className="px-6 py-5 text-[10px] font-label uppercase tracking-[0.2em] text-[#aaabad]">NAME</th>
                      <th className="px-6 py-5 text-[10px] font-label uppercase tracking-[0.2em] text-[#aaabad]">CHANNEL</th>
                      <th className="px-6 py-5 text-[10px] font-label uppercase tracking-[0.2em] text-[#aaabad]">AMOUNT</th>
                      <th className="px-6 py-5 text-[10px] font-label uppercase tracking-[0.2em] text-[#aaabad] text-right">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.orders.slice(0, 5).map(order => (
                      <tr key={order.id} className="hover:bg-[#292c2f]/20 transition-colors group">
                        <td className="px-6 py-5 text-sm font-headline text-[#a1faff]/80">#{order.order_number || order.id.substring(0,6).toUpperCase()}</td>
                        <td className="px-6 py-5 text-sm font-medium text-white">{order.customer_name || 'Retail Customer'}</td>
                        <td className="px-6 py-5 text-xs text-[#aaabad] uppercase">{order.sales_channel}</td>
                        <td className="px-6 py-5 text-sm font-bold text-white">₹{Number(order.total_amount).toLocaleString('en-IN')}</td>
                        <td className="px-6 py-5 text-right">
                          {order.status === 'Pending' ? (
                            <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-[#ff59e3]/10 text-[#ff59e3] border border-[#ff59e3]/20">PENDING</span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-[#a1faff]/10 text-[#a1faff] border border-[#a1faff]/20">SHIPPED</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {data.orders.length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center py-10 text-slate-500 font-mono text-xs">No orders detected in the system.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sidebar Content (33%) */}
            <div className="space-y-12">
              
              {/* Stock Critical List */}
              <div className="space-y-6">
                <h4 className="text-xl font-headline font-bold tracking-tight text-white">STOCK CRITICAL LIST</h4>
                
                {stats.lowStockItems + stats.outOfStockItems === 0 ? (
                  <div className="glass-card rounded-lg p-8 flex flex-col items-center justify-center text-center py-16 border-dashed border-[#a1faff]/20">
                    <div className="w-16 h-16 rounded-full bg-[#a1faff]/5 flex items-center justify-center mb-4">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a1faff" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <p className="text-white font-headline font-medium text-lg">All levels healthy</p>
                    <p className="text-[#aaabad] text-xs font-label mt-2">Inventory balance is optimized.</p>
                  </div>
                ) : (
                  <div className="glass-card rounded-lg p-6 flex flex-col gap-4 border border-[#ff716c]/30">
                    {data.products.filter(p => p.stock < 50).slice(0, 4).map(p => (
                      <div key={p.id} className="flex justify-between items-center border-b border-white/5 pb-4 last:border-0 last:pb-0">
                        <div className="flex gap-4 items-center">
                          <span className="text-xl">{p.image || '📦'}</span>
                          <div>
                            <p className="text-white font-medium text-sm">{p.name}</p>
                            <p className="text-[#aaabad] text-[10px] font-mono">{p.sku}</p>
                          </div>
                        </div>
                        <p className={`text-sm font-bold font-mono ${p.stock <= 0 ? 'text-[#ff716c]' : 'text-orange-400'}`}>
                          {p.stock} LEFT
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Shortcuts */}
              <div className="space-y-6">
                <h4 className="text-xl font-headline font-bold tracking-tight text-white">QUICK SHORTCUTS</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Link href="/products" className="glass-card h-32 rounded-lg flex flex-col items-center justify-center gap-3 hover:bg-[#a1faff]/5 hover:border-[#a1faff]/40 transition-all group active:scale-95">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a1faff" strokeWidth="2" className="group-hover:scale-110 transition-transform"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                    <span className="text-[10px] font-label font-bold uppercase tracking-widest text-[#eeeef0]">Add SKU</span>
                  </Link>
                  <Link href="/orders" className="glass-card h-32 rounded-lg flex flex-col items-center justify-center gap-3 hover:bg-[#a1faff]/5 hover:border-[#a1faff]/40 transition-all group active:scale-95">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a1faff" strokeWidth="2" className="group-hover:scale-110 transition-transform"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                    <span className="text-[10px] font-label font-bold uppercase tracking-widest text-[#eeeef0]">New Sale</span>
                  </Link>
                  <Link href="/inventory" className="glass-card h-32 rounded-lg flex flex-col items-center justify-center gap-3 hover:bg-[#a1faff]/5 hover:border-[#a1faff]/40 transition-all group active:scale-95">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a1faff" strokeWidth="2" className="group-hover:scale-110 transition-transform"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                    <span className="text-[10px] font-label font-bold uppercase tracking-widest text-[#eeeef0]">Restock</span>
                  </Link>
                  <Link href="/shipments" className="glass-card h-32 rounded-lg flex flex-col items-center justify-center gap-3 hover:bg-[#a1faff]/5 hover:border-[#a1faff]/40 transition-all group active:scale-95">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a1faff" strokeWidth="2" className="group-hover:scale-110 transition-transform"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                    <span className="text-[10px] font-label font-bold uppercase tracking-widest text-[#eeeef0]">Logistics</span>
                  </Link>
                </div>
              </div>

            </div>
          </section>

        </div>

        {/* System Footer Info (UPDATED) */}
        <footer className="mt-auto px-12 py-8 opacity-40 flex flex-col md:flex-row justify-between items-center text-[10px] font-label uppercase tracking-[0.3em] gap-4 border-t border-white/5">
          <p>© 2026 CONQRETE // SYSTEM CORE v4.0.2</p>
          <div className="flex gap-8">
            <span>LATENCY: 14MS</span>
            <span>UPTIME: 99.99%</span>
          </div>
        </footer>

      </main>
    </>
  );
}