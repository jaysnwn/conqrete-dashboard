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

      // FIX 1: Use .maybeSingle() to prevent crash if email is missing in table
      const { data: rep, error: repError } = await supabase
        .from("employees")
        .select("*")
        .eq("work_email", userEmail)
        .maybeSingle();

      if (repError) console.error("Database Query Error:", repError);

      // FIX 2: Check if role exists and match variations of "salesman"
      const isSalesRole = rep?.role?.toLowerCase() === 'salesman' || rep?.role?.toLowerCase() === 'sales';

      if (rep && isSalesRole) {
        console.log("Successfully logged in as Rep:", rep.name);
        await loginAsRep(rep);
      } else {
        console.warn("User is not a salesman or missing from employees table. Showing override list.");
        const { data } = await supabase
          .from("employees")
          .select("*")
          .in("role", ["salesman", "sales", "Salesman"])
          .order("name", { ascending: true });
          
        setSalesmen(data || []);
      }
    } catch (err) {
      console.error("Critical error in FieldPortal:", err);
    } finally {
      // FIX 3: Always turn off loading so the page isn't blank
      setIsLoading(false);
    }
  };

  const loginAsRep = async (rep) => {
    setCurrentRep(rep);
    
    // Fetch related data for this specific salesman
    const [prodRes, retRes, ordRes] = await Promise.all([
      supabase.from("products").select("*").order("name", { ascending: true }),
      supabase.from("retailers").select("*").order("store_name", { ascending: true }),
      supabase.from("orders").select("*").eq("sales_rep", rep.name).order("created_at", { ascending: false })
    ]);

    setProducts(prodRes.data || []);
    setRetailers(retRes.data || []);
    setMyOrders(ordRes.data || []);
  };

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    router.push("/login"); 
  };

  // ... (Rest of your handler functions: handleLogExpense, handleAddNewShop, etc. stay exactly the same)

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
          const { data: product } = await supabase.from("products").select("stock").eq("id", item.product_id).maybeSingle();
          
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

  // LOADING STATE RENDER
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-[#a1faff] animate-pulse font-mono tracking-widest uppercase text-sm">
          SYNCHRONIZING SECURE LINK...
        </div>
      </div>
    );
  }

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
                <span className="font-bold text-white uppercase font-headline tracking-wide">{rep.name}</span>
                <span className="text-[10px] text-slate-500 font-label tracking-widest uppercase group-hover:text-[#a1faff] transition-colors">Initialize →</span>
              </button>
            ))}
            {salesmen.length === 0 && <p className="text-center text-xs text-slate-500 uppercase">No salesmen records found.</p>}
          </div>
        </div>
      </div>
    );
  }

  // MAIN FIELD PORTAL RENDER
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

      {/* MODALS (EXPENSE, CATALOG, SHOP, ORDER, PAYMENT) */}
      {/* (These remain same as in your original file but now work because loading/rep data is solid) */}
      {/* ... */}
    </div>
  );
}