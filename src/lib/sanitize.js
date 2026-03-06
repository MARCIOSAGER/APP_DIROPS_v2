import DOMPurify from 'dompurify';

/**
 * Sanitize HTML string to prevent XSS attacks.
 * Allows safe tags (formatting, links, tables) but strips scripts and event handlers.
 */
export function sanitizeHtml(dirty) {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'h1', 'h2', 'h3', 'h4', 'img', 'hr'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class', 'src', 'alt', 'width', 'height', 'colspan', 'rowspan'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Validate redirect URL - only allow same-origin paths.
 * Prevents open redirect attacks.
 */
export function safeRedirectUrl(url, fallback = '/') {
  if (!url) return fallback;
  // Only allow relative paths starting with / (but not //)
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  // Allow same-origin absolute URLs
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin === window.location.origin) return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    // Invalid URL
  }
  return fallback;
}
