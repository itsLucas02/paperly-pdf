import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { tools } from "./tools";

export type ProcessOptions = {
  pages: string;
  rotation: number;
  quality: "low" | "balanced" | "high";
  watermark: string;
  opacity: number;
  fontSize: number;
  position: "center" | "bottom" | "top";
  password: string;
  confirmPassword: string;
  pageStart: number;
  margin: number;
  splitMode: "all" | "ranges";
  imageFormat: "jpg" | "png";
  imageOrientation: "auto" | "portrait" | "landscape";
  imageSize: "fit" | "a4";
};
export const defaultOptions: ProcessOptions = { pages: "", rotation: 90, quality: "balanced", watermark: "CONFIDENTIAL", opacity: 0.25, fontSize: 42, position: "center", password: "", confirmPassword: "", pageStart: 1, margin: 20, splitMode: "all", imageFormat: "jpg", imageOrientation: "auto", imageSize: "fit" };
export type ProcessResult = { blob: Blob; name: string; pageCount: number; inputSize: number; originalKept?: boolean };
type Progress = (value: number, message: string) => void;
const safeText = (text: string) => text.replace(/[^\x20-\x7E\n\r\t\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D]/g, "?");
const baseName = (file: File) => file.name.replace(/\.[^.]+$/, "");
const blobOf = (data: Uint8Array, type = "application/pdf") => new Blob([data.slice().buffer as ArrayBuffer], { type });
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export function parsePages(value: string, total: number): number[] {
  if (!value.trim()) throw new Error("Enter the pages you’d like to use, for example 1-3, 5.");
  const pages: number[] = [];
  for (const part of value.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
    if (!match) throw new Error("Use page numbers or ranges separated by commas, like 1-3, 5, 8.");
    const start = Number(match[1]);
    const end = Number(match[2] ?? start);
    if (start < 1 || end < start || end > total) throw new Error(`This PDF has ${total} pages. Please choose valid pages from 1 to ${total}.`);
    for (let p = start; p <= end; p++) if (!pages.includes(p - 1)) pages.push(p - 1);
  }
  return pages;
}

export async function getPdfInfo(file: File) {
  if (file.size > 50 * 1024 * 1024) throw new Error("Please select a file smaller than 50 MB.");
  const doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  if (doc.getPageCount() > 500) throw new Error("For a smooth experience, please use PDFs with 500 pages or fewer.");
  return doc.getPageCount();
}

export async function getPreview(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf-assets/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), cMapUrl: "/pdf-assets/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdf-assets/standard_fonts/", wasmUrl: "/pdf-assets/wasm/" });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const original = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 240 / original.width });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d")!;
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return canvas.toDataURL("image/jpeg", 0.65);
  } finally { await task.destroy(); }
}

async function loadPdf(file: File) {
  try { return await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false }); }
  catch (error) {
    if (error instanceof Error && /encrypt|password/i.test(error.message)) throw new Error("This PDF is password-protected. Use Unlock PDF first, with the document’s password.");
    throw new Error("We couldn’t read this PDF. It may be damaged or isn’t a valid PDF. Try Repair PDF or choose another file.");
  }
}

