# Ligar as folhas legais ao `server.js`

As folhas de abertura vivem todas em `functions/dirops-functions/docs-folhas.js`. O `server.js` não foi tocado: o
que falta são **duas linhas**, e nada mais. Nenhuma alteração ao `nginx.conf` é precisa — a rota entra por
`/functions/v1/…`, que o `location /functions/v1/` já encaminha para o backend (porta 4001).

Depois de colar, `Restart-Service dirops-functions-v2`.

## Linha 1 — o `require`

No bloco do patch 26, imediatamente **a seguir** à linha que já lá está:

```js
const DocsPdf = require('./docs-pdf');
```

acrescentar:

```js
const DocsFolhas = require('./docs-folhas');   // folhas de abertura (Instrutivo 22C.107.001.A, 1.1.2.2)
```

## Linha 2 — a rota

No router, a seguir à linha do Portal de Documentos que já existe:

```js
    if (p === '/functions/documentos-acesso') return fnDocumentosAcesso(req, res);
```

acrescentar:

```js
    if (p === '/functions/documentos-folhas') return DocsFolhas.handler(req, res, { url, sendJSON, caller: docsCaller, postgrestUrl: POSTGREST_URL, logo: LOGO_BUF, auditar: docsAuditar, logAcesso: docsLogAcesso });
```

Em versão legível, se preferires quebrada:

```js
    // Folhas de abertura do manual controlado (capa, declaração, distribuição, emendas, LEP, índice, abreviaturas…)
    if (p === '/functions/documentos-folhas') {
      return DocsFolhas.handler(req, res, {
        url,                       // o router já abriu o URL; evita abri-lo outra vez
        sendJSON,                  // mesma resposta JSON e mesmos cabeçalhos CORS do resto do backend
        caller: docsCaller,        // identidade + níveis do portal (admin/gestor), tal como em fnDocumentosAcesso
        postgrestUrl: POSTGREST_URL,
        logo: LOGO_BUF,            // o mesmo logótipo SGA do carimbo e dos emails
        auditar: docsAuditar,      // escreve em log_auditoria, módulo «Documentos»
        logAcesso: docsLogAcesso,  // escreve em log_acesso_documento
      });
    }
```

Tudo o que vai neste objecto já existe no `server.js`, com estes nomes. O módulo não precisa de mais nada: não lê
o disco, não usa a `SERVICE_ROLE_KEY` e não escreve na base (a não ser pela auditoria, que é do `server.js`).

## Porque é que a chave de serviço não entra aqui

A consulta ao PostgREST vai assinada com o **token de quem pediu**, extraído do cabeçalho `Authorization`. É o RLS
do portal (migrações 136b/136c) que decide o que cada pessoa vê, exactamente como nas páginas. Um leitor de outro
aeroporto que peça as folhas de um manual que não pode ver recebe 404, porque a sua própria consulta não devolve
linha nenhuma — não há uma segunda regra de acesso escrita em JavaScript para se desencontrar da primeira.

## A rota

`GET /functions/v1/documentos-folhas`

| Parâmetro | Valor | Efeito |
|---|---|---|
| `documento_id` | uuid | obrigatório (excepto `modo=catalogo`) |
| `folhas` | `rosto,indice,declaracao,distribuicao,revisoes,emendas,lep,abreviaturas,referencias` | subconjunto; omitido = todas |
| `modo` | `pdf` (omitido) | o PDF das folhas |
| | `dados` | JSON com tudo o que alimenta as folhas, mais as lacunas |
| | `lacunas` | só o que falta, folha a folha — é o que a página de conformidade mostra |
| | `catalogo` | as nove folhas, o seu nome e a norma que as impõe (não precisa de sessão nem de documento) |
| `descarregar` | `1` | `Content-Disposition: attachment` em vez de `inline` |

A ordem das folhas **não é a ordem do parâmetro**: é sempre a ordem legal do ponto 1.1.2.2 do Instrutivo. Pedir
`folhas=emendas,rosto` devolve a capa primeiro.

Exemplos:

```
/functions/v1/documentos-folhas?documento_id=191b7961-…&descarregar=1
/functions/v1/documentos-folhas?documento_id=191b7961-…&folhas=distribuicao
/functions/v1/documentos-folhas?documento_id=191b7961-…&modo=lacunas
/functions/v1/documentos-folhas?modo=catalogo
```

## O que o `server.js` responde em cada caso

| Situação | Resposta |
|---|---|
| sem `Authorization` | 401 `é preciso sessão para pedir as folhas de abertura` |
| conta sem perfil no sistema | 403 (vem do `docsCaller`) |
| `documento_id` ausente ou malformado | 400 |
| documento que a pessoa não pode ver | 404 (o RLS devolve zero linhas) |
| PostgREST recusa (401/403) | 403 `sem permissão para ver este documento` |
| tudo bem | 200 `application/pdf` |

## Migração que acompanha

`C:\dirops\sga-onpremise\sql\164_folhas_legais.sql` cria as tabelas de que quatro folhas dependem
(`documento_declaracao`, `documento_copia_controlada`, `documento_indice`, `documento_abreviatura`,
`documento_referencia`). **Sem ela o módulo continua a funcionar**: as consultas dessas tabelas falham e são
apanhadas, as folhas saem como formulários pautados por preencher e o `modo=lacunas` diz exactamente o que falta.
Não há ordem obrigatória entre aplicar a migração e reiniciar o serviço.
