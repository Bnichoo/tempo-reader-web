import { useEffect, useRef, useState } from "react";
import type { Clip } from "../types";
import { clipRepository } from "../lib/clipUtils";
import { loadClips as loadClipsStorage, saveClips as saveClipsStorage } from "../lib/storage";
import { clipsGetByDoc } from "../lib/idb";

export function useClips(docId?: string) {
  const [clips, setClips] = useState<Clip[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        if (docId) {
          const list = await clipsGetByDoc(docId);
          setClips(clipRepository.prune(clipRepository.migrate(list as unknown[])));
        } else {
          const raw = await loadClipsStorage();
          if (raw?.length) {
            const migrated = clipRepository.migrate(raw as unknown[]);
            setClips(clipRepository.prune(migrated));
          } else setClips([]);
        }
      } finally {
        // Mark as loaded, and allow future saves
        setTimeout(() => { loadedRef.current = true; }, 0);
      }
    })();
  }, [docId]);

  // Save clips when they change after initial load
  useEffect(() => {
    if (!loadedRef.current) return;
    void saveClipsStorage(clips);
  }, [clips]);

  const togglePin = (id: string) => setClips(prev => prev.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c));
  const deleteClip = (id: string) => setClips(prev => prev.filter(c => c.id !== id));

  return { clips, setClips, togglePin, deleteClip } as const;
}