async function renderPages(file: File, options: ProcessOptions, progress: Progress, kind: "compress" | "flatten" | "unlock" | "jpg" | "png", base: string) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf-assets/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password: options.password, cMapUrl: "/pdf-assets/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdf-assets/standard_fonts/", wasmUrl: "/pdf-assets/wasm/" });
  const imageOutput = kind === "jpg" || kind === "png";
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 500) throw new Error("Please use PDFs with 500 pages or fewer.");
    const out = imageOutput ? null : await PDFDocument.create();
    const zip = imageOutput ? new (await import("jszip")).default() : null;
    let singleBlob: Blob | null = null;
    for (let i = 1; i <= pdf.numPages; i++) {
      progress(10 + Math.round((i / pdf.numPages) * 78), `Working on page ${i} of ${pdf.numPages}…`);
      const page = await pdf.getPage(i);
      const original = page.getViewport({ scale: 1 });
      const scale = kind === "compress" ? { low: 0.85, balanced: 1.15, high: 1.7 }[options.quality] : kind === "unlock" ? 1.5 : kind === "flatten" ? 1.8 : { low: 1.2, balanced: 1.8, high: 2.8 }[options.quality];
      const viewport = page.getViewport({ scale });
      if (viewport.width * viewport.height > 40_000_000) throw new Error("This page is too large to render safely. Try a lower quality setting.");
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d")!;
      if (kind !== "png") { context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height); }
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const mime = kind === "png" || kind === "flatten" ? "image/png" : "image/jpeg";
      const image = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Your browser couldn’t render this page.")), mime, kind === "compress" ? { low: 0.45, balanced: 0.7, high: 0.88 }[options.quality] : 0.93));
      if (zip) {
        if (pdf.numPages === 1) singleBlob = image;
        else zip.file(`${base}-page-${String(i).padStart(3, "0")}.${kind === "png" ? "png" : "jpg"}`, image);
      } else {
        const bytes = await image.arrayBuffer();
        const embedded = mime === "image/png" ? await out!.embedPng(bytes) : await out!.embedJpg(bytes);
        const newPage = out!.addPage([original.width, original.height]);
        newPage.drawImage(embedded, { x: 0, y: 0, width: original.width, height: original.height });
      }
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
      await pause();
    }
    let output: Blob;
    let name: string;
    if (zip) {
      output = singleBlob ?? await zip.generateAsync({ type: "blob", compression: "STORE" });
      name = pdf.numPages === 1 ? `${base}.${kind === "png" ? "png" : "jpg"}` : `${base}-images.zip`;
    } else {
      const bytes = await out!.save();
      const originalSize = file.size;
      const originalKept = kind === "compress" && bytes.length >= originalSize;
      output = originalKept ? file : blobOf(bytes);
      name = `${base}-${kind === "compress" ? "compressed" : kind === "unlock" ? "unlocked" : "flattened"}.pdf`;
      return { blob: output, name, pageCount: pdf.numPages, inputSize: file.size, originalKept };
    }
    return { blob: output, name, pageCount: pdf.numPages, inputSize: file.size };
  } catch (error) {
    if (error instanceof Error && /password/i.test(error.message)) throw new Error("That password didn’t work. Please check it and try again. PDFs with advanced AES encryption may need to be unlocked in your desktop PDF reader first.");
    throw error;
  } finally { await task.destroy(); }
}

async function extractText(file: File, password: string, progress: Progress) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf-assets/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password, cMapUrl: "/pdf-assets/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdf-assets/standard_fonts/", wasmUrl: "/pdf-assets/wasm/" });
  try {
    const pdf = await task.promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
      pages.push(text);
      progress(10 + Math.round((i / pdf.numPages) * 80), `Reading page ${i} of ${pdf.numPages}…`);
      page.cleanup();
    }
    return pages;
  } finally { await task.destroy(); }
}

