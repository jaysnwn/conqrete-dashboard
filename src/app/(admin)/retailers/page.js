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
    <div className="text-gray-200 pb-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wider uppercase">Retailer Network</h1>
          <p className="text-sm text-gray-500 mt-1">Manage B2B relationships and credit cycles</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-cyan-400 text-black px-6 py-2 rounded font-bold hover:bg-cyan-300 transition-colors uppercase text-sm">
          + Add Retailer
        </button>
      </div>

      {/* RETAILER GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {retailers.map(r => (
          <div key={r.id} className="bg-[#111] border border-gray-800 rounded-lg p-6 hover:border-cyan-500/50 transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">{r.store_name}</h3>
                <p className="text-xs text-gray-500">{r.location || "Location Not Set"}</p>
              </div>
              <span className="bg-gray-800 text-[10px] px-2 py-1 rounded font-mono text-gray-400">Net-{r.payment_cycle_days}</span>
            </div>

            {/* FINANCIAL MINI-DASHBOARD */}
            <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-gray-800/50">
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Lifetime Sales</p>
                <p className="text-sm font-mono text-white">₹{Number(r.total_lifetime_sales).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-red-500 uppercase font-bold mb-1">Pending Due</p>
                <p className="text-sm font-mono text-red-400">₹{Number(r.total_pending).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex gap-2">
              {/* FIXED CONTACT BUTTON */}
              <button 
                onClick={() => handleContact(r)}
                className="flex-1 bg-[#0a0a0a] border border-gray-800 text-xs py-2 rounded hover:bg-gray-800 text-gray-400"
              >
                Call / Email
              </button>

              {/* UPDATED LEDGER BUTTON (Linking to a detail page we'll create) */}
              <Link 
                href={`/retailers/${r.id}`} 
                className="flex-1 bg-[#0a0a0a] border border-gray-800 text-xs py-2 rounded hover:bg-cyan-900/20 hover:text-cyan-400 hover:border-cyan-900/50 text-center"
              >
                Ledger
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* ADD RETAILER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-800 rounded-lg w-full max-w-md p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-lg font-bold text-white mb-6 uppercase tracking-widest border-b border-gray-800 pb-2">Register New Retailer</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Store Name</label>
                <input required type="text" value={formData.store_name} onChange={e => setFormData({...formData, store_name: e.target.value})} className="w-full bg-[#0a0a0a] border border-gray-700 rounded p-2 text-white text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Contact Person</label>
                  <input type="text" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} className="w-full bg-[#0a0a0a] border border-gray-700 rounded p-2 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Phone Number</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-[#0a0a0a] border border-gray-700 rounded p-2 text-white text-sm font-mono" placeholder="9922..." />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Email Address</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-[#0a0a0a] border border-gray-700 rounded p-2 text-white text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Location / City</label>
                  <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full bg-[#0a0a0a] border border-gray-700 rounded p-2 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Credit Cycle (Days)</label>
                  <input type="number" value={formData.payment_cycle_days} onChange={e => setFormData({...formData, payment_cycle_days: e.target.value})} className="w-full bg-[#0a0a0a] border border-gray-700 rounded p-2 text-white text-sm font-mono" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 text-sm">Cancel</button>
                <button type="submit" className="bg-cyan-400 text-black px-6 py-2 rounded font-bold text-sm uppercase">Save Retailer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}