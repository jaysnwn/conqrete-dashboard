"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function FieldPortal() {
  const [salesmen, setSalesmen] = useState([]);
  const [currentRep, setCurrentRep] = useState(null); 
  
  const [products, setProducts] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Order Form State
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [salesChannel, setSalesChannel] = useState("Retailer");
  const [cart, setCart] = useState([{ productId: "", quantity: 1 }]);

  // NEW: Add Shop State
  const [isAddingRetailer, setIsAddingRetailer] = useState(false);
  const [newShop, setNewShop] = useState({ store_name: "", location: "" });

  useEffect(() => { fetchLoginData(); }, []);

  const fetchLoginData = async () => {
    const { data } = await supabase.from("salesmen").select("*").order("name", { ascending: true });
    setSalesmen(data || []);
    setIsLoading(false);
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

  // --- NEW: Add Retailer Function ---
  const handleAddNewShop = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from("retailers")
      .insert([{ 
        store_name: newShop.store_name, 
        location: newShop.location,
        payment_cycle_days: 15,
        total_pending: 0
      }])
      .select()
      .single();

    if (error) return alert("Error adding shop: " + error.message);
    
    setRetailers([...retailers, data].sort((a, b) => a.store_name.localeCompare(b.store_name)));
    setCustomerName(data.store_name);
    setIsAddingRetailer(false);
    setNewShop({ store_name: "", location: "" });
    alert(`${data.store_name} added successfully!`);
  };

  const handleAddItem = () => setCart([...cart, { productId: "", quantity: 1 }]);
  const removeItem = (index) => setCart(cart.filter((_, i) => i !== index));

  const updateCartItem = (index, field, value) => {
    const updatedCart = [...cart];
    if (field === "quantity") updatedCart[index][field] = parseInt(value) || 0;
    else updatedCart[index][field] = value;
    setCart(updatedCart);
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return sum;
      const price = salesChannel === "Distributor" ? product.pricing.distributor : product.pricing.retailer;
      return sum + (price * item.quantity);
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
        
        await supabase.from("order_items").insert([{
          order_id: newOrder.id, product_id: product.id, product_name: product.name,
          sku: product.sku, quantity: item.quantity, unit_price: price, total_price: price * item.quantity
        }]);

        await supabase.from("products").update({ stock: product.stock - item.quantity }).eq("id", product.id);
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
      
      const { data: updatedOrders } = await supabase.from("orders").select("*").eq("sales_rep", currentRep.name).order("created_at", { ascending: false });
      setMyOrders(updatedOrders || []);
      
      // Refresh products to show updated stock
      const { data: updatedProducts } = await supabase.from("products").select("*").order("name", { ascending: true });
      setProducts(updatedProducts || []);

    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const myTotalSales = myOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const myCommission = myTotalSales * (Number(currentRep?.commission_rate || 0) / 100);
  const progress = currentRep?.monthly_target ? Math.min((myTotalSales / currentRep.monthly_target) * 100, 100) : 0;

  if (!currentRep) {
    return (
      <div className="min-h-screen bg-black text-white p-6 flex flex-col justify-center items-center">
        <h1 className="text-4xl font-black italic tracking-tighter mb-2 text-cyan-400">CONQRETE</h1>
        <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold mb-10">Field Operations Portal</p>
        <div className="w-full max-w-sm bg-[#0a0a0a] border border-gray-800 p-8 rounded-3xl shadow-2xl">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-6 text-center">Select Your Profile</p>
          {isLoading ? (
            <div className="text-cyan-400 animate-pulse text-center font-mono text-sm">Loading Roster...</div>
          ) : (
            <div className="space-y-3">
              {salesmen.map(rep => (
                <button key={rep.id} onClick={() => loginAsRep(rep)} className="w-full bg-[#111] border border-gray-800 hover:border-cyan-400 text-left p-4 rounded-xl flex justify-between items-center group transition-all">
                  <span className="font-bold text-white uppercase">{rep.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono group-hover:text-cyan-400">Login →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="bg-[#0a0a0a] border-b border-gray-800 p-6 pt-10 sticky top-0 z-10 backdrop-blur-md">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[10px] text-cyan-500 uppercase font-black tracking-widest">Active Session</p>
            <h1 className="text-2xl font-black uppercase tracking-tight">{currentRep.name}</h1>
          </div>
          <button onClick={() => setCurrentRep(null)} className="text-[10px] bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-full text-gray-400 font-bold uppercase">Log Out</button>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-gradient-to-br from-[#111] to-black border border-gray-800 rounded-3xl p-6 mb-8 shadow-2xl">
          <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-4">My Performance</p>
          <div className="flex justify-between items-end mb-2">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold">Total Sales</p>
              <p className="text-3xl font-mono text-white font-black">₹{myTotalSales.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-emerald-700 uppercase font-bold">Commission</p>
              <p className="text-xl font-mono text-emerald-400 font-black">₹{Math.round(myCommission).toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
              <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-[9px] text-gray-500 font-mono mt-2 text-right">{Math.round(progress)}% of Target</p>
          </div>
        </div>

        <h2 className="text-xs text-gray-500 uppercase font-black tracking-widest mb-4 pl-2">My Recent Punches</h2>
        <div className="space-y-4 mb-20">
          {myOrders.slice(0, 10).map(o => (
            <div key={o.id} className="bg-[#0a0a0a] border border-gray-800 p-4 rounded-2xl flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-white uppercase">{o.customer_name}</p>
                <p className="text-[10px] text-gray-600 font-mono mt-1">{o.order_number}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono font-black text-cyan-400">₹{Number(o.total_amount).toLocaleString()}</p>
                <p className={`text-[8px] uppercase font-black mt-1 ${o.status === 'Pending' ? 'text-orange-500' : 'text-emerald-500'}`}>{o.status}</p>
              </div>
            </div>
          ))}
          {myOrders.length === 0 && <p className="text-center text-xs text-gray-600 font-mono py-10">No orders punched yet.</p>}
        </div>
      </div>

      <button onClick={() => setIsCreatingOrder(true)} className="fixed bottom-6 right-6 left-6 bg-cyan-400 text-black py-4 rounded-full font-black uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(34,211,238,0.3)] active:scale-95 transition-all z-20">
        + Punch New Order
      </button>

      {/* NEW SHOP MODAL */}
      {isAddingRetailer && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] border border-gray-800 p-6 rounded-3xl w-full shadow-2xl">
            <h3 className="text-lg font-black uppercase text-white mb-6 tracking-tighter border-b border-gray-800 pb-4">Register New Shop</h3>
            <form onSubmit={handleAddNewShop} className="space-y-4">
              <div>
                <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Store Name</label>
                <input required autoFocus type="text" value={newShop.store_name} onChange={e => setNewShop({...newShop, store_name: e.target.value})} className="w-full bg-[#111] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none" placeholder="e.g. Mobile Hub" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Location</label>
                <input required type="text" value={newShop.location} onChange={e => setNewShop({...newShop, location: e.target.value})} className="w-full bg-[#111] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none" placeholder="e.g. Main Market" />
              </div>
              <div className="flex gap-4 pt-4 border-t border-gray-800">
                <button type="button" onClick={() => setIsAddingRetailer(false)} className="flex-1 text-gray-500 text-xs font-bold uppercase">Cancel</button>
                <button type="submit" className="flex-1 bg-emerald-500 text-black py-4 rounded-xl font-black uppercase text-xs">Save Shop</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCreatingOrder && !isAddingRetailer && (
        <div className="fixed inset-0 bg-black z-50 overflow-y-auto">
          <div className="p-6 pt-10">
            <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
              <h2 className="text-xl font-black uppercase italic tracking-tighter">New Punch</h2>
              <button onClick={() => setIsCreatingOrder(false)} className="text-gray-500 text-sm font-bold uppercase tracking-widest">Cancel</button>
            </div>

            <form onSubmit={submitMobileOrder} className="space-y-6 pb-24">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-[10px] text-gray-500 uppercase font-black tracking-widest">Retailer / Client</label>
                    <button type="button" onClick={() => setIsAddingRetailer(true)} className="text-[10px] text-emerald-400 font-bold uppercase underline">+ New Shop</button>
                  </div>
                  <select required value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-[#111] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none">
                    <option value="">Select Shop...</option>
                    {retailers.map(r => <option key={r.id} value={r.store_name}>{r.store_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Pricing Tier</label>
                  <select value={salesChannel} onChange={e => setSalesChannel(e.target.value)} className="w-full bg-[#111] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none">
                    <option value="Retailer">Retailer (Standard)</option>
                    <option value="Distributor">Distributor (Wholesale)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-800">
                <p className="text-[10px] text-cyan-400 mb-4 uppercase font-black tracking-widest">Add Products (Live Inventory)</p>
                {cart.map((item, index) => (
                  <div key={index} className="bg-[#111] p-4 rounded-xl border border-gray-800 mb-4 relative">
                    <select required value={item.productId} onChange={e => updateCartItem(index, 'productId', e.target.value)} className="w-full bg-transparent text-white text-sm outline-none mb-3 pb-2 border-b border-gray-800">
                      <option value="">Choose item...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                          {p.name} {p.stock <= 0 ? '(OUT OF STOCK)' : `(In Stock: ${p.stock})`}
                        </option>
                      ))}
                    </select>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <label className="text-[10px] text-gray-500 font-bold uppercase">Qty:</label>
                        <input type="number" min="1" value={item.quantity} onChange={e => updateCartItem(index, 'quantity', e.target.value)} className="w-16 bg-black border border-gray-800 p-2 rounded text-center text-white font-mono text-sm" />
                      </div>
                      <button type="button" onClick={() => removeItem(index)} className="text-[10px] text-red-500 font-bold uppercase tracking-widest bg-red-500/10 px-3 py-1.5 rounded">Remove</button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={handleAddItem} className="w-full border border-dashed border-gray-700 text-gray-400 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest mb-8">
                  + Add Another Product
                </button>
              </div>

              <div className="fixed bottom-0 left-0 w-full bg-[#0a0a0a] border-t border-gray-800 p-6 flex justify-between items-center z-40">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Total</p>
                  <p className="text-2xl font-mono text-white font-black">₹{calculateTotal().toLocaleString()}</p>
                </div>
                <button type="submit" className="bg-cyan-400 text-black px-8 py-3 rounded-full font-black uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                  Punch Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}