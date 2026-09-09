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
      <div className="h-full w-full flex flex-col justify-center items-center font-sans min-h-[80vh]">
        <div className="w-8 h-8 border-2 border-[#E5E7EB] border-t-[#0EA5E9] rounded-full animate-spin mb-4"></div>
        <p className="text-[#6B7280] text-sm font-medium">Syncing Data...</p>
      </div>
    );
  }

  const isStockCritical = stats.lowStockItems + stats.outOfStockItems > 0;

  return (
    <div className="w-full max-w-[1920px] mx-auto space-y-6 text-[#111827]">
      {/* Hero Header */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-lg border border-[#E5E7EB] shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-[#111827]">Executive Overview</h2>
          <p className="text-[#6B7280] text-sm mt-1">Real-time operational intelligence</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-[#D1D5DB] text-[#374151] rounded-lg text-sm font-semibold hover:bg-[#F9FAFB] transition-colors shadow-sm">
              Generate Report
          </button>
          <button onClick={fetchDashboardData} className="px-4 py-2 bg-[#0EA5E9] text-white rounded-lg text-sm font-semibold hover:bg-[#0284C7] transition-colors shadow-sm">
              System Sync
          </button>
        </div>
      </section>

      {/* Stats Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Sales */}
        <div className="bg-white rounded-lg p-6 border border-[#E5E7EB] shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2">Total Sales Revenue</p>
            <h3 className="text-3xl font-bold text-[#111827]">₹{stats.totalRevenue.toLocaleString('en-IN')}</h3>
          </div>
          <div className="mt-4 h-1.5 w-full bg-[#F3F4F6] rounded-full overflow-hidden">
            <div className="h-full w-[70%] bg-[#0EA5E9]"></div>
          </div>
        </div>

        {/* Asset Value */}
        <div className="bg-white rounded-lg p-6 border border-[#E5E7EB] shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2">Warehouse Asset Value</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-[#111827]">₹{stats.warehouseValue.toLocaleString('en-IN')}</h3>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xs text-[#6B7280] font-medium">Inventory Market Value</span>
          </div>
        </div>

        {/* Shipments */}
        <div className="bg-white rounded-lg p-6 border border-[#E5E7EB] shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2">Pending Shipments</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-[#111827]">{stats.pendingOrders}</h3>
              <span className="text-xs font-bold text-[#F59E0B] uppercase bg-[#FEF3C7] px-2 py-0.5 rounded border border-[#FDE68A]">Action Req.</span>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/orders" className="text-sm font-semibold text-[#0EA5E9] hover:text-[#0284C7]">View Logistics Queue &rarr;</Link>
          </div>
        </div>

        {/* Stock Alerts */}
        <div className={`bg-white rounded-lg p-6 border shadow-sm flex flex-col justify-between ${isStockCritical ? 'border-[#FEE2E2]' : 'border-[#E5E7EB]'}`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2">Stock Alerts</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-[#111827]">{stats.lowStockItems + stats.outOfStockItems}</h3>
              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded border ${isStockCritical ? 'text-[#991B1B] bg-[#FEE2E2] border-[#FECACA]' : 'text-[#065F46] bg-[#D1FAE5] border-[#A7F3D0]'}`}>
                {isStockCritical ? 'Critical' : 'Healthy'}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isStockCritical ? 'bg-[#EF4444] animate-pulse' : 'bg-[#10B981]'}`}></div>
            <span className="text-xs text-[#6B7280] font-medium">
              {isStockCritical ? 'Replenishment Required' : 'All nodes within threshold'}
            </span>
          </div>
        </div>
      </section>

      {/* Main Data Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start pb-10">
        
        {/* Recent Orders Table (66%) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-sm">
            <h4 className="text-lg font-bold text-[#111827]">Recent Sales Orders</h4>
            <Link href="/orders" className="text-sm font-semibold text-[#0EA5E9] hover:text-[#0284C7]">View All</Link>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">ID</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Name</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Channel</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Amount</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280] text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {data.orders.slice(0, 5).map(order => (
                  <tr key={order.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-[#111827]">#{order.order_number || order.id.substring(0,6).toUpperCase()}</td>
                    <td className="px-6 py-4 text-sm text-[#374151]">{order.customer_name || 'Retail Customer'}</td>
                    <td className="px-6 py-4 text-xs text-[#6B7280] uppercase font-medium">{order.sales_channel}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-[#111827]">₹{Number(order.total_amount).toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 text-right">
                      {order.status === 'Pending' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">Pending</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]">Shipped</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data.orders.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center py-10 text-[#6B7280] text-sm">No orders detected in the system.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar Content (33%) */}
        <div className="space-y-6">
          
          {/* Stock Critical List */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm p-5">
            <h4 className="text-lg font-bold text-[#111827] mb-4">Stock Critical</h4>
            
            {!isStockCritical ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#D1FAE5] flex items-center justify-center mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                </div>
                <p className="text-[#111827] font-semibold text-sm">All levels healthy</p>
                <p className="text-[#6B7280] text-xs mt-1">Inventory balance is optimized.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.products.filter(p => p.stock < 50).slice(0, 4).map(p => (
                  <div key={p.id} className="flex justify-between items-center py-2 border-b border-[#F3F4F6] last:border-0">
                    <div className="flex gap-3 items-center">
                      <span className="text-xl bg-[#F3F4F6] rounded p-1">{p.image || 'ðŸ“¦'}</span>
                      <div>
                        <p className="text-[#111827] font-medium text-sm">{p.name}</p>
                        <p className="text-[#6B7280] text-xs font-mono">{p.sku}</p>
                      </div>
                    </div>
                    <p className={`text-sm font-bold font-mono ${p.stock <= 0 ? 'text-[#EF4444]' : 'text-[#F59E0B]'}`}>
                      {p.stock} LEFT
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm p-5">
            <h4 className="text-lg font-bold text-[#111827] mb-4">Quick Shortcuts</h4>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/products" className="bg-[#F8F9FA] border border-[#E5E7EB] hover:border-[#0EA5E9] hover:bg-[#F0F9FF] h-24 rounded-lg flex flex-col items-center justify-center gap-2 transition-all">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                <span className="text-xs font-semibold text-[#374151]">Add SKU</span>
              </Link>
              <Link href="/orders" className="bg-[#F8F9FA] border border-[#E5E7EB] hover:border-[#0EA5E9] hover:bg-[#F0F9FF] h-24 rounded-lg flex flex-col items-center justify-center gap-2 transition-all">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                <span className="text-xs font-semibold text-[#374151]">New Sale</span>
              </Link>
              <Link href="/inventory" className="bg-[#F8F9FA] border border-[#E5E7EB] hover:border-[#0EA5E9] hover:bg-[#F0F9FF] h-24 rounded-lg flex flex-col items-center justify-center gap-2 transition-all">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                <span className="text-xs font-semibold text-[#374151]">Restock</span>
              </Link>
              <Link href="/shipments" className="bg-[#F8F9FA] border border-[#E5E7EB] hover:border-[#0EA5E9] hover:bg-[#F0F9FF] h-24 rounded-lg flex flex-col items-center justify-center gap-2 transition-all">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                <span className="text-xs font-semibold text-[#374151]">Logistics</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
