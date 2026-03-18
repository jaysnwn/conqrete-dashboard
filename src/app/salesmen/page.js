"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

export default function SalesmenPage() {
  const [salesmen, setSalesmen] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "", phone: "", region: "", monthly_target: 100000, fixed_salary: 15000, commission_rate: 2.0
  });

  useEffect(() => { fetchTeamData(); }, []);

  const fetchTeamData = async () => {
    setIsLoading(true);
    const [salesmenRes, ordersRes] = await Promise.all([
      supabase.from("salesmen").select("*").order("name", { ascending: true }),
      supabase.from("orders").select("*").neq("status", "Cancelled")
    ]);

    setSalesmen(salesmenRes.data || []);
    setOrders(ordersRes.data || []);
    setIsLoading(false);
  };

  const handleSaveSalesman = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("salesmen").insert([formData]);
    if (error) return alert("Error adding team member: " + error.message);

    setIsModalOpen(false);
    setFormData({ name: "", phone: "", region: "", monthly_target: 100000, fixed_salary: 15000, commission_rate: 2.0 });
    fetchTeamData();
  };

  // --- THE PAYROLL ENGINE ---
  const teamPerformance = useMemo(() => {
    return salesmen.map(rep => {
      // Find orders tagged to this rep
      const repOrders = orders.filter(o => o.sales_rep === rep.name);
      const totalSold = repOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
      
      const target = Number(rep.monthly_target);
      const progressPercent = target > 0 ? Math.min((totalSold / target) * 100, 100) : 0;
      
      const fixedSalary = Number(rep.fixed_salary);
      const commissionEarned = totalSold * (Number(rep.commission_rate) / 100);
      const totalPayout = fixedSalary + commissionEarned;

      return {
        ...rep, totalSold, progressPercent, commissionEarned, totalPayout, dealsClosed: repOrders.length
      };
    }).sort((a, b) => b.totalSold - a.totalSold);
  }, [salesmen, orders]);

  const totalTeamRevenue = teamPerformance.reduce((sum, rep) => sum + rep.totalSold, 0);
  const totalPayrollLiability = teamPerformance.reduce((sum, rep) => sum + rep.totalPayout, 0);
  const topPerformer = teamPerformance.length > 0 ? teamPerformance[0] : null;

  return (
    <div className="p-8 text-white min-h-screen bg-black pb-20">
      {/* HEADER & GLOBAL STATS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-white">FIELD FORCE</h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-1">CONQRETE Team & Payroll Manager</p>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <div className="bg-[#0a0a0a] border border-gray-800 px-6 py-3 rounded-2xl">
            <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Network Revenue</p>
            <p className="text-2xl font-mono text-cyan-400 font-black">₹{totalTeamRevenue.toLocaleString()}</p>
          </div>
          <div className="bg-[#0a0a0a] border border-gray-800 px-6 py-3 rounded-2xl">
            <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Total Payroll Due</p>
            <p className="text-2xl font-mono text-emerald-400 font-black">₹{Math.round(totalPayrollLiability).toLocaleString()}</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-cyan-400 text-black px-8 py-3 rounded-full font-black uppercase text-xs tracking-widest hover:bg-cyan-300 transition-all shadow-xl shadow-cyan-400/10">
            + Add Sales Exec
          </button>
        </div>
      </div>

      {/* TOP PERFORMER */}
      {topPerformer && topPerformer.totalSold > 0 && (
        <div className="mb-10 bg-gradient-to-r from-[#0a1a15] to-black border border-emerald-900/50 p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between shadow-2xl">
          <div className="flex items-center gap-6 mb-4 md:mb-0">
            <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center text-black text-2xl font-black italic shadow-lg shadow-emerald-500/20">#1</div>
            <div>
              <p className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.3em] mb-1">Top Closer</p>
              <h2 className="text-3xl font-black text-white uppercase tracking-tight">{topPerformer.name}</h2>
              <p className="text-xs text-emerald-400/70 uppercase tracking-widest font-bold">{topPerformer.region}</p>
            </div>
          </div>
          <div className="text-left md:text-right">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Revenue Generated</p>
            <p className="text-4xl font-mono font-black text-emerald-400">₹{topPerformer.totalSold.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* TEAM ROSTER GRID */}
      {isLoading ? (
        <div className="text-center py-20 text-cyan-400 font-mono text-xs tracking-widest uppercase animate-pulse">Syncing Payroll Data...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {teamPerformance.map((rep) => (
            <div key={rep.id} className="bg-[#0a0a0a] border border-gray-800 rounded-3xl p-6 shadow-2xl hover:border-cyan-900/50 transition-all">
              
              <div className="mb-6">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">{rep.name}</h3>
                <div className="flex gap-2 mt-3">
                  <span className="text-[9px] bg-[#111] text-gray-400 px-3 py-1.5 rounded-full border border-gray-800 uppercase tracking-widest font-bold">{rep.region}</span>
                  <span className="text-[9px] bg-cyan-900/20 text-cyan-400 px-3 py-1.5 rounded-full border border-cyan-900/50 uppercase tracking-widest font-bold">{rep.commission_rate}% Comm</span>
                </div>
              </div>

              {/* TARGET PROGRESS */}
              <div className="mb-8 bg-black p-5 rounded-2xl border border-gray-800/50">
                <div className="flex justify-between items-end mb-3">
                  <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Target Progress</span>
                  <span className={`font-mono text-sm font-black ${rep.progressPercent >= 100 ? 'text-emerald-400' : 'text-cyan-400'}`}>
                    {Math.round(rep.progressPercent)}%
                  </span>
                </div>
                <div className="w-full bg-[#111] rounded-full h-2.5 mb-3 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${rep.progressPercent >= 100 ? 'bg-emerald-500' : 'bg-cyan-400'}`} style={{ width: `${rep.progressPercent}%` }}></div>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-gray-500 font-bold">
                  <span className="text-white">₹{rep.totalSold.toLocaleString()}</span>
                  <span>Goal: ₹{Number(rep.monthly_target).toLocaleString()}</span>
                </div>
              </div>

              {/* PAYROLL BREAKDOWN */}
              <div className="bg-[#111] rounded-2xl p-5 border border-gray-800">
                <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-4 border-b border-gray-800 pb-2">Estimated Payout</p>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-bold">Fixed Base Salary:</span>
                    <span className="font-mono text-white">₹{Number(rep.fixed_salary).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-bold">Commission Earned:</span>
                    <span className="font-mono text-emerald-400">+ ₹{Math.round(rep.commissionEarned).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex justify-between items-end border-t border-gray-800 pt-3">
                  <span className="text-[10px] text-emerald-600 uppercase font-black tracking-widest">Total Cheque</span>
                  <span className="text-xl font-mono text-emerald-400 font-black">₹{Math.round(rep.totalPayout).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REGISTRATION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-50 backdrop-blur-xl">
          <div className="bg-[#0a0a0a] border border-gray-800 p-8 rounded-3xl w-full max-w-lg shadow-2xl relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 text-gray-600 hover:text-white text-2xl">×</button>
            <h2 className="text-xl font-black text-white mb-8 uppercase tracking-tighter italic border-b border-gray-800 pb-4">Onboard Sales Exec</h2>
            
            <form onSubmit={handleSaveSalesman} className="space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase tracking-widest font-bold">Full Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-white text-sm outline-none focus:border-cyan-400" placeholder="e.g. Rahul Sharma" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase tracking-widest font-bold">Phone</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-white text-sm font-mono outline-none" placeholder="9922..." />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase tracking-widest font-bold">Territory</label>
                  <input required type="text" value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-white text-sm outline-none" placeholder="e.g. Sangamner" />
                </div>
                <div className="col-span-2 mt-4">
                  <p className="text-[10px] text-cyan-500 uppercase tracking-widest font-black border-b border-gray-800 pb-2 mb-4">Financial Structure</p>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase tracking-widest font-bold">Fixed Base Salary (₹)</label>
                  <input required type="number" value={formData.fixed_salary} onChange={e => setFormData({...formData, fixed_salary: e.target.value})} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-white font-mono text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase tracking-widest font-bold">Commission (%)</label>
                  <input required type="number" step="0.1" value={formData.commission_rate} onChange={e => setFormData({...formData, commission_rate: e.target.value})} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-emerald-400 font-mono text-sm outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase tracking-widest font-bold">Monthly Target (₹)</label>
                  <input required type="number" value={formData.monthly_target} onChange={e => setFormData({...formData, monthly_target: e.target.value})} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-cyan-400 font-mono text-sm outline-none" />
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-gray-800">
                <button type="submit" className="w-full bg-cyan-400 text-black py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-cyan-300 transition-all shadow-xl shadow-cyan-400/10 active:scale-95">
                  Save & Deploy to Field
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}