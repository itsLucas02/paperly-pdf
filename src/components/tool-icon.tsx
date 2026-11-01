import { Layers2, Scissors, Minimize2, FileType2, Images, Image, RotateCw, Stamp, PanelsTopLeft, LockKeyhole, LockKeyholeOpen, ListOrdered, FileMinus2, Files, Crop, Text, FileText, ImagePlus, Wrench, Copy, type LucideIcon } from "lucide-react";
import type { Tool } from "@/lib/tools";

const icons: Record<string, LucideIcon> = { merge: Layers2, split: Scissors, compress: Minimize2, word: FileType2, images: Images, image: Image, rotate: RotateCw, watermark: Stamp, organize: PanelsTopLeft, lock: LockKeyhole, unlock: LockKeyholeOpen, numbers: ListOrdered, remove: FileMinus2, extract: Files, crop: Crop, text: Text, document: FileText, png: ImagePlus, repair: Wrench, flatten: Copy };
export function ToolIcon({ tool, size = 24, className = "" }: { tool: Tool; size?: number; className?: string }) {
  const Icon = icons[tool.icon] ?? FileText;
  return <span className={`tool-icon ${tool.color} ${className}`}><Icon size={size} strokeWidth={1.8} aria-hidden="true" /></span>;
}
