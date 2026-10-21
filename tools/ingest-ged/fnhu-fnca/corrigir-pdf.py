# v2: reescreve LINHAS/SPANS inteiros com a fonte do documento (Windows ou embutida no PDF), mesmo tamanho e origem.
import pymupdf, os, json
D = r'C:\Users\dirops\Downloads'; OUT = 'corrigidos'; os.makedirs(OUT, exist_ok=True); os.makedirs('png2', exist_ok=True)
WIN = {'calibri': r'C:\Windows\Fonts\calibri.ttf', 'calibri-bold': r'C:\Windows\Fonts\calibrib.ttf',
       'nirmalaui': r'C:\Windows\Fonts\Nirmala.ttf', 'nirmalaui-bold': r'C:\Windows\Fonts\NirmalaB.ttf'}
rel = []
def fonte(doc, page, span, texto):
    nome = span['font'].split('+')[-1].lower()
    if nome in WIN: return pymupdf.Font(fontfile=WIN[nome]), WIN[nome]
    for xref, ext, tipo, base, ref, enc in [(x[0], x[1], x[2], x[3], x[4], x[5]) for x in page.get_fonts()]:
        if base.split('+')[-1].lower() == nome:
            n, e, t, buf = doc.extract_font(xref)
            if buf:
                fo = pymupdf.Font(fontbuffer=buf)
                if all(fo.has_glyph(ord(c)) for c in texto if c != ' '): return fo, buf
    raise RuntimeError(f'sem fonte para {span["font"]} com as letras de «{texto}»')
def cor(span):
    c = span['color']; return ((c >> 16) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255)
def linhas(page):
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []): yield l
def escrever(page, x, y, texto, fo, src, size, color):
    tw = pymupdf.TextWriter(page.rect); tw.append((x, y), texto, font=fo, fontsize=size); tw.write_text(page, color=color)
def redigir(page, rect):
    r = pymupdf.Rect(rect); h = r.height; r.y0 += h * 0.18; r.y1 -= h * 0.12
    page.add_redact_annot(r); page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)
def foto(page, r, nome):
    page.get_pixmap(dpi=120, clip=pymupdf.Rect(0, r.y0 - 14, page.rect.width, r.y1 + 14)).save(nome)

def trocar_span(doc, pno, procura, novo_texto, centrar=False, tag=''):
    page = doc[pno - 1]
    for l in linhas(page):
        for s in l['spans']:
            if procura in s['text']:
                novo = s['text'].replace(procura, novo_texto)
                r = pymupdf.Rect(s['bbox']); foto(page, r, f'png2/{tag}_p{pno}_antes.png')
                fo, src = fonte(doc, page, s, novo); redigir(page, r)
                w = fo.text_length(novo, fontsize=s['size'])
                x = (r.x0 + r.x1) / 2 - w / 2 if centrar else s['origin'][0]
                escrever(page, x, s['origin'][1], novo, fo, src, s['size'], cor(s)); foto(page, r, f'png2/{tag}_p{pno}_depois.png')
                return f'p.{pno}: «{s["text"].strip()}» → «{novo.strip()}»'
    raise RuntimeError(f'p.{pno}: não encontrei «{procura}»')

def trocar_versaletes(doc, pno, fim_antigo, titulo_novo, tag=''):
    # linha do índice em versaletes (maiúscula 10pt + resto em maiúsculas 8pt) seguida de pontos e página
    page = doc[pno - 1]
    for l in linhas(page):
        txt = ''.join(s['text'] for s in l['spans'])
        if fim_antigo.upper() in txt.upper():
            sp = l['spans']; i_fim = max(i for i, s in enumerate(sp) if fim_antigo.split()[-1].upper()[1:] in s['text'].upper() or s['text'].upper().endswith(fim_antigo.split()[-1].upper()))
            i_ini = 0; base = sp[0]; grande, peq = base['size'], max(s['size'] for s in sp[:i_fim + 1] if s['size'] < base['size'] + 0.01 and s['size'] != base['size']) if any(s['size'] != base['size'] for s in sp[:i_fim+1]) else base['size']
            r = pymupdf.Rect(sp[i_ini]['bbox'])
            for s in sp[i_ini:i_fim + 1]: r |= pymupdf.Rect(s['bbox'])
            pontos = sp[i_fim + 1] if i_fim + 1 < len(sp) else None
            if pontos: r |= pymupdf.Rect(pontos['bbox'])
            foto(page, r, f'png2/{tag}_p{pno}_antes.png')
            fo = pymupdf.Font(fontfile=WIN['calibri']); redigir(page, r)
            x, y = sp[0]['origin']; color = cor(sp[0])
            # escreve palavra a palavra: 1.ª letra a 'grande', resto em maiúsculas a 'peq'
            tw = pymupdf.TextWriter(page.rect); cx = x
            for k, pal in enumerate(titulo_novo.split(' ')):
                if k: tw.append((cx, y), ' ', font=fo, fontsize=peq); cx += fo.text_length(' ', fontsize=peq)
                if pal and pal[0].isupper():
                    tw.append((cx, y), pal[0], font=fo, fontsize=grande); cx += fo.text_length(pal[0], fontsize=grande); resto = pal[1:]
                else: resto = pal
                if resto: tw.append((cx, y), resto.upper(), font=fo, fontsize=peq); cx += fo.text_length(resto.upper(), fontsize=peq)
            # pontos até à posição original do número da página
            if pontos:
                fim_pts = pontos['bbox'][2]; txtp = pontos['text']; num = txtp.strip(' .'); wnum = fo.text_length(' ' + num, fontsize=grande)
                ponto = fo.text_length('.', fontsize=grande); n = int((fim_pts - wnum - cx - ponto) / ponto)
                tw.append((cx + ponto * 0.5, y), '.' * max(3, n), font=fo, fontsize=grande)
                tw.append((fim_pts - wnum, y), ' ' + num, font=fo, fontsize=grande)
            tw.write_text(page, color=color); foto(page, r, f'png2/{tag}_p{pno}_depois.png')
            return f'p.{pno} (índice): «{txt.split(".....")[0].strip()}» → «{titulo_novo}»'
    raise RuntimeError(f'p.{pno}: linha de índice com «{fim_antigo}» não encontrada')

