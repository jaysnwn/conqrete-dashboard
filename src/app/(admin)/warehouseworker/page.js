"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function WarehouseMonitor() {
  const [workers, setWorkers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchWarehouseData();
  }, []);

  const fetchWarehouseData = async () => {
    setIsLoading(true);
    
    const [workerRes, invRes, orderRes] = await Promise.all([
      // Pull staff from the NEW master employees table
      supabase.from("employees").select("*").eq("role", "Warehouse"),
      // Pull your live products
      supabase.from("products").select("*"),
      // Count orders waiting for dispatch
      supabase.from("orders").select("id", { count: 'exact' }).eq("status", "Pending")
    ]);

    setWorkers(workerRes.data || []);
    setInventory(invRes.data || []);
    setPendingOrders(orderRes.count || 0);
    setIsLoading(false);
  };

  return (
    <div className="p-8 min-h-screen bg-[#F8F9FA] text-[#111827] pb-20">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#111827]">Warehouse Monitor</h1>
        <p className="text-sm text-[#6B7280] mt-1">Logistics & Inventory Overview</p>
      </div>

      {/* DASHBOARD STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-[#E5E7EB] p-6 rounded-lg shadow-sm">
          <p className="text-xs text-[#6B7280] uppercase font-semibold tracking-wider mb-2">Orders Awaiting Dispatch</p>
          <p className="text-3xl font-bold text-[#111827]">{pendingOrders}</p>
        </div>
        <div className="bg-white border border-[#E5E7EB] p-6 rounded-lg shadow-sm">
          <p className="text-xs text-[#6B7280] uppercase font-semibold tracking-wider mb-2">Active Floor Staff</p>
          <p className="text-3xl font-bold text-[#111827]">{workers.length}</p>
        </div>
        <div className="bg-white border border-[#E5E7EB] p-6 rounded-lg shadow-sm">
          <p className="text-xs text-[#6B7280] uppercase font-semibold tracking-wider mb-2">Low Stock Alerts</p>
          <p className="text-3xl font-bold text-[#111827]">
            {inventory.filter(p => p.stock < 10).length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* WAREHOUSE PERSONNEL LIST */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E5E7EB] bg-[#F9FAFB]">
            <h3 className="text-sm font-semibold text-[#111827]">Active Floor Personnel</h3>
          </div>
          <div className="divide-y divide-[#E5E7EB]">
            {workers.map(worker => (
              <div key={worker.id} className="p-4 flex justify-between items-center hover:bg-[#F9FAFB] transition-colors">
                <div>
                  <p className="font-semibold text-[#111827]">{worker.full_name}</p>
                  <p className="text-xs text-[#6B7280] mt-1">{worker.employee_id} • {worker.shift_timing || "General Shift"}</p>
                </div>
                <span className="text-xs bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] px-2.5 py-0.5 rounded-full font-medium">
                  Online
                </span>
              </div>
            ))}
            {workers.length === 0 && <p className="p-8 text-center text-[#6B7280] text-sm">Onboard floor staff in the HR Terminal.</p>}
          </div>
        </div>

        {/* QUICK INVENTORY SNAPSHOT */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E5E7EB] bg-[#F9FAFB]">
            <h3 className="text-sm font-semibold text-[#111827]">Live Inventory Snapshot</h3>
          </div>
          <div className="divide-y divide-[#E5E7EB]">
            {inventory.slice(0, 6).map(item => (
              <div key={item.id} className="p-4 flex justify-between items-center hover:bg-[#F9FAFB] transition-colors">
                <div>
                  <p className="font-semibold text-[#111827]">{item.name}</p>
                  <p className="text-xs text-[#6B7280] mt-1">{item.sku}</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${item.stock < 10 ? 'text-[#991B1B]' : 'text-[#111827]'}`}>
                    {item.stock}
                  </p>
                  <p className="text-[10px] text-[#6B7280] uppercase font-semibold">Units</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}