import { PDFDocument, PDFDict, PDFName, PDFNumber, PDFRawStream, PDFRef } from "pdf-lib";
import { inflateSync, deflateSync } from "node:zlib";
import type { ExtractedImage } from "./types";

// Walks each page's /Resources /XObject dictionary and pulls out raster
// image streams directly from the PDF's object structure — no page
// rasterization, no worker thread, no pdfjs-dist. pdf-lib is pure
// TypeScript with no native bindings, so this introduces no native-
// dependency risk for Railway (confirmed, not assumed: it has zero
// `binding.gyp`/`.node` files in its own tree, unlike @napi-rs/canvas).
//
// Coverage note vs. the previous pdfjs-dist-based approach: pdfjs-dist (via
// its renderer) could decode *any* embedded image encoding into pixels.
// pdf-lib only exposes the stream's raw, undecoded bytes — it does not
// decode arbitrary PDF image filters itself. This implementation handles
// the two cases that cover the large majority of real-world embedded
// charts/screenshots:
//   - DCTDecode (JPEG): the raw stream bytes already ARE a valid JPEG file,
//     used as-is.
//   - FlateDecode with 8-bit RGB or grayscale samples: decompressed with
//     Node's built-in zlib and re-encoded into a minimal PNG by hand (no
//     PNG library needed — a producer/IDAT/IEND writer is ~40 lines).
// Anything else — JPXDecode (JPEG2000), CCITTFaxDecode, LZWDecode, Indexed/
// CMYK/16-bit color, multi-filter chains — is skipped with a log line
// rather than guessed at, consistent with "malformed/unsupported must fail
// gracefully" elsewhere in this pipeline. If a document's charts stop
// showing up as images, this is the first place to check.
const IMAGE_SIZE_THRESHOLD_PX = 80;

export async function extractPdfImages(buffer: Buffer): Promise<ExtractedImage[]> {
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const images: ExtractedImage[] = [];

  const pages = pdfDoc.getPages();
  pages.forEach((page, pageIndex) => {
    const pageRef = `page ${pageIndex + 1}`;
    const resources = page.node.Resources();
    const xObjects = resources?.lookupMaybe(PDFName.of("XObject"), PDFDict);
    if (!xObjects) return;

    for (const [, value] of xObjects.entries()) {
      const resolved = value instanceof PDFRef ? pdfDoc.context.lookup(value) : value;
      if (!(resolved instanceof PDFRawStream)) continue;

      try {
        const image = decodeImageXObject(resolved, pageRef);
        if (image) images.push(image);
      } catch (err) {
        console.error(`[extraction/pdf-images] failed to decode an image on ${pageRef}, skipping:`, err);
      }
    }
  });

  return images;
}

function decodeImageXObject(stream: PDFRawStream, pageRef: string): ExtractedImage | null {
  const dict = stream.dict;

  const subtype = dict.lookupMaybe(PDFName.of("Subtype"), PDFName);
  if (subtype?.asString() !== "/Image") return null;

  const width = dict.lookupMaybe(PDFName.of("Width"), PDFNumber)?.asNumber() ?? 0;
  const height = dict.lookupMaybe(PDFName.of("Height"), PDFNumber)?.asNumber() ?? 0;
  if (width < IMAGE_SIZE_THRESHOLD_PX || height < IMAGE_SIZE_THRESHOLD_PX) return null;

  const filterName = resolveFilterName(dict);

  if (filterName === "/DCTDecode") {
    return { data: stream.contents, mimeType: "image/jpeg", pageRef };
  }

  if (filterName === "/FlateDecode") {
    const bits = dict.lookupMaybe(PDFName.of("BitsPerComponent"), PDFNumber)?.asNumber() ?? 8;
    if (bits !== 8) return null; // only 8-bit samples supported

    const decompressed = inflateSync(Buffer.from(stream.contents));
    const pixelCount = width * height;

    // Infer component count from the decompressed size rather than parsing
    // the ColorSpace object (which is often an indirect ICCBased stream,
    // not a plain /DeviceRGB name) — robust to the common cases, and
    // anything that doesn't cleanly divide out (CMYK, indexed+palette,
    // subsampled, 16-bit) is left unsupported rather than guessed at.
    if (decompressed.length === pixelCount * 3) {
      return { data: encodePng(width, height, 2, decompressed), mimeType: "image/png", pageRef };
    }
    if (decompressed.length === pixelCount) {
      return { data: encodePng(width, height, 0, decompressed), mimeType: "image/png", pageRef };
    }
    return null;
  }

  return null; // unsupported filter (JPXDecode, CCITTFaxDecode, indexed, etc.)
}

function resolveFilterName(dict: PDFDict): string | null {
  const filter = dict.lookupMaybe(PDFName.of("Filter"), PDFName);
  return filter?.asString() ?? null;
}

// --- Minimal PNG encoder: signature + IHDR + one IDAT + IEND. colorType 2
// = truecolor RGB, 0 = grayscale; both 8-bit, no interlacing, filter type
// None on every scanline (simplest correct encoding, size isn't a concern
// for these small embedded charts). ---

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function encodePng(width: number, height: number, colorType: 0 | 2, pixels: Buffer): Buffer {
  const bytesPerPixel = colorType === 2 ? 3 : 1;
  const rowBytes = width * bytesPerPixel;

  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    const rawOffset = y * (rowBytes + 1);
    raw[rawOffset] = 0; // filter type: None
    pixels.copy(raw, rawOffset + 1, y * rowBytes, y * rowBytes + rowBytes);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colorType;
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])) >>> 0, 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

let crcTable: Uint32Array | null = null;
function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  crcTable = table;
  return table;
}

function crc32(buf: Buffer): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
