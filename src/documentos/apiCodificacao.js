// Codificação documental da SGA (migração 157). O número de um documento diz duas coisas:
//
//     POP   -   FNMO   -   MGSO   -   010
//   classe    aeroporto   processo   sequência
//
//   • a CLASSE (o prefixo) diz o QUE o documento é — manual, plano, procedimento, ficha, matriz…;
//   • o PROCESSO (o terceiro segmento) diz de que MANUAL OU PROGRAMA faz parte — é a dimensão que a lei usa,
//     porque o Manual de Operações tem capítulos e apêndices e o Plano de Emergência é apêndice dele.
//
// Este ficheiro é a camada de dados: lê e escreve `documento_classe` e `documento_processo`, pergunta ao servidor
// qual é o número seguinte livre (`documento_numero_seguinte`) e sabe desmontar e avaliar um número escrito à mão.
//
// Decisão que atravessa tudo o que está aqui: o sistema SUGERE e VALIDA, NÃO IMPÕE. O acervo tem documentos
// antigos fora do padrão e partir-lhes o número para agradar a uma expressão regular seria estragar o arquivo.
// Por isso `analisarNumero` devolve AVISOS, nunca erros, e nada nesta camada recusa um número.
//
// Quem pode gravar é decidido pelo servidor (políticas da migração 157: classes só a administradores do portal,
// processos a gestores). As mensagens abaixo traduzem a recusa em português em vez de mostrar o erro cru.
// Molde: src/documentos/api.js e src/documentos/hooks.js.
import { supabase } from '@/lib/supabaseClient';

const naLista = (v) => (Array.isArray(v) ? v : []);
const texto = (v) => (String(v ?? '').trim() ? String(v).trim() : null);
const codigo = (v) => String(v ?? '').trim().toUpperCase();

export function erroCodificacao(error, acao) {
  const msg = String(error?.message || '');
  if (error?.code === '42501' || /policy|permission|denied|row-level/i.test(msg)) {
    return new Error(`Não foi possível ${acao}: não tem permissão para esta alteração. Os processos são do gestor documental e as classes do administrador do portal.`);
  }
  if (error?.code === '23505' || /duplicate|unique/i.test(msg)) {
    return new Error(`Não foi possível ${acao}: já existe um registo com esse código.`);
  }
  if (error?.code === '23503' || /foreign key|violates/i.test(msg)) {
    return new Error(`Não foi possível ${acao}: há documentos agarrados a este código. Desactive-o em vez de o apagar.`);
  }
  if (/does not exist|42703|42P01/i.test(msg) || error?.code === '42703' || error?.code === '42P01') {
    return new Error(`Não foi possível ${acao}: a codificação ainda não está instalada no servidor (migração 157).`);
  }
  return new Error(msg || `Não foi possível ${acao}.`);
}

// ── leitura ─────────────────────────────────────────────────────────────────
// Trazem-se também os inactivos: o ecrã de gestão tem de os poder ver e repor. As listas que só querem o que se
// pode escolher filtram `ativo` à frente.
export async function lerClasses() {
  const { data, error } = await supabase.from('documento_classe').select('*').order('ordem').order('codigo');
  if (error) throw erroCodificacao(error, 'carregar as classes');
  return naLista(data);
}
export async function lerProcessos() {
  const { data, error } = await supabase.from('documento_processo').select('*').order('ordem').order('codigo');
  if (error) throw erroCodificacao(error, 'carregar os processos');
  return naLista(data);
}

// Classe e processo de cada documento, e nada mais. É um pedido leve de propósito: a lista de documentos do portal
// (COLS_DOC, em hooks.js) não traz estas duas colunas, e é esta tabela que as cola de volta sem mexer nessa
// consulta nem a tornar mais pesada para quem só quer a biblioteca.
export async function lerCodificacaoDocumentos({ limite = 5000 } = {}) {
  const { data, error } = await supabase.from('documento')
    .select('id,classe_codigo,processo_codigo')
    .is('deleted_at', null).is('voo_ligado_id', null)
    .limit(limite);
  if (error) throw erroCodificacao(error, 'carregar a codificação dos documentos');
  return naLista(data);
}

