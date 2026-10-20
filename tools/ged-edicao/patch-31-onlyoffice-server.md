# Patch 31 — ligar a edição no navegador (ONLYOFFICE) ao servidor de funções

> Estado: **preparado, não aplicado.** Só aplicar quando o Document Server estiver instalado e a responder
> (ver `INSTALAR-ONLYOFFICE.md`). Mesmo depois de aplicado, tudo continua **desligado** até
> `documentos_config.onlyoffice_activo = true` **e** existir `secrets\onlyoffice_jwt.txt`.

Ficheiros já no sítio (não precisam de cópia):

- `C:\dirops\sga-onpremise\functions\dirops-functions\docs-onlyoffice.js` — o módulo
- `C:\dirops\sga-onpremise\functions\dirops-functions\docs-onlyoffice.test.js` — `node docs-onlyoffice.test.js`

## 0. Cópia de segurança

```powershell
cd C:\dirops\sga-onpremise\functions\dirops-functions
Copy-Item server.js ("server.js.bak-patch31-" + (Get-Date -Format "yyyy-MM-ddTHH-mm-ss"))
node docs-onlyoffice.test.js   # tem de terminar com "rota desligada recusa config, ficheiro e callback"
```

## 1. O `require` (1 linha)

Logo a seguir a esta linha existente (≈ linha 2242):

```js
const DocsFluxo = require('./docs-fluxo');     // fluxo de aprovação: assinar, devolver, cancelar, servir o editável
```

acrescentar:

```js
const DocsOnlyOffice = require('./docs-onlyoffice'); // edição do .docx no navegador (ONLYOFFICE Docs) — patch 31, desligado por omissão
```

## 2. A rota (1 bloco)

No encaminhador, logo a seguir à linha existente (≈ linha 4796):

```js
    if (p === '/functions/documentos-folhas') return DocsFolhas.handler(req, res, { url, sendJSON, caller: docsCaller, postgrestUrl: POSTGREST_URL, logo: LOGO_BUF, auditar: docsAuditar, logAcesso: docsLogAcesso });
```

acrescentar:

```js
    // Edição no navegador (ONLYOFFICE): config do editor (sessão), ficheiro e callback (Document Server, token próprio)
    if (p === '/functions/documentos-onlyoffice' || p.startsWith('/functions/documentos-onlyoffice/')) return await DocsOnlyOffice.rota(req, res, {
      url, sendJSON, lerJson, docsCaller, postgrest, chamadorPode, docsAuditar,
      bucketPath, resolveStoragePath, docsPreviewPdf, DOCS_APP_URL,
    });
```

Notas:

- `ficheiro` e `retorno` são chamados pelo **Document Server sem sessão**: a autorização é o token HS256 próprio do
  módulo (assinado com o segredo do ONLYOFFICE, amarrado à versão, 15 min para o ficheiro) mais o JWT do Document
  Server no callback. **Não** dependem do `documentoDaChave` do storage nem do HMAC dos endereços assinados — por
  isso o alargamento do `documentoDaChave` a `documento_versao.arquivo_uri` (agente «comparar») não interfere.
- O módulo usa `docsPreviewPdf` (o mesmo LibreOffice, o mesmo semáforo `DOCS_SOFFICE_MAX`) para o PDF em segundo
  plano. Se não quiser o PDF automático: `onlyoffice_gerar_pdf = false`.
- Caminho do segredo diferente do padrão? Defina `ONLYOFFICE_JWT_FILE` em `config\functions.env`.

## 3. Verificar e reiniciar

```powershell
node --check server.js
Restart-Service dirops-functions-v2
# diagnóstico (não revela o segredo):
curl.exe -s http://127.0.0.1:4001/functions/documentos-onlyoffice/estado
#  -> {"ok":true,"rota":"documentos-onlyoffice","patch":31,"activo":false,"motivo":"onlyoffice_desligado",...}
```

## 4. Desfazer

Apagar as duas inserções (ou repor o `server.js.bak-patch31-*`) e `Restart-Service dirops-functions-v2`.
Desligar sem mexer em código: `UPDATE documentos_config SET onlyoffice_activo = false WHERE id = 'geral';`
(o botão desaparece em ≤ 5 min — cache do cliente — e as rotas recusam de imediato).

> Atenção ao desligar com sessões abertas: o callback passa a responder `{"error":1}`; o Document Server guarda as
> alterações na sua cache, mas a versão nova **não** é criada. Desligue fora de horas ou depois de avisar quem
> tem documentos reservados.
