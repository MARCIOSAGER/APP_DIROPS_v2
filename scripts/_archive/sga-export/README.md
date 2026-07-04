# SGA Cloud → On-Premise Export

Scripts para exportar APENAS os dados da SGA do Supabase Cloud, para posterior import no Supabase Self-Hosted em SRVKMS001.

## Filosofia

- **Lê do Supabase Cloud (origem)**, **não escreve nada** lá. Read-only.
- Filtra por `empresa_id = 128bc692-3fae-4825-9c55-40565dbedcfb` (SGA) onde a tabela tem essa coluna.
- Tabelas filhas (sem empresa_id) são filtradas via FK ao pai SGA.
- Tabelas globais de lookup (companhia_aerea, modelo_aeronave, tipos, etc.) são exportadas inteiras.
- Por segurança, **roda em dry-run por padrão**. Para executar de verdade: `--execute`.

## Configuração

```bash
cp scripts/.env.migration.example scripts/.env.migration
# Preencha VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY com as creds do PROJETO CLOUD (origem)
```

## Uso

```bash
# Dry-run: só conta linhas, não baixa nada
node scripts/sga-export/01-export-from-cloud.mjs

# Executar de verdade — escreve JSONs em scripts/sga-export/data/
node scripts/sga-export/01-export-from-cloud.mjs --execute
```

## Saída

- `data/<table>.json` — uma por tabela exportada
- `data/_manifest.json` — contagens, warnings, tabelas desconhecidas
- `data/_storage-objects.json` — lista de objetos dos buckets (download de blobs vem em script separado)

## Próximos passos (não cobertos por este script)

- `02-export-storage-blobs.mjs` — baixar os blobs físicos de `uploads` e `private-uploads`
- `03-export-auth-users.mjs` — exportar users do `auth.users` do Supabase (precisa endpoint admin)
- Script de import no Postgres self-hosted (alvo)
