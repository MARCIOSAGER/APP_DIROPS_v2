import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  substituirCampos, camposUsados, camposDoAeroporto, directorDoAeroporto, prepararParaAeroporto,
  revisaoActualDoDocumento, revisaoParaAlvo, problemasPrepararSubmissao, camposLocaisDoMestre, ehMestre, marcaFalta,
} from '../mestres';
import { validarDocumentoEstruturado } from '../contrato';
import { fluxosParaSubmeter, fluxosParaRever, impedimentoLote, submeterEmLote } from '../../submeterLote';
import { carregarMestres, normalizarMestre, ELABORADOR, REVISOR } from '../../../../tools/mestres/carregar-mestres.mjs';

const txt = (t) => ({ type: 'text', text: t });
const par = (t) => ({ type: 'paragraph', content: [txt(t)] });

const AERO = { id: 'a-fnhu', codigo_icao: 'FNHU', codigo_iata: 'NOV', nome: 'Aeroporto de Huambo', cidade: 'Huambo', gestor_nome: 'Gestor Antigo', gestor_cargo: 'Gestor' };
const RESP = [
  { aeroporto_id: 'a-fnhu', email: 'outro@sga.co.ao', nome: 'Outro', cargo: 'Adjunto', principal: false },
  { aeroporto_id: 'a-fnhu', email: 'DAdao@sga.co.ao', nome: 'Dionisia Adão', cargo: 'Director do Aeroporto', principal: true },
];

function mestreExemplo() {
  return {
    schema: 1,
    modelo: 'POP',
    cabecalho: {
      numero: '{{documento.numero}}', titulo: 'Notificação de colisão com aves — {{aeroporto.icao}}', revisao: '00', data: '2026-10-21',
      aeroporto: '{{aeroporto.icao}}', aeroportoNome: '{{aeroporto.nome}}', elaboradoPor: 'Marcio Sager', verificadoPor: 'Cesar Manuel Pascoal',
      aprovadoPor: '{{aeroporto.director}}', classificacao: 'Uso interno',
    },
    seccoes: [
      { id: 's1-objectivo', chave: 'objectivo', titulo: 'Objectivo no {{aeroporto.nome}}', obrigatoria: true, conteudo: { type: 'doc', content: [
        par('Aplica-se ao {{aeroporto.nome}} ({{ aeroporto.iata }}), em {{aeroporto.cidade}}.'),
        { type: 'heading', attrs: { level: 2 }, content: [txt('Contactos de {{aeroporto.icao}}')] },
        { type: 'table', attrs: { legenda: 'Contactos do {{aeroporto.icao}}' }, content: [
          { type: 'tableRow', content: [{ type: 'tableHeader', content: [par('Função')] }, { type: 'tableHeader', content: [par('Frequência')] }] },
          { type: 'tableRow', content: [{ type: 'tableCell', content: [par('{{aeroporto.director_cargo}}')] }, { type: 'tableCell', content: [par('{{local.frequencia}}')] }] },
        ] },
        { type: 'image', attrs: { src: 'data:image/png;base64,AAAA{{x.y}}', legenda: 'Planta do {{aeroporto.nome}}', alt: '{{aeroporto.icao}}' } },
        par('Responsável: {{local.responsavel_fauna}}'),
      ] } },
    ],
    historico: [{ revisao: '00', data: '2026-01-01', descricao: 'Mestre {{aeroporto.icao}}', autor: 'x' }],
    extras: {
      mestre: true, chave: 'pop-teste', elaboradoEmail: 'oaeroportos@sga.co.ao', verificadoEmail: 'cpascoal@sga.co.ao', aprovadoEmail: '',
      diferencas: ['Organização difere entre aeroportos'],
      alvos: [{ icao: 'FNHU', aeroporto_id: 'a-fnhu', documento_id: 'd-1', numero: 'POP-FNHU-MOA-002' }],
      valoresLocais: { FNHU: { frequencia: '118,1 MHz' }, FNCA: { responsavel_fauna: 'SOA' } },
    },
  };
}

