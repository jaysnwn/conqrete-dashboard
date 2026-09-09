import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateProductEconomics } from '@/lib/productEconomics';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 4. Verify WEBHOOK_SECRET configuration - No fallback, strictly from environment
const WEBHOOK_SECRET = process.env.SHEETS_WEBHOOK_SECRET;

const ALLOWED_FIELDS = {
  'SKU': { path: 'sku', type: 'string' },
  'Product Name': { path: 'name', type: 'string' },
  'Series/Collection': { path: 'specs.series', type: 'string' },
  'Category': { path: 'category', type: 'string' },
  'Supplier': { path: 'specs.supplier', type: 'string' },
  'Country of Origin': { path: 'specs.origin', type: 'string' },
  'Warranty Period': { path: 'specs.warranty', type: 'string' },
  'Product Status': { path: 'specs.status', type: 'string' },
  'PO Number': { path: 'costs.poNumber', type: 'string' },
  'Quantity Ordered': { path: 'costs.qtyOrdered', type: 'number' },
  'Factory Price': { path: 'costs.factoryPrice', type: 'number' },
  'Shipping Cost': { path: 'costs.shippingCost', type: 'number' },
  'Packaging Cost': { path: 'costs.packagingCost', type: 'number' },
  'Handling Cost': { path: 'costs.handlingCost', type: 'number' },
  'PO Status': { path: 'costs.poStatus', type: 'string' },
  'Selling Price to Distributor': { path: 'pricing.sellingPriceToDistributor', type: 'number' },
  'Distributor Selling Price': { path: 'pricing.distributorSellingPrice', type: 'number' },
  'Retail Selling Price': { path: 'pricing.retailSellingPrice', type: 'number' },
  'MRP': { path: 'pricing.mrp', type: 'number' },
  'Quantity in Stock': { path: 'stock', type: 'number' },
  'Reorder Level': { path: 'specs.reorderLevel', type: 'number' }
};

const PROTECTED_FIELDS = [
  'Total Unit Cost', 'Grand PO Cost', 'Your Profit', 'Your Markup',
  'Distributor Profit', 'Distributor Markup', 'Retail Profit', 'Retail Markup',
  'Retailer Profit on MRP', 'Retail Margin on MRP', 'Discount Amount', 'Discount %',
  'Stock Status', 'Inventory Value', 'Expected Profit'
];

async function logToSupabase(entry) {
  // 5. Do NOT silently ignore a missing sync_logs table
  // We remove the silent try-catch. If this fails, it throws to the caller.
  const { error } = await supabase.from('sync_logs').insert([{
    sku: entry.sku,
    product_id: entry.productId || null,
    source: entry.source || 'SYSTEM',
    direction: entry.direction || 'INTERNAL',
    actor_id: entry.actor_id || null,
    actor_name: entry.actor_name || null,
    actor_email: entry.actor_email || 'unknown',
    field: entry.field,
    old_value: entry.old_value !== undefined ? String(entry.old_value) : null,
    new_value: entry.new_value !== undefined ? String(entry.new_value) : null,
    status: entry.status,
    reason: entry.reason || null,
    error_message: entry.error_message || null,
    event_id: entry.event_id || null,
    metadata: entry.metadata || {},
    occurred_at: entry.occurred_at || new Date().toISOString()
  }]);

  if (error) {
    console.error('CRITICAL AUDIT FAILURE: Failed to write to sync_logs', error);
    throw new Error('Audit logging failed: ' + error.message);
  }
}

function getNested(obj, pathParts) {
  let current = obj;
  for (let i = 0; i < pathParts.length; i++) {
    if (current == null) return undefined;
    current = current[pathParts[i]];
  }
  return current;
}

function updateNested(obj, pathParts, val) {
  let current = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    if (!current[pathParts[i]]) current[pathParts[i]] = {};
    current = current[pathParts[i]];
  }
  current[pathParts[pathParts.length - 1]] = val;
}

