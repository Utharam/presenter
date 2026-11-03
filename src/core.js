export const MAX_HTML_BYTES = 25 * 1024 * 1024;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

export function extractTitle(html) {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match) return '';
  let text = match[1].replace(/<[^>]*>/g, '');
  // Single pass: `&amp;lt;` is the literal text "&lt;", never "<".
  text = text.replace(/&(amp|lt|gt|quot|#39);/g, (_, name) => ENTITIES[name]);
  text = text.replace(/\s+/g, ' ').trim();
  return text.slice(0, 120);
}

export function injectBridge(html, bridgeSource) {
  const tag = `<script data-presenter-bridge>${bridgeSource}</script>`;
  const lower = html.toLowerCase();
  let offset = lower.lastIndexOf('</body>');
  if (offset === -1) offset = lower.lastIndexOf('</html>');
  if (offset === -1) return html + tag;
  return html.slice(0, offset) + tag + html.slice(offset);
}

export function notesKey(deckId, index) {
  return `presenter:note:${deckId}:${index}`;
}

export function slugify(title) {
  let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  slug = slug.slice(0, 60).replace(/-+$/, '');
  return slug || 'deck';
}

export function isOverSizeLimit(html) {
  return new TextEncoder().encode(html).length > MAX_HTML_BYTES;
}