// O número seguinte livre, calculado no servidor (função STABLE da migração 157): é lá que estão todos os
// documentos, incluindo os que esta sessão não vê, e por isso é lá que a sequência é verdadeira.
export async function numeroSeguinte(classe, aeroporto, processo) {
  if (!classe || !aeroporto || !processo) return '';
  const { data, error } = await supabase.rpc('documento_numero_seguinte', {
    p_classe: codigo(classe), p_aeroporto: codigo(aeroporto), p_processo: codigo(processo),
  });
  if (error) throw erroCodificacao(error, 'calcular o número seguinte');
  return typeof data === 'string' ? data : (data?.[0] ?? '');
}

// ── escrita ─────────────────────────────────────────────────────────────────
// `descricao` nas classes só se envia quando a coluna existe (ver sql/161_codificacao_extras.sql): sem ela, o
// ecrã continua a funcionar e apenas não mostra o campo.
export async function guardarClasse(cod, { nome, descricao, ordem, ativo } = {}, { temDescricao = false } = {}) {
  const c = codigo(cod);
  if (!c) throw new Error('Indique o código da classe.');
  if (!texto(nome)) throw new Error('A classe tem de ter um nome: é o que aparece a quem consulta.');
  const linha = { nome: texto(nome) };
  if (temDescricao) linha.descricao = texto(descricao);
  if (ordem !== undefined) linha.ordem = Number.isFinite(Number(ordem)) ? Number(ordem) : 0;
  if (ativo !== undefined) linha.ativo = ativo !== false;
  const { error } = await supabase.from('documento_classe').update(linha).eq('codigo', c);
  if (error) throw erroCodificacao(error, 'guardar a classe');
}

// Nomear ou renomear um processo. O nome pode ficar vazio — é assim que a migração 157 marca os treze processos
// que ninguém podia nomear sem saber, e limpar um nome errado é melhor do que deixar lá uma invenção.
// `nome_confirmado` só se envia quando quem chama o quer mexer: editar a descrição de um processo já confirmado
// não pode desconfirmá-lo por distracção, e editar um que está a pedir confirmação não o confirma em silêncio.
export async function guardarProcesso(cod, { nome, descricao, ordem, ativo, nome_confirmado, fonte_nome, setor_codigo } = {}) {
  const c = codigo(cod);
  if (!c) throw new Error('Indique o código do processo.');
  const linha = { nome: texto(nome), descricao: texto(descricao) };
  if (ordem !== undefined) linha.ordem = Number.isFinite(Number(ordem)) ? Number(ordem) : 0;
  if (ativo !== undefined) linha.ativo = ativo !== false;
  if (nome_confirmado !== undefined) linha.nome_confirmado = nome_confirmado !== false;
  if (fonte_nome !== undefined) linha.fonte_nome = texto(fonte_nome);
  if (setor_codigo !== undefined) linha.setor_codigo = codigo(setor_codigo) || null;
  const { error } = await supabase.from('documento_processo').update(linha).eq('codigo', c);
  if (error) throw erroCodificacao(error, 'guardar o processo');
}

