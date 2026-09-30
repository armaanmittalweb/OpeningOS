import { useCallback, useEffect, useRef } from 'react';
import { isAllowedOrigin, parentOrigin, parseInbound, sanitizeTokens, type Command, type Outbound } from './protocol';

/** Wire the embed to its parent frame: origin-checked in both directions. */
export function useParent(onCommand: (c: Command) => void) {
  const origin = useRef<string | null>(null);
  const cmd = useRef(onCommand);
  cmd.current = onCommand;
  const framed = typeof window !== 'undefined' && window.parent !== window;

  const post = useCallback(
    (msg: Outbound) => {
      if (framed && origin.current) window.parent.postMessage(msg, origin.current);
    },
    [framed],
  );

  useEffect(() => {
    origin.current = parentOrigin(document.referrer, location.ancestorOrigins);
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent || !isAllowedOrigin(e.origin)) return;
      origin.current = e.origin;
      const msg = parseInbound(e.data);
      if (!msg) return;
      if (msg.type === 'command') cmd.current(msg.name);
      else {
        const { vars, scheme } = sanitizeTokens(msg.tokens);
        const root = document.documentElement;
        for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
        if (scheme) root.dataset.theme = scheme;
      }
    };
    window.addEventListener('message', onMessage);
    post({ type: 'ready' });

    let last = 0;
    const ro = new ResizeObserver(() => {
      const px = Math.ceil(document.documentElement.getBoundingClientRect().height);
      if (px !== last) {
        last = px;
        post({ type: 'height', px });
      }
    });
    ro.observe(document.body);
    return () => {
      window.removeEventListener('message', onMessage);
      ro.disconnect();
    };
  }, [post]);

  return post;
}
