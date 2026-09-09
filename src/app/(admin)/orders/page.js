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

        // Restore inventory for each item
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

        // Update retailer totals
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
          ? selectedProd.pricing?.sellingPriceToDistributor || 0
          : selectedProd.pricing?.retailSellingPrice || 0;
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
    <div className="w-full max-w-[1920px] mx-auto text-[#111827]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Sales Orders</h1>
          <p className="text-[#6B7280] text-sm mt-1">Manage transactions and invoices</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto items-center">
          <input
            type="text"
            placeholder="Search Orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white border border-[#D1D5DB] px-4 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] w-full"
          />

          <button
            onClick={handleEnableSound}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all whitespace-nowrap border ${
              soundEnabled
                ? 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]'
                : 'bg-white text-[#374151] border-[#D1D5DB] hover:bg-[#F9FAFB]'
            }`}
          >
            {soundEnabled ? '🔊 Alerts On' : '🔇 Alerts Off'}
          </button>

          <button
            onClick={() => setIsFormOpen(true)}
            className="bg-[#0EA5E9] text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-[#0284C7] transition-colors shadow-sm whitespace-nowrap"
          >
            New Sale
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Order Reference</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Client Name</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Status</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280] text-right">Grand Total</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#6B7280] text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {filteredOrders.map((o) => {
              const isDeleting = deletingIds.includes(o.id);
              const isNew = newArrivalIds.includes(o.id);

              let rowClass = "hover:bg-[#F9FAFB] transition-colors group ";
              if (isDeleting) rowClass += "deleting pointer-events-none ";
              if (isNew) rowClass += "new-arrival";

              return (
                <tr key={o.id} className={rowClass}>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-[#111827] text-sm">{o.order_number}</p>
                    <p className="text-xs text-[#6B7280] mt-1">{new Date(o.created_at).toLocaleDateString()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-[#111827]">{o.customer_name}</p>
                    <p className="text-xs text-[#6B7280] uppercase mt-1">{o.sales_channel}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                      o.status === 'Pending' ? 'text-[#92400E] border-[#FDE68A] bg-[#FEF3C7]' : 'text-[#065F46] border-[#A7F3D0] bg-[#D1FAE5]'
                    }`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-[#111827] text-sm">
                    ₹{Number(o.total_amount).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-center flex justify-center gap-2 items-center">
                    <button
                      onClick={() => handlePrint(o)}
                      className="px-3 py-1.5 rounded-md border border-[#D1D5DB] text-[#374151] hover:bg-[#F3F4F6] transition-colors text-xs font-semibold"
                    >
                      PDF
                    </button>
                    <button
                      onClick={() => handleDeleteClick(o.id)}
                      disabled={isDeleting}
                      className="px-3 py-1.5 rounded-md border border-[#FECACA] text-[#991B1B] hover:bg-[#FEE2E2] transition-colors text-xs font-semibold disabled:opacity-50"
                    >
                      {isDeleting ? '...' : 'Del'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-sm text-[#6B7280]">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-[#111827]/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E5E7EB] p-8 rounded-xl w-full max-w-4xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-[#E5E7EB] pb-4">
              <h2 className="text-xl font-bold text-[#111827]">New Sale Transaction</h2>
              <button onClick={() => setIsFormOpen(false)} className="text-[#9CA3AF] hover:text-[#374151] text-2xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-2 uppercase tracking-wider">Customer / Store Name</label>
                  <input
                    list="retailers-list"
                    required
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full bg-white border border-[#D1D5DB] px-4 py-2 rounded-lg text-sm text-[#111827] outline-none focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9]"
                    placeholder="Enter or select retailer..."
                  />
                  <datalist id="retailers-list">
                    {retailers.map(r => <option key={r.id} value={r.store_name} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-2 uppercase tracking-wider">Pricing Tier</label>
                  <select
                    value={salesChannel}
                    onChange={e => setSalesChannel(e.target.value)}
                    className="w-full bg-white border border-[#D1D5DB] px-4 py-2 rounded-lg text-sm text-[#111827] outline-none focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9]"
                  >
                    <option value="Retailer">Retailer (Standard)</option>
                    <option value="Distributor">Distributor (Wholesale)</option>
                    <option value="Direct">Direct Sale</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold text-[#374151] uppercase tracking-wider">Itemized Cart</p>
                  <button type="button" onClick={handleAddItem} className="text-[#0EA5E9] text-xs font-semibold hover:text-[#0284C7]">+ Add Product</button>
                </div>

                {cart.map((item, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-4 bg-[#F9FAFB] p-4 rounded-lg border border-[#E5E7EB] relative group">
                    <div className="flex-1">
                      <label className="block text-[10px] text-[#6B7280] mb-1 uppercase font-semibold">Select Product</label>
                      <select
                        required
                        value={item.productId}
                        onChange={e => updateCartItem(index, 'productId', e.target.value)}
                        className="w-full bg-white border border-[#D1D5DB] rounded px-2 py-1 text-sm text-[#111827] outline-none"
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
                      <label className="block text-[10px] text-[#6B7280] mb-1 uppercase font-semibold">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => updateCartItem(index, 'quantity', e.target.value)}
                        className="w-full bg-white border border-[#D1D5DB] rounded px-2 py-1 text-sm text-[#111827] outline-none"
                      />
                    </div>
                    <div className="w-full md:w-32 text-right">
                      <label className="block text-[10px] text-[#6B7280] mb-1 uppercase font-semibold">Line Total</label>
                      <p className="text-sm font-semibold text-[#111827]">₹{item.totalPrice.toLocaleString()}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="absolute -right-2 -top-2 bg-[#FEE2E2] text-[#991B1B] w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-[#FECACA]"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center pt-6 border-t border-[#E5E7EB] mt-6 gap-6">
                <div>
                  <p className="text-xs text-[#6B7280] uppercase font-semibold tracking-wider mb-1">Total Billable Amount</p>
                  <p className="text-3xl font-bold text-[#111827]">₹{grandTotal.toLocaleString()}</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="flex-1 md:flex-none px-6 py-2 border border-[#D1D5DB] bg-white text-[#374151] rounded-lg font-semibold text-sm hover:bg-[#F9FAFB] transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    className="flex-1 md:flex-none bg-[#0EA5E9] text-white px-6 py-2 rounded-lg font-semibold text-sm hover:bg-[#0284C7] transition-colors shadow-sm"
                  >
                    Confirm & Print
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
