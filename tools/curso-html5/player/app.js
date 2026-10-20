// Diálogo de confirmação próprio (substitui window.confirm): modal acessível com a identidade do curso.
function ucConfirmar(mensagem, opcoes) {
  opcoes = opcoes || {};
  return new Promise(function (resolver) {
    var anterior = document.activeElement;
    var fundo = document.createElement('div'); fundo.className = 'uc-modal-fundo';
    var caixa = document.createElement('div'); caixa.className = 'uc-modal'; caixa.setAttribute('role', 'dialog'); caixa.setAttribute('aria-modal', 'true'); caixa.setAttribute('aria-labelledby', 'uc-modal-titulo');
    var titulo = document.createElement('h2'); titulo.id = 'uc-modal-titulo'; titulo.textContent = opcoes.titulo || 'Confirmar';
    var texto = document.createElement('p'); texto.textContent = mensagem;
    var accoes = document.createElement('div'); accoes.className = 'uc-modal-accoes';
    var btnNao = document.createElement('button'); btnNao.type = 'button'; btnNao.className = 'btn btn-suave'; btnNao.textContent = opcoes.cancelar || 'Cancelar';
    var btnSim = document.createElement('button'); btnSim.type = 'button'; btnSim.className = 'btn ' + (opcoes.perigo ? 'btn-perigo' : 'btn-primario'); btnSim.textContent = opcoes.confirmar || 'Continuar';
    function fechar(valor) { document.removeEventListener('keydown', teclas, true); fundo.remove(); document.body.classList.remove('uc-modal-aberto'); try { if (anterior && anterior.focus) anterior.focus(); } catch (e) { /* */ } resolver(valor); }
    function teclas(e) {
      if (e.key === 'Escape') { e.preventDefault(); fechar(false); }
      else if (e.key === 'Tab') { var focaveis = [btnNao, btnSim]; var i = focaveis.indexOf(document.activeElement); e.preventDefault(); focaveis[(i + (e.shiftKey ? -1 : 1) + focaveis.length) % focaveis.length].focus(); }
    }
    btnNao.addEventListener('click', function () { fechar(false); });
    btnSim.addEventListener('click', function () { fechar(true); });
    fundo.addEventListener('click', function (e) { if (e.target === fundo) fechar(false); });
    accoes.appendChild(btnNao); accoes.appendChild(btnSim);
    caixa.appendChild(titulo); caixa.appendChild(texto); caixa.appendChild(accoes); fundo.appendChild(caixa);
    document.body.appendChild(fundo); document.body.classList.add('uc-modal-aberto');
    document.addEventListener('keydown', teclas, true);
    setTimeout(function () { (opcoes.focoNo === 'cancelar' ? btnNao : btnSim).focus(); }, 0);
  });
}
/* curso-html5 — runtime do curso interactivo (vanilla JS, sem dependências). Lê o course.json embebido em
   #course-data, renderiza módulos/páginas/blocos, guarda progresso (SCORM 1.2/2004 quando existe API na janela
   mãe; senão localStorage) e reporta conclusão/nota ao LMS. Lógica pura em logica.js (CursoLogica). */
