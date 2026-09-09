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
    <div className="p-6 md:p-8 pt-28 md:pt-8 pb-32 md:pb-20 min-h-screen bg-[#F8F9FA] text-[#111827] font-sans">
      
      {/* HEADER */}
      <div className="mb-8 border-b border-[#E5E7EB] pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[#111827]">
            Operating Expenses
          </h1>
          <p className="text-[#6B7280] text-sm mt-1">
            Corporate Liability & Outflow Ledger
          </p>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-white border border-[#E5E7EB] px-6 py-4 rounded-lg shadow-sm text-right">
            <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider mb-1">This Month Burn</p>
            <p className="text-2xl font-bold text-[#111827]">₹{thisMonthBurn.toLocaleString()}</p>
          </div>
          <div className="bg-white border border-[#E5E7EB] px-6 py-4 rounded-lg shadow-sm text-right hidden sm:block">
            <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider mb-1">All-Time Outflow</p>
            <p className="text-2xl font-bold text-[#111827]">₹{totalBurn.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: THE INPUT TERMINAL */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#111827] mb-6">Log New Liability</h2>
            
            <form onSubmit={handleLogExpense} className="space-y-5">
              
              {/* AMOUNT */}
              <div>
                <label className="block text-sm font-medium text-[#6B7280] mb-1">Transaction Amount (₹)</label>
                <input 
                  required 
                  type="number" 
                  step="0.01"
                  value={formData.amount} 
                  onChange={e => setFormData({...formData, amount: e.target.value})} 
                  className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none transition-shadow"
                  placeholder="0.00" 
                />
              </div>

              {/* CATEGORY DROPDOWN */}
              <div>
                <label className="block text-sm font-medium text-[#6B7280] mb-1">Expense Category</label>
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value)} 
                  className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none transition-shadow"
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
                  <label className="block text-sm font-medium text-[#6B7280] mb-1">Specify Category</label>
                  <input 
                    required 
                    type="text" 
                    value={customCategory} 
                    onChange={e => setCustomCategory(e.target.value)} 
                    className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none transition-shadow"
                    placeholder="e.g. Office Snacks, Packaging..." 
                  />
                </div>
              )}

              {/* DATE */}
              <div>
                <label className="block text-sm font-medium text-[#6B7280] mb-1">Billing Date</label>
                <input 
                  required 
                  type="date" 
                  value={formData.billing_date} 
                  onChange={e => setFormData({...formData, billing_date: e.target.value})} 
                  className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none transition-shadow"
                />
              </div>

              {/* NOTES */}
              <div>
                <label className="block text-sm font-medium text-[#6B7280] mb-1">Notes / Reference (Optional)</label>
                <input 
                  type="text" 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                  className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none transition-shadow"
                  placeholder="Invoice # or Details" 
                />
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full mt-4 bg-[#0EA5E9] text-white py-2.5 rounded-md font-semibold text-sm hover:bg-[#0284C7] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isSubmitting ? "Processing..." : "Commit to Ledger"}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: THE LEDGER */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
            <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#F9FAFB] flex justify-between items-center">
              <h3 className="text-sm font-semibold text-[#111827]">Transaction History</h3>
              <span className="text-xs text-[#065F46] bg-[#D1FAE5] border border-[#A7F3D0] px-2.5 py-0.5 rounded-full font-medium">
                {expenses.length} Entries
              </span>
            </div>
            
            {isLoading ? (
              <div className="flex-1 flex justify-center items-center h-64 text-[#6B7280] text-sm animate-pulse">
                Loading ledger...
              </div>
            ) : expenses.length === 0 ? (
              <div className="flex-1 flex justify-center items-center h-64 text-[#6B7280] text-sm">
                No liabilities recorded.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F9FAFB] text-[#6B7280] text-xs font-semibold uppercase tracking-wider border-b border-[#E5E7EB]">
                      <th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                      <th className="px-6 py-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {expenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-[#F9FAFB] transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-medium text-[#111827]">{exp.category}</div>
                          {exp.notes && <div className="text-xs text-[#6B7280] mt-0.5">{exp.notes}</div>}
                        </td>
                        <td className="px-6 py-4 text-sm text-[#6B7280]">
                          {new Date(exp.billing_date).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-[#111827] text-right">
                          ₹{Number(exp.amount).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleDelete(exp.id, exp.category)} 
                            className="text-[#6B7280] hover:text-[#991B1B] opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete Record"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}