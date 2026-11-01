export type Category = "Organize" | "Convert" | "Edit & optimize" | "Security";
export type Tool = {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  category: Category;
  icon: string;
  color: "coral" | "blue" | "purple" | "green";
  popular?: boolean;
  accept: string;
  multiple?: boolean;
};

export const tools: Tool[] = [
  { id: "merge", name: "Merge PDF", description: "Bring multiple PDFs together in one happy file.", longDescription: "Combine your PDFs into one perfectly organized document. Add your files, put them in order, and merge.", category: "Organize", icon: "merge", color: "coral", popular: true, accept: ".pdf", multiple: true },
  { id: "split", name: "Split PDF", description: "Separate one PDF into the pages you need.", longDescription: "Extract every page into its own PDF, or choose specific page ranges. Your new files arrive in a convenient ZIP.", category: "Organize", icon: "split", color: "coral", popular: true, accept: ".pdf" },
  { id: "compress", name: "Compress PDF", description: "Less file size. Same big ideas. Make PDFs lighter.", longDescription: "Find the right balance between size and quality. Images are optimized locally; if a file is already small, we keep the original.", category: "Edit & optimize", icon: "compress", color: "purple", popular: true, accept: ".pdf" },
  { id: "pdf-to-word", name: "PDF to Word", description: "Turn your PDFs into easy-to-edit Word documents.", longDescription: "Extract the text in your PDF into an editable DOCX document. Scanned pages need a readable text layer; complex layouts may need a little reformatting.", category: "Convert", icon: "word", color: "blue", popular: true, accept: ".pdf" },
  { id: "jpg-to-pdf", name: "JPG to PDF", description: "Give your images a new home in a PDF.", longDescription: "Turn your JPG, PNG, or WebP images into a clean PDF. Choose page size and orientation, then arrange images in your preferred order.", category: "Convert", icon: "images", color: "blue", accept: "image/jpeg,image/png,image/webp", multiple: true },
  { id: "pdf-to-jpg", name: "PDF to JPG", description: "Make every PDF page a picture-perfect JPG.", longDescription: "Export each page as a high-quality JPG image. Multiple pages are packaged into a ZIP, ready to share.", category: "Convert", icon: "image", color: "blue", accept: ".pdf" },
  { id: "rotate", name: "Rotate PDF", description: "Get a fresh perspective. Rotate your pages in a click.", longDescription: "Turn every page 90°, 180°, or 270° clockwise. Original page content and quality stay intact.", category: "Organize", icon: "rotate", color: "coral", accept: ".pdf" },
  { id: "watermark", name: "Watermark PDF", description: "Make it yours with a text stamp or watermark.", longDescription: "Add a custom text watermark to every page. Adjust the size, position, and transparency to make it just right.", category: "Edit & optimize", icon: "watermark", color: "purple", accept: ".pdf" },
  { id: "organize", name: "Organize PDF", description: "A little rearranging. A perfectly ordered document.", longDescription: "Reorder your PDF pages with a simple page list. Enter page numbers in the order you want them to appear; add a page more than once if you need a copy.", category: "Organize", icon: "organize", color: "coral", accept: ".pdf" },
  { id: "protect", name: "Protect PDF", description: "Keep your documents safe with a password.", longDescription: "Add an opening password with 128-bit RC4 encryption. Use a strong, unique password and keep it somewhere safe; it cannot be recovered.", category: "Security", icon: "lock", color: "green", accept: ".pdf" },
  { id: "unlock", name: "Unlock PDF", description: "Open up your PDFs. Remove password protection.", longDescription: "Remove password protection from a PDF you own or have permission to edit. Enter its opening password. Pages are rendered to preserve their appearance; editable text and links are not retained.", category: "Security", icon: "unlock", color: "green", accept: ".pdf" },
  { id: "page-numbers", name: "Page numbers", description: "Keep everyone on the same page. Literally.", longDescription: "Add clean, consistent page numbers to every page. Choose the starting number and a top or bottom position.", category: "Edit & optimize", icon: "numbers", color: "purple", accept: ".pdf" },
  { id: "remove", name: "Remove pages", description: "Make some space. Delete the pages you don’t need.", longDescription: "Remove selected pages from your PDF. All other pages are kept in their original order, with content and quality intact.", category: "Organize", icon: "remove", color: "coral", accept: ".pdf" },
  { id: "extract", name: "Extract pages", description: "Pull out the important bits into a new PDF.", longDescription: "Pick exactly the pages you want and save them as a new, smaller PDF. Enter individual page numbers or ranges like 1–3, 5.", category: "Organize", icon: "extract", color: "coral", accept: ".pdf" },
  { id: "crop", name: "Crop PDF", description: "Trim the edges. Let your content take the spotlight.", longDescription: "Trim the same margin from all four edges of each page. Set your margin in points (72 points = one inch).", category: "Edit & optimize", icon: "crop", color: "purple", accept: ".pdf" },
  { id: "pdf-to-text", name: "PDF to text", description: "Just the words. Extract readable text in a click.", longDescription: "Extract a PDF’s text into a plain TXT file. Text-based PDFs work best; scanned images do not contain a text layer.", category: "Convert", icon: "text", color: "blue", accept: ".pdf" },
  { id: "word-to-pdf", name: "Word to PDF", description: "From editable draft to a share-ready document.", longDescription: "Convert a DOCX file into a clean, text-based PDF. Basic headings, paragraphs, lists, and images are supported; advanced Word layouts are simplified.", category: "Convert", icon: "document", color: "blue", accept: ".docx" },
  { id: "pdf-to-png", name: "PDF to PNG", description: "Crisp, clear images from every page of your PDF.", longDescription: "Export PDF pages as high-resolution PNG images. Transparent page backgrounds are preserved, and multi-page exports come in a ZIP.", category: "Convert", icon: "png", color: "blue", accept: ".pdf" },
  { id: "repair", name: "Repair PDF", description: "A fresh start for PDFs that need a little help.", longDescription: "Rebuild the PDF’s internal structure to fix recoverable file issues. This can help with minor corruption, but cannot restore missing file content.", category: "Edit & optimize", icon: "repair", color: "purple", accept: ".pdf" },
  { id: "flatten", name: "Flatten PDF", description: "Make a stable, non-editable copy of your PDF.", longDescription: "Render each page to an image and rebuild the PDF, flattening annotations, form fields, and layers. Text becomes part of the image, so links and searchability are not retained.", category: "Edit & optimize", icon: "flatten", color: "purple", accept: ".pdf" },
];

export const categories: Category[] = ["Organize", "Convert", "Edit & optimize", "Security"];
export const toolIds = tools.map((tool) => tool.id);
export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index > 0 ? 1 : 0)} ${units[index]}`;
}