describe('substituirCampos', () => {
  const valores = { 'aeroporto.nome': 'Aeroporto de Huambo', 'aeroporto.icao': 'FNHU', 'aeroporto.iata': 'NOV', 'aeroporto.cidade': 'Huambo', 'aeroporto.director': 'Dionisia Adão', 'local.frequencia': '118,1 MHz', 'documento.numero': 'POP-FNHU-MOA-002' };
  const { doc, emFalta, avisos } = substituirCampos(mestreExemplo(), valores);
  const s = doc.seccoes[0].conteudo.content;

  it('substitui no texto (com espaços dentro das chavetas)', () => {
    expect(s[0].content[0].text).toBe('Aplica-se ao Aeroporto de Huambo (NOV), em Huambo.');
  });
  it('substitui nos títulos (secção e heading)', () => {
    expect(doc.seccoes[0].titulo).toBe('Objectivo no Aeroporto de Huambo');
    expect(s[1].content[0].text).toBe('Contactos de FNHU');
  });
  it('substitui nas células, legendas e alt, mas não no src da imagem', () => {
    expect(s[2].content[1].content[1].content[0].content[0].text).toBe('118,1 MHz');
    expect(s[2].attrs.legenda).toBe('Contactos do FNHU');
    expect(s[3].attrs.legenda).toBe('Planta do Aeroporto de Huambo');
    expect(s[3].attrs.alt).toBe('FNHU');
    expect(s[3].attrs.src).toBe('data:image/png;base64,AAAA{{x.y}}');
  });
  it('substitui no cabeçalho e no histórico; não toca em extras', () => {
    expect(doc.cabecalho.numero).toBe('POP-FNHU-MOA-002');
    expect(doc.cabecalho.aprovadoPor).toBe('Dionisia Adão');
    expect(doc.cabecalho.titulo).toBe('Notificação de colisão com aves — FNHU');
    expect(doc.historico[0].descricao).toBe('Mestre FNHU');
    expect(doc.extras).toEqual(mestreExemplo().extras);
  });
  it('campo em falta fica visível e vem nos avisos', () => {
    expect(s[2].content[1].content[0].content[0].content[0].text).toBe(marcaFalta('aeroporto.director_cargo'));
    expect(s[4].content[0].text).toBe('Responsável: [falta: local.responsavel_fauna]');
    expect(emFalta).toEqual(['aeroporto.director_cargo', 'local.responsavel_fauna']);
    expect(avisos).toHaveLength(2);
  });
  it('não altera o original e o resultado continua válido no contrato', () => {
    expect(mestreExemplo().seccoes[0].titulo).toContain('{{');
    expect(validarDocumentoEstruturado(doc).valido).toBe(true);
  });
  it('camposUsados lista sem repetir, sem extras nem src', () => {
    expect(camposUsados(mestreExemplo())).toEqual(['documento.numero', 'aeroporto.icao', 'aeroporto.nome', 'aeroporto.director', 'aeroporto.iata', 'aeroporto.cidade', 'aeroporto.director_cargo', 'local.frequencia', 'local.responsavel_fauna']);
  });
  it('camposLocaisDoMestre e ehMestre', () => {
    expect(camposLocaisDoMestre(mestreExemplo())).toEqual(['frequencia', 'responsavel_fauna']);
    expect(ehMestre(mestreExemplo())).toBe(true);
    expect(ehMestre({ extras: {} })).toBe(false);
  });
});

describe('camposDoAeroporto', () => {
  it('director = responsável principal; nome da conta quando existe', () => {
    const v = camposDoAeroporto(AERO, RESP, { numero: 'POP-FNHU-MOA-002' }, [{ email: 'dadao@sga.co.ao', full_name: 'Dionisia Patele Adão' }]);
    expect(v['aeroporto.director']).toBe('Dionisia Patele Adão');
    expect(v['aeroporto.director_cargo']).toBe('Director do Aeroporto');
    expect(v['aeroporto.icao']).toBe('FNHU');
    expect(v['aeroporto.iata']).toBe('NOV');
    expect(v['documento.numero']).toBe('POP-FNHU-MOA-002');
  });
  it('sem conta usa o nome do responsável; sem responsável usa o gestor_nome', () => {
    expect(camposDoAeroporto(AERO, RESP)['aeroporto.director']).toBe('Dionisia Adão');
    expect(directorDoAeroporto(AERO, RESP).email).toBe('dadao@sga.co.ao');
    const sem = camposDoAeroporto(AERO, []);
    expect(sem['aeroporto.director']).toBe('Gestor Antigo');
    expect(sem['aeroporto.director_cargo']).toBe('Gestor');
    expect(directorDoAeroporto(AERO, []).email).toBeNull();
  });
  it('valores vazios não entram (contam como em falta)', () => {
    expect(camposDoAeroporto({ ...AERO, codigo_iata: '' }, RESP)).not.toHaveProperty('aeroporto.iata');
  });
});

