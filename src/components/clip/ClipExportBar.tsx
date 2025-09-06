import React from "react";

type Props = {
  exportScope: "all" | "pinned" | "filtered";
  setExportScope: (v: "all" | "pinned" | "filtered") => void;
  exportSort: "pinned-date-desc" | "date-desc" | "date-asc" | "position";
  setExportSort: (v: "pinned-date-desc" | "date-desc" | "date-asc" | "position") => void;
  exportNotesOnly: boolean;
  setExportNotesOnly: (v: boolean) => void;
  exportFilename: string;
  setExportFilename: (v: string) => void;
  copiedName: boolean;
  copyFilename: () => void;
  onDownload: () => void;
  onCancel: () => void;
  suggest: (withExt?: boolean) => string;
  count: number;
};

export const ClipExportBar: React.FC<Props> = ({ exportScope, setExportScope, exportSort, setExportSort, exportNotesOnly, setExportNotesOnly, exportFilename, setExportFilename, copiedName, copyFilename, onDownload, onCancel, suggest, count }) => {
  return (
    <div className="px-4 py-2 export-bar border-b border-sepia-200 flex items-center gap-3 text-sm flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-sepia-700">Scope:</label>
        <select
          className="px-2 py-1 rounded-lg border border-sepia-200 bg-white"
          value={exportScope}
          onChange={(e) => setExportScope(e.target.value as "all" | "pinned" | "filtered")}
        >
          <option value="all">All clips</option>
          <option value="pinned">Pinned only</option>
          <option value="filtered">Current filter</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sepia-700">Sort:</label>
        <select
          className="px-2 py-1 rounded-lg border border-sepia-200 bg-white"
          value={exportSort}
          onChange={(e) => setExportSort(e.target.value as "pinned-date-desc" | "date-desc" | "date-asc" | "position")}
        >
          <option value="pinned-date-desc">Pinned first, date desc</option>
          <option value="date-desc">Date desc</option>
          <option value="date-asc">Date asc</option>
          <option value="position">Position</option>
        </select>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={exportNotesOnly} onChange={(e) => setExportNotesOnly(e.target.checked)} />
        <span>Only clips with notes</span>
      </label>
      <div className="flex items-center gap-2 text-xs text-sepia-700">
        <span>Filename:</span>
        <input className="px-2 py-1 bg-white border border-sepia-200 rounded w-64" value={exportFilename} onChange={(e)=>setExportFilename(e.target.value)} placeholder={suggest(true)} onKeyDown={(e)=>{ if (e.key==='Escape'){ e.stopPropagation(); } }} />
        <button className="px-2 py-1 rounded border border-sepia-200 bg-white hover:bg-sepia-50" onClick={copyFilename}>{copiedName ? 'Copied' : 'Copy suggested'}</button>
      </div>
      <button className="px-3 py-1 rounded-lg border border-sepia-300 bg-white hover:bg-sepia-50" onClick={onDownload}>Download PDF</button>
      <button className="px-3 py-1 rounded-lg border border-sepia-200" onClick={onCancel}>Cancel</button>
      <div className="text-xs text-sepia-700">Will export {count} clips</div>
    </div>
  );
};

export default ClipExportBar;
