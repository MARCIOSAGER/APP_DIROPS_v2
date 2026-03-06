import { supabase } from '@/lib/supabaseClient';

export async function obterUrlAssinadaDocumento({ documento_id }) {
  const { data: documento, error } = await supabase
    .from('documento')
    .select('*')
    .eq('id', documento_id)
    .single();

  if (error || !documento) throw new Error('Documento não encontrado');

  if (documento.arquivo_privado_uri) {
    const path = documento.arquivo_privado_uri.replace(/^\//, '');
    const { data: signedData, error: signError } = await supabase.storage
      .from('private-uploads')
      .createSignedUrl(path, 300);

    if (signError) throw signError;
    return { success: true, url: signedData.signedUrl, expires_in: 300 };
  }

  return { success: true, url: documento.arquivo_url, public: true };
}
