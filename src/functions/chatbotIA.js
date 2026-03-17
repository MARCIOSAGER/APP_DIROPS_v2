import { supabase } from '@/lib/supabaseClient';

export async function chatbotIA({ messages }) {
  // SECURITY: context is built server-side from JWT — never send from client
  const { data, error } = await supabase.functions.invoke('chatbot-ia', {
    body: { messages },
  });
  if (error) throw error;
  return data;
}

export default chatbotIA;
