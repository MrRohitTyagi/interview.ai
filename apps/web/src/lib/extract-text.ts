import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

const MIN_TEXT_LENGTH_HEURISTIC = 50;

export class ScannedPdfError extends Error {
  constructor() {
    super(
      "This PDF has no extractable text layer (likely a scanned image). " +
        "OCR support isn't implemented yet — please upload a text-based PDF or DOCX."
    );
    this.name = "ScannedPdfError";
  }
}

export async function extractResumeText(buffer: Buffer, contentType: string): Promise<string> {
  if (contentType === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    // A PDF with no real text layer (scanned/image-only) yields little to no
    // extractable text. OCR (Tesseract.js, per LLD Section 7) is the planned
    // fallback but isn't wired up yet.
    if (text.trim().length < MIN_TEXT_LENGTH_HEURISTIC) {
      throw new ScannedPdfError();
    }
    return text;
  }

  if (
    contentType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${contentType}`);
}
