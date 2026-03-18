import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const generateInvoicePDF = (order, items = []) => {
  try {
    const doc = new jsPDF();
    const date = new Date(order.created_at).toLocaleDateString();

    // BRANDING
    doc.setFontSize(24);
    doc.setTextColor(0, 180, 216); 
    doc.text("CONQRETE", 14, 20);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("PREMIUM MOBILE ACCESSORIES", 14, 26);
    doc.text("Sangamner, Maharashtra | GSTIN: PENDING", 14, 31);

    // INVOICE BOX
    doc.setDrawColor(230);
    doc.line(140, 12, 196, 12);
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`INVOICE: ${order.order_number}`, 141, 20);
    doc.setFontSize(10);
    doc.text(`Date: ${date}`, 141, 27);

    doc.line(14, 45, 196, 45);
    doc.text("BILL TO:", 14, 55);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(order.customer_name || "Cash Customer", 14, 62);

    // TABLE
    const tableRows = items.map((item) => [
      item.product_name || "Product",
      item.sku || "-",
      item.quantity || 0,
      `INR ${Number(item.unit_price || 0).toLocaleString()}`,
      `INR ${Number(item.total_price || 0).toLocaleString()}`,
    ]);

    autoTable(doc, {
      startY: 75,
      head: [["Product Description", "SKU", "Qty", "Unit Price", "Total Amount"]],
      body: tableRows,
      theme: "striped",
      headStyles: { fillColor: [0, 180, 216], fontSize: 10 },
      styles: { fontSize: 9 }
    });

    const finalY = doc.lastAutoTable.finalY + 15;
    
    // TOTALS BOX
    doc.setDrawColor(0, 180, 216);
    doc.rect(130, finalY - 5, 66, 15);
    doc.setFontSize(12);
    doc.text(`GRAND TOTAL:  INR ${Number(order.total_amount || 0).toLocaleString()}`, 135, finalY + 5);

    // TERMS
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.setFont("helvetica", "normal");
    doc.text("TERMS & CONDITIONS:", 14, finalY + 25);
    doc.text("1. Goods once sold will not be taken back.", 14, finalY + 30);
    doc.text("2. Please check products for physical damage at the time of delivery.", 14, finalY + 35);
    
    doc.save(`CONQRETE_${order.order_number}.pdf`);
  } catch (err) {
    console.error("PDF Engine Error:", err);
    alert("PDF Error: " + err.message);
  }
};