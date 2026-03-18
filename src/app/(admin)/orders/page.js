"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { generateInvoicePDF } from "@/lib/generateInvoice";

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form State
  const [customerName, setCustomerName] = useState("");
  const [salesChannel, setSalesChannel] = useState("Retailer");
  const [cart, setCart] = useState([{ productId: "", quantity: 1, unitPrice: 0, totalPrice: 0 }]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [ordRes, prodRes, retRes] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("*").order("name", { ascending: true }),
        supabase.from("retailers").select("*").order("store_name", { ascending: true })
      ]);

      if (ordRes.error) throw ordRes.error;
      setOrders(ordRes.data || []);
      setProducts(prodRes.data || []);
      setRetailers(retRes.data || []);
    } catch (err) {
      console.error("Master Fetch Error:", err);
      alert("Failed to sync with Supabase. Check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = () => {
    setCart([...cart, { productId: "", quantity: 1, unitPrice: 0, totalPrice: 0 }]);
  };

  const removeItem = (index) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
  };

  const updateCartItem = (index, field, value) => {
    const updatedCart = [...cart];
    const item = updatedCart[index];

    if (field === "productId") {
      const selectedProd = products.find((p) => p.id === value);
      if (selectedProd) {
        item.productId = value;
        // Logic: Use Distributor price or Retailer price based on channel
        item.unitPrice = salesChannel === "Distributor" 
          ? selectedProd.pricing.distributor 
          : selectedProd.pricing.retailer;
      }
    } else if (field === "quantity") {
      item.quantity = parseInt(value) || 0;
    }

    item.totalPrice = item.unitPrice * item.quantity;
    setCart(updatedCart);
  };

  const grandTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [cart]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cart.some(item => !item.productId)) return alert("Please select products for all rows.");

    const orderNum = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      // 1. Create the Main Order
      const { data: newOrder, error: orderErr } = await supabase
        .from("orders")
        .insert([{
          order_number: orderNum,
          customer_name: customerName,
          sales_channel: salesChannel,
          total_amount: grandTotal,
          status: "Pending"
        }])
        .select()
        .single();

      if (orderErr) throw orderErr;

      // 2. Process Items, Update Stock, and Create Items
      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        
        // Insert Order Item
        await supabase.from("order_items").insert([{
          order_id: newOrder.id,
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.totalPrice
        }]);

        // Deduct Stock
        await supabase.from("products").update({
          stock: product.stock - item.quantity
        }).eq("id", product.id);
      }

      // 3. Update Retailer Balance (If Customer is a registered Retailer)
      const retailer = retailers.find(r => r.store_name === customerName);
      if (retailer) {
        await supabase.from("retailers").update({
          total_lifetime_sales: (retailer.total_lifetime_sales || 0) + grandTotal,
          total_pending: (retailer.total_pending || 0) + grandTotal
        }).eq("id", retailer.id);
      }

      alert(`Order ${orderNum} Created Successfully!`);
      setIsFormOpen(false);
      setCart([{ productId: "", quantity: 1, unitPrice: 0, totalPrice: 0 }]);
      setCustomerName("");
      fetchInitialData();

    } catch (err) {
      console.error("Submission Error:", err);
      alert("Error saving order: " + err.message);
    }
  };

  const handlePrint = async (order) => {
    const { data: items, error } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    if (error) return alert("Could not fetch items for PDF");
    generateInvoicePDF(order, items);
  };

  const filteredOrders = orders.filter(o => 
    o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.order_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 text-white min-h-screen bg-black">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-white">CONQRETE SALES</h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-1">Transaction & Revenue Terminal</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Search Orders..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#111] border border-gray-800 px-4 py-2 rounded-lg text-xs outline-none focus:border-cyan-400 w-full"
          />
          <button 
            onClick={() => setIsFormOpen(true)}
            className="bg-cyan-400 text-black px-8 py-3 rounded-full font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-lg shadow-cyan-400/20 whitespace-nowrap"
          >
            + Create Invoice
          </button>
        </div>
      </div>

      {/* ORDERS TABLE */}
      <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#111] text-[10px] text-gray-500 uppercase font-black tracking-widest border-b border-gray-800">
              <th className="p-6">Order Reference</th>
              <th className="p-6">Client Name</th>
              <th className="p-6">Status</th>
              <th className="p-6 text-right">Grand Total</th>
              <th className="p-6 text-center">Invoicing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {filteredOrders.map((o) => (
              <tr key={o.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="p-6">
                  <p className="font-mono text-cyan-400 font-bold text-sm">{o.order_number}</p>
                  <p className="text-[10px] text-gray-600 mt-1 uppercase">{new Date(o.created_at).toLocaleDateString()}</p>
                </td>
                <td className="p-6">
                  <p className="text-sm font-bold text-gray-200 uppercase tracking-tight">{o.customer_name}</p>
                  <p className="text-[9px] text-gray-600 uppercase font-bold">{o.sales_channel}</p>
                </td>
                <td className="p-6">
                  <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase border ${
                    o.status === 'Pending' ? 'text-orange-500 border-orange-500/20 bg-orange-500/5' : 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5'
                  }`}>
                    {o.status}
                  </span>
                </td>
                <td className="p-6 text-right font-mono text-white text-lg font-black">
                  ₹{Number(o.total_amount).toLocaleString()}
                </td>
                <td className="p-6 text-center">
                  <button 
                    onClick={() => handlePrint(o)}
                    className="text-[9px] border border-gray-700 px-4 py-2 rounded-full text-gray-500 hover:text-white hover:border-cyan-400 transition-all font-black uppercase tracking-widest"
                  >
                    Generate PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* HEAVY-DUTY MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-50 backdrop-blur-xl">
          <div className="bg-[#0a0a0a] border border-gray-800 p-10 rounded-3xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-6">
              <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter">New Sale Transaction</h2>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-500 hover:text-white text-2xl">×</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Customer / Store Name</label>
                  <input 
                    list="retailers-list"
                    required 
                    value={customerName} 
                    onChange={e => setCustomerName(e.target.value)} 
                    className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400"
                    placeholder="Enter or select retailer..."
                  />
                  <datalist id="retailers-list">
                    {retailers.map(r => <option key={r.id} value={r.store_name} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Pricing Tier</label>
                  <select 
                    value={salesChannel} 
                    onChange={e => setSalesChannel(e.target.value)}
                    className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400"
                  >
                    <option value="Retailer">Retailer (Standard)</option>
                    <option value="Distributor">Distributor (Wholesale)</option>
                    <option value="Direct">Direct Sale</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Itemized Cart</p>
                  <button type="button" onClick={handleAddItem} className="text-cyan-400 text-[10px] font-black uppercase tracking-widest underline">+ Add Product</button>
                </div>

                {cart.map((item, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-4 bg-black/50 p-6 rounded-2xl border border-gray-800 relative group">
                    <div className="flex-1">
                      <label className="block text-[8px] text-gray-700 mb-1 uppercase font-bold">Select Product</label>
                      <select 
                        required
                        value={item.productId} 
                        onChange={e => updateCartItem(index, 'productId', e.target.value)}
                        className="w-full bg-transparent text-white text-xs outline-none"
                      >
                        <option value="">Choose item...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                            {p.name} {p.stock <= 0 ? '(OUT OF STOCK)' : `(Stock: ${p.stock})`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-full md:w-24">
                      <label className="block text-[8px] text-gray-700 mb-1 uppercase font-bold">Quantity</label>
                      <input 
                        type="number" 
                        min="1"
                        value={item.quantity} 
                        onChange={e => updateCartItem(index, 'quantity', e.target.value)}
                        className="w-full bg-transparent text-white font-mono text-xs border-b border-gray-800 pb-1"
                      />
                    </div>
                    <div className="w-full md:w-32 text-right">
                      <label className="block text-[8px] text-gray-700 mb-1 uppercase font-bold">Line Total</label>
                      <p className="text-sm font-mono font-black text-emerald-400">₹{item.totalPrice.toLocaleString()}</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => removeItem(index)}
                      className="absolute -right-2 -top-2 bg-red-500/10 text-red-500 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-col md:flex-row justify-between items-end pt-10 border-t border-gray-800 mt-10 gap-8">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Total Billable Amount</p>
                  <p className="text-5xl font-mono text-white font-black italic tracking-tighter">₹{grandTotal.toLocaleString()}</p>
                </div>
                <div className="flex gap-6 w-full md:w-auto">
                  <button 
                    type="button" 
                    onClick={() => setIsFormOpen(false)}
                    className="flex-1 md:flex-none text-gray-600 text-xs font-black uppercase tracking-widest"
                  >
                    Discard
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 md:flex-none bg-white text-black px-12 py-4 rounded-full font-black uppercase text-xs tracking-widest shadow-xl shadow-white/5 active:scale-95 transition-all"
                  >
                    Confirm & Print Invoice
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}