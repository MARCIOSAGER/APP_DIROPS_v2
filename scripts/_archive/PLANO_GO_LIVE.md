# PLANO DE GO-LIVE: Base44 -> Supabase + Hostinger

## Visao Geral

| Componente | Antes (Base44) | Depois |
|---|---|---|
| Frontend | Base44 (onrender.com) | Hostinger (dirops.marciosager.com) |
| Banco de dados | Base44 interno | Supabase Cloud (PostgreSQL) |
| Autenticacao | Base44 auth | Supabase Auth |
| Edge Functions | Base44 | Supabase Edge Functions |
| Storage | Base44 | Supabase Storage |
| Dominio | dirops.marciosager.com -> base44 | dirops.marciosager.com -> Hostinger |

---

## FASE 1: PREPARACAO (1-2 dias antes do go-live)

### 1.1 Configurar .env.migration
- [ ] Copiar `scripts/.env.migration.example` -> `scripts/.env.migration`
- [ ] Preencher BASE44_API_KEY
- [ ] Preencher BASE44_APP_ID (6870dc26cbf5444a4fbe6aa9)
- [ ] Preencher VITE_SUPABASE_URL
- [ ] Preencher SUPABASE_SERVICE_ROLE_KEY (Dashboard > Settings > API)

### 1.2 Deploy das Edge Functions no Supabase
- [ ] Instalar Supabase CLI: `npm install -g supabase`
- [ ] Login: `supabase login`
- [ ] Linkar projeto: `supabase link --project-ref SEU_PROJECT_REF`
- [ ] Deploy: `supabase functions deploy`
- [ ] Testar cada function no Dashboard > Edge Functions

### 1.3 Configurar Storage no Supabase
- [ ] Criar bucket `uploads` (publico) no Dashboard > Storage
- [ ] Criar bucket `private-uploads` (privado)
- [ ] Configurar policies de acesso

### 1.4 Preparar o .env de producao
- [ ] Criar arquivo `.env.production` na raiz do projeto:
  ```
  VITE_SUPABASE_URL=https://seu-projeto.supabase.co
  VITE_SUPABASE_ANON_KEY=sua_anon_key
  ```

### 1.5 Testar o build
- [ ] Rodar `npm run build`
- [ ] Verificar que nao ha erros
- [ ] Testar localmente: `npx vite preview`

---

## FASE 2: MIGRACAO DE DADOS (dia do go-live)

### 2.1 Congelar o Base44
- [ ] Avisar a equipe: "Sistema em manutencao por X horas"
- [ ] Anotar horario do congelamento
- [ ] Ninguem usa o Base44 a partir daqui

### 2.2 Exportar dados do Base44
```bash
node scripts/01-export-base44.mjs
```
- [ ] Verificar que todos os JSONs foram criados em `scripts/data/`
- [ ] Conferir o `_export_summary.json` (todas entidades com sucesso?)

### 2.3 Migrar usuarios
```bash
node scripts/02-migrate-users.mjs
```
- [ ] Verificar `_users_migration_result.json`
- [ ] Conferir quantos usuarios foram criados vs. esperado
- [ ] ATENCAO: Cada usuario recebera email de convite!
  - Considerar: enviar os convites ANTES ou DEPOIS do go-live?
  - Opcao A: Enviar antes (usuarios ja definem senha antes do dia D)
  - Opcao B: Enviar no dia D (usuarios definem senha quando o sistema novo estiver no ar)

### 2.4 Migrar dados das entidades
```bash
node scripts/03-migrate-data.mjs
```
- [ ] Verificar `_data_migration_result.json`
- [ ] Conferir entidades criticas: voo, reclamacao, credenciamento

### 2.5 Verificar migracao
```bash
node scripts/04-verify-migration.mjs
```
- [ ] Todas as tabelas com status "OK"?
- [ ] Se alguma com "FALTAM", investigar e re-importar

---

## FASE 3: DEPLOY DO FRONTEND (apos migracao de dados)

### 3.1 Build de producao
```bash
npm run build
```
- [ ] Build sem erros
- [ ] Pasta `dist/` gerada

