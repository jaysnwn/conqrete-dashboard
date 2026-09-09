import { NextResponse } from 'next/server';
import { syncProductToGoogleSheets } from '@/lib/googleSheets';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request) {
  try {
    const { productId } = await request.json();
    
    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    // 1. Read latest product from Supabase (Source of Truth)
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error || !product) {
      return NextResponse.json({ error: 'Product not found in Supabase' }, { status: 404 });
    }

    // 2. Sync to Google Sheets
    const result = await syncProductToGoogleSheets(product);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error syncing to Google Sheets:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