describe('revisões', () => {
  it('revisão em vigor: rótulo «Rev. NN», versao numérica, versao_atual - 1', () => {
    expect(revisaoActualDoDocumento({}, { rotulo: 'Rev. 3' })).toBe('03');
    expect(revisaoActualDoDocumento({ versao: '2' })).toBe('02');
    expect(revisaoActualDoDocumento({ versao: '1.0', versao_atual: 1 })).toBe('00');
    expect(revisaoActualDoDocumento({})).toBeNull();
  });
  it('revisão que sai: alvo.revisao, rascunho gerado, rascunho em edição, sem informação', () => {
    expect(revisaoParaAlvo({ alvo: { revisao: '00' }, documento: { versao_atual: 5 } })).toBe('01');
    expect(revisaoParaAlvo({ alvo: {}, rascunhoExistente: { estado: 'gerado', conteudo_gerado: { cabecalho: { revisao: '04' } } } })).toBe('05');
    expect(revisaoParaAlvo({ alvo: { revisao: '00' }, rascunhoExistente: { estado: 'em_edicao', conteudo: { cabecalho: { revisao: '02' } } } })).toBe('02');
    expect(revisaoParaAlvo({ alvo: {}, documento: {} })).toBe('00');
  });
});

describe('prepararParaAeroporto', () => {
  const mestre = { id: 'mestre-1', conteudo: mestreExemplo() };
  const alvo = { icao: 'FNHU', aeroporto_id: 'a-fnhu', documento_id: 'd-1', numero: 'POP-FNHU-MOA-002', revisao: '01', historico: [{ revisao: '00', data: '2024-01-01', descricao: 'Emissão inicial', autor: 'A' }, { revisao: '01', data: '2025-01-01', descricao: 'Revisão', autor: 'B' }] };
  const documento = { id: 'd-1', numero: 'POP-FNHU-MOA-002', aeroporto_id: 'a-fnhu', processo_codigo: 'MOA', versao_atual: 2 };
  const r = prepararParaAeroporto(mestre, alvo, AERO, RESP, documento, null, { data: '2026-10-21', autor: 'Marcio Sager' });

  it('número do alvo e revisão seguinte', () => {
    expect(r.revisao).toBe('02');
    expect(r.conteudo.cabecalho.revisao).toBe('02');
    expect(r.conteudo.cabecalho.numero).toBe('POP-FNHU-MOA-002');
    expect(r.conteudo.cabecalho.aeroporto).toBe('FNHU');
    expect(r.conteudo.cabecalho.aeroportoNome).toBe('Aeroporto de Huambo');
    expect(r.conteudo.cabecalho.data).toBe('2026-10-21');
    expect(r.conteudo.cabecalho.aprovadoPor).toBe('Dionisia Adão');
  });
  it('histórico do documento + entrada da padronização (sem o histórico do mestre)', () => {
    const h = r.conteudo.historico;
    expect(h.map(x => x.revisao)).toEqual(['00', '01', '02']);
    expect(h[2].descricao).toBe('Padronização a partir do modelo-mestre Notificação de colisão com aves — FNHU');
    expect(h[2].autor).toBe('Marcio Sager');
  });
  it('emails, origem e sem extras de mestre', () => {
    const ex = r.conteudo.extras;
    expect(ex.verificadoEmail).toBe('cpascoal@sga.co.ao');
    expect(ex.aprovadoEmail).toBe('dadao@sga.co.ao');
    expect(ex.elaboradoEmail).toBe('oaeroportos@sga.co.ao');
    expect(ex.origemMestre).toBe('mestre-1');
    expect(ex.documentoId).toBe('d-1');
    expect(ex.processo).toBe('MOA');
    expect(ex).not.toHaveProperty('mestre');
    expect(ex).not.toHaveProperty('alvos');
    expect(ex).not.toHaveProperty('diferencas');
    expect(ex).not.toHaveProperty('valoresLocais');
  });
  it('campos locais do aeroporto e avisos de falta', () => {
    expect(r.emFalta).toEqual(['local.responsavel_fauna']);
    expect(JSON.stringify(r.conteudo.seccoes)).toContain('118,1 MHz');
    expect(validarDocumentoEstruturado(r.conteudo, { estrito: true }).erros).toEqual([]);
  });
  it('rascunho já existente: parte do histórico dele', () => {
    const rasc = { estado: 'gerado', conteudo_gerado: { cabecalho: { revisao: '03' }, historico: [{ revisao: '03', data: '2026-01-01', descricao: 'x', autor: 'y' }] } };
    const r2 = prepararParaAeroporto(mestre, { ...alvo, revisao: undefined }, AERO, RESP, documento, rasc, { data: '2026-10-21' });
    expect(r2.revisao).toBe('04');
    expect(r2.conteudo.historico.map(x => x.revisao)).toEqual(['03', '04']);
  });
  it('aeroporto sem responsável principal: avisa', () => {
    const r3 = prepararParaAeroporto(mestre, alvo, AERO, [], documento, null);
    expect(r3.avisos.join(' ')).toMatch(/não tem responsável principal/);
    expect(r3.conteudo.extras.aprovadoEmail).toBeNull();
  });
});

