# Extrai dos PDF originais as imagens dos modelos-mestre, segundo tools/mestres/imagens/manifesto.json.
#
# Uso:  python tools/mestres/extrair-imagens.py [--inventario]
#   (sem argumentos)  escreve tools/mestres/imagens/<chave>/<ICAO|comum>/<nome>.jpg  (JPEG, lado maior <= max/1600 px, q≈82)
#   --inventario      lista, para cada mestre e aeroporto-alvo, as imagens candidatas de cada PDF (ignora logótipos e
#                     cabeçalhos — imagens que se repetem em metade das páginas ou mais —, imagens < 80 px e repetidas
#                     pelo hash), com o texto à volta (título/legenda), para decidir o manifesto.
#
# Cada imagem é RENDERIZADA a partir da área que ocupa na página (o que o leitor via: corte e escala do Word, rótulos e
# setas por cima), não extraída em bruto. Entradas do manifesto:
#   {icao, nome, pag, xref}        área da imagem xref na página pag
#   {icao, nome, pag, rect}        área [x0,y0,x1,y1] em pontos (figura vectorial, ou várias imagens juntas)
#   {icao, nome, pag, celula:[l,k]} k-ésima célula de imagem (1 ou 2) da linha l da tabela da página (tabela 5.2 da NRM)
#   margem [e,t,d,b] (pontos a mais), max (px do lado maior), q (qualidade JPEG, omissa 82), de (aeroporto de
#   onde vem uma imagem 'comum')
# O PDF de cada aeroporto vem de manifesto[chave].pdf (nomes em storage/private-uploads).
import io, json, os, sys, hashlib, collections
import fitz
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
DIR_IMG = os.path.join(AQUI, 'imagens')
UPLOADS = r'C:\dirops\sga-onpremise\storage\private-uploads'
QUALIDADE = 82
MAX_PX = 1600


def grelha_tabela(p):
    """Linhas (y) e, por linha, as verticais (x) da tabela desenhada na página."""
    hs, vs = [], []
    for g in p.get_drawings():
        for it in g['items']:
            if it[0] == 're':
                r = it[1]
                if r.height < 1.5 and r.width > 20: hs.append(r.y0)
                if r.width < 1.5 and r.height > 10: vs.append((r.x0, r.y0, r.y1))
            elif it[0] == 'l':
                a, b = it[1], it[2]
                if abs(a.y - b.y) < 0.5 and abs(a.x - b.x) > 20: hs.append(a.y)
                if abs(a.x - b.x) < 0.5 and abs(a.y - b.y) > 10: vs.append((a.x, min(a.y, b.y), max(a.y, b.y)))
    ys = sorted({round(y) for y in hs if y > 140})
    return ys, vs


def rect_celula(p, linha, k):
    ys, vs = grelha_tabela(p)
    y0, y1 = ys[linha - 1], ys[linha]
    meio = (y0 + y1) / 2
    xs = []
    for x in sorted(v[0] for v in vs if v[1] <= meio <= v[2]):
        if not xs or x - xs[-1] > 3: xs.append(x)
    celulas = list(zip(xs, xs[1:]))
    if len(celulas) < 4:
        raise SystemExit(f'linha {linha}: esperava 4 células, há {len(celulas)} ({xs})')
    x0, x1 = celulas[2 * k - 1]
    return fitz.Rect(x0 + 2, y0 + 2, x1 - 2, y1 - 2)


def area(doc, e):
    p = doc[e['pag'] - 1]
    if 'celula' in e:
        r = rect_celula(p, *e['celula'])
    elif 'rect' in e:
        r = fitz.Rect(e['rect'])
    else:
        bb = [i['bbox'] for i in p.get_image_info(xrefs=True) if i['xref'] == e['xref']]
        if not bb: raise SystemExit(f"{e['nome']}: xref {e['xref']} não está na página {e['pag']}")
        r = fitz.Rect(bb[0])
    m = e.get('margem') or [0, 0, 0, 0]
    r = fitz.Rect(r.x0 - m[0], r.y0 - m[1], r.x1 + m[2], r.y1 + m[3])
    r = r & p.rect
    # tira 0,6 pt à volta (as bordas da caixa da imagem/tabela não entram)
    return p, fitz.Rect(r.x0 + 0.6, r.y0 + 0.6, r.x1 - 0.6, r.y1 - 0.6)


