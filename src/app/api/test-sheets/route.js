import { NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/googleSheets';

const SPREADSHEET_ID = '1amSa4zsjau1n4ZlJYbWa5-p-ME_9AeUFOpLAAb5GPNY';
const WORKSHEET_NAME = 'CONQRETE Product Tracker';

export async function GET() {
  try {
    const sheets = await getGoogleSheetsClient();

    // Read the spreadsheet data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: WORKSHEET_NAME + '!A1:Z',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ status: 'Error', message: 'No data found.' });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    // Find the SKU column index
    let skuIndex = headers.findIndex(h => h.toUpperCase().includes('SKU'));
    if (skuIndex === -1) skuIndex = 0; // fallback if not found

    const firstSkus = dataRows
      .slice(0, 5)
      .map(row => row[skuIndex])
      .filter(Boolean);

    return NextResponse.json({
      connectionStatus: 'Success',
      worksheetName: WORKSHEET_NAME,
      detectedHeaders: headers,
      numberOfDataRows: dataRows.length,
      firstFewSkus: firstSkus,
    });
  } catch (error) {
    console.error('Error connecting to Google Sheets:', error);
    return NextResponse.json({
      connectionStatus: 'Failed',
      error: error.message
    }, { status: 500 });
  }
}