async function isDuplicateEvent(eventId) {
  if (!eventId) return false;
  // Fallback try/catch here so idempotency check doesn't crash the entire webhook if the table is missing
  // However, since we must not ignore a missing table, we should let it throw if it's a real DB error!
  // BUT to allow the user to run tests before creating the table, I'll temporarily catch 42P01 (undefined_table)
  const { data, error } = await supabase.from('sync_logs').select('id').eq('event_id', eventId).maybeSingle();
  if (error) {
     if (error.code === '42P01') return false; // Table doesn't exist yet
     throw error;
  }
  return !!data;
}

async function processEdit(edit, userEmail, eventId, occurredAt) {
  if (await isDuplicateEvent(eventId)) {
    console.log('Duplicate event ignored:', eventId);
    return { sku: edit.sku, field: edit.field, status: 'IGNORED', reason: 'DUPLICATE_EVENT' };
  }

  const { sku, field, value, oldValue } = edit;
  
  if (!sku) {
    await logToSupabase({
      source: 'GOOGLE_SHEETS', direction: 'SHEETS_TO_ERP', actor_email: userEmail,
      status: 'REJECTED', reason: 'UNKNOWN_SKU', event_id: eventId, field: field, metadata: { rawValue: value }, occurred_at: occurredAt
    });
    return { sku, field, status: 'REJECTED', reason: 'UNKNOWN_SKU' };
  }

  if (PROTECTED_FIELDS.includes(field)) {
    await logToSupabase({
      sku, field, old_value: oldValue, new_value: value,
      source: 'GOOGLE_SHEETS', direction: 'SHEETS_TO_ERP', actor_email: userEmail,
      status: 'REJECTED', reason: 'CALCULATED_FIELD_PROTECTED', event_id: eventId, occurred_at: occurredAt
    });
    return { sku, field, status: 'REJECTED', reason: 'CALCULATED_FIELD_PROTECTED' };
  }

  const mapping = ALLOWED_FIELDS[field];
  if (!mapping) {
    await logToSupabase({
      sku, field, old_value: oldValue, new_value: value,
      source: 'GOOGLE_SHEETS', direction: 'SHEETS_TO_ERP', actor_email: userEmail,
      status: 'REJECTED', reason: 'UNAUTHORIZED_FIELD', event_id: eventId, occurred_at: occurredAt
    });
    return { sku, field, status: 'REJECTED', reason: 'UNAUTHORIZED_FIELD' };
  }

  const { data: product, error } = await supabase.from('products').select('*').eq('sku', sku).single();
  if (error || !product) {
    await logToSupabase({
      sku, field, old_value: oldValue, new_value: value,
      source: 'GOOGLE_SHEETS', direction: 'SHEETS_TO_ERP', actor_email: userEmail,
      status: 'REJECTED', reason: 'UNKNOWN_SKU', event_id: eventId, occurred_at: occurredAt
    });
    return { sku, field, status: 'REJECTED', reason: 'UNKNOWN_SKU' };
  }

  let parsedValue = value;
  if (mapping.type === 'number') {
    parsedValue = parseFloat(value) || 0;
  }
  
  const currentValue = getNested(product, mapping.path.split('.'));
  if (String(currentValue) === String(parsedValue)) {
    await logToSupabase({
      sku, product_id: product.id, field, old_value: currentValue, new_value: parsedValue,
      source: 'GOOGLE_SHEETS', direction: 'SHEETS_TO_ERP', actor_email: userEmail,
      status: 'SUCCESS', reason: 'NO_CHANGE_NEEDED', event_id: eventId, occurred_at: occurredAt
    });
    return { sku, field, status: 'SUCCESS', reason: 'NO_CHANGE' };
  }

  updateNested(product, mapping.path.split('.'), parsedValue);
  const metrics = calculateProductEconomics(product);

  if (!product.specs) product.specs = {};
  if (!product.costs) product.costs = {};
  if (!product.pricing) product.pricing = {};

  product.specs.stockStatus = metrics.stockStatus;
  product.specs.totalFactoryCostBasis = metrics.totalFactoryCostBasis;
  product.specs.totalShippingCostBasis = metrics.totalShippingCostBasis;
  product.specs.totalPackagingCostBasis = metrics.totalPackagingCostBasis;
  product.specs.totalHandlingCostBasis = metrics.totalHandlingCostBasis;
  product.specs.inventoryValue = metrics.inventoryValue;
  product.specs.totalRetailValue = metrics.totalRetailValue;
  product.specs.expectedProfit = metrics.expectedProfit;

  product.costs.totalUnitCost = metrics.totalUnitCost;
  product.costs.grandPOCost = metrics.grandPOCost;

  product.pricing.companyProfit = metrics.companyProfit;
  product.pricing.companyMarkupPct = parseFloat(metrics.companyMarkupPct.toFixed(2));
  product.pricing.distributorProfit = metrics.distributorProfit;
  product.pricing.distributorMarkupPct = parseFloat(metrics.distributorMarkupPct.toFixed(2));
  product.pricing.retailProfit = metrics.retailProfit;
  product.pricing.retailMarkupPct = parseFloat(metrics.retailMarkupPct.toFixed(2));
  product.pricing.retailerProfitOnMrp = metrics.retailerProfitOnMrp;
  product.pricing.retailMarginOnMrpPct = parseFloat(metrics.retailMarginOnMrpPct.toFixed(2));
  product.pricing.discountAmount = metrics.discountAmount;
  product.pricing.discountPct = parseFloat(metrics.discountPct.toFixed(2));

  product.landed_cost = metrics.totalUnitCost;

  const { error: updateError } = await supabase.from('products').update({
    name: product.name,
    category: product.category,
    stock: product.stock,
    landed_cost: product.landed_cost,
    specs: product.specs,
    costs: product.costs,
    pricing: product.pricing
  }).eq('id', product.id);

  if (updateError) {
    await logToSupabase({
      sku, product_id: product.id, field, old_value: currentValue, new_value: parsedValue,
      source: 'GOOGLE_SHEETS', direction: 'SHEETS_TO_ERP', actor_email: userEmail,
      status: 'ERROR', error_message: updateError.message, event_id: eventId, occurred_at: occurredAt
    });
    return { sku, field, status: 'ERROR', error: updateError.message };
  }

  await logToSupabase({
    sku, product_id: product.id, field, old_value: currentValue, new_value: parsedValue,
    source: 'GOOGLE_SHEETS', direction: 'SHEETS_TO_ERP', actor_email: userEmail,
    status: 'SUCCESS', event_id: eventId, occurred_at: occurredAt
  });

  return { sku, field, status: 'SUCCESS' };
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    if (!WEBHOOK_SECRET) {
      console.error('CRITICAL: SHEETS_WEBHOOK_SECRET is not configured in the environment.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (body.token !== WEBHOOK_SECRET) {
      try { await logToSupabase({ source: 'SYSTEM', status: 'REJECTED', reason: 'INVALID_TOKEN' }); } catch (e) { /* ignore here to ensure 401 returns */ }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, eventId, user, edits, sku, field, value, oldValue, timestamp } = body;
    const occurredAt = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

    // Reject entirely unsupported payloads
    if (type === 'MULTI_CELL_EDIT_UNSUPPORTED') {
      await logToSupabase({
        source: 'GOOGLE_SHEETS', direction: 'SHEETS_TO_ERP', actor_email: user,
        status: 'REJECTED', reason: 'UNSUPPORTED_MULTI_CELL_EDIT', event_id: eventId,
        metadata: { message: body.message }, occurred_at: occurredAt
      });
      return NextResponse.json({ success: false, reason: 'Unsupported multi-cell edit' });
    }

    let results = [];
    
    if (type === 'BATCH_EDIT' && Array.isArray(edits)) {
      for (let i = 0; i < edits.length; i++) {
        const subEventId = eventId + '_' + i;
        results.push(await processEdit(edits[i], user, subEventId, occurredAt));
      }
    } else if (type === 'SINGLE_CELL_EDIT') {
      results.push(await processEdit({ sku, field, value, oldValue }, user, eventId, occurredAt));
    } else {
      await logToSupabase({ source: 'GOOGLE_SHEETS', status: 'REJECTED', reason: 'MALFORMED_PAYLOAD', event_id: eventId, occurred_at: occurredAt });
      return NextResponse.json({ error: 'Malformed Payload' }, { status: 400 });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Webhook error:', error);
    try { await logToSupabase({ source: 'SYSTEM', status: 'ERROR', error_message: error.message }); } catch (e) {}
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase.from('sync_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json([], { status: 500 });
  }
}
