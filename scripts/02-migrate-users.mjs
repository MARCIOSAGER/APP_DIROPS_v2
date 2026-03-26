#!/usr/bin/env node
// ============================================================
// PASSO 2: Migrar usuarios para Supabase Auth + tabela users
// ============================================================
// Uso: node scripts/02-migrate-users.mjs
//
// Prerequisito: ter executado 01-export-base44.mjs (precisa de scripts/data/users.json)
//
// O que faz:
// 1. Le users.json exportado do Base44
// 2. Cria usuario no Supabase Auth (via Admin API) com senha temporaria
// 3. Cria perfil na tabela 'users' vinculado ao auth_id (status='pendente')
// 4. NAO envia email — o envio de convite e feito depois pela UI (Gestao de Acessos)
//
// IMPORTANTE: Users sao criados com status 'pendente' — activacao manual depois!
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BASE44_API_URL, EMPRESA_ID_MAP, DEFAULT_EMPRESA_ID } from './config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

// Cliente Supabase com service_role (admin)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Campos do perfil que devem ser copiados para a tabela users
const PROFILE_FIELDS = [
  'full_name', 'email', 'telefone', 'cargo', 'departamento',
  'perfis', 'aeroportos_acesso', 'status', 'empresa',
  'foto_url', 'observacoes', 'data_admissao',
];

function extractProfile(base44User) {
  const profile = {};

  // Mapeia campos conhecidos
  for (const field of PROFILE_FIELDS) {
    if (base44User[field] !== undefined && base44User[field] !== null) {
      profile[field] = base44User[field];
    }
  }

  // Garantir campos obrigatorios
  profile.email = profile.email || base44User.email || base44User.Email;
  profile.full_name = profile.full_name
    || base44User.full_name
    || base44User.nome
    || base44User.Nome
    || base44User.name
    || profile.email?.split('@')[0]
    || '';

  // Mapear empresa_id do Base44 (ObjectId) para Supabase (UUID)
  const rawEmpresa = profile.empresa_id || profile.empresa || base44User.empresa_id;
  if (rawEmpresa && typeof rawEmpresa === 'string') {
    profile.empresa_id = EMPRESA_ID_MAP[rawEmpresa] || DEFAULT_EMPRESA_ID;
  } else {
    profile.empresa_id = DEFAULT_EMPRESA_ID;
  }
  delete profile.empresa; // campo nao existe na tabela users

  // Status padrao — pendente ate activacao manual
  if (!profile.status) {
    profile.status = 'pendente';
  }

  // Perfis como array
  if (profile.perfis && !Array.isArray(profile.perfis)) {
    profile.perfis = [profile.perfis];
  }
  if (!profile.perfis) {
    profile.perfis = [];
  }

  // Aeroportos como array
  if (profile.aeroportos_acesso && !Array.isArray(profile.aeroportos_acesso)) {
    profile.aeroportos_acesso = [profile.aeroportos_acesso];
  }
  if (!profile.aeroportos_acesso) {
    profile.aeroportos_acesso = [];
  }

  return profile;
}

async function migrateUser(base44User, index, total) {
  const profile = extractProfile(base44User);
  const email = profile.email;

  if (!email) {
    return { status: 'skipped', reason: 'sem email', user: base44User };
  }

  const label = `[${index + 1}/${total}] ${email}`;

  try {
    // 1. Verificar se ja existe no Supabase Auth
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(u => u.email === email);

    let authUser;

    if (existing) {
      console.log(`${label} - ja existe no Auth, pulando criacao`);
      authUser = existing;
    } else {
      // 2. Criar usuario no Supabase Auth SEM enviar email
      // Usa createUser com senha temporaria — o convite sera enviado depois pela UI
      const tempPassword = `Temp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: false, // NAO confirma email automaticamente
        user_metadata: { full_name: profile.full_name },
      });

      if (error) {
        if (error.message?.includes('already been registered') || error.status === 422) {
          console.log(`${label} - ja registrado, buscando...`);
          const { data: listData } = await supabase.auth.admin.listUsers();
          authUser = listData?.users?.find(u => u.email === email);
          if (!authUser) {
            return { status: 'error', email, error: 'Ja existe mas nao encontrado' };
          }
        } else {
          throw error;
        }
      } else {
        authUser = data.user;
        console.log(`${label} - criado (sem email, status pendente)`);
      }
    }

    // 3. Criar/atualizar perfil na tabela users
    const { data: existingProfile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (existingProfile) {
      // Atualizar perfil existente
      const { error: updateErr } = await supabase
        .from('users')
        .update({
          ...profile,
          updated_date: new Date().toISOString(),
        })
        .eq('auth_id', authUser.id);

      if (updateErr) throw updateErr;
      console.log(`${label} - perfil atualizado`);
    } else {
      // Criar novo perfil
      const { error: insertErr } = await supabase
        .from('users')
        .insert({
          auth_id: authUser.id,
          ...profile,
          created_date: base44User.created_date || new Date().toISOString(),
        });

      if (insertErr) throw insertErr;
      console.log(`${label} - perfil criado`);
    }

    return { status: 'success', email, authId: authUser.id };

  } catch (err) {
    console.error(`${label} - ERRO: ${err.message}`);
    return { status: 'error', email, error: err.message };
  }
}

async function main() {
  console.log('=== MIGRACAO DE USUARIOS ===\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERRO: Credenciais Supabase nao encontradas.');
    console.error('Copie scripts/.env.migration.example -> scripts/.env.migration e preencha.');
    process.exit(1);
  }

  // Ler arquivo de usuarios
  const usersFile = path.join(DATA_DIR, 'users.json');
  if (!fs.existsSync(usersFile)) {
    console.error('ERRO: Arquivo users.json nao encontrado.');
    console.error('Execute primeiro: node scripts/01-export-base44.mjs');
    process.exit(1);
  }

  const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
  console.log(`Total de usuarios para migrar: ${users.length}\n`);

  // Migrar um a um (para nao sobrecarregar a API)
  const results = { success: [], error: [], skipped: [] };

  for (let i = 0; i < users.length; i++) {
    const result = await migrateUser(users[i], i, users.length);
    results[result.status].push(result);

    // Pequeno delay para nao estourar rate limit
    if (i < users.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // Resumo
  console.log('\n=== RESUMO ===');
  console.log(`Sucesso:  ${results.success.length}`);
  console.log(`Erros:    ${results.error.length}`);
  console.log(`Pulados:  ${results.skipped.length}`);

  if (results.error.length > 0) {
    console.log('\nUsuarios com erro:');
    results.error.forEach(e => console.log(`  ${e.email}: ${e.error}`));
  }

  if (results.skipped.length > 0) {
    console.log('\nUsuarios pulados:');
    results.skipped.forEach(s => console.log(`  ${JSON.stringify(s.user).slice(0, 100)}`));
  }

  // Salva resultado
  fs.writeFileSync(
    path.join(DATA_DIR, '_users_migration_result.json'),
    JSON.stringify(results, null, 2)
  );

  console.log(`\nResultado salvo em: ${path.join(DATA_DIR, '_users_migration_result.json')}`);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
