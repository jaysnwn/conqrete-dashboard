"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; 
import { supabase } from "@/lib/supabase";

export default function WarehousePage() {
  const router = useRouter(); 
  
  // Navigation & Data State
  const [activeTab, setActiveTab] = useState("pending");
  const [pendingOrders, setPendingOrders] = useState([]);
  const [shippedOrders, setShippedOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [workerName, setWorkerName] = useState("Loading..."); 
  
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
    fetchWorkerProfile(); 
  }, []);

  // UPDATED: Fetch the logged in worker's name from the new EMPLOYEES table
  const fetchWorkerProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const { data } = await supabase
          .from("employees")
          .select("full_name")
          .eq("work_email", session.user.email.toLowerCase())
          .maybeSingle();
        
        if (data) setWorkerName(data.full_name);
        else setWorkerName("Warehouse Staff");
      }
    } catch (err) {
      console.error("Error fetching worker profile:", err);
      setWorkerName("Warehouse Staff");
    }
  };

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
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'orders' },
        (payload) => {
          console.log("🗑️ Order Canceled/Deleted Alert!");
          const audio = new Audio("/delete-alert.mp3");
          audio.play().catch(() => console.log("Audio blocked."));

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
        user_name: workerName 
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
    <div className="min-h-screen bg-[#0c0e10] text-[#eeeef0] pb-32 font-sans selection:bg-[#a1faff]/30">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Manrope:wght@200;300;400;500;600;700;800&display=swap');
        .font-headline { font-family: 'Space Grotesk', sans-serif; }
        .font-label { font-family: 'Manrope', sans-serif; }
        .glass-card { background: rgba(35, 38, 41, 0.4); backdrop-filter: blur(24px); border: 1px solid rgba(161, 250, 255, 0.1); }
        .glass-modal { background: rgba(12, 14, 16, 0.95); backdrop-filter: blur(30px); border: 1px solid rgba(255, 255, 255, 0.1); }
        
        @keyframes flashNew {
          0% { box-shadow: 0 0 30px rgba(0, 244, 254, 0.6); border-color: #00f4fe; }
          100% { box-shadow: none; border-color: rgba(161, 250, 255, 0.1); }
        }
        .new-arrival { animation: flashNew 3s ease-out; border: 1px solid #00f4fe; }
        .shipping { opacity: 0.5; filter: grayscale(100%); transform: scale(0.98); transition: all 0.5s ease; }
      `}</style>

      {/* TOP HEADER */}
      <header className="w-full h-24 sticky top-0 z-30 bg-[#0c0e10]/80 backdrop-blur-md border-b border-[#a1faff]/5 flex justify-between items-center px-6 md:px-12 max-w-[1920px] mx-auto shadow-sm">
        <div className="flex items-center gap-4">
          <nav className="flex text-[10px] md:text-xs font-label uppercase tracking-widest gap-2 md:gap-3">
            <span className="text-slate-500">CONQRETE</span>
            <span className="text-slate-700">/</span>
            <span className="text-emerald-400 border-b border-emerald-400/50 pb-1">LOGISTICS_HUB</span>
          </nav>
        </div>
        <div className="flex items-center gap-4 md:gap-8">
          <div className="text-right hidden sm:block">
            <p className="text-[11px] font-bold font-headline text-white leading-none uppercase">{workerName}</p>
            <p className="text-[9px] text-slate-400 font-label tracking-widest mt-1 uppercase">Fulfillment Operator</p>
          </div>
          <div className="w-10 h-10 rounded-full border border-emerald-500/20 flex items-center justify-center bg-[#111] text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CANVAS */}
      <div className="p-4 md:p-8 max-w-[1200px] mx-auto mt-4">
        
        {/* TABS NAVIGATION */}
        <div className="flex gap-4 md:gap-8 border-b border-white/5 mb-8">
          <button 
            onClick={() => setActiveTab("pending")}
            className={`pb-4 text-[10px] md:text-xs font-headline font-black uppercase tracking-[0.2em] transition-all flex-1 md:flex-none text-center ${
              activeTab === "pending" ? "text-emerald-400 border-b-2 border-emerald-400" : "text-slate-500 hover:text-white"
            }`}
          >
            Dispatch Queue ({pendingOrders.length})
          </button>
          <button 
            onClick={() => setActiveTab("shipped")}
            className={`pb-4 text-[10px] md:text-xs font-headline font-black uppercase tracking-[0.2em] transition-all flex-1 md:flex-none text-center ${
              activeTab === "shipped" ? "text-[#a1faff] border-b-2 border-[#a1faff]" : "text-slate-500 hover:text-white"
            }`}
          >
            History Log
          </button>
        </div>

        {/* LOADING STATE */}
        {isLoading && (
          <div className="flex justify-center items-center py-20">
             <div className="text-emerald-400 font-mono text-xs uppercase tracking-[0.4em] animate-pulse">Syncing Floor Data...</div>
          </div>
        )}

        {/* EMPTY STATE */}
        {displayOrders.length === 0 && !isLoading && (
          <div className="glass-card rounded-3xl p-16 text-center border-dashed border-white/10">
            <p className="text-slate-500 uppercase tracking-widest text-[10px] font-label font-bold">
              {activeTab === "pending" ? "All clear. Warehouse is optimized." : "No shipment history found."}
            </p>
          </div>
        )}

        {/* ORDERS CARDS (Mobile-First Pick Tickets) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {displayOrders.map((o) => {
            const isShipping = shippingIds.includes(o.id);
            const isNew = newArrivalIds.includes(o.id);

            let cardClass = "glass-card p-6 md:p-8 rounded-3xl flex flex-col transition-all relative overflow-hidden group ";
            if (isShipping) cardClass += "shipping ";
            if (isNew) cardClass += "new-arrival ";

            return (
              <div key={o.id} className={cardClass}>
                {/* Pick Ticket Header */}
                <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-6">
                  <div>
                    <p className="text-[10px] text-slate-500 font-label uppercase tracking-widest font-bold mb-1">Destination</p>
                    <p className="text-lg md:text-xl font-bold text-white uppercase font-headline tracking-wide leading-tight">{o.customer_name}</p>
                    <p className={`font-mono text-xs mt-2 ${activeTab === 'pending' ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {o.order_number}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-[9px] font-label uppercase tracking-widest font-black px-3 py-1.5 rounded-full border ${
                      activeTab === 'pending' ? 'text-orange-400 border-orange-400/20 bg-orange-400/5' : 'text-slate-400 border-slate-700 bg-white/5'
                    }`}>
                      {activeTab === 'pending' ? 'Awaiting Pack' : 'Dispatched'}
                    </span>
                    <p className="text-[9px] text-slate-600 font-mono mt-3 uppercase">{new Date(o.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                  </div>
                </div>

                {/* Items to Pick */}
                <div className="flex-1 space-y-3 mb-8">
                  <p className="text-[9px] text-[#a1faff] font-label uppercase tracking-[0.2em] font-black pl-1">Pull List</p>
                  {o.order_items && o.order_items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-[#050505] p-4 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-headline font-black text-sm border ${
                          activeTab === 'pending' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-slate-400 border-white/10'
                        }`}>
                          x{item.quantity}
                        </div>
                        <div>
                          <p className={`text-xs font-bold uppercase font-headline ${activeTab === 'pending' ? 'text-white' : 'text-slate-400'}`}>
                            {item.product_name}
                          </p>
                          <p className="text-[9px] text-slate-500 font-mono tracking-widest mt-1">SKU: {item.sku}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Button */}
                {activeTab === "pending" && (
                  <button
                    onClick={() => handleShipOrder(o)}
                    disabled={isShipping}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-4 md:py-5 rounded-2xl font-label font-black uppercase tracking-[0.2em] text-[10px] md:text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
                  >
                    {isShipping ? 'Processing Dispatch...' : 'Confirm Packed & Shipped'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* FIXED BOTTOM ACTION BAR */}
      <div className="fixed bottom-6 right-4 left-4 md:right-12 md:left-auto md:w-[600px] flex gap-3 z-20">
        <button 
          onClick={handleEnableSound} 
          className={`flex-1 glass-card border py-4 md:py-5 rounded-2xl font-label font-black uppercase tracking-[0.2em] text-[9px] shadow-2xl active:scale-95 transition-all flex justify-center items-center ${
            soundEnabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-[#0c0e10]/90 text-slate-400 border-white/5 hover:text-white hover:border-white/20'
          }`}
        >
          {soundEnabled ? '🔊 Alerts On' : '🔇 Alerts Off'}
        </button>
        <button 
          onClick={() => setIsInventoryOpen(true)} 
          className="flex-[2] bg-gradient-to-r from-[#a1faff] to-[#00f4fe] text-[#002222] py-4 md:py-5 rounded-2xl font-label font-black uppercase tracking-[0.2em] text-[10px] shadow-[0_0_25px_rgba(0,242,255,0.4)] active:scale-95 hover:scale-[1.02] transition-all"
        >
          + Receive Freight
        </button>
        <button 
          onClick={handleLogout} 
          className="flex-none bg-[#0c0e10]/90 border border-[#ff716c]/30 text-[#ff716c] px-6 py-4 md:py-5 rounded-2xl font-label font-black uppercase tracking-[0.2em] text-[9px] shadow-2xl active:scale-95 transition-all hover:bg-[#ff716c]/10"
        >
          Exit
        </button>
      </div>

      {/* RECEIVE INVENTORY MODAL (SLIDE UP) */}
      {isInventoryOpen && (
        <div className="fixed inset-0 bg-black/80 z-[90] flex items-end justify-center sm:items-center sm:p-6 backdrop-blur-md">
          <div className="glass-modal p-8 rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-slide-up border-[#00f4fe]/20">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <h2 className="text-xl font-black font-headline text-[#00f4fe] uppercase tracking-tighter">Log Incoming Freight</h2>
              <button onClick={() => setIsInventoryOpen(false)} className="text-slate-500 hover:text-white text-2xl leading-none active:scale-90 transition-transform">×</button>
            </div>

            <form onSubmit={handleReceiveInventory} className="space-y-6">
              <div>
                <label className="block text-[10px] text-slate-400 mb-2 uppercase font-label tracking-widest font-bold">Target SKU</label>
                <select 
                  required
                  value={selectedProduct} 
                  onChange={e => setSelectedProduct(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 p-4 rounded-xl text-white font-label text-sm outline-none focus:border-[#00f4fe] transition-colors"
                >
                  <option value="" disabled className="text-slate-600">Scan or select product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Floor Stock: {p.stock})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-2 uppercase font-label tracking-widest font-bold">Units Received</label>
                <input 
                  type="number" 
                  min="1"
                  required
                  value={addQuantity} 
                  onChange={e => setAddQuantity(e.target.value)}
                  className="w-full bg-[#050505] border border-[#00f4fe]/30 p-4 rounded-xl text-[#00f4fe] font-headline text-2xl font-black outline-none focus:border-[#00f4fe] transition-colors"
                />
              </div>

              <div className="pt-4 mt-2">
                <button 
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#a1faff] to-[#00f4fe] text-[#002222] py-5 rounded-2xl font-label font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)]"
                >
                  Commit to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}