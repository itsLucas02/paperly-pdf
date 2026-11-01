"use client";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Check, CheckCheck, CircleCheck, Download, Eye, EyeOff, File as FileIcon, FileCheck2, FileUp, GripVertical, Info, LoaderCircle, LockKeyhole, Plus, RotateCcw, ShieldCheck, Sparkles, TriangleAlert, X } from "lucide-react";
import { Modal } from "./modal";
import { ToolIcon } from "./tool-icon";
import { formatBytes, type Tool } from "@/lib/tools";
import { defaultOptions, type ProcessOptions, type ProcessResult } from "@/lib/pdf-engine";

export type JobDetails = { toolId: string; fileName: string; inputSize: number; outputSize: number; pageCount: number };
export function ToolDialog({ tool, onClose, onComplete }: { tool: Tool; onClose: () => void; onComplete: (job: JobDetails) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<ProcessOptions>({ ...defaultOptions, position: tool.id === "page-numbers" ? "bottom" : "center" });
  const [pageCount, setPageCount] = useState(0);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);
  const pdfTool = tool.accept === ".pdf";
  const setOption = <K extends keyof ProcessOptions>(key: K, value: ProcessOptions[K]) => setOptions((previous) => ({ ...previous, [key]: value }));

  useEffect(() => {
    let canceled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset stale preview state before the async pdf.js load below
    setPageCount(0); setPreview("");
    if (!files[0] || !pdfTool) return;
    import("@/lib/pdf-engine").then(async ({ getPdfInfo, getPreview }) => {
      try { const count = await getPdfInfo(files[0]); if (!canceled) { setPageCount(count); if (tool.id === "organize") setOptions((previous) => ({ ...previous, pages: Array.from({ length: count }, (_, i) => i + 1).join(", ") })); } }
      catch (err) { if (!canceled && tool.id !== "unlock") setError(err instanceof Error ? err.message : "This PDF couldn’t be previewed."); }
      try { const data = await getPreview(files[0]); if (!canceled) setPreview(data); } catch { /* A protected PDF can still be used by Unlock PDF. */ }
    });
    return () => { canceled = true; };
  }, [files, pdfTool, tool.id]);

  const addFiles = (incoming: File[]) => {
    setError("");
    const valid = incoming.filter((file) => {
      if (file.size > 50 * 1024 * 1024) { setError(`${file.name} is larger than 50 MB. Try a smaller file.`); return false; }
      const extension = file.name.split(".").pop()?.toLowerCase();
      const accepted = tool.accept === ".docx" ? extension === "docx" : tool.accept === ".pdf" ? extension === "pdf" : ["jpg", "jpeg", "png", "webp"].includes(extension ?? "");
      if (!accepted) { setError(`Please select ${tool.accept === ".pdf" ? "PDF" : tool.accept === ".docx" ? "Word (.docx)" : "JPG, PNG, or WebP image"} files for this tool.`); return false; }
      return true;
    });
    if (!valid.length) return;
    setFiles((previous) => {
      const next = tool.multiple ? [...previous, ...valid] : [valid[0]];
      if (next.length > 20 || next.reduce((size, file) => size + file.size, 0) > 150 * 1024 * 1024) { setError("Use up to 20 files, with 150 MB total. Try removing a few files first."); return previous; }
      return next;
    });
    if (input.current) input.current.value = "";
  };
  const dropFiles = (event: DragEvent) => { event.preventDefault(); setDragging(false); if (!busy) addFiles(Array.from(event.dataTransfer.files)); };
  const moveFile = (from: number, to: number) => setFiles((previous) => { const next = [...previous]; if (to < 0 || to >= next.length) return previous; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; });
  const makeSample = async () => {
    setSampleLoading(true); setError("");
    try {
      if (tool.accept === ".docx") {
        const { Document, Packer, Paragraph, HeadingLevel } = await import("docx");
        const blob = await Packer.toBlob(new Document({ sections: [{ children: [new Paragraph({ text: "A little less paperwork.", heading: HeadingLevel.HEADING_1 }), new Paragraph("Welcome to paperly, your everyday PDF companion."), new Paragraph("This sample is ready to become a shareable PDF. Add your own Word document whenever you are ready.")] }] }));
        addFiles([new File([blob], "a-little-inspiration.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })]);
      } else if (!pdfTool) {
        const canvas = document.createElement("canvas"); canvas.width = 800; canvas.height = 1000;
        const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#fcf1e8"; ctx.fillRect(0, 0, 800, 1000); ctx.fillStyle = "#e67c57"; ctx.fillRect(75, 90, 80, 9); ctx.fillStyle = "#343c35"; ctx.font = "bold 54px sans-serif"; ctx.fillText("Good ideas.", 75, 200); ctx.fillText("Great possibilities.", 75, 268); ctx.fillStyle = "#78816e"; ctx.font = "26px sans-serif"; ctx.fillText("A little less paperwork. A little more life.", 75, 350); ctx.fillStyle = "#e67c57"; ctx.beginPath(); ctx.arc(400, 650, 120, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff8f2"; ctx.font = "bold 80px sans-serif"; ctx.fillText("p.", 354, 680);
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.95));
        addFiles([new File([blob], "a-little-inspiration.jpg", { type: "image/jpeg" })]);
      } else {
        const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
        const doc = await PDFDocument.create(); const font = await doc.embedFont(StandardFonts.Helvetica); const bold = await doc.embedFont(StandardFonts.HelveticaBold);
        for (let i = 0; i < (tool.id === "split" || tool.id === "organize" ? 3 : 1); i++) {
          const page = doc.addPage([595, 842]); page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.99, 0.97, 0.94) }); page.drawText("paperly", { x: 50, y: 755, font: bold, size: 30, color: rgb(0.87, 0.45, 0.31) }); page.drawText(i === 0 ? "A little less paperwork." : i === 1 ? "A little more possibility." : "Make room for the good stuff.", { x: 50, y: 635, font: bold, size: 26, color: rgb(0.25, 0.29, 0.25) }); page.drawText("Simple tools for your everyday PDF tasks.", { x: 50, y: 590, font, size: 14, color: rgb(0.45, 0.48, 0.43) }); page.drawText("This is your sample PDF. Try editing, merging, or converting it.", { x: 50, y: 545, font, size: 11, color: rgb(0.45, 0.48, 0.43) }); page.drawText("Your files stay on your device. Always.", { x: 50, y: 520, font, size: 11, color: rgb(0.45, 0.48, 0.43) }); page.drawRectangle({ x: 50, y: 205, width: 200, height: 160, color: rgb(0.91, 0.58, 0.41) }); page.drawText("p.", { x: 90, y: 235, font: bold, size: 100, color: rgb(1, 0.97, 0.92) }); page.drawText(`PAGE ${i + 1}`, { x: 50, y: 50, font, size: 10, color: rgb(0.6, 0.6, 0.55) });
        }
        addFiles([new File([new Uint8Array(await doc.save()).buffer as ArrayBuffer], "a-little-inspiration.pdf", { type: "application/pdf" })]);
      }
    } catch { setError("The sample couldn’t be created. Please try selecting your own file."); }
    finally { setSampleLoading(false); }
  };
  const run = async () => {
    setError("");
    if (!files.length) { setError("First, select a file to get started."); return; }
    if (tool.id === "merge" && files.length < 2) { setError("Add at least two PDFs to bring them together."); return; }
    if (tool.id === "protect" && (options.password.length < 6 || options.password !== options.confirmPassword)) { setError("Use a password of at least 6 characters, and make sure both passwords match."); return; }
    if (tool.id === "unlock" && !options.password) { setError("Enter the PDF’s current password to unlock it."); return; }
    setBusy(true); setProgress(2); setStatus("Getting your files ready…");
    try {
      const { processFiles } = await import("@/lib/pdf-engine");
      const output = await processFiles(tool.id, files, options, (value, message) => { setProgress(value); setStatus(message); });
      setResult(output);
      onComplete({ toolId: tool.id, fileName: output.name, inputSize: output.inputSize, outputSize: output.blob.size, pageCount: output.pageCount });
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong. Please try again with a different file."); }
    finally { setBusy(false); }
  };
  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob); const link = document.createElement("a"); link.href = url; link.download = result.name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); setDownloaded(true);
  };
  const reset = () => { setFiles([]); setResult(null); setDownloaded(false); setError(""); setProgress(0); setPageCount(0); setOptions({ ...defaultOptions }); };
  const extension = result?.name.split(".").pop()?.toUpperCase() ?? "PDF";
  const saved = result ? Math.round((1 - result.blob.size / result.inputSize) * 100) : 0;

  return <Modal title={result ? "A little magic. All done." : tool.name} subtitle={result ? "Your file is ready for its next chapter." : tool.longDescription} onClose={onClose} busy={busy} className="tool-modal">
    <input ref={input} type="file" accept={tool.accept} multiple={tool.multiple} hidden onChange={(event) => addFiles(Array.from(event.target.files ?? []))}/>
    {result ? <div className="result-screen">
      <div className="success-illustration"><CircleCheck size={48} strokeWidth={1.5}/><Sparkles className="success-sparkle" size={20}/><span className="success-dot"/></div>
      <h3>{downloaded ? "Go on. Make good things happen." : "Looking good. Your file is ready!"}</h3>
      <p>{result.originalKept ? "This PDF is already well optimized. We kept your original quality." : tool.id === "unlock" ? "Your unlocked copy is ready. It has been rendered as a new PDF." : "One less thing on your to-do list. That feels nice."}</p>
      <div className="result-file"><span className="result-file-icon"><FileCheck2 size={27}/></span><div><strong>{result.name}</strong><span>{formatBytes(result.blob.size)} <i>·</i> {result.pageCount} {result.pageCount === 1 ? "page" : "pages"}{saved > 0 && <b className="saved-badge">{saved}% smaller</b>}</span></div><CheckCheck size={20} className="green-text"/></div>
      <button className="button primary download-button" onClick={download}>{downloaded ? <Check size={18}/> : <Download size={18}/>} {downloaded ? `Download ${extension} again` : `Download ${extension}`}</button>
      <div className="result-actions"><button onClick={reset} className="text-button"><RotateCcw size={14}/> Start again</button><span/><button onClick={onClose} className="text-button">Back to all tools <ArrowRight size={14}/></button></div>
      <div className="local-note"><ShieldCheck size={14}/> Processed on your device. Never uploaded.</div>
    </div> : busy ? <div className="processing-screen" role="status" aria-live="polite"><div className="processing-icon"><ToolIcon tool={tool} size={35}/><LoaderCircle size={26} className="spin"/></div><h3>A little PDF magic in progress.</h3><p>{status}</p><div className="progress-track"><div style={{ width: `${progress}%` }}/></div><div className="progress-meta"><span>Your device is doing the work</span><b>{progress}%</b></div><div className="processing-note"><LockKeyhole size={14}/> Keep this window open. Your files are staying private.</div></div> : <div className="tool-form">
      <div className={`dropzone ${dragging ? "dragging" : ""} ${files.length ? "compact" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={dropFiles}>
        {files.length ? <><div className="selected-file-heading"><span><Check size={15}/>{files.length} {files.length === 1 ? "file" : "files"} ready {pageCount > 0 && <small>· {pageCount} pages</small>}</span><button className="text-button add-more" onClick={() => input.current?.click()}><Plus size={14}/>{tool.multiple ? "Add files" : "Change file"}</button></div><div className="file-list">{files.map((file, index) => <div className="file-list-row" key={`${file.name}-${index}`} draggable={tool.multiple} onDragStart={() => { dragIndex.current = index; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (dragIndex.current !== null) moveFile(dragIndex.current, index); dragIndex.current = null; setDragging(false); }}>
          {tool.multiple && <GripVertical size={16} className="file-grip"/>}
          <div className="file-thumbnail">{index === 0 && preview ? <img src={preview} alt="First page preview"/> : <FileIcon size={24}/>}</div><div className="file-description"><strong>{file.name}</strong><span>{formatBytes(file.size)}{index === 0 && pageCount > 0 && ` · ${pageCount} pages`}</span></div><div className="file-actions">{tool.multiple && <><button className="icon-button" onClick={() => moveFile(index, index - 1)} disabled={index === 0} aria-label={`Move ${file.name} up`}><ArrowUp size={14}/></button><button className="icon-button" onClick={() => moveFile(index, index + 1)} disabled={index === files.length - 1} aria-label={`Move ${file.name} down`}><ArrowDown size={14}/></button></>}<button className="icon-button remove-file" onClick={() => setFiles((previous) => previous.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`}><X size={15}/></button></div>
        </div>)}</div></> : <><div className="upload-illustration"><FileUp size={31} strokeWidth={1.5}/><span><Plus size={13}/></span></div><h3>Drop your {pdfTool ? "PDF" : tool.id === "word-to-pdf" ? "Word document" : "images"} here</h3><p>or give your files a little nudge</p><button className="button primary select-file" onClick={() => input.current?.click()}><Plus size={17}/> Select {tool.multiple ? "files" : "a file"}</button><span className="upload-limit">{tool.multiple ? "Up to 20 files · " : ""}50 MB per file{pdfTool && " · 500 pages"}</span><button className="sample-button" onClick={makeSample} disabled={sampleLoading}>{sampleLoading ? <LoaderCircle size={13} className="spin"/> : <Sparkles size={13}/>} Just exploring? Try a sample</button></>}
      </div>
      {files.length > 0 && <div className="tool-options">
        {tool.id === "merge" && <div className="subtle-note"><GripVertical size={18}/><span>First things first. Drag files or use the arrows to set your merge order.</span></div>}
        {tool.id === "split" && <><h4>How would you like to split it?</h4><div className="segmented-control"><button aria-pressed={options.splitMode === "all"} className={options.splitMode === "all" ? "active" : ""} onClick={() => setOption("splitMode", "all")}>One PDF per page</button><button aria-pressed={options.splitMode === "ranges"} className={options.splitMode === "ranges" ? "active" : ""} onClick={() => setOption("splitMode", "ranges")}>Custom page ranges</button></div>{options.splitMode === "ranges" && <label className="field">Page ranges<input value={options.pages} onChange={(event) => setOption("pages", event.target.value)} placeholder="e.g. 1-3, 5-7"/><small>Each range becomes a separate PDF in your ZIP download.</small></label>}</>}
        {["organize", "remove", "extract"].includes(tool.id) && <label className="field">{tool.id === "organize" ? "Page order" : tool.id === "remove" ? "Pages to remove" : "Pages to extract"}<input value={options.pages} onChange={(event) => setOption("pages", event.target.value)} placeholder={tool.id === "organize" ? "1, 3, 2, 4" : "1-3, 5, 8"}/><small>{tool.id === "organize" ? "Reorder page numbers with commas. Repeat a number to duplicate a page." : `Enter individual pages or ranges${pageCount ? `, from 1 to ${pageCount}` : ""}.`}</small></label>}
        {tool.id === "rotate" && <><h4>A fresh perspective</h4><div className="quality-options">{[90, 180, 270].map((angle) => <button key={angle} aria-pressed={options.rotation === angle} className={options.rotation === angle ? "active" : ""} onClick={() => setOption("rotation", angle)}><RotateCcw size={19} style={{ transform: `rotate(${angle - 90}deg)` }}/><strong>{angle}°</strong><small>clockwise</small></button>)}</div></>}
        {["compress", "pdf-to-jpg", "pdf-to-png"].includes(tool.id) && <><h4>{tool.id === "compress" ? "Find your happy medium" : "Choose your image quality"}</h4><div className="quality-options">{([{ id: "low", title: "Small & light", desc: "For sharing" }, { id: "balanced", title: "Just right", desc: "Recommended" }, { id: "high", title: "All the detail", desc: "Highest quality" }] as const).map((level) => <button key={level.id} aria-pressed={options.quality === level.id} className={options.quality === level.id ? "active" : ""} onClick={() => setOption("quality", level.id)}><span className="quality-radio">{options.quality === level.id && <Check size={10}/>}</span><strong>{level.title}</strong><small>{level.desc}</small></button>)}</div><div className="subtle-note"><Info size={16}/><span>{tool.id === "compress" ? "Pages are optimized as images. Text and links won’t remain selectable. Your original is kept if we can’t make it smaller." : "Each page becomes an image. Multiple pages are delivered as a ZIP file."}</span></div></>}
        {["protect", "unlock"].includes(tool.id) && <><h4>{tool.id === "protect" ? "A little extra peace of mind" : "Your document’s password"}</h4><label className="field">{tool.id === "protect" ? "Create a password" : "Current password"}<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="new-password" value={options.password} onChange={(event) => setOption("password", event.target.value)} placeholder="At least 6 characters"/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>{tool.id === "protect" && <label className="field">Confirm password<input type={showPassword ? "text" : "password"} autoComplete="new-password" value={options.confirmPassword} onChange={(event) => setOption("confirmPassword", event.target.value)} placeholder="One more time, just to be sure"/></label>}<div className="subtle-note"><ShieldCheck size={17}/><span>{tool.id === "protect" ? "128-bit RC4 protection. Passwords are never stored. Keep yours safe—there is no password recovery. Some modern readers may show a compatibility warning." : "Only unlock documents you own or have permission to edit. Your new copy won’t retain editable text or links."}</span></div></>}
        {tool.id === "watermark" && <><label className="field">Make your mark<input maxLength={100} value={options.watermark} onChange={(event) => setOption("watermark", event.target.value)} placeholder="CONFIDENTIAL"/></label><div className="field-row"><label className="field">Font size<input type="number" min={6} max={150} value={options.fontSize} onChange={(event) => setOption("fontSize", Number(event.target.value))}/></label><label className="field">Position<select value={options.position} onChange={(event) => setOption("position", event.target.value as ProcessOptions["position"])}><option value="center">Center · diagonal</option><option value="top">Top center</option><option value="bottom">Bottom center</option></select></label></div><label className="field">Transparency <span className="range-value">{Math.round((1 - options.opacity) * 100)}%</span><input type="range" min="0.05" max="0.8" step="0.05" value={options.opacity} onChange={(event) => setOption("opacity", Number(event.target.value))}/></label><div className="watermark-preview"><span style={{ opacity: options.opacity, fontSize: Math.min(options.fontSize, 32), top: options.position === "top" ? "18%" : options.position === "bottom" ? "70%" : "45%", transform: `translate(-50%, -50%) rotate(${options.position === "center" ? -25 : 0}deg)` }}>{options.watermark || "YOUR WATERMARK"}</span><small>Watermark preview</small></div></>}
        {tool.id === "page-numbers" && <div className="field-row"><label className="field">Start at page<input type="number" min={1} max={100000} value={options.pageStart} onChange={(event) => setOption("pageStart", Number(event.target.value))}/></label><label className="field">Position<select value={options.position} onChange={(event) => setOption("position", event.target.value as ProcessOptions["position"])}><option value="bottom">Bottom center</option><option value="top">Top center</option></select></label></div>}
        {tool.id === "crop" && <label className="field">Margin on each edge (points)<input type="number" min={0} max={300} value={options.margin} onChange={(event) => setOption("margin", Number(event.target.value))}/><small>72 points = 1 inch. This margin is trimmed from all four sides.</small></label>}
        {tool.id === "jpg-to-pdf" && <div className="field-row"><label className="field">Page size<select value={options.imageSize} onChange={(event) => setOption("imageSize", event.target.value as ProcessOptions["imageSize"])}><option value="fit">Fit to image</option><option value="a4">A4, with small margins</option></select></label><label className="field">Orientation<select value={options.imageOrientation} onChange={(event) => setOption("imageOrientation", event.target.value as ProcessOptions["imageOrientation"])}><option value="auto">Automatic</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label></div>}
        {tool.id === "flatten" && <div className="subtle-note"><Info size={17}/><span>Your pages will be rendered as high-quality images. Annotations and form fields become permanent; links and selectable text won’t be retained.</span></div>}
        {["pdf-to-word", "word-to-pdf", "pdf-to-text"].includes(tool.id) && <div className="subtle-note"><Info size={17}/><span>{tool.id === "word-to-pdf" ? "Basic headings, paragraphs, lists, and images are converted. Complex Word layouts and advanced formatting are simplified." : "Text-based PDFs work best. Scanned documents need a text layer, and complex layouts may need a little reformatting."}</span></div>}
      </div>}
      {error && <div className="form-error" role="alert"><TriangleAlert size={17}/><span>{error}</span></div>}
      <div className="tool-form-footer"><span><ShieldCheck size={15}/> Your files never leave your device.</span><button className="button primary process-button" onClick={run} disabled={!files.length}>{tool.id === "merge" ? "Merge PDFs" : tool.id === "jpg-to-pdf" ? "Create PDF" : `${tool.name.replace(" PDF", "")}${["protect", "unlock", "compress", "rotate", "repair", "flatten", "crop", "watermark"].includes(tool.id) ? " PDF" : ""}`}<ArrowRight size={17}/></button></div>
    </div>}
  </Modal>;
}
