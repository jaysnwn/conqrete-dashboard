"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// --- FORM STATE ---
const emptyFormState = {
  name: "",
  category: "Power Bank",
  image: "📦",
  description: "",
  specs: {},
  costs: { fob: 0, freight: 0, duty: 0, gst: 0, other: 0 },
  pricing: { distributor: 0, retailer: 0, ecommerce: 0, quickCommerce: 0 },
  stock: 0,
};

// --- HELPERS ---
const generateSKU = (category) => {
  const prefix = category ? category.substring(0, 3).toUpperCase() : "PRD";
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${randomNum}`;
};

const generateBarcode = () => {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
};

const calculateLandedCost = (costs) => {
  return ["fob", "freight", "duty", "gst", "other"].reduce(
    (total, key) => total + (parseFloat(costs[key]) || 0),
    0
  );
};

// --- STYLES ---
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Manrope:wght@300;400;500;600;700&display=swap');

  .products-root * { font-family: 'Manrope', sans-serif; box-sizing: border-box; }
  .products-root .font-headline { font-family: 'Space Grotesk', sans-serif; }

  .glass-panel {
    background: rgba(35, 38, 41, 0.5);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(161, 250, 255, 0.05);
  }
  .glass-panel-modal {
    background: rgba(17, 20, 22, 0.95);
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border: 1px solid rgba(161, 250, 255, 0.08);
  }
  .input-dark {
    background: rgba(11, 13, 15, 0.8);
    border: 1px solid rgba(70, 72, 74, 0.4);
    color: #eeeef0;
    outline: none;
    transition: all 0.2s ease;
    font-family: 'Manrope', sans-serif;
  }
  .input-dark:focus {
    border-color: rgba(161, 250, 255, 0.4);
    box-shadow: 0 0 0 3px rgba(0, 244, 254, 0.06);
  }
  .input-dark::placeholder { color: rgba(170, 171, 173, 0.3); }
  .row-card {
    transition: all 0.2s ease;
    border-left: 3px solid transparent;
  }
  .row-card:hover {
    background: rgba(41, 44, 47, 0.4) !important;
    border-left-color: #a1faff;
  }
  .btn-primary {
    background: linear-gradient(135deg, #a1faff 0%, #00f4fe 100%);
    color: #004346;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700;
    transition: all 0.2s ease;
  }
  .btn-primary:hover {
    box-shadow: 0 0 30px rgba(0, 245, 255, 0.25);
    transform: scale(1.02);
  }
  .btn-primary:active { transform: scale(0.98); }

  @keyframes pulseGlow {
    0%, 100% { box-shadow: 0 0 8px rgba(161,250,255,1); }
    50% { box-shadow: 0 0 16px rgba(161,250,255,0.4); }
  }
  .pulse-dot { animation: pulseGlow 2s ease-in-out infinite; }
`;

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyFormState);
  const [viewProduct, setViewProduct] = useState(null);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setProducts(data || []);
    else console.error("Fetch Error:", error);
    setIsLoading(false);
  };

  const filteredProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  const handleOpenAdd = () => {
    setFormData(emptyFormState);
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (product) => {
    setFormData({
      ...product,
      pricing: product.pricing || emptyFormState.pricing,
      costs: product.costs || emptyFormState.costs,
      specs: product.specs || emptyFormState.specs,
    });
    setEditingId(product.id);
    setIsFormOpen(true);
  };

  const handleOpenView = (product) => {
    setViewProduct(product);
    setIsDetailOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const landedCost = calculateLandedCost(formData.costs);
    const dbPayload = {
      name: formData.name,
      category: formData.category,
      image: formData.image,
      description: formData.description,
      specs: formData.specs,
      costs: formData.costs,
      landed_cost: landedCost,
      pricing: formData.pricing,
      stock: formData.stock || 0,
    };

    if (editingId) {
      const { error } = await supabase.from("products").update(dbPayload).eq("id", editingId);
      if (error) { console.error("Update error:", error); alert(`Update Error: ${error.message}`); }
      else { fetchProducts(); setIsFormOpen(false); }
    } else {
      dbPayload.sku = generateSKU(formData.category);
      dbPayload.barcode = generateBarcode();
      const { error } = await supabase.from("products").insert([dbPayload]);
      if (error) { console.error("Insert error:", error); alert(`Database Error: ${error.message || error.details}`); }
      else { fetchProducts(); setIsFormOpen(false); }
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this product from the database?")) {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) { alert("Error deleting product"); console.error(error); }
      else fetchProducts();
    }
  };

  return (
    <div className="products-root" style={{ color: "#eeeef0" }}>
      <style>{styles}</style>

      {/* PAGE HEADER */}
      <section style={{ marginBottom: "3rem", display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "1.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <h2 className="font-headline" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 700, letterSpacing: "-0.02em", color: "#eeeef0", lineHeight: 1, margin: 0 }}>
            PRODUCT DATABASE
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div className="pulse-dot" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#a1faff", flexShrink: 0 }}></div>
            <p className="font-headline" style={{ fontSize: "11px", color: "rgba(161,250,255,0.6)", letterSpacing: "0.2em", textTransform: "uppercase", margin: 0 }}>
              Live connection:{" "}
              <span style={{ color: "#a1faff", fontWeight: 700 }}>CONQRETE_DATABASE</span>
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <svg style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", opacity: 0.4 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a1faff" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-dark glass-panel"
              style={{ paddingLeft: "2.75rem", paddingRight: "1.25rem", paddingTop: "0.875rem", paddingBottom: "0.875rem", width: "280px", borderRadius: "0.75rem", fontSize: "13px" }}
            />
          </div>

          {/* Add Button */}
          <button onClick={handleOpenAdd} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.875rem 1.75rem", borderRadius: "9999px", fontSize: "13px", letterSpacing: "0.05em", border: "none", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#004346" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Add Product
          </button>
        </div>
      </section>

      {/* TABLE */}
      <section>
        {/* Table Header */}
        <div className="font-headline" style={{ display: "grid", gridTemplateColumns: "0.5fr 2.5fr 1.5fr 1.5fr 1.5fr 1fr 1fr", padding: "0.75rem 1.5rem", fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#747578", marginBottom: "0.75rem" }}>
          <div>IMG</div>
          <div>Product Name</div>
          <div>Category</div>
          <div>SKU ID</div>
          <div>Landed Cost</div>
          <div>Stock</div>
          <div style={{ textAlign: "right" }}>Actions</div>
        </div>

        {/* Rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", position: "relative", minHeight: "120px" }}>
          {isLoading && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(12,14,16,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, borderRadius: "1rem" }}>
              <span className="font-headline" style={{ color: "#a1faff", fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", animation: "pulse 2s ease-in-out infinite" }}>
                FETCHING_DATA...
              </span>
            </div>
          )}

          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="glass-panel row-card"
              style={{ display: "grid", gridTemplateColumns: "0.5fr 2.5fr 1.5fr 1.5fr 1.5fr 1fr 1fr", alignItems: "center", padding: "1.25rem 1.5rem", borderRadius: "1rem" }}
            >
              {/* Image/Emoji */}
              <div>
                <div style={{ width: "44px", height: "44px", borderRadius: "0.5rem", background: "rgba(23,26,28,0.8)", border: "1px solid rgba(161,250,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>
                  {product.image}
                </div>
              </div>

              {/* Name */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", cursor: "pointer" }} onClick={() => handleOpenView(product)}>
                <span className="font-headline" style={{ color: "#eeeef0", fontWeight: 500, fontSize: "14px", transition: "color 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#a1faff"}
                  onMouseLeave={e => e.currentTarget.style.color = "#eeeef0"}
                >
                  {product.name}
                </span>
                <span style={{ fontSize: "10px", color: "#747578" }}>{product.description?.substring(0, 40) || "—"}</span>
              </div>

              {/* Category */}
              <div>
                <span style={{ padding: "0.2rem 0.75rem", background: "rgba(68,28,200,0.2)", color: "#9f8eff", fontSize: "10px", borderRadius: "9999px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {product.category}
                </span>
              </div>

              {/* SKU */}
              <div>
                <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#747578" }}>{product.sku}</span>
              </div>

              {/* Landed Cost */}
              <div>
                <span className="font-headline" style={{ color: "#a1faff", fontWeight: 700, fontSize: "14px" }}>
                  ₹{Number(product.landed_cost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Stock */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span className="font-headline" style={{ color: product.stock < 20 ? "#ff716c" : "#eeeef0", fontWeight: 500 }}>
                  {product.stock}
                </span>
                <span style={{ fontSize: "10px", color: "#747578", textTransform: "uppercase" }}>units</span>
                {product.stock < 20 && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#ff716c"><path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  onClick={() => handleOpenEdit(product)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#747578", transition: "color 0.2s", padding: "0.25rem" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#a1faff"}
                  onMouseLeave={e => e.currentTarget.style.color = "#747578"}
                  title="Edit"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#747578", transition: "color 0.2s", padding: "0.25rem" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#ff716c"}
                  onMouseLeave={e => e.currentTarget.style.color = "#747578"}
                  title="Delete"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
          ))}

          {!isLoading && filteredProducts.length === 0 && (
            <div className="glass-panel" style={{ padding: "3rem", textAlign: "center", borderRadius: "1rem", color: "#747578", fontSize: "13px", letterSpacing: "0.1em" }}>
              No products found.
            </div>
          )}
        </div>

        {/* Footer count */}
        <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid rgba(70,72,74,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: "#747578", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} {searchQuery ? "found" : "total"}
          </span>
        </div>
      </section>

      {/* ── FORM MODAL ── */}
      {isFormOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1.5rem" }}>
          <div className="glass-panel-modal" style={{ width: "100%", maxWidth: "56rem", maxHeight: "90vh", overflowY: "auto", borderRadius: "1.5rem", padding: "2.5rem", boxShadow: "0 0 60px rgba(0,0,0,0.6)" }}>

            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", paddingBottom: "1rem", borderBottom: "1px solid rgba(70,72,74,0.3)" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                  <div style={{ width: "6px", height: "6px", background: "#a1faff", borderRadius: "50%" }}></div>
                  <span className="font-headline" style={{ fontSize: "10px", color: "rgba(161,250,255,0.6)", letterSpacing: "0.3em", textTransform: "uppercase" }}>
                    {editingId ? "Modify Entry" : "New Entry"}
                  </span>
                </div>
                <h2 className="font-headline" style={{ fontSize: "1.5rem", fontWeight: 700, color: "#eeeef0", margin: 0 }}>
                  {editingId ? "Edit Product" : "New Product Entry"}
                </h2>
              </div>
              <button onClick={() => setIsFormOpen(false)} style={{ background: "none", border: "none", color: "#747578", cursor: "pointer", fontSize: "1.2rem", padding: "0.25rem", transition: "color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.color = "#eeeef0"}
                onMouseLeave={e => e.currentTarget.style.color = "#747578"}
              >✕</button>
            </div>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

              {/* Basic Info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label className="font-headline" style={{ fontSize: "10px", color: "#747578", textTransform: "uppercase", letterSpacing: "0.2em" }}>Product Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input-dark" style={{ borderRadius: "0.75rem", padding: "0.75rem 1rem" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label className="font-headline" style={{ fontSize: "10px", color: "#747578", textTransform: "uppercase", letterSpacing: "0.2em" }}>Category</label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value, specs: {} })} className="input-dark" style={{ borderRadius: "0.75rem", padding: "0.75rem 1rem" }}>
                    <option>Power Bank</option>
                    <option>Cable</option>
                    <option>Adapter</option>
                    <option>Earbuds</option>
                    <option>Accessories</option>
                  </select>
                </div>
                <div style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label className="font-headline" style={{ fontSize: "10px", color: "#747578", textTransform: "uppercase", letterSpacing: "0.2em" }}>Description</label>
                  <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="input-dark" style={{ borderRadius: "0.75rem", padding: "0.75rem 1rem", height: "80px", resize: "vertical" }} />
                </div>
              </div>

              {/* Tech Specs */}
              <div style={{ background: "rgba(11,13,15,0.6)", padding: "1.25rem", borderRadius: "1rem", border: "1px solid rgba(70,72,74,0.3)" }}>
                <h3 className="font-headline" style={{ fontSize: "11px", color: "#a1faff", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "1rem", fontWeight: 700 }}>
                  Technical Specifications
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  {formData.category === "Power Bank" && (<>
                    {[["capacity", "Capacity (mAh)"], ["outputWatt", "Output Watt"], ["inputWatt", "Input Watt"], ["batteryType", "Battery Type"]].map(([key, placeholder]) => (
                      <input key={key} placeholder={placeholder} value={formData.specs[key] || ""} onChange={e => setFormData({ ...formData, specs: { ...formData.specs, [key]: e.target.value } })} className="input-dark" style={{ borderRadius: "0.75rem", padding: "0.75rem 1rem", fontSize: "13px" }} />
                    ))}
                  </>)}
                  {formData.category === "Cable" && (<>
                    <select value={formData.specs.cableType || ""} onChange={e => setFormData({ ...formData, specs: { ...formData.specs, cableType: e.target.value } })} className="input-dark" style={{ borderRadius: "0.75rem", padding: "0.75rem 1rem", fontSize: "13px" }}>
                      <option value="">Select Type...</option><option>Type-C</option><option>Lightning</option><option>Micro USB</option>
                    </select>
                    {[["length", "Length (e.g. 1M, 2M)"], ["maxWatt", "Max Watt Supported"], ["speed", "Data Speed"]].map(([key, placeholder]) => (
                      <input key={key} placeholder={placeholder} value={formData.specs[key] || ""} onChange={e => setFormData({ ...formData, specs: { ...formData.specs, [key]: e.target.value } })} className="input-dark" style={{ borderRadius: "0.75rem", padding: "0.75rem 1rem", fontSize: "13px" }} />
                    ))}
                  </>)}
                  {(formData.category === "Adapter" || formData.category === "Earbuds") && (<>
                    {[["outputWatt", "Output Watt / Power"], ["features", "Key Features"]].map(([key, placeholder]) => (
                      <input key={key} placeholder={placeholder} value={formData.specs[key] || ""} onChange={e => setFormData({ ...formData, specs: { ...formData.specs, [key]: e.target.value } })} className="input-dark" style={{ borderRadius: "0.75rem", padding: "0.75rem 1rem", fontSize: "13px" }} />
                    ))}
                  </>)}
                </div>
              </div>

              {/* Costs & Pricing */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                {/* Import Costs */}
                <div style={{ background: "rgba(11,13,15,0.6)", padding: "1.25rem", borderRadius: "1rem", border: "1px solid rgba(70,72,74,0.3)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h3 className="font-headline" style={{ fontSize: "11px", color: "#34d399", textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, margin: 0 }}>Import Cost</h3>
                    <span className="font-headline" style={{ fontSize: "11px", color: "#34d399", fontWeight: 700, background: "rgba(11,13,15,0.8)", padding: "0.25rem 0.6rem", borderRadius: "0.5rem", border: "1px solid rgba(52,211,153,0.2)" }}>
                      ₹{calculateLandedCost(formData.costs).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                    {["fob", "freight", "duty", "gst", "other"].map((field) => (
                      <div key={field} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        <label className="font-headline" style={{ fontSize: "9px", color: "#747578", textTransform: "uppercase", letterSpacing: "0.15em" }}>{field}</label>
                        <input type="number" min="0" step="0.01" value={formData.costs[field] || ""} onChange={e => setFormData({ ...formData, costs: { ...formData.costs, [field]: parseFloat(e.target.value) || 0 } })} className="input-dark" style={{ borderRadius: "0.5rem", padding: "0.6rem 0.75rem", fontSize: "13px" }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Selling Prices */}
                <div style={{ background: "rgba(11,13,15,0.6)", padding: "1.25rem", borderRadius: "1rem", border: "1px solid rgba(70,72,74,0.3)" }}>
                  <h3 className="font-headline" style={{ fontSize: "11px", color: "#7c9eff", textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, marginBottom: "1rem" }}>Selling Prices</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                    {[["distributor", "Distributor"], ["retailer", "Retailer"], ["ecommerce", "E-Commerce"], ["quickCommerce", "Quick Commerce"]].map(([key, label]) => (
                      <div key={key} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        <label className="font-headline" style={{ fontSize: "9px", color: "#747578", textTransform: "uppercase", letterSpacing: "0.15em" }}>{label}</label>
                        <input type="number" min="0" step="0.01" value={formData.pricing[key] || ""} onChange={e => setFormData({ ...formData, pricing: { ...formData.pricing, [key]: parseFloat(e.target.value) || 0 } })} className="input-dark" style={{ borderRadius: "0.5rem", padding: "0.6rem 0.75rem", fontSize: "13px" }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", paddingTop: "1rem", borderTop: "1px solid rgba(70,72,74,0.2)" }}>
                <button type="button" onClick={() => setIsFormOpen(false)} style={{ background: "none", border: "none", color: "#747578", cursor: "pointer", padding: "0.75rem 1.25rem", fontSize: "13px", transition: "color 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#eeeef0"}
                  onMouseLeave={e => e.currentTarget.style.color = "#747578"}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: "0.75rem 2rem", borderRadius: "9999px", fontSize: "13px", letterSpacing: "0.05em", border: "none", cursor: "pointer" }}>
                  {editingId ? "Update Product" : "Save to Database"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ── */}
      {isDetailOpen && viewProduct && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1.5rem" }}>
          <div className="glass-panel-modal" style={{ width: "100%", maxWidth: "56rem", borderRadius: "1.5rem", padding: "2.5rem", boxShadow: "0 0 60px rgba(0,0,0,0.6)", position: "relative" }}>

            <button onClick={() => setIsDetailOpen(false)} style={{ position: "absolute", top: "1.25rem", right: "1.25rem", background: "none", border: "none", color: "#747578", cursor: "pointer", fontSize: "1.2rem", transition: "color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.color = "#eeeef0"}
              onMouseLeave={e => e.currentTarget.style.color = "#747578"}
            >✕</button>

            {/* Product Header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5rem", marginBottom: "2rem", paddingBottom: "1.5rem", borderBottom: "1px solid rgba(70,72,74,0.3)" }}>
              <div style={{ width: "80px", height: "80px", background: "rgba(11,13,15,0.8)", border: "1px solid rgba(161,250,255,0.15)", borderRadius: "1rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem", flexShrink: 0 }}>
                {viewProduct.image}
              </div>
              <div>
                <h2 className="font-headline" style={{ fontSize: "1.75rem", fontWeight: 700, color: "#eeeef0", margin: "0 0 0.5rem 0", letterSpacing: "-0.02em" }}>
                  {viewProduct.name}
                </h2>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                  <span style={{ padding: "0.2rem 0.75rem", background: "rgba(68,28,200,0.2)", color: "#9f8eff", fontSize: "10px", borderRadius: "9999px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{viewProduct.category}</span>
                  <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#747578", padding: "0.2rem 0" }}>SKU: {viewProduct.sku}</span>
                  <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#747578", padding: "0.2rem 0" }}>BC: {viewProduct.barcode}</span>
                </div>
                <p style={{ fontSize: "13px", color: "#aaabad", margin: 0, maxWidth: "600px" }}>{viewProduct.description}</p>
              </div>
            </div>

            {/* 3-col detail grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
              {/* Specs */}
              <div style={{ background: "rgba(11,13,15,0.6)", padding: "1.25rem", borderRadius: "1rem", border: "1px solid rgba(70,72,74,0.3)" }}>
                <h3 className="font-headline" style={{ fontSize: "10px", color: "#747578", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "1rem", fontWeight: 700 }}>Technical Specs</h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {Object.entries(viewProduct.specs || {}).map(([k, v]) => (
                    <li key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(70,72,74,0.2)", paddingBottom: "0.4rem", fontSize: "12px" }}>
                      <span style={{ color: "#747578", textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1").trim()}</span>
                      <span style={{ color: "#eeeef0", fontWeight: 500 }}>{v}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Costs */}
              <div style={{ background: "rgba(11,13,15,0.6)", padding: "1.25rem", borderRadius: "1rem", border: "1px solid rgba(70,72,74,0.3)" }}>
                <h3 className="font-headline" style={{ fontSize: "10px", color: "#34d399", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "1rem", fontWeight: 700 }}>Internal Costs</h3>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 0.75rem 0", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {Object.entries(viewProduct.costs || {}).map(([k, v]) => (
                    <li key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(70,72,74,0.2)", paddingBottom: "0.4rem", fontSize: "12px" }}>
                      <span style={{ color: "#747578", textTransform: "uppercase", fontSize: "11px" }}>{k}</span>
                      <span style={{ color: "#eeeef0", fontFamily: "monospace" }}>₹{v}</span>
                    </li>
                  ))}
                </ul>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#34d399", background: "rgba(52,211,153,0.05)", padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1px solid rgba(52,211,153,0.15)", fontSize: "13px" }}>
                  <span className="font-headline">LANDED COST</span>
                  <span>₹{Number(viewProduct.landed_cost || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Pricing */}
              <div style={{ background: "rgba(11,13,15,0.6)", padding: "1.25rem", borderRadius: "1rem", border: "1px solid rgba(70,72,74,0.3)" }}>
                <h3 className="font-headline" style={{ fontSize: "10px", color: "#7c9eff", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "1rem", fontWeight: 700 }}>Selling Tiers</h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {[["Distributor", viewProduct.pricing?.distributor], ["Retailer", viewProduct.pricing?.retailer], ["E-Commerce", viewProduct.pricing?.ecommerce], ["Quick Comm.", viewProduct.pricing?.quickCommerce]].map(([label, val]) => (
                    <li key={label} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(70,72,74,0.2)", paddingBottom: "0.4rem", fontSize: "12px" }}>
                      <span style={{ color: "#747578", textTransform: "uppercase", fontSize: "11px" }}>{label}</span>
                      <span style={{ color: "#a1faff", fontFamily: "monospace", fontWeight: 500 }}>₹{val || 0}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}