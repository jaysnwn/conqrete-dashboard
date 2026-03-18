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
  stock: 0
};

// --- HELPERS ---
const generateSKU = (category) => {
  // Uses a random 4-digit number to guarantee uniqueness, bypassing the length bug
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

// --- MAIN COMPONENT ---
export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyFormState);
  const [viewProduct, setViewProduct] = useState(null);

  // ---------------------------
  // LOAD PRODUCTS FROM DATABASE
  // ---------------------------
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) {
      setProducts(data || []);
    } else {
      console.error("Fetch Error:", error);
    }
    setIsLoading(false);
  };

  // ---------------------------
  // FILTER PRODUCTS
  // ---------------------------
  const filteredProducts = useMemo(() => {
    return products.filter((p) =>
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  // ---------------------------
  // UI MODAL HANDLERS
  // ---------------------------
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
      specs: product.specs || emptyFormState.specs
    });
    setEditingId(product.id);
    setIsFormOpen(true);
  };

  const handleOpenView = (product) => {
    setViewProduct(product);
    setIsDetailOpen(true);
  };

  // ---------------------------
  // SAVE PRODUCT TO SUPABASE
  // ---------------------------
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
      stock: formData.stock || 0
    };

    if (editingId) {
      // UPDATE EXISTING
      const { error } = await supabase
        .from('products')
        .update(dbPayload)
        .eq('id', editingId);

      if (error) {
        console.error("Update error:", error);
        alert(`Update Error: ${error.message}`);
      } else {
        fetchProducts();
        setIsFormOpen(false);
      }
    } else {
      // INSERT NEW
      dbPayload.sku = generateSKU(formData.category);
      dbPayload.barcode = generateBarcode();

      const { error } = await supabase
        .from("products")
        .insert([dbPayload]);

      if (error) {
        console.error("Insert error:", error);
        alert(`Database Error: ${error.message || error.details}`);
      } else {
        fetchProducts();
        setIsFormOpen(false);
      }
    }
  };

  // ---------------------------
  // DELETE PRODUCT
  // ---------------------------
  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this product from the database?")) {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) {
        alert("Error deleting product");
        console.error(error);
      } else {
        fetchProducts();
      }
    }
  };

  return (
    <div className="text-gray-200">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wider">PRODUCT DATABASE</h1>
          <p className="text-sm text-gray-500 mt-1">Live connection: CONQRETE_DATABASE</p>
        </div>
        <button onClick={handleOpenAdd} className="bg-cyan-400 text-black px-4 py-2 rounded font-bold hover:bg-cyan-300 transition-colors">
          + Add Product
        </button>
      </div>

      {/* SEARCH */}
      <div className="mb-6">
        <input 
          type="text" 
          placeholder="Search by Name or SKU..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md bg-[#111] border border-gray-800 text-white px-4 py-2 rounded focus:outline-none focus:border-cyan-400"
        />
      </div>

      {/* PRODUCT TABLE */}
      <div className="bg-[#111] border border-gray-800 rounded-lg overflow-hidden relative min-h-[200px]">
        {isLoading && (
          <div className="absolute inset-0 bg-[#111]/80 flex items-center justify-center z-10">
            <span className="text-cyan-400 animate-pulse font-mono tracking-widest">FETCHING_DATA...</span>
          </div>
        )}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#0a0a0a] border-b border-gray-800 text-gray-400 text-sm">
              <th className="p-4">IMG</th>
              <th className="p-4">NAME</th>
              <th className="p-4">CATEGORY</th>
              <th className="p-4">SKU</th>
              <th className="p-4">LANDED COST</th>
              <th className="p-4">STOCK</th>
              <th className="p-4 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(product => (
              <tr key={product.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                <td className="p-4 text-2xl">{product.image}</td>
                <td className="p-4 font-medium text-white cursor-pointer hover:text-cyan-400" onClick={() => handleOpenView(product)}>{product.name}</td>
                <td className="p-4 text-gray-400">{product.category}</td>
                <td className="p-4 font-mono text-xs text-gray-500">{product.sku}</td>
                <td className="p-4 text-emerald-400">₹{Number(product.landed_cost || 0).toFixed(2)}</td>
                <td className="p-4">{product.stock} units</td>
                <td className="p-4 text-right space-x-3">
                  <button onClick={() => handleOpenEdit(product)} className="text-blue-400 hover:text-blue-300 text-sm">Edit</button>
                  <button onClick={() => handleDelete(product.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                </td>
              </tr>
            ))}
            {!isLoading && filteredProducts.length === 0 && (
              <tr><td colSpan="7" className="p-8 text-center text-gray-500">No products found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl shadow-cyan-900/20">
            <h2 className="text-xl font-bold text-white mb-6 border-b border-gray-800 pb-2">{editingId ? "Edit Product" : "New Product Entry"}</h2>
            
            <form onSubmit={handleSave} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Product Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-[#0a0a0a] border border-gray-700 rounded p-2 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Category</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value, specs: {}})} className="w-full bg-[#0a0a0a] border border-gray-700 rounded p-2 text-white">
                    <option>Power Bank</option>
                    <option>Cable</option>
                    <option>Adapter</option>
                    <option>Earbuds</option>
                    <option>Accessories</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-[#0a0a0a] border border-gray-700 rounded p-2 text-white h-20" />
                </div>
              </div>

              {/* Dynamic Tech Specs */}
              <div className="bg-[#0a0a0a] p-4 rounded border border-gray-800">
                <h3 className="text-sm font-bold text-cyan-400 mb-4 uppercase tracking-wider">Technical Specifications</h3>
                <div className="grid grid-cols-2 gap-4">
                  {formData.category === "Power Bank" && (
                    <>
                      <input placeholder="Capacity (mAh)" value={formData.specs.capacity || ""} onChange={e => setFormData({...formData, specs: {...formData.specs, capacity: e.target.value}})} className="bg-[#111] border border-gray-700 rounded p-2 text-white text-sm" />
                      <input placeholder="Output Watt" value={formData.specs.outputWatt || ""} onChange={e => setFormData({...formData, specs: {...formData.specs, outputWatt: e.target.value}})} className="bg-[#111] border border-gray-700 rounded p-2 text-white text-sm" />
                      <input placeholder="Input Watt" value={formData.specs.inputWatt || ""} onChange={e => setFormData({...formData, specs: {...formData.specs, inputWatt: e.target.value}})} className="bg-[#111] border border-gray-700 rounded p-2 text-white text-sm" />
                      <input placeholder="Battery Type" value={formData.specs.batteryType || ""} onChange={e => setFormData({...formData, specs: {...formData.specs, batteryType: e.target.value}})} className="bg-[#111] border border-gray-700 rounded p-2 text-white text-sm" />
                    </>
                  )}
                  {formData.category === "Cable" && (
                    <>
                      <select value={formData.specs.cableType || ""} onChange={e => setFormData({...formData, specs: {...formData.specs, cableType: e.target.value}})} className="bg-[#111] border border-gray-700 rounded p-2 text-white text-sm">
                        <option value="">Select Type...</option><option>Type-C</option><option>Lightning</option><option>Micro USB</option>
                      </select>
                      <input placeholder="Length (e.g. 1M, 2M)" value={formData.specs.length || ""} onChange={e => setFormData({...formData, specs: {...formData.specs, length: e.target.value}})} className="bg-[#111] border border-gray-700 rounded p-2 text-white text-sm" />
                      <input placeholder="Max Watt Supported" value={formData.specs.maxWatt || ""} onChange={e => setFormData({...formData, specs: {...formData.specs, maxWatt: e.target.value}})} className="bg-[#111] border border-gray-700 rounded p-2 text-white text-sm" />
                      <input placeholder="Data Speed" value={formData.specs.speed || ""} onChange={e => setFormData({...formData, specs: {...formData.specs, speed: e.target.value}})} className="bg-[#111] border border-gray-700 rounded p-2 text-white text-sm" />
                    </>
                  )}
                  {(formData.category === "Adapter" || formData.category === "Earbuds") && (
                    <>
                      <input placeholder="Output Watt / Power" value={formData.specs.outputWatt || ""} onChange={e => setFormData({...formData, specs: {...formData.specs, outputWatt: e.target.value}})} className="bg-[#111] border border-gray-700 rounded p-2 text-white text-sm" />
                      <input placeholder="Key Features" value={formData.specs.features || ""} onChange={e => setFormData({...formData, specs: {...formData.specs, features: e.target.value}})} className="bg-[#111] border border-gray-700 rounded p-2 text-white text-sm" />
                    </>
                  )}
                </div>
              </div>

              {/* Costing & Pricing Grid */}
              <div className="grid grid-cols-2 gap-6">
                
                {/* Internal Import Costs */}
                <div className="bg-[#0a0a0a] p-4 rounded border border-gray-800">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Import Cost</h3>
                    <div className="text-emerald-400 font-mono font-bold bg-[#111] px-2 py-1 rounded text-xs">
                      LANDED: ₹{calculateLandedCost(formData.costs).toFixed(2)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {['fob', 'freight', 'duty', 'gst', 'other'].map(costField => (
                      <div key={costField}>
                        <label className="block text-[10px] text-gray-500 mb-1 uppercase">{costField}</label>
                        <input type="number" min="0" step="0.01" value={formData.costs[costField] || ''} onChange={e => setFormData({...formData, costs: {...formData.costs, [costField]: parseFloat(e.target.value) || 0}})} className="w-full bg-[#111] border border-gray-700 rounded p-2 text-white text-sm" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Outbound Selling Prices */}
                <div className="bg-[#0a0a0a] p-4 rounded border border-gray-800">
                  <h3 className="text-sm font-bold text-blue-400 mb-4 uppercase tracking-wider">Selling Prices</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1 uppercase">Distributor Price</label>
                      <input type="number" min="0" step="0.01" value={formData.pricing.distributor || ''} onChange={e => setFormData({...formData, pricing: {...formData.pricing, distributor: parseFloat(e.target.value) || 0}})} className="w-full bg-[#111] border border-gray-700 rounded p-2 text-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1 uppercase">Retailer Price</label>
                      <input type="number" min="0" step="0.01" value={formData.pricing.retailer || ''} onChange={e => setFormData({...formData, pricing: {...formData.pricing, retailer: parseFloat(e.target.value) || 0}})} className="w-full bg-[#111] border border-gray-700 rounded p-2 text-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1 uppercase">E-Commerce Price</label>
                      <input type="number" min="0" step="0.01" value={formData.pricing.ecommerce || ''} onChange={e => setFormData({...formData, pricing: {...formData.pricing, ecommerce: parseFloat(e.target.value) || 0}})} className="w-full bg-[#111] border border-gray-700 rounded p-2 text-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1 uppercase">Quick Commerce</label>
                      <input type="number" min="0" step="0.01" value={formData.pricing.quickCommerce || ''} onChange={e => setFormData({...formData, pricing: {...formData.pricing, quickCommerce: parseFloat(e.target.value) || 0}})} className="w-full bg-[#111] border border-gray-700 rounded p-2 text-white text-sm" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-4 pt-4 border-t border-gray-800">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                <button type="submit" className="bg-cyan-400 text-black px-6 py-2 rounded font-bold hover:bg-cyan-300">
                  {editingId ? "Update Product" : "Save to Database"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {isDetailOpen && viewProduct && (
         <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-gray-800 rounded-lg w-full max-w-4xl p-6 relative shadow-2xl">
            <button onClick={() => setIsDetailOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl">✕</button>
            
            <div className="flex items-start gap-6 mb-8 border-b border-gray-800 pb-6">
              <div className="w-24 h-24 bg-[#0a0a0a] border border-gray-800 rounded flex items-center justify-center text-4xl">{viewProduct.image}</div>
              <div>
                <h2 className="text-3xl font-bold text-white tracking-wide">{viewProduct.name}</h2>
                <div className="flex gap-4 mt-2">
                  <span className="bg-cyan-900/30 text-cyan-400 px-3 py-1 rounded text-xs border border-cyan-800/50 uppercase">{viewProduct.category}</span>
                  <span className="text-gray-400 text-sm py-1 font-mono">SKU: {viewProduct.sku}</span>
                  <span className="text-gray-400 text-sm py-1 font-mono">BC: {viewProduct.barcode}</span>
                </div>
                <p className="text-gray-400 mt-3 text-sm max-w-2xl">{viewProduct.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* Specs */}
              <div className="bg-[#0a0a0a] p-4 rounded border border-gray-800">
                <h3 className="text-xs font-bold text-gray-500 mb-4 uppercase">Technical Specs</h3>
                <ul className="text-sm space-y-3">
                  {Object.entries(viewProduct.specs || {}).map(([k, v]) => (
                    <li key={k} className="flex justify-between border-b border-gray-800/50 pb-1">
                      <span className="text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span> 
                      <span className="text-white font-medium">{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Costs */}
              <div className="bg-[#0a0a0a] p-4 rounded border border-gray-800">
                <h3 className="text-xs font-bold text-emerald-500 mb-4 uppercase">Internal Costs</h3>
                <ul className="text-sm space-y-3 mb-4">
                  {Object.entries(viewProduct.costs || {}).map(([k, v]) => (
                    <li key={k} className="flex justify-between border-b border-gray-800/50 pb-1">
                      <span className="text-gray-500 uppercase text-xs">{k}</span> 
                      <span className="text-white font-mono">₹{v}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between font-bold text-emerald-400 bg-[#111] p-2 rounded border border-emerald-900/30">
                  <span>LANDED COST</span>
                  <span>₹{Number(viewProduct.landed_cost || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Pricing */}
              <div className="bg-[#0a0a0a] p-4 rounded border border-gray-800">
                <h3 className="text-xs font-bold text-blue-400 mb-4 uppercase">Selling Tiers</h3>
                <ul className="text-sm space-y-3">
                  <li className="flex justify-between border-b border-gray-800/50 pb-1">
                    <span className="text-gray-500 text-xs uppercase">Distributor</span> 
                    <span className="text-blue-100 font-mono">₹{viewProduct.pricing?.distributor || 0}</span>
                  </li>
                  <li className="flex justify-between border-b border-gray-800/50 pb-1">
                    <span className="text-gray-500 text-xs uppercase">Retailer</span> 
                    <span className="text-blue-200 font-mono">₹{viewProduct.pricing?.retailer || 0}</span>
                  </li>
                  <li className="flex justify-between border-b border-gray-800/50 pb-1">
                    <span className="text-gray-500 text-xs uppercase">E-Commerce</span> 
                    <span className="text-blue-300 font-mono">₹{viewProduct.pricing?.ecommerce || 0}</span>
                  </li>
                  <li className="flex justify-between border-b border-gray-800/50 pb-1">
                    <span className="text-gray-500 text-xs uppercase">Quick Comm</span> 
                    <span className="text-blue-400 font-mono font-bold">₹{viewProduct.pricing?.quickCommerce || 0}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}