// ── setores (área/organização, migração 172) ───────────────────────────────
// O setor é uma camada de organização, não de acesso: cada MANUAL pertence a um setor, e o setor de um documento
// é o do seu manual. Lê-se o catálogo e, para mudar o mapa, grava-se o setor no processo (guardarProcesso).
export async function lerSetores() {
  const { data, error } = await supabase.from('documento_setor').select('*').order('ordem').order('codigo');
  if (error) throw erroCodificacao(error, 'carregar os setores');
  return naLista(data);
}
export async function guardarSetor(cod, { nome, descricao, cor, ordem, ativo } = {}) {
  const c = codigo(cod);
  if (!c) throw new Error('Indique o código do setor.');
  const linha = {};
  if (nome !== undefined) linha.nome = texto(nome);
  if (descricao !== undefined) linha.descricao = texto(descricao);
  if (cor !== undefined) linha.cor = texto(cor);
  if (ordem !== undefined) linha.ordem = Number.isFinite(Number(ordem)) ? Number(ordem) : 0;
  if (ativo !== undefined) linha.ativo = ativo !== false;
  const { error } = await supabase.from('documento_setor').update(linha).eq('codigo', c);
  if (error) throw erroCodificacao(error, 'guardar o setor');
}

// Confirmar (ou corrigir e confirmar) o nome de um processo — a migração 163 deixou MPIP e PGG marcados como
// interpretação a confirmar, e é esta a única escrita que lhes põe `nome_confirmado = true`.
//
// A `fonte_nome` é reescrita e NÃO apagada: a frase antiga explicava a dúvida e, confirmado o nome, deixa de ser
// verdade; mas a nova tem de dizer quem confirmou e quando, porque é isso que passa a ser a prova. Guardar quem
// confirma vale mais do que guardar que alguém confirmou.
export async function confirmarNomeProcesso(cod, { nome, descricao, porQuem, origemAnterior } = {}) {
  const c = codigo(cod);
  if (!c) throw new Error('Indique o código do processo.');
  const n = texto(nome);
  if (!n) throw new Error('Escreva o nome do manual ou programa antes de o confirmar: é por este nome que ele passa a aparecer na biblioteca e na pesquisa.');
  const quando = new Date().toISOString().slice(0, 10);
  const quem = texto(porQuem) || 'um gestor documental';
  const antes = texto(origemAnterior);
  const linha = {
    nome: n,
    nome_confirmado: true,
    fonte_nome: `Confirmado por ${quem} em ${quando}.${antes ? ` Antes desta confirmação: ${antes}` : ''}`,
  };
  if (descricao !== undefined) linha.descricao = texto(descricao);
  const { error } = await supabase.from('documento_processo').update(linha).eq('codigo', c);
  if (error) throw erroCodificacao(error, 'confirmar o nome do processo');
}

// Um manual ou programa novo: o código entra como se escreve no número (maiúsculas, 2 a 8 letras).
export async function criarProcesso({ codigo: cod, nome, descricao, ordem } = {}) {
  const c = codigo(cod);
  if (!/^[A-Z]{2,8}$/.test(c)) throw new Error('O código do processo são 2 a 8 letras, sem espaços nem números (ex.: MOA, PSCI, SMGCS).');
  const { error } = await supabase.from('documento_processo').insert({
    codigo: c, nome: texto(nome), descricao: texto(descricao),
    ordem: Number.isFinite(Number(ordem)) ? Number(ordem) : 99, ativo: true,
  });
  if (error) throw erroCodificacao(error, 'criar o processo');
  return c;
}

// ── o número, desmontado ────────────────────────────────────────────────────
const RE_CLASSE = /^[A-Z]{2,4}$/;
export const RE_PROCESSO = /^[A-Z]{2,8}$/;
const RE_AEROPORTO = /^[A-Z]{4}$/;
const RE_SEQ = /^\d{1,4}$/;
export const EXEMPLO_NUMERO = 'POP-FNMO-MGSO-010';

// Desmonta `CLASSE-AEROPORTO-PROCESSO-SEQ`. Devolve sempre as quatro gavetas quando há quatro segmentos, mesmo que
// o conteúdo de cada uma não sirva — é `analisarNumero` que julga, não esta função.
export function partesNumero(numero) {
  const bruto = String(numero || '').trim();
  if (!bruto) return null;
  const p = bruto.split('-');
  if (p.length < 4) return null;
  return {
    bruto,
    classe: codigo(p[0]),
    aeroporto: codigo(p[1]),
    processo: codigo(p[2]),
    sequencia: p.slice(3).join('-').trim(),
  };
}

