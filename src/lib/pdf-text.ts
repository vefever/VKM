// Client-side document → plain text. Runs entirely in the browser: the file is
// never uploaded, so there's no storage cost and no privacy exposure — only the
// extracted text is sent to the server for AI extraction.
//
// Supports PDF (via pdfjs-dist) plus plain-text / CSV / Markdown. pdfjs is
// dynamically imported so it stays out of the SSR bundle and only loads when a
// user actually picks a file.

import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export const ACCEPTED_DOC_TYPES = ".pdf,.txt,.csv,.md";
export const MAX_DOC_BYTES = 15 * 1024 * 1024; // 15 MB

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Vite resolves the worker to a real URL above; wire it up once.
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc as string;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  try {
    const pages: string[] = [];
    // Cap pages so a giant PDF can't hang the tab; first ~30 pages is plenty
    // for a business plan / profile.
    const max = Math.min(doc.numPages, 30);
    for (let i = 1; i <= max; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((it) => {
          const str = (it as { str?: unknown }).str;
          return typeof str === "string" ? str : "";
        })
        .join(" ");
      pages.push(text);
    }
    return pages.join("\n\n");
  } finally {
    // Release worker resources.
    doc.destroy().catch(() => {});
  }
}

/** Extract readable text from a user-selected document. Throws on bad input. */
export async function extractDocumentText(file: File): Promise<string> {
  if (file.size > MAX_DOC_BYTES) {
    throw new Error("That file is too large (max 15 MB).");
  }
  const raw = isPdf(file) ? await extractPdf(file) : await file.text();
  // Collapse runs of whitespace and tidy line endings so the model gets clean text.
  const clean = raw
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n/g, "\n")
    .trim();
  if (clean.length < 20) {
    throw new Error(
      "Couldn't read text from that file. If it's a scanned PDF (images only), enter the details manually.",
    );
  }
  return clean;
}
