"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { generateInvoicePDF } from "@/lib/generateInvoice";

export default function ShipmentsPage() {
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("Pending"); // Pending, Shipped, All
  const [searchQuery, setSearchQuery] = useState("");

  // Stats for the Warehouse Dashboard
  const stats = useMemo(() => {
    const pending = orders.filter(o => o.status === "Pending").length;
    const shippedToday = orders.filter(o => o.status === "Shipped").length;
    return { pending, shippedToday };
  }, [orders]);

  useEffect(() => {
    fetchWarehouseData();
  }, []);

  const fetchWarehouseData = async () => {
    setIsLoading(true);
    // Fetch Orders, their items, and current product stock levels
    const [ordRes, prodRes] = await Promise.all([
      supabase.from("orders").select(`
        *,
        order_items (*)
      `).order("created_at", { ascending: false }),
      supabase.from("products").select("*")
    ]);

    setOrders(ordRes.data || []);
    setInventory(prodRes.data || []);
    setIsLoading(false);
  };

  const handleProcessShipment = async (order) => {
    // Advanced logic: Check if we actually have enough stock before shipping
    const items = order.order_items || [];
    let stockError = false;

    items.forEach(item => {
      const product = inventory.find(p => p.id === item.product_id);
      if (!product || product.stock < 0) {
        stockError = true;
      }
    });

    if (stockError) {
      alert("CRITICAL ERROR: Inventory mismatch. One or more items are out of stock.");
      return;
    }

    const confirmAction = confirm(`Dispatch Order ${order.order_number} to ${order.customer_name}? This will lock the invoice.`);
    if (!confirmAction) return;

    // 1. Update Order Status
    const { error: updateErr } = await supabase
      .from("orders")
      .update({ 
        status: "Shipped",
        shipped_at: new Date().toISOString() 
      })
      .eq("id", order.id);

    if (updateErr) {
      alert("Failed to update shipment status: " + updateErr.message);
      return;
    }

    // 2. Refresh Local Data
    alert(`SUCCESS: Order ${order.order_number} is now in transit.`);
    fetchWarehouseData();
  };

  const downloadShippingDocs = async (order) => {
    // Generate the professional PDF using our global tool
    const items = order.order_items || [];
    generateInvoicePDF(order, items);
  };

  // Filter Logic
  const filteredOrders = orders.filter(o => {
    const matchesFilter = filter === "All" || o.status === filter;
    const matchesSearch = o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          o.order_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="p-8 text-white min-h-screen pb-20">
      {/* WAREHOUSE HEADER & STATS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white">CONQRETE LOGISTICS</h1>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-[0.2em]">Shipment & Warehouse Management System</p>
        </div>

        <div className="flex gap-4">
          <div className="bg-[#111] border border-gray-800 px-6 py-3 rounded-lg flex flex-col items-center min-w-[120px]">
            <span className="text-[10px] text-gray-500 uppercase font-bold mb-1">Queue</span>
            <span className="text-2xl font-mono text-orange-500 font-black">{stats.pending}</span>
          </div>
          <div className="bg-[#111] border border-gray-800 px-6 py-3 rounded-lg flex flex-col items-center min-w-[120px]">
            <span className="text-[10px] text-gray-500 uppercase font-bold mb-1">Dispatched</span>
            <span className="text-2xl font-mono text-emerald-500 font-black">{stats.shippedToday}</span>
          </div>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder="Search by Order # or Retailer..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-gray-800 p-3 rounded text-sm focus:border-cyan-400 outline-none transition-all pl-10"
          />
          <span className="absolute left-3 top-3.5 text-gray-600 text-sm">🔍</span>
        </div>
        
        <div className="flex bg-[#0a0a0a] border border-gray-800 p-1 rounded">
          {["Pending", "Shipped", "All"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all ${
                filter === f ? "bg-white text-black" : "text-gray-500 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN SHIPMENT GRID */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest animate-pulse">Syncing Warehouse Data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
          {filteredOrders.map((order) => (
            <div 
              key={order.id} 
              className={`bg-[#111] border ${order.status === 'Pending' ? 'border-orange-900/30' : 'border-gray-800'} rounded-xl overflow-hidden shadow-2xl transition-all hover:scale-[1.01]`}
            >
              {/* STATUS BAR */}
              <div className={`h-1.5 w-full ${order.status === 'Pending' ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`}></div>
              
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-mono text-white font-black tracking-tighter">{order.order_number}</h2>
                    <p className="text-[10px] text-gray-500 uppercase font-bold">{new Date(order.created_at).toLocaleDateString()} @ {new Date(order.created_at).toLocaleTimeString()}</p>
                  </div>
                  <div className={`text-[9px] font-black px-3 py-1 rounded uppercase tracking-widest border ${
                    order.status === 'Pending' 
                    ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' 
                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  }`}>
                    {order.status}
                  </div>
                </div>

                {/* SHIP TO SECTION */}
                <div className="bg-black/40 p-4 rounded-lg mb-6 border border-gray-800/50">
                  <p className="text-[9px] text-gray-600 uppercase font-bold tracking-[0.2em] mb-2">Consignee Details</p>
                  <p className="text-lg font-bold text-white tracking-tight">{order.customer_name}</p>
                  <p className="text-[10px] text-cyan-500 font-bold uppercase tracking-widest mt-1">Route: {order.sales_channel}</p>
                </div>

                {/* PACKING LIST PREVIEW */}
                <div className="mb-8">
                  <p className="text-[9px] text-gray-600 uppercase font-bold tracking-[0.2em] mb-3">Packing List Breakdown</p>
                  <div className="space-y-2">
                    {order.order_items?.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-xs border-b border-gray-800/30 pb-2">
                        <span className="text-gray-400 max-w-[180px] truncate">{item.product_name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-600 text-[10px]">x</span>
                          <span className="font-mono text-white font-bold">{item.quantity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => downloadShippingDocs(order)}
                    className="group relative flex items-center justify-center gap-2 w-full bg-[#1a1a1a] border border-gray-700 hover:border-cyan-400 text-gray-400 hover:text-white py-3 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                  >
                    <span>📄 Generate Manifest / Invoice</span>
                  </button>
                  
                  {order.status === "Pending" && (
                    <button 
                      onClick={() => handleProcessShipment(order)}
                      className="w-full bg-orange-500 hover:bg-orange-400 text-black py-4 rounded-lg text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-orange-500/10 active:scale-95"
                    >
                      🚀 Confirm Logistics Dispatch
                    </button>
                  )}

                  {order.status === "Shipped" && (
                    <div className="text-center py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                       <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest italic">✓ Successfully Dispatched</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EMPTY STATE */}
      {!isLoading && filteredOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-gray-900 rounded-3xl">
          <p className="text-gray-700 text-sm font-black uppercase tracking-[0.5em]">No Shipments Found</p>
          <button onClick={() => setFilter("All")} className="mt-4 text-cyan-400 text-[10px] font-bold uppercase underline">Show History</button>
        </div>
      )}
    </div>
  );
}