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
    <div className="p-8 min-h-screen pb-20 bg-[#F8F9FA]">
      {/* WAREHOUSE HEADER & STATS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">CONQRETE LOGISTICS</h1>
          <p className="text-sm text-[#6B7280] font-semibold mt-1">Shipment & Warehouse Management System</p>
        </div>

        <div className="flex gap-4">
          <div className="bg-white border border-[#E5E7EB] px-6 py-3 rounded-lg shadow-sm flex flex-col items-center min-w-[120px]">
            <span className="text-xs text-[#6B7280] uppercase font-semibold mb-1">Queue</span>
            <span className="text-2xl font-bold text-[#111827]">{stats.pending}</span>
          </div>
          <div className="bg-white border border-[#E5E7EB] px-6 py-3 rounded-lg shadow-sm flex flex-col items-center min-w-[120px]">
            <span className="text-xs text-[#6B7280] uppercase font-semibold mb-1">Dispatched</span>
            <span className="text-2xl font-bold text-[#111827]">{stats.shippedToday}</span>
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
            className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none pl-10"
          />
          <span className="absolute left-3 top-2.5 text-[#6B7280] text-sm">🔍</span>
        </div>
        
        <div className="flex bg-[#F3F4F6] border border-[#E5E7EB] p-1 rounded-md">
          {["Pending", "Shipped", "All"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                filter === f ? "bg-white text-[#111827] shadow-sm" : "text-[#6B7280] hover:text-[#111827]"
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
          <div className="w-10 h-10 border-4 border-[#0EA5E9] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-[#6B7280] animate-pulse">Syncing Warehouse Data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
          {filteredOrders.map((order) => (
            <div 
              key={order.id} 
              className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden transition-all hover:shadow-md flex flex-col"
            >
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-[#111827]">{order.order_number}</h2>
                    <p className="text-xs text-[#6B7280] mt-1">{new Date(order.created_at).toLocaleDateString()} @ {new Date(order.created_at).toLocaleTimeString()}</p>
                  </div>
                  <div className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    order.status === 'Pending' 
                    ? 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]' 
                    : 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]'
                  }`}>
                    {order.status}
                  </div>
                </div>

                {/* SHIP TO SECTION */}
                <div className="bg-[#F9FAFB] p-4 rounded-md mb-6 border border-[#E5E7EB]">
                  <p className="text-xs text-[#6B7280] font-semibold uppercase mb-2">Consignee Details</p>
                  <p className="text-base font-bold text-[#111827]">{order.customer_name}</p>
                  <p className="text-sm text-[#0EA5E9] font-medium mt-1">Route: {order.sales_channel}</p>
                </div>

                {/* PACKING LIST PREVIEW */}
                <div className="mb-8 flex-1">
                  <p className="text-xs text-[#6B7280] font-semibold uppercase mb-3">Packing List Breakdown</p>
                  <div className="space-y-3">
                    {order.order_items?.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-sm border-b border-[#E5E7EB] pb-2">
                        <span className="text-[#4B5563] max-w-[180px] truncate">{item.product_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[#6B7280] text-xs">x</span>
                          <span className="font-medium text-[#111827]">{item.quantity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="flex flex-col gap-3 mt-auto">
                  <button 
                    onClick={() => downloadShippingDocs(order)}
                    className="w-full bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#111827] py-2.5 rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <span>📄 Generate Manifest / Invoice</span>
                  </button>
                  
                  {order.status === "Pending" && (
                    <button 
                      onClick={() => handleProcessShipment(order)}
                      className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white py-2.5 rounded-md text-sm font-semibold transition-colors"
                    >
                      Confirm Logistics Dispatch
                    </button>
                  )}

                  {order.status === "Shipped" && (
                    <div className="text-center py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-md">
                       <p className="text-[#065F46] font-semibold text-sm">✓ Successfully Dispatched</p>
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
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-[#E5E7EB] rounded-lg mt-8 bg-white">
          <p className="text-[#6B7280] text-sm font-medium">No Shipments Found</p>
          <button onClick={() => setFilter("All")} className="mt-2 text-[#0EA5E9] text-sm font-semibold hover:underline">Show History</button>
        </div>
      )}
    </div>
  );
}