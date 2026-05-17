/* OpeningOS — small markdown renderer
 * Escapes raw HTML, permits only generated markdown tags, and allows only
 * http/https/# links. Suitable for local user notes and imported comments.
 */
(function (global) {
  'use strict';

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/`/g, '&#96;'); }
  function safeUrl(url) {
    const raw = String(url || '').trim();
    if (/^https?:\/\//i.test(raw) || /^#[-_a-zA-Z0-9]+$/.test(raw)) return raw;
    return '';
  }

  function inline(text) {
    const code = [];
    text = String(text).replace(/`([^`]+?)`/g, (_, c) => {
      const idx = code.push(`<code>${escapeHtml(c)}</code>`) - 1;
      return `\u0000CODE${idx}\u0000`;
    });
    text = escapeHtml(text);
    text = text.replace(/\[([^\]]+?)\]\(([^)\s]+?)\)/g, (_, t, u) => {
      const href = safeUrl(u);
      if (!href) return `${t} (${escapeHtml(u)})`;
      return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${t}</a>`;
    });
    text = text.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?=[^\w*]|$)/g, '$1<em>$2</em>');
    text = text.replace(/(^|[^\w_])_([^_\s][^_]*?)_(?=[^\w_]|$)/g, '$1<em>$2</em>');
    text = text.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => code[Number(i)] || '');
    return text;
  }

  function render(input) {
    if (!input) return '';
    const lines = String(input).replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      if (/^\s*$/.test(lines[i])) { i++; continue; }
      const h = lines[i].match(/^(#{1,4})\s+(.*)$/);
      if (h) { const level = h[1].length; out.push(`<h${level + 2}>${inline(h[2])}</h${level + 2}>`); i++; continue; }
      if (/^\s*[-*+]\s+/.test(lines[i])) {
        const items = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\s*[-*+]\s+/, ''))}</li>`); i++; }
        out.push(`<ul>${items.join('')}</ul>`); continue;
      }
      if (/^\s*\d+\.\s+/.test(lines[i])) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`); i++; }
        out.push(`<ol>${items.join('')}</ol>`); continue;
      }
      const paraLines = [];
      while (i < lines.length && lines[i] && !/^\s*$/.test(lines[i]) && !/^(#{1,4})\s+/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) { paraLines.push(lines[i]); i++; }
      out.push(`<p>${inline(paraLines.join(' '))}</p>`);
    }
    return out.join('');
  }

  function renderToFragment(input) {
    const template = document.createElement('template');
    template.innerHTML = render(input);
    return template.content.cloneNode(true);
  }

  global.OOSMarkdown = { render, renderToFragment, escapeHtml };
})(window);
