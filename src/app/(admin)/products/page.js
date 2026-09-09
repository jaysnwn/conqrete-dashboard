"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// --- 1. INPUTS ARE THE SOURCE OF TRUTH (EMPTY STATE) ---
const emptyFormState = {
  name: "",
  category: "Power Bank",
  image: "",
  description: "",
  stock: 0,
  
  // Explicit semantic names for specs
  specs: {
    series: "",
    supplier: "",
    origin: "",
    warranty: "",
    status: "Active",
    reorderLevel: 500,
  },
  
  // Explicit semantic names for costs
  costs: {
    factoryPrice: 0,
    shippingCost: 0,
    packagingCost: 0,
    handlingCost: 0,
    poNumber: "",
    qtyOrdered: 0,
    poStatus: "Pending"
  },
  
  // Explicit semantic names for pricing
  pricing: {
    sellingPriceToDistributor: 0,
    distributorSellingPrice: 0,
    retailSellingPrice: 0,
    mrp: 0
  }
};

// --- HELPERS ---
const generateSKU = (category) => {
  const prefix = "CQ";
  const catCode = category ? category.substring(0, 3).toUpperCase() : "GEN";
  const random = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${catCode}-${random}`;
};

const generateBarcode = () => {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
};

// --- 3. CREATE ONE CENTRAL CALCULATION ENGINE ---
const calculateProductEconomics = (inputs) => {
  const c = inputs.costs || {};
  const p = inputs.pricing || {};
  const s = inputs.specs || {};
  const stock = parseInt(inputs.stock) || 0;

  // Ensure safe numeric inputs
  const factoryPrice = parseFloat(c.factoryPrice) || 0;
  const shippingCost = parseFloat(c.shippingCost) || 0;
  const packagingCost = parseFloat(c.packagingCost) || 0;
  const handlingCost = parseFloat(c.handlingCost) || 0;
  const qtyOrdered = parseInt(c.qtyOrdered) || 0;

  const sellingPriceToDistributor = parseFloat(p.sellingPriceToDistributor) || 0;
  const distributorSellingPrice = parseFloat(p.distributorSellingPrice) || 0;
  const retailSellingPrice = parseFloat(p.retailSellingPrice) || 0;
  const mrp = parseFloat(p.mrp) || 0;

  const reorderLevel = parseInt(s.reorderLevel) || 0;

  // --- 5. COST CALCULATION ---
  const totalUnitCost = factoryPrice + shippingCost + packagingCost + handlingCost;
  const grandPOCost = totalUnitCost * qtyOrdered;

  // --- 6. PRICING CALCULATIONS ---
  const companyProfit = sellingPriceToDistributor - totalUnitCost;
  const companyMarkupPct = totalUnitCost ? (companyProfit / totalUnitCost) * 100 : 0;

  const distributorProfit = distributorSellingPrice - sellingPriceToDistributor;
  const distributorMarkupPct = sellingPriceToDistributor ? (distributorProfit / sellingPriceToDistributor) * 100 : 0;

  const retailProfit = retailSellingPrice - distributorSellingPrice;
  const retailMarkupPct = distributorSellingPrice ? (retailProfit / distributorSellingPrice) * 100 : 0;

  // --- 7. MRP CALCULATIONS ---
  const retailerProfitOnMrp = mrp - distributorSellingPrice;
  const retailMarginOnMrpPct = mrp ? (retailerProfitOnMrp / mrp) * 100 : 0;

  const discountAmount = mrp - retailSellingPrice;
  const discountPct = mrp ? (discountAmount / mrp) * 100 : 0;

  // --- 8. INVENTORY CALCULATIONS ---
  const stockStatus = stock <= 0 ? "Out of Stock" : (stock <= reorderLevel ? "Low Stock" : "OK");
  
  const totalFactoryCostBasis = factoryPrice * stock;
  const totalShippingCostBasis = shippingCost * stock;
  const totalPackagingCostBasis = packagingCost * stock;
  const totalHandlingCostBasis = handlingCost * stock;
  
  const inventoryValue = totalUnitCost * stock;
  const totalRetailValue = retailSellingPrice * stock;
  const expectedProfit = companyProfit * stock;

  return {
    totalUnitCost,
    grandPOCost,
    companyProfit,
    companyMarkupPct,
    distributorProfit,
    distributorMarkupPct,
    retailProfit,
    retailMarkupPct,
    retailerProfitOnMrp,
    retailMarginOnMrpPct,
    discountAmount,
    discountPct,
    stockStatus,
    totalFactoryCostBasis,
    totalShippingCostBasis,
    totalPackagingCostBasis,
    totalHandlingCostBasis,
    inventoryValue,
    totalRetailValue,
    expectedProfit
  };
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // 11. Edit Product Behavior - Load stored product into inputs
  const [formData, setFormData] = useState(emptyFormState);
  
  const [viewProduct, setViewProduct] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error("Error fetching products:", error);
    else {
      setProducts(data || []);
      setFilteredProducts(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    setFilteredProducts(
      products.filter(p => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)))
    );
  }, [products, searchQuery]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file);

    if (uploadError) {
      alert("Error uploading image: " + uploadError.message);
    } else {
      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);
      
      setFormData({ ...formData, image: publicUrlData.publicUrl });
    }
    setUploadingImage(false);
  };

  const handleOpenAdd = () => {
    setFormData(emptyFormState);
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (product) => {
    // 11. Populate editable fields
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

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) alert("Error deleting product");
    else fetchProducts();
  };

  // PAUSED FOR STAGE 3 HARDENING
  // const handleSyncToSheets = async (productId, productSku) => {
  //   try {
  //     const res = await fetch('/api/sync-sheets', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ productId })
  //     });
  //     const data = await res.json();
  //     if (data.success) {
  //       alert(`✓ Product ${productSku} synchronized to Google Sheets (${data.result.action}).`);
  //     } else {
  //       alert(`✗ Sync failed — ${data.error}`);
  //     }
  //   } catch (err) {
  //     alert(`✗ Sync failed — ${err.message}`);
  //   }
  // };

  // --- 10. SAVE BEHAVIOR ---
  const handleSave = async (e) => {
    e.preventDefault();
    
    // 3. Run central calculation engine before save
    const metrics = calculateProductEconomics(formData);

    // 5. Construct final JSON objects ensuring explicit field naming
    const dbPayload = {
      name: formData.name,
      category: formData.category,
      image: formData.image,
      description: formData.description,
      stock: formData.stock || 0,
      landed_cost: metrics.totalUnitCost, // Kept at top-level for backward compatibility in dashboard
      
      specs: {
        series: formData.specs.series || "",
        supplier: formData.specs.supplier || "",
        origin: formData.specs.origin || "",
        warranty: formData.specs.warranty || "",
        status: formData.specs.status || "Active",
        reorderLevel: parseInt(formData.specs.reorderLevel) || 0,
        // Generated Derived Values
        stockStatus: metrics.stockStatus,
        totalFactoryCostBasis: metrics.totalFactoryCostBasis,
        totalShippingCostBasis: metrics.totalShippingCostBasis,
        totalPackagingCostBasis: metrics.totalPackagingCostBasis,
        totalHandlingCostBasis: metrics.totalHandlingCostBasis,
        inventoryValue: metrics.inventoryValue,
        totalRetailValue: metrics.totalRetailValue,
        expectedProfit: metrics.expectedProfit
      },
      
      costs: {
        factoryPrice: parseFloat(formData.costs.factoryPrice) || 0,
        shippingCost: parseFloat(formData.costs.shippingCost) || 0,
        packagingCost: parseFloat(formData.costs.packagingCost) || 0,
        handlingCost: parseFloat(formData.costs.handlingCost) || 0,
        poNumber: formData.costs.poNumber || "",
        qtyOrdered: parseInt(formData.costs.qtyOrdered) || 0,
        poStatus: formData.costs.poStatus || "Pending",
        // Generated Derived Values
        totalUnitCost: metrics.totalUnitCost,
        grandPOCost: metrics.grandPOCost
      },
      
      pricing: {
        sellingPriceToDistributor: parseFloat(formData.pricing.sellingPriceToDistributor) || 0,
        distributorSellingPrice: parseFloat(formData.pricing.distributorSellingPrice) || 0,
        retailSellingPrice: parseFloat(formData.pricing.retailSellingPrice) || 0,
        mrp: parseFloat(formData.pricing.mrp) || 0,
        // Generated Derived Values
        companyProfit: metrics.companyProfit,
        companyMarkupPct: parseFloat(metrics.companyMarkupPct.toFixed(2)),
        distributorProfit: metrics.distributorProfit,
        distributorMarkupPct: parseFloat(metrics.distributorMarkupPct.toFixed(2)),
        retailProfit: metrics.retailProfit,
        retailMarkupPct: parseFloat(metrics.retailMarkupPct.toFixed(2)),
        retailerProfitOnMrp: metrics.retailerProfitOnMrp,
        retailMarginOnMrpPct: parseFloat(metrics.retailMarginOnMrpPct.toFixed(2)),
        discountAmount: metrics.discountAmount,
        discountPct: parseFloat(metrics.discountPct.toFixed(2))
      }
    };

    // 6. Save complete record to Supabase
    if (editingId) {
      const { error } = await supabase.from("products").update(dbPayload).eq("id", editingId);
      if (error) alert("Error updating product");
      else { fetchProducts(); setIsFormOpen(false); }
    } else {
      dbPayload.sku = generateSKU(formData.category);
      dbPayload.barcode = generateBarcode();
      const { error } = await supabase.from("products").insert([dbPayload]);
      if (error) alert("Error creating product");
      else { fetchProducts(); setIsFormOpen(false); }
    }
  };

  // We use the central engine to preview stats in the form live as inputs change
  const liveMetrics = isFormOpen ? calculateProductEconomics(formData) : null;

  return (
    <div className="p-8 bg-[#F8F9FA] min-h-screen text-[#111827]">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold m-0 tracking-tight text-[#111827]">Products Directory</h1>
          <p className="text-sm text-[#6B7280] mt-1">Manage catalog, ERP mappings, and pricing strategies</p>
        </div>
        <button 
          onClick={handleOpenAdd} 
          className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-5 py-2.5 rounded-lg border-none font-semibold cursor-pointer shadow-sm transition-colors"
        >
          + Add Product
        </button>
      </div>

      {/* SEARCH */}
      <div className="mb-6 max-w-md">
        <input 
          type="text" 
          placeholder="Search by product name or SKU..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-lg text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none shadow-sm"
        />
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-[#6B7280] animate-pulse">Loading products...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-10 text-center text-[#6B7280]">No products found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <th className="px-6 py-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Product</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wider text-center">Stock</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wider text-right">Landed Cost</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wider text-right">Retail (MRP)</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4 cursor-pointer" onClick={() => handleOpenView(product)}>
                        <div>
                          {product.image && product.image.startsWith('http') ? (
                            <img src={product.image} alt={product.name} className="w-10 h-10 rounded-md object-cover border border-[#E5E7EB]" />
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center text-xl">
                              {product.image || '📦'}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="m-0 font-bold text-[#111827]">{product.name}</p>
                          <div className="flex gap-2 items-center mt-1">
                            <span className="text-xs text-[#6B7280]">SKU: {product.sku}</span>
                            <span className="text-[10px] bg-[#F3F4F6] text-[#4B5563] px-2 py-0.5 rounded-full font-semibold border border-[#E5E7EB]">
                              {product.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${product.stock > (product.specs?.reorderLevel || 100) ? 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]' : 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]'}`}>
                        {product.stock} {product.stock <= (product.specs?.reorderLevel || 100) && ' (Low)'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-[#111827]">
                      ₹{Number(product.landed_cost).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-[#0EA5E9]">
                      ₹{Number(product.pricing?.mrp || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleOpenView(product)} className="bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] border border-[#D1D5DB] px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors">View ERP</button>
                        <button onClick={() => handleOpenEdit(product)} className="bg-[#0EA5E9]/10 hover:bg-[#0EA5E9]/20 text-[#0EA5E9] border border-[#0EA5E9]/20 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors">Edit</button>
                        <button onClick={() => handleDelete(product.id)} className="bg-[#FEE2E2] hover:bg-[#FECACA] text-[#991B1B] border border-[#FECACA] px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors">Del</button>
                        {/* PAUSED FOR STAGE 3: <button onClick={() => handleSyncToSheets(product.id, product.sku)} className="bg-[#D1FAE5] hover:bg-[#A7F3D0] text-[#065F46] border border-[#A7F3D0] px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors" title="Sync to Google Sheets">Sync</button> */}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🔴 ADD / EDIT FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-xl border border-[#E5E7EB] relative">
            <div className="sticky top-0 bg-white z-10 p-6 border-b border-[#E5E7EB] flex justify-between items-center">
              <h2 className="text-xl font-bold m-0 text-[#111827]">{editingId ? "Edit Product (ERP Data)" : "Add New Product (ERP Data)"}</h2>
              <button onClick={() => setIsFormOpen(false)} className="bg-transparent border-none text-[#6B7280] hover:text-[#111827] cursor-pointer text-xl">✕</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6">
              {/* Image & Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Product Image</label>
                  <div className="flex items-center gap-4">
                    {formData.image && formData.image.startsWith('http') ? (
                      <img src={formData.image} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-[#E5E7EB]" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center text-2xl">
                        {formData.image || '📦'}
                      </div>
                    )}
                    <div className="flex-1">
                      <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} className="w-full px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none text-sm" />
                      {uploadingImage && <p className="text-xs text-[#0EA5E9] mt-1 font-semibold animate-pulse">Uploading image...</p>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Product Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none text-sm" />
                </div>
                <div className="col-span-1 md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Description</label>
                  <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none h-20 resize-y text-sm" />
                </div>
              </div>

              {/* MODULE 1: STATIC PRODUCT MASTER DATA */}
              <div className="mb-8 border border-[#E5E7EB] rounded-lg overflow-hidden">
                <div className="bg-[#F9FAFB] px-4 py-3 border-b border-[#E5E7EB]">
                  <h3 className="text-sm font-bold text-[#111827] uppercase tracking-wider m-0">1. Static Product Master Data</h3>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Category</label>
                    <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none text-sm">
                      <option>Power Bank</option><option>Cable</option><option>Adapter</option><option>Earbuds</option><option>Accessories</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Series / Collection</label>
                    <input type="text" value={formData.specs.series || ""} onChange={e => setFormData({ ...formData, specs: { ...formData.specs, series: e.target.value } })} className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] outline-none focus:border-[#0EA5E9] text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Supplier</label>
                    <input type="text" value={formData.specs.supplier || ""} onChange={e => setFormData({ ...formData, specs: { ...formData.specs, supplier: e.target.value } })} className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] outline-none focus:border-[#0EA5E9] text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Country of Origin</label>
                    <input type="text" value={formData.specs.origin || ""} onChange={e => setFormData({ ...formData, specs: { ...formData.specs, origin: e.target.value } })} className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] outline-none focus:border-[#0EA5E9] text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Warranty Period</label>
                    <input type="text" value={formData.specs.warranty || ""} onChange={e => setFormData({ ...formData, specs: { ...formData.specs, warranty: e.target.value } })} className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] outline-none focus:border-[#0EA5E9] text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Product Status</label>
                    <select value={formData.specs.status || "Active"} onChange={e => setFormData({ ...formData, specs: { ...formData.specs, status: e.target.value } })} className="px-3 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] outline-none focus:border-[#0EA5E9] text-sm">
                      <option>Active</option><option>Inactive</option><option>Discontinued</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* MODULE 2: PROCUREMENT & UNIT COST */}
              <div className="mb-8 border border-[#E5E7EB] rounded-lg overflow-hidden">
                <div className="bg-[#F9FAFB] px-4 py-3 border-b border-[#E5E7EB] flex justify-between items-center">
                  <h3 className="text-sm font-bold text-[#111827] uppercase tracking-wider m-0">2. Procurement & Unit Cost Logistics Data</h3>
                  <span className="text-xs font-bold text-[#065F46] bg-[#D1FAE5] px-2.5 py-1 rounded-md border border-[#A7F3D0]">
                    Total Unit Cost: ₹{liveMetrics?.totalUnitCost.toFixed(2)}
                  </span>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-white">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">PO Number</label>
                    <input type="text" value={formData.costs.poNumber || ""} onChange={e => setFormData({ ...formData, costs: { ...formData.costs, poNumber: e.target.value } })} className="px-3 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-[#111827] text-sm outline-none focus:border-[#0EA5E9]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Qty Ordered</label>
                    <input type="number" min="0" value={formData.costs.qtyOrdered || 0} onChange={e => setFormData({ ...formData, costs: { ...formData.costs, qtyOrdered: e.target.value } })} className="px-3 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-[#111827] text-sm outline-none focus:border-[#0EA5E9]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">PO Status</label>
                    <select value={formData.costs.poStatus || "Pending"} onChange={e => setFormData({ ...formData, costs: { ...formData.costs, poStatus: e.target.value } })} className="px-3 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-[#111827] text-sm outline-none focus:border-[#0EA5E9]">
                      <option>Pending</option><option>Shipped</option><option>Delivered</option>
                    </select>
                  </div>
                  <div className="hidden md:block"></div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Factory Price (₹)</label>
                    <input type="number" step="0.01" min="0" value={formData.costs.factoryPrice || 0} onChange={e => setFormData({ ...formData, costs: { ...formData.costs, factoryPrice: e.target.value } })} className="px-3 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-[#111827] text-sm outline-none focus:border-[#0EA5E9]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Shipping Cost (₹)</label>
                    <input type="number" step="0.01" min="0" value={formData.costs.shippingCost || 0} onChange={e => setFormData({ ...formData, costs: { ...formData.costs, shippingCost: e.target.value } })} className="px-3 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-[#111827] text-sm outline-none focus:border-[#0EA5E9]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Packaging Cost (₹)</label>
                    <input type="number" step="0.01" min="0" value={formData.costs.packagingCost || 0} onChange={e => setFormData({ ...formData, costs: { ...formData.costs, packagingCost: e.target.value } })} className="px-3 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-[#111827] text-sm outline-none focus:border-[#0EA5E9]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Handling Cost (₹)</label>
                    <input type="number" step="0.01" min="0" value={formData.costs.handlingCost || 0} onChange={e => setFormData({ ...formData, costs: { ...formData.costs, handlingCost: e.target.value } })} className="px-3 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-[#111827] text-sm outline-none focus:border-[#0EA5E9]" />
                  </div>
                </div>
              </div>

              {/* MODULE 3: PRICING STRATEGY */}
              <div className="mb-8 border border-[#E5E7EB] rounded-lg overflow-hidden">
                <div className="bg-[#F9FAFB] px-4 py-3 border-b border-[#E5E7EB]">
                  <h3 className="text-sm font-bold text-[#111827] uppercase tracking-wider m-0">3. Pricing Strategy & Tiered Margins</h3>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-white">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Sell to Distributor (₹)</label>
                    <input type="number" step="0.01" min="0" value={formData.pricing.sellingPriceToDistributor || 0} onChange={e => setFormData({ ...formData, pricing: { ...formData.pricing, sellingPriceToDistributor: e.target.value } })} className="px-3 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-[#111827] text-sm outline-none focus:border-[#0EA5E9]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Dist. Sell to Retailer (₹)</label>
                    <input type="number" step="0.01" min="0" value={formData.pricing.distributorSellingPrice || 0} onChange={e => setFormData({ ...formData, pricing: { ...formData.pricing, distributorSellingPrice: e.target.value } })} className="px-3 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-[#111827] text-sm outline-none focus:border-[#0EA5E9]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Retail Selling Price (₹)</label>
                    <input type="number" step="0.01" min="0" value={formData.pricing.retailSellingPrice || 0} onChange={e => setFormData({ ...formData, pricing: { ...formData.pricing, retailSellingPrice: e.target.value } })} className="px-3 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-[#111827] text-sm outline-none focus:border-[#0EA5E9]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">MRP (Max Retail Price) (₹)</label>
                    <input type="number" step="0.01" min="0" value={formData.pricing.mrp || 0} onChange={e => setFormData({ ...formData, pricing: { ...formData.pricing, mrp: e.target.value } })} className="px-3 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-[#111827] text-sm outline-none focus:border-[#0EA5E9]" />
                  </div>
                </div>
              </div>

              {/* MODULE 4: INVENTORY CONTROL */}
              <div className="mb-8 border border-[#E5E7EB] rounded-lg overflow-hidden">
                <div className="bg-[#F9FAFB] px-4 py-3 border-b border-[#E5E7EB]">
                  <h3 className="text-sm font-bold text-[#111827] uppercase tracking-wider m-0">4. Inventory Control</h3>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Quantity in Stock</label>
                    <input type="number" min="0" value={formData.stock || 0} onChange={e => setFormData({ ...formData, stock: e.target.value })} className="px-3 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-[#111827] text-sm outline-none focus:border-[#0EA5E9]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Reorder Level Threshold</label>
                    <input type="number" min="0" value={formData.specs.reorderLevel || 0} onChange={e => setFormData({ ...formData, specs: { ...formData.specs, reorderLevel: e.target.value } })} className="px-3 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-[#111827] text-sm outline-none focus:border-[#0EA5E9]" />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-6">
                <button type="button" onClick={() => setIsFormOpen(false)} className="bg-white border border-[#D1D5DB] text-[#374151] hover:bg-[#F3F4F6] px-5 py-2 rounded-md text-sm font-semibold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white border-none px-6 py-2 rounded-md text-sm font-semibold cursor-pointer shadow-sm">
                  {editingId ? "Update Product" : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔴 DETAIL VIEW MODAL WITH ALL 34 CALCULATED DATA POINTS */}
      {isDetailOpen && viewProduct && (() => {
        // --- 11. Run Central Engine for Detail Modal View ---
        const metrics = calculateProductEconomics(viewProduct);
        
        const c = viewProduct.costs || {};
        const p = viewProduct.pricing || {};
        const s = viewProduct.specs || {};
        
        const StatRow = ({ label, val, highlight }) => (
          <div className="flex justify-between border-b border-[#E5E7EB] py-2 text-sm last:border-0 last:pb-0">
            <span className="text-[#6B7280]">{label}</span>
            <span className={`font-semibold ${highlight ? highlight : "text-[#111827]"}`}>{val}</span>
          </div>
        );

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6 backdrop-blur-sm">
            <div className="bg-white w-full max-w-5xl h-[90vh] flex flex-col rounded-xl shadow-xl border border-[#E5E7EB] relative">
              <div className="shrink-0 p-6 border-b border-[#E5E7EB] flex items-start gap-6 relative">
                <button onClick={() => setIsDetailOpen(false)} className="absolute top-5 right-5 bg-transparent border-none text-[#6B7280] hover:text-[#111827] cursor-pointer text-xl">✕</button>
                {viewProduct.image && viewProduct.image.startsWith('http') ? (
                  <img src={viewProduct.image} alt={viewProduct.name} className="w-20 h-20 object-cover border border-[#E5E7EB] rounded-lg shrink-0" />
                ) : (
                  <div className="w-20 h-20 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg flex items-center justify-center text-4xl shrink-0">📦</div>
                )}
                <div>
                  <h2 className="text-2xl font-bold text-[#111827] m-0 mb-2">{viewProduct.name || "-"}</h2>
                  <div className="flex gap-3 flex-wrap items-center">
                    <span className="px-2.5 py-1 bg-[#F3F4F6] text-[#4B5563] text-[10px] rounded-full font-bold uppercase tracking-wider border border-[#E5E7EB]">{viewProduct.category || "-"}</span>
                    <span className="text-sm text-[#6B7280]">SKU: {viewProduct.sku || "-"}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded border ${(s.status || 'Active') === 'Active' ? 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]' : 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]'}`}>{s.status || "Active"}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#F8F9FA]">
                
                {/* Module 1 */}
                <div className="bg-white p-5 rounded-lg border border-[#E5E7EB] shadow-sm">
                  <h3 className="text-xs font-bold text-[#0EA5E9] uppercase tracking-wider mb-4">1. Static Product Master Data</h3>
                  <StatRow label="SKU (Stock Keeping Unit)" val={viewProduct.sku || "-"} />
                  <StatRow label="Product Name" val={viewProduct.name || "-"} />
                  <StatRow label="Series / Collection" val={s.series || "-"} />
                  <StatRow label="Category" val={viewProduct.category || "-"} />
                  <StatRow label="Supplier" val={s.supplier || "-"} />
                  <StatRow label="Country of Origin" val={s.origin || "-"} />
                  <StatRow label="Warranty Period" val={s.warranty || "-"} />
                  <StatRow label="Product Status" val={s.status || "Active"} />
                </div>

                {/* Module 2 */}
                <div className="bg-white p-5 rounded-lg border border-[#E5E7EB] shadow-sm">
                  <h3 className="text-xs font-bold text-[#0EA5E9] uppercase tracking-wider mb-4">2. Procurement & Logistics Data</h3>
                  <StatRow label="Purchase Order (PO) No." val={c.poNumber || "-"} />
                  <StatRow label="Quantity Ordered" val={(c.qtyOrdered || 0).toLocaleString()} />
                  <StatRow label="Factory Price" val={`₹${(c.factoryPrice || 0).toLocaleString()}`} />
                  <StatRow label="Shipping Cost" val={`₹${(c.shippingCost || 0).toLocaleString()}`} />
                  <StatRow label="Packaging Cost" val={`₹${(c.packagingCost || 0).toLocaleString()}`} />
                  <StatRow label="Handling Cost" val={`₹${(c.handlingCost || 0).toLocaleString()}`} />
                  <StatRow label="Total Unit Cost (Landed)" val={`₹${metrics.totalUnitCost.toLocaleString()}`} highlight="text-[#065F46]" />
                  <StatRow label="Grand PO Cost" val={`₹${metrics.grandPOCost.toLocaleString()}`} />
                  <StatRow label="PO Status" val={c.poStatus || "Pending"} />
                </div>

                {/* Module 3 */}
                <div className="bg-white p-5 rounded-lg border border-[#E5E7EB] shadow-sm">
                  <h3 className="text-xs font-bold text-[#0EA5E9] uppercase tracking-wider mb-4">3. Pricing & Tiered Margins Data</h3>
                  <StatRow label="Selling Price to Distributor" val={`₹${(p.sellingPriceToDistributor || 0).toLocaleString()}`} />
                  <StatRow label="Company Profit" val={`₹${metrics.companyProfit.toLocaleString()}`} highlight="text-[#065F46]" />
                  <StatRow label="Company Markup %" val={`${metrics.companyMarkupPct.toFixed(1)}%`} />
                  <StatRow label="Distributor Selling Price" val={`₹${(p.distributorSellingPrice || 0).toLocaleString()}`} />
                  <StatRow label="Distributor Profit" val={`₹${metrics.distributorProfit.toLocaleString()}`} />
                  <StatRow label="Distributor Markup %" val={`${metrics.distributorMarkupPct.toFixed(1)}%`} />
                  <StatRow label="Retail Selling Price" val={`₹${(p.retailSellingPrice || 0).toLocaleString()}`} />
                  <StatRow label="Retail Profit" val={`₹${metrics.retailProfit.toLocaleString()}`} />
                  <StatRow label="Retail Markup %" val={`${metrics.retailMarkupPct.toFixed(1)}%`} />
                  <StatRow label="MRP" val={`₹${(p.mrp || 0).toLocaleString()}`} />
                  <StatRow label="Retailer Profit on MRP" val={`₹${metrics.retailerProfitOnMrp.toLocaleString()}`} />
                  <StatRow label="Retail Margin on MRP %" val={`${metrics.retailMarginOnMrpPct.toFixed(1)}%`} />
                  <StatRow label="Discount Amount" val={`₹${metrics.discountAmount.toLocaleString()}`} />
                  <StatRow label="Discount %" val={`${metrics.discountPct.toFixed(1)}%`} />
                </div>

                {/* Module 4 */}
                <div className="bg-white p-5 rounded-lg border border-[#E5E7EB] shadow-sm">
                  <h3 className="text-xs font-bold text-[#0EA5E9] uppercase tracking-wider mb-4">4. Inventory Control & Finance Data</h3>
                  <StatRow label="Quantity in Stock" val={(viewProduct.stock || 0).toLocaleString()} />
                  <StatRow label="Reorder Level" val={(s.reorderLevel || 0).toLocaleString()} />
                  <StatRow label="Stock Status" val={metrics.stockStatus} highlight={metrics.stockStatus === 'OK' ? "text-[#065F46]" : "text-[#991B1B]"} />
                  <StatRow label="Total Factory Cost Basis" val={`₹${metrics.totalFactoryCostBasis.toLocaleString()}`} />
                  <StatRow label="Total Shipping Cost Basis" val={`₹${metrics.totalShippingCostBasis.toLocaleString()}`} />
                  <StatRow label="Total Packaging Cost Basis" val={`₹${metrics.totalPackagingCostBasis.toLocaleString()}`} />
                  <StatRow label="Total Handling Cost Basis" val={`₹${metrics.totalHandlingCostBasis.toLocaleString()}`} />
                  <StatRow label="Inventory Value (At Cost)" val={`₹${metrics.inventoryValue.toLocaleString()}`} highlight="text-[#065F46]" />
                  <StatRow label="Total Retail Value (Forecast)" val={`₹${metrics.totalRetailValue.toLocaleString()}`} />
                  <StatRow label="Expected Profit" val={`₹${metrics.expectedProfit.toLocaleString()}`} highlight="text-[#0EA5E9]" />
                </div>

              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
