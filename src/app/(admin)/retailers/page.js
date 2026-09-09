"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link"; // Added for navigation

export default function RetailersPage() {
  const [retailers, setRetailers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    store_name: "", contact_person: "", phone: "", email: "", location: "", payment_cycle_days: 30 
  });

  useEffect(() => {
    fetchRetailers();
  }, []);

  const fetchRetailers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from("retailers").select("*").order("store_name", { ascending: true });
    if (!error) setRetailers(data || []);
    setIsLoading(false);
  };

  const handleSave = async (e) => {
  e.preventDefault();
  try {
    const { error } = await supabase.from("retailers").insert([formData]);
    if (error) throw error;
    
    // ✅ NEW: Add success message
    alert(`✅ Retailer "${formData.store_name}" added successfully!`);
    fetchRetailers();
    setIsModalOpen(false);
    setFormData({ store_name: "", contact_person: "", phone: "", email: "", location: "", payment_cycle_days: 30 });
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

  // --- NEW: CONTACT HANDLER ---
  const handleContact = (retailer) => {
    if (retailer.phone) {
      window.location.href = `tel:${retailer.phone}`;
    } else if (retailer.email) {
      window.location.href = `mailto:${retailer.email}`;
    } else {
      alert(`No contact info for ${retailer.store_name}`);
    }
  };

  return (
    <div className="pb-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Retailer Network</h1>
          <p className="text-sm text-[#6B7280] mt-1">Manage B2B relationships and credit cycles</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-[#0EA5E9] text-white px-4 py-2 rounded-md font-semibold hover:bg-[#0284C7] transition-colors text-sm shadow-sm">
          + Add Retailer
        </button>
      </div>

      {/* RETAILER GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {retailers.map(r => (
          <div key={r.id} className="bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[#111827]">{r.store_name}</h3>
                <p className="text-sm text-[#6B7280]">{r.location || "Location Not Set"}</p>
              </div>
              <span className="bg-[#F3F4F6] text-[#374151] text-xs px-2.5 py-1 rounded-full font-medium border border-[#E5E7EB]">Net-{r.payment_cycle_days}</span>
            </div>

            {/* FINANCIAL MINI-DASHBOARD */}
            <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-[#E5E7EB]">
              <div>
                <p className="text-xs text-[#6B7280] font-medium mb-1">Lifetime Sales</p>
                <p className="text-sm font-semibold text-[#111827]">₹{Number(r.total_lifetime_sales).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] font-medium mb-1">Pending Due</p>
                <p className="text-sm font-semibold text-[#991B1B]">₹{Number(r.total_pending).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex gap-3">
              {/* FIXED CONTACT BUTTON */}
              <button 
                onClick={() => handleContact(r)}
                className="flex-1 bg-white border border-[#D1D5DB] text-sm py-2 rounded-md hover:bg-[#F9FAFB] text-[#374151] font-medium transition-colors"
              >
                Call / Email
              </button>

              {/* UPDATED LEDGER BUTTON (Linking to a detail page we'll create) */}
              <Link 
                href={`/retailers/${r.id}`} 
                className="flex-1 bg-white border border-[#D1D5DB] text-sm py-2 rounded-md hover:bg-[#F9FAFB] text-[#0EA5E9] font-medium text-center transition-colors"
              >
                Ledger
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* ADD RETAILER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white border border-[#E5E7EB] rounded-lg w-full max-w-md p-6 shadow-xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold text-[#111827] mb-6 border-b border-[#E5E7EB] pb-3">Register New Retailer</h2>
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Store Name</label>
                <input required type="text" value={formData.store_name} onChange={e => setFormData({...formData, store_name: e.target.value})} className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">Contact Person</label>
                  <input type="text" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">Phone Number</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none transition-all" placeholder="9922..." />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Email Address</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">Location / City</label>
                  <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">Credit Cycle (Days)</label>
                  <input type="number" value={formData.payment_cycle_days} onChange={e => setFormData({...formData, payment_cycle_days: e.target.value})} className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none transition-all" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-5 border-t border-[#E5E7EB]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors">Cancel</button>
                <button type="submit" className="bg-[#0EA5E9] text-white px-6 py-2 rounded-md font-semibold text-sm hover:bg-[#0284C7] transition-colors shadow-sm">Save Retailer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}