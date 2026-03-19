import { supabase } from '@/lib/supabaseClient';
import { createEntity } from './_createEntity';
import { safeRedirectUrl } from '@/lib/sanitize';

// Standard CRUD operations from the entity factory
const usersEntity = createEntity('users');

export const User = {
  // CRUD operations (list, filter, get, create, update, delete)
  list: usersEntity.list,
  filter: usersEntity.filter,
  get: usersEntity.get,
  create: usersEntity.create,
  update: usersEntity.update,
  delete: usersEntity.delete,

  // Custom: get current authenticated user with profile
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw error || new Error('Not authenticated');

    let { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', user.id)
      .single();

    // If profile doesn't exist yet, create it (first login)
    // ONLY on PGRST116 (row not found) — not on network/RLS errors
    if (profileError?.code === 'PGRST116') {
      const { data: newProfile, error: createError } = await supabase
        .from('users')
        .insert({
          auth_id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
          status: 'pendente',
          perfis: [],
          aeroportos_acesso: [],
        })
        .select()
        .single();

      if (!createError) {
        profile = newProfile;
      } else {
        console.warn('[User.me] Failed to create profile:', createError.message);
      }
    }

    const merged = {
      id: user.id,
      email: user.email,
      ...(profile || {}),
    };

    // Derive role from perfis if not explicitly set
    if (!merged.role) {
      if (Array.isArray(merged.perfis) && merged.perfis.includes('administrador')) {
        merged.role = 'admin';
      } else {
        merged.role = 'user';
      }
    }

    return merged;
  },

  async updateMe(updates) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('auth_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  redirectToLogin(redirectUrl) {
    const safe = safeRedirectUrl(redirectUrl || window.location.pathname, '/');
    window.location.href = `/login?redirect=${encodeURIComponent(safe)}`;
  },

  async logout(redirectUrl) {
    await supabase.auth.signOut();
    window.location.href = safeRedirectUrl(redirectUrl, '/login');
  },

  async loginWithRedirect(redirectUrl) {
    this.redirectToLogin(redirectUrl);
  },
};
