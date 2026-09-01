import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type PDFImage,
} from "pdf-lib";

// pdf-lib chosen over @react-pdf/renderer: it's pure TypeScript with no
// native/system dependencies (no Cairo/Pango, no headless browser), so it
// runs the same in Railway's container as it does locally. Trade-off is
// that layout (text wrapping, pagination) has to be done manually below —
// worth it for a personal tool where reliability matters more than
// polished typesetting.

interface QuestionForPdf {
  question: string;
  correct_answer?: string;
  explanation?: string;
  chartImageUrl?: string | null;
}

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_SIZE = 11;
const LINE_HEIGHT = 15;
const HEADER_TITLE_SIZE = 18;
const HEADER_SUBTITLE_SIZE = 10;

class PdfWriter {
  private doc!: PDFDocument;
  private font!: PDFFont;
  private boldFont!: PDFFont;
  private page!: PDFPage;
  private y = 0;

  static async create(): Promise<PdfWriter> {
    const writer = new PdfWriter();
    writer.doc = await PDFDocument.create();
    writer.font = await writer.doc.embedFont(StandardFonts.Helvetica);
    writer.boldFont = await writer.doc.embedFont(StandardFonts.HelveticaBold);
    writer.addPage();
    return writer;
  }

  private addPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensureSpace(neededHeight: number) {
    if (this.y - neededHeight < MARGIN) this.addPage();
  }

  private wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [""];
  }

  writeHeader(title: string, subtitle: string) {
    this.page.drawText(title, {
      x: MARGIN,
      y: this.y,
      size: HEADER_TITLE_SIZE,
      font: this.boldFont,
      color: rgb(0, 0, 0),
    });
    this.y -= HEADER_TITLE_SIZE + 4;

    this.page.drawText(subtitle, {
      x: MARGIN,
      y: this.y,
      size: HEADER_SUBTITLE_SIZE,
      font: this.font,
      color: rgb(0.35, 0.35, 0.35),
    });
    this.y -= HEADER_SUBTITLE_SIZE + 18;

    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
    this.y -= 20;
  }

  // Writes wrapped text starting with an optional bold/indented label
  // (e.g. "Answer:"), returning nothing — just advances y, paginating as
  // needed so nothing is cut off at a page boundary.
  private writeParagraph(text: string, opts: { indent?: number; bold?: boolean } = {}) {
    const indent = opts.indent ?? 0;
    const font = opts.bold ? this.boldFont : this.font;
    const lines = this.wrapText(text, font, BODY_SIZE, CONTENT_WIDTH - indent);

    for (const line of lines) {
      this.ensureSpace(LINE_HEIGHT);
      this.page.drawText(line, {
        x: MARGIN + indent,
        y: this.y,
        size: BODY_SIZE,
        font,
        color: rgb(0, 0, 0),
      });
      this.y -= LINE_HEIGHT;
    }
  }

  async writeQuestion(
    index: number,
    question: string,
    forAnswerSheet: boolean,
    chartImageUrl?: string | null
  ) {
    this.ensureSpace(LINE_HEIGHT * 2);
    this.writeParagraph(`${index + 1}. ${question}`, { bold: false });

    if (chartImageUrl) {
      await this.drawChartImage(chartImageUrl);
    }

    if (!forAnswerSheet) {
      // Leave room to write an answer by hand.
      this.y -= LINE_HEIGHT * 3;
    }
    this.y -= 6;
  }

  // Fetches the already-rendered chart PNG (same image used in both
  // quiz.pdf and solution.pdf — never regenerated per file) and embeds it
  // below the question, scaled to the content width without distorting
  // its aspect ratio.
  private async drawChartImage(imageUrl: string) {
    let image: PDFImage;
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`status ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      image = await this.doc.embedPng(bytes);
    } catch (err) {
      console.error(`[quiz/pdf] failed to embed chart image ${imageUrl}:`, err);
      return;
    }

    const scale = CONTENT_WIDTH / image.width;
    const drawWidth = CONTENT_WIDTH;
    const drawHeight = image.height * scale;

    this.ensureSpace(drawHeight + 12);
    this.page.drawImage(image, {
      x: MARGIN,
      y: this.y - drawHeight,
      width: drawWidth,
      height: drawHeight,
    });
    this.y -= drawHeight + 12;
  }

  writeAnswer(correctAnswer: string, explanation: string) {
    this.ensureSpace(LINE_HEIGHT);
    this.page.drawLine({
      start: { x: MARGIN + 12, y: this.y + LINE_HEIGHT - 4 },
      end: { x: MARGIN + 12, y: this.y - LINE_HEIGHT * 2 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    this.writeParagraph(`Answer: ${correctAnswer}`, { indent: 20, bold: true });
    this.writeParagraph(`Explanation: ${explanation}`, { indent: 20 });
    this.y -= 14;
  }

  async toBytes(): Promise<Uint8Array> {
    return this.doc.save();
  }
}

export async function buildQuizPdf(
  courseName: string,
  generatedAt: Date,
  questions: QuestionForPdf[]
): Promise<Uint8Array> {
  const writer = await PdfWriter.create();
  writer.writeHeader(
    `${courseName} — Practice Quiz`,
    `Generated ${generatedAt.toLocaleString()}`
  );

  for (let i = 0; i < questions.length; i++) {
    await writer.writeQuestion(i, questions[i].question, false, questions[i].chartImageUrl);
  }

  return writer.toBytes();
}

export async function buildSolutionPdf(
  courseName: string,
  generatedAt: Date,
  questions: QuestionForPdf[]
): Promise<Uint8Array> {
  const writer = await PdfWriter.create();
  writer.writeHeader(
    `${courseName} — Practice Quiz: Solutions`,
    `Generated ${generatedAt.toLocaleString()}`
  );

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await writer.writeQuestion(i, q.question, true, q.chartImageUrl);
    writer.writeAnswer(q.correct_answer ?? "", q.explanation ?? "");
  }

  return writer.toBytes();
}
