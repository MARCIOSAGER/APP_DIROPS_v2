# Corrige restos de cópia de outros aeroportos e alinha os códigos internos com o GED. Trabalha em CÓPIAS (pasta corrigidos\).
import pymupdf, zipfile, re, os, shutil, json
D = r'C:\Users\dirops\Downloads'; OUT = 'corrigidos'; os.makedirs(OUT, exist_ok=True); os.makedirs('png', exist_ok=True)
rel = []

# ---------- PDF: troca de texto preservando posição, tamanho, negrito e cor ----------
def span_em(page, rect):
    best = None
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                r = pymupdf.Rect(s['bbox'])
                if r.intersects(rect) and (best is None or r.width < pymupdf.Rect(best['bbox']).width): best = s
    return best
def trocar_pdf(pasta, nome, trocas):
    src = os.path.join(D, pasta, nome); doc = pymupdf.open(src); feitas = []
    for (pags, velho, novo, centrar) in trocas:
        for pno in (pags or range(doc.page_count)):
            page = doc[pno - 1] if pags else doc[pno]
            rects = page.search_for(velho)
            for r in rects:
                s = span_em(page, r)
                size = s['size'] if s else 10; bold = bool(s and (s['flags'] & 16 or 'Bold' in s['font']))
                col = s['color'] if s else 0; color = ((col >> 16) / 255, ((col >> 8) & 255) / 255, (col & 255) / 255)
                clip = r + (-30, -6, 30, 6)
                page.get_pixmap(dpi=110, clip=clip).save(f"png/{nome[:14]}_p{page.number+1}_{len(feitas)}_antes.png")
                page.add_redact_annot(r, fill=None)
                page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)
                fname = 'hebo' if bold else 'helv'
                w = pymupdf.get_text_length(novo, fontname=fname, fontsize=size)
                x = (r.x0 + r.x1) / 2 - w / 2 if centrar else r.x0
                base = r.y1 - (r.height - size) * 0.5 - size * 0.22
                page.insert_text((x, base), novo, fontname=fname, fontsize=size, color=color)
                page.get_pixmap(dpi=110, clip=clip + (-max(0, w - r.width), 0, max(0, w - r.width), 0)).save(f"png/{nome[:14]}_p{page.number+1}_{len(feitas)}_depois.png")
                feitas.append(f"p.{page.number+1}: «{velho}» → «{novo}»")
    doc.save(os.path.join(OUT, nome), garbage=3, deflate=True)
    rel.append({'ficheiro': nome, 'trocas': feitas}); print(nome[:60], '→', len(feitas), 'trocas'); [print('   ', f) for f in feitas]

trocar_pdf('Huambo', 'MA-FNHU-MOA-001 Manual de Operações de Aeroporto Albano Machado - Huambo.pdf', [
  (None, 'MARIA MABU CAFÉ', 'ALBANO MACHADO', False),
  (None, 'AEROPORTO DE CABINDA', 'AEROPORTO DO HUAMBO', False),
  (None, 'MA-FNCT-MOA-001', 'MA-FNHU-MOA-001', False)])
trocar_pdf('Cabinda', 'MA-FNCA-MOA-001 Manual de Operações de Aeroporto da Maria Mambo Café.pdf', [
  (None, 'MA-FNCT-MOA-001', 'MA-FNCA-MOA-001', False)])
trocar_pdf('Cabinda', 'NRM-FNCA-NOCLA-001 Normas de Circulação de Pessoas e Equipamentos no Lado Ar.pdf', [
  (None, 'AEROPORTO INTERNACIONAL DA', 'AEROPORTO', False),
  (None, 'MUKANKA', 'MARIA MAMBO CAFÉ', False)])
trocar_pdf('Cabinda', 'PL-FNCA-PRAFS-001 Plano de Remoção de Aeronaves Fora de Serviço.pdf', [
  (None, 'LT-FNUB-PRAFS-002', 'LT-FNCA-PRAFS-002', False)])
