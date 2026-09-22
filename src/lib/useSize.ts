import { useLayoutEffect, useRef, useState } from 'react';

/** Width of a container, kept in sync with ResizeObserver — charts render at the real pixel width. */
export function useWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width || fallback);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width || fallback));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}
