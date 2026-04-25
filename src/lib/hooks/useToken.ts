"use client";

import { useEffect, useState } from "react";

/**
 * Read a CSS custom property from `:root` and re-read it whenever
 * the root element's class attribute changes (i.e. dark-mode toggle).
 *
 * Recharts and inline SVG fills can't reference `var(--foo)` directly
 * in every prop — for example `<Line stroke="var(--ai)" />` doesn't
 * resolve. Use this hook to bridge the gap:
 *
 *     const aiColor = useToken("--ai", "#7c3aed");
 *     <Line stroke={aiColor} ... />
 *
 * Returns the trimmed token value (e.g. "#a78bfa") or the fallback
 * during SSR / before the hook reads. Cheap — one MutationObserver
 * watching only attribute changes on <html>.
 */
export function useToken(name: string, fallback = ""): string {
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const read = () => {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
      if (v) setValue(v);
    };

    read();

    // Re-read on theme toggle. Most apps flip a class on <html>;
    // catch attribute mutations as the trigger.
    const observer = new MutationObserver(() => read());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });

    return () => observer.disconnect();
  }, [name]);

  return value;
}
