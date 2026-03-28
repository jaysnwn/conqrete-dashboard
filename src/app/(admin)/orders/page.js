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

  const [soundEnabled, setSoundEnabled] = useState(false);

  // Arrays to track which items are actively animating
  const [deletingIds, setDeletingIds] = useState([]);
  const [newArrivalIds, setNewArrivalIds] = useState([]);

  // Form State
  const [customerName, setCustomerName] = useState("");
  const [salesChannel, setSalesChannel] = useState("Retailer");
  const [cart, setCart] = useState([{ productId: "", quantity: 1, unitPrice: 0, totalPrice: 0 }]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Realtime Listener for Live Orders (INSERT + DELETE)
  useEffect(() => {
    const channel = supabase
      .channel('orders-live-feed')
      // --- NEW ORDER ARRIVED ---
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          console.log("🔥 Live Order Arrived:", payload.new);

          setOrders((prevOrders) => [payload.new, ...prevOrders]);

          const audio = new Audio("/notify.mp3");
          audio.play().catch(() => console.log("Audio blocked. User hasn't enabled alerts."));

          // Add to new arrivals for the cyan glow
          setNewArrivalIds((prev) => [...prev, payload.new.id]);

          // Remove the glow after 9 seconds (matches CSS animation duration)
          setTimeout(() => {
            setNewArrivalIds((prev) => prev.filter(id => id !== payload.new.id));
          }, 9000);
        }
      )
      // --- ORDER DELETED REMOTELY (from field app) ---
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'orders' },
        (payload) => {
          console.log("🗑️ Order Deleted Remotely:", payload.old);

          // Play delete warning sound
          const deleteAudio = new Audio("/delete-alert.mp3");
          deleteAudio.play().catch(() => console.log("Audio blocked."));

          // Trigger red glow animation on the row
          setDeletingIds((prev) => [...prev, payload.old.id]);

          // After 2s animation plays, remove from UI
          setTimeout(() => {
            setOrders((prev) => prev.filter(o => o.id !== payload.old.id));
            setDeletingIds((prev) => prev.filter(id => id !== payload.old.id));
          }, 2000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableSound = () => {
    const audio = new Audio("/notify.mp3");
    audio.play().then(() => {
      setSoundEnabled(true);
    }).catch(err => {
      alert("Browser blocked the sound. Make sure your volume is up!");
    });
  };

  // The 2-Step Deletion Logic (WITH INVENTORY RESTORATION)
  const handleDeleteClick = (orderId) => {
  const deleteAudio = new Audio("/delete-alert.mp3");
  deleteAudio.play().catch(() => console.log("Audio blocked."));

  setDeletingIds((prev) => [...prev, orderId]);

  setTimeout(async () => {
    try {
      // 1. Get the order details first
      const orderToDelete = orders.find(o => o.id === orderId);
      if (!orderToDelete) throw new Error("Order not found");

      // 2. Get order items to restore stock
      const { data: items } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);

      // ✅ NEW: Restore inventory for each item
      if (items && items.length > 0) {
        for (const item of items) {
          const { data: product } = await supabase
            .from("products")
            .select("stock")
            .eq("id", item.product_id)
            .single();

          if (product) {
            const restoredStock = Number(product.stock) + Number(item.quantity);
            await supabase
              .from("products")
              .update({ stock: restoredStock })
              .eq("id", item.product_id);

            // Log the restoration
            await supabase
              .from("inventory_logs")
              .insert([{
                product_id: item.product_id,
                product_name: item.product_name,
                change_amount: Number(item.quantity),
                new_stock: restoredStock,
                reason: `Order Deleted: ${orderToDelete.order_number}`,
                user_name: "Admin"
              }]);
          }
        }
      }

      // ✅ NEW: Update retailer totals
      const retailer = retailers.find(r => r.store_name === orderToDelete.customer_name);
      if (retailer) {
        const newLifetime = Math.max(0, Number(retailer.total_lifetime_sales || 0) - Number(orderToDelete.total_amount));
        const newPending = Math.max(0, Number(retailer.total_pending || 0) - Number(orderToDelete.total_amount));
        await supabase
          .from("retailers")
          .update({ total_lifetime_sales: newLifetime, total_pending: newPending })
          .eq("id", retailer.id);
      }

      // 3. Delete order items
      await supabase.from("order_items").delete().eq("order_id", orderId);

      // 4. Delete order
      await supabase.from("orders").delete().eq("id", orderId);

      // 5. Remove from UI
      setOrders((prev) => prev.filter(o => o.id !== orderId));
      setDeletingIds((prev) => prev.filter(id => id !== orderId));

      alert(`✅ Order ${orderToDelete.order_number} deleted and inventory restored!`);
      fetchInitialData();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Error deleting order: " + err.message);
      setDeletingIds((prev) => prev.filter(id => id !== orderId));
    }
  }, 2000);
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
        item.unitPrice = salesChannel === "Distributor"
          ? selectedProd.pricing?.distributor || 0
          : selectedProd.pricing?.retailer || 0;
      }
    } else if (field === "quantity") {
      item.quantity = Number(value) || 0;
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

      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        const currentStock = Number(product.stock) || 0;
        const deductQty = Number(item.quantity) || 0;
        const newStock = currentStock - deductQty;

        await supabase.from("order_items").insert([{
          order_id: newOrder.id,
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          quantity: deductQty,
          unit_price: item.unitPrice,
          total_price: item.totalPrice
        }]);

        const { error: stockErr } = await supabase.from("products").update({
          stock: newStock
        }).eq("id", product.id);

        if (stockErr) throw stockErr;

        await supabase.from("inventory_logs").insert([{
          product_id: product.id,
          product_name: product.name,
          change_amount: -deductQty,
          new_stock: newStock,
          reason: `Sale: ${orderNum}`,
          user_name: "Sales Desk"
        }]);
      }

      const retailer = retailers.find(r => r.store_name === customerName);
      if (retailer) {
        await supabase.from("retailers").update({
          total_lifetime_sales: Number(retailer.total_lifetime_sales || 0) + grandTotal,
          total_pending: Number(retailer.total_pending || 0) + grandTotal
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-white">CONQRETE SALES</h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-1">Transaction & Revenue Terminal</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto items-center">
          <input
            type="text"
            placeholder="Search Orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#111] border border-gray-800 px-4 py-3 rounded-xl text-xs outline-none focus:border-cyan-400 w-full"
          />

          <button
            onClick={handleEnableSound}
            className={`px-4 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap border ${
              soundEnabled
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-[#111] text-gray-500 border-gray-800 hover:text-white hover:border-gray-600'
            }`}
          >
            {soundEnabled ? '🔊 Alerts On' : '🔇 Enable Alerts'}
          </button>

          <button
            onClick={() => setIsFormOpen(true)}
            className="bg-cyan-400 text-black px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-lg shadow-cyan-400/20 whitespace-nowrap"
          >
            + Create Invoice
          </button>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#111] text-[10px] text-gray-500 uppercase font-black tracking-widest border-b border-gray-800">
              <th className="p-6">Order Reference</th>
              <th className="p-6">Client Name</th>
              <th className="p-6">Status</th>
              <th className="p-6 text-right">Grand Total</th>
              <th className="p-6 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {filteredOrders.map((o) => {
              const isDeleting = deletingIds.includes(o.id);
              const isNew = newArrivalIds.includes(o.id);

              let rowClass = "hover:bg-white/[0.02] transition-colors group ";
              if (isDeleting) rowClass += "deleting pointer-events-none ";
              if (isNew) rowClass += "new-arrival";

              return (
                <tr key={o.id} className={rowClass}>
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
                  <td className="p-6 text-center flex justify-center gap-2 items-center h-full mt-2">
                    <button
                      onClick={() => handlePrint(o)}
                      className="text-[9px] border border-gray-700 px-3 py-2 rounded-full text-gray-500 hover:text-white hover:border-cyan-400 transition-all font-black uppercase tracking-widest"
                    >
                      PDF
                    </button>
                    <button
                      onClick={() => handleDeleteClick(o.id)}
                      disabled={isDeleting}
                      className="text-[9px] border border-gray-700 px-3 py-2 rounded-full text-gray-500 hover:text-white hover:border-red-500 hover:bg-red-500/10 transition-all font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      {isDeleting ? '...' : 'Del'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
                        className="w-full bg-transparent text-white font-mono text-xs border-b border-gray-800 pb-1 outline-none"
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