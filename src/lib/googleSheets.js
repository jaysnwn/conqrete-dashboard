import { google } from 'googleapis';
import path from 'path';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const CREDENTIALS_PATH = path.join(process.cwd(), 'google-credentials.json');
const SPREADSHEET_ID = '1amSa4zsjau1n4ZlJYbWa5-p-ME_9AeUFOpLAAb5GPNY';
const WORKSHEET_NAME = 'CONQRETE Product Tracker';

export async function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: SCOPES,
  });
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

export async function getSheetHeaders() {
  const sheets = await getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${WORKSHEET_NAME}!A1:Z1`,
  });
  const rows = response.data.values;
  return rows && rows.length > 0 ? rows[0] : [];
}

export async function findRowBySku(sku) {
  const sheets = await getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${WORKSHEET_NAME}!A:Z`,
  });
  const rows = response.data.values;
  if (!rows || rows.length === 0) return null;
  
  const headers = rows[0];
  const skuIndex = headers.findIndex(h => h.toUpperCase() === 'SKU' || h.toUpperCase().includes('SKU'));
  if (skuIndex === -1) return null;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][skuIndex] === sku) {
      return { rowIndex: i, rowData: rows[i], headers, totalRows: rows.length };
    }
  }
  return { rowIndex: -1, rowData: null, headers, totalRows: rows.length };
}

function mapProductToRow(product, headers, existingRow = []) {
  return headers.map((header, idx) => {
    const h = header.trim();
    switch (h) {
      case 'SKU': return product.sku || '';
      case 'Product Name': return product.name || '';
      case 'Series/Collection': return product.specs?.series || '';
      case 'Category': return product.category || '';
      case 'Supplier': return product.specs?.supplier || '';
      case 'Country of Origin': return product.specs?.origin || '';
      case 'Warranty Period': return product.specs?.warranty || '';
      case 'Product Status': return product.specs?.status || '';
      case 'PO Number': return product.costs?.poNumber || '';
      case 'Quantity Ordered': return product.costs?.qtyOrdered || 0;
      case 'Factory Price': return product.costs?.factoryPrice || 0;
      case 'Shipping Cost': return product.costs?.shippingCost || 0;
      case 'Packaging Cost': return product.costs?.packagingCost || 0;
      case 'Handling Cost': return product.costs?.handlingCost || 0;
      case 'Total Unit Cost': return product.costs?.totalUnitCost || 0;
      case 'Grand PO Cost': return product.costs?.grandPOCost || 0;
      case 'PO Status': return product.costs?.poStatus || '';
      case 'Selling Price to Distributor': return product.pricing?.sellingPriceToDistributor || 0;
      case 'Your Profit': return product.pricing?.companyProfit || 0;
      case 'Your Markup': return product.pricing?.companyMarkupPct ? (product.pricing.companyMarkupPct / 100) : 0;
      case 'Distributor Selling Price': return product.pricing?.distributorSellingPrice || 0;
      case 'Distributor Profit': return product.pricing?.distributorProfit || 0;
      case 'Distributor Markup': return product.pricing?.distributorMarkupPct ? (product.pricing.distributorMarkupPct / 100) : 0;
      case 'Retail Selling Price': return product.pricing?.retailSellingPrice || 0;
      case 'Retail Profit': return product.pricing?.retailProfit || 0;
      case 'Retail Markup': return product.pricing?.retailMarkupPct ? (product.pricing.retailMarkupPct / 100) : 0;
      default: return existingRow[idx] !== undefined ? existingRow[idx] : '';
    }
  });
}

function numToCol(num) {
  let s = '';
  while (num >= 0) {
    s = String.fromCharCode(num % 26 + 65) + s;
    num = Math.floor(num / 26) - 1;
  }
  return s;
}

export async function syncProductToGoogleSheets(product) {
  if (!product || !product.sku) throw new Error('Invalid product or missing SKU');
  
  const searchResult = await findRowBySku(product.sku);
  if (!searchResult) throw new Error('Could not read Google Sheet');
  
  const { rowIndex, rowData, headers, totalRows } = searchResult;
  
  const sheets = await getGoogleSheetsClient();
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = metadata.data.sheets.find(s => s.properties.title === WORKSHEET_NAME);
  
  const protectedCols = new Set();
  if (sheet.protectedRanges) {
    for (const pr of sheet.protectedRanges) {
      if (pr.range && pr.range.startColumnIndex !== undefined) {
        for (let i = pr.range.startColumnIndex; i < pr.range.endColumnIndex; i++) {
          protectedCols.add(i);
        }
      }
    }
  }
  
  const mappedRow = mapProductToRow(product, headers, rowData || []);
  
  const blocks = [];
  let currentBlock = null;
  
  for (let i = 0; i < headers.length; i++) {
    if (!protectedCols.has(i)) {
      if (!currentBlock) currentBlock = { startIdx: i, values: [] };
      currentBlock.values.push(mappedRow[i]);
    } else {
      if (currentBlock) { blocks.push(currentBlock); currentBlock = null; }
    }
  }
  if (currentBlock) blocks.push(currentBlock);

  const rowNumber = rowIndex !== -1 ? rowIndex + 1 : totalRows + 1;
  
  const data = blocks.map(block => {
    const startCol = numToCol(block.startIdx);
    const endCol = numToCol(block.startIdx + block.values.length - 1);
    return {
      range: `${WORKSHEET_NAME}!${startCol}${rowNumber}:${endCol}${rowNumber}`,
      values: [block.values]
    };
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: data }
  });

  return { action: rowIndex !== -1 ? 'updated' : 'appended', sku: product.sku };
}
