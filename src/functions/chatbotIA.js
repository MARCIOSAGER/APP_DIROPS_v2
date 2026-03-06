import { supabase } from '@/lib/supabaseClient';

export async function chatbotIA({ messages, context }) {
  const { data, error } = await supabase.functions.invoke('chatbot-ia', {
    body: { messages, context },
  });
  if (error) throw error;
  return data;
}

export default chatbotIA;
