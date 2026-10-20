import { describe, it, expect } from 'vitest';
import { TIPOS_PERGUNTA, opcoesIniciais, validarPergunta, normalizarOpcoes, descreverResposta } from '@/components/formacao/quiz/quizUtils';

describe('quizUtils — tipos com imagem e resposta aberta', () => {
  it('regista os 10 tipos e marca os que exigem imagem / correcção manual', () => {
    expect(Object.keys(TIPOS_PERGUNTA)).toHaveLength(10);
    expect(TIPOS_PERGUNTA.hotspot.imagem).toBe(true);
    expect(TIPOS_PERGUNTA.rotulos.imagem).toBe(true);
    expect(TIPOS_PERGUNTA.aberta.manual).toBe(true);
    expect(opcoesIniciais('aberta')).toEqual([{ max_chars: 1000, rubrica: '' }]);
    expect(opcoesIniciais('hotspot')).toEqual([]);
  });

  it('valida: imagem obrigatória, zonas mínimas e rótulos', () => {
    expect(validarPergunta({ tipo: 'hotspot', enunciado: 'x', imagem_url: null, opcoes: [{ id: 'z', x: 0, y: 0, w: 5, h: 5 }] })).toEqual(['Carregue a imagem sobre a qual o aluno vai responder.']);
    expect(validarPergunta({ tipo: 'hotspot', enunciado: 'x', imagem_url: '/i.png', opcoes: [] })).toEqual(['Desenhe pelo menos 1 zona correcta sobre a imagem.']);
    expect(validarPergunta({ tipo: 'rotulos', enunciado: 'x', imagem_url: '/i.png', opcoes: [{ id: 'a', x: 0, y: 0, w: 5, h: 5, rotulo: 'A' }] })).toEqual(['Desenhe pelo menos 2 zonas e dê um rótulo a cada uma.']);
    expect(validarPergunta({ tipo: 'aberta', enunciado: 'x', opcoes: [{ max_chars: 500 }] })).toEqual([]);
  });

  it('normaliza zonas (arredonda, descarta vazias e sem rótulo) e a resposta aberta', () => {
    expect(normalizarOpcoes('hotspot', [{ id: 'z', x: 10.26, y: 20.44, w: 0, h: 5 }, { id: 'k', x: 1.11, y: 2.22, w: 3.33, h: 4.44 }])).toEqual([{ id: 'k', x: 1.1, y: 2.2, w: 3.3, h: 4.4 }]);
    expect(normalizarOpcoes('rotulos', [{ id: 'a', x: 0, y: 0, w: 5, h: 5, rotulo: '  Placa ' }, { id: 'b', x: 0, y: 0, w: 5, h: 5, rotulo: '' }])).toEqual([{ id: 'a', x: 0, y: 0, w: 5, h: 5, rotulo: 'Placa' }]);
    expect(normalizarOpcoes('aberta', [{ max_chars: '0', rubrica: ' 4 pilares ' }])).toEqual([{ max_chars: 1000, rubrica: '4 pilares' }]);
    expect(normalizarOpcoes('aberta', [{ max_chars: '300' }])).toEqual([{ max_chars: 300, rubrica: undefined }]);
  });

  it('descreve respostas dos novos tipos (aluno e gabarito)', () => {
    expect(descreverResposta({ tipo: 'hotspot' }, { x: 12.4, y: 77.6 })).toBe('ponto a 12% / 78% da imagem');
    expect(descreverResposta({ tipo: 'hotspot' }, [{ x: 0, y: 0, w: 1, h: 1 }], true)).toBe('a zona assinalada na imagem');
    const p = { tipo: 'rotulos', zonas: [{ id: 'z1' }, { id: 'z2' }], rotulos: [{ id: 'r1', texto: 'Placa' }, { id: 'r2', texto: 'Pista' }] };
    expect(descreverResposta(p, { z1: 'r2', z2: 'r1' })).toBe('Zona 1: Pista; Zona 2: Placa');
    expect(descreverResposta(p, { z1: 'Placa', z2: 'Pista' }, true)).toBe('Zona 1: Placa; Zona 2: Pista');
    expect(descreverResposta({ tipo: 'aberta' }, 'texto livre')).toBe('texto livre');
    expect(descreverResposta({ tipo: 'aberta' }, 'rubrica', true)).toBe('');
    // pergunta do banco (opcoes) para correspondência
    expect(descreverResposta({ tipo: 'correspondencia', opcoes: [{ id: '1', esquerda: 'A', direita: 'ALFA' }] }, { 1: '1' })).toBe('A ↔ ALFA');
  });
});
