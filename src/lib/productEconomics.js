export const calculateProductEconomics = (inputs) => {
  const c = inputs.costs || {};
  const p = inputs.pricing || {};
  const s = inputs.specs || {};
  const stock = parseInt(inputs.stock) || 0;

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

  const totalUnitCost = factoryPrice + shippingCost + packagingCost + handlingCost;
  const grandPOCost = totalUnitCost * qtyOrdered;

  const companyProfit = sellingPriceToDistributor - totalUnitCost;
  const companyMarkupPct = totalUnitCost ? (companyProfit / totalUnitCost) * 100 : 0;

  const distributorProfit = distributorSellingPrice - sellingPriceToDistributor;
  const distributorMarkupPct = sellingPriceToDistributor ? (distributorProfit / sellingPriceToDistributor) * 100 : 0;

  const retailProfit = retailSellingPrice - distributorSellingPrice;
  const retailMarkupPct = distributorSellingPrice ? (retailProfit / distributorSellingPrice) * 100 : 0;

  const retailerProfitOnMrp = mrp - distributorSellingPrice;
  const retailMarginOnMrpPct = mrp ? (retailerProfitOnMrp / mrp) * 100 : 0;

  const discountAmount = mrp - retailSellingPrice;
  const discountPct = mrp ? (discountAmount / mrp) * 100 : 0;

  const stockStatus = stock <= 0 ? 'Out of Stock' : (stock <= reorderLevel ? 'Low Stock' : 'OK');
  
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
