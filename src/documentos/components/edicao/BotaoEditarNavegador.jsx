// Botão «Editar no navegador» (ONLYOFFICE Docs) na ficha do documento.
//
// Só aparece quando as duas coisas são verdade: a edição no navegador está LIGADA na configuração do portal
// (documentos_config.onlyoffice_activo + onlyoffice_url, migração 184) E o documento tem uma versão .docx em
// fonte/rascunho/em vigor. Desligado por omissão — até lá, este componente não desenha nada.
// A reserva e a permissão são verificadas no servidor; aqui só se avisa antes de abrir, para poupar um passo.
import React, { useState } from 'react';
import { FilePen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfigPortalDocs } from '../../hooks';
import { edicaoNavegadorActiva, escolherVersaoFonte } from './onlyofficeLogica';
import EditorOnlyOffice from './EditorOnlyOffice';

// props:
//   documentoId     — id do documento
//   versoes         — lista de documento_versao do documento (useVersoesDocumento)
//   titulo          — título a mostrar na barra do editor
//   reservadoPorMim — true/false se a ficha já souber; undefined = deixa o servidor decidir
//   onFechado       — ({ alterado }) => void, depois de fechar o editor
export default function BotaoEditarNavegador({ documentoId, versoes, titulo, reservadoPorMim, onFechado, className, size = 'sm', variant = 'outline' }) {
  const { data: cfg } = useConfigPortalDocs();
  const [aberto, setAberto] = useState(false);
  const fonte = escolherVersaoFonte(versoes);

  if (!edicaoNavegadorActiva(cfg) || !fonte) return null;

  const semReserva = reservadoPorMim === false;
  const dica = semReserva
    ? 'Reserve o documento primeiro: só quem o reservou o edita.'
    : `Abre a v${fonte.versao} (.docx) no editor do navegador. Ao fechar, as alterações ficam numa revisão nova em rascunho.`;

  return (
    <>
      <Button type="button" size={size} variant={variant} className={className} disabled={semReserva} title={dica} onClick={() => setAberto(true)}>
        <FilePen className="mr-1.5 h-4 w-4" aria-hidden="true" />Editar no navegador
      </Button>
      {aberto && (
        <EditorOnlyOffice
          versaoId={fonte.id}
          documentoId={documentoId}
          titulo={titulo || fonte.arquivo_nome}
          onFechar={(r) => { setAberto(false); onFechado?.(r); }}
        />
      )}
    </>
  );
}
