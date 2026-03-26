# DIROPS-SGA — Próximos Passos

**Gerado:** 2026-03-26
**Baseado em:** UI/UX Audit, Security Audit, Performance Audit, Codebase Map

---

## Prioridade 1 — Próxima Sessão

### 1.1 Refactor Operacoes.jsx (A-01)
- Extrair VoosTab, VoosLigadosTab, VoosSemLinkTab
- Operacoes.jsx de 3008 → ~800 linhas
- Plano detalhado em `.planning/next-session-plan.md`
- **Esforço:** 30-60 min | **Risco:** Médio

### 1.2 Testes Básicos
- Criar testes para componentes core (VoosTable, AuthContext, _createEntity)
- Testar security fixes (upload validation, self-escalation trigger)
- Usar `/gsd:add-tests` para gerar automaticamente
- **Esforço:** 1-2h | **Risco:** Baixo

### 1.3 Verificar Deploys
- Testar no browser: sidebar colapsável, session timeout modal traduzido
- Testar envio de email (agora com auth JWT)
- Testar upload de ficheiros (validação tipo + tamanho)
- Testar login/logout sem console.debug
- **Esforço:** 15 min manual

---

## Prioridade 2 — Semana Seguinte

### 2.1 Performance Restante
- D-02: `User.list()` → `.filter({empresa_id})` em 10 ficheiros
- D-04: useStaticData hooks com empresa_id filter
- R-03: useMemo em computações pesadas (Auditoria, KPIs)
- B-04: Lazy-load recharts em KPIs e FundoManeio

### 2.2 Refactor Outros Monólitos
- Proforma.jsx (~1200 linhas) — extrair tabs
- KPIsOperacionais.jsx (~1400 linhas) — separar dashboard/config
- GestaoAcessos.jsx (~1500 linhas) — separar lista/modais

### 2.3 Duplicação de Código
- ManageChecklistItemsModal existe em inspecoes/ E auditoria/ (quase idêntico)
- Unificar num componente partilhado em shared/

---

## Prioridade 3 — Milestone v1.3

### 3.1 Features Pendentes
- PDF generation improvements (melhor layout, mais dados)
- Dashboard enhancements (mais KPIs, trends)
- FormVoo data fixes (validações adicionais)
- FlightAware: alertas verificação, filtro voos reais, busca automática diária

### 3.2 UX Improvements (do UI/UX audit)
- Font pairing intencional (Plus Jakarta Sans para headings)
- Micro-interactions com Framer Motion (ou CSS transitions)
- Form autosave para FormVoo (localStorage draft)
- Breadcrumbs para navegação profunda
- Deep linking (filtros persistidos na URL)

### 3.3 Infraestrutura
- CI/CD pipeline (GitHub Actions → build → deploy)
- Test coverage > 50% em componentes críticos
- Monitoring dashboard (usar ccflare ou similar)
- Rate limiting melhorado no send-email (DB-backed vs in-memory)

---

## Prioridade 4 — Futuro

### 4.1 Escalabilidade
- Virtual scrolling para tabelas grandes (react-virtual)
- Cursor-based pagination no backend
- WebSocket para updates real-time (voos, notificações)

### 4.2 Mobile
- PWA offline support melhorado
- Push notifications via Web Push API
- Responsive refinements (testar 375px, landscape)

### 4.3 Segurança Avançada
- Column-level RLS (restringir campos sensíveis por role)
- Audit trail completo (quem alterou o quê)
- 2FA/MFA enforcement para admins
- Content-Security-Policy refinado (remover unsafe-inline)

---

## Métricas de Sucesso

| Métrica | Actual | Target |
|---------|--------|--------|
| Maior ficheiro | 3008 linhas (Operacoes) | < 800 linhas |
| Test coverage | ~0% | > 50% core |
| Bundle size (initial) | ~2MB | < 1.5MB |
| Unused deps | 0 (corrigido) | 0 |
| Security findings | 0 critical (corrigido) | 0 |
| Lighthouse Performance | ? | > 80 |
| Time to Interactive | ? | < 3s |