describe('preparar para submissão', () => {
  const c = mestreExemplo();
  it('só o elaborador do mestre (quem abre o fluxo fica elaborador)', () => {
    expect(problemasPrepararSubmissao({ eu: 'OAEROPORTOS@sga.co.ao', conteudoMestre: c })).toEqual([]);
    expect(problemasPrepararSubmissao({ eu: 'cpascoal@sga.co.ao', conteudoMestre: c }).join(' ')).toMatch(/elaborador/);
  });
  it('revisor em falta ou igual ao director', () => {
    expect(problemasPrepararSubmissao({ eu: 'oaeroportos@sga.co.ao', conteudoMestre: { extras: { elaboradoEmail: 'oaeroportos@sga.co.ao' } } }).join(' ')).toMatch(/revisor/);
    expect(problemasPrepararSubmissao({ eu: 'oaeroportos@sga.co.ao', conteudoMestre: c, director: { email: 'cpascoal@sga.co.ao' } }).join(' ')).toMatch(/mesma pessoa/);
  });
});

describe('submeter em lote', () => {
  const L = [
    { fluxo_id: 'f1', estado: 'rascunho', elaborador_email: 'oaeroportos@sga.co.ao', revisor_email: 'cpascoal@sga.co.ao', tem_pdf: true, tem_editavel: true },
    { fluxo_id: 'f2', estado: 'rascunho', elaborador_email: 'oaeroportos@sga.co.ao', tem_pdf: true, tem_editavel: false },
    { fluxo_id: 'f3', estado: 'devolvido', devolvido_para: 'elaborador', elaborador_email: 'OAEROPORTOS@sga.co.ao', tem_pdf: true, tem_editavel: true },
    { fluxo_id: 'f4', estado: 'devolvido', devolvido_para: 'revisor', elaborador_email: 'oaeroportos@sga.co.ao', revisor_email: 'cpascoal@sga.co.ao', tem_pdf: true, tem_editavel: true },
    { fluxo_id: 'f5', estado: 'aguarda_revisao', elaborador_email: 'oaeroportos@sga.co.ao', revisor_email: 'cpascoal@sga.co.ao', tem_pdf: true, tem_editavel: true },
    { fluxo_id: 'f6', estado: 'rascunho', elaborador_email: 'outro@sga.co.ao', tem_pdf: true, tem_editavel: true },
  ];
  it('filtros: por submeter (elaborador) e à espera da minha revisão (revisor)', () => {
    expect(fluxosParaSubmeter(L, 'oaeroportos@sga.co.ao').map(l => l.fluxo_id)).toEqual(['f1', 'f2', 'f3']);
    expect(fluxosParaRever(L, 'cpascoal@sga.co.ao').map(l => l.fluxo_id)).toEqual(['f4', 'f5']);
    expect(impedimentoLote(L[1])).toMatch(/editável/);
    expect(impedimentoLote(L[0])).toBeNull();
  });
  it('uma assinatura por fluxo, em sequência; uma falha não pára as outras', async () => {
    const chamadas = [];
    const assinar = async ({ fluxoId, acto, senha }) => {
      chamadas.push([fluxoId, acto, senha]);
      if (fluxoId === 'f3') { const e = new Error('Falta o PDF desta volta.'); e.status = 409; throw e; }
      return { codigo: `C-${fluxoId}` };
    };
    const r = await submeterEmLote([L[0], L[2], L[4], L[1]], { senha: 's3cr3t', assinar });
    expect(chamadas).toEqual([['f1', 'elaboracao', 's3cr3t'], ['f3', 'elaboracao', 's3cr3t'], ['f5', 'elaboracao', 's3cr3t']]);
    expect(r.ok.map(x => x.fluxo.fluxo_id)).toEqual(['f1', 'f5']);
    expect(r.falhas.map(x => x.fluxo.fluxo_id)).toEqual(['f3', 'f2']);
    expect(r.parouPor).toBeNull();
  });
  it('senha errada pára o lote (não gasta tentativas)', async () => {
    let n = 0;
    const assinar = async () => { n += 1; const e = new Error('Senha incorrecta.'); e.status = 401; throw e; };
    const r = await submeterEmLote([L[0], L[2], L[4]], { senha: 'x', assinar });
    expect(n).toBe(1);
    expect(r.naoTentados).toHaveLength(2);
    expect(r.parouPor).toMatch(/Senha incorrecta/);
  });
  it('sem senha não começa', async () => {
    await expect(submeterEmLote([L[0]], { senha: '', assinar: async () => ({}) })).rejects.toThrow(/senha/);
  });
});

