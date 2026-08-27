import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * State backed by localStorage. Everything in this app lives on the user's
 * own machine. There is no server and nothing leaves the browser.
 *
 * `revive` gets the raw parsed JSON and returns a trusted value, so a stale
 * or hand-edited entry can't put the app into an impossible state.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
  revive?: (raw: unknown) => T | null,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed: unknown = JSON.parse(raw);
      if (revive) {
        const revived = revive(parsed);
        return revived === null ? initial : revived;
      }
      return parsed as T;
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Private browsing, or the quota is full. The app still works for
          // this session; it just won't be remembered.
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, set];
}

/**
 * The rendered width of an element.
 *
 * Charts use this to draw at their true pixel size. The previous build
 * authored its SVGs at a fixed 860px and let the browser scale them into a
 * ~660px column, which shrank every label with them, so 12px axis text landed
 * at roughly 9px on screen.
 */
export function useMeasure<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => setWidth(el.getBoundingClientRect().width);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}

/** True when the viewport is at or below `px` wide. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);

  return matches;
}

/** Stable id for saved scenarios, without pulling in a uuid dependency. */
export function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
