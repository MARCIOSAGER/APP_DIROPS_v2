import pymupdf, zipfile, re, os, json, unicodedata
D = r'C:\Users\dirops\Downloads'
def sem(t): return ''.join(c for c in unicodedata.normalize('NFD', t) if unicodedata.category(c) != 'Mn')
OUTROS = {
 'FNHU': ['CATUMBELA','LUBANGO','MUKANKA','NAMIBE','WELWITSCHIA','MIRABILIS','4 DE FEVEREIRO','CABINDA','MAMBO','MABU','FNCT','FNUB','FNMO','FNLU','FNCA'],
 'FNCA': ['CATUMBELA','LUBANGO','MUKANKA','NAMIBE','WELWITSCHIA','MIRABILIS','4 DE FEVEREIRO','HUAMBO','ALBANO','FNCT','FNUB','FNMO','FNLU','FNHU'],
}
res = []
for pasta, icao in (('Huambo','FNHU'),('Cabinda','FNCA')):
  for f in sorted(os.listdir(os.path.join(D, pasta))):
    p = os.path.join(D, pasta, f); ext = f.rsplit('.',1)[-1].lower()
    paginas = []
    try:
      if ext == 'pdf':
        d = pymupdf.open(p); paginas = [pg.get_text() for pg in d]
      elif ext in ('docx','xlsx'):
        z = zipfile.ZipFile(p); txt = ''
        for n in z.namelist():
          if n.endswith('.xml') and (n.startswith('word/') or n.startswith('xl/')):
            txt += ' ' + re.sub(r'<[^>]+>', ' ', z.read(n).decode('utf8', 'ignore'))
        paginas = [txt]
      else:
        paginas = [open(p,'rb').read().decode('latin1','ignore')]
    except Exception as e:
      res.append({'f': f, 'erro': str(e)}); continue
    achados = []
    for i, t in enumerate(paginas):
      T = sem(t).upper()
      for k in OUTROS[icao]:
        for m in re.finditer(re.escape(k), T):
          ctx = re.sub(r'\s+', ' ', T[max(0,m.start()-50):m.end()+40])
          achados.append({'pag': i+1, 'termo': k, 'ctx': ctx})
    if achados: res.append({'pasta': pasta, 'f': f, 'n': len(achados), 'achados': achados[:12]})
json.dump(res, open('varredura.json','w',encoding='utf8'), ensure_ascii=False, indent=1)
for r in res:
  if 'erro' in r: print('ERRO', r['f'], r['erro']); continue
  print(f"\n## {r['pasta']}/{r['f'][:60]}  ({r['n']} ocorrências)")
  vistos=set()
  for a in r['achados']:
    k=(a['termo'],a['ctx'][:60])
    if k in vistos: continue
    vistos.add(k); print(f"   p.{a['pag']} [{a['termo']}] ...{a['ctx']}...")
