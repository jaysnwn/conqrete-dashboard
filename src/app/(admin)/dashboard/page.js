"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

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
      // FIX: Added sorting so the newest orders are pulled first
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("inventory_logs").select("*").order("created_at", { ascending: false }).limit(5)
    ]);

    setData({
      products: prods.data || [],
      orders: ords.data || [],
      logs: lgData.data || []
    });
    setIsLoading(false);
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

  return (
    <div className="text-gray-200 pb-10">
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-wider uppercase">CONQRETE Executive Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Real-time operational intelligence</p>
      </div>

      {/* TOP STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-[#111] border border-gray-800 p-6 rounded-lg shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 -mr-8 -mt-8 rounded-full transition-transform group-hover:scale-110"></div>
          <p className="text-xs text-gray-500 font-bold tracking-widest mb-1 uppercase">Total Sales Revenue</p>
          <p className="text-3xl font-mono text-cyan-400">₹{stats.totalRevenue.toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-[#111] border border-gray-800 p-6 rounded-lg shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 -mr-8 -mt-8 rounded-full transition-transform group-hover:scale-110"></div>
          <p className="text-xs text-gray-500 font-bold tracking-widest mb-1 uppercase">Warehouse Asset Value</p>
          <p className="text-3xl font-mono text-emerald-400">₹{stats.warehouseValue.toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-[#111] border border-orange-900/20 p-6 rounded-lg shadow-lg">
          <p className="text-xs text-orange-500 font-bold tracking-widest mb-1 uppercase">Pending Shipments</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-mono text-white">{stats.pendingOrders}</p>
            <span className="text-xs text-gray-500 italic">to be dispatched</span>
          </div>
        </div>

        <div className="bg-[#111] border border-red-900/20 p-6 rounded-lg shadow-lg">
          <p className="text-xs text-red-500 font-bold tracking-widest mb-1 uppercase">Stock Alerts</p>
          <p className="text-3xl font-mono text-red-500">{stats.lowStockItems + stats.outOfStockItems}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* RECENT SALES ACTIVITY */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#111] border border-gray-800 rounded-lg p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 flex justify-between">
              Recent Sales Orders
              <a href="/orders" className="text-cyan-400 text-[10px] hover:underline">View All</a>
            </h3>
            <div className="space-y-4">
              {data.orders.slice(0, 5).map(order => (
                <div key={order.id} className="flex items-center justify-between border-b border-gray-800/50 pb-4">
                  <div className="flex gap-4 items-center">
                    <div className="w-10 h-10 rounded bg-[#0a0a0a] border border-gray-800 flex items-center justify-center font-mono text-xs text-cyan-400">
                      #{order.order_number.split('-')[1]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{order.customer_name}</p>
                      <p className="text-[10px] text-gray-500 uppercase">{order.sales_channel}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-white">₹{Number(order.total_amount).toLocaleString('en-IN')}</p>
                    <p className={`text-[10px] font-bold uppercase ${order.status === 'Pending' ? 'text-orange-400' : 'text-emerald-400'}`}>
                      {order.status}
                    </p>
                  </div>
                </div>
              ))}
              {data.orders.length === 0 && <p className="text-center text-gray-600 text-sm py-4">No sales recorded yet.</p>}
            </div>
          </div>
        </div>

        {/* INVENTORY ALERTS & ACTIONS */}
        <div className="space-y-6">
          <div className="bg-[#111] border border-red-900/30 rounded-lg p-6">
            <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest mb-4">Stock Critical List</h3>
            <div className="space-y-3">
              {data.products.filter(p => p.stock < 50).slice(0, 4).map(p => (
                <div key={p.id} className="flex items-center justify-between bg-[#0a0a0a] p-3 rounded border border-gray-800">
                   <div className="flex items-center gap-3">
                     <span className="text-xl">{p.image}</span>
                     <div>
                       <p className="text-xs font-bold text-white">{p.name}</p>
                       <p className="text-[10px] text-gray-500 font-mono">{p.sku}</p>
                     </div>
                   </div>
                   <div className="text-right">
                     <p className={`text-sm font-mono font-bold ${p.stock <= 0 ? 'text-red-500' : 'text-orange-400'}`}>{p.stock}</p>
                     <p className="text-[9px] text-gray-600 uppercase">Units</p>
                   </div>
                </div>
              ))}
              {data.products.filter(p => p.stock < 50).length === 0 && (
                <p className="text-[10px] text-emerald-500 italic uppercase">All stock levels healthy</p>
              )}
            </div>
          </div>

          <div className="bg-[#111] border border-gray-800 rounded-lg p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Quick Shortcuts</h3>
            <div className="grid grid-cols-2 gap-3">
              <a href="/products" className="bg-[#0a0a0a] hover:bg-white/5 border border-gray-800 p-3 rounded text-center transition-colors">
                 <p className="text-xs font-bold text-cyan-400">ADD SKU</p>
              </a>
              <a href="/orders" className="bg-[#0a0a0a] hover:bg-white/5 border border-gray-800 p-3 rounded text-center transition-colors">
                 <p className="text-xs font-bold text-cyan-400">NEW SALE</p>
              </a>
              <a href="/inventory" className="bg-[#0a0a0a] hover:bg-white/5 border border-gray-800 p-3 rounded text-center transition-colors">
                 <p className="text-xs font-bold text-cyan-400">RESTOCK</p>
              </a>
              <a href="/shipments" className="bg-[#0a0a0a] hover:bg-white/5 border border-gray-800 p-3 rounded text-center transition-colors">
                 <p className="text-xs font-bold text-cyan-400">LOGISTICS</p>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}