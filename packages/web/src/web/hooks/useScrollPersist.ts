import { useEffect, useRef } from "react";

/**
 * Saves + restores scroll position in sessionStorage for a given key.
 * Usage: const ref = useScrollPersist("modules-list");
 * Apply ref to the scrollable container.
 */
export function useScrollPersist(key: string) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Restore
    const saved = sessionStorage.getItem(`tls_scroll_${key}`);
    if (saved) el.scrollTop = parseInt(saved, 10);

    // Save on scroll
    const onScroll = () => {
      sessionStorage.setItem(`tls_scroll_${key}`, String(el.scrollTop));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [key]);

  return ref;
}