### 3.2 Upload para Hostinger
- [ ] Acessar Hostinger > File Manager
- [ ] Navegar ate `public_html/`
- [ ] Deletar conteudo antigo (se houver)
- [ ] Upload de TODOS os arquivos da pasta `dist/`
  - Incluir: `index.html`, `assets/`, etc.
- [ ] Verificar que `index.html` esta na raiz de `public_html/`

### 3.3 Configurar .htaccess (SPA routing)
- [ ] Criar arquivo `.htaccess` em `public_html/` com:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```
Isso garante que todas as rotas do React funcionem (ex: /login, /voos, /reclamacoes)

---

## FASE 4: TROCA DO DNS (ultimo passo)

### 4.1 Alterar registros DNS na Hostinger
No painel DNS de `dirops.marciosager.com`:

- [ ] **Deletar** CNAME `www` -> `base44.onrender.com`
- [ ] **Deletar** ALIAS `@` -> `base44.onrender.com`
- [ ] Manter o registro A `@` -> `216.24.57.1` (Hostinger)
- [ ] **Adicionar** CNAME `www` -> `dirops.marciosager.com` (ou deixar sem www)

### 4.2 Aguardar propagacao
- [ ] Testar: acessar `dirops.marciosager.com`
- [ ] Propagacao DNS leva 5-30 minutos (pode levar ate 48h em casos raros)
- [ ] Verificar SSL: o site deve abrir com HTTPS

### 4.3 Testar tudo
- [ ] Login funciona?
- [ ] Dados aparecem corretamente?
- [ ] Criar um registro de teste (voo, reclamacao, etc.)
- [ ] Chatbot SIGA responde?
- [ ] Notificacoes por email funcionam?

---

## FASE 5: POS GO-LIVE

### 5.1 Comunicar a equipe
- [ ] Enviar email/mensagem: "Sistema novo no ar!"
- [ ] Incluir link: `https://dirops.marciosager.com`
- [ ] Instrucoes: "Clique no link do email de convite para definir sua senha"

### 5.2 Monitorar
- [ ] Acompanhar Supabase Dashboard (erros, uso)
- [ ] Ficar disponivel para duvidas da equipe nas primeiras horas
- [ ] Verificar logs de erro no console do navegador

### 5.3 Rollback (se necessario)
Se algo der muito errado:
- [ ] Voltar os registros DNS para `base44.onrender.com`
- [ ] Equipe volta a usar o Base44
- [ ] Investigar e corrigir o problema
- [ ] Tentar novamente

---

## CHECKLIST RAPIDO (dia do go-live)

```
[ ] 1. Avisar equipe: sistema em manutencao
[ ] 2. Rodar: node scripts/01-export-base44.mjs
[ ] 3. Rodar: node scripts/02-migrate-users.mjs
[ ] 4. Rodar: node scripts/03-migrate-data.mjs
[ ] 5. Rodar: node scripts/04-verify-migration.mjs
[ ] 6. Rodar: npm run build
[ ] 7. Upload dist/ para Hostinger public_html/
[ ] 8. Criar .htaccess no public_html/
[ ] 9. Trocar DNS (deletar CNAMEs do Base44)
[ ] 10. Testar tudo
[ ] 11. Avisar equipe: sistema novo no ar!
```

---

## TEMPO ESTIMADO

| Fase | Duracao |
|---|---|
| Preparacao (Fase 1) | 1-2 dias antes |
| Migracao de dados (Fase 2) | ~30 minutos |
| Deploy frontend (Fase 3) | ~15 minutos |
| Troca DNS (Fase 4) | ~5 minutos + propagacao |
| **Total downtime** | **~1 hora** |

---

## DICA SOBRE USUARIOS

A migracaco de usuarios pode ser feita em 2 etapas para minimizar confusao:

**Etapa A (3-5 dias antes):**
- Rodar o script 02-migrate-users.mjs
- Usuarios recebem email de convite
- Eles definem a senha com calma
- O sistema antigo (Base44) continua funcionando

**Etapa B (dia D):**
- Exportar dados finais do Base44
- Importar no Supabase (script 03)
- Deploy + DNS
- Usuarios ja tem senha definida, so acessam o novo link

Isso evita a pressao de "defina sua senha agora" no mesmo dia da troca.
