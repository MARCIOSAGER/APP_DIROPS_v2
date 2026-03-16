/**
 * DIROPS — Centralized PDF Template
 *
 * Usage:
 *   import { createPdfDoc, addHeader, addFooter, addTable, checkPageBreak, PDF } from '@/lib/pdfTemplate';
 *
 *   const doc = await createPdfDoc({ orientation: 'portrait' });
 *   const y = addHeader(doc, { title: 'Relatório de GRF', subtitle: 'Condições da Pista', logoBase64, date: '12/03/2026', meta: ['Aeroporto: FNLU', 'Gerado por: Admin'] });
 *   // ... add content starting at y ...
 *   addFooter(doc, { generatedBy: 'Admin' });
 *   doc.save('relatorio.pdf');
 */

// ─── Design Tokens ───────────────────────────────────────────────
export const PDF = {
  // Colors (RGB arrays)
  colors: {
    primary:      [0, 74, 153],      // Dark blue — headers, titles
    primaryLight: [219, 234, 254],    // Light blue — info boxes
    primaryBorder:[191, 219, 254],    // Blue border
    dark:         [15, 23, 42],       // Near black — body text
    body:         [51, 65, 85],       // Slate 700 — secondary text
    muted:        [100, 116, 139],    // Slate 500 — captions, footers
    light:        [148, 163, 184],    // Slate 400 — subtle text
    separator:    [226, 232, 240],    // Slate 200 — lines
    bgStripe:     [248, 250, 252],    // Slate 50 — alternating rows
    white:        [255, 255, 255],
    black:        [0, 0, 0],
    success:      [5, 150, 105],      // Green
    danger:       [220, 38, 38],      // Red
    warning:      [217, 119, 6],      // Amber
    tableHeader:  [30, 58, 95],       // Dark navy — table header bg
    tableHeaderFg:[255, 255, 255],    // White — table header text
  },

  // Font sizes (pt)
  font: {
    title:    16,   // Report title
    subtitle: 11,   // Report subtitle / section headers
    body:     9,    // Body text, table cells
    small:    8,    // Secondary info
    caption:  7,    // Footer, page numbers
    tiny:     6,    // Fine print
  },

  // Margins (mm)
  margin: {
    top:    15,
    bottom: 15,
    left:   15,
    right:  15,
  },

  // Logo (400x483, ratio 0.83:1, proportional)
  logo: {
    width:  23,
    height: 28,
    x:      15,
    y:      5,
  },

  // Page dimensions A4 (mm)
  page: {
    portrait:  { w: 210, h: 297 },
    landscape: { w: 297, h: 210 },
  },

  // Decorative header bar
  headerBar: {
    height: 0.5,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────

/** Dynamically import jsPDF */
export async function createPdfDoc({ orientation = 'portrait', unit = 'mm', format = 'a4' } = {}) {
  const { default: jsPDF } = await import('jspdf');
  return new jsPDF({ orientation, unit, format });
}

/** Convert SVG/image URL to base64 PNG for jsPDF */
export async function loadImageAsBase64(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image: ' + url));
    img.src = url;
  });
}

/**
 * Fetch empresa logo as base64 from user's empresa_id.
 * Falls back to DIROPS default logo if no empresa or no logo_url.
 * @param {string} empresaId - UUID of the empresa
 * @returns {Promise<string|null>} base64 data URL or null
 */
export async function fetchEmpresaLogo(empresaId) {
  try {
    if (empresaId) {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: empresa } = await supabase.from('empresa').select('logo_url').eq('id', empresaId).single();
      if (empresa?.logo_url) {
        const response = await fetch(empresa.logo_url);
        const blob = await response.blob();
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      }
    }
    // Fallback: logo padrão DIROPS
    return await loadImageAsBase64('/logo-dirops.png');
  } catch (e) {
    console.warn('Não foi possível carregar logo:', e);
    try {
      return await loadImageAsBase64('/logo-dirops.png');
    } catch {
      return null;
    }
  }
}

/** Get page dimensions based on orientation */
function getPageDims(doc) {
  return {
    w: doc.internal.pageSize.getWidth(),
    h: doc.internal.pageSize.getHeight(),
  };
}

/** Set text color from RGB array */
function setColor(doc, rgb) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

/** Set fill color from RGB array */
function setFill(doc, rgb) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

/** Set draw color from RGB array */
function setDraw(doc, rgb) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

// ─── Header ───────────────────────────────────────────────────────

/**
 * Add standardized header to current page.
 *
 * @param {jsPDF} doc
 * @param {Object} opts
 * @param {string} opts.title - Report title (e.g. "Relatório de GRF")
 * @param {string} [opts.subtitle] - Optional subtitle
 * @param {string} [opts.logoBase64] - Logo as base64 data URL
 * @param {string} [opts.date] - Date string
 * @param {string[]} [opts.meta] - Extra metadata lines (e.g. ["Aeroporto: FNLU", "Total: 42"])
 * @returns {number} Y position where content should start
 */
export function addHeader(doc, { title, subtitle, logoBase64, date, meta = [] } = {}) {
  const { w } = getPageDims(doc);
  const m = PDF.margin;
  let y = 10;

  // Calculate logo dimensions dynamically from image ratio
  const maxH = PDF.logo.height; // max height in mm
  const maxW = 35; // max width in mm
  let logoW = PDF.logo.width;
  let logoH = PDF.logo.height;

  if (logoBase64) {
    try {
      // Extract image dimensions from base64 via jsPDF's internal method
      const imgProps = doc.getImageProperties(logoBase64);
      const ratio = imgProps.width / imgProps.height;
      // Fit within maxW x maxH keeping aspect ratio
      if (ratio >= 1) {
        // Horizontal/square logo
        logoW = Math.min(maxW, maxH * ratio);
        logoH = logoW / ratio;
      } else {
        // Vertical logo (like DIROPS)
        logoH = maxH;
        logoW = logoH * ratio;
        if (logoW > maxW) {
          logoW = maxW;
          logoH = logoW / ratio;
        }
      }
    } catch (_) {
      // Fallback to defaults
    }
  }

  // Align title baseline with logo bottom, subtitle above
  const logoY = PDF.logo.y;
  const logoBottom = logoY + logoH;
  const titleLineY = logoBottom; // title baseline at logo bottom
  const subtitleLineY = titleLineY - 6; // subtitle above title

  // Title center (e.g. "Cálculo de Tarifas Aeroportuárias")
  if (title) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(PDF.font.title);
    setColor(doc, PDF.colors.dark);
    doc.text(title, w / 2, titleLineY, { align: 'center' });
  }

  // Subtitle left (e.g. "N.º PF-2026-000003")
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(PDF.font.subtitle);
    setColor(doc, PDF.colors.body);
    doc.text(subtitle, m.left, subtitleLineY);
  }

  // Empresa logo (right side, proportional)
  if (logoBase64) {
    try {
      const rightLogoX = w - m.right - logoW;
      doc.addImage(logoBase64, 'PNG', rightLogoX, logoY, logoW, logoH);
    } catch (e) {
      console.warn('PDF: Logo could not be added', e.message);
    }
  }

  y = logoY + logoH + 1;

  // Decorative blue bar
  setFill(doc, PDF.colors.primary);
  doc.rect(m.left, y, w - m.left - m.right, PDF.headerBar.height, 'F');
  y += PDF.headerBar.height + 2;

  // "Direcção de Operações" (right-aligned, below the bar)
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(PDF.font.small);
  setColor(doc, PDF.colors.muted);
  doc.text('Direcção de Operações', w - m.right, y + 3, { align: 'right' });
  y += 7;

  // Meta lines
  if (meta.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(PDF.font.small);
    setColor(doc, PDF.colors.muted);
    meta.forEach(line => {
      doc.text(line, m.left, y + 3);
      y += 4;
    });
  }

  y += 4; // spacing before content
  return y;
}

// ─── Footer ───────────────────────────────────────────────────────

/**
 * Add standardized footer to ALL pages of the document.
 * Call this AFTER all content has been added (before doc.save).
 *
 * @param {jsPDF} doc
 * @param {Object} [opts]
 * @param {string} [opts.generatedBy] - User name
 */
export function addFooter(doc, { generatedBy } = {}) {
  const totalPages = doc.internal.getNumberOfPages();
  const { w, h } = getPageDims(doc);
  const m = PDF.margin;
  const now = new Date().toLocaleString('pt-AO');

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Separator line
    setDraw(doc, PDF.colors.separator);
    doc.setLineWidth(0.3);
    doc.line(m.left, h - m.bottom, w - m.right, h - m.bottom);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(PDF.font.caption);
    setColor(doc, PDF.colors.light);

    // Left: system name
    doc.text('DIROPS — Sistema de Gestão Aeroportuária', m.left, h - m.bottom + 4);

    // Center: generated info
    const centerText = generatedBy
      ? `Gerado por ${generatedBy} em ${now}`
      : `Gerado em ${now}`;
    doc.text(centerText, w / 2, h - m.bottom + 4, { align: 'center' });

    // Right: page number
    doc.text(`Pág. ${i}/${totalPages}`, w - m.right, h - m.bottom + 4, { align: 'right' });
  }
}

// ─── Page Break ───────────────────────────────────────────────────

