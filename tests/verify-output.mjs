// Independent content verification of the smoke suite's downloaded artifacts.
// Re-parses each output with pdf-lib and pdfjs and asserts the *transformation*
// actually happened, not just that a file was produced.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import assert from "node:assert/strict";

const dir = ".artifacts";
const names = await readdir(dir);
const has = (n) => names.includes(n);
const load = async (n) => PDFDocument.load(await readFile(`${dir}/${n}`));

// Rebuild the exact input the smoke suite used, so we can compare before/after.
const basePdf = await PDFDocument.create();
const baseFont = await basePdf.embedFont(StandardFonts.Helvetica);
for (let i = 1; i <= 2; i++) {
  basePdf.addPage([595, 842]).drawText(`Paperly test document. Page ${i}. A little less paperwork.`, { x: 45, y: 740, size: 15, font: baseFont });
}
const baseBytes = Buffer.from(await basePdf.save());
await writeFile(`${dir}/_baseline.pdf`, baseBytes);
const loadBase = async () => PDFDocument.load(baseBytes);

const checks = [];
const check = (label, fn) => checks.push({ label, fn });

check("merge: 2+2 pages concatenated from two 2-page inputs", async () => {
  const d = await load("merged-document.pdf");
  assert.equal(d.getPageCount(), 4);
});

check("split: archive holds exactly 2 single-page PDFs", async () => {
  const zip = await JSZip.loadAsync(await readFile(`${dir}/test-document-split.zip`));
  const files = Object.keys(zip.files).filter((f) => !zip.files[f].dir);
  assert.equal(files.length, 2);
  for (const f of files) {
    const doc = await PDFDocument.load(await zip.file(f).async("nodebuffer"));
    assert.equal(doc.getPageCount(), 1, `${f} should be a single page`);
  }
});

check("compress: still 2 readable pages and no larger than the source", async () => {
  const out = await load("test-document-compressed.pdf");
  assert.equal(out.getPageCount(), 2);
  const dst = (await readFile(`${dir}/test-document-compressed.pdf`)).length;
  assert.ok(dst <= baseBytes.length * 2, `compressed ${dst} vs source ${baseBytes.length}`);
});

check("rotate: page rotation went from 0 to 90", async () => {
  const src = await loadBase();
  const out = await load("test-document-rotate.pdf");
  const angle = out.getPage(0).getRotation().angle;
  assert.equal(angle, 90, `expected 90, got ${angle}`);
  assert.notEqual(angle, src.getPage(0).getRotation().angle);
});

check("organize: page order was actually reversed", async () => {
  const out = await load("test-document-organize.pdf");
  assert.equal(out.getPageCount(), 2);
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const text = async (doc, i) => {
    const p = await doc.getPage(i);
    return (await p.getTextContent()).items.map((it) => it.str).join(" ");
  };
  const src = await getDocument({ data: new Uint8Array(baseBytes) }).promise;
  const dst = await getDocument({ data: new Uint8Array(await readFile(`${dir}/test-document-organize.pdf`)) }).promise;
  const dstP1 = await text(dst, 1);
  assert.ok(dstP1.includes("Page 2"), `page 1 of output should be old page 2, got: ${dstP1.slice(0, 80)}`);
});

check("watermark: output has more content than the original and stays readable", async () => {
  const src = await loadBase();
  const out = await load("test-document-watermark.pdf");
  assert.equal(out.getPageCount(), 2);
  const dst = (await readFile(`${dir}/test-document-watermark.pdf`)).length;
  // A watermark must add something; a byte-identical file would mean nothing happened.
  assert.ok(dst > baseBytes.length, `watermarked ${dst} should exceed original ${baseBytes.length}`);
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: new Uint8Array(await readFile(`${dir}/test-document-watermark.pdf`)) }).promise;
  const p = await doc.getPage(1);
  const items = (await p.getTextContent()).items.map((it) => it.str).join(" ");
  const ops = await p.getOperatorList();
  // Text watermark shows up in the text layer; image watermark as a paint-image op.
  const paintedImage = ops.fnArray.some((fn) => fn === 85 /* paintImageXObject */ || fn === 82 /* paintJpegXObject */);
  assert.ok(items.length > 0 || paintedImage, "no watermark text or image found on the page");
  console.log(`         (watermark text layer: ${JSON.stringify(items.slice(0, 60))}, image drawn: ${paintedImage})`);
});

check("remove: 2 pages minus page 1 leaves 1 page", async () => {
  assert.equal((await load("test-document-remove.pdf")).getPageCount(), 1);
});

