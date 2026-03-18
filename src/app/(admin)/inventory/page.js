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
    <div className="text-gray-200 pb-10">
      {/* HEADER */}
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wider">INVENTORY COMMAND CENTER</h1>
          <p className="text-sm text-gray-500 mt-1">Live Asset Valuation & Stock Workflows</p>
        </div>
      </div>

      {/* METRICS DASHBOARD */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-[#111] border border-gray-800 p-6 rounded-lg shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-900/20 rounded-bl-full"></div>
          <p className="text-xs text-gray-500 font-bold tracking-widest mb-1">TOTAL ASSET VALUE</p>
          <p className="text-3xl font-mono text-emerald-400">₹{metrics.totalValue.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-[#111] border border-gray-800 p-6 rounded-lg shadow-lg">
          <p className="text-xs text-gray-500 font-bold tracking-widest mb-1">UNITS ON HAND</p>
          <p className="text-3xl font-mono text-white">{metrics.totalUnits.toLocaleString()}</p>
        </div>
        <div className="bg-[#111] border border-orange-900/30 p-6 rounded-lg shadow-lg">
          <p className="text-xs text-orange-500 font-bold tracking-widest mb-1">LOW STOCK ALERTS</p>
          <p className="text-3xl font-mono text-orange-400">{metrics.lowStock}</p>
        </div>
        <div className="bg-[#111] border border-red-900/30 p-6 rounded-lg shadow-lg">
          <p className="text-xs text-red-500 font-bold tracking-widest mb-1">OUT OF STOCK</p>
          <p className="text-3xl font-mono text-red-400">{metrics.outOfStock}</p>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="flex justify-between items-center mb-6">
        <input 
          type="text" 
          placeholder="Scan or Search SKU..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md bg-[#111] border border-gray-800 text-white px-4 py-2 rounded focus:outline-none focus:border-cyan-400 font-mono text-sm"
        />
      </div>

      {/* INVENTORY TABLE */}
      <div className="bg-[#111] border border-gray-800 rounded-lg overflow-hidden relative mb-12">
        {isLoading && (
          <div className="absolute inset-0 bg-[#111]/80 flex items-center justify-center z-10">
            <span className="text-cyan-400 animate-pulse font-mono tracking-widest">SYNCING_WAREHOUSE...</span>
          </div>
        )}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#0a0a0a] border-b border-gray-800 text-gray-400 text-xs tracking-wider uppercase">
              <th className="p-4">Product</th>
              <th className="p-4">SKU</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Physical Stock</th>
              <th className="p-4 text-right text-cyan-700" title="Placeholder for future allocated orders">Allocated</th>
              <th className="p-4 text-right text-emerald-500">Available to Sell</th>
              <th className="p-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map(item => {
              const stock = Number(item.stock) || 0;
              const allocated = 0; // Placeholder until we build the Orders module
              const available = stock - allocated;
              
              let statusBadge = <span className="bg-emerald-900/30 text-emerald-400 border border-emerald-800/50 px-2 py-1 rounded text-[10px] font-bold tracking-wider">OPTIMAL</span>;
              if (stock <= 0) statusBadge = <span className="bg-red-900/30 text-red-400 border border-red-800/50 px-2 py-1 rounded text-[10px] font-bold tracking-wider">DEPLETED</span>;
              else if (stock < 50) statusBadge = <span className="bg-orange-900/30 text-orange-400 border border-orange-800/50 px-2 py-1 rounded text-[10px] font-bold tracking-wider">LOW STOCK</span>;

              return (
                <tr key={item.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                  <td className="p-4 flex items-center gap-3">
                    <div className="text-xl bg-[#0a0a0a] p-2 rounded border border-gray-800">{item.image}</div>
                    <div>
                      <div className="text-white font-medium text-sm">{item.name}</div>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-xs text-gray-500">{item.sku}</td>
                  <td className="p-4">{statusBadge}</td>
                  <td className="p-4 font-mono text-base text-white text-right">{stock}</td>
                  <td className="p-4 font-mono text-sm text-cyan-800 text-right">{allocated}</td>
                  <td className="p-4 font-mono text-base text-emerald-400 text-right font-bold">{available}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleOpenAdjust(item)} className="bg-[#0a0a0a] hover:bg-cyan-900/40 hover:text-cyan-400 text-gray-400 border border-gray-700 hover:border-cyan-800 px-3 py-1 rounded text-xs transition-all uppercase tracking-wider">
                      Adjust
                    </button>
                  </td>
                </tr>
              );
            })}
            {!isLoading && filteredInventory.length === 0 && (
              <tr><td colSpan="7" className="p-8 text-center text-gray-500">No inventory found. Add products first.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* AUDIT LEDGER (Recent Movements) */}
      <div>
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Recent Stock Movements</h2>
        <div className="bg-[#111] border border-gray-800 rounded-lg overflow-hidden">
           <table className="w-full text-left border-collapse text-sm">
             <thead>
               <tr className="bg-[#0a0a0a] border-b border-gray-800 text-gray-500 text-xs uppercase">
                 <th className="p-3">Date/Time</th>
                 <th className="p-3">Product</th>
                 <th className="p-3 text-right">Change</th>
                 <th className="p-3 text-right">New Stock</th>
                 <th className="p-3">Reason</th>
                 <th className="p-3">User</th>
               </tr>
             </thead>
             <tbody>
               {logs.map(log => (
                 <tr key={log.id} className="border-b border-gray-800/30">
                   <td className="p-3 text-gray-500 font-mono text-xs">
                     {new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                   </td>
                   <td className="p-3 text-gray-300">{log.product_name}</td>
                   <td className={`p-3 text-right font-mono font-bold ${log.change_amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                     {log.change_amount > 0 ? `+${log.change_amount}` : log.change_amount}
                   </td>
                   <td className="p-3 text-right font-mono text-gray-400">{log.new_stock}</td>
                   <td className="p-3 text-cyan-400 text-xs uppercase tracking-wider">{log.reason}</td>
                   <td className="p-3 text-gray-500">{log.user_name}</td>
                 </tr>
               ))}
               {logs.length === 0 && (
                 <tr><td colSpan="6" className="p-4 text-center text-gray-600 text-xs">No movements recorded yet.</td></tr>
               )}
             </tbody>
           </table>
        </div>
      </div>

      {/* ADJUST STOCK MODAL */}
      {isAdjustOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-800 rounded-lg w-full max-w-md p-6 shadow-2xl shadow-cyan-900/20">
            <h2 className="text-lg font-bold text-white mb-2 tracking-wide uppercase">Adjust Inventory</h2>
            <div className="flex gap-4 items-center mb-6 pb-4 border-b border-gray-800">
               <span className="text-3xl bg-[#0a0a0a] p-2 rounded">{selectedItem.image}</span>
               <div>
                 <div className="text-white font-medium">{selectedItem.name}</div>
                 <div className="flex gap-3 text-xs mt-1">
                    <span className="text-cyan-500 font-mono">{selectedItem.sku}</span>
                    <span className="text-gray-500">Current Stock: <span className="text-white font-bold">{selectedItem.stock}</span></span>
                 </div>
               </div>
            </div>
            
            <form onSubmit={handleUpdateStock} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                {/* Action Type */}
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Action</label>
                  <select 
                    value={adjustForm.type}
                    onChange={(e) => setAdjustForm({...adjustForm, type: e.target.value})}
                    className="w-full bg-[#0a0a0a] border border-gray-700 text-white px-3 py-2 rounded text-sm focus:outline-none focus:border-cyan-400"
                  >
                    <option value="add">Add Stock (+)</option>
                    <option value="deduct">Deduct Stock (-)</option>
                    <option value="override">Override Total (=)</option>
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Amount</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    placeholder="e.g. 50"
                    value={adjustForm.amount} 
                    onChange={(e) => setAdjustForm({...adjustForm, amount: e.target.value})}
                    className="w-full bg-[#0a0a0a] border border-gray-700 text-white px-3 py-2 rounded text-sm font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Reason Code */}
              <div>
                <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Reason Code</label>
                <select 
                  required
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({...adjustForm, reason: e.target.value})}
                  className="w-full bg-[#0a0a0a] border border-gray-700 text-cyan-400 px-3 py-2 rounded text-sm font-bold tracking-wider uppercase focus:outline-none focus:border-cyan-400"
                >
                  <option value="New Shipment">New Shipment Received</option>
                  <option value="Manual Restock">Manual Restock</option>
                  <option value="Damaged Goods">Damaged / Write-off</option>
                  <option value="Warehouse Audit">Warehouse Audit Correction</option>
                  <option value="Customer Return">Customer Return</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-800">
                <button type="button" onClick={() => setIsAdjustOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
                <button type="submit" className="bg-cyan-400 text-black px-6 py-2 rounded font-bold text-sm hover:bg-cyan-300 transition-colors uppercase tracking-wider">
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