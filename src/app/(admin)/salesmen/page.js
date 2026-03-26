"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

export default function SalesmenPage() {
  const [salesmen, setSalesmen] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals & States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); 
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false); // NEW: Expense Modal
  const [isSaving, setIsSaving] = useState(false);
  
  // Edit Form State (Updated to match 'employees' table fields)
  const [editData, setEditData] = useState({
    id: "", full_name: "", phone_number: "", work_location: "", monthly_target: 100000, base_salary: 15000, commission_rate: 2.0
  });

  // NEW: Expense Form State
  const [expenseData, setExpenseData] = useState({
    salesman_id: "", 
    date: new Date().toISOString().split('T')[0], 
    category: "Petrol", 
    amount: ""
  });

  useEffect(() => { fetchTeamData(); }, []);

  const fetchTeamData = async () => {
    setIsLoading(true);
    // UPDATED: Now pulling from 'employees' table filtered for Salesmen
    const [salesmenRes, ordersRes] = await Promise.all([
      supabase.from("employees").select("*").eq("role", "Salesman").order("full_name", { ascending: true }),
      supabase.from("orders").select("*").neq("status", "Cancelled")
    ]);

    setSalesmen(salesmenRes.data || []);
    setOrders(ordersRes.data || []);
    setIsLoading(false);
  };

  // --- EDIT LOGIC ---
  const openEditModal = (rep) => {
    setEditData({
      id: rep.id,
      full_name: rep.full_name,
      phone_number: rep.phone_number || "",
      work_location: rep.work_location || "",
      monthly_target: rep.monthly_target || 100000,
      base_salary: rep.base_salary,
      commission_rate: rep.commission_rate
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateSalesman = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("employees") // UPDATED: Points to master employee table
        .update({
          full_name: editData.full_name,
          phone_number: editData.phone_number,
          work_location: editData.work_location,
          monthly_target: editData.monthly_target,
          base_salary: editData.base_salary,
          commission_rate: editData.commission_rate
        })
        .eq("id", editData.id);

      if (error) throw error;
      alert(`${editData.full_name}'s profile updated successfully!`);
      setIsEditModalOpen(false);
      fetchTeamData();
    } catch (err) {
      alert("Error updating team member: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`WARNING: Remove ${name} from the roster?`)) return;
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (!error) fetchTeamData();
  };

  // --- NEW: EXPENSE LOGIC ---
  const handleLogExpense = async (e) => {
    e.preventDefault();
    if (!expenseData.salesman_id) return alert("Please select a salesman.");
    setIsSaving(true);

    const rep = salesmen.find(s => s.id === expenseData.salesman_id);

    try {
      const { error } = await supabase.from("expense_claims").insert([{
        employee_id: rep.id,
        employee_name: rep.full_name,
        date: expenseData.date,
        category: expenseData.category,
        amount: expenseData.amount,
        status: "Pending" 
      }]);

      if (error) throw error;
      
      alert(`✅ ₹${expenseData.amount} claimed for ${rep.full_name}!`);
      setIsExpenseModalOpen(false);
      setExpenseData({ ...expenseData, amount: "", salesman_id: "" });
    } catch (err) {
      alert("Error logging expense: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- PAYROLL ENGINE ---
  const teamPerformance = useMemo(() => {
    return salesmen.map(rep => {
      // Logic adjusted to use 'full_name' for order matching
      const repOrders = orders.filter(o => o.sales_rep === rep.full_name);
      const totalSold = repOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
      
      const target = Number(rep.monthly_target || 100000);
      const progressPercent = target > 0 ? Math.min((totalSold / target) * 100, 100) : 0;
      
      const baseSalary = Number(rep.base_salary || 0);
      const commissionEarned = totalSold * (Number(rep.commission_rate) / 100);
      const totalPayout = baseSalary + commissionEarned;

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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-white">FIELD FORCE</h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-1">CONQRETE Team & Performance</p>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          <div className="bg-[#0a0a0a] border border-gray-800 px-6 py-3 rounded-2xl">
            <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Network Revenue</p>
            <p className="text-2xl font-mono text-cyan-400 font-black">₹{totalTeamRevenue.toLocaleString()}</p>
          </div>
          <div className="bg-[#0a0a0a] border border-gray-800 px-6 py-3 rounded-2xl">
            <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Total Payroll Due</p>
            <p className="text-2xl font-mono text-emerald-400 font-black">₹{Math.round(totalPayrollLiability).toLocaleString()}</p>
          </div>
          
          {/* NEW EXPENSE BUTTON */}
          <button onClick={() => setIsExpenseModalOpen(true)} className="bg-transparent border border-orange-500 text-orange-400 px-8 py-3 rounded-full font-black uppercase text-xs tracking-widest hover:bg-orange-500 hover:text-black transition-all shadow-xl shadow-orange-500/10 active:scale-95">
            + Log Expense
          </button>
        </div>
      </div>

      {topPerformer && topPerformer.totalSold > 0 && (
        <div className="mb-10 bg-gradient-to-r from-[#0a1a15] to-black border border-emerald-900/50 p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between shadow-2xl">
          <div className="flex items-center gap-6 mb-4 md:mb-0">
            <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center text-black text-2xl font-black italic shadow-lg shadow-emerald-500/20">#1</div>
            <div>
              <p className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.3em] mb-1">Top Closer</p>
              <h2 className="text-3xl font-black text-white uppercase tracking-tight">{topPerformer.full_name}</h2>
              <p className="text-xs text-emerald-400/70 uppercase tracking-widest font-bold">{topPerformer.work_location}</p>
            </div>
          </div>
          <div className="text-left md:text-right">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Revenue Generated</p>
            <p className="text-4xl font-mono font-black text-emerald-400">₹{topPerformer.totalSold.toLocaleString()}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20 text-cyan-400 font-mono text-xs tracking-widest uppercase animate-pulse">Syncing Payroll Data...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {teamPerformance.map((rep) => (
            <div key={rep.id} className="bg-[#0a0a0a] border border-gray-800 rounded-3xl p-6 shadow-2xl hover:border-cyan-900/50 transition-all relative">
              
              <div className="absolute top-6 right-6 flex gap-3">
                <button onClick={() => openEditModal(rep)} className="text-gray-500 hover:text-cyan-400 transition-colors text-sm">✏️</button>
                <button onClick={() => handleDelete(rep.id, rep.full_name)} className="text-gray-500 hover:text-red-500 transition-colors text-sm">🗑️</button>
              </div>

              <div className="mb-6">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight pr-12">{rep.full_name}</h3>
                <p className="text-[10px] text-cyan-400 font-mono mt-1">{rep.work_email}</p>
                <div className="flex gap-2 mt-3">
                  <span className="text-[9px] bg-[#111] text-gray-400 px-3 py-1.5 rounded-full border border-gray-800 uppercase tracking-widest font-bold">{rep.work_location || 'Field'}</span>
                  <span className="text-[9px] bg-cyan-900/20 text-cyan-400 px-3 py-1.5 rounded-full border border-cyan-900/50 uppercase tracking-widest font-bold">{rep.commission_rate}% Comm</span>
                </div>
              </div>

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
                  <span>Goal: ₹{Number(rep.monthly_target || 100000).toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-[#111] rounded-2xl p-5 border border-gray-800">
                <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-4 border-b border-gray-800 pb-2">Estimated Payout</p>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-bold">Fixed Base Salary:</span>
                    <span className="font-mono text-white">₹{Number(rep.base_salary).toLocaleString()}</span>
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

      {/* NEW: LOG TEAM EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-50 backdrop-blur-xl">
          <div className="bg-[#0a0a0a] border border-gray-800 p-8 rounded-3xl w-full max-w-md shadow-2xl relative">
            <button onClick={() => setIsExpenseModalOpen(false)} className="absolute top-6 right-6 text-gray-600 hover:text-white text-2xl leading-none">×</button>
            <h2 className="text-xl font-black text-orange-400 mb-8 uppercase tracking-tighter italic border-b border-gray-800 pb-4">Log Team Expense</h2>
            
            <form onSubmit={handleLogExpense} className="space-y-6">
              <div>
                <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Select Salesman</label>
                <select required value={expenseData.salesman_id} onChange={e => setExpenseData({...expenseData, salesman_id: e.target.value})} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-white text-sm outline-none focus:border-orange-400">
                  <option value="">Select personnel...</option>
                  {salesmen.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Category</label>
                  <select value={expenseData.category} onChange={e => setExpenseData({...expenseData, category: e.target.value})} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-white text-sm outline-none">
                    <option value="Petrol">Petrol</option>
                    <option value="Hotel">Hotel</option>
                    <option value="Meals">Food</option>
                    <option value="Travel">Travel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Amount (₹)</label>
                  <input required type="number" value={expenseData.amount} onChange={e => setExpenseData({...expenseData, amount: e.target.value})} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-orange-400 font-mono text-base font-black outline-none focus:border-orange-400" placeholder="0.00" />
                </div>
              </div>

              <button type="submit" disabled={isSaving} className="w-full bg-orange-500 text-black py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-orange-400 active:scale-95 transition-all shadow-[0_0_20px_rgba(249,115,22,0.2)]">
                {isSaving ? "Saving..." : "Log Expense Claim"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-50 backdrop-blur-xl">
          <div className="bg-[#0a0a0a] border border-gray-800 p-8 rounded-3xl w-full max-w-lg shadow-2xl relative overflow-y-auto max-h-[95vh]">
            <button onClick={() => setIsEditModalOpen(false)} className="absolute top-6 right-6 text-gray-600 hover:text-white text-2xl leading-none">×</button>
            <h2 className="text-xl font-black text-cyan-400 mb-8 uppercase tracking-tighter italic border-b border-gray-800 pb-4">Update Profile</h2>
            <form onSubmit={handleUpdateSalesman} className="space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Full Name</label>
                  <input required type="text" value={editData.full_name} onChange={e => setEditData({...editData, full_name: e.target.value})} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-white text-sm outline-none focus:border-cyan-400" />
                </div>
                <div><label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Phone</label><input type="text" value={editData.phone_number} onChange={e => setEditData({...editData, phone_number: e.target.value})} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-white text-sm font-mono outline-none focus:border-cyan-400" /></div>
                <div><label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Territory</label><input required type="text" value={editData.work_location} onChange={e => setEditData({...editData, work_location: e.target.value})} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-white text-sm outline-none focus:border-cyan-400" /></div>
                <div><label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Monthly Target (₹)</label><input required type="number" value={editData.monthly_target} onChange={e => setEditData({...editData, monthly_target: e.target.value})} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-cyan-400 font-mono text-sm outline-none" /></div>
                <div><label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Fixed Salary (₹)</label><input required type="number" value={editData.base_salary} onChange={e => setEditData({...editData, base_salary: e.target.value})} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-white font-mono text-sm outline-none" /></div>
                <div><label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Comm (%)</label><input required type="number" step="0.1" value={editData.commission_rate} onChange={e => setEditData({...editData, commission_rate: e.target.value})} className="w-full bg-black border border-gray-800 rounded-xl p-4 text-emerald-400 font-mono text-sm outline-none" /></div>
              </div>
              <button type="submit" disabled={isSaving} className="w-full bg-cyan-400 text-black py-4 rounded-xl font-black text-xs uppercase active:scale-95 transition-all shadow-xl shadow-cyan-400/20">
                {isSaving ? "Saving Updates..." : "Save Profile Changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}