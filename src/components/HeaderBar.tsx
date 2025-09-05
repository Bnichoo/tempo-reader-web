import React from "react";
import BookOpenTextIcon from "lucide-react/dist/esm/icons/book-open-text.js";
import UploadIcon from "lucide-react/dist/esm/icons/upload.js";
import PlayIcon from "lucide-react/dist/esm/icons/play.js";
import PauseIcon from "lucide-react/dist/esm/icons/pause.js";

type Props = {
  offline: boolean;
  canInstall: boolean;
  doInstall: () => void;
  isProcessingFile: boolean;
  onFile: (f: File) => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  disablePlay: boolean;
  search: string;
  setSearch: (s: string) => void;
};

export const HeaderBar: React.FC<Props> = ({ offline, canInstall, doInstall, isProcessingFile, onFile, playing, setPlaying, disablePlay, search, setSearch }) => {
  return (
    <header className="sticky top-0 z-20 backdrop-blur bg-sepia-50/80 border-b border-sepia-200">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        <BookOpenTextIcon aria-hidden size={18} />
        <h1 className="text-xl font-semibold mr-3">Tempo Reader (Web)</h1>

        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-sepia-200 bg-white/70 hover:bg-white transition cursor-pointer ml-2" aria-label="Open a text or HTML file">
          <UploadIcon aria-hidden size={16} />
          <span className="text-sm">{isProcessingFile ? "Processing..." : "Open .txt / .html"}</span>
          <input
            type="file"
            accept=".txt,.html,.htm,.md"
            className="hidden"
            disabled={isProcessingFile}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
        </label>

        <div className="ml-auto flex items-center gap-2">
          {offline && (
            <span className="px-2 py-1 rounded-lg bg-amber-200 text-amber-900 text-xs border border-amber-300">
              Offline
            </span>
          )}
          {canInstall && (
            <button
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-sepia-300 bg-white/70 hover:bg-white"
              onClick={doInstall}
              title="Install this app"
              aria-label="Install app"
            >
              Install
            </button>
          )}
          <input
            className="px-2 py-1 rounded-lg border border-sepia-200 bg-white/70 w-60 text-sm"
            placeholder="Search text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); /* keep drawer/search open */ } }}
            aria-label="Search text"
          />
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sepia-800 text-white hover:bg-sepia-700 active:scale-[.99] transition disabled:opacity-50"
            onClick={() => setPlaying(!playing)}
            disabled={disablePlay}
            title="Space"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <PauseIcon aria-hidden size={16} /> : <PlayIcon aria-hidden size={16} />}
            <span className="text-sm">{playing ? "Pause" : "Play"}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
