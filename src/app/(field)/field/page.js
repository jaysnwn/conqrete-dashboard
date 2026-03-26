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
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false); // NEW

  // Form States
  const [customerName, setCustomerName] = useState("");
  const [salesChannel, setSalesChannel] = useState("Retailer");
  const [cart, setCart] = useState([{ productId: "", quantity: 1 }]);
  const [newShop, setNewShop] = useState({ store_name: "", location: "", phone: "", email: "" });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [catalogSearch, setCatalogSearch] = useState(""); 
  
  // NEW: Expense State
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
      .from("salesmen")
      .select("*")
      .eq("email", session.user.email.toLowerCase())
      .single();

    if (rep) {
      loginAsRep(rep);
    } else {
      const { data } = await supabase.from("salesmen").select("*").order("name", { ascending: true });
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

  // --- NEW: EXPENSE HANDLER ---
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

  if (!currentRep) {
    return (
      <div className="min-h-screen bg-black text-white p-6 flex flex-col justify-center items-center">
        <h1 className="text-4xl font-black italic tracking-tighter mb-2 text-cyan-400">CONQRETE</h1>
        <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold mb-10 text-center">Admin Access Only</p>
        <div className="w-full max-w-sm bg-[#0a0a0a] border border-gray-800 p-8 rounded-3xl shadow-2xl">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-6 text-center">Select Profile to View</p>
          {isLoading ? (
            <div className="text-cyan-400 animate-pulse text-center font-mono text-sm">Loading Roster...</div>
          ) : (
            <div className="space-y-4">
              {salesmen.map(rep => (
                <button key={rep.id} onClick={() => loginAsRep(rep)} className="w-full bg-[#111] border border-gray-800 hover:border-cyan-400 text-left p-5 rounded-2xl flex justify-between items-center group transition-all">
                  <span className="font-bold text-white uppercase">{rep.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono group-hover:text-cyan-400">View →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <div className="bg-[#0a0a0a]/90 border-b border-gray-800 p-6 pt-10 sticky top-0 z-10 backdrop-blur-xl">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[10px] text-cyan-500 uppercase font-black tracking-widest">Active Session</p>
            <h1 className="text-2xl font-black uppercase tracking-tight">{currentRep.name}</h1>
          </div>
          <button onClick={handleLogOut} className="text-[10px] bg-red-900/20 border border-red-900/50 text-red-500 px-4 py-2 rounded-full font-bold uppercase active:scale-95 transition-transform">Log Out</button>
        </div>
      </div>

      <div className="p-4 md:p-6">
        <div className="bg-gradient-to-br from-[#111] to-black border border-gray-800 rounded-3xl p-6 mb-8 shadow-2xl">
          <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-4">My Performance</p>
          <div className="flex justify-between items-end mb-2">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold">Total Sales</p>
              <p className="text-3xl font-mono text-white font-black tracking-tighter">₹{myTotalSales.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-emerald-700 uppercase font-bold">Commission</p>
              <p className="text-xl font-mono text-emerald-400 font-black tracking-tighter">₹{Math.round(myCommission).toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden">
              <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-[9px] text-gray-500 font-mono mt-2 text-right">{Math.round(progress)}% of Target</p>
          </div>
        </div>

        <h2 className="text-xs text-gray-500 uppercase font-black tracking-widest mb-4 pl-2">My Recent Punches</h2>
        <div className="space-y-4">
          {myOrders.map(o => {
            const isPaid = o.payment_status === 'Paid';
            const remaining = Number(o.total_amount) - Number(o.amount_paid || 0);

            return (
              <div key={o.id} className="bg-[#0a0a0a] border border-gray-800 p-5 rounded-2xl shadow-lg">
                <div className="flex justify-between items-start mb-3 border-b border-gray-800/50 pb-3">
                  <div>
                    <p className="text-sm font-bold text-white uppercase">{o.customer_name}</p>
                    <p className="text-[10px] text-gray-600 font-mono mt-1">{o.order_number}</p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="text-base font-mono font-black text-cyan-400">₹{Number(o.total_amount).toLocaleString()}</p>
                      <div className="flex gap-2 justify-end mt-1">
                        <span className={`text-[8px] uppercase font-black px-2 py-0.5 rounded border ${o.status === 'Pending' ? 'text-orange-500 border-orange-500/20' : 'text-emerald-500 border-emerald-500/20'}`}>{o.status}</span>
                        <span className={`text-[8px] uppercase font-black px-2 py-0.5 rounded border ${isPaid ? 'text-emerald-500 border-emerald-500/20' : 'text-red-400 border-red-400/20'}`}>{o.payment_status || 'Unpaid'}</span>
                      </div>
                    </div>
                    <button onClick={() => handleDeletePunch(o.id, o.order_number, o.total_amount, o.customer_name)} className="text-gray-600 hover:text-red-500 transition-colors p-2 text-lg">🗑️</button>
                  </div>
                </div>

                {!isPaid && (
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-[10px] font-mono text-gray-500">Due: ₹{remaining.toLocaleString()}</p>
                    <button 
                      onClick={() => openPaymentModal(o)}
                      className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                    >
                      Receive Cash
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {myOrders.length === 0 && <p className="text-center text-xs text-gray-600 font-mono py-10">No orders punched yet.</p>}
        </div>
      </div>

      {/* FIXED BOTTOM BAR (3 Buttons now) */}
      <div className="fixed bottom-6 right-4 left-4 flex gap-3 z-20">
        <button 
          onClick={() => setIsCatalogOpen(true)} 
          className="flex-1 bg-[#111] border border-gray-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[9px] shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-1"
        >
          Catalog
        </button>
        <button 
          onClick={() => setIsExpenseModalOpen(true)} 
          className="flex-1 bg-[#111] border border-orange-900/50 text-orange-400 py-4 rounded-2xl font-black uppercase tracking-widest text-[9px] shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-1"
        >
          Expenses
        </button>
        <button 
          onClick={() => setIsCreatingOrder(true)} 
          className="flex-[1.5] bg-cyan-400 text-black py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-[0_10px_40px_rgba(34,211,238,0.4)] active:scale-95 transition-transform"
        >
          + Punch Order
        </button>
      </div>

      {/* NEW: LOG EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-[90] flex items-end justify-center sm:items-center sm:p-6 backdrop-blur-xl">
          <div className="bg-[#0a0a0a] border border-gray-800 p-6 rounded-t-3xl sm:rounded-3xl w-full max-w-sm shadow-2xl animate-slide-up">
            <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
              <h2 className="text-lg font-black text-orange-400 uppercase tracking-widest">Log Expense</h2>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-gray-500 hover:text-white text-xl bg-gray-900 w-8 h-8 rounded-full flex items-center justify-center">×</button>
            </div>
            
            <form onSubmit={handleLogExpense} className="space-y-5">
              <div>
                <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Category</label>
                <select value={expenseData.category} onChange={e => setExpenseData({...expenseData, category: e.target.value})} className="w-full bg-[#111] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-orange-500">
                  <option value="Petrol">Petrol / Fuel</option>
                  <option value="Hotel">Hotel Stay</option>
                  <option value="Meals">Food / Meals</option>
                  <option value="Travel">Train / Bus</option>
                  <option value="Misc">Other (Misc)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Date</label>
                  <input required type="date" value={expenseData.date} onChange={e => setExpenseData({...expenseData, date: e.target.value})} className="w-full bg-[#111] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-orange-500 [&::-webkit-calendar-picker-indicator]:invert" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Amount (₹)</label>
                  <input required type="number" value={expenseData.amount} onChange={e => setExpenseData({...expenseData, amount: e.target.value})} className="w-full bg-[#111] border border-orange-900/30 p-4 rounded-xl text-orange-400 font-mono text-base font-black outline-none focus:border-orange-500" placeholder="0.00" />
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="w-full bg-orange-500 text-black py-5 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-transform shadow-[0_10px_30px_rgba(249,115,22,0.2)]">
                {isLoading ? "Submitting..." : "Submit Claim"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CATALOG MODAL */}
      {isCatalogOpen && (
        <div className="fixed inset-0 bg-[#050505] z-[80] overflow-y-auto pb-20 animate-slide-up">
          <div className="bg-[#0a0a0a]/95 border-b border-gray-800 p-6 pt-10 sticky top-0 z-10 backdrop-blur-xl flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-widest">Digital Catalog</h2>
              <p className="text-[10px] text-cyan-500 uppercase font-bold mt-1 tracking-widest">Client Presentation Mode</p>
            </div>
            <button onClick={() => setIsCatalogOpen(false)} className="bg-gray-900 border border-gray-800 w-10 h-10 rounded-full text-white font-black flex items-center justify-center text-lg active:scale-95 transition-transform">×</button>
          </div>
          <div className="p-4 md:p-6">
            <input type="text" placeholder="Search products..." value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} className="w-full bg-[#111] border border-gray-800 p-4 rounded-2xl text-white text-sm outline-none focus:border-cyan-400 mb-6" />
            <div className="space-y-4">
              {filteredCatalog.map(product => (
                <div key={product.id} className="bg-[#0a0a0a] border border-gray-800 p-5 rounded-3xl shadow-lg flex gap-5 items-center">
                  <div className="w-16 h-16 bg-[#111] border border-gray-800 rounded-2xl flex items-center justify-center text-3xl shrink-0">{product.image}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="text-white font-black text-sm uppercase tracking-tight">{product.name}</h3>
                      <span className={`text-[8px] uppercase font-black px-2 py-1 rounded border ${product.stock > 0 ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' : 'text-red-400 border-red-500/20 bg-red-500/10'}`}>{product.stock > 0 ? 'In Stock' : 'Out of Stock'}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono mb-3">{product.sku}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-gray-800/50">
                      <div><p className="text-[8px] text-gray-500 uppercase tracking-widest font-bold mb-1">Retailer Price</p><p className="text-white font-mono font-bold text-sm">₹{Number(product.pricing?.retailer || 0).toLocaleString()}</p></div>
                      <div><p className="text-[8px] text-gray-500 uppercase tracking-widest font-bold mb-1">Distributor Price</p><p className="text-cyan-400 font-mono font-bold text-sm">₹{Number(product.pricing?.distributor || 0).toLocaleString()}</p></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* NEW SHOP MODAL */}
      {isAddingRetailer && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-end justify-center sm:items-center sm:p-6 backdrop-blur-xl">
          <div className="bg-[#0a0a0a] border border-gray-800 p-6 rounded-t-3xl sm:rounded-3xl w-full shadow-2xl animate-slide-up">
            <h3 className="text-lg font-black uppercase text-white mb-6 tracking-tighter border-b border-gray-800 pb-4">Register New Shop</h3>
            <form onSubmit={handleAddNewShop} className="space-y-4">
              <div><label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Store Name</label><input required autoFocus type="text" value={newShop.store_name} onChange={e => setNewShop({...newShop, store_name: e.target.value})} className="w-full bg-[#111] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400" placeholder="e.g. Mobile Hub" /></div>
              <div><label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Location</label><input required type="text" value={newShop.location} onChange={e => setNewShop({...newShop, location: e.target.value})} className="w-full bg-[#111] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400" placeholder="e.g. Main Market" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Phone</label><input type="tel" value={newShop.phone} onChange={e => setNewShop({...newShop, phone: e.target.value})} className="w-full bg-[#111] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400 font-mono" placeholder="9922..." /></div>
                <div><label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Email</label><input type="email" value={newShop.email} onChange={e => setNewShop({...newShop, email: e.target.value})} className="w-full bg-[#111] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400" placeholder="shop@email.com" /></div>
              </div>
              <div className="flex gap-4 pt-4 border-t border-gray-800 mt-6">
                <button type="button" onClick={() => setIsAddingRetailer(false)} className="flex-1 text-gray-500 text-xs font-bold uppercase py-4">Cancel</button>
                <button type="submit" className="flex-1 bg-emerald-500 text-black py-4 rounded-xl font-black uppercase text-xs active:scale-95 transition-transform">Save Shop</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ORDER MODAL */}
      {isCreatingOrder && !isAddingRetailer && (
        <div className="fixed inset-0 bg-black z-50 overflow-y-auto">
          <div className="p-4 pt-8 md:p-6">
            <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-cyan-400">New Punch</h2>
              <button onClick={() => setIsCreatingOrder(false)} className="text-gray-500 text-sm font-bold uppercase tracking-widest bg-gray-900 px-4 py-2 rounded-full">Cancel</button>
            </div>
            <form onSubmit={submitMobileOrder} className="space-y-6 pb-32">
              <div className="space-y-4">
                <div className="bg-[#111] p-5 rounded-2xl border border-gray-800">
                  <div className="flex justify-between items-end mb-3">
                    <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest">Retailer / Client</label>
                    <button type="button" onClick={() => setIsAddingRetailer(true)} className="text-[10px] bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-lg font-bold uppercase">+ New Shop</button>
                  </div>
                  <select required value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-[#0a0a0a] text-white p-4 rounded-xl text-sm outline-none border border-gray-700 focus:border-cyan-400">
                    <option value="" className="bg-[#0a0a0a] text-gray-500">Select Shop...</option>
                    {retailers.map(r => <option key={r.id} value={r.store_name} className="bg-[#0a0a0a] text-white">{r.store_name}</option>)}
                  </select>
                </div>
                <div className="bg-[#111] p-5 rounded-2xl border border-gray-800">
                  <label className="block text-[10px] text-gray-500 mb-3 uppercase font-black tracking-widest">Pricing Tier</label>
                  <select value={salesChannel} onChange={e => setSalesChannel(e.target.value)} className="w-full bg-[#0a0a0a] text-white p-4 rounded-xl text-sm outline-none border border-gray-700 focus:border-cyan-400">
                    <option value="Retailer" className="bg-[#0a0a0a] text-white">Retailer (Standard)</option>
                    <option value="Distributor" className="bg-[#0a0a0a] text-white">Distributor (Wholesale)</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 mt-6 border-t border-gray-800">
                <p className="text-[10px] text-cyan-400 mb-4 uppercase font-black tracking-widest pl-2">Add Products</p>
                {cart.map((item, index) => (
                  <div key={index} className="bg-[#111] p-5 rounded-2xl border border-gray-800 mb-4 relative shadow-lg">
                    <select required value={item.productId} onChange={e => updateCartItem(index, 'productId', e.target.value)} className="w-full bg-[#0a0a0a] text-white p-4 rounded-xl text-sm outline-none mb-4 border border-gray-700 focus:border-cyan-400">
                      <option value="" className="bg-[#0a0a0a] text-gray-500">Choose item...</option>
                      {products.map(p => (<option key={p.id} value={p.id} disabled={p.stock <= 0} className="bg-[#0a0a0a] text-white">{p.name} {p.stock <= 0 ? '(OUT OF STOCK)' : `(In Stock: ${p.stock})`}</option>))}
                    </select>
                    <div className="flex justify-between items-center bg-[#0a0a0a] p-3 rounded-xl border border-gray-800">
                      <div className="flex items-center gap-4"><label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Qty</label><input type="number" min="1" value={item.quantity} onChange={e => updateCartItem(index, 'quantity', e.target.value)} className="w-16 bg-[#111] border border-gray-700 py-2 px-1 rounded-lg text-center text-white font-mono text-base outline-none focus:border-cyan-400" /></div>
                      <button type="button" onClick={() => removeItem(index)} className="text-[10px] text-red-500 font-bold uppercase tracking-widest bg-red-500/10 px-4 py-2.5 rounded-lg active:scale-95 transition-transform">Remove</button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={handleAddItem} className="w-full border-2 border-dashed border-gray-800 hover:border-cyan-900 text-gray-400 hover:text-cyan-400 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest mb-10 transition-colors">+ Add Another Product</button>
              </div>
              <div className="fixed bottom-0 left-0 w-full bg-[#0a0a0a]/95 backdrop-blur-md border-t border-gray-800 p-5 pb-8 flex justify-between items-center z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                <div><p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Total</p><p className="text-2xl font-mono text-white font-black tracking-tighter">₹{calculateTotal().toLocaleString()}</p></div>
                <button type="submit" className="bg-cyan-400 text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(34,211,238,0.3)] active:scale-95 transition-transform">Punch Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COLLECT PAYMENT MODAL */}
      {isPaymentModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/95 flex items-end justify-center sm:items-center sm:p-6 z-[70] backdrop-blur-xl">
          <div className="bg-[#0a0a0a] border border-gray-800 p-6 rounded-t-3xl sm:rounded-3xl w-full max-w-sm shadow-2xl animate-slide-up">
            <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4"><h2 className="text-lg font-black text-white uppercase tracking-widest">Receive Cash</h2><button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-500 hover:text-white text-xl bg-gray-900 w-8 h-8 rounded-full flex items-center justify-center">×</button></div>
            <form onSubmit={handleLogPayment} className="space-y-6">
              <div><label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest text-center">Amount Received (₹)</label><input type="number" autoFocus required min="1" max={Number(selectedOrder.total_amount) - Number(selectedOrder.amount_paid || 0)} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full bg-[#111] border border-gray-800 py-6 px-4 rounded-2xl text-emerald-400 text-4xl font-mono font-black outline-none focus:border-emerald-500 text-center" /><p className="text-[10px] text-gray-500 mt-3 font-mono text-center">Remaining Due: ₹{(Number(selectedOrder.total_amount) - Number(selectedOrder.amount_paid || 0)).toLocaleString()}</p></div>
              <button type="submit" className="w-full bg-emerald-500 text-black py-5 rounded-2xl font-black uppercase text-sm tracking-widest active:scale-95 transition-transform shadow-[0_10px_30px_rgba(16,185,129,0.3)]">Log Payment</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}