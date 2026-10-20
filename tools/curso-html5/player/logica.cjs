/* Lógica pura do curso-html5 (sem DOM): validação do course.json, sequência de páginas, correcção de
   quizzes/arrastar/ordenar, progresso e estado de conclusão (SCORM). UMD: browser (window.CursoLogica) e node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CursoLogica = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TIPOS_BLOCO = ['titulo', 'texto', 'imagem', 'video', 'callout', 'acordeao', 'flashcards', 'checklist', 'arrastar', 'ordenar', 'quiz', 'passos', 'colunas', 'tabela'];
  var INTERATIVOS = { flashcards: true, checklist: true, arrastar: true, ordenar: true, quiz: true };
  var TIPOS_PERGUNTA = ['escolha_unica', 'escolha_multipla', 'vf'];

  function slugify(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'curso'; }

  // Atribui ids estáveis a módulos/páginas/blocos que não os tenham e devolve o curso normalizado.
  function normalizarCurso(curso) {
    var c = JSON.parse(JSON.stringify(curso || {}));
    c.slug = c.slug || slugify(c.titulo);
    c.nota_minima = c.nota_minima == null ? 70 : Number(c.nota_minima);
    c.identidade = c.identidade || {};
    c.modulos = Array.isArray(c.modulos) ? c.modulos : [];
    c.modulos.forEach(function (m, mi) {
      m.id = m.id || ('m' + (mi + 1));
      m.paginas = Array.isArray(m.paginas) ? m.paginas : [];
      m.paginas.forEach(function (p, pi) {
        p.id = p.id || (m.id + '-p' + (pi + 1));
        p.blocos = Array.isArray(p.blocos) ? p.blocos : [];
        p.blocos.forEach(function (b, bi) { b.id = b.id || (p.id + '-b' + (bi + 1)); });
      });
    });
    return c;
  }

  // Erros de estrutura (lista vazia = válido).
  function validarCurso(curso) {
    var erros = [];
    if (!curso || typeof curso !== 'object') return ['course.json não é um objecto'];
    if (!curso.titulo) erros.push('falta "titulo"');
    if (!Array.isArray(curso.modulos) || !curso.modulos.length) erros.push('"modulos" tem de ser uma lista com pelo menos 1 módulo');
    (curso.modulos || []).forEach(function (m, mi) {
      var ref = 'módulo ' + (mi + 1) + (m && m.titulo ? ' ("' + m.titulo + '")' : '');
      if (!m || !m.titulo) erros.push(ref + ': falta "titulo"');
      if (!m || !Array.isArray(m.paginas) || !m.paginas.length) { erros.push(ref + ': precisa de "paginas"'); return; }
      m.paginas.forEach(function (p, pi) {
        var pref = ref + ' › página ' + (pi + 1);
        if (!p || !p.titulo) erros.push(pref + ': falta "titulo"');
        if (!p || !Array.isArray(p.blocos) || !p.blocos.length) { erros.push(pref + ': precisa de "blocos"'); return; }
        p.blocos.forEach(function (b, bi) {
          var bref = pref + ' › bloco ' + (bi + 1);
          if (!b || TIPOS_BLOCO.indexOf(b.tipo) < 0) { erros.push(bref + ': tipo desconhecido "' + (b && b.tipo) + '" (válidos: ' + TIPOS_BLOCO.join(', ') + ')'); return; }
          if (b.tipo === 'quiz') {
            if (!Array.isArray(b.perguntas) || !b.perguntas.length) erros.push(bref + ': quiz sem "perguntas"');
            (b.perguntas || []).forEach(function (q, qi) {
              var qref = bref + ' › pergunta ' + (qi + 1);
              if (!q || TIPOS_PERGUNTA.indexOf(q.tipo) < 0) { erros.push(qref + ': tipo inválido (escolha_unica | escolha_multipla | vf)'); return; }
              if (!q.enunciado) erros.push(qref + ': falta "enunciado"');
              if (q.tipo === 'vf') { if (typeof q.correta !== 'boolean') erros.push(qref + ': "correta" tem de ser true/false'); }
              else {
                if (!Array.isArray(q.opcoes) || q.opcoes.length < 2) erros.push(qref + ': precisa de 2+ "opcoes"');
                if (q.tipo === 'escolha_unica' && !(Number.isInteger(q.correta) && q.correta >= 0 && q.correta < (q.opcoes || []).length)) erros.push(qref + ': "correta" tem de ser o índice da opção certa');
                if (q.tipo === 'escolha_multipla' && !(Array.isArray(q.correta) && q.correta.length)) erros.push(qref + ': "correta" tem de ser lista de índices');
              }
            });
          }
          if (b.tipo === 'arrastar') {
            if (!Array.isArray(b.categorias) || b.categorias.length < 2) erros.push(bref + ': "arrastar" precisa de 2+ categorias');
            if (!Array.isArray(b.itens) || !b.itens.length) erros.push(bref + ': "arrastar" precisa de itens {texto, categoria}');
            (b.itens || []).forEach(function (it) { if (!it || (b.categorias || []).indexOf(it.categoria) < 0) erros.push(bref + ': item "' + (it && it.texto) + '" com categoria inexistente'); });
          }
          if (b.tipo === 'ordenar' && (!Array.isArray(b.itens) || b.itens.length < 2)) erros.push(bref + ': "ordenar" precisa de 2+ itens na ordem correcta');
          if (b.tipo === 'flashcards' && (!Array.isArray(b.cartas) || !b.cartas.length)) erros.push(bref + ': "flashcards" precisa de cartas {frente, verso}');
          if (b.tipo === 'checklist' && (!Array.isArray(b.itens) || !b.itens.length)) erros.push(bref + ': "checklist" precisa de itens');
          if (b.tipo === 'acordeao' && (!Array.isArray(b.itens) || !b.itens.length)) erros.push(bref + ': "acordeao" precisa de itens {titulo, html}');
          if (b.tipo === 'imagem' && !b.src) erros.push(bref + ': imagem sem "src"');
          if (b.tipo === 'video' && !b.src && !b.youtube) erros.push(bref + ': vídeo sem "src" nem "youtube"');
          if ((b.tipo === 'texto' || b.tipo === 'callout') && !b.html) erros.push(bref + ': falta "html"');
        });
      });
    });
    return erros;
  }

  // Lista linear de páginas [{id, titulo, modulo, blocos}] pela ordem do curso.
  function paginasDoCurso(curso) {
    var out = [];
    (curso.modulos || []).forEach(function (m) { (m.paginas || []).forEach(function (p) { out.push({ id: p.id, titulo: p.titulo, modulo: m, blocos: p.blocos || [] }); }); });
    return out;
  }
  function blocosInterativos(curso) {
    var out = [];
    paginasDoCurso(curso).forEach(function (p) { p.blocos.forEach(function (b) { if (INTERATIVOS[b.tipo]) out.push(b); }); });
    return out;
  }

  // Corrige um quiz: respostas = { [índice pergunta]: número | número[] | boolean }. Devolve pontos por pergunta.
  function corrigirQuiz(bloco, respostas) {
    var perguntas = bloco.perguntas || [], res = respostas || {}, total = 0, certas = 0, detalhe = [];
    perguntas.forEach(function (q, i) {
      var r = res[i], ok = false, respondida = r !== undefined && r !== null && !(Array.isArray(r) && !r.length);
      if (q.tipo === 'vf') ok = respondida && r === q.correta;
      else if (q.tipo === 'escolha_unica') ok = respondida && Number(r) === Number(q.correta);
      else if (q.tipo === 'escolha_multipla') {
        var esperado = (q.correta || []).map(Number).sort(), dado = (Array.isArray(r) ? r : []).map(Number).sort();
        ok = respondida && esperado.length === dado.length && esperado.every(function (v, k) { return v === dado[k]; });
      }
      total++; if (ok) certas++;
      detalhe.push({ indice: i, correta: ok, respondida: respondida });
    });
    return { pontos: certas, max: total, pct: total ? Math.round((certas / total) * 100) : 0, detalhe: detalhe };
  }
  // arrastar: colocacao = { [índice item]: categoria }
  function corrigirArrastar(bloco, colocacao) {
    var itens = bloco.itens || [], certas = 0, detalhe = [];
    itens.forEach(function (it, i) { var ok = (colocacao || {})[i] === it.categoria; if (ok) certas++; detalhe.push({ indice: i, correta: ok, colocado: (colocacao || {})[i] || null }); });
    return { pontos: certas, max: itens.length, pct: itens.length ? Math.round((certas / itens.length) * 100) : 0, detalhe: detalhe };
  }
  // ordenar: ordem = índices dos itens pela ordem dada pelo aluno (o gabarito é a ordem original)
  function corrigirOrdenar(bloco, ordem) {
    var n = (bloco.itens || []).length, certas = 0, detalhe = [];
    for (var k = 0; k < n; k++) { var ok = Array.isArray(ordem) && ordem[k] === k; if (ok) certas++; detalhe.push({ posicao: k, correta: ok }); }
    return { pontos: certas, max: n, pct: n ? Math.round((certas / n) * 100) : 0, detalhe: detalhe };
  }

  // Progresso 0-100: páginas visitadas + blocos interactivos concluídos.
  function calcularProgresso(curso, estado) {
    var paginas = paginasDoCurso(curso), inter = blocosInterativos(curso), st = estado || {};
    var visitadas = paginas.filter(function (p) { return st.visitadas && st.visitadas[p.id]; }).length;
    var feitos = inter.filter(function (b) { return st.concluidos && st.concluidos[b.id]; }).length;
    var total = paginas.length + inter.length;
    return { pct: total ? Math.round(((visitadas + feitos) / total) * 100) : 0, paginas: paginas.length, visitadas: visitadas, interativos: inter.length, feitos: feitos };
  }

  // Nota global: média ponderada dos quizzes com conta_para_nota (por omissão todos) — cada pergunta vale 1.
  function notaGlobal(curso, estado) {
    var pontos = 0, max = 0, pendentes = 0, esgotados = 0, quizzes = 0;
    blocosInterativos(curso).forEach(function (b) {
      if (b.tipo !== 'quiz' || b.conta_para_nota === false) return;
      quizzes++;
      var r = estado && estado.resultados && estado.resultados[b.id];
      if (!r || !r.submetido) { pendentes++; return; }
      pontos += r.pontos; max += r.max;
      var tent = b.tentativas == null ? 2 : Number(b.tentativas);
      if (r.tentativas >= tent) esgotados++;
    });
    return { quizzes: quizzes, pendentes: pendentes, esgotados: esgotados, pontos: pontos, max: max, pct: max ? Math.round((pontos / max) * 100) : null };
  }

  // Estado SCORM: 'passed' | 'failed' | 'completed' | 'incomplete'
  function estadoConclusao(curso, estado) {
    var prog = calcularProgresso(curso, estado), nota = notaGlobal(curso, estado);
    var tudoVisto = prog.visitadas >= prog.paginas && prog.feitos >= prog.interativos;
    if (!nota.quizzes) return tudoVisto ? 'completed' : 'incomplete';
    if (nota.pendentes) return 'incomplete';
    if (nota.pct >= Number(curso.nota_minima || 0)) return tudoVisto ? 'passed' : 'incomplete';
    return nota.esgotados >= nota.quizzes ? 'failed' : 'incomplete';
  }

  // suspend_data compacto (SCORM 1.2 limita a 4096 caracteres): v=visitadas, c=concluídos, r=resultados, p=página, n=nome
  function serializarEstado(estado) {
    var st = estado || {};
    return JSON.stringify({ v: Object.keys(st.visitadas || {}), c: Object.keys(st.concluidos || {}), r: st.resultados || {}, p: st.pagina || null, n: st.nome || '' });
  }
  function desserializarEstado(texto) {
    try {
      var j = JSON.parse(texto || '{}'), st = { visitadas: {}, concluidos: {}, resultados: j.r || {}, pagina: j.p || null, nome: j.n || '' };
      (j.v || []).forEach(function (id) { st.visitadas[id] = true; });
      (j.c || []).forEach(function (id) { st.concluidos[id] = true; });
      return st;
    } catch (e) { return { visitadas: {}, concluidos: {}, resultados: {}, pagina: null, nome: '' }; }
  }

  return { TIPOS_BLOCO: TIPOS_BLOCO, INTERATIVOS: INTERATIVOS, slugify: slugify, normalizarCurso: normalizarCurso, validarCurso: validarCurso, paginasDoCurso: paginasDoCurso, blocosInterativos: blocosInterativos, corrigirQuiz: corrigirQuiz, corrigirArrastar: corrigirArrastar, corrigirOrdenar: corrigirOrdenar, calcularProgresso: calcularProgresso, notaGlobal: notaGlobal, estadoConclusao: estadoConclusao, serializarEstado: serializarEstado, desserializarEstado: desserializarEstado };
});
