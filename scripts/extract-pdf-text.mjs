// Extract raw text from a PDF into a .txt seed file, one block per page.
//
// Usage: node scripts/extract-pdf-text.mjs <input.pdf> <output.txt>
//
// Used to turn Venu Kalyan's workbooks (MS Workbook, UBM Batch 17) into the
// plain-text seed files under src/content/knowledge/, which
// scripts/ingest-knowledge.mjs then chunks + embeds into vk_knowledge.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage: node scripts/extract-pdf-text.mjs <input.pdf> <output.txt>");
  process.exit(1);
}

// Legacy build = no worker thread, no DOM: the only pdfjs entry that runs under
// plain Node. require.resolve returns a Windows path, which the ESM loader
// rejects, so hand it a file:// URL.
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
).href;

const data = new Uint8Array(await readFile(input));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

const pages = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  // pdfjs emits one item per text run; `hasEOL` marks a real line break, so we
  // rebuild lines instead of collapsing the whole page into one long string.
  let text = "";
  for (const item of content.items) {
    if (!("str" in item)) continue;
    text += item.str;
    if (item.hasEOL) text += "\n";
    else if (item.str && !item.str.endsWith(" ")) text += " ";
  }

  // Drop Telugu script. The workbooks are bilingual, but pdfjs reorders Telugu
  // glyph clusters into unreadable mojibake (and some runs use a custom font
  // encoding that decodes to U+FFFD), while the avatar is hard-bound to reply in
  // English letters only. The English column carries the same teaching, so the
  // Telugu column is pure noise in a retrieval chunk.
  const clean = text
    .replace(/[ఀ-౿​-‍�]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n");

  // Stripping the script leaves behind lines of orphaned punctuation. Keep only
  // lines that still carry real Latin words.
  const kept = clean
    .split("\n")
    .filter((l) => (l.match(/[A-Za-z0-9]/g) ?? []).length >= 3)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (kept.length > 20) pages.push(`[page ${i}]\n${kept}`);
  if (i % 50 === 0) console.error(`  ...${i}/${doc.numPages} pages`);
}

await mkdir(dirname(output), { recursive: true });
await writeFile(output, pages.join("\n\n"), "utf8");
console.error(`${input} -> ${output}: ${doc.numPages} pages, ${pages.length} kept`);
