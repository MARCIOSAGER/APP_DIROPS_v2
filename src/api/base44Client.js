import { supabase } from '@/lib/supabaseClient';
import { createEntity } from '@/entities/_createEntity';
import { invokeFunction } from '@/functions/_invokeFunction';
import { safeRedirectUrl, sanitizeFilename, validateFileType } from '@/lib/sanitize';

const entityCache = {};
function getEntity(name) {
  const tableName = name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  if (!entityCache[name]) {
    entityCache[name] = createEntity(tableName);
  }
  return entityCache[name];
}

const entitiesProxy = new Proxy({}, {
  get(_, name) {
    return getEntity(name);
  }
});

export const base44 = {
  auth: {
    async me() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) throw error || new Error('Not authenticated');
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .single();
      return { id: user.id, email: user.email, ...profile };
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
    async isAuthenticated() {
      const { data: { user } } = await supabase.auth.getUser();
      return !!user;
    },
  },
  entities: entitiesProxy,
  // H-01: asServiceRole removed — was misleading (used same anon key, not service_role)
  // Use base44.entities directly instead
  functions: {
    async invoke(functionName, params = {}) {
      return invokeFunction(functionName, params);
    },
  },
  integrations: {
    Core: {
      async SendEmail(params) {
        return invokeFunction('sendEmailDirect', params);
      },
      async InvokeLLM(params) {
        return invokeFunction('invokeLLM', params);
      },
      async UploadFile({ file }) {
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        if (file.size > MAX_FILE_SIZE) throw new Error('Ficheiro excede o limite de 10MB.');
        const validation = await validateFileType(file);
        if (!validation.valid) throw new Error(validation.reason);
        const fileName = `${Date.now()}_${sanitizeFilename(file.name)}`;
        const { data, error } = await supabase.storage
          .from('uploads')
          .upload(fileName, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage
          .from('uploads')
          .getPublicUrl(data.path);
        return { url: urlData.publicUrl, path: data.path };
      },
      async UploadPrivateFile({ file }) {
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        if (file.size > MAX_FILE_SIZE) throw new Error('Ficheiro excede o limite de 10MB.');
        const validation = await validateFileType(file);
        if (!validation.valid) throw new Error(validation.reason);
        const fileName = `${Date.now()}_${sanitizeFilename(file.name)}`;
        const { data, error } = await supabase.storage
          .from('private-uploads')
          .upload(fileName, file);
        if (error) throw error;
        return { path: data.path };
      },
      async SendSMS(params) {
        return invokeFunction('sendSMS', params);
      },
      async GenerateImage(params) {
        return invokeFunction('generateImage', params);
      },
      async ExtractDataFromUploadedFile(params) {
        return invokeFunction('extractDataFromUploadedFile', params);
      },
    },
  },
  appLogs: {
    async logUserInApp() { /* no-op for now */ },
  },
};
