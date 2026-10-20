import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const raiz = path.resolve(__dirname, '../../../../tools/curso-html5');
const L = require(path.join(raiz, 'player', 'logica.cjs'));
const exemplo = JSON.parse(fs.readFileSync(path.join(raiz, 'cursos', 'seguranca-na-placa', 'course.json'), 'utf8'));

describe('curso-html5 — lógica', () => {
  it('o curso de exemplo é válido e fica normalizado com ids', () => {
    expect(L.validarCurso(exemplo)).toEqual([]);
    const c = L.normalizarCurso(exemplo);
    expect(c.slug).toBe('seguranca-na-placa');
    expect(c.modulos[0].paginas[0].blocos[0].id).toBe('m1-p1-b1');
    expect(L.paginasDoCurso(c)).toHaveLength(7);
    expect(L.blocosInterativos(c).map(b => b.tipo)).toEqual(['flashcards', 'checklist', 'arrastar', 'ordenar', 'quiz']);
  });
  it('detecta erros de estrutura', () => {
    const erros = L.validarCurso({ titulo: 'X', modulos: [{ titulo: 'M', paginas: [{ titulo: 'P', blocos: [{ tipo: 'quiz', perguntas: [{ tipo: 'escolha_unica', enunciado: 'Q', opcoes: ['a'], correta: 5 }] }, { tipo: 'xpto' }, { tipo: 'arrastar', categorias: ['A'], itens: [{ texto: 'i', categoria: 'B' }] }] }] }] });
    expect(erros.join('\n')).toMatch(/2\+ "opcoes"/);
    expect(erros.join('\n')).toMatch(/índice da opção certa/);
    expect(erros.join('\n')).toMatch(/tipo desconhecido "xpto"/);
    expect(erros.join('\n')).toMatch(/2\+ categorias/);
    expect(erros.join('\n')).toMatch(/categoria inexistente/);
    expect(L.validarCurso({ modulos: [] })).toEqual(['falta "titulo"', '"modulos" tem de ser uma lista com pelo menos 1 módulo']);
  });
  it('corrige quizzes, arrastar e ordenar', () => {
    const c = L.normalizarCurso(exemplo);
    const quiz = L.blocosInterativos(c).find(b => b.tipo === 'quiz');
    const r = L.corrigirQuiz(quiz, { 0: 1, 1: false, 2: [2, 0], 3: 0 });
    expect(r).toMatchObject({ pontos: 3, max: 5, pct: 60 });
    expect(r.detalhe[2].correta).toBe(true);   // ordem dos índices não interessa
    expect(r.detalhe[3].correta).toBe(false);
    expect(r.detalhe[4]).toMatchObject({ correta: false, respondida: false });
    const arr = L.blocosInterativos(c).find(b => b.tipo === 'arrastar');
    expect(L.corrigirArrastar(arr, { 0: arr.categorias[0], 2: arr.categorias[1], 1: arr.categorias[1] })).toMatchObject({ pontos: 2, max: 6 });
    const ord = L.blocosInterativos(c).find(b => b.tipo === 'ordenar');
    expect(L.corrigirOrdenar(ord, [0, 1, 2, 3, 4]).pct).toBe(100);
    expect(L.corrigirOrdenar(ord, [1, 0, 2, 3, 4]).pontos).toBe(3);
  });
  it('progresso, nota global e estado de conclusão SCORM', () => {
    const c = L.normalizarCurso(exemplo);
    const pags = L.paginasDoCurso(c), inter = L.blocosInterativos(c), quiz = inter.find(b => b.tipo === 'quiz');
    const estado = { visitadas: {}, concluidos: {}, resultados: {} };
    expect(L.estadoConclusao(c, estado)).toBe('incomplete');
    pags.forEach(p => { estado.visitadas[p.id] = true; });
    inter.forEach(b => { estado.concluidos[b.id] = true; });
    expect(L.calcularProgresso(c, estado)).toMatchObject({ pct: 100, paginas: 7, visitadas: 7, interativos: 5, feitos: 5 });
    expect(L.estadoConclusao(c, estado)).toBe('incomplete');            // quiz ainda não submetido
    estado.resultados[quiz.id] = { submetido: true, tentativas: 1, pontos: 3, max: 5 };
    expect(L.notaGlobal(c, estado)).toMatchObject({ quizzes: 1, pendentes: 0, pct: 60, esgotados: 0 });
    expect(L.estadoConclusao(c, estado)).toBe('incomplete');            // 60% < 70% mas ainda há tentativa
    estado.resultados[quiz.id] = { submetido: true, tentativas: 2, pontos: 3, max: 5 };
    expect(L.estadoConclusao(c, estado)).toBe('failed');
    estado.resultados[quiz.id] = { submetido: true, tentativas: 2, pontos: 4, max: 5 };
    expect(L.estadoConclusao(c, estado)).toBe('passed');
    const semQuiz = L.normalizarCurso({ titulo: 'S', modulos: [{ titulo: 'M', paginas: [{ titulo: 'P', blocos: [{ tipo: 'texto', html: '<p>x</p>' }] }] }] });
    expect(L.estadoConclusao(semQuiz, { visitadas: { 'm1-p1': true } })).toBe('completed');
  });
  it('serializa o estado de forma compacta (suspend_data) e volta a ler', () => {
    const st = { visitadas: { a: true, b: true }, concluidos: { q1: true }, resultados: { q1: { submetido: true, tentativas: 1, pontos: 4, max: 5 } }, pagina: 'b', nome: 'Ana' };
    const txt = L.serializarEstado(st);
    expect(txt.length).toBeLessThan(200);
    expect(L.desserializarEstado(txt)).toEqual(st);
    expect(L.desserializarEstado('lixo')).toMatchObject({ visitadas: {}, resultados: {} });
  });
});
