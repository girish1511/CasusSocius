import { PDFDocument, StandardFonts } from "pdf-lib";
import { writeFileSync } from "fs";

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);

for (let i = 1; i <= 3; i++) {
  const page = doc.addPage([400, 400]);
  page.drawText(`This is page ${i} of a test document about supply and demand curves in microeconomics. Equilibrium price is where the two curves intersect.`, {
    x: 40, y: 300, size: 12, font, maxWidth: 320, lineHeight: 16,
  });
}

writeFileSync("/home/girishg/Desktop/CasusSocius/.tmp-smoke/test.pdf", await doc.save());
console.log("wrote test.pdf");
