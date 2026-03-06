import { supabase } from '@/lib/supabaseClient';

export async function sendNotificationEmail({ to, subject, body, template, data }) {
  const { data: result, error } = await supabase.functions.invoke('send-notification-email', {
    body: { to, subject, body, template, data },
  });
  if (error) throw error;
  return result;
}

export default sendNotificationEmail;