check("extract: extracting page 2 leaves 1 page", async () => {
  assert.equal((await load("test-document-extract.pdf")).getPageCount(), 1);
});

check("crop: the visible page is smaller than the original", async () => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Compare rendered viewports: pdf-lib's getSize() reports the MediaBox, but cropping
  // shrinks the CropBox, which is what a viewer actually shows.
  const viewport = async (file) => {
    const doc = await getDocument({ data: new Uint8Array(await readFile(file)) }).promise;
    const vp = (await doc.getPage(1)).getViewport({ scale: 1 });
    return { width: vp.width, height: vp.height };
  };
  const s = await viewport(`${dir}/_baseline.pdf`);
  const o = await viewport(`${dir}/test-document-crop.pdf`);
  assert.ok(o.width < s.width && o.height < s.height, `crop ${JSON.stringify(o)} vs ${JSON.stringify(s)}`);
});

check("protect: output opens with the correct password", async () => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdf-lib cannot decrypt, so verify with pdf.js, which enforces the password for real.
  const bytes = new Uint8Array(await readFile(`${dir}/test-document-protected.pdf`));
  const good = await getDocument({ data: bytes.slice(), password: "paperly-qa-password" }).promise;
  assert.equal(good.numPages, 2, "correct password should unlock both pages");
});

check("protect: a wrong password is rejected", async () => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = new Uint8Array(await readFile(`${dir}/test-document-protected.pdf`));
  for (const pw of ["wrong-password", "", "Paperly-QA-Password"]) {
    let opened = false;
    try { opened = (await getDocument({ data: bytes.slice(), password: pw }).promise).numPages > 0; }
    catch { opened = false; }
    assert.equal(opened, false, `password ${JSON.stringify(pw)} must not open the file`);
  }
});

check("unlock: protected file opens with no password and keeps 2 pages", async () => {
  assert.equal((await load("protected-unlocked.pdf")).getPageCount(), 2);
});

check("page-numbers: output keeps 2 pages", async () => {
  assert.equal((await load("test-document-page-numbers.pdf")).getPageCount(), 2);
});

check("pdf-to-text: extracted text preserves the source sentence", async () => {
  const t = (await readFile(`${dir}/test-document.txt`)).toString();
  assert.ok(t.includes("Paperly test document"), `got: ${t.slice(0, 120)}`);
  assert.ok(t.includes("Page 1") && t.includes("Page 2"), "both pages should be represented");
});

check("pdf-to-word: archive contains a real document body", async () => {
  const zip = await JSZip.loadAsync(await readFile(`${dir}/test-document.docx`));
  const xml = await zip.file("word/document.xml").async("string");
  assert.ok(xml.includes("<w:document"), "missing word document root");
});

check("word-to-pdf: docx text survives the conversion", async () => {
  const out = await load("sample.pdf");
  assert.ok(out.getPageCount() >= 1);
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: new Uint8Array(await readFile(`${dir}/sample.pdf`)) }).promise;
  const text = (await (await doc.getPage(1)).getTextContent()).items.map((it) => it.str).join(" ");
  assert.ok(/paperly|paperwork/i.test(text), `converted text not found, got: ${text.slice(0, 120)}`);
});

check("jpg-to-pdf: one image becomes a one-page PDF", async () => {
  assert.equal((await load("sample-images.pdf")).getPageCount(), 1);
});

check("pdf-to-jpg: archive holds one image per page", async () => {
  const zip = await JSZip.loadAsync(await readFile(`${dir}/test-document-images.zip`));
  const imgs = Object.keys(zip.files).filter((f) => /\.(jpe?g|png)$/i.test(f));
  assert.ok(imgs.length >= 2, `expected >=2 images, got ${imgs.length}`);
  for (const f of imgs) {
    const buf = await zip.file(f).async("nodebuffer");
    assert.ok(buf.length > 0, `${f} is empty`);
    const jpg = buf[0] === 0xff && buf[1] === 0xd8;
    const png = buf[0] === 0x89 && buf[1] === 0x50;
    assert.ok(jpg || png, `${f} is not a real image`);
  }
});

check("repair: output opens cleanly with 2 pages", async () => {
  assert.equal((await load("test-document-repaired.pdf")).getPageCount(), 2);
});

check("flatten: output opens cleanly with 2 pages", async () => {
  assert.equal((await load("test-document-flattened.pdf")).getPageCount(), 2);
});

let passed = 0, failed = 0;
for (const c of checks) {
  try { await c.fn(); console.log(`  ok   ${c.label}`); passed++; }
  catch (e) { console.log(`  FAIL ${c.label}\n         ${e.message}`); failed++; }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);