# Assinaturas visíveis: rubricas, cópia assinada e verificação /vd/ (migração 186 + patch 32)

Ordem exacta. Correr no SRVKMS001, num PowerShell **como Administrador**. Tudo é idempotente: repetir um passo não estraga nada.

## 0. Pré-requisitos

- A migração 156 (fluxo de aprovação) já está aplicada. O patch 30 também.
- O ficheiro `C:\dirops\sga-onpremise\functions\dirops-functions\docs-verificacao.js` existe. É um módulo novo, já está lá.

## 1. Migração 186 (base de dados)

```powershell
$env:PGPASSWORD = (Get-Content C:\dirops\sga-onpremise\secrets\postgres_password.txt -Raw).Trim()
& C:\dirops\sga-onpremise\postgres\bin\psql.exe -h 127.0.0.1 -U postgres -d dirops_sga -v ON_ERROR_STOP=1 `
  -f C:\dirops\APP_DIROPS_v2\tools\ged-assinaturas\186_assinaturas_visiveis.sql
```
O resultado esperado termina em `COMMIT` e `NOTIFY`. Se aparecer um ERROR, nada foi gravado (a migração corre numa só transacção).

## 2. Teste da 186 (em ROLLBACK, não grava nada)

```powershell
& C:\dirops\sga-onpremise\postgres\bin\psql.exe -h 127.0.0.1 -U postgres -d dirops_sga -v ON_ERROR_STOP=1 `
  -f C:\dirops\APP_DIROPS_v2\tools\ged-assinaturas\teste-186.sql
```
O teste escreve 25 linhas `NOTICE: OK ...` e, no fim, `=== teste-186: TODAS AS VERIFICACOES PASSARAM ===` seguido de `ROLLBACK`. Um `ERROR` indica qual das verificações falhou. Nesse caso não avance.

Opcional: os testes do módulo (`node --test C:\dirops\APP_DIROPS_v2\tools\ged-assinaturas\docs-verificacao.test.cjs`) devem dar 13 testes passados.

## 3. Patch 32 no servidor de funções: verificar primeiro

```powershell
node C:\dirops\APP_DIROPS_v2\tools\ged-assinaturas\patch32-copia-assinada.mjs --verificar
```
O resultado esperado são 6 linhas `ok:`, `ok: node --check` e `--verificar: aplica sem problemas`.

## 4. Patch 32: aplicar

```powershell
node C:\dirops\APP_DIROPS_v2\tools\ged-assinaturas\patch32-copia-assinada.mjs
```
O patch cria um backup `server.js.bak-patch32-<data>` na pasta das funções.

## 5. nginx: rota `/vd/`

1. `Copy-Item C:\dirops\sga-onpremise\nginx\conf\nginx.conf C:\dirops\sga-onpremise\nginx\conf\nginx.conf.bak-antes-vd-$(Get-Date -f yyyyMMdd-HHmmss)`
2. Abra `nginx.conf` e cole os blocos de `tools\ged-assinaturas\nginx-vd.conf`:
   - o bloco 1 vai a seguir ao `location /cert/ { ... }` do primeiro `server` (porta 80, `default_server`);
   - o bloco 2 vai a seguir ao `location /cert/ { ... }` do `server` de `docs.marciosager.com`.
3. Teste a configuração com `C:\dirops\sga-onpremise\nginx\nginx.exe -t -p C:\dirops\sga-onpremise\nginx\ -c conf\nginx.conf`. O resultado deve dizer `syntax is ok`. Este teste já foi feito com sucesso numa cópia do nginx.conf actual.

## 6. Reiniciar os serviços

```powershell
Restart-Service dirops-functions-v2
Restart-Service dirops-nginx-v2
```
Use `Restart-Service` no nginx, e não `nginx -s reload`, que não funciona com o serviço.

## 7. Confirmar

- Abra `http://10.1.65.45/vd/` no browser. Deve aparecer a página «Verificar uma revisão», com o logo da SGA.
- Abra `http://10.1.65.45/vd/0000-0000-0000`. Deve aparecer «Código não encontrado», a vermelho.
- Depois da primeira cópia assinada gerada no portal, leia o QR com o telemóvel. Deve aparecer «Revisão em vigor», a verde, com as assinaturas e as impressões digitais.

## Como desfazer

- Servidor: copie o `server.js.bak-patch32-<data>` por cima de `server.js` e corra `Restart-Service dirops-functions-v2`.
- nginx: reponha o `nginx.conf.bak-antes-vd-*` e corra `Restart-Service dirops-nginx-v2`.
- Base de dados: as tabelas e funções novas não interferem com o resto se não forem usadas. Os CHECK alargados (papel `assinado`) aceitam tudo o que já era aceite.

## O que fica a funcionar

| Peça | Quem usa |
|---|---|
| `documento_rubrica` + `doc_rubrica_guardar / doc_rubrica_minha` | cada pessoa grava a sua rubrica (só a própria; ninguém lê a tabela directamente) |
| `doc_rubricas_da_versao(p_versao)` | o gerador da cópia: devolve as rubricas de quem ASSINOU essa versão, e só a editores do documento ou aos próprios signatários |
| `doc_copia_assinada_registar(...)` | regista a cópia (PDF com rubricas e QR). Exige poder editar o documento, a aprovação final e que a origem seja o SHA do original selado. A cópia anterior fica marcada como substituída e não é apagada. Marca `carimbo_aplicado_em` e escreve a auditoria e o passo `carimbo_aplicado` |
| `doc_copia_assinada_da_versao(p_versao)` | o portal: devolve a cópia vigente (objecto jsonb, ou null) |
| `doc_verificacao_codigo(p_versao)` | o portal e o gerador: devolve o código `XXXX-XXXX-XXXX` da revisão |
| `doc_verificacao_por_codigo` (só service_role) | a página pública `/vd/<código>`. Nos documentos AVSEC mostra só o número, a revisão e o estado |
| troca no servidor | quem abre o documento ou uma versão (no portal, em comparar versões ou pelos links `/s/ /p/ /v/`) recebe a cópia assinada, com o carimbo de cópia controlada por cima. Com `?original=1` recebe o original. O PDF do fluxo (rota documentos-aprovacao) nunca é trocado |