def corrigir(pasta, nome, passos):
    doc = pymupdf.open(os.path.join(D, pasta, nome)); feitas = [p(doc) for p in passos]
    doc.save(os.path.join(OUT, nome), garbage=3, deflate=True); rel.append({'ficheiro': nome, 'trocas': feitas})
    print(nome[:60]); [print('   ', f) for f in feitas]

corrigir('Huambo', 'MA-FNHU-MOA-001 Manual de Operações de Aeroporto Albano Machado - Huambo.pdf', [
  lambda d: trocar_versaletes(d, 8, 'Maria mabu café', 'Estrutura orgânica do Aeroporto Albano Machado', 'hu-toc1'),
  lambda d: trocar_versaletes(d, 8, 'Aeroporto de Cabinda', 'Comités de Serviço do Aeroporto do Huambo', 'hu-toc2'),
  lambda d: trocar_span(d, 107, 'MARIA MABU CAFÉ', 'ALBANO MACHADO', tag='hu-c1'),
  lambda d: trocar_span(d, 107, 'AEROPORTO DE CABINDA', 'AEROPORTO DO HUAMBO', tag='hu-c2'),
  lambda d: trocar_span(d, 15, 'MA-FNCT-MOA-001', 'MA-FNHU-MOA-001', tag='hu-15'),
  lambda d: trocar_span(d, 21, 'MA-FNCT-MOA-001', 'MA-FNHU-MOA-001', tag='hu-21')])
corrigir('Cabinda', 'MA-FNCA-MOA-001 Manual de Operações de Aeroporto da Maria Mambo Café.pdf', [
  lambda d: trocar_span(d, 15, 'MA-FNCT-MOA-001', 'MA-FNCA-MOA-001', tag='ca-15'),
  lambda d: trocar_span(d, 21, 'MA-FNCT-MOA-001', 'MA-FNCA-MOA-001', tag='ca-21')])
corrigir('Cabinda', 'NRM-FNCA-NOCLA-001 Normas de Circulação de Pessoas e Equipamentos no Lado Ar.pdf', [
  lambda d: trocar_span(d, 4, 'AEROPORTO INTERNACIONAL DA', 'AEROPORTO MARIA MAMBO', tag='nrm-1'),
  lambda d: trocar_span(d, 4, 'MUKANKA', 'CAFÉ', tag='nrm-2')])
corrigir('Cabinda', 'PL-FNCA-PRAFS-001 Plano de Remoção de Aeronaves Fora de Serviço.pdf', [
  lambda d: trocar_span(d, 12, 'LT-FNUB-PRAFS-002', 'LT-FNCA-PRAFS-002', tag='prafs')])
corrigir('Cabinda', 'POP-FNCA-MOA-001 Procedimento de Reportes de Segurança Operacional .pdf', [
  lambda d: trocar_span(d, 2, 'WELWITSCHIA MIRABILIS', 'MARIA MAMBO CAFÉ', centrar=True, tag='pop-ca')])
corrigir('Huambo', 'POP-FNHU-MOA-002 Procedimento de Notificação de Colisão com Aves.pdf', [
  lambda d: trocar_span(d, 2, 'no FNCA', 'no FNHU', tag='pop-hu')])
json.dump(rel, open('relatorio-correcoes-pdf.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
