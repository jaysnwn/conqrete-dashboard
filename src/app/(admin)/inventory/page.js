"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal State
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'add', amount: '', reason: 'New Shipment' });

  // --- DATABASE FETCHING ---
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    // Fetch Inventory
    const { data: prodData } = await supabase
      .from("products")
      .select("id, name, sku, category, image, stock, landed_cost")
      .order("stock", { ascending: true });

    // Fetch Recent Logs
    const { data: logData } = await supabase
      .from("inventory_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    setInventory(prodData || []);
    setLogs(logData || []);
    setIsLoading(false);
  };

  // --- CALCULATE WAREHOUSE METRICS ---
  const metrics = useMemo(() => {
    return inventory.reduce((acc, item) => {
      const stock = Number(item.stock) || 0;
      const cost = Number(item.landed_cost) || 0;
      
      acc.totalUnits += stock;
      acc.totalValue += (stock * cost);
      if (stock <= 0) acc.outOfStock += 1;
      else if (stock < 50) acc.lowStock += 1; 
      
      return acc;
    }, { totalUnits: 0, totalValue: 0, lowStock: 0, outOfStock: 0 });
  }, [inventory]);

  // --- FILTERING ---
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) =>
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [inventory, searchQuery]);

  // --- HANDLERS ---
  const handleOpenAdjust = (item) => {
    setSelectedItem(item);
    setAdjustForm({ type: 'add', amount: '', reason: 'New Shipment' });
    setIsAdjustOpen(true);
  };

  const handleUpdateStock = async (e) => {
    e.preventDefault();
    
    const amount = Number(adjustForm.amount);
    if (!amount || amount <= 0) return alert("Please enter a valid amount.");

    const currentStock = Number(selectedItem.stock) || 0;
    let newStock = currentStock;
    let changeAmount = 0;

    if (adjustForm.type === 'add') {
      newStock = currentStock + amount;
      changeAmount = amount;
    } else if (adjustForm.type === 'deduct') {
      newStock = currentStock - amount;
      changeAmount = -amount;
      if (newStock < 0) return alert("Cannot deduct more stock than available!");
    } else if (adjustForm.type === 'override') {
      newStock = amount;
      changeAmount = amount - currentStock;
    }

    // 1. Update Product Table
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', selectedItem.id);

    if (updateError) return alert(`Error updating stock: ${updateError.message}`);

    // 2. Insert into Audit Ledger
    await supabase.from('inventory_logs').insert([{
      product_id: selectedItem.id,
      product_name: selectedItem.name,
      change_amount: changeAmount,
      new_stock: newStock,
      reason: adjustForm.reason,
      user_name: "Admin" // Hardcoded for now until we add logins
    }]);

    // Refresh Data
    fetchData();
    setIsAdjustOpen(false);
  };

  return (
    <div className="text-[#111827] pb-10">
      {/* HEADER */}
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Inventory</h1>
          <p className="text-sm text-[#6B7280] mt-1">Live Asset Valuation & Stock Workflows</p>
        </div>
      </div>

      {/* METRICS DASHBOARD */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white border border-[#E5E7EB] p-6 rounded-lg shadow-sm">
          <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider mb-1">Total Asset Value</p>
          <p className="text-3xl font-bold text-[#111827]">₹{metrics.totalValue.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white border border-[#E5E7EB] p-6 rounded-lg shadow-sm">
          <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider mb-1">Units on Hand</p>
          <p className="text-3xl font-bold text-[#111827]">{metrics.totalUnits.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-[#E5E7EB] p-6 rounded-lg shadow-sm">
          <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider mb-1">Low Stock Alerts</p>
          <p className="text-3xl font-bold text-[#92400E]">{metrics.lowStock}</p>
        </div>
        <div className="bg-white border border-[#E5E7EB] p-6 rounded-lg shadow-sm">
          <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider mb-1">Out of Stock</p>
          <p className="text-3xl font-bold text-[#991B1B]">{metrics.outOfStock}</p>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="flex justify-between items-center mb-6">
        <input 
          type="text" 
          placeholder="Scan or Search SKU..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none text-sm"
        />
      </div>

      {/* INVENTORY TABLE */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden relative mb-12 shadow-sm">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <span className="text-[#0EA5E9] font-semibold animate-pulse">Loading Inventory...</span>
          </div>
        )}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F9FAFB] text-[#6B7280] text-xs font-semibold uppercase tracking-wider">
              <th className="p-4">Product</th>
              <th className="p-4">SKU</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Physical Stock</th>
              <th className="p-4 text-right" title="Placeholder for future allocated orders">Allocated</th>
              <th className="p-4 text-right">Available to Sell</th>
              <th className="p-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map(item => {
              const stock = Number(item.stock) || 0;
              const allocated = 0; // Placeholder until we build the Orders module
              const available = stock - allocated;
              
              let statusBadge = <span className="bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] px-2 py-1 rounded text-xs font-semibold">Optimal</span>;
              if (stock <= 0) statusBadge = <span className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] px-2 py-1 rounded text-xs font-semibold">Depleted</span>;
              else if (stock < 50) statusBadge = <span className="bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] px-2 py-1 rounded text-xs font-semibold">Low Stock</span>;

              return (
                <tr key={item.id} className="hover:bg-[#F9FAFB] border-t border-[#E5E7EB] transition-colors">
                  <td className="p-4 flex items-center gap-3">
                    <div className="text-xl bg-[#F9FAFB] p-2 rounded border border-[#E5E7EB]">{item.image}</div>
                    <div>
                      <div className="text-[#111827] font-medium text-sm">{item.name}</div>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-[#6B7280]">{item.sku}</td>
                  <td className="p-4">{statusBadge}</td>
                  <td className="p-4 text-sm text-[#111827] text-right">{stock}</td>
                  <td className="p-4 text-sm text-[#6B7280] text-right">{allocated}</td>
                  <td className="p-4 text-sm text-[#065F46] font-semibold text-right">{available}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleOpenAdjust(item)} className="text-[#0EA5E9] hover:text-[#0284C7] font-medium text-sm transition-colors">
                      Adjust
                    </button>
                  </td>
                </tr>
              );
            })}
            {!isLoading && filteredInventory.length === 0 && (
              <tr><td colSpan="7" className="p-8 text-center text-[#6B7280]">No inventory found. Add products first.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* AUDIT LEDGER (Recent Movements) */}
      <div>
        <h2 className="text-lg font-bold text-[#111827] mb-4">Recent Stock Movements</h2>
        <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden shadow-sm">
           <table className="w-full text-left border-collapse text-sm">
             <thead>
               <tr className="bg-[#F9FAFB] text-[#6B7280] text-xs font-semibold uppercase tracking-wider">
                 <th className="p-4">Date/Time</th>
                 <th className="p-4">Product</th>
                 <th className="p-4 text-right">Change</th>
                 <th className="p-4 text-right">New Stock</th>
                 <th className="p-4">Reason</th>
                 <th className="p-4">User</th>
               </tr>
             </thead>
             <tbody>
               {logs.map(log => (
                 <tr key={log.id} className="hover:bg-[#F9FAFB] border-t border-[#E5E7EB]">
                   <td className="p-4 text-[#6B7280] text-sm">
                     {new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                   </td>
                   <td className="p-4 text-[#111827] font-medium">{log.product_name}</td>
                   <td className={`p-4 text-right font-semibold ${log.change_amount > 0 ? 'text-[#065F46]' : 'text-[#991B1B]'}`}>
                     {log.change_amount > 0 ? `+${log.change_amount}` : log.change_amount}
                   </td>
                   <td className="p-4 text-right text-[#6B7280]">{log.new_stock}</td>
                   <td className="p-4 text-[#111827] text-sm">{log.reason}</td>
                   <td className="p-4 text-[#6B7280] text-sm">{log.user_name}</td>
                 </tr>
               ))}
               {logs.length === 0 && (
                 <tr><td colSpan="6" className="p-4 text-center text-[#6B7280] text-sm">No movements recorded yet.</td></tr>
               )}
             </tbody>
           </table>
        </div>
      </div>

      {/* ADJUST STOCK MODAL */}
      {isAdjustOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white border border-[#E5E7EB] rounded-lg w-full max-w-md p-6 shadow-xl">
            <h2 className="text-xl font-bold text-[#111827] mb-2">Adjust Inventory</h2>
            <div className="flex gap-4 items-center mb-6 pb-4 border-b border-[#E5E7EB]">
               <span className="text-3xl bg-[#F9FAFB] border border-[#E5E7EB] p-2 rounded">{selectedItem.image}</span>
               <div>
                 <div className="text-[#111827] font-medium">{selectedItem.name}</div>
                 <div className="flex gap-3 text-sm mt-1">
                    <span className="text-[#6B7280]">{selectedItem.sku}</span>
                    <span className="text-[#6B7280]">Current Stock: <span className="text-[#111827] font-semibold">{selectedItem.stock}</span></span>
                 </div>
               </div>
            </div>
            
            <form onSubmit={handleUpdateStock} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                {/* Action Type */}
                <div>
                  <label className="block text-xs text-[#6B7280] font-semibold mb-1 uppercase tracking-wider">Action</label>
                  <select 
                    value={adjustForm.type}
                    onChange={(e) => setAdjustForm({...adjustForm, type: e.target.value})}
                    className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none text-sm"
                  >
                    <option value="add">Add Stock (+)</option>
                    <option value="deduct">Deduct Stock (-)</option>
                    <option value="override">Override Total (=)</option>
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs text-[#6B7280] font-semibold mb-1 uppercase tracking-wider">Amount</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    placeholder="e.g. 50"
                    value={adjustForm.amount} 
                    onChange={(e) => setAdjustForm({...adjustForm, amount: e.target.value})}
                    className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none text-sm"
                  />
                </div>
              </div>

              {/* Reason Code */}
              <div>
                <label className="block text-xs text-[#6B7280] font-semibold mb-1 uppercase tracking-wider">Reason Code</label>
                <select 
                  required
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({...adjustForm, reason: e.target.value})}
                  className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none text-sm"
                >
                  <option value="New Shipment">New Shipment Received</option>
                  <option value="Manual Restock">Manual Restock</option>
                  <option value="Damaged Goods">Damaged / Write-off</option>
                  <option value="Warehouse Audit">Warehouse Audit Correction</option>
                  <option value="Customer Return">Customer Return</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-[#E5E7EB]">
                <button type="button" onClick={() => setIsAdjustOpen(false)} className="px-4 py-2 text-[#6B7280] hover:text-[#111827] font-medium text-sm transition-colors">Cancel</button>
                <button type="submit" className="bg-[#0EA5E9] text-white px-6 py-2 rounded-md font-medium text-sm hover:bg-[#0284C7] transition-colors">
                  Execute Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}