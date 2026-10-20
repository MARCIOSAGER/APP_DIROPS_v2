// PDF protegido para documentos AVSEC — carimba a tarja "INFORMAÇÃO RESTRITA AVSEC" em todas as páginas e
// encripta o ficheiro com uma senha GERADA na hora (AES-256, só impressão). Tudo no navegador, como a app de
// avaliação de risco AVSEC do dono: a senha é mostrada uma vez, copia-se e partilha-se à parte; o ficheiro e a
// senha nunca vão no mesmo canal. A senha em claro NÃO é guardada — só um hash curto vai ao log de auditoria.
// @cantoo/pdf-lib carrega-se só quando se gera um PDF protegido (import dinâmico), para não pesar no bundle inicial.
const TARJA = 'INFORMAÇÃO RESTRITA AVSEC';
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; // sem O/0/I/l/1 ambíguos

// senha forte e legível (para copiar à mão se preciso)
export function gerarSenha(n = 14) {
  const a = new Uint32Array(n);
  (globalThis.crypto || window.crypto).getRandomValues(a);
  let s = '';
  for (let i = 0; i < n; i++) s += ALFABETO[a[i] % ALFABETO.length];
  return s;
}

// hash curto da senha (SHA-256 → 12 hex) para o log de auditoria; nunca a senha em claro
export async function hashCurtoSenha(senha) {
  const buf = await (globalThis.crypto || window.crypto).subtle.digest('SHA-256', new TextEncoder().encode(senha));
  return [...new Uint8Array(buf)].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('');
}

// carimba a tarja em todas as páginas e encripta; devolve { bytes, senha }
export async function protegerPdfAvsec(bytesEntrada, { rodape = '' } = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import('@cantoo/pdf-lib');
  const doc = await PDFDocument.load(bytesEntrada, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const vermelho = rgb(0.72, 0.11, 0.11);
  const size = 8;
  for (const page of doc.getPages()) {
    const { width } = page.getSize();
    const tw = font.widthOfTextAtSize(TARJA, size);
    page.drawText(TARJA, { x: Math.max(8, (width - tw) / 2), y: 12, size, font, color: vermelho });
    if (rodape) {
      const rs = 6.5; const rf = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText(rodape, { x: 8, y: 4, size: rs, font: rf, color: rgb(0.45, 0.45, 0.45) });
    }
  }
  const senha = gerarSenha();
  doc.encrypt({
    userPassword: senha,
    ownerPassword: senha + '-adm',
    permissions: { printing: 'highResolution', copying: false, modifying: false, annotating: false, fillingForms: false, contentAccessibility: true, documentAssembly: false },
  });
  const bytes = await doc.save();
  return { bytes, senha };
}

// um documento do GED está sob o regime de vista restrita AVSEC?
export function ehAvsecRestrito(doc, { setorCodigo } = {}) {
  if (!doc) return false;
  if (doc.classificado) return true;
  if ((doc.nivel_confidencialidade || '') === 'secreto') return true;
  if (setorCodigo === 'AVSEC') return true;
  return false;
}
