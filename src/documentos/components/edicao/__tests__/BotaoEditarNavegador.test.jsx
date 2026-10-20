import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

let cfgAtual = {};
vi.mock('@/lib/supabaseClient', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock('../../../hooks', () => ({ useConfigPortalDocs: () => ({ data: cfgAtual }) }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: () => {} }) }));

import BotaoEditarNavegador from '../BotaoEditarNavegador';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const versoes = [{ id: 'v9', versao: 9, estado: 'fonte', mime: DOCX, arquivo_uri: 'a.docx' }];

describe('BotaoEditarNavegador', () => {
  beforeEach(() => { cfgAtual = {}; });
  it('não aparece quando a configuração está desligada', () => {
    const { container } = render(<BotaoEditarNavegador documentoId="d" versoes={versoes} />);
    expect(container.innerHTML).toBe('');
  });
  it('não aparece sem versão fonte .docx', () => {
    cfgAtual = { onlyoffice_activo: true, onlyoffice_url: 'http://srvkms001/onlyoffice' };
    const { container } = render(<BotaoEditarNavegador documentoId="d" versoes={[{ id: 'p', versao: 8, estado: 'em_vigor', mime: 'application/pdf', arquivo_uri: 'a.pdf' }]} />);
    expect(container.innerHTML).toBe('');
  });
  it('aparece quando ligado e há .docx; desactivado sem reserva', () => {
    cfgAtual = { onlyoffice_activo: true, onlyoffice_url: 'http://srvkms001/onlyoffice' };
    const { rerender } = render(<BotaoEditarNavegador documentoId="d" versoes={versoes} />);
    expect(screen.getByRole('button', { name: /Editar no navegador/ })).not.toBeDisabled();
    rerender(<BotaoEditarNavegador documentoId="d" versoes={versoes} reservadoPorMim={false} />);
    expect(screen.getByRole('button', { name: /Editar no navegador/ })).toBeDisabled();
  });
});
