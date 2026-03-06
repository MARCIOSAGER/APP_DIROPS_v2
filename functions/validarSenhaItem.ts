import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { item_id, tipo, senha } = await req.json();

    if (!item_id || !tipo || !senha) {
      return Response.json({ 
        error: 'Parâmetros inválidos',
        valido: false 
      }, { status: 400 });
    }

    // Buscar o item (pasta ou documento)
    let item;
    if (tipo === 'pasta') {
      const pastas = await base44.asServiceRole.entities.Pasta.filter({ id: item_id });
      item = pastas[0];
    } else if (tipo === 'documento') {
      const docs = await base44.asServiceRole.entities.Documento.filter({ id: item_id });
      item = docs[0];
    }

    if (!item) {
      return Response.json({ 
        error: 'Item não encontrado',
        valido: false 
      }, { status: 404 });
    }

    // Verificar se o item tem senha
    const senhaHash = tipo === 'pasta' ? item.senha_hash : item.senha_hash;
    
    if (!senhaHash) {
      return Response.json({ 
        error: 'Item não protegido por senha',
        valido: true 
      });
    }

    // Validar senha
    const senhaValida = await bcrypt.compare(senha, senhaHash);

    return Response.json({ 
      valido: senhaValida,
      message: senhaValida ? 'Senha válida' : 'Senha incorreta'
    });

  } catch (error) {
    console.error('Erro ao validar senha:', error);
    return Response.json({ 
      error: error.message,
      valido: false 
    }, { status: 500 });
  }
});