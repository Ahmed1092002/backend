import PDFDocument from "pdfkit";
import type { Writable } from "node:stream";
import type { OrderResponseDto } from "./orders.dto.js";

export function writeInvoicePdf(
  order: OrderResponseDto,
  output: Writable,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: 50 });
    document.on("error", reject);
    output.on("error", reject);
    output.on("finish", resolve);
    document.pipe(output);

    document.fontSize(22).text("Mini ERP", { align: "right" });
    document.fontSize(18).text("Invoice");
    document.moveDown(0.5);
    document.fontSize(10).text(`Order: ${order.id}`);
    document.text(`Issued: ${order.createdAt.toISOString()}`);
    document.text(`Status: ${order.status}`);
    document.moveDown();

    document.fontSize(11).text("Item", 50, document.y, { width: 230 });
    document.text("Qty", 290, document.y - 13, { width: 60, align: "right" });
    document.text("Unit price", 360, document.y - 13, { width: 80, align: "right" });
    document.text("Line total", 450, document.y - 13, { width: 95, align: "right" });
    document.moveTo(50, document.y + 5).lineTo(545, document.y + 5).stroke();
    document.moveDown();

    for (const item of order.items) {
      const y = document.y;
      document.fontSize(10).text(item.productName, 50, y, { width: 230 });
      document.text(String(item.quantity), 290, y, { width: 60, align: "right" });
      document.text(formatMoney(item.unitPrice), 360, y, { width: 80, align: "right" });
      document.text(formatMoney(item.unitPrice * item.quantity), 450, y, {
        width: 95,
        align: "right",
      });
      document.moveDown();
    }

    document.moveDown();
    document.fontSize(13).text(`Total: ${formatMoney(order.total)}`, {
      align: "right",
    });
    document.moveDown(2);
    document.fontSize(9).fillColor("#666666").text(
      "Thank you for your business.",
      { align: "center" },
    );
    document.end();
  });
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}
