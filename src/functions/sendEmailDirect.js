import { supabase } from '@/lib/supabaseClient';

export async function sendEmailDirect({ to, subject, body, html, from_name }) {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { to, subject, html: html || body, text: body },
  });
  if (error) throw error;
  return data;
}

export default sendEmailDirect;