describe('carregar-mestres (--dry)', () => {
  it('valida, preenche os valores por omissão e não escreve nada', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mestres-'));
    const m = mestreExemplo();
    delete m.extras.elaboradoEmail;
    delete m.extras.verificadoEmail;
    fs.writeFileSync(path.join(dir, 'mestre-pop-teste.json'), JSON.stringify(m));
    fs.writeFileSync(path.join(dir, 'mestre-mau.json'), JSON.stringify({ ...mestreExemplo(), extras: { chave: 'mau', alvos: [] } }));
    const pedidos = [];
    const fetch = async (url, opts = {}) => {
      pedidos.push([opts.method || 'GET', url]);
      if (url.includes('/documento_rascunho_estruturado')) return { ok: true, json: async () => [] };
      if (url.includes('/documento?')) return { ok: true, json: async () => [{ id: 'd-1', numero: 'POP-FNHU-MOA-002', aeroporto_id: 'a-fnhu', deleted_at: null }] };
      return { ok: false, status: 404, text: async () => 'x' };
    };
    const r = await carregarMestres({ dir, aplicar: false, fetch, servico: 'k', log: () => {} });
    expect(r.criar).toEqual(['pop-teste']);
    expect(r.invalidos.map(i => i.ficheiro)).toEqual(['mestre-mau.json']);
    expect(r.gravados).toBe(0);
    expect(pedidos.every(([met]) => met === 'GET')).toBe(true);
    expect(r.avisos[0].avisos.join(' ')).toMatch(/FNHU: sem valor para local.responsavel_fauna/);
    const n = normalizarMestre(m, 'mestre-pop-teste.json');
    expect(n.conteudo.extras.elaboradoEmail).toBe(ELABORADOR);
    expect(n.conteudo.extras.verificadoEmail).toBe(REVISOR);
    expect(n.conteudo.extras.mestre).toBe(true);
  });
});
