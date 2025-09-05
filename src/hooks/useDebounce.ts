import { useEffect, useRef, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  const t = useRef<number | null>(null);
  useEffect(() => {
    if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setDebounced(value), delayMs);
    return () => {
      if (t.current) window.clearTimeout(t.current);
    };
  }, [value, delayMs]);
  return debounced;
}