/**
 * Check if we need a page break. If yes, adds a new page and returns the header Y.
 *
 * @param {jsPDF} doc
 * @param {number} currentY - Current Y position
 * @param {number} needed - Space needed (mm)
 * @param {Object} [headerOpts] - If provided, re-adds header on new page
 * @returns {number} Updated Y position (same if no break, header Y if new page)
 */
export function checkPageBreak(doc, currentY, needed = 20, headerOpts = null) {
  const { h } = getPageDims(doc);
  const safeBottom = h - PDF.margin.bottom - 8; // 8mm for footer

  if (currentY + needed > safeBottom) {
    doc.addPage();
    if (headerOpts) {
      return addHeader(doc, headerOpts);
    }
    return PDF.margin.top;
  }
  return currentY;
}

// ─── Tables ───────────────────────────────────────────────────────

/**
 * Draw a standardized table.
 *
 * @param {jsPDF} doc
 * @param {number} startY - Y position to start
 * @param {Object} opts
 * @param {Array<{label: string, width: number, align?: string}>} opts.columns - Column definitions
 * @param {Array<Array<string>>} opts.rows - Row data (array of arrays, matching columns order)
 * @param {Object} [opts.headerOpts] - Header options for page breaks (re-renders header on new page)
 * @param {number} [opts.rowHeight=6] - Row height in mm
 * @param {number} [opts.fontSize] - Override body font size
 * @returns {number} Y position after the table
 */
export function addTable(doc, startY, { columns, rows, headerOpts = null, rowHeight = 6, fontSize } = {}) {
  const m = PDF.margin;
  const { w, h } = getPageDims(doc);
  const tableWidth = w - m.left - m.right;
  const safeBottom = h - PDF.margin.bottom - 8;
  const cellPadding = 2;
  const bodyFontSize = fontSize || PDF.font.body;

  // Normalize column widths to fit tableWidth
  const totalDefined = columns.reduce((sum, col) => sum + col.width, 0);
  if (totalDefined > tableWidth) {
    const scale = tableWidth / totalDefined;
    columns.forEach(col => { col.width = col.width * scale; });
  }

  // Calculate column positions
  const colPositions = [];
  let xPos = m.left;
  columns.forEach(col => {
    colPositions.push(xPos);
    xPos += col.width;
  });

  let y = startY;

  // ─── Draw table header ───
  const drawTableHeader = (yPos) => {
    // Header background
    setFill(doc, PDF.colors.tableHeader);
    doc.rect(m.left, yPos, tableWidth, rowHeight + 1, 'F');

    // Header text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(bodyFontSize);
    setColor(doc, PDF.colors.tableHeaderFg);

    columns.forEach((col, i) => {
      const align = col.align || 'left';
      let tx = colPositions[i] + cellPadding;
      if (align === 'center') tx = colPositions[i] + col.width / 2;
      if (align === 'right') tx = colPositions[i] + col.width - cellPadding;
      doc.text(col.label, tx, yPos + rowHeight - 1, { align });
    });

    return yPos + rowHeight + 1;
  };

  y = drawTableHeader(y);

  // ─── Draw rows ───
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(bodyFontSize);

  rows.forEach((row, rowIndex) => {
    // Page break check
    if (y + rowHeight > safeBottom) {
      doc.addPage();
      if (headerOpts) {
        y = addHeader(doc, headerOpts);
      } else {
        y = PDF.margin.top;
      }
      y = drawTableHeader(y);
    }

    // Alternating row background
    if (rowIndex % 2 === 0) {
      setFill(doc, PDF.colors.bgStripe);
      doc.rect(m.left, y, tableWidth, rowHeight, 'F');
    }

    // Row text — bold for last row if it starts with "TOTAIS" or "TOTAL"
    setColor(doc, PDF.colors.dark);
    const isLastRow = rowIndex === rows.length - 1;
    const isTotalsRow = isLastRow && String(row[0] || '').toUpperCase().startsWith('TOTA');
    doc.setFont('helvetica', isTotalsRow ? 'bold' : 'normal');

    columns.forEach((col, colIndex) => {
      const cellText = String(row[colIndex] ?? '');
      const align = col.align || 'left';
      let tx = colPositions[colIndex] + cellPadding;
      if (align === 'center') tx = colPositions[colIndex] + col.width / 2;
      if (align === 'right') tx = colPositions[colIndex] + col.width - cellPadding;

      // Truncate text if it overflows column width
      const maxWidth = col.width - cellPadding * 2;
      const truncated = doc.splitTextToSize(cellText, maxWidth)[0] || '';

      doc.text(truncated, tx, y + rowHeight - 1.5, { align });
    });

    // Bottom border
    setDraw(doc, PDF.colors.separator);
    doc.setLineWidth(0.1);
    doc.line(m.left, y + rowHeight, m.left + tableWidth, y + rowHeight);

    y += rowHeight;
  });

  return y + 2;
}