def renderizar(p, r, maxpx):
    z = min(8.0, maxpx / max(r.width, r.height))
    pm = p.get_pixmap(matrix=fitz.Matrix(z, z), clip=r, alpha=False)
    im = Image.open(io.BytesIO(pm.tobytes('png'))).convert('RGB')
    im = aparar(im)
    im.thumbnail((maxpx, maxpx), Image.LANCZOS)
    return im


def aparar(im, folga=6):
    """Corta as margens brancas (as células da tabela e as caixas do Word deixam muito branco à volta)."""
    cinza = im.convert('L').point(lambda v: 255 if v < 245 else 0)
    bb = cinza.getbbox()
    if not bb: return im
    x0, y0, x1, y1 = bb
    x0, y0 = max(0, x0 - folga), max(0, y0 - folga)
    x1, y1 = min(im.width, x1 + folga), min(im.height, y1 + folga)
    return im.crop((x0, y0, x1, y1))


def extrair():
    man = json.load(open(os.path.join(DIR_IMG, 'manifesto.json'), encoding='utf8'))
    for chave, m in man.items():
        if chave.startswith('_'): continue
        docs = {}
        total = 0
        for e in m['imagens']:
            icao_pdf = e.get('de') or e['icao']
            if icao_pdf not in docs: docs[icao_pdf] = fitz.open(os.path.join(UPLOADS, m['pdf'][icao_pdf]))
            p, r = area(docs[icao_pdf], e)
            im = renderizar(p, r, min(MAX_PX, e.get('max', MAX_PX)))
            dest = os.path.join(DIR_IMG, chave, e['icao'], e['nome'] + '.jpg')
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            im.save(dest, 'JPEG', quality=e.get('q', QUALIDADE), optimize=True, progressive=True)
            n = os.path.getsize(dest)
            total += n
            print(f"{chave}/{e['icao']}/{e['nome']}.jpg  {im.width}x{im.height}  {n // 1024} KB")
        print(f'== {chave}: {total // 1024} KB em JPEG')


def inventario():
    """Imagens candidatas de cada PDF-alvo (precisa de alvos com arquivo: lê-os de imagens/alvos-pdf.json)."""
    alvos = json.load(open(os.path.join(DIR_IMG, 'alvos-pdf.json'), encoding='utf8'))  # [{chave, icao, numero, pdf}]
    for a in alvos:
        doc = fitz.open(os.path.join(UPLOADS, a['pdf']))
        porhash = collections.defaultdict(set)
        infos = []
        for pno, p in enumerate(doc):
            for i in p.get_image_info(hashes=True, xrefs=True):
                h = i['digest'].hex() if isinstance(i.get('digest'), bytes) else str(i.get('digest'))
                porhash[h].add(pno)
                infos.append((pno, i, h))
        vistos = set()
        print(f"== {a['chave']} {a['icao']} {a['numero']} ({doc.page_count} pág.)")
        for pno, i, h in infos:
            if h in vistos: continue
            vistos.add(h)
            b = fitz.Rect(i['bbox'])
            if len(porhash[h]) >= max(3, doc.page_count * 0.5) or i['width'] < 80 or i['height'] < 80 or pno == 0: continue
            p = doc[pno]
            acima = p.get_text('text', clip=fitz.Rect(0, max(0, b.y0 - 90), p.rect.width, b.y0)).strip().replace('\n', ' | ')
            abaixo = p.get_text('text', clip=fitz.Rect(0, b.y1, p.rect.width, min(p.rect.height, b.y1 + 60))).strip().replace('\n', ' | ')
            print(f"  p{pno + 1} xref={i['xref']} {i['width']}x{i['height']} bbox={[round(v) for v in b]}\n    acima: {acima[-160:]}\n    abaixo: {abaixo[:120]}")


if __name__ == '__main__':
    inventario() if '--inventario' in sys.argv else extrair()
