import React, { useEffect, useState } from "react";

export function DropOverlay({ onFile }: { onFile: (file: File) => void }) {
  const [active, setActive] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      // Only react to file drags
      const hasFiles = Array.from(e.dataTransfer.types || []).includes("Files");
      if (!hasFiles) return;
      e.preventDefault();
      setDragDepth((d) => d + 1);
      setActive(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      const hasFiles = Array.from(e.dataTransfer.types || []).includes("Files");
      if (!hasFiles) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      setDragDepth((d) => Math.max(0, d - 1));
    };
    const onDrop = (e: DragEvent) => {
      setDragDepth(0);
      setActive(false);
      if (!e.dataTransfer) return;
      e.preventDefault();
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [onFile]);

  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => setActive(false), 3000);
    return () => window.clearTimeout(t);
  }, [active, dragDepth]);

  if (!active) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center" style={{ background: "rgba(0,0,0,.2)" }}>
      <div className="px-5 py-3 rounded-xl border-2 border-dashed border-sepia-300 bg-white/80 backdrop-blur text-sepia-800 shadow">
        Drop file to import (.txt, .md, .html, .pdf, .docx)
      </div>
    </div>
  );
}

export default DropOverlay;

