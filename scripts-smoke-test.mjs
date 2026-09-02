import { PDFDocument } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";
import { extractPdfImages } from "/home/girishg/Desktop/CasusSocius/lib/extraction/pdf-images.ts";
import { extractPdf } from "/home/girishg/Desktop/CasusSocius/lib/extraction/pdf.ts";
import { writeFileSync } from "fs";

// Build a 200x150 test chart-like image (red rectangle on white) and encode both as JPEG and PNG.
function makeCanvas() {
  const c = createCanvas(200, 150);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 200, 150);
  ctx.fillStyle = "#d97757";
  ctx.fillRect(20, 20, 100, 80);
  ctx.fillStyle = "#111111";
  ctx.font = "16px sans-serif";
  ctx.fillText("Test Chart", 20, 130);
  return c;
}

const canvas = makeCanvas();
const jpegBuffer = canvas.toBuffer("image/jpeg");
const pngBuffer = canvas.toBuffer("image/png");

const pdfDoc = await PDFDocument.create();
const page = pdfDoc.addPage([400, 400]);

const jpgImage = await pdfDoc.embedJpg(jpegBuffer);
page.drawImage(jpgImage, { x: 20, y: 200, width: 200, height: 150 });

const pngImage = await pdfDoc.embedPng(pngBuffer);
page.drawImage(pngImage, { x: 20, y: 20, width: 200, height: 150 });

const pdfBytes = await pdfDoc.save();
writeFileSync("/tmp/test-with-images.pdf", pdfBytes);
console.log("test PDF bytes:", pdfBytes.length);

const images = await extractPdfImages(Buffer.from(pdfBytes));
console.log("extracted images:", images.length, images.map(i => ({ mimeType: i.mimeType, pageRef: i.pageRef, bytes: i.data.length })));

for (let i = 0; i < images.length; i++) {
  writeFileSync(`/tmp/extracted-${i}.${images[i].mimeType === "image/jpeg" ? "jpg" : "png"}`, images[i].data);
}

// Also confirm the full extractPdf() path (text+images together) runs without a worker error.
const result = await extractPdf(Buffer.from(pdfBytes));
console.log("full extractPdf: segments=", result.segments.length, "images=", result.images.length);
