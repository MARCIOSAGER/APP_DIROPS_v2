import { supabase } from '@/lib/supabaseClient';

export async function sendEmailDirect({ to, bcc, subject, body, html, from_name = undefined, attachments = undefined }) {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { to, bcc, subject, html: html || body, text: body, ...(attachments?.length ? { attachments } : {}) },
  });
  if (error) throw error;
  return data;
}

export default sendEmailDirect;