trocar_pdf('Cabinda', 'POP-FNCA-MOA-001 Procedimento de Reportes de Segurança Operacional .pdf', [
  (None, 'WELWITSCHIA MIRABILIS', 'MARIA MAMBO CAFÉ', True)])
trocar_pdf('Huambo', 'POP-FNHU-MOA-002 Procedimento de Notificação de Colisão com Aves.pdf', [
  ([2], 'FNCA', 'FNHU', False)])

# ---------- DOCX/XLSX: troca dentro do XML, mesmo com o texto partido em vários «runs» ----------
def trocar_runs(xml, velho, novo):
    n = 0
    def por_par(m):
        nonlocal n
        p = m.group(0)
        ts = list(re.finditer(r'(<w:t(?: [^>]*)?>)([^<]*)(</w:t>)', p))
        texto = ''.join(t.group(2) for t in ts)
        if velho not in texto: return p
        novo_texto = texto.replace(velho, novo); n += texto.count(velho)
        # mantém a formatação do primeiro run; os seguintes ficam vazios
        partes = [novo_texto] + [''] * (len(ts) - 1)
        out, last = [], 0
        for t, txt in zip(ts, partes):
            abre = t.group(1) if 'xml:space' in t.group(1) else t.group(1).replace('<w:t', '<w:t xml:space="preserve"', 1)
            out.append(p[last:t.start()]); out.append(abre + txt + t.group(3)); last = t.end()
        out.append(p[last:]); return ''.join(out)
    return re.sub(r'<w:p[ >].*?</w:p>', por_par, xml, flags=re.S), n
def trocar_zip(pasta, nome, trocas, destino=None):
    src = os.path.join(D, pasta, nome); dst = os.path.join(OUT, destino or nome); total = []
    zin = zipfile.ZipFile(src); zout = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
    for it in zin.infolist():
        dados = zin.read(it.filename)
        if it.filename.endswith('.xml'):
            x = dados.decode('utf8')
            for velho, novo in trocas:
                if it.filename.startswith('word/'):
                    x, k = trocar_runs(x, velho, novo)
                else:
                    k = x.count(velho); x = x.replace(velho, novo)
                if k: total.append(f"{it.filename}: «{velho}» → «{novo}» ×{k}")
            dados = x.encode('utf8')
        zout.writestr(it, dados)
    zout.close(); rel.append({'ficheiro': nome, 'trocas': total}); print(nome[:60], '→'); [print('   ', t) for t in total]

trocar_zip('Cabinda', 'FR- FNCA-MOA-008_Formulário de Inspecção Diaria de Balizamento de Obstáculos_CABINDA.docx', [('FNHU - 008', 'FR-FNCA-MOA-017')])
trocar_zip('Cabinda', 'FR- FNCA-MOA-010 Formulário de Supervisão Anual de Obstáculos_CABINDA_00.docx', [('FR-FNCA-MOA-010', 'FR-FNCA-MOA-019'), ('FNCA-MOA-010', 'FNCA-MOA-019')])
trocar_zip('Huambo', 'FR- FNHU-OPS-020- Formulário Diário de Dispersão.docx', [('FR-FNHU-OPS-020', 'FR-FNHU-PGRF-020')])
trocar_zip('Huambo', 'LT-FNHU-SO-001 Lista MOR (Lista de Reportes Obrigatórios de Segurança Operacional).docx', [('LT-FNHU-SO-001', 'LT-FNHU-MGSO-001')])
trocar_zip('Cabinda', 'LT-FNCA-SO-001 Lista MOR (Lista de Reportes Obrigatórios de Segurança Operacional).docx', [('LT-FNCA-SO-001', 'LT-FNCA-MGSO-001')])
trocar_zip('Huambo', 'FR-FNHU-MOA-015 Formulário de Analise de Incidentes, Acidentes e ESO.xlsx', [('FR-FNCA-MOA-014', 'FR-FNHU-MOA-015')])
json.dump(rel, open('relatorio-correcoes.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
