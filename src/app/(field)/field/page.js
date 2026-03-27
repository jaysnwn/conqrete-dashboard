"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; 
import { supabase } from "@/lib/supabase";

export default function FieldPortal() {
  const router = useRouter(); 

  const [salesmen, setSalesmen] = useState([]);
  const [currentRep, setCurrentRep] = useState(null); 
  
  const [products, setProducts] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals State
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isAddingRetailer, setIsAddingRetailer] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false); 
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // Form States
  const [customerName, setCustomerName] = useState("");
  const [salesChannel, setSalesChannel] = useState("Retailer");
  const [cart, setCart] = useState([{ productId: "", quantity: 1 }]);
  const [newShop, setNewShop] = useState({ store_name: "", location: "", phone: "", email: "" });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [catalogSearch, setCatalogSearch] = useState(""); 
  
  // Expense State
  const [expenseData, setExpenseData] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    category: "Petrol", 
    amount: "" 
  });

  useEffect(() => { fetchLoginData(); }, []);

  const fetchLoginData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: rep } = await supabase
      .from("employees")
      .select("*")
      .eq("email", session.user.email.toLowerCase())
      .single();

    if (rep && (rep.role?.toLowerCase() === 'salesman' || rep.role?.toLowerCase() === 'sales')) {
      loginAsRep(rep);
    } else {
      const { data } = await supabase
        .from("employees")
        .select("*")
        .in("role", ["salesman", "sales", "Salesman"])
        .order("name", { ascending: true });
        
      setSalesmen(data || []);
      setIsLoading(false);
    }
  };

  const loginAsRep = async (rep) => {
    setIsLoading(true);
    setCurrentRep(rep);
    
    const [prodRes, retRes, ordRes] = await Promise.all([
      supabase.from("products").select("*").order("name", { ascending: true }),
      supabase.from("retailers").select("*").order("store_name", { ascending: true }),
      supabase.from("orders").select("*").eq("sales_rep", rep.name).order("created_at", { ascending: false })
    ]);

    setProducts(prodRes.data || []);
    setRetailers(retRes.data || []);
    setMyOrders(ordRes.data || []);
    setIsLoading(false);
  };

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    router.push("/login"); 
  };

  const handleLogExpense = async (e) => {
    e.preventDefault();
    if (!currentRep) return;
    setIsLoading(true);

    try {
      const { error } = await supabase.from("expense_claims").insert([{
        employee_id: currentRep.id,
        employee_name: currentRep.name,
        date: expenseData.date,
        category: expenseData.category,
        amount: expenseData.amount,
        status: "Pending"
      }]);

      if (error) throw error;
      
      alert(`✅ ₹${expenseData.amount} claim submitted for approval!`);
      setIsExpenseModalOpen(false);
      setExpenseData({ ...expenseData, amount: "" });
    } catch (err) {
      alert("Error logging expense: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNewShop = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from("retailers")
      .insert([{ 
        store_name: newShop.store_name, 
        location: newShop.location,
        phone: newShop.phone,
        email: newShop.email,
        payment_cycle_days: 15,
        total_pending: 0
      }])
      .select()
      .single();

    if (error) return alert("Error adding shop: " + error.message);
    
    setRetailers([...retailers, data].sort((a, b) => a.store_name.localeCompare(b.store_name)));
    setCustomerName(data.store_name);
    setIsAddingRetailer(false);
    setNewShop({ store_name: "", location: "", phone: "", email: "" });
    alert(`${data.store_name} added successfully!`);
  };

  const handleAddItem = () => setCart([...cart, { productId: "", quantity: 1 }]);
  const removeItem = (index) => setCart(cart.filter((_, i) => i !== index));

  const updateCartItem = (index, field, value) => {
    const updatedCart = [...cart];
    if (field === "quantity") updatedCart[index][field] = Number(value) || 0;
    else updatedCart[index][field] = value;
    setCart(updatedCart);
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId);
      if (!product || !product.pricing) return sum;
      const price = salesChannel === "Distributor" ? product.pricing.distributor : product.pricing.retailer;
      return sum + (price * Number(item.quantity));
    }, 0);
  };

  const submitMobileOrder = async (e) => {
    e.preventDefault();
    if (cart.some(item => !item.productId)) return alert("Select products for all items.");

    const orderNum = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const grandTotal = calculateTotal();

    try {
      const { data: newOrder, error: orderErr } = await supabase.from("orders").insert([{
        order_number: orderNum, customer_name: customerName, sales_channel: salesChannel,
        total_amount: grandTotal, status: "Pending", sales_rep: currentRep.name
      }]).select().single();

      if (orderErr) throw orderErr;

      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        const price = salesChannel === "Distributor" ? product.pricing.distributor : product.pricing.retailer;
        
        const currentStock = Number(product.stock) || 0;
        const deductQty = Number(item.quantity) || 0;
        const newStock = currentStock - deductQty;

        await supabase.from("order_items").insert([{
          order_id: newOrder.id, product_id: product.id, product_name: product.name,
          sku: product.sku, quantity: deductQty, unit_price: price, total_price: price * deductQty
        }]);

        await supabase.from("products").update({ stock: newStock }).eq("id", product.id);
        
        await supabase.from("inventory_logs").insert([{
          product_id: product.id,
          product_name: product.name,
          change_amount: -deductQty,
          new_stock: newStock,
          reason: `Field Punch: ${orderNum}`,
          user_name: currentRep.name
        }]);
      }

      const retailer = retailers.find(r => r.store_name === customerName);
      if (retailer) {
        await supabase.from("retailers").update({
          total_lifetime_sales: Number(retailer.total_lifetime_sales || 0) + grandTotal,
          total_pending: Number(retailer.total_pending || 0) + grandTotal
        }).eq("id", retailer.id);
      }

      alert("Order pushed to HQ successfully!");
      setIsCreatingOrder(false);
      setCart([{ productId: "", quantity: 1 }]);
      setCustomerName("");
      
      loginAsRep(currentRep); 

    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleDeletePunch = async (orderId, orderNum, totalAmount, customerName) => {
    if (!window.confirm(`WARNING: Cancel order ${orderNum} and return items to inventory?`)) return;
    
    try {
      const { data: items } = await supabase.from("order_items").select("*").eq("order_id", orderId);

      if (items && items.length > 0) {
        for (const item of items) {
          const { data: product } = await supabase.from("products").select("stock").eq("id", item.product_id).single();
          
          if (product) {
            const restoredStock = Number(product.stock) + Number(item.quantity);
            await supabase.from("products").update({ stock: restoredStock }).eq("id", item.product_id);
            await supabase.from("inventory_logs").insert([{
              product_id: item.product_id,
              product_name: item.product_name,
              change_amount: item.quantity,
              new_stock: restoredStock,
              reason: `Order Pulled Back: ${orderNum}`,
              user_name: currentRep.name
            }]);
          }
        }
      }

      const { data: retailer } = await supabase.from("retailers").select("*").eq("store_name", customerName).single();
      if (retailer) {
        const newLifetime = Math.max(0, Number(retailer.total_lifetime_sales || 0) - Number(totalAmount));
        const newPending = Math.max(0, Number(retailer.total_pending || 0) - Number(totalAmount));
        await supabase.from("retailers").update({ total_lifetime_sales: newLifetime, total_pending: newPending }).eq("id", retailer.id);
      }

      await supabase.from("order_items").delete().eq("order_id", orderId);
      await supabase.from("orders").delete().eq("id", orderId);
      
      alert(`Order ${orderNum} successfully pulled back! Inventory restored.`);
      loginAsRep(currentRep); 

    } catch (err) {
      alert("Error pulling back order: " + err.message);
    }
  };

  const handleLogPayment = async (e) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) return alert("Please enter a valid amount.");

    const currentPaid = Number(selectedOrder.amount_paid || 0);
    const orderTotal = Number(selectedOrder.total_amount);
    const newAmountPaid = currentPaid + amount;
    
    let newStatus = "Partial";
    if (newAmountPaid >= orderTotal) newStatus = "Paid";

    try {
      await supabase.from("orders").update({ amount_paid: newAmountPaid, payment_status: newStatus }).eq("id", selectedOrder.id);

      const retailer = retailers.find(r => r.store_name === selectedOrder.customer_name);
      if (retailer) {
        const newPending = Math.max(0, Number(retailer.total_pending || 0) - amount);
        await supabase.from("retailers").update({ total_pending: newPending }).eq("id", retailer.id);
      }

      alert(`₹${amount.toLocaleString()} collected! Great job.`);
      setIsPaymentModalOpen(false);
      setPaymentAmount("");
      loginAsRep(currentRep); 
    } catch (err) {
      alert("Error logging payment: " + err.message);
    }
  };

  const openPaymentModal = (order) => {
    setSelectedOrder(order);
    const remaining = Number(order.total_amount) - Number(order.amount_paid || 0);
    setPaymentAmount(remaining);
    setIsPaymentModalOpen(true);
  };

  const myTotalSales = myOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const myCommission = myTotalSales * (Number(currentRep?.commission_rate || 0) / 100);
  const progress = currentRep?.monthly_target ? Math.min((myTotalSales / currentRep.monthly_target) * 100, 100) : 0;

  const filteredCatalog = products.filter(p => 
    p.name.toLowerCase().includes(catalogSearch.toLowerCase()) || 
    p.sku.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  // ==========================================
  // RENDER: ADMIN OVERRIDE / SELECTION SCREEN
  // ==========================================
  if (!currentRep) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#eeeef0] p-6 flex flex-col justify-center items-center font-sans">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Manrope:wght@200;300;400;500;600;700;800&display=swap');
          .font-headline { font-family: 'Space Grotesk', sans-serif; }
          .font-label { font-family: 'Manrope', sans-serif; }
          .glass-card { background: rgba(35, 38, 41, 0.4); backdrop-filter: blur(24px); border: 1px solid rgba(161, 250, 255, 0.1); }
        `}</style>
        
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-r from-[#a1faff] to-[#00f4fe] font-headline uppercase">CONQRETE CORE</h1>
        <p className="text-[10px] text-[#aaabad] uppercase tracking-[0.4em] font-bold mb-10 text-center font-label">Field Agent Override</p>
        
        <div className="w-full max-w-md glass-card p-8 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.8)]">
          <p className="text-xs text-[#a1faff] uppercase tracking-widest font-bold mb-6 text-center font-label">Select Active Roster</p>
          {isLoading ? (
            <div className="text-[#a1faff] animate-pulse text-center font-mono text-sm">Synchronizing Database...</div>
          ) : (
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden">
              {salesmen.map(rep => (
                <button key={rep.id} onClick={() => loginAsRep(rep)} className="w-full bg-[#111418] border border-white/5 hover:border-[#a1faff]/50 hover:bg-white/5 text-left p-5 rounded-2xl flex justify-between items-center group transition-all">
                  <span className="font-bold text-white uppercase font-headline tracking-wide">{rep.name}</span>
                  <span className="text-[10px] text-slate-500 font-label tracking-widest uppercase group-hover:text-[#a1faff] transition-colors">Initialize →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: MAIN FIELD PORTAL
  // ==========================================
  return (
    <div className="min-h-screen bg-[#0c0e10] text-[#eeeef0] pb-32 font-sans selection:bg-[#a1faff]/30">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Manrope:wght@200;300;400;500;600;700;800&display=swap');
        .font-headline { font-family: 'Space Grotesk', sans-serif; }
        .font-label { font-family: 'Manrope', sans-serif; }
        .glass-card { background: rgba(35, 38, 41, 0.4); backdrop-filter: blur(24px); border: 1px solid rgba(161, 250, 255, 0.1); }
        .glass-modal { background: rgba(12, 14, 16, 0.95); backdrop-filter: blur(30px); border: 1px solid rgba(255, 255, 255, 0.1); }
      `}</style>

      {/* TOP HEADER */}
      <header className="w-full h-24 sticky top-0 z-30 bg-[#0c0e10]/80 backdrop-blur-md border-b border-[#a1faff]/5 flex justify-between items-center px-6 md:px-12 max-w-[1920px] mx-auto shadow-sm">
        <div className="flex items-center gap-4">
          <nav className="flex text-[10px] md:text-xs font-label uppercase tracking-widest gap-2 md:gap-3">
            <span className="text-slate-500">CONQRETE</span>
            <span className="text-slate-700">/</span>
            <span className="text-[#a1faff] border-b border-[#a1faff]/50 pb-1">FIELD_PORTAL</span>
          </nav>
        </div>
        <div className="flex items-center gap-4 md:gap-8">
          <div className="text-right hidden sm:block">
            <p className="text-[11px] font-bold font-headline text-white leading-none uppercase">{currentRep.name}</p>
            <p className="text-[9px] text-slate-400 font-label tracking-widest mt-1 uppercase">Active Agent</p>
          </div>
          <button onClick={handleLogOut} className="text-[9px] font-bold uppercase tracking-widest border border-[#ff716c]/30 text-[#ff716c] hover:bg-[#ff716c]/10 px-4 py-2 rounded-full transition-all">
            Disconnect
          </button>
        </div>
      </header>

      {/* MAIN CONTENT CANVAS */}
      <div className="p-4 md:p-8 max-w-[1200px] mx-auto mt-4">
        
        {/* Performance Glass Card */}
        <div className="glass-card rounded-3xl p-6 md:p-8 mb-10 shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#a1faff]/5 rounded-full blur-3xl group-hover:bg-[#a1faff]/10 transition-colors"></div>
          
          <p className="text-[10px] text-[#aaabad] font-label uppercase tracking-widest mb-6">Agent Performance Metrics</p>
          
          <div className="flex justify-between items-end mb-4 relative z-10">
            <div>
              <p className="text-[10px] text-slate-500 font-label uppercase tracking-widest font-bold mb-1">Total Volume</p>
              <p className="text-4xl md:text-5xl font-headline text-white font-black tracking-tighter">₹{myTotalSales.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-emerald-600 font-label uppercase tracking-widest font-bold mb-1">Accrued Comm.</p>
              <p className="text-xl md:text-2xl font-headline text-emerald-400 font-black tracking-tighter">₹{Math.round(myCommission).toLocaleString()}</p>
            </div>
          </div>
          
          <div className="mt-6 relative z-10">
            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-[#a1faff] to-[#00f4fe] h-full rounded-full shadow-[0_0_10px_#00f4fe]" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-[9px] text-slate-500 font-label tracking-widest uppercase mt-3 text-right">{Math.round(progress)}% of Target Required</p>
          </div>
        </div>

        {/* Recent Punches Section */}
        <h2 className="text-[11px] text-[#a1faff] font-label uppercase font-black tracking-[0.3em] mb-6 pl-2">Recent Field Dispatches</h2>
        
        <div className="space-y-4">
          {myOrders.map(o => {
            const isPaid = o.payment_status === 'Paid';
            const remaining = Number(o.total_amount) - Number(o.amount_paid || 0);

            return (
              <div key={o.id} className="glass-card p-5 md:p-6 rounded-2xl shadow-lg transition-all hover:border-white/20">
                <div className="flex justify-between items-start mb-4 border-b border-white/5 pb-4">
                  <div>
                    <p className="text-sm md:text-base font-bold text-white uppercase font-headline tracking-wide">{o.customer_name}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-1 tracking-widest">{o.order_number}</p>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <p className="text-lg md:text-xl font-headline font-black text-[#a1faff]">₹{Number(o.total_amount).toLocaleString()}</p>
                      <div className="flex gap-2 justify-end mt-2">
                        <span className={`text-[8px] font-label uppercase tracking-widest font-black px-2 py-1 rounded border ${o.status === 'Pending' ? 'text-orange-400 border-orange-400/20 bg-orange-400/5' : 'text-[#a1faff] border-[#a1faff]/20 bg-[#a1faff]/5'}`}>{o.status}</span>
                        <span className={`text-[8px] font-label uppercase tracking-widest font-black px-2 py-1 rounded border ${isPaid ? 'text-emerald-400 border-emerald-400/20 bg-emerald-400/5' : 'text-[#ff716c] border-[#ff716c]/20 bg-[#ff716c]/5'}`}>{o.payment_status || 'Unpaid'}</span>
                      </div>
                    </div>
                    <button onClick={() => handleDeletePunch(o.id, o.order_number, o.total_amount, o.customer_name)} className="text-slate-600 hover:text-[#ff716c] transition-colors p-2 text-lg active:scale-90">🗑️</button>
                  </div>
                </div>

                {!isPaid && (
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-[10px] font-label uppercase tracking-widest text-slate-400 font-bold">Due: <span className="text-white">₹{remaining.toLocaleString()}</span></p>
                    <button 
                      onClick={() => openPaymentModal(o)}
                      className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-5 py-2.5 rounded-xl text-[9px] font-label font-black uppercase tracking-widest hover:bg-emerald-500/20 active:scale-95 transition-all"
                    >
                      Receive Cash
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {myOrders.length === 0 && <p className="text-center text-xs text-slate-600 font-label tracking-widest uppercase py-10">No dispatches recorded.</p>}
        </div>
      </div>

      {/* FIXED BOTTOM ACTION BAR */}
      <div className="fixed bottom-6 right-4 left-4 md:right-12 md:left-auto md:w-[600px] flex gap-3 z-20">
        <button 
          onClick={() => setIsCatalogOpen(true)} 
          className="flex-1 glass-card bg-[#0c0e10]/90 text-white py-4 md:py-5 rounded-2xl font-label font-black uppercase tracking-[0.2em] text-[9px] shadow-2xl active:scale-95 transition-transform hover:border-[#a1faff]/40"
        >
          Catalog
        </button>
        <button 
          onClick={() => setIsExpenseModalOpen(true)} 
          className="flex-1 glass-card bg-[#0c0e10]/90 border-orange-900/40 text-orange-400 py-4 md:py-5 rounded-2xl font-label font-black uppercase tracking-[0.2em] text-[9px] shadow-2xl active:scale-95 transition-transform hover:border-orange-500/50"
        >
          Expenses
        </button>
        <button 
          onClick={() => setIsCreatingOrder(true)} 
          className="flex-[1.5] bg-gradient-to-r from-[#a1faff] to-[#00f4fe] text-[#002222] py-4 md:py-5 rounded-2xl font-label font-black uppercase tracking-[0.2em] text-[10px] shadow-[0_0_25px_rgba(0,242,255,0.4)] active:scale-95 hover:scale-[1.02] transition-all"
        >
          + Punch Order
        </button>
      </div>

      {/* ========================================== */}
      {/* MODALS - UPGRADED TO GLASSMORPHISM         */}
      {/* ========================================== */}

      {/* EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[90] flex items-end justify-center sm:items-center sm:p-6 backdrop-blur-md">
          <div className="glass-modal p-8 rounded-t-3xl sm:rounded-3xl w-full max-w-sm shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-slide-up border-orange-500/20">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <h2 className="text-xl font-black font-headline text-orange-400 uppercase tracking-tighter">Log Expense</h2>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-500 hover:text-white text-2xl leading-none active:scale-90 transition-transform">×</button>
            </div>
            
            <form onSubmit={handleLogExpense} className="space-y-6">
              <div>
                <label className="block text-[10px] text-slate-400 mb-2 uppercase font-label tracking-widest font-bold">Category</label>
                <select value={expenseData.category} onChange={e => setExpenseData({...expenseData, category: e.target.value})} className="w-full bg-[#050505] border border-white/10 p-4 rounded-xl text-white font-label text-sm outline-none focus:border-orange-500 transition-colors">
                  <option value="Petrol">Petrol / Fuel</option>
                  <option value="Hotel">Hotel Stay</option>
                  <option value="Meals">Food / Meals</option>
                  <option value="Travel">Train / Bus</option>
                  <option value="Misc">Other (Misc)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-2 uppercase font-label tracking-widest font-bold">Date</label>
                  <input required type="date" value={expenseData.date} onChange={e => setExpenseData({...expenseData, date: e.target.value})} className="w-full bg-[#050505] border border-white/10 p-4 rounded-xl text-white font-label text-sm outline-none focus:border-orange-500 [&::-webkit-calendar-picker-indicator]:invert transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-2 uppercase font-label tracking-widest font-bold">Amount (₹)</label>
                  <input required type="number" value={expenseData.amount} onChange={e => setExpenseData({...expenseData, amount: e.target.value})} className="w-full bg-[#050505] border border-orange-500/30 p-4 rounded-xl text-orange-400 font-headline text-lg font-black outline-none focus:border-orange-500 transition-colors placeholder:text-orange-900/50" placeholder="0" />
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="w-full bg-orange-500 hover:bg-orange-400 text-black py-5 rounded-2xl font-label font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)] mt-4">
                {isLoading ? "Submitting..." : "Submit Claim"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DIGITAL CATALOG MODAL */}
      {isCatalogOpen && (
        <div className="fixed inset-0 bg-[#0c0e10]/95 z-[80] overflow-y-auto pb-20 animate-slide-up backdrop-blur-xl">
          <div className="bg-[#0c0e10]/80 border-b border-[#a1faff]/10 p-6 pt-10 sticky top-0 z-10 backdrop-blur-2xl flex justify-between items-center max-w-[1200px] mx-auto">
            <div>
              <h2 className="text-2xl font-black font-headline text-white uppercase tracking-tighter">Digital Catalog</h2>
              <p className="text-[9px] text-[#a1faff] uppercase font-label tracking-widest mt-1">Client Presentation Mode</p>
            </div>
            <button onClick={() => setIsCatalogOpen(false)} className="text-slate-500 hover:text-white text-3xl leading-none active:scale-90 transition-transform">×</button>
          </div>
          
          <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
            <input type="text" placeholder="SEARCH SKU OR NAME..." value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} className="w-full bg-[#050505] border border-white/10 p-5 rounded-2xl text-white font-label text-sm outline-none focus:border-[#a1faff] mb-8 placeholder:text-slate-700 placeholder:tracking-widest uppercase transition-colors" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCatalog.map(product => (
                <div key={product.id} className="glass-card p-6 rounded-3xl shadow-lg flex gap-6 items-center hover:border-white/20 transition-colors">
                  <div className="w-20 h-20 bg-[#050505] border border-white/5 rounded-2xl flex items-center justify-center text-4xl shrink-0 shadow-inner">{product.image}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="text-white font-black font-headline text-base uppercase tracking-tight">{product.name}</h3>
                      <span className={`text-[8px] uppercase font-label tracking-widest font-black px-2 py-1 rounded border ${product.stock > 0 ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 'text-[#ff716c] border-[#ff716c]/20 bg-[#ff716c]/5'}`}>{product.stock > 0 ? 'In Stock' : 'Out of Stock'}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-label tracking-widest uppercase mb-4">{product.sku}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-4 border-t border-white/5">
                      <div><p className="text-[8px] text-slate-500 uppercase font-label tracking-widest font-bold mb-1">Retailer</p><p className="text-white font-headline font-bold text-base">₹{Number(product.pricing?.retailer || 0).toLocaleString()}</p></div>
                      <div><p className="text-[8px] text-[#a1faff]/60 uppercase font-label tracking-widest font-bold mb-1">Distributor</p><p className="text-[#a1faff] font-headline font-bold text-base">₹{Number(product.pricing?.distributor || 0).toLocaleString()}</p></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* REGISTER NEW SHOP MODAL */}
      {isAddingRetailer && (
        <div className="fixed inset-0 bg-black/80 z-[95] flex items-end justify-center sm:items-center sm:p-6 backdrop-blur-md">
          <div className="glass-modal p-8 rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-slide-up border-emerald-500/20">
            <h3 className="text-2xl font-black font-headline uppercase text-white mb-6 tracking-tighter border-b border-white/10 pb-4">Register Shop</h3>
            <form onSubmit={handleAddNewShop} className="space-y-5">
              <div><label className="block text-[10px] text-slate-400 mb-2 uppercase font-label tracking-widest font-bold">Store Name</label><input required autoFocus type="text" value={newShop.store_name} onChange={e => setNewShop({...newShop, store_name: e.target.value})} className="w-full bg-[#050505] border border-white/10 p-4 rounded-xl text-white font-label text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="e.g. Mobile Hub" /></div>
              <div><label className="block text-[10px] text-slate-400 mb-2 uppercase font-label tracking-widest font-bold">Location</label><input required type="text" value={newShop.location} onChange={e => setNewShop({...newShop, location: e.target.value})} className="w-full bg-[#050505] border border-white/10 p-4 rounded-xl text-white font-label text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="e.g. Main Market" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] text-slate-400 mb-2 uppercase font-label tracking-widest font-bold">Phone</label><input type="tel" value={newShop.phone} onChange={e => setNewShop({...newShop, phone: e.target.value})} className="w-full bg-[#050505] border border-white/10 p-4 rounded-xl text-white font-label text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="9922..." /></div>
                <div><label className="block text-[10px] text-slate-400 mb-2 uppercase font-label tracking-widest font-bold">Email</label><input type="email" value={newShop.email} onChange={e => setNewShop({...newShop, email: e.target.value})} className="w-full bg-[#050505] border border-white/10 p-4 rounded-xl text-white font-label text-sm outline-none focus:border-emerald-500 transition-colors" placeholder="shop@email.com" /></div>
              </div>
              <div className="flex gap-4 pt-4 border-t border-white/10 mt-8">
                <button type="button" onClick={() => setIsAddingRetailer(false)} className="flex-1 text-slate-500 text-[10px] font-label font-bold uppercase tracking-widest py-4 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="flex-[2] bg-emerald-500 hover:bg-emerald-400 text-black py-4 rounded-xl font-label font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">Save Shop</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ORDER MODAL (THE PUNCH INTERFACE) */}
      {isCreatingOrder && !isAddingRetailer && (
        <div className="fixed inset-0 bg-[#0c0e10]/95 z-50 overflow-y-auto backdrop-blur-2xl">
          <div className="max-w-[800px] mx-auto p-4 pt-8 md:p-8">
            
            <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-6 sticky top-0 bg-[#0c0e10]/90 backdrop-blur-md z-10 pt-4">
              <h2 className="text-3xl font-black font-headline uppercase tracking-tighter text-[#a1faff]">New Punch</h2>
              <button onClick={() => setIsCreatingOrder(false)} className="text-slate-400 hover:text-white text-[10px] font-label font-bold uppercase tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 rounded-full transition-all">Cancel</button>
            </div>
            
            <form onSubmit={submitMobileOrder} className="space-y-8 pb-40">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-6 rounded-3xl">
                  <div className="flex justify-between items-end mb-4">
                    <label className="block text-[10px] text-slate-400 uppercase font-label font-black tracking-widest">Client Account</label>
                    <button type="button" onClick={() => setIsAddingRetailer(true)} className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg font-label font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-colors">+ New Shop</button>
                  </div>
                  <select required value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-[#050505] text-white p-4 rounded-xl font-label text-sm outline-none border border-white/10 focus:border-[#a1faff] transition-colors">
                    <option value="" className="text-slate-600">Select Registered Shop...</option>
                    {retailers.map(r => <option key={r.id} value={r.store_name}>{r.store_name}</option>)}
                  </select>
                </div>

                <div className="glass-card p-6 rounded-3xl">
                  <label className="block text-[10px] text-slate-400 mb-4 uppercase font-label font-black tracking-widest">Pricing Tier Definition</label>
                  <select value={salesChannel} onChange={e => setSalesChannel(e.target.value)} className="w-full bg-[#050505] text-white p-4 rounded-xl font-label text-sm outline-none border border-white/10 focus:border-[#a1faff] transition-colors">
                    <option value="Retailer">Retailer (Standard Volume)</option>
                    <option value="Distributor">Distributor (High Volume)</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 mt-8 border-t border-white/5">
                <p className="text-[10px] text-[#a1faff] mb-6 uppercase font-label font-black tracking-widest pl-2">Line Items</p>
                
                {cart.map((item, index) => (
                  <div key={index} className="glass-card p-6 rounded-3xl mb-4 relative shadow-lg border-l-4 border-l-[#a1faff]/50">
                    <select required value={item.productId} onChange={e => updateCartItem(index, 'productId', e.target.value)} className="w-full bg-[#050505] text-white p-4 rounded-xl font-label text-sm outline-none mb-5 border border-white/10 focus:border-[#a1faff] transition-colors">
                      <option value="" className="text-slate-600">Choose SKU...</option>
                      {products.map(p => (<option key={p.id} value={p.id} disabled={p.stock <= 0}>{p.name} {p.stock <= 0 ? '(OUT OF STOCK)' : `(Stock: ${p.stock})`}</option>))}
                    </select>
                    
                    <div className="flex justify-between items-center bg-[#050505] p-3 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-4 pl-3">
                        <label className="text-[10px] text-slate-500 font-label font-bold uppercase tracking-widest">Qty</label>
                        <input type="number" min="1" value={item.quantity} onChange={e => updateCartItem(index, 'quantity', e.target.value)} className="w-20 bg-[#111] border border-white/10 py-2.5 px-2 rounded-xl text-center text-white font-headline text-lg outline-none focus:border-[#a1faff] transition-colors" />
                      </div>
                      <button type="button" onClick={() => removeItem(index)} className="text-[10px] text-[#ff716c] font-label font-bold uppercase tracking-widest bg-[#ff716c]/10 border border-[#ff716c]/20 px-5 py-3 rounded-xl active:scale-95 transition-all hover:bg-[#ff716c]/20">Drop</button>
                    </div>
                  </div>
                ))}
                
                <button type="button" onClick={handleAddItem} className="w-full border-2 border-dashed border-white/10 hover:border-[#a1faff]/50 bg-white/5 hover:bg-[#a1faff]/5 text-slate-400 hover:text-[#a1faff] py-6 rounded-3xl text-[10px] font-label font-black uppercase tracking-[0.2em] mb-10 transition-all">
                  + Add Line Item
                </button>
              </div>

              {/* STICKY BOTTOM TOTAL BAR */}
              <div className="fixed bottom-0 left-0 w-full bg-[#0c0e10]/95 backdrop-blur-xl border-t border-[#a1faff]/10 p-5 md:p-6 pb-8 flex justify-between items-center z-40 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
                <div className="pl-4 md:pl-12">
                  <p className="text-[10px] text-[#a1faff]/70 uppercase font-label font-bold tracking-[0.3em] mb-1">Invoice Total</p>
                  <p className="text-3xl md:text-4xl font-headline text-white font-black tracking-tighter">₹{calculateTotal().toLocaleString()}</p>
                </div>
                <div className="pr-4 md:pr-12">
                  <button type="submit" className="bg-gradient-to-r from-[#a1faff] to-[#00f4fe] text-[#002222] px-10 py-4 md:py-5 rounded-2xl font-label font-black uppercase tracking-[0.2em] text-[10px] md:text-xs shadow-[0_0_30px_rgba(0,242,255,0.3)] active:scale-95 hover:scale-[1.02] transition-all">
                    Execute Punch
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COLLECT PAYMENT MODAL */}
      {isPaymentModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center sm:items-center sm:p-6 z-[95] backdrop-blur-md">
          <div className="glass-modal border-emerald-500/20 p-8 rounded-t-3xl sm:rounded-3xl w-full max-w-sm shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-slide-up">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <h2 className="text-xl font-headline font-black text-emerald-400 uppercase tracking-tighter">Receive Funds</h2>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-500 hover:text-white text-2xl leading-none active:scale-90 transition-transform">×</button>
            </div>
            
            <form onSubmit={handleLogPayment} className="space-y-6">
              <div>
                <label className="block text-[10px] text-slate-400 mb-3 uppercase font-label font-black tracking-widest text-center">Collection Amount (₹)</label>
                <input type="number" autoFocus required min="1" max={Number(selectedOrder.total_amount) - Number(selectedOrder.amount_paid || 0)} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full bg-[#050505] border border-emerald-500/30 py-6 px-4 rounded-2xl text-emerald-400 text-4xl font-headline font-black outline-none focus:border-emerald-400 text-center transition-colors shadow-inner" />
                <p className="text-[10px] text-slate-500 mt-4 font-label uppercase tracking-widest text-center">Remaining Balance: <span className="text-white font-bold">₹{(Number(selectedOrder.total_amount) - Number(selectedOrder.amount_paid || 0)).toLocaleString()}</span></p>
              </div>
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-5 rounded-2xl font-label font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] mt-2">
                Log Ledger Entry
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}