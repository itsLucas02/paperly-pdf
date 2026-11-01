import { chromium, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph } from "docx";
import JSZip from "jszip";
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const base = process.env.TEST_URL || "http://127.0.0.1:3000";
const artifacts = ".artifacts";
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
const results = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("net::ERR_INTERNET_DISCONNECTED")) console.log("BROWSER:", message.text().slice(0, 300)); });
const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
for (let i = 1; i <= 2; i++) pdf.addPage([595, 842]).drawText(`Paperly test document. Page ${i}. A little less paperwork.`, { x: 45, y: 740, size: 15, font });
const pdfBytes = Buffer.from(await pdf.save());
const pdfFile = (name = "test-document.pdf") => ({ name, mimeType: "application/pdf", buffer: pdfBytes });
const wordBytes = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph({ text: "Paperly test document", heading: "Heading1" }), new Paragraph("A little less paperwork. A little more possibility. This document is ready to become a PDF.")] }] }));
const imageBytes = await sharp({ create: { width: 160, height: 240, channels: 3, background: "#f8ede1" } }).jpeg().toBuffer();
let protectedBytes = null;

async function runTool(id, upload, expectedPages, setup) {
  console.log(`TOOL ${id}`);
  await page.goto(`${base}/?tool=${id}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(upload);
  await expect(page.locator(".file-list-row").first()).toBeVisible();
  if (setup) await setup();
  await page.locator(".process-button").click();
  try { await expect(page.locator(".result-screen")).toBeVisible({ timeout: 90000 }); }
  catch (error) { console.log("FORM ERROR", await page.locator(".form-error").allTextContents()); await page.screenshot({ animations: "disabled", path: `${artifacts}/failed-${id}.png` }); throw error; }
  const downloadEvent = page.waitForEvent("download");
  await page.locator(".download-button").click();
  const download = await downloadEvent;
  const path = `${artifacts}/${download.suggestedFilename()}`;
  await download.saveAs(path);
  const bytes = await readFile(path);
  assert(bytes.length > 0, "Download must contain data");
  if (download.suggestedFilename().endsWith(".pdf") && id !== "protect") {
    const output = await PDFDocument.load(bytes);
    if (expectedPages) assert.equal(output.getPageCount(), expectedPages, `${id} page count`);
  }
  if (download.suggestedFilename().endsWith(".zip")) {
    const zip = await JSZip.loadAsync(bytes);
    if (expectedPages) assert.equal(Object.keys(zip.files).filter((name) => !zip.files[name].dir).length, expectedPages, `${id} archive content count`);
  }
  if (id === "pdf-to-word") { const zip = await JSZip.loadAsync(bytes); assert(zip.file("word/document.xml"), "Word output contains a document"); }
  if (id === "pdf-to-text") assert(bytes.toString().includes("Paperly test document"), "Text output includes PDF text");
  if (id === "protect") {
    protectedBytes = bytes;
    await assert.rejects(() => PDFDocument.load(bytes), /encrypt/i, "Protected output requires a password");
  }
  if (id === "unlock") assert.equal((await PDFDocument.load(bytes)).getPageCount(), 2);
  results.push({ tool: id, filename: download.suggestedFilename(), bytes: bytes.length });
  console.log(`PASS ${id}: ${download.suggestedFilename()} (${bytes.length} bytes)`);
}

try {
  await page.goto(base, { waitUntil: "networkidle" });
  await expect(page.locator(".tool-card")).toHaveCount(20);
  await page.screenshot({ animations: "disabled", path: `${artifacts}/desktop.png` });
  await page.getByRole("button", { name: "Add Merge PDF to favorites", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove Merge PDF from favorites", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.locator(".primary-navigation").getByRole("button", { name: /Favorites/ }).click();
  await expect(page.locator(".tool-card")).toHaveCount(1);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Remove Merge PDF from favorites", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("searchbox").fill("merge");
  await expect(page.locator(".tool-card")).toHaveCount(1);
  await page.getByRole("searchbox").fill("no-such-pdf-tool-xyz");
  await expect(page.locator(".empty-state")).toBeVisible();
  await page.locator(".clear-search").click();
  await page.getByRole("tab", { name: "Organize", exact: true }).click();
  await expect(page.locator(".tool-card")).toHaveCount(6);
  console.log("PASS search, category filtering, and persistent favorites");

  await runTool("merge", [pdfFile("one.pdf"), pdfFile("two.pdf")], 4);
  await page.screenshot({ animations: "disabled", path: `${artifacts}/result.png` });
  await runTool("split", pdfFile(), 2);
  await runTool("compress", pdfFile(), 2);
  await runTool("pdf-to-word", pdfFile());
  await runTool("jpg-to-pdf", { name: "sample.jpg", mimeType: "image/jpeg", buffer: imageBytes }, 1);
  await runTool("pdf-to-jpg", pdfFile(), 2);
  await runTool("rotate", pdfFile(), 2);
  await runTool("watermark", pdfFile(), 2);
  await runTool("organize", pdfFile(), 2, async () => { await page.getByLabel("Page order", { exact: false }).fill("2, 1"); });
  await runTool("protect", pdfFile(), null, async () => { await page.getByLabel("Create a password", { exact: false }).fill("paperly-qa-password"); await page.getByLabel("Confirm password", { exact: false }).fill("paperly-qa-password"); });
  await runTool("unlock", { name: "protected.pdf", mimeType: "application/pdf", buffer: protectedBytes }, 2, async () => { await page.getByLabel("Current password", { exact: false }).fill("paperly-qa-password"); });
  await runTool("page-numbers", pdfFile(), 2);
  await runTool("remove", pdfFile(), 1, async () => { await page.getByLabel("Pages to remove", { exact: false }).fill("1"); });
  await runTool("extract", pdfFile(), 1, async () => { await page.getByLabel("Pages to extract", { exact: false }).fill("2"); });
  await runTool("crop", pdfFile(), 2);
  await runTool("pdf-to-text", pdfFile());
  await runTool("word-to-pdf", { name: "sample.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: wordBytes }, 1);
  await runTool("pdf-to-png", pdfFile(), 2);
  await runTool("repair", pdfFile(), 2);
  await runTool("flatten", pdfFile(), 2);

  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator(".primary-navigation").getByRole("button", { name: /My files/ }).click();
  await expect(page.locator(".history-row")).toHaveCount(20);
  console.log("PASS all 20 jobs persisted in private workspace history");
  await page.getByRole("button", { name: "Open workspace menu", exact: true }).click();
  await page.getByRole("button", { name: "Workspace settings", exact: true }).click();
  await page.getByLabel("Workspace name", { exact: false }).fill("My QA workspace");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".avatar-button")).toHaveText("M");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  const workspace = await (await page.request.get(`${base}/api/workspace`)).json();
  assert.equal(workspace.workspace.name, "My QA workspace");
  assert.equal(workspace.workspace.favorites.length, 1);
  console.log("PASS workspace settings persisted");
  const privateContext = await browser.newContext();
  const privateWorkspace = await (await privateContext.request.get(`${base}/api/workspace`)).json();
  assert.equal(privateWorkspace.history.length, 0);
  assert.equal(privateWorkspace.workspace.favorites.length, 0);
  await privateContext.close();
  console.log("PASS workspace isolation");

  await page.goto(`${base}/?tool=merge`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Just exploring? Try a sample", exact: true }).click();
  await expect(page.locator(".file-list-row")).toHaveCount(1);
  await page.screenshot({ animations: "disabled", path: `${artifacts}/tool-dialog.png` });
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.goto(base, { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".offline-banner")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".tool-card")).toHaveCount(20);
  await page.getByRole("button", { name: "Open Merge PDF", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles([pdfFile("offline-one.pdf"), pdfFile("offline-two.pdf")]);
  await page.locator(".process-button").click();
  await expect(page.locator(".result-screen")).toBeVisible({ timeout: 90000 });
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await context.setOffline(false);
  console.log("PASS offline app shell and local PDF merging");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.screenshot({ animations: "disabled", path: `${artifacts}/mobile.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, "No horizontal scrolling on mobile");
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await expect(page.locator(".sidebar.is-open")).toBeVisible();
  await page.locator(".sidebar-scrim").click({ position: { x: 350, y: 200 } });
  await page.getByRole("button", { name: "Open Merge PDF", exact: true }).click();
  await page.screenshot({ animations: "disabled", path: `${artifacts}/mobile-dialog.png` });
  await expect(page.getByRole("dialog")).toBeVisible();
  console.log("PASS mobile layout and navigation");
  assert.deepEqual(errors, [], "No uncaught browser errors");
  await writeFile(`${artifacts}/results.json`, JSON.stringify(results, null, 2));
  console.log(`ALL CHECKS PASSED: ${results.length} PDF tools, persistence, privacy, offline, and responsive UI.`);
} catch (error) {
  await page.screenshot({ animations: "disabled", path: `${artifacts}/failure.png` });
  console.error(error);
  console.error("Uncaught browser errors:", errors);
  process.exitCode = 1;
} finally { await browser.close(); }
