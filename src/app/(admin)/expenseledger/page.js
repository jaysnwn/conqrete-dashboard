"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function ExpenseLedgerPage() {
  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [category, setCategory] = useState("Rent");
  const [customCategory, setCustomCategory] = useState("");
  const [formData, setFormData] = useState({
    amount: "",
    billing_date: new Date().toISOString().split("T")[0], // Defaults to today
    notes: ""
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("billing_date", { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error("Error fetching ledger:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogExpense = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Determine final category string
    const finalCategory = category === "Other" ? customCategory : category;

    if (!finalCategory.trim()) {
      alert("Please specify the custom category.");
      setIsSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase.from("expenses").insert([{
        category: finalCategory,
        amount: Number(formData.amount),
        billing_date: formData.billing_date,
        notes: formData.notes || null
      }]);

      if (error) throw error;

      // Reset form on success
      setFormData({ ...formData, amount: "", notes: "" });
      setCategory("Rent");
      setCustomCategory("");
      
      // Refresh the ledger
      fetchExpenses();
    } catch (error) {
      alert("Failed to log expense: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, cat) => {
    if (!window.confirm(`WARNING: Erase ${cat} record from the ledger?`)) return;
    await supabase.from("expenses").delete().eq("id", id);
    fetchExpenses();
  };

  // Quick Math for Top Cards
  const totalBurn = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const currentMonth = new Date().getMonth();
  const thisMonthBurn = expenses
    .filter(exp => new Date(exp.billing_date).getMonth() === currentMonth)
    .reduce((sum, exp) => sum + Number(exp.amount), 0);

  return (
    <div className="p-6 md:p-8 pt-28 md:pt-8 pb-32 md:pb-20 text-white min-h-screen bg-[#030303] selection:bg-cyan-500 selection:text-black font-sans">
      
      {/* HEADER */}
      <div className="mb-12 border-b border-gray-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            OPERATING <span className="text-orange-500">EXPENSES</span>
          </h1>
          <p className="text-gray-500 font-mono text-[10px] tracking-[0.4em] uppercase mt-2">
            Corporate Liability & Outflow Ledger
          </p>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-[#111] border border-gray-800 px-6 py-4 rounded-2xl text-right">
            <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">This Month Burn</p>
            <p className="text-2xl font-mono text-orange-500 font-black">₹{thisMonthBurn.toLocaleString()}</p>
          </div>
          <div className="bg-[#0a0a0a] border border-gray-800 px-6 py-4 rounded-2xl text-right hidden sm:block">
            <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">All-Time Outflow</p>
            <p className="text-2xl font-mono text-white font-black">₹{totalBurn.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: THE INPUT TERMINAL */}
        <div className="lg:col-span-1">
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            {/* Decorative Cyber Line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 to-orange-400"></div>
            
            <h2 className="text-sm font-black italic text-orange-400 uppercase tracking-widest mb-8">Log New Liability</h2>
            
            <form onSubmit={handleLogExpense} className="space-y-6">
              
              {/* AMOUNT */}
              <div>
                <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Transaction Amount (₹)</label>
                <input 
                  required 
                  type="number" 
                  step="0.01"
                  value={formData.amount} 
                  onChange={e => setFormData({...formData, amount: e.target.value})} 
                  className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-orange-400 font-mono text-xl font-black outline-none focus:border-orange-500 transition-colors" 
                  placeholder="0.00" 
                />
              </div>

              {/* CATEGORY DROPDOWN */}
              <div>
                <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Expense Category</label>
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value)} 
                  className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400 transition-colors"
                >
                  <option value="Rent">Facility Rent</option>
                  <option value="Electricity">Electricity & Utilities</option>
                  <option value="Fuel & Travel">Fuel & Travel</option>
                  <option value="Software & SaaS">Software & SaaS</option>
                  <option value="New Purchase">New Purchase (Assets)</option>
                  <option value="CA Charges">CA / Legal Charges</option>
                  <option value="Other">Other (Specify...)</option>
                </select>
              </div>

              {/* DYNAMIC "OTHER" FIELD */}
              {category === "Other" && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-[10px] text-cyan-500 mb-2 uppercase font-black tracking-widest">Specify Category</label>
                  <input 
                    required 
                    type="text" 
                    value={customCategory} 
                    onChange={e => setCustomCategory(e.target.value)} 
                    className="w-full bg-[#050505] border border-cyan-900/50 p-4 rounded-xl text-cyan-400 font-mono text-sm outline-none focus:border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.05)]" 
                    placeholder="e.g. Office Snacks, Packaging..." 
                  />
                </div>
              )}

              {/* DATE */}
              <div>
                <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Billing Date</label>
                <input 
                  required 
                  type="date" 
                  value={formData.billing_date} 
                  onChange={e => setFormData({...formData, billing_date: e.target.value})} 
                  className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-gray-400 font-mono text-sm outline-none focus:border-cyan-400 [&::-webkit-calendar-picker-indicator]:invert transition-colors" 
                />
              </div>

              {/* NOTES */}
              <div>
                <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Notes / Reference (Optional)</label>
                <input 
                  type="text" 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                  className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400 transition-colors" 
                  placeholder="Invoice # or Details" 
                />
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full mt-6 bg-transparent border border-orange-500 text-orange-500 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-orange-500 hover:text-black active:scale-95 transition-all shadow-[0_0_15px_rgba(249,115,22,0.1)] hover:shadow-[0_0_20px_rgba(249,115,22,0.4)] disabled:opacity-50"
              >
                {isSubmitting ? "PROCESSING..." : "COMMIT TO LEDGER"}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: THE LEDGER */}
        <div className="lg:col-span-2">
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl min-h-[600px]">
            <div className="p-6 border-b border-gray-800 bg-[#050505] flex justify-between items-center">
              <h3 className="text-base font-black italic text-white uppercase tracking-widest">Transaction History</h3>
              <span className="text-[10px] font-mono text-gray-500 bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
                {expenses.length} ENTRIES
              </span>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center items-center h-64 text-cyan-400 font-mono text-xs tracking-[0.3em] uppercase animate-pulse">
                Decrypting Ledger...
              </div>
            ) : expenses.length === 0 ? (
              <div className="flex justify-center items-center h-64 text-gray-600 font-mono text-xs tracking-widest uppercase">
                No liabilities recorded.
              </div>
            ) : (
              <div className="divide-y divide-gray-900/50 max-h-[700px] overflow-y-auto custom-scrollbar">
                {expenses.map(exp => (
                  <div key={exp.id} className="p-6 hover:bg-white/[0.02] transition-colors group flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1">
                      <p className="font-bold text-white uppercase text-sm tracking-widest">{exp.category}</p>
                      {exp.notes && <p className="text-[10px] text-gray-500 mt-1 uppercase">{exp.notes}</p>}
                    </div>
                    
                    <div className="flex-1 text-left sm:text-center">
                      <p className="text-xs text-gray-400 font-mono">{new Date(exp.billing_date).toLocaleDateString('en-GB')}</p>
                    </div>

                    <div className="flex-1 text-left sm:text-right flex items-center justify-end gap-6 w-full sm:w-auto">
                      <p className="text-lg font-mono font-black text-orange-400">₹{Number(exp.amount).toLocaleString()}</p>
                      <button 
                        onClick={() => handleDelete(exp.id, exp.category)} 
                        className="text-[10px] text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete Record"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}