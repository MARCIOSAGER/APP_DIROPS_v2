# Plataformas SGA — Runbook Operacional (resumo)

**Servidor:** SRVKMS001 — 10.1.65.45 (rede interna SGA) · **Pasta-base:** `C:\dirops\sga-onpremise\`
**Actualizado:** 20/10/2026 · **Referência completa:** *Caderno Técnico das Plataformas* (PDF), gerado por
`C:\dirops\APP_DIROPS_v2\tools\caderno-tecnico\gerar.mjs`

## 1. Serviços

| Serviço Windows | Escuta | Função |
|---|---|---|
| `dirops-nginx-v2` | 0.0.0.0:80 | Site (DIROPS, /universidade, /documentos) e encaminhamento |
| `dirops-postgrest-v2` | 127.0.0.1:3000 | API de dados (RLS) |
| `dirops-functions-v2` | 127.0.0.1:4001 | Funções Node (ficheiros, emails, relatórios, carimbo PDF, quiz) |
| `dirops-auth-v2` | 127.0.0.1:9999 | Login DIROPS (esquema auth) |
| `dirops-auth-uc-v2` | 127.0.0.1:9998 | Login Universidade (auth_uc) |
| `dirops-auth-docs-v2` | 127.0.0.1:9997 | Login GED (auth_docs) |
| `postgresql-x64-16` | 127.0.0.1:5432 | Base de dados `dirops_sga` |

Os `dirops-*-v2` correm pelo DiropsServiceHost (`service-host\`); registos em `logs\svc-*.log`.

## 2. Verificar

```powershell
Get-Service dirops-*, postgresql-x64-16 | Format-Table Name, Status, StartType
Invoke-WebRequest http://127.0.0.1/healthz -UseBasicParsing
Invoke-WebRequest http://127.0.0.1/gd/auth/v1/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1/uc/auth/v1/health -UseBasicParsing
```

## 3. Reiniciar

```powershell
Restart-Service dirops-functions-v2     # após alterar functions\dirops-functions\*.js
Restart-Service dirops-nginx-v2         # após alterar nginx\conf\nginx.conf (nginx -s reload não funciona como serviço)
Restart-Service dirops-postgrest-v2
Restart-Service dirops-auth-v2, dirops-auth-uc-v2, dirops-auth-docs-v2
Restart-Service postgresql-x64-16       # com cuidado
```

## 4. Base de dados

```powershell
$env:PGPASSWORD = (Get-Content C:\dirops\sga-onpremise\secrets\postgres_password.txt -Raw).Trim()
& C:\dirops\sga-onpremise\postgres\bin\psql.exe -h 127.0.0.1 -U postgres -d dirops_sga
# migração: psql ... -f <ficheiro.sql>   (terminar sempre com NOTIFY pgrst, 'reload schema';)
```

## 5. Cópias de segurança e restauro

- Base de dados: diário 02:00 → `backups\dirops_sga_*.dump` (14 dias) — `scripts\backup-postgres.ps1`
- Ficheiros: diário 02:00 → `backups\storage-arquivo\` (acumulativo) — `scripts\backup-storage.ps1`
- Ensaio de restauro sem tocar na produção: `scripts\dr-test.ps1`
- Restauro: ver Caderno Técnico, capítulo 14.

## 6. Publicar o site

```powershell
cd C:\dirops\APP_DIROPS_v2
npm test -- --run
Remove-Item -Recurse -Force dist; npm run build
Copy-Item dist\* C:\dirops\sga-onpremise\nginx\html\ -Recurse -Force
```
Utilizadores com o site aberto: Ctrl+Shift+R se virem a versão antiga.

## 7. Registos

`logs\svc-*.log` (serviços) · `nginx\logs\` · `postgres-data\log\` · `logs\client-errors.jsonl` (erros no navegador) ·
`backups\backup.log` · `logs\relatorios-dispatcher.log`

## 8. Logins independentes (reversível)

`scripts\activar-universidade-isolada.ps1` (activo desde 01/10/2026) e `scripts\activar-documentos-isolado.ps1`
(activo desde 20/10/2026). Voltar ao login partilhado: o mesmo script com `-Rollback`.