export function formatarNumero({ classe, aeroporto, processo, sequencia } = {}) {
  const seq = String(sequencia ?? '').trim();
  const partes = [codigo(classe), codigo(aeroporto), codigo(processo), /^\d+$/.test(seq) ? seq.padStart(3, '0') : seq];
  return partes.filter(Boolean).join('-');
}

// Avalia um número escrito à mão. NUNCA devolve erro: devolve avisos, porque há documentos antigos legítimos fora
// do padrão e o interface não os pode recusar. `estado` é só para o ecrã saber que tom usar.
//   • 'vazio'    — ainda não há número;
//   • 'conforme' — segue o padrão e os códigos existem;
//   • 'fora'     — segue a forma mas há algo a dizer, ou não segue a forma de todo.
export function analisarNumero(numero, { classes = [], processos = [], aeroportoCodigo = '' } = {}) {
  const bruto = String(numero || '').trim();
  if (!bruto) return { estado: 'vazio', avisos: [], partes: null };

  const partes = partesNumero(bruto);
  if (!partes) {
    return {
      estado: 'fora',
      partes: null,
      avisos: [`Este número não segue a codificação da SGA (classe-aeroporto-processo-sequência, ex.: ${EXEMPLO_NUMERO}). Pode guardar assim — há documentos antigos fora do padrão —, mas não entra nos filtros por manual nem por classe.`],
    };
  }

  const avisos = [];
  const codsClasse = new Set(naLista(classes).map(c => codigo(c.codigo)));
  const codsProcesso = new Set(naLista(processos).map(p => codigo(p.codigo)));

  if (!RE_CLASSE.test(partes.classe)) avisos.push(`«${partes.classe}» não tem a forma de uma classe (2 a 4 letras, como POP, MA ou RINT).`);
  else if (codsClasse.size && !codsClasse.has(partes.classe)) avisos.push(`A classe «${partes.classe}» não está na lista de classes do portal.`);

  if (!RE_AEROPORTO.test(partes.aeroporto)) avisos.push(`«${partes.aeroporto}» não parece um código ICAO de aeroporto (quatro letras, como FNMO ou FNLU).`);
  else if (aeroportoCodigo && codigo(aeroportoCodigo) !== partes.aeroporto) avisos.push(`O número diz ${partes.aeroporto} mas o documento está no aeroporto ${codigo(aeroportoCodigo)}.`);

  if (!RE_PROCESSO.test(partes.processo)) avisos.push(`«${partes.processo}» não tem a forma de um processo (2 a 8 letras, como MOA, PSCI ou SMGCS).`);
  else if (codsProcesso.size && !codsProcesso.has(partes.processo)) avisos.push(`O manual ou programa «${partes.processo}» ainda não existe na codificação — pode criá-lo em Gestão › Codificação.`);

  if (!RE_SEQ.test(partes.sequencia)) avisos.push(`A sequência «${partes.sequencia}» não são só algarismos.`);
  else if (partes.sequencia.length !== 3) avisos.push(`A sequência escreve-se com três algarismos (${partes.sequencia.padStart(3, '0')}, e não ${partes.sequencia}).`);

  return { estado: avisos.length ? 'fora' : 'conforme', avisos, partes };
}

// Classe e processo que se podem gravar a partir de um número: só se gravam códigos que existem nas tabelas,
// porque as duas colunas do documento são chaves estrangeiras e um código inventado faria o servidor recusar.
export function codigosValidosDoNumero(numero, { classes = [], processos = [] } = {}) {
  const partes = partesNumero(numero);
  if (!partes) return { classe: null, processo: null };
  const temClasse = naLista(classes).some(c => codigo(c.codigo) === partes.classe);
  const temProcesso = naLista(processos).some(p => codigo(p.codigo) === partes.processo);
  return { classe: temClasse ? partes.classe : null, processo: temProcesso ? partes.processo : null };
}