(function () {
  'use strict';
  var L = window.CursoLogica;
  var dados = document.getElementById('course-data');
  var curso = L.normalizarCurso(JSON.parse(dados ? dados.textContent : '{}'));
  var paginas = L.paginasDoCurso(curso);
  var FINAL_ID = '__final';
  var estado = { visitadas: {}, concluidos: {}, resultados: {}, pagina: null, nome: '' };
  var rascunhos = {}; // respostas em curso por bloco (não persistidas)
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var el = function (tag, attrs, filhos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (filhos || []).forEach(function (f) { if (f == null) return; n.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
    return n;
  };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------------- SCORM ---------------- */
  var scorm = (function () {
    function procurar(win, nome) {
      var w = win, n = 0;
      try { while (w && n < 10) { if (w[nome]) return w[nome]; if (w.parent === w) break; w = w.parent; n++; } } catch (e) { /* cross-origin */ }
      try { if (win.opener && win.opener[nome]) return win.opener[nome]; } catch (e) { /* */ }
      return null;
    }
    var api12 = procurar(window, 'API'), api2004 = procurar(window, 'API_1484_11');
    var v = api12 ? '1.2' : api2004 ? '2004' : null, api = api12 || api2004, ativo = false;
    var f = v === '1.2' ? { init: 'LMSInitialize', get: 'LMSGetValue', set: 'LMSSetValue', commit: 'LMSCommit', fim: 'LMSFinish' } : { init: 'Initialize', get: 'GetValue', set: 'SetValue', commit: 'Commit', fim: 'Terminate' };
    var chaves = v === '1.2'
      ? { nome: 'cmi.core.student_name', id: 'cmi.core.student_id', estado: 'cmi.core.lesson_status', nota: 'cmi.core.score.raw', min: 'cmi.core.score.min', max: 'cmi.core.score.max', suspend: 'cmi.suspend_data', local: 'cmi.core.lesson_location', saida: 'cmi.core.exit', tempo: 'cmi.core.session_time' }
      : { nome: 'cmi.learner_name', id: 'cmi.learner_id', estado: 'cmi.completion_status', sucesso: 'cmi.success_status', nota: 'cmi.score.raw', escalada: 'cmi.score.scaled', min: 'cmi.score.min', max: 'cmi.score.max', suspend: 'cmi.suspend_data', local: 'cmi.location', saida: 'cmi.exit', tempo: 'cmi.session_time' };
    var inicio = Date.now();
    function get(k) { try { return String(api[f.get](k) || ''); } catch (e) { return ''; } }
    function set(k, val) { try { api[f.set](k, String(val)); } catch (e) { /* */ } }
    function tempoSessao() {
      var s = Math.round((Date.now() - inicio) / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60, p = function (n, w) { return String(n).padStart(w || 2, '0'); };
      return v === '1.2' ? p(h, 4) + ':' + p(m) + ':' + p(ss) + '.00' : 'PT' + h + 'H' + m + 'M' + ss + 'S';
    }
    return {
      versao: v,
      iniciar: function () {
        if (!api) return false;
        try { ativo = String(api[f.init]('')) === 'true'; } catch (e) { ativo = false; }
        if (ativo) { set(chaves.min, 0); set(chaves.max, 100); if (v === '1.2' && get(chaves.estado) === 'not attempted') set(chaves.estado, 'incomplete'); }
        return ativo;
      },
      nome: function () { return ativo ? get(chaves.nome).replace(/^([^,]+),\s*(.+)$/, '$2 $1') : ''; },
      ler: function () { return ativo ? get(chaves.suspend) : ''; },
      guardar: function (texto, pagina, conclusao, nota) {
        if (!ativo) return;
        set(chaves.suspend, texto); set(chaves.local, pagina || '');
        if (nota != null) { set(chaves.nota, nota); if (v === '2004') set(chaves.escalada, (nota / 100).toFixed(2)); }
        if (v === '1.2') set(chaves.estado, conclusao);
        else { set(chaves.estado, conclusao === 'passed' || conclusao === 'completed' || conclusao === 'failed' ? 'completed' : 'incomplete'); set(chaves.sucesso, conclusao === 'passed' ? 'passed' : conclusao === 'failed' ? 'failed' : 'unknown'); }
        set(chaves.tempo, tempoSessao());
        try { api[f.commit](''); } catch (e) { /* */ }
      },
      terminar: function () { if (!ativo) return; set(chaves.saida, 'suspend'); set(chaves.tempo, tempoSessao()); try { api[f.commit](''); api[f.fim](''); } catch (e) { /* */ } ativo = false; },
    };
  })();
  var chaveLocal = 'curso-html5:' + curso.slug;

  function carregarEstado() {
    var texto = scorm.iniciar() ? scorm.ler() : '';
    if (!texto) { try { texto = localStorage.getItem(chaveLocal) || ''; } catch (e) { /* */ } }
    if (texto) estado = L.desserializarEstado(texto);
    if (!estado.nome) estado.nome = scorm.nome();
  }
  var ultimoGuardar = 0, timerGuardar = null;
  function guardar(agora) {
    var texto = L.serializarEstado(estado), conclusao = L.estadoConclusao(curso, estado), nota = L.notaGlobal(curso, estado);
    try { localStorage.setItem(chaveLocal, texto); } catch (e) { /* */ }
    var fazer = function () { ultimoGuardar = Date.now(); scorm.guardar(texto, estado.pagina, conclusao, nota.pct); };
    if (agora || Date.now() - ultimoGuardar > 15000) { if (timerGuardar) { clearTimeout(timerGuardar); timerGuardar = null; } fazer(); }
    else if (!timerGuardar) timerGuardar = setTimeout(function () { timerGuardar = null; fazer(); }, 5000);
  }
  window.addEventListener('beforeunload', function () { guardar(true); scorm.terminar(); });
  window.addEventListener('pagehide', function () { guardar(true); });

  /* ---------------- cabeçalho / índice ---------------- */
  var identidade = curso.identidade || {};
  if (identidade.cor_primaria) document.documentElement.style.setProperty('--cor-primaria', identidade.cor_primaria);
  if (identidade.cor_acento) document.documentElement.style.setProperty('--cor-acento', identidade.cor_acento);
  document.title = curso.titulo;
  $('#titulo-curso').innerHTML = esc(curso.titulo) + (curso.subtitulo ? '<small>' + esc(curso.subtitulo) + '</small>' : '');
  var logo = $('#logo'); if (identidade.logo) { logo.src = identidade.logo; logo.alt = identidade.logo_alt || 'Logótipo'; } else logo.remove();
  var indice = $('#indice'), menuBtn = $('#btn-menu');
  menuBtn.addEventListener('click', function () { var ab = indice.classList.toggle('aberto'); menuBtn.setAttribute('aria-expanded', ab ? 'true' : 'false'); });

  function renderIndice() {
    indice.innerHTML = '';
    indice.appendChild(el('h2', { text: 'Conteúdo' }));
    var ol = el('ol');
    curso.modulos.forEach(function (m, mi) {
      var li = el('li', { class: 'modulo' }, [el('span', { text: (mi + 1) + '. ' + m.titulo })]);
      var sub = el('ol');
      m.paginas.forEach(function (p) {
        var feita = !!estado.visitadas[p.id] && p.blocos.filter(function (b) { return L.INTERATIVOS[b.tipo]; }).every(function (b) { return estado.concluidos[b.id]; });
        sub.appendChild(el('li', { class: 'pagina' + (feita ? ' feita' : '') }, [el('button', { type: 'button', text: p.titulo, 'aria-current': estado.pagina === p.id ? 'page' : null, onclick: function () { ir(p.id); } })]));
      });
      li.appendChild(sub); ol.appendChild(li);
    });
    var fin = L.estadoConclusao(curso, estado);
    ol.appendChild(el('li', { class: 'modulo' }, [el('span', { text: 'Fim' }), el('ol', {}, [el('li', { class: 'pagina final' + (fin === 'passed' || fin === 'completed' ? ' feita' : '') }, [el('button', { type: 'button', text: 'Conclusão e comprovativo', 'aria-current': estado.pagina === FINAL_ID ? 'page' : null, onclick: function () { ir(FINAL_ID); } })])])]));
    indice.appendChild(ol);
  }
  function renderProgresso() {
    var p = L.calcularProgresso(curso, estado);
    $('#pct').textContent = p.pct + '%';
    $('#barra').style.width = p.pct + '%';
    $('#barra').parentNode.setAttribute('aria-valuenow', p.pct);
  }

  /* ---------------- blocos ---------------- */
  function marcarConcluido(id) { if (!estado.concluidos[id]) { estado.concluidos[id] = true; guardar(false); renderIndice(); renderProgresso(); } }
  var R = {};
  R.titulo = function (b) { return el('h' + (b.nivel || 3), { class: 'bloco-titulo', text: b.texto }); };
  R.texto = function (b) { return el('div', { class: 'bloco', html: b.html }); };
  R.imagem = function (b) { return el('div', { class: 'bloco' }, [el('figure', {}, [el('img', { src: b.src, alt: b.alt || b.legenda || '', loading: 'lazy' }), b.legenda ? el('figcaption', { text: b.legenda }) : null])]); };
  R.video = function (b) {
    var wrap = el('div', { class: 'video-wrap' });
    if (b.youtube) wrap.appendChild(el('iframe', { src: 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(b.youtube) + '?rel=0&hl=pt-PT&cc_lang_pref=pt&cc_load_policy=1', title: b.legenda || 'Vídeo', allow: 'accelerometer; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true }));
    else wrap.appendChild(el('video', { src: b.src, controls: true, preload: 'metadata', poster: b.poster || null }));
    return el('div', { class: 'bloco' }, [wrap, b.legenda ? el('p', { class: 'instrucao', text: b.legenda }) : null]);
  };
  var ICONES = { info: 'ℹ️', atencao: '⚠️', perigo: '⛔', dica: '💡' };
  R.callout = function (b) { var est = b.estilo || 'info'; return el('div', { class: 'bloco' }, [el('div', { class: 'callout callout-' + est, role: est === 'perigo' ? 'alert' : null }, [el('span', { class: 'icone', 'aria-hidden': 'true', text: ICONES[est] || 'ℹ️' }), el('div', {}, [b.titulo ? el('p', { class: 'callout-titulo', text: b.titulo }) : null, el('div', { html: b.html })])])]); };
  R.acordeao = function (b) { return el('div', { class: 'bloco' }, [b.titulo ? el('h3', { text: b.titulo }) : null].concat(b.itens.map(function (it) { return el('details', { class: 'acordeao' }, [el('summary', { text: it.titulo }), el('div', { html: it.html })]); }))); };
  R.passos = function (b) { return el('div', { class: 'bloco' }, [b.titulo ? el('h3', { text: b.titulo }) : null, el('ol', { class: 'passos' }, b.itens.map(function (t) { return el('li', { html: t }); }))]); };
  R.colunas = function (b) { return el('div', { class: 'bloco' }, [el('div', { class: 'colunas' }, b.colunas.map(function (c) { return el('div', { html: c }); }))]); };
  R.tabela = function (b) { return el('div', { class: 'bloco' }, [b.titulo ? el('h3', { text: b.titulo }) : null, el('div', { style: 'overflow-x:auto' }, [el('table', {}, [el('thead', {}, [el('tr', {}, (b.cabecalho || []).map(function (h) { return el('th', { html: h }); }))]), el('tbody', {}, (b.linhas || []).map(function (l) { return el('tr', {}, l.map(function (c) { return el('td', { html: c }); })); }))])])]); };

  R.flashcards = function (b) {
    var i = 0, vistas = {}, wrap = el('div', { class: 'bloco flash' }), carta = el('button', { class: 'flash-carta', type: 'button', 'aria-label': 'Carta: clique para virar' }), frente = el('div', { class: 'flash-face flash-frente' }), verso = el('div', { class: 'flash-face flash-verso' }), pos = el('span'), ant = el('button', { class: 'btn btn-suave', type: 'button', text: '‹ Anterior' }), seg = el('button', { class: 'btn btn-suave', type: 'button', text: 'Seguinte ›' });
    function mostrar() { var c = b.cartas[i]; frente.innerHTML = c.frente; verso.innerHTML = c.verso; carta.classList.remove('virada'); pos.textContent = (i + 1) + ' / ' + b.cartas.length; ant.disabled = i === 0; seg.disabled = i === b.cartas.length - 1; }
    carta.addEventListener('click', function () { carta.classList.toggle('virada'); vistas[i] = true; if (Object.keys(vistas).length >= b.cartas.length) marcarConcluido(b.id); });
    ant.addEventListener('click', function () { i = Math.max(0, i - 1); mostrar(); });
    seg.addEventListener('click', function () { i = Math.min(b.cartas.length - 1, i + 1); mostrar(); });
    carta.appendChild(frente); carta.appendChild(verso);
    wrap.appendChild(el('h3', { text: b.titulo || 'Cartões de memória' })); wrap.appendChild(el('p', { class: 'instrucao', text: b.instrucao || 'Clique no cartão para o virar. Veja todos para concluir.' }));
    wrap.appendChild(carta); wrap.appendChild(el('div', { class: 'flash-controlo' }, [ant, pos, seg]));
    if (estado.concluidos[b.id]) { b.cartas.forEach(function (_, k) { vistas[k] = true; }); }
    mostrar(); return wrap;
  };
  R.checklist = function (b) {
    var feito = !!estado.concluidos[b.id];
    var ul = el('ul', { class: 'checklist' }, b.itens.map(function (t, k) { var cb = el('input', { type: 'checkbox', id: b.id + '-' + k, checked: feito || null }); cb.addEventListener('change', function () { if ([].every.call(ul.querySelectorAll('input'), function (x) { return x.checked; })) marcarConcluido(b.id); }); return el('li', {}, [cb, el('label', { for: b.id + '-' + k, html: t })]); }));
    return el('div', { class: 'bloco' }, [el('h3', { text: b.titulo || 'Lista de verificação' }), b.instrucao ? el('p', { class: 'instrucao', text: b.instrucao }) : null, ul]);
  };

  R.quiz = function (b) {
    var wrap = el('div', { class: 'bloco quiz' }), tentMax = b.tentativas == null ? 2 : Number(b.tentativas);
    var res = estado.resultados[b.id] || { submetido: false, tentativas: 0, pontos: 0, max: b.perguntas.length };
    var respostas = rascunhos[b.id] || (rascunhos[b.id] = {});
    wrap.appendChild(el('h3', { text: b.titulo || 'Verifique o que aprendeu' }));
    wrap.appendChild(el('p', { class: 'instrucao', text: (b.instrucao || 'Responda a todas as perguntas e carregue em "Verificar".') + (tentMax > 0 ? ' Tentativas: ' + tentMax + '.' : '') }));
    var lista = el('div'), acoes = el('div', { class: 'acoes' }), resultado = el('div', { 'aria-live': 'polite' });
    var esgotado = res.submetido && res.tentativas >= tentMax;
    function renderPerguntas(corrigido) {
      lista.innerHTML = '';
      b.perguntas.forEach(function (q, i) {
        var det = corrigido && corrigido.detalhe[i];
        var pq = el('div', { class: 'pergunta' + (det ? (det.correta ? ' certa' : ' errada') : '') + (esgotado ? ' revelada' : '') });
        pq.appendChild(el('p', { class: 'enunciado', text: (i + 1) + '. ' + q.enunciado }));
        var opcoes = q.tipo === 'vf' ? ['Verdadeiro', 'Falso'] : q.opcoes;
        opcoes.forEach(function (o, k) {
          var valor = q.tipo === 'vf' ? (k === 0) : k;
          var marcada = q.tipo === 'escolha_multipla' ? (respostas[i] || []).indexOf(k) >= 0 : respostas[i] === valor;
          var gabarito = q.tipo === 'vf' ? valor === q.correta : q.tipo === 'escolha_unica' ? k === q.correta : (q.correta || []).indexOf(k) >= 0;
          var inp = el('input', { type: q.tipo === 'escolha_multipla' ? 'checkbox' : 'radio', name: b.id + '-q' + i, checked: marcada || null, disabled: esgotado || null });
          inp.addEventListener('change', function () { if (q.tipo === 'escolha_multipla') { var arr = respostas[i] || []; respostas[i] = inp.checked ? arr.concat([k]) : arr.filter(function (x) { return x !== k; }); } else respostas[i] = valor; });
          pq.appendChild(el('label', { class: 'opcao' + (marcada ? ' marcada' : '') + (gabarito ? ' gabarito' : '') }, [inp, el('span', { html: o })]));
        });
        if (det) pq.appendChild(el('div', { class: 'feedback ' + (det.correta ? 'ok' : 'ko'), html: (det.correta ? '✔ Correcto. ' : det.respondida ? '✘ Incorrecto. ' : '— Sem resposta. ') + (q.explicacao ? esc(q.explicacao) : '') }));
        else if (esgotado && q.explicacao) pq.appendChild(el('div', { class: 'feedback ok', text: q.explicacao }));
        lista.appendChild(pq);
      });
    }
    var btnVerificar = el('button', { class: 'btn btn-primario', type: 'button', text: 'Verificar' }), btnRepetir = el('button', { class: 'btn btn-secundario', type: 'button', text: 'Tentar de novo' });
    function mostrarResultado(r) {
      var ok = r.pct >= Number(curso.nota_minima || 0);
      resultado.innerHTML = '';
      resultado.appendChild(el('div', { class: 'resultado ' + (ok ? 'ok' : 'ko') }, [el('strong', { text: r.pct + '%' }), el('span', { text: r.pontos + ' de ' + r.max + ' certas · tentativa ' + res.tentativas + (tentMax ? ' de ' + tentMax : '') }), el('span', { text: ok ? 'Aprovado neste bloco.' : esgotado ? 'Sem mais tentativas — veja as respostas correctas.' : 'Reveja a matéria e tente de novo.' })]));
    }
    btnVerificar.addEventListener('click', async function () {
      var faltam = b.perguntas.filter(function (q, i) { var r = respostas[i]; return r === undefined || (Array.isArray(r) && !r.length); }).length;
      if (faltam && !(await ucConfirmar('Há ' + faltam + ' pergunta(s) sem resposta. Quer verificar mesmo assim? As perguntas em branco contam como erradas.', { titulo: 'Perguntas por responder', confirmar: 'Verificar mesmo assim', cancelar: 'Voltar às perguntas', focoNo: 'cancelar' }))) return;
      var r = L.corrigirQuiz(b, respostas);
      res = { submetido: true, tentativas: (res.tentativas || 0) + 1, pontos: r.pontos, max: r.max };
      estado.resultados[b.id] = res; esgotado = res.tentativas >= tentMax;
      marcarConcluido(b.id); renderPerguntas(r); mostrarResultado(r);
      btnVerificar.disabled = true; btnRepetir.hidden = esgotado || r.pct >= 100;
      guardar(true); renderIndice();
    });
    btnRepetir.addEventListener('click', function () { rascunhos[b.id] = respostas = {}; resultado.innerHTML = ''; renderPerguntas(null); btnVerificar.disabled = false; btnRepetir.hidden = true; });
    btnRepetir.hidden = !(res.submetido && !esgotado && res.pontos < res.max);
    btnVerificar.disabled = res.submetido && (esgotado || res.pontos >= res.max);
    renderPerguntas(null);
    if (res.submetido) mostrarResultado({ pct: res.max ? Math.round((res.pontos / res.max) * 100) : 0, pontos: res.pontos, max: res.max });
    acoes.appendChild(btnVerificar); acoes.appendChild(btnRepetir);
    wrap.appendChild(lista); wrap.appendChild(acoes); wrap.appendChild(resultado);
    return wrap;
  };

  // arrastar: HTML5 drag-and-drop + alternativa por clique (toque/teclado): seleccionar item, depois a zona
  R.arrastar = function (b) {
    var colocacao = {}, selecionado = null, wrap = el('div', { class: 'bloco arrastar' });
    wrap.appendChild(el('h3', { text: b.titulo || 'Arraste cada item para a categoria certa' }));
    wrap.appendChild(el('p', { class: 'instrucao', text: b.instrucao || 'Arraste os itens (ou toque num item e depois na categoria). Depois carregue em "Verificar".' }));
    var pool = el('div', { class: 'pool', 'aria-label': 'Itens por classificar' }), zonas = el('div', { class: 'zonas' }), resultado = el('div', { 'aria-live': 'polite' });
    var itensEl = b.itens.map(function (it, i) {
      var n = el('button', { class: 'item', type: 'button', draggable: 'true', text: it.texto, 'data-i': i });
      n.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; });
      n.addEventListener('click', function () { if (selecionado === n) { selecionado.classList.remove('selecionado'); selecionado = null; } else { if (selecionado) selecionado.classList.remove('selecionado'); selecionado = n; n.classList.add('selecionado'); } });
      return n;
    });
    function largarEm(destino, cat) {
      return function (e) {
        e.preventDefault(); destino.classList.remove('sobre');
        var i = e.dataTransfer ? e.dataTransfer.getData('text/plain') : null;
        var n = i !== null && i !== '' ? itensEl[Number(i)] : selecionado;
        if (!n) return;
        destino.appendChild(n); n.classList.remove('selecionado', 'certo', 'errado'); selecionado = null;
        if (cat) colocacao[n.getAttribute('data-i')] = cat; else delete colocacao[n.getAttribute('data-i')];
      };
    }
    function zonaDrop(z, cat) { z.addEventListener('dragover', function (e) { e.preventDefault(); z.classList.add('sobre'); }); z.addEventListener('dragleave', function () { z.classList.remove('sobre'); }); z.addEventListener('drop', largarEm(z, cat)); z.addEventListener('click', function (e) { if (selecionado && e.target === z) largarEm(z, cat)(e); }); }
    zonaDrop(pool, null);
    b.categorias.forEach(function (cat) { var z = el('div', { class: 'zona', 'data-cat': cat, role: 'group', 'aria-label': cat }); z.appendChild(el('p', { class: 'zona-titulo', text: cat })); zonaDrop(z, cat); zonas.appendChild(z); });
    itensEl.forEach(function (n) { pool.appendChild(n); });
    var btn = el('button', { class: 'btn btn-primario', type: 'button', text: 'Verificar' }), repor = el('button', { class: 'btn btn-suave', type: 'button', text: 'Repor' });
    btn.addEventListener('click', function () {
      var r = L.corrigirArrastar(b, colocacao);
      itensEl.forEach(function (n, i) { n.classList.toggle('certo', r.detalhe[i].correta); n.classList.toggle('errado', !r.detalhe[i].correta); });
      resultado.innerHTML = ''; resultado.appendChild(el('div', { class: 'resultado ' + (r.pct === 100 ? 'ok' : 'ko') }, [el('strong', { text: r.pontos + '/' + r.max }), el('span', { text: r.pct === 100 ? 'Tudo certo!' : 'Os itens a vermelho estão na categoria errada — mova-os e verifique de novo.' })]));
      if (r.pct === 100) marcarConcluido(b.id);
    });
    repor.addEventListener('click', function () { colocacao = {}; itensEl.forEach(function (n) { n.classList.remove('certo', 'errado'); pool.appendChild(n); }); resultado.innerHTML = ''; });
    wrap.appendChild(pool); wrap.appendChild(zonas); wrap.appendChild(el('div', { class: 'acoes' }, [btn, repor])); wrap.appendChild(resultado);
    if (estado.concluidos[b.id]) resultado.appendChild(el('div', { class: 'resultado ok' }, [el('span', { text: 'Já concluído — pode repetir para praticar.' })]));
    return wrap;
  };

  R.ordenar = function (b) {
    var ordem = b.itens.map(function (_, i) { return i; }).sort(function () { return Math.random() - 0.5; });
    if (ordem.every(function (v, k) { return v === k; }) && ordem.length > 1) ordem.reverse();
    var wrap = el('div', { class: 'bloco ordenar' }), lista = el('ol'), resultado = el('div', { 'aria-live': 'polite' });
    wrap.appendChild(el('h3', { text: b.titulo || 'Coloque pela ordem correcta' }));
    wrap.appendChild(el('p', { class: 'instrucao', text: b.instrucao || 'Use as setas para mover cada item (ou arraste). Depois carregue em "Verificar".' }));
    function render(det) {
      lista.innerHTML = '';
      ordem.forEach(function (idx, pos) {
        var li = el('li', { draggable: 'true', 'data-pos': pos, class: det ? (det[pos].correta ? 'certo' : 'errado') : '' }, [el('span', { html: b.itens[idx] }), el('button', { type: 'button', 'aria-label': 'Subir', text: '▲', disabled: pos === 0 || null, onclick: function () { mover(pos, pos - 1); } }), el('button', { type: 'button', 'aria-label': 'Descer', text: '▼', disabled: pos === ordem.length - 1 || null, onclick: function () { mover(pos, pos + 1); } })]);
        li.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', String(pos)); });
        li.addEventListener('dragover', function (e) { e.preventDefault(); });
        li.addEventListener('drop', function (e) { e.preventDefault(); var de = Number(e.dataTransfer.getData('text/plain')); if (!Number.isNaN(de)) mover(de, pos); });
        lista.appendChild(li);
      });
    }
    function mover(de, para) { var v = ordem.splice(de, 1)[0]; ordem.splice(para, 0, v); resultado.innerHTML = ''; render(null); }
    var btn = el('button', { class: 'btn btn-primario', type: 'button', text: 'Verificar' });
    btn.addEventListener('click', function () { var r = L.corrigirOrdenar(b, ordem); render(r.detalhe); resultado.innerHTML = ''; resultado.appendChild(el('div', { class: 'resultado ' + (r.pct === 100 ? 'ok' : 'ko') }, [el('strong', { text: r.pontos + '/' + r.max }), el('span', { text: r.pct === 100 ? 'Ordem correcta!' : 'Os passos a vermelho estão fora do sítio.' })])); if (r.pct === 100) marcarConcluido(b.id); });
    render(null); wrap.appendChild(lista); wrap.appendChild(el('div', { class: 'acoes' }, [btn])); wrap.appendChild(resultado);
    return wrap;
  };

  /* ---------------- páginas ---------------- */
  var main = $('#conteudo');
  function ir(id) {
    estado.pagina = id; indice.classList.remove('aberto'); menuBtn.setAttribute('aria-expanded', 'false');
    main.innerHTML = '';
    if (id === FINAL_ID) { renderFinal(); }
    else {
      var idx = paginas.findIndex(function (p) { return p.id === id; }); if (idx < 0) idx = 0;
      var p = paginas[idx];
      estado.visitadas[p.id] = true;
      main.appendChild(el('header', { class: 'pagina-cab' }, [el('p', { class: 'eyebrow', text: 'Módulo ' + (curso.modulos.indexOf(p.modulo) + 1) + ' · ' + p.modulo.titulo }), el('h2', { text: p.titulo })]));
      p.blocos.forEach(function (b) { var r = R[b.tipo]; if (r) main.appendChild(r(b)); });
      var ant = idx > 0 ? paginas[idx - 1] : null, seg = idx < paginas.length - 1 ? paginas[idx + 1] : null;
      main.appendChild(el('nav', { class: 'nav-pagina', 'aria-label': 'Navegação entre páginas' }, [
        el('button', { class: 'btn btn-suave', type: 'button', text: '‹ Anterior', disabled: !ant || null, onclick: function () { if (ant) ir(ant.id); } }),
        seg ? el('button', { class: 'btn btn-primario', type: 'button', text: 'Seguinte ›', onclick: function () { ir(seg.id); } }) : el('button', { class: 'btn btn-primario', type: 'button', text: 'Concluir ›', onclick: function () { ir(FINAL_ID); } }),
      ]));
    }
    guardar(false); renderIndice(); renderProgresso();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    var h = $('h2', main); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  var LABEL = { passed: 'Aprovado', completed: 'Concluído', failed: 'Não aprovado', incomplete: 'Em curso' };
  function renderFinal() {
    var conc = L.estadoConclusao(curso, estado), nota = L.notaGlobal(curso, estado), prog = L.calcularProgresso(curso, estado);
    var faltam = paginas.filter(function (p) { return !estado.visitadas[p.id]; });
    var pendentes = L.blocosInterativos(curso).filter(function (b) { return !estado.concluidos[b.id]; });
    main.appendChild(el('header', { class: 'pagina-cab' }, [el('p', { class: 'eyebrow', text: 'Fim do curso' }), el('h2', { text: 'Conclusão' })]));
    var resumo = el('div', { class: 'bloco' }, [
      el('p', {}, [el('span', { class: 'estado-pill estado-' + conc, text: LABEL[conc] })]),
      el('div', { class: 'final-resumo' }, [
        el('div', {}, [el('b', { text: prog.pct + '%' }), el('small', { text: 'progresso' })]),
        el('div', {}, [el('b', { text: prog.visitadas + '/' + prog.paginas }), el('small', { text: 'páginas vistas' })]),
        el('div', {}, [el('b', { text: prog.feitos + '/' + prog.interativos }), el('small', { text: 'actividades concluídas' })]),
        nota.quizzes ? el('div', {}, [el('b', { text: nota.pct == null ? '—' : nota.pct + '%' }), el('small', { text: 'nota (mínimo ' + curso.nota_minima + '%)' })]) : null,
      ]),
    ]);
    if (conc === 'incomplete') {
      var lista = el('ul');
      faltam.forEach(function (p) { lista.appendChild(el('li', {}, [el('a', { href: '#', text: 'Ver a página "' + p.titulo + '"', onclick: function (e) { e.preventDefault(); ir(p.id); } })])); });
      pendentes.forEach(function (b) { var pg = paginas.find(function (p) { return p.blocos.indexOf(b) >= 0; }); lista.appendChild(el('li', {}, [el('a', { href: '#', text: 'Concluir a actividade "' + (b.titulo || b.tipo) + '" em "' + (pg ? pg.titulo : '') + '"', onclick: function (e) { e.preventDefault(); ir(pg.id); } })])); });
      if (nota.quizzes && nota.pct != null && nota.pct < curso.nota_minima && !nota.pendentes) lista.appendChild(el('li', { text: 'Nota abaixo do mínimo — repita as avaliações onde ainda tem tentativas.' }));
      resumo.appendChild(el('div', { class: 'callout callout-atencao' }, [el('span', { class: 'icone', 'aria-hidden': 'true', text: '⚠️' }), el('div', {}, [el('p', { class: 'callout-titulo', text: 'Ainda falta:' }), lista])]));
    } else if (conc === 'failed') {
      resumo.appendChild(el('div', { class: 'callout callout-perigo' }, [el('span', { class: 'icone', 'aria-hidden': 'true', text: '⛔' }), el('div', {}, [el('p', { class: 'callout-titulo', text: 'Não atingiu a nota mínima nas tentativas disponíveis.' }), el('p', { text: 'Fale com o instrutor para reabrir o curso ou reveja a matéria e reinicie o curso.' })])]));
    } else {
      resumo.appendChild(el('div', { class: 'callout callout-dica' }, [el('span', { class: 'icone', 'aria-hidden': 'true', text: '🎉' }), el('div', {}, [el('p', { class: 'callout-titulo', text: 'Parabéns, concluiu o curso!' }), el('p', { text: scorm.versao ? 'A conclusão foi comunicada à Universidade Corporativa; o certificado oficial é emitido lá.' : 'Pode imprimir o comprovativo abaixo.' })])]));
    }
    main.appendChild(resumo);
    if ((conc === 'passed' || conc === 'completed') && (!curso.certificado || curso.certificado.ativo !== false)) {
      var nomeInp = el('input', { type: 'text', value: estado.nome || '', placeholder: 'O seu nome, como deve aparecer', 'aria-label': 'Nome para o comprovativo' });
      nomeInp.addEventListener('input', function () { estado.nome = nomeInp.value; cpNome.textContent = estado.nome || '________________'; guardar(false); });
      var cpNome = el('p', { class: 'cp-nome', text: estado.nome || '________________' });
      var cp = el('div', { class: 'comprovativo' }, [identidade.logo ? el('img', { src: identidade.logo, alt: '' }) : null, el('p', { class: 'cp-titulo', text: 'COMPROVATIVO' }), el('p', { text: 'Certifica-se que' }), cpNome, el('p', { text: 'concluiu com aproveitamento o curso' }), el('p', { class: 'cp-curso', text: curso.titulo }), el('p', { text: (curso.duracao_min ? 'Duração de referência: ' + Math.ceil(curso.duracao_min / 60) + ' h · ' : '') + (nota.pct != null ? 'Nota: ' + nota.pct + '% · ' : '') + 'Data: ' + new Date().toLocaleDateString('pt-PT') }), el('p', { class: 'cp-nota', text: (curso.certificado && curso.certificado.texto) || (curso.autor ? curso.autor + ' — ' : '') + 'Comprovativo gerado pelo próprio curso; o certificado oficial é emitido pela Universidade Corporativa.' })]);
      main.appendChild(el('div', { class: 'bloco' }, [el('h3', { text: 'Comprovativo' }), el('div', { class: 'campo-nome' }, [el('label', { text: 'Nome:' }), nomeInp, el('button', { class: 'btn btn-primario', type: 'button', text: 'Imprimir / guardar PDF', onclick: function () { window.print(); } })]), cp]));
    }
    main.appendChild(el('div', { class: 'acoes nao-imprimir' }, [el('button', { class: 'btn btn-suave', type: 'button', text: '‹ Voltar ao início', onclick: function () { ir(paginas[0].id); } }), el('button', { class: 'btn btn-suave', type: 'button', text: 'Reiniciar o curso', onclick: async function () { if (await ucConfirmar('Apagar o progresso e recomeçar o curso do início?', { titulo: 'Reiniciar o curso', confirmar: 'Apagar e recomeçar', cancelar: 'Manter o progresso', perigo: true, focoNo: 'cancelar' })) { estado = { visitadas: {}, concluidos: {}, resultados: {}, pagina: null, nome: estado.nome }; rascunhos = {}; guardar(true); ir(paginas[0].id); } } })]));
  }

  /* ---------------- arranque ---------------- */
  carregarEstado();
  var inicial = estado.pagina && (estado.pagina === FINAL_ID || paginas.some(function (p) { return p.id === estado.pagina; })) ? estado.pagina : paginas[0].id;
  ir(inicial);
})();
