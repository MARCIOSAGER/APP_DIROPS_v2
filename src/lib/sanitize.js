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

/**
 * Validate file type by checking magic bytes (file signature).
 * Returns true if the file matches an allowed type.
 */
const MAGIC_BYTES = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'image/png': [[0x89, 0x50, 0x4E, 0x47]], // .PNG
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]], // GIF8
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF
  'application/zip': [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06]], // PK
  'application/vnd.openxmlformats-officedocument': [[0x50, 0x4B, 0x03, 0x04]], // .docx/.xlsx
};

export async function validateFileType(file) {
  const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv', '.txt', '.zip'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();

  if (!allowedExtensions.includes(ext)) {
    return { valid: false, reason: `Tipo de ficheiro não permitido: ${ext}` };
  }

  // Check magic bytes for binary files
  try {
    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Skip magic byte check for text files
    if (['.csv', '.txt'].includes(ext)) return { valid: true };

    // For Office XML formats (.docx, .xlsx, .pptx), check for PK (ZIP) header
    if (['.docx', '.xlsx', '.pptx'].includes(ext)) {
      if (bytes[0] === 0x50 && bytes[1] === 0x4B) return { valid: true };
      return { valid: false, reason: 'Ficheiro corrompido ou tipo inválido' };
    }

    // For .doc/.xls/.ppt (legacy), check for OLE header
    if (['.doc', '.xls', '.ppt'].includes(ext)) {
      if (bytes[0] === 0xD0 && bytes[1] === 0xCF) return { valid: true };
      return { valid: false, reason: 'Ficheiro corrompido ou tipo inválido' };
    }

    // Check known magic bytes
    for (const [, signatures] of Object.entries(MAGIC_BYTES)) {
      for (const sig of signatures) {
        if (sig.every((b, i) => bytes[i] === b)) return { valid: true };
      }
    }

    return { valid: false, reason: 'Tipo de ficheiro não reconhecido' };
  } catch {
    return { valid: true }; // Fail open if can't read bytes
  }
}

/**
 * Sanitize a filename to prevent path traversal and invalid characters.
 */
export function sanitizeFilename(name) {
  if (!name) return 'arquivo';
  return name
    .replace(/\.\.\//g, '')
    .replace(/\.\.\\/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    || 'arquivo';
}
