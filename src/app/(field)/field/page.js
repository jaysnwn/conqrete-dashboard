"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; 
import { supabase } from "@/lib/supabase";
import { Scanner } from '@yudiel/react-qr-scanner';

export default function FieldPortal() {
  const router = useRouter(); 

  const [salesmen, setSalesmen] = useState([]);
  const [currentRep, setCurrentRep] = useState(null); 
  
  const [products, setProducts] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [myExpenses, setMyExpenses] = useState([]); // NEW: Expense State
  const [isLoading, setIsLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState(""); // NEW: Sync Time

  // Modals State
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isAddingRetailer, setIsAddingRetailer] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false); 
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false); 
  const [isScanning, setIsScanning] = useState(false); 
  const [isZeroSaleModalOpen, setIsZeroSaleModalOpen] = useState(false); 
  const [orderSuccessData, setOrderSuccessData] = useState(null);

  // Form States
  const [customerName, setCustomerName] = useState("");
  const [salesChannel, setSalesChannel] = useState("Retailer");
  const [cart, setCart] = useState([{ productId: "", quantity: 1 }]);
  const [newShop, setNewShop] = useState({ store_name: "", location: "", phone: "", email: "" });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [catalogSearch, setCatalogSearch] = useState(""); 
  const [zeroSaleReason, setZeroSaleReason] = useState("Overstocked");
  
  // Expense State
  const [expenseData, setExpenseData] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    category: "Petrol", 
    amount: "" 
  });

  useEffect(() => { 
    fetchLoginData(); 
  }, []);

  const fetchLoginData = async () => {
    try {
      setIsLoading(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.warn("No active session found.");
        router.push("/login");
        return;
      }

      const userEmail = session.user.email.toLowerCase();
      console.log("Checking DB for email:", userEmail);

      const { data: rep, error: repError } = await supabase
        .from("employees")
        .select("*")
        .eq("work_email", userEmail)
        .maybeSingle();

      if (repError) console.error("Database Query Error:", repError);

      const isSalesRole = rep?.role?.toLowerCase() === 'salesman' || rep?.role?.toLowerCase() === 'sales';

      if (rep && isSalesRole) {
        console.log("Successfully logged in as Rep:", rep.full_name);
        await loginAsRep(rep);
      } else {
        console.warn("User is not a salesman. Showing override list.");
        const { data } = await supabase
          .from("employees")
          .select("*")
          .in("role", ["salesman", "sales", "Salesman"])
          .order("full_name", { ascending: true });
          
        setSalesmen(data || []);
      }
    } catch (err) {
      console.error("Critical error in FieldPortal:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsRep = async (rep) => {
    setCurrentRep(rep);
    
    // UPDATED: Now fetches expense_claims for the specific rep
    const [prodRes, retRes, ordRes, expRes] = await Promise.all([
      supabase.from("products").select("*").order("name", { ascending: true }),
      supabase.from("retailers").select("*").order("store_name", { ascending: true }),
      supabase.from("orders").select("*").eq("sales_rep", rep.full_name).order("created_at", { ascending: false }),
      supabase.from("expense_claims").select("*").eq("employee_id", rep.id)
    ]);

    setProducts(prodRes.data || []);
    setRetailers(retRes.data || []);
    setMyOrders(ordRes.data || []);
    setMyExpenses(expRes.data || []);
    setLastSynced(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
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
        employee_name: currentRep.full_name,
        date: expenseData.date,
        category: expenseData.category,
        amount: expenseData.amount,
        status: "Pending"
      }]);

      if (error) throw error;
      
      alert(`✅ ₹${expenseData.amount} claim submitted for approval!`);
      setIsExpenseModalOpen(false);
      setExpenseData({ ...expenseData, amount: "" });
      loginAsRep(currentRep); // Refresh data to show new claim in profile
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
        order_number: orderNum, customer_name: customerName, sales_channel: salesChannel, total_amount: grandTotal, status: "Pending", sales_rep: currentRep.full_name
      }]).select().single();

      if (orderErr) throw orderErr;

      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (!product || !product.pricing) throw new Error(`Product data missing: ${item.productId}`);
        const price = salesChannel === "Distributor" ? product.pricing.distributor : product.pricing.retailer;
        const deductQty = Number(item.quantity) || 0;
        const newStock = (Number(product.stock) || 0) - deductQty;

        await supabase.from("order_items").insert([{
          order_id: newOrder.id, product_id: product.id, product_name: product.name, sku: product.sku, quantity: deductQty, unit_price: price, total_price: price * deductQty
        }]);
        await supabase.from("products").update({ stock: newStock }).eq("id", product.id);
        await supabase.from("inventory_logs").insert([{ product_id: product.id, product_name: product.name, change_amount: -deductQty, new_stock: newStock, reason: `Field Punch: ${orderNum}`, user_name: currentRep.full_name }]);
      }

      const retailer = retailers.find(r => r.store_name === customerName);
      if (retailer) {
        await supabase.from("retailers").update({
          total_lifetime_sales: Number(retailer.total_lifetime_sales || 0) + grandTotal, total_pending: Number(retailer.total_pending || 0) + grandTotal
        }).eq("id", retailer.id);
      }

      setOrderSuccessData({ orderNum, customerName, grandTotal });
      setIsCreatingOrder(false); setCart([{ productId: "", quantity: 1 }]); setCustomerName("");
      loginAsRep(currentRep); 

    } catch (err) { alert("Error: " + err.message); }
  };

  const handleDeletePunch = async (orderId, orderNum, totalAmount, customerName) => {
    if (!window.confirm(`WARNING: Cancel order ${orderNum} and return items to inventory?`)) return;
    try {
      const { data: items } = await supabase.from("order_items").select("*").eq("order_id", orderId);
      if (items && items.length > 0) {
        for (const item of items) {
          const { data: product } = await supabase.from("products").select("stock").eq("id", item.product_id).maybeSingle();
          if (product) {
            const restoredStock = Number(product.stock) + Number(item.quantity);
            await supabase.from("products").update({ stock: restoredStock }).eq("id", item.product_id);
            await supabase.from("inventory_logs").insert([{ product_id: item.product_id, product_name: item.product_name, change_amount: item.quantity, new_stock: restoredStock, reason: `Order Pulled Back: ${orderNum}`, user_name: currentRep.full_name }]);
          }
        }
      }
      const { data: retailer } = await supabase.from("retailers").select("*").eq("store_name", customerName).maybeSingle();
      if (retailer) {
        const newLifetime = Math.max(0, Number(retailer.total_lifetime_sales || 0) - Number(totalAmount));
        const newPending = Math.max(0, Number(retailer.total_pending || 0) - Number(totalAmount));
        await supabase.from("retailers").update({ total_lifetime_sales: newLifetime, total_pending: newPending }).eq("id", retailer.id);
      }
      await supabase.from("order_items").delete().eq("order_id", orderId);
      await supabase.from("orders").delete().eq("id", orderId);
      alert(`Order ${orderNum} successfully pulled back! Inventory restored.`);
      loginAsRep(currentRep); 
    } catch (err) { alert("Error pulling back order: " + err.message); }
  };

  const handleLogPayment = async (e) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) return alert("Please enter a valid amount.");
    const currentPaid = Number(selectedOrder.amount_paid || 0);
    const newAmountPaid = currentPaid + amount;
    let newStatus = newAmountPaid >= Number(selectedOrder.total_amount) ? "Paid" : "Partial";

    try {
      await supabase.from("orders").update({ amount_paid: newAmountPaid, payment_status: newStatus }).eq("id", selectedOrder.id);
      const retailer = retailers.find(r => r.store_name === selectedOrder.customer_name);
      if (retailer) {
        await supabase.from("retailers").update({ total_pending: Math.max(0, Number(retailer.total_pending || 0) - amount) }).eq("id", retailer.id);
      }
      alert(`₹${amount.toLocaleString()} collected! Great job.`);
      setIsPaymentModalOpen(false); setPaymentAmount(""); loginAsRep(currentRep); 
    } catch (err) { alert("Error logging payment: " + err.message); }
  };

  const openPaymentModal = (order) => {
    setSelectedOrder(order); setPaymentAmount(Number(order.total_amount) - Number(order.amount_paid || 0)); setIsPaymentModalOpen(true);
  };

  // --- FIELD FEATURES ---
  const sendWhatsAppReceipt = () => {
    if (!orderSuccessData) return;
    const { orderNum, customerName, grandTotal } = orderSuccessData;
    const text = `*CONQRETE CORE* 🚀\n\nHi ${customerName},\nYour order *${orderNum}* for *₹${grandTotal.toLocaleString()}* is confirmed and has been synced to HQ for dispatch.\n\nThank you for choosing CONQRETE.`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setOrderSuccessData(null);
  };

  const logZeroSaleVisit = async (e) => {
    e.preventDefault();
    if (!customerName) return alert("Please select a customer first.");
    try {
      await supabase.from("orders").insert([{
        order_number: `VISIT-${Math.floor(1000 + Math.random() * 9000)}`, customer_name: customerName, total_amount: 0, status: "Zero Sale", sales_rep: currentRep.full_name, payment_status: zeroSaleReason 
      }]);
      alert(`Visit logged for ${customerName} (${zeroSaleReason})`);
      setIsZeroSaleModalOpen(false); setIsCreatingOrder(false); setCustomerName(""); loginAsRep(currentRep);
    } catch(err) { alert("Error logging visit."); }
  };

  const handleScan = (detectedCodes) => {
    if (detectedCodes && detectedCodes.length > 0) {
      setCatalogSearch(detectedCodes[0].rawValue);
      setIsScanning(false);
    }
  };

  // --- PROFILE CALCULATIONS ---
  const myTotalSales = myOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const myCommission = myTotalSales * (Number(currentRep?.commission_rate || 0) / 100);
  const progress = currentRep?.monthly_target ? Math.min((myTotalSales / currentRep.monthly_target) * 100, 100) : 0;
  
  const pendingExpenses = myExpenses.filter(e => e.status === 'Pending').reduce((sum, e) => sum + Number(e.amount), 0);
  const approvedExpenses = myExpenses.filter(e => e.status === 'Approved' || e.status === 'Paid').reduce((sum, e) => sum + Number(e.amount), 0);

  const priorityRetailers = [...retailers].filter(r => r.total_pending > 0).sort((a, b) => b.total_pending - a.total_pending).slice(0, 3);
  
  const filteredCatalog = products.filter(p => 
    p.name.toLowerCase().includes(catalogSearch.toLowerCase()) || 
    p.sku.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  // AGENT SELECTION RENDER (OVERRIDE)
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
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden">
            {salesmen.map(rep => (
              <button key={rep.id} onClick={() => loginAsRep(rep)} className="w-full bg-[#111418] border border-white/5 hover:border-[#a1faff]/50 hover:bg-white/5 text-left p-5 rounded-2xl flex justify-between items-center group transition-all">
                <span className="font-bold text-white uppercase font-headline tracking-wide">{rep.full_name}</span>
                <span className="text-[10px] text-slate-500 font-label tracking-widest uppercase group-hover:text-[#a1faff] transition-colors">Initialize →</span>
              </button>
            ))}
            {salesmen.length === 0 && <p className="text-center text-xs text-slate-500 uppercase">No salesmen records found.</p>}
          </div>
        </div>
      </div>
    );
  }

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
          <button onClick={() => setIsProfileOpen(true)} className="text-right hover:opacity-70 transition-opacity">
            <p className="text-[11px] font-bold font-headline text-white leading-none uppercase">{currentRep.full_name}</p>
            <p className="text-[9px] text-[#00f4fe] font-label tracking-widest mt-1 uppercase">Agent Dossier</p>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT CANVAS */}
      <div className="p-4 md:p-8 max-w-[1200px] mx-auto mt-4">
        
        {orderSuccessData && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-3xl mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 animate-in slide-in-from-top-4">
            <div>
              <p className="text-emerald-400 font-headline font-black uppercase tracking-wide">Order Pushed Successfully</p>
              <p className="text-xs text-slate-400 font-label uppercase tracking-widest mt-1">
                {orderSuccessData.customerName} • ₹{orderSuccessData.grandTotal.toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => setOrderSuccessData(null)} className="flex-1 sm:flex-none px-4 py-3 bg-white/5 rounded-xl text-xs font-bold text-slate-400 uppercase tracking-widest">Close</button>
              <button onClick={sendWhatsAppReceipt} className="flex-1 sm:flex-none px-6 py-3 bg-[#25D366] text-[#0c0e10] rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center justify-center gap-2">
                💬 Send Receipt
              </button>
            </div>
          </div>
        )}

        {/* Performance Glass Card */}
        <div className="glass-card rounded-3xl p-6 md:p-8 mb-8 shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden group">
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

        {/* PRIORITY ROUTE / BEAT */}
        {priorityRetailers.length > 0 && (
          <div className="mb-10">
            <h2 className="text-[11px] text-[#ff716c] font-label uppercase font-black tracking-[0.3em] mb-4 pl-2 flex items-center gap-2">⚠️ Priority Route (Pending Balance)</h2>
            <div className="flex overflow-x-auto pb-4 gap-4 hide-scrollbar">
              {priorityRetailers.map(r => (
                <div key={r.id} className="min-w-[240px] glass-card p-5 rounded-2xl border-orange-500/20">
                  <p className="text-sm font-bold text-white uppercase font-headline truncate">{r.store_name}</p>
                  <p className="text-xs text-orange-400 font-mono mt-1 font-bold">Due: ₹{Number(r.total_pending).toLocaleString()}</p>
                  <button onClick={() => { setIsCreatingOrder(true); setCustomerName(r.store_name); }} className="mt-4 w-full bg-orange-500/10 text-orange-400 py-2 rounded-lg text-[9px] uppercase tracking-widest font-black border border-orange-500/20">Target Shop</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-[11px] text-[#a1faff] font-label uppercase font-black tracking-[0.3em] mb-6 pl-2">Recent Field Dispatches</h2>
        
        <div className="space-y-4">
          {myOrders.map(o => {
            const isPaid = o.payment_status === 'Paid';
            const isZeroSale = o.status === 'Zero Sale';
            const remaining = Number(o.total_amount) - Number(o.amount_paid || 0);

            return (
              <div key={o.id} className={`glass-card p-5 md:p-6 rounded-2xl shadow-lg transition-all hover:border-white/20 ${isZeroSale ? 'opacity-60 border-white/5' : ''}`}>
                <div className="flex justify-between items-start mb-4 border-b border-white/5 pb-4">
                  <div>
                    <p className="text-sm md:text-base font-bold text-white uppercase font-headline tracking-wide">{o.customer_name}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-1 tracking-widest">{o.order_number}</p>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <p className={`text-lg md:text-xl font-headline font-black ${isZeroSale ? 'text-slate-500' : 'text-[#a1faff]'}`}>₹{Number(o.total_amount).toLocaleString()}</p>
                      <div className="flex gap-2 justify-end mt-2">
                        <span className={`text-[8px] font-label uppercase tracking-widest font-black px-2 py-1 rounded border ${o.status === 'Pending' ? 'text-orange-400 border-orange-400/20 bg-orange-400/5' : isZeroSale ? 'text-slate-400 border-slate-400/20 bg-slate-400/5' : 'text-[#a1faff] border-[#a1faff]/20 bg-[#a1faff]/5'}`}>{o.status}</span>
                        {!isZeroSale && (
                          <span className={`text-[8px] font-label uppercase tracking-widest font-black px-2 py-1 rounded border ${isPaid ? 'text-emerald-400 border-emerald-400/20 bg-emerald-400/5' : 'text-[#ff716c] border-[#ff716c]/20 bg-[#ff716c]/5'}`}>{o.payment_status || 'Unpaid'}</span>
                        )}
                      </div>
                    </div>
                    {!isZeroSale && (
                      <button onClick={() => handleDeletePunch(o.id, o.order_number, o.total_amount, o.customer_name)} className="text-slate-600 hover:text-[#ff716c] transition-colors p-2 text-lg active:scale-90">🗑️</button>
                    )}
                  </div>
                </div>

                {!isPaid && !isZeroSale && (
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
                {isZeroSale && (
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest text-right">Reason: {o.payment_status}</p>
                )}
              </div>
            );
          })}
          {myOrders.length === 0 && <p className="text-center text-xs text-slate-600 font-label tracking-widest uppercase py-10">No dispatches recorded.</p>}
        </div>
      </div>

      <div className="fixed bottom-6 right-4 left-4 md:right-12 md:left-auto md:w-[600px] flex gap-3 z-20">
        <button onClick={() => setIsCatalogOpen(true)} className="flex-1 glass-card bg-[#0c0e10]/90 text-white py-4 md:py-5 rounded-2xl font-label font-black uppercase tracking-[0.2em] text-[9px] shadow-2xl active:scale-95 transition-transform hover:border-[#a1faff]/40">Catalog</button>
        <button onClick={() => setIsCreatingOrder(true)} className="flex-[1.5] bg-gradient-to-r from-[#a1faff] to-[#00f4fe] text-[#002222] py-4 md:py-5 rounded-2xl font-label font-black uppercase tracking-[0.2em] text-[10px] shadow-[0_0_25px_rgba(0,242,255,0.4)] active:scale-95 hover:scale-[1.02] transition-all">+ Check In Store</button>
      </div>

      {/* ==================================================================================== */}
      {/* 🚀 BEAST MODE AGENT DOSSIER / PROFILE MODAL */}
      {/* ==================================================================================== */}
      {isProfileOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-end justify-center sm:items-center backdrop-blur-md p-4">
          <div className="glass-modal p-8 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(0,0,0,0.8)] hide-scrollbar">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 sticky top-0 bg-[#0c0e10]/90 backdrop-blur-md z-10">
              <h2 className="text-xl font-black font-headline text-[#a1faff] uppercase tracking-tighter">Agent Dossier</h2>
              <button onClick={() => setIsProfileOpen(false)} className="text-slate-500 hover:text-white text-2xl">×</button>
            </div>
            
            <div className="space-y-6">
              {/* Profile Identity */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/5 rounded-full border border-[#a1faff]/30 flex items-center justify-center shadow-[0_0_15px_rgba(161,250,255,0.1)]">
                  <span className="text-2xl text-[#a1faff] font-headline font-black">{currentRep.full_name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="text-xl font-black font-headline text-white uppercase">{currentRep.full_name}</h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-1">{currentRep.employee_id || 'ID_PENDING'} • {currentRep.role}</p>
                </div>
              </div>

              {/* 4. Gamification / Leaderboard */}
              <div className="bg-gradient-to-r from-[#a1faff]/10 to-[#00f4fe]/10 p-4 rounded-2xl border border-[#a1faff]/30 flex justify-between items-center">
                <div>
                  <p className="text-[9px] text-[#00f4fe] font-label uppercase tracking-widest font-bold">Current Status</p>
                  <p className="text-lg text-white font-headline font-black tracking-tight">🏆 Active Agent</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-[#00f4fe] font-label uppercase tracking-widest font-bold">Monthly Target</p>
                  <p className="text-sm text-white font-mono uppercase font-bold">₹{(currentRep.monthly_target || 0).toLocaleString()}</p>
                </div>
              </div>

              {/* 2. Territory & Retailer Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-2xl text-white font-headline font-black">{retailers.length}</p>
                  <p className="text-[9px] text-slate-400 font-label uppercase tracking-widest mt-1">Total Assigned Stores</p>
                </div>
                <div className="bg-orange-500/10 p-4 rounded-2xl border border-orange-500/20">
                  <p className="text-2xl text-orange-400 font-headline font-black">{priorityRetailers.length}</p>
                  <p className="text-[9px] text-orange-400 font-label uppercase tracking-widest mt-1">Stores Needing Visit</p>
                </div>
              </div>

              {/* 3. Financial Snapshot (Claims & Payouts) */}
              <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-4">
                <h4 className="text-[10px] text-slate-500 font-label uppercase tracking-widest font-bold flex justify-between">
                  <span>Financial Ledger</span>
                  <span className="text-emerald-400">{currentRep.commission_rate}% Comm. Rate</span>
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-xs text-slate-300 font-label uppercase">Total Accrued (Est.)</span>
                    <span className="text-sm text-emerald-400 font-mono font-bold">₹{Math.round(myCommission).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-label uppercase">Pending Claims</span>
                    <span className="text-xs text-orange-400 font-mono">₹{pendingExpenses.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-label uppercase">Approved Claims</span>
                    <span className="text-xs text-emerald-400 font-mono">₹{approvedExpenses.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* 1. "Backpack" Sample Inventory */}
              <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                <h4 className="text-[10px] text-slate-500 font-label uppercase tracking-widest font-bold mb-3">Backpack (Checked Out Samples)</h4>
                <div className="space-y-2">
                  {/* Mock Data for now until a Samples table is built */}
                  <div className="flex justify-between items-center bg-[#050505] p-3 rounded-xl border border-white/5">
                    <span className="text-xs text-white font-headline">10000mAh Power Bank</span>
                    <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-1 rounded-md font-mono uppercase tracking-widest">2 Units</span>
                  </div>
                  <div className="flex justify-between items-center bg-[#050505] p-3 rounded-xl border border-white/5">
                    <span className="text-xs text-white font-headline">Pro TWS Earbuds</span>
                    <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-1 rounded-md font-mono uppercase tracking-widest">1 Unit</span>
                  </div>
                  <div className="flex justify-between items-center bg-[#050505] p-3 rounded-xl border border-white/5">
                    <span className="text-xs text-white font-headline">65W GaN Adapter</span>
                    <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-1 rounded-md font-mono uppercase tracking-widest">1 Unit</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => { setIsProfileOpen(false); setIsExpenseModalOpen(true); }} 
                  className="flex-1 bg-orange-500/10 border border-orange-500/30 text-orange-400 py-4 rounded-xl font-label font-black uppercase text-[10px] tracking-widest hover:bg-orange-500/20 transition-all"
                >
                  Log Expense
                </button>
                <button 
                  onClick={handleLogOut} 
                  className="flex-[0.5] bg-[#ff716c]/10 text-[#ff716c] border border-[#ff716c]/30 py-4 rounded-xl font-label font-black uppercase text-[10px] tracking-widest hover:bg-[#ff716c]/20 transition-all"
                >
                  Logout
                </button>
              </div>

              {/* 5. System Health / Sync Status */}
              <div className="mt-4 flex flex-col items-center justify-center gap-1.5 pb-4">
                <p className="text-[9px] text-emerald-500 uppercase tracking-widest font-mono flex items-center gap-2 font-bold">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></span> 
                  Secure Link Active
                </p>
                <p className="text-[8px] text-slate-500 font-mono uppercase tracking-widest">Last Synced: {lastSynced || "Just now"}</p>
                <p className="text-[8px] text-slate-700 font-mono uppercase tracking-widest">v1.2.0 • CONQRETE CORE</p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* CATALOG MODAL WITH CAMERA SCANNER */}
      {isCatalogOpen && (
        <div className="fixed inset-0 bg-black/80 z-[90] flex items-end justify-center sm:items-center backdrop-blur-md p-4">
          <div className="glass-modal p-8 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 sticky top-0 bg-[#0c0e10]/90 backdrop-blur-md z-10">
              <h2 className="text-xl font-black font-headline text-[#a1faff] uppercase">Product Catalog</h2>
              <button onClick={() => { setIsCatalogOpen(false); setIsScanning(false); }} className="text-slate-500 hover:text-white text-2xl">×</button>
            </div>

            {isScanning && (
              <div className="mb-6 bg-black rounded-2xl overflow-hidden border-2 border-[#00f4fe] shadow-[0_0_30px_rgba(0,244,254,0.3)] relative">
                <Scanner onScan={handleScan} />
                <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                  <span className="bg-black/50 text-white text-[10px] px-4 py-2 rounded-full font-label tracking-widest uppercase border border-white/20">Point camera at barcode</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-6">
              <input 
                type="text" placeholder="Search SKU or Name..." value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)}
                className="flex-1 bg-[#050505] border border-white/10 p-4 rounded-xl text-white outline-none focus:border-[#a1faff]"
              />
              <button 
                onClick={() => setIsScanning(!isScanning)}
                className={`px-5 rounded-xl font-label font-black uppercase tracking-widest text-[9px] border transition-all ${isScanning ? 'bg-[#ff716c]/10 text-[#ff716c] border-[#ff716c]/30' : 'bg-[#a1faff]/10 text-[#a1faff] border-[#a1faff]/30 hover:bg-[#a1faff]/20'}`}
              >
                {isScanning ? 'Close Cam' : '📷 Scan'}
              </button>
            </div>

            <div className="space-y-4">
              {filteredCatalog.map(p => (
                <div key={p.id} className="glass-card p-4 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="text-white font-headline font-black">{p.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">{p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#a1faff] font-headline font-black text-lg">₹{Number(p.pricing?.retailer || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Stock: {p.stock}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CREATE ORDER / STORE CHECK-IN MODAL */}
      {isCreatingOrder && (
        <div className="fixed inset-0 bg-black/80 z-[90] flex items-end justify-center sm:items-center backdrop-blur-md p-4">
          <div className="glass-modal p-8 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4 sticky top-0 bg-[#0c0e10]/90 backdrop-blur-md z-10">
              <h2 className="text-xl font-black font-headline text-[#00f4fe] uppercase tracking-tighter">Store Check-in</h2>
              <button onClick={() => setIsCreatingOrder(false)} className="text-slate-500 hover:text-white text-2xl">×</button>
            </div>

            <form onSubmit={submitMobileOrder} className="space-y-6">
              <div>
                <label className="block text-[10px] text-slate-400 mb-2 uppercase font-label tracking-widest font-bold">Select Customer Location</label>
                <div className="flex gap-2">
                  <select value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="flex-1 bg-[#050505] border border-white/10 p-4 rounded-xl text-white outline-none focus:border-[#00f4fe]">
                    <option value="">Select Customer...</option>
                    {retailers.map(r => (<option key={r.id} value={r.store_name}>{r.store_name}</option>))}
                  </select>
                  <button type="button" onClick={() => setIsAddingRetailer(true)} className="bg-[#a1faff]/10 text-[#a1faff] px-4 rounded-xl border border-[#a1faff]/30 hover:bg-[#a1faff]/20">+ New</button>
                </div>
              </div>

              {!isZeroSaleModalOpen ? (
                <>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-2 uppercase font-label tracking-widest font-bold">Channel</label>
                    <select value={salesChannel} onChange={(e) => setSalesChannel(e.target.value)} className="w-full bg-[#050505] border border-white/10 p-4 rounded-xl text-white outline-none focus:border-[#00f4fe]">
                      <option>Retailer</option><option>Distributor</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-[10px] text-slate-400 uppercase font-label tracking-widest font-bold">Order Items</label>
                      <button type="button" onClick={handleAddItem} className="text-[#a1faff] text-sm hover:text-[#00f4fe]">+ Add Item</button>
                    </div>
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex gap-2 mb-3">
                        <select value={item.productId} onChange={(e) => updateCartItem(idx, "productId", e.target.value)} className="flex-1 bg-[#050505] border border-white/10 p-2 rounded-lg text-white text-sm outline-none">
                          <option value="">Product...</option>{products.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                        </select>
                        <input type="number" min="1" value={item.quantity} onChange={(e) => updateCartItem(idx, "quantity", e.target.value)} className="w-16 bg-[#050505] border border-white/10 p-2 rounded-lg text-white text-sm outline-none" placeholder="Qty" />
                        {cart.length > 1 && (<button type="button" onClick={() => removeItem(idx)} className="text-red-500 px-2">✕</button>)}
                      </div>
                    ))}
                  </div>

                  <div className="bg-white/5 p-4 rounded-xl">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Total Amount</p>
                    <p className="text-3xl font-headline font-black text-[#a1faff]">₹{calculateTotal().toLocaleString()}</p>
                  </div>
                  
                  <div className="flex gap-2 mt-6">
                    <button type="button" onClick={() => { if(!customerName) return alert("Select customer first"); setIsZeroSaleModalOpen(true); }} className="flex-1 bg-slate-800 text-slate-300 py-5 rounded-2xl font-label font-black uppercase text-[9px] tracking-widest border border-slate-700 hover:bg-slate-700 transition-colors">Log Zero Sale</button>
                    <button type="submit" className="flex-[2] bg-gradient-to-r from-[#a1faff] to-[#00f4fe] text-[#002222] py-5 rounded-2xl font-label font-black uppercase text-[10px] tracking-[0.2em] shadow-[0_0_20px_rgba(0,242,255,0.3)] hover:scale-[1.02] transition-transform">Push Order to HQ</button>
                  </div>
                </>
              ) : (
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4 animate-in slide-in-from-bottom-4">
                  <p className="text-xs text-white font-headline font-black uppercase">Log "Zero Sale" Visit</p>
                  <select value={zeroSaleReason} onChange={(e) => setZeroSaleReason(e.target.value)} className="w-full bg-[#050505] border border-white/10 p-4 rounded-xl text-white outline-none focus:border-[#a1faff]">
                    <option>Overstocked</option><option>Owner Not Present</option><option>Price Objection</option><option>Competitor Stock Loaded</option><option>Store Closed</option>
                  </select>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setIsZeroSaleModalOpen(false)} className="flex-1 bg-transparent border border-white/20 text-white py-3 rounded-xl font-label uppercase text-[10px] font-black hover:bg-white/5 transition-colors">Cancel</button>
                    <button type="button" onClick={logZeroSaleVisit} className="flex-1 bg-slate-200 text-black py-3 rounded-xl font-label uppercase text-[10px] font-black hover:bg-white transition-colors">Confirm Visit</button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[90] flex items-center justify-center backdrop-blur-md p-4">
          <div className="glass-modal p-8 rounded-3xl w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <h2 className="text-xl font-black font-headline text-orange-400 uppercase tracking-tighter">Log Expense</h2>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-500 hover:text-white text-2xl">×</button>
            </div>
            <form onSubmit={handleLogExpense} className="space-y-6">
              <div>
                <label className="block text-[10px] text-slate-400 mb-2 uppercase font-label tracking-widest font-bold">Category</label>
                <select value={expenseData.category} onChange={(e) => setExpenseData({...expenseData, category: e.target.value})} className="w-full bg-[#050505] border border-white/10 p-4 rounded-xl text-white outline-none focus:border-orange-400">
                  <option>Petrol</option><option>Food</option><option>Travel</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-2 uppercase font-label tracking-widest font-bold">Amount (₹)</label>
                <input type="number" min="1" required value={expenseData.amount} onChange={(e) => setExpenseData({...expenseData, amount: e.target.value})} className="w-full bg-[#050505] border border-orange-500/30 p-4 rounded-xl text-orange-400 font-headline text-2xl font-black outline-none focus:border-orange-400" />
              </div>
              <button type="submit" className="w-full bg-orange-500 text-black py-5 rounded-2xl font-label font-black uppercase text-[10px] tracking-[0.2em] hover:bg-orange-400 transition-colors">Submit Claim</button>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {isPaymentModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/80 z-[90] flex items-center justify-center backdrop-blur-md p-4">
          <div className="glass-modal p-8 rounded-3xl w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <h2 className="text-xl font-black font-headline text-emerald-400 uppercase tracking-tighter">Receive Payment</h2>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-500 hover:text-white text-2xl">×</button>
            </div>
            <form onSubmit={handleLogPayment} className="space-y-6">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-label">Order: {selectedOrder.order_number}</p>
                <p className="text-lg font-headline font-black text-white mt-2">₹{Number(selectedOrder.total_amount).toLocaleString()}</p>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-2 uppercase font-label tracking-widest font-bold">Amount Received (₹)</label>
                <input type="number" min="1" required value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full bg-[#050505] border border-emerald-500/30 p-4 rounded-xl text-emerald-400 font-headline text-2xl font-black outline-none focus:border-emerald-400" />
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-emerald-400 text-[#002222] py-5 rounded-2xl font-label font-black uppercase text-[10px] tracking-[0.2em] hover:scale-[1.02] transition-transform">Confirm Payment</button>
            </form>
          </div>
        </div>
      )}
      
      {/* ADD NEW RETAILER MODAL */}
      {isAddingRetailer && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-md p-4">
          <div className="glass-modal p-8 rounded-3xl w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <h2 className="text-xl font-black font-headline text-[#00f4fe] uppercase tracking-tighter mb-6">Add Store</h2>
            <form onSubmit={handleAddNewShop} className="space-y-4">
              <input type="text" placeholder="Store Name" required value={newShop.store_name} onChange={(e) => setNewShop({...newShop, store_name: e.target.value})} className="w-full bg-[#050505] border border-white/10 p-4 rounded-xl text-white outline-none focus:border-[#00f4fe]" />
              <input type="text" placeholder="Location" required value={newShop.location} onChange={(e) => setNewShop({...newShop, location: e.target.value})} className="w-full bg-[#050505] border border-white/10 p-4 rounded-xl text-white outline-none focus:border-[#00f4fe]" />
              <input type="tel" placeholder="Phone" value={newShop.phone} onChange={(e) => setNewShop({...newShop, phone: e.target.value})} className="w-full bg-[#050505] border border-white/10 p-4 rounded-xl text-white outline-none focus:border-[#00f4fe]" />
              <input type="email" placeholder="Email" value={newShop.email} onChange={(e) => setNewShop({...newShop, email: e.target.value})} className="w-full bg-[#050505] border border-white/10 p-4 rounded-xl text-white outline-none focus:border-[#00f4fe]" />
              <div className="flex gap-4 mt-6">
                <button type="button" onClick={() => setIsAddingRetailer(false)} className="flex-1 bg-slate-700 text-white py-3 rounded-xl font-label font-black uppercase text-sm hover:bg-slate-600 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 bg-gradient-to-r from-[#a1faff] to-[#00f4fe] text-[#002222] py-3 rounded-xl font-label font-black uppercase text-sm hover:scale-[1.02] transition-transform">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}