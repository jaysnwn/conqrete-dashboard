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
    <div className="p-8 min-h-screen bg-[#F8F9FA] pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Field Force</h1>
          <p className="text-sm text-[#6B7280] mt-1">Team & Performance</p>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm px-4 py-3">
            <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider mb-1">Network Revenue</p>
            <p className="text-xl font-bold text-[#111827]">₹{totalTeamRevenue.toLocaleString()}</p>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm px-4 py-3">
            <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider mb-1">Total Payroll Due</p>
            <p className="text-xl font-bold text-[#111827]">₹{Math.round(totalPayrollLiability).toLocaleString()}</p>
          </div>
          
          {/* NEW EXPENSE BUTTON */}
          <button onClick={() => setIsExpenseModalOpen(true)} className="bg-white border border-[#0EA5E9] text-[#0EA5E9] px-4 py-2 rounded-md font-semibold text-sm hover:bg-[#0EA5E9] hover:text-white transition-colors">
            + Log Expense
          </button>
        </div>
      </div>

      {topPerformer && topPerformer.totalSold > 0 && (
        <div className="mb-8 bg-white border border-[#E5E7EB] rounded-lg shadow-sm p-6 flex flex-col md:flex-row items-start md:items-center justify-between">
          <div className="flex items-center gap-4 mb-4 md:mb-0">
            <div className="w-12 h-12 rounded-full bg-[#D1FAE5] border border-[#A7F3D0] flex items-center justify-center text-[#065F46] font-bold text-xl">
              #1
            </div>
            <div>
              <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider mb-1">Top Closer</p>
              <h2 className="text-xl font-bold text-[#111827]">{topPerformer.full_name}</h2>
              <p className="text-sm text-[#6B7280]">{topPerformer.work_location}</p>
            </div>
          </div>
          <div className="text-left md:text-right">
            <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider mb-1">Revenue Generated</p>
            <p className="text-2xl font-bold text-[#065F46]">₹{topPerformer.totalSold.toLocaleString()}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20 text-[#6B7280] text-sm animate-pulse">Syncing Payroll Data...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {teamPerformance.map((rep) => (
            <div key={rep.id} className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm p-6 relative">
              
              <div className="absolute top-4 right-4 flex gap-2">
                <button onClick={() => openEditModal(rep)} className="text-[#6B7280] hover:text-[#0EA5E9] transition-colors text-sm">
                  ✏️
                </button>
                <button onClick={() => handleDelete(rep.id, rep.full_name)} className="text-[#6B7280] hover:text-red-500 transition-colors text-sm">
                  🗑️
                </button>
              </div>

              <div className="mb-4">
                <h3 className="text-lg font-bold text-[#111827] pr-12">{rep.full_name}</h3>
                <p className="text-sm text-[#6B7280] mt-1">{rep.work_email}</p>
                <div className="flex gap-2 mt-3">
                  <span className="text-xs bg-[#F3F4F6] text-[#4B5563] px-2.5 py-1 rounded-md border border-[#E5E7EB] font-medium">
                    {rep.work_location || 'Field'}
                  </span>
                  <span className="text-xs bg-[#E0F2FE] text-[#0284C7] px-2.5 py-1 rounded-md border border-[#BAE6FD] font-medium">
                    {rep.commission_rate}% Comm
                  </span>
                </div>
              </div>

              <div className="mb-6 bg-[#F9FAFB] p-4 rounded-md border border-[#E5E7EB]">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs text-[#6B7280] font-semibold">Target Progress</span>
                  <span className={`text-sm font-bold ${rep.progressPercent >= 100 ? 'text-[#065F46]' : 'text-[#111827]'}`}>
                    {Math.round(rep.progressPercent)}%
                  </span>
                </div>
                <div className="w-full bg-[#E5E7EB] rounded-full h-2 mb-2 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${rep.progressPercent >= 100 ? 'bg-[#10B981]' : 'bg-[#0EA5E9]'}`} style={{ width: `${rep.progressPercent}%` }}></div>
                </div>
                <div className="flex justify-between text-xs text-[#6B7280]">
                  <span className="text-[#111827] font-semibold">₹{rep.totalSold.toLocaleString()}</span>
                  <span>Goal: ₹{Number(rep.monthly_target || 100000).toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-[#F8F9FA] rounded-md p-4 border border-[#E5E7EB]">
                <p className="text-xs text-[#6B7280] font-semibold mb-3 border-b border-[#E5E7EB] pb-2">Estimated Payout</p>
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">Fixed Base Salary:</span>
                    <span className="text-[#111827] font-medium">₹{Number(rep.base_salary).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">Commission Earned:</span>
                    <span className="text-[#065F46] font-medium">+ ₹{Math.round(rep.commissionEarned).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex justify-between items-end border-t border-[#E5E7EB] pt-3">
                  <span className="text-xs text-[#111827] font-bold">Total Cheque</span>
                  <span className="text-lg text-[#065F46] font-bold">₹{Math.round(rep.totalPayout).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NEW: LOG TEAM EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E5E7EB] p-6 rounded-lg w-full max-w-md shadow-lg relative">
            <button onClick={() => setIsExpenseModalOpen(false)} className="absolute top-4 right-4 text-[#6B7280] hover:text-[#111827] text-xl leading-none">×</button>
            <h2 className="text-lg font-bold text-[#111827] mb-6 border-b border-[#E5E7EB] pb-3">Log Team Expense</h2>
            
            <form onSubmit={handleLogExpense} className="space-y-4">
              <div>
                <label className="block text-sm text-[#6B7280] mb-1 font-medium">Select Salesman</label>
                <select required value={expenseData.salesman_id} onChange={e => setExpenseData({...expenseData, salesman_id: e.target.value})} className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none">
                  <option value="">Select personnel...</option>
                  {salesmen.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#6B7280] mb-1 font-medium">Category</label>
                  <select value={expenseData.category} onChange={e => setExpenseData({...expenseData, category: e.target.value})} className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none">
                    <option value="Petrol">Petrol</option>
                    <option value="Hotel">Hotel</option>
                    <option value="Meals">Food</option>
                    <option value="Travel">Travel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#6B7280] mb-1 font-medium">Amount (₹)</label>
                  <input required type="number" value={expenseData.amount} onChange={e => setExpenseData({...expenseData, amount: e.target.value})} className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none" placeholder="0.00" />
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={isSaving} className="w-full bg-[#0EA5E9] text-white py-2 px-4 rounded-md font-semibold text-sm hover:bg-[#0284C7] transition-colors">
                  {isSaving ? "Saving..." : "Log Expense Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E5E7EB] p-6 rounded-lg w-full max-w-lg shadow-lg relative overflow-y-auto max-h-[95vh]">
            <button onClick={() => setIsEditModalOpen(false)} className="absolute top-4 right-4 text-[#6B7280] hover:text-[#111827] text-xl leading-none">×</button>
            <h2 className="text-lg font-bold text-[#111827] mb-6 border-b border-[#E5E7EB] pb-3">Update Profile</h2>
            <form onSubmit={handleUpdateSalesman} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm text-[#6B7280] mb-1 font-medium">Full Name</label>
                  <input required type="text" value={editData.full_name} onChange={e => setEditData({...editData, full_name: e.target.value})} className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-[#6B7280] mb-1 font-medium">Phone</label>
                  <input type="text" value={editData.phone_number} onChange={e => setEditData({...editData, phone_number: e.target.value})} className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-[#6B7280] mb-1 font-medium">Territory</label>
                  <input required type="text" value={editData.work_location} onChange={e => setEditData({...editData, work_location: e.target.value})} className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-[#6B7280] mb-1 font-medium">Monthly Target (₹)</label>
                  <input required type="number" value={editData.monthly_target} onChange={e => setEditData({...editData, monthly_target: e.target.value})} className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-[#6B7280] mb-1 font-medium">Fixed Salary (₹)</label>
                  <input required type="number" value={editData.base_salary} onChange={e => setEditData({...editData, base_salary: e.target.value})} className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-[#6B7280] mb-1 font-medium">Comm (%)</label>
                  <input required type="number" step="0.1" value={editData.commission_rate} onChange={e => setEditData({...editData, commission_rate: e.target.value})} className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none" />
                </div>
              </div>
              <div className="pt-2">
                <button type="submit" disabled={isSaving} className="w-full bg-[#0EA5E9] text-white py-2 px-4 rounded-md font-semibold text-sm hover:bg-[#0284C7] transition-colors">
                  {isSaving ? "Saving Updates..." : "Save Profile Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
