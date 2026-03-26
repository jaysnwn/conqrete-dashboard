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
    <div className="p-8 text-white min-h-screen bg-black pb-20">
      <div className="mb-10">
        <h1 className="text-4xl font-black italic tracking-tighter uppercase text-white">Warehouse Monitor</h1>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-1">Logistics & Inventory Overview</p>
      </div>

      {/* DASHBOARD STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-[#0a0a0a] border border-gray-800 p-6 rounded-3xl shadow-2xl">
          <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Orders Awaiting Dispatch</p>
          <p className="text-4xl font-mono text-orange-500 font-black">{pendingOrders}</p>
        </div>
        <div className="bg-[#0a0a0a] border border-gray-800 p-6 rounded-3xl shadow-2xl">
          <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Active Floor Staff</p>
          <p className="text-4xl font-mono text-cyan-400 font-black">{workers.length}</p>
        </div>
        <div className="bg-[#0a0a0a] border border-gray-800 p-6 rounded-3xl shadow-2xl">
          <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Low Stock Alerts</p>
          <p className="text-4xl font-mono text-red-500 font-black">
            {inventory.filter(p => p.stock < 10).length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* WAREHOUSE PERSONNEL LIST */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-gray-800 bg-[#050505]">
            <h3 className="text-base font-black italic text-cyan-400 uppercase tracking-widest">Active Floor Personnel</h3>
          </div>
          <div className="divide-y divide-gray-900">
            {workers.map(worker => (
              <div key={worker.id} className="p-5 flex justify-between items-center hover:bg-white/[0.02] transition-colors">
                <div>
                  <p className="font-bold text-white uppercase">{worker.full_name}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{worker.employee_id} • {worker.shift_timing || "General Shift"}</p>
                </div>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full uppercase font-black">
                  Online
                </span>
              </div>
            ))}
            {workers.length === 0 && <p className="p-10 text-center text-gray-600 text-xs">Onboard floor staff in the HR Terminal.</p>}
          </div>
        </div>

        {/* QUICK INVENTORY SNAPSHOT */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-gray-800 bg-[#050505]">
            <h3 className="text-base font-black italic text-orange-400 uppercase tracking-widest">Live Inventory Snapshot</h3>
          </div>
          <div className="divide-y divide-gray-900">
            {inventory.slice(0, 6).map(item => (
              <div key={item.id} className="p-5 flex justify-between items-center hover:bg-white/[0.02] transition-colors">
                <div>
                  <p className="font-bold text-white uppercase text-sm">{item.name}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{item.sku}</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-mono font-black ${item.stock < 10 ? 'text-red-500' : 'text-white'}`}>
                    {item.stock}
                  </p>
                  <p className="text-[8px] text-gray-600 uppercase font-bold">Units</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}