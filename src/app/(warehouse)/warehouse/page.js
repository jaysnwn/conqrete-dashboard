"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // NEW: For Logout routing
import { supabase } from "@/lib/supabase";

export default function WarehousePage() {
  const router = useRouter(); // NEW
  
  // Navigation & Data State
  const [activeTab, setActiveTab] = useState("pending");
  const [pendingOrders, setPendingOrders] = useState([]);
  const [shippedOrders, setShippedOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [workerName, setWorkerName] = useState("Loading..."); // NEW: Worker Name State
  
  // UI & Animation State
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [shippingIds, setShippingIds] = useState([]);
  const [newArrivalIds, setNewArrivalIds] = useState([]);
  
  // Inventory Modal State
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [addQuantity, setAddQuantity] = useState(1);

  useEffect(() => {
    fetchWarehouseData();
    fetchWorkerProfile(); // NEW: Fetch their name on load
  }, []);

  // NEW: Fetch the logged in worker's name
  const fetchWorkerProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      const { data } = await supabase
        .from("warehouse_workers")
        .select("name")
        .eq("email", session.user.email)
        .maybeSingle();
      
      if (data) setWorkerName(data.name);
      else setWorkerName("Warehouse Staff");
    }
  };

  // NEW: Secure Logout Function
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Realtime Listener for New & Deleted Orders
  useEffect(() => {
    const channel = supabase
      .channel('warehouse-live-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.new.status === "Pending") {
            console.log("📦 New Order Alert!");
            const audio = new Audio("/notify.mp3");
            audio.play().catch(() => console.log("Audio blocked."));

            setNewArrivalIds((prev) => [...prev, payload.new.id]);
            
            setTimeout(() => { fetchWarehouseData(); }, 1000);

            setTimeout(() => {
              setNewArrivalIds((prev) => prev.filter(id => id !== payload.new.id));
            }, 6000);
          }
        }
      )
      // NEW: Listener for DELETED orders
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'orders' },
        (payload) => {
          console.log("🗑️ Order Canceled/Deleted Alert!");
          const audio = new Audio("/delete-alert.mp3");
          audio.play().catch(() => console.log("Audio blocked."));

          // Instantly rip it out of the UI without reloading
          setPendingOrders((prev) => prev.filter(o => o.id !== payload.old.id));
          setShippedOrders((prev) => prev.filter(o => o.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchWarehouseData = async () => {
    setIsLoading(true);
    try {
      const { data: pendingData, error: pendingErr } = await supabase
        .from("orders")
        .select(`id, order_number, customer_name, created_at, status, order_items(product_name, quantity, sku)`)
        .eq("status", "Pending")
        .order("created_at", { ascending: true });
      if (pendingErr) throw pendingErr;

      const { data: shippedData, error: shippedErr } = await supabase
        .from("orders")
        .select(`id, order_number, customer_name, created_at, status, order_items(product_name, quantity, sku)`)
        .eq("status", "Shipped")
        .order("created_at", { ascending: false })
        .limit(50);
      if (shippedErr) throw shippedErr;

      const { data: prodData, error: prodErr } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });
      if (prodErr) throw prodErr;

      setPendingOrders(pendingData || []);
      setShippedOrders(shippedData || []);
      setProducts(prodData || []);
    } catch (err) {
      console.error("Error fetching warehouse data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableSound = () => {
    const audio = new Audio("/notify.mp3");
    audio.play().then(() => setSoundEnabled(true)).catch(() => alert("Sound blocked!"));
  };

  const handleShipOrder = (order) => {
    const shipAudio = new Audio("/notify.mp3"); 
    shipAudio.play().catch(() => console.log("Audio blocked."));

    setShippingIds((prev) => [...prev, order.id]);

    setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("orders")
          .update({ status: "Shipped" })
          .eq("id", order.id);

        if (error) throw error;

        setPendingOrders((current) => current.filter(o => o.id !== order.id));
        setShippedOrders((current) => [{...order, status: "Shipped"}, ...current]);
        
      } catch (err) {
        console.error("Failed to ship order:", err);
        alert("Database error updating status.");
      } finally {
        setShippingIds((prev) => prev.filter(id => id !== order.id));
      }
    }, 1000); 
  };

  const handleReceiveInventory = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return alert("Please select a product.");

    try {
      const { data: productData, error: fetchErr } = await supabase
        .from("products")
        .select("stock, name")
        .eq("id", selectedProduct)
        .single();
      
      if (fetchErr) throw fetchErr;

      const newStockLevel = Number(productData.stock) + Number(addQuantity);

      const { error: updateErr } = await supabase
        .from("products")
        .update({ stock: newStockLevel })
        .eq("id", selectedProduct);
      
      if (updateErr) throw updateErr;

      await supabase.from("inventory_logs").insert([{
        product_id: selectedProduct,
        product_name: productData.name,
        change_amount: Number(addQuantity),
        new_stock: newStockLevel,
        reason: "Warehouse Restock",
        user_name: workerName // NEW: Stamps their actual name in the DB
      }]);

      alert(`✅ Successfully added ${addQuantity} units to ${productData.name}!`);
      
      setIsInventoryOpen(false);
      setSelectedProduct("");
      setAddQuantity(1);
      fetchWarehouseData(); 

    } catch (err) {
      console.error("Inventory error:", err);
      alert("Failed to update inventory.");
    }
  };

  const displayOrders = activeTab === "pending" ? pendingOrders : shippedOrders;

  return (
    <div className="p-8 text-white min-h-screen bg-black">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-emerald-400">CONQRETE WAREHOUSE</h1>
          {/* NEW: Displays their name right under the header */}
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-1">
            Fulfillment Center <span className="mx-2">|</span> <span className="text-emerald-400">OPERATOR: {workerName}</span>
          </p>
        </div>
        
        <div className="flex gap-4 items-center">
          <button
            onClick={handleEnableSound}
            className={`px-4 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap border ${
              soundEnabled
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-[#111] text-gray-500 border-gray-800 hover:text-white hover:border-gray-600'
            }`}
          >
            {soundEnabled ? '🔊 Alerts On' : '🔇 Alerts Off'}
          </button>

          <button
            onClick={() => setIsInventoryOpen(true)}
            className="bg-[#111] border border-gray-800 text-white hover:border-emerald-400 hover:text-emerald-400 px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all whitespace-nowrap"
          >
            + Receive
          </button>

          {/* NEW: Logout Button */}
          <button
            onClick={handleLogout}
            className="bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all whitespace-nowrap"
          >
            Logout
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex gap-8 border-b border-gray-800 mb-6">
        <button 
          onClick={() => setActiveTab("pending")}
          className={`pb-4 text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === "pending" ? "text-emerald-400 border-b-2 border-emerald-400" : "text-gray-600 hover:text-white"
          }`}
        >
          Pending Queue ({pendingOrders.length})
        </button>
        <button 
          onClick={() => setActiveTab("shipped")}
          className={`pb-4 text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === "shipped" ? "text-gray-300 border-b-2 border-gray-300" : "text-gray-600 hover:text-white"
          }`}
        >
          Shipping History
        </button>
      </div>

      {/* ORDERS TABLE */}
      <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#111] text-[10px] text-gray-500 uppercase font-black tracking-widest border-b border-gray-800">
              <th className="p-6">Order Info</th>
              <th className="p-6">Destination / Store</th>
              <th className="p-6">Items to Pack</th>
              <th className="p-6 text-center">Status / Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {displayOrders.length === 0 && !isLoading && (
              <tr>
                <td colSpan="4" className="p-12 text-center text-gray-500 uppercase tracking-widest text-xs font-bold">
                  {activeTab === "pending" ? "No pending orders. Queue is clear! 🎯" : "No shipped history found."}
                </td>
              </tr>
            )}

            {displayOrders.map((o) => {
              const isShipping = shippingIds.includes(o.id);
              const isNew = newArrivalIds.includes(o.id);

              let rowClass = "hover:bg-white/[0.02] transition-colors group ";
              if (isShipping) rowClass += "shipping ";
              if (isNew) rowClass += "new-arrival ";

              return (
                <tr key={o.id} className={rowClass}>
                  <td className="p-6 align-top w-1/4">
                    <p className={`font-mono font-bold text-sm ${activeTab === 'pending' ? 'text-emerald-400' : 'text-gray-400'}`}>
                      {o.order_number}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-1 uppercase">{new Date(o.created_at).toLocaleString()}</p>
                  </td>
                  <td className="p-6 align-top w-1/4">
                    <p className="text-sm font-bold text-gray-200 uppercase tracking-tight">{o.customer_name}</p>
                  </td>
                  <td className="p-6 w-2/4">
                    <div className="space-y-2">
                      {o.order_items && o.order_items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-[#111] p-3 rounded-lg border border-gray-800">
                          <div>
                            <p className={`text-xs font-bold uppercase ${activeTab === 'pending' ? 'text-white' : 'text-gray-400'}`}>
                              {item.product_name}
                            </p>
                            <p className="text-[9px] text-gray-500 font-mono mt-0.5">SKU: {item.sku}</p>
                          </div>
                          <div className={`font-black font-mono text-sm px-3 py-1 rounded border ${
                            activeTab === 'pending' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-gray-800/50 border-gray-700 text-gray-400'
                          }`}>
                            x{item.quantity}
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="p-6 text-center align-middle">
                    {activeTab === "pending" ? (
                      <button
                        onClick={() => handleShipOrder(o)}
                        disabled={isShipping}
                        className="bg-emerald-600 hover:bg-emerald-500 text-black px-6 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
                      >
                        {isShipping ? 'Shipping...' : 'Mark Shipped'}
                      </button>
                    ) : (
                      <span className="text-[9px] font-black px-3 py-1 rounded-full uppercase border text-gray-400 border-gray-700 bg-gray-800/50">
                        Dispatched
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* RECEIVE INVENTORY MODAL */}
      {isInventoryOpen && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-50 backdrop-blur-xl">
          <div className="bg-[#0a0a0a] border border-gray-800 p-10 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
              <h2 className="text-xl font-black italic text-emerald-400 uppercase tracking-tighter">Receive Stock</h2>
              <button onClick={() => setIsInventoryOpen(false)} className="text-gray-500 hover:text-white text-2xl">×</button>
            </div>

            <form onSubmit={handleReceiveInventory} className="space-y-6">
              <div>
                <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Select Product</label>
                <select 
                  required
                  value={selectedProduct} 
                  onChange={e => setSelectedProduct(e.target.value)}
                  className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-emerald-400"
                >
                  <option value="" disabled>Choose a product...</option>
                  <option value="ALL">📦 RESTOCK ALL ITEMS</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Current: {p.stock})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Quantity Received</label>
                <input 
                  type="number" 
                  min="1"
                  required
                  value={addQuantity} 
                  onChange={e => setAddQuantity(e.target.value)}
                  className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-mono text-sm outline-none focus:border-emerald-400"
                />
              </div>

              <div className="pt-6">
                <button 
                  type="submit"
                  className="w-full bg-emerald-500 text-black py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-400 active:scale-95 transition-all"
                >
                  Confirm & Update DB
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}