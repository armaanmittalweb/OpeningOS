import { useEffect, useRef } from 'react';

export function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

/** Window-level shortcuts, skipped while typing in a field or when a dialog is open. */
export function useKeys(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.querySelector('dialog[open]')) return;
      ref.current(e);
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);
}

/** Board stepping shared by the builder and game review. */
export function stepKeys(e: KeyboardEvent, step: (d: number) => void, goto: (n: number) => void, end: number): boolean {
  if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowUp' || e.key === 'Home') goto(0);
  else if (e.key === 'ArrowDown' || e.key === 'End') goto(end);
  else return false;
  e.preventDefault();
  return true;
}