// ─── Info Box ─────────────────────────────────────────────────────

/**
 * Draw a highlighted info box (e.g., for summary data).
 *
 * @param {jsPDF} doc
 * @param {number} startY
 * @param {Array<{label: string, value: string}>} items - Label/value pairs
 * @param {Object} [opts]
 * @param {number[]} [opts.bgColor] - Background RGB
 * @param {number[]} [opts.borderColor] - Border RGB
 * @returns {number} Y position after the box
 */
export function addInfoBox(doc, startY, items, { bgColor, borderColor } = {}) {
  const m = PDF.margin;
  const { w } = getPageDims(doc);
  const boxWidth = w - m.left - m.right;
  const lineHeight = 5;
  const padding = 4;
  const boxHeight = items.length * lineHeight + padding * 2;

  const bg = bgColor || PDF.colors.primaryLight;
  const border = borderColor || PDF.colors.primaryBorder;

  // Box background
  setFill(doc, bg);
  setDraw(doc, border);
  doc.setLineWidth(0.3);
  doc.roundedRect(m.left, startY, boxWidth, boxHeight, 2, 2, 'FD');

  // Content
  let y = startY + padding + 3;
  items.forEach(({ label, value }) => {
    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(PDF.font.small);
    setColor(doc, PDF.colors.muted);
    doc.text(label + ':', m.left + padding, y);

    // Value
    doc.setFont('helvetica', 'bold');
    setColor(doc, PDF.colors.dark);
    doc.text(String(value || '—'), m.left + padding + 40, y);

    y += lineHeight;
  });

  return startY + boxHeight + 4;
}

// ─── Section Title ────────────────────────────────────────────────

/**
 * Add a section title with optional underline.
 *
 * @param {jsPDF} doc
 * @param {number} y
 * @param {string} text
 * @param {Object} [opts]
 * @param {boolean} [opts.underline=true]
 * @returns {number} Y position after the title
 */
export function addSectionTitle(doc, y, text, { underline = true } = {}) {
  const m = PDF.margin;
  const { w } = getPageDims(doc);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(PDF.font.subtitle + 1);
  setColor(doc, PDF.colors.primary);
  doc.text(text, m.left, y + 4);

  if (underline) {
    setDraw(doc, PDF.colors.primary);
    doc.setLineWidth(0.5);
    doc.line(m.left, y + 6, m.left + doc.getTextWidth(text), y + 6);
  }

  return y + 10;
}

// ─── Key-Value Pairs ──────────────────────────────────────────────

/**
 * Render label: value pairs in a 2-column layout.
 *
 * @param {jsPDF} doc
 * @param {number} y
 * @param {Array<{label: string, value: string}>} items
 * @param {Object} [opts]
 * @param {number} [opts.labelWidth=45] - Width for labels
 * @param {number} [opts.colGap=5] - Gap between columns
 * @param {boolean} [opts.twoColumns=false] - Render in 2-column layout
 * @returns {number} Y position after
 */
export function addKeyValuePairs(doc, y, items, { labelWidth = 45, twoColumns = false } = {}) {
  const m = PDF.margin;
  const { w } = getPageDims(doc);
  const lineHeight = 5;

  if (twoColumns) {
    const colWidth = (w - m.left - m.right) / 2;
    for (let i = 0; i < items.length; i += 2) {
      const leftItem = items[i];
      const rightItem = items[i + 1];

      // Left column
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(PDF.font.small);
      setColor(doc, PDF.colors.muted);
      doc.text(leftItem.label + ':', m.left, y);
      doc.setFont('helvetica', 'bold');
      setColor(doc, PDF.colors.dark);
      doc.text(String(leftItem.value || '—'), m.left + labelWidth, y);

      // Right column
      if (rightItem) {
        doc.setFont('helvetica', 'normal');
        setColor(doc, PDF.colors.muted);
        doc.text(rightItem.label + ':', m.left + colWidth, y);
        doc.setFont('helvetica', 'bold');
        setColor(doc, PDF.colors.dark);
        doc.text(String(rightItem.value || '—'), m.left + colWidth + labelWidth, y);
      }

      y += lineHeight;
    }
  } else {
    items.forEach(({ label, value }) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(PDF.font.small);
      setColor(doc, PDF.colors.muted);
      doc.text(label + ':', m.left, y);
      doc.setFont('helvetica', 'bold');
      setColor(doc, PDF.colors.dark);
      doc.text(String(value || '—'), m.left + labelWidth, y);
      y += lineHeight;
    });
  }

  return y + 2;
}