export async function processFiles(toolId: string, files: File[], options: ProcessOptions, progress: Progress = () => {}): Promise<ProcessResult> {
  const tool = tools.find((item) => item.id === toolId);
  if (!tool || !files.length) throw new Error("Choose a file to get started.");
  if (files.length > 20 || files.some((file) => file.size > 50 * 1024 * 1024) || files.reduce((sum, file) => sum + file.size, 0) > 150 * 1024 * 1024) throw new Error("Please use up to 20 files, with a maximum of 50 MB per file and 150 MB combined.");
  if (!tool.multiple && files.length !== 1) throw new Error("This tool uses one PDF at a time.");
  if (toolId === "page-numbers" && (!Number.isSafeInteger(options.pageStart) || options.pageStart < 1 || options.pageStart > 100000)) throw new Error("Choose a starting page number between 1 and 100,000.");
  if (toolId === "crop" && (!Number.isFinite(options.margin) || options.margin < 0 || options.margin > 300)) throw new Error("Choose a margin between 0 and 300 points.");
  if (toolId === "watermark" && (!Number.isFinite(options.fontSize) || options.fontSize < 6 || options.fontSize > 150)) throw new Error("Choose a font size between 6 and 150.");
  const file = files[0];
  const base = baseName(file);
  const inputSize = files.reduce((sum, current) => sum + current.size, 0);
  const name = `${base}-${toolId}.pdf`;
  const finish = async (doc: PDFDocument, outputName = name) => ({ blob: blobOf(await doc.save()), name: outputName, pageCount: doc.getPageCount(), inputSize });
  progress(5, "Making room for a little PDF magic…");
  await pause();

  if (["compress", "flatten", "unlock", "pdf-to-jpg", "pdf-to-png"].includes(toolId)) {
    const result = await renderPages(file, options, progress, toolId === "pdf-to-jpg" ? "jpg" : toolId === "pdf-to-png" ? "png" : toolId as "compress" | "flatten" | "unlock", base);
    progress(100, "All done. Looking good!");
    return result;
  }

  if (toolId === "merge") {
    if (files.length < 2) throw new Error("Add at least two PDFs to merge them together.");
    const output = await PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      const doc = await loadPdf(files[i]);
      if (output.getPageCount() + doc.getPageCount() > 500) throw new Error("Please merge no more than 500 pages at a time.");
      const pages = await output.copyPages(doc, doc.getPageIndices());
      pages.forEach((page) => output.addPage(page));
      progress(10 + Math.round(((i + 1) / files.length) * 80), `Merging ${i + 1} of ${files.length} PDFs…`);
      await pause();
    }
    if (output.getPageCount() > 500) throw new Error("Please merge no more than 500 pages at a time.");
    return finish(output, "merged-document.pdf");
  }

  if (toolId === "jpg-to-pdf") {
    const output = await PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      const bytes = await files[i].arrayBuffer();
      let image;
      if (files[i].type === "image/png") image = await output.embedPng(bytes);
      else if (files[i].type === "image/webp") {
        const bitmap = await createImageBitmap(files[i]);
        const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
        image = await output.embedPng(new Uint8Array(await (await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image conversion failed.")), "image/png"))).arrayBuffer()));
        bitmap.close();
      } else image = await output.embedJpg(bytes);
      let pageWidth = 595.28, pageHeight = 841.89;
      if (options.imageSize === "fit") { pageWidth = image.width; pageHeight = image.height; }
      if (options.imageOrientation === "landscape" || (options.imageOrientation === "auto" && options.imageSize === "fit" && image.width > image.height)) [pageWidth, pageHeight] = [Math.max(pageWidth, pageHeight), Math.min(pageWidth, pageHeight)];
      if (options.imageOrientation === "portrait") [pageWidth, pageHeight] = [Math.min(pageWidth, pageHeight), Math.max(pageWidth, pageHeight)];
      const scale = Math.min(pageWidth / image.width, pageHeight / image.height);
      const width = image.width * scale, height = image.height * scale;
      const margin = options.imageSize === "a4" ? 28 : 0;
      const finalScale = Math.min((pageWidth - 2 * margin) / image.width, (pageHeight - 2 * margin) / image.height);
      output.addPage([pageWidth, pageHeight]).drawImage(image, { x: (pageWidth - (margin ? image.width * finalScale : width)) / 2, y: (pageHeight - (margin ? image.height * finalScale : height)) / 2, width: margin ? image.width * finalScale : width, height: margin ? image.height * finalScale : height });
      progress(10 + Math.round(((i + 1) / files.length) * 80), `Adding image ${i + 1} of ${files.length}…`);
    }
    return finish(output, `${base}-images.pdf`);
  }

  if (toolId === "word-to-pdf") {
    const mammoth = await import("mammoth");
    const converted = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const parsed = new DOMParser().parseFromString(converted.value, "text/html");
    const output = await PDFDocument.create();
    const font = await output.embedFont(StandardFonts.Helvetica);
    const bold = await output.embedFont(StandardFonts.HelveticaBold);
    let page = output.addPage();
    const margin = 48;
    let y = page.getHeight() - margin;
    const newPage = () => { page = output.addPage(); y = page.getHeight() - margin; };
    const draw = async (text: string, size: number, currentFont = font) => {
      const words = safeText(text).split(/\s+/);
      let line = "";
      const lineHeight = size * 1.5;
      const drawLine = () => { if (y < margin + lineHeight) newPage(); page.drawText(line, { x: margin, y, font: currentFont, size }); y -= lineHeight; };
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (currentFont.widthOfTextAtSize(test, size) > page.getWidth() - margin * 2 && line) { drawLine(); line = ""; }
        for (const part of word.length > 100 ? word.match(/.{1,70}/g)! : [word]) {
          if (currentFont.widthOfTextAtSize(line ? `${line} ${part}` : part, size) > page.getWidth() - margin * 2 && line) { drawLine(); line = ""; }
          line = line ? `${line} ${part}` : part;
        }
      }
      if (line) drawLine();
      y -= size / 2;
    };
    const blocks = parsed.body.querySelectorAll("p,h1,h2,h3,h4,li,img");
    for (const element of Array.from(blocks)) {
      if (element.tagName === "IMG") {
        const src = element.getAttribute("src") ?? "";
        if (src.startsWith("data:image/")) {
          const imageBytes = Uint8Array.from(atob(src.split(",")[1]), (c) => c.charCodeAt(0));
          const image = src.startsWith("data:image/png") ? await output.embedPng(imageBytes) : await output.embedJpg(imageBytes);
          const factor = Math.min((page.getWidth() - margin * 2) / image.width, 300 / image.height);
          if (y - image.height * factor < margin) newPage();
          page.drawImage(image, { x: margin, y: y - image.height * factor, width: image.width * factor, height: image.height * factor });
          y -= image.height * factor + 15;
        }
      } else {
        if (element.children.length && !element.textContent?.trim()) continue;
        const heading = /^H/.test(element.tagName);
        await draw((element.tagName === "LI" ? "• " : "") + (element.textContent ?? ""), heading ? 21 : 11, heading ? bold : font);
      }
    }
    if (output.getPageCount() > 500) throw new Error("The converted document is too long. Please use a smaller document.");
    return finish(output, `${base}.pdf`);
  }

  if (toolId === "pdf-to-word" || toolId === "pdf-to-text") {
    const pages = await extractText(file, options.password, progress);
    if (!pages.some((text) => text.trim())) throw new Error("This PDF has no readable text layer. It may be a scanned image. Text extraction and Word conversion need a text-based PDF.");
    if (toolId === "pdf-to-text") return { blob: new Blob([pages.join("\n\n--- Page break ---\n\n")], { type: "text/plain;charset=utf-8" }), name: `${base}.txt`, pageCount: pages.length, inputSize };
    const { Document, Packer, Paragraph, TextRun, PageBreak } = await import("docx");
    const children = pages.flatMap((text, pageIndex) => [...text.split("\n").map((line) => new Paragraph({ children: [new TextRun({ text: line, font: "Calibri", size: 22 })], spacing: { after: 120 } })), ...(pageIndex < pages.length - 1 ? [new Paragraph({ children: [new PageBreak()] })] : [])]);
    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    return { blob, name: `${base}.docx`, pageCount: pages.length, inputSize };
  }

  const doc = await loadPdf(file);
  const total = doc.getPageCount();
  if (total > 500) throw new Error("Please use PDFs with 500 pages or fewer.");
  if (toolId === "protect") {
    if (!options.password || options.password.length < 6) throw new Error("Choose a password with at least 6 characters.");
    if (options.password !== options.confirmPassword) throw new Error("Your passwords don’t match. Give them another look.");
    const { encryptPDF } = await import("@pdfsmaller/pdf-encrypt-lite");
    const bytes = await doc.save();
    const encrypted = await encryptPDF(bytes, options.password, { ownerPassword: crypto.randomUUID(), allowPrinting: true, allowCopying: false, allowModifying: false, allowAnnotating: false, allowFillingForms: false, allowAssembly: false, allowExtraction: false });
    return { blob: blobOf(encrypted), name: `${base}-protected.pdf`, pageCount: total, inputSize };
  }
  if (toolId === "split") {
    const zip = new (await import("jszip")).default();
    const groups = options.splitMode === "all" ? Array.from({ length: total }, (_, i) => [i]) : options.pages.split(",").filter((p) => p.trim()).map((range) => parsePages(range, total));
    if (!groups.length) throw new Error("Enter the page ranges to split, for example 1-3, 5-7.");
    for (let i = 0; i < groups.length; i++) {
      const output = await PDFDocument.create();
      const pages = await output.copyPages(doc, groups[i]); pages.forEach((page) => output.addPage(page));
      zip.file(`${base}-part-${String(i + 1).padStart(3, "0")}.pdf`, await output.save());
      progress(10 + Math.round(((i + 1) / groups.length) * 80), `Preparing part ${i + 1}…`);
    }
    return { blob: await zip.generateAsync({ type: "blob" }), name: `${base}-split.zip`, pageCount: total, inputSize };
  }
  if (["organize", "extract", "remove"].includes(toolId)) {
    const selected = parsePages(options.pages || (toolId === "organize" ? Array.from({ length: total }, (_, i) => i + 1).join(",") : ""), total);
    let indices: number[];
    if (toolId === "organize") {
      indices = options.pages.trim() ? options.pages.split(",").map((part) => { const n = Number(part.trim()); if (!/^\d+$/.test(part.trim()) || n < 1 || n > total) throw new Error(`Page order must contain numbers from 1 to ${total}.`); return n - 1; }) : selected;
    } else indices = toolId === "remove" ? doc.getPageIndices().filter((i) => !selected.includes(i)) : selected;
    if (!indices.length) throw new Error("Keep at least one page in your PDF.");
    const output = await PDFDocument.create();
    (await output.copyPages(doc, indices)).forEach((page) => output.addPage(page));
    return finish(output);
  }
  if (toolId === "repair") {
    try { const repaired = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false }); return finish(repaired, `${base}-repaired.pdf`); }
    catch { throw new Error("This PDF has damage that can’t be repaired safely. Try opening it in a desktop PDF reader and exporting a new copy."); }
  }
  if (toolId === "rotate") doc.getPages().forEach((page) => page.setRotation(degrees((page.getRotation().angle + options.rotation) % 360)));
  if (toolId === "crop") {
    doc.getPages().forEach((page) => {
      const { width, height } = page.getSize();
      const m = options.margin;
      if (m * 2 >= Math.min(width, height)) throw new Error("That margin is too large. Leave at least a little room for your content.");
      page.setCropBox(m, m, width - m * 2, height - m * 2);
    });
  }
  if (["watermark", "page-numbers"].includes(toolId)) {
    if (toolId === "watermark" && !options.watermark.trim()) throw new Error("Add some text for your watermark.");
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const text = safeText(options.watermark);
    const fontSize = Math.min(150, Math.max(6, toolId === "page-numbers" ? 12 : options.fontSize));
    doc.getPages().forEach((page, i) => {
      const { width, height } = page.getSize();
      const label = toolId === "page-numbers" ? String(i + options.pageStart) : text;
      const textWidth = font.widthOfTextAtSize(label, fontSize);
      const actualSize = Math.min(fontSize, (width - 48) / Math.max(textWidth / fontSize, 1));
      const y = options.position === "top" ? height - 36 : options.position === "bottom" ? 25 : (height - actualSize) / 2;
      page.drawText(label, { x: (width - font.widthOfTextAtSize(label, actualSize)) / 2, y, size: actualSize, font, color: toolId === "watermark" ? rgb(0.8, 0.28, 0.18) : rgb(0.3, 0.3, 0.3), opacity: toolId === "watermark" ? options.opacity : 1, rotate: degrees(toolId === "watermark" && options.position === "center" ? 35 : 0) });
    });
  }
  progress(95, "Putting on the finishing touches…");
  const result = await finish(doc);
  progress(100, "Your PDF is ready. Nice work!");
  return result;
}
