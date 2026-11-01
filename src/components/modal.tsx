"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ title, subtitle, children, onClose, className = "", busy = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; className?: string; busy?: boolean }) {
  const label = useId();
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => box.current?.querySelector<HTMLElement>("[autofocus],button,input,select,textarea,[tabindex='0']")?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) closeRef.current();
      if (event.key !== "Tab") return;
      const focusable = box.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex='0']");
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", onKey); document.body.style.overflow = old; previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}><div className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={label} ref={box} tabIndex={-1}><div className="modal-header"><div><h2 id={label}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="icon-button close-modal" onClick={onClose} disabled={busy} aria-label="Close dialog"><X size={20}/></button></div>{children}</div></div>;
}
