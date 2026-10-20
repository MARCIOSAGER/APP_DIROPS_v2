// Runtime SCORM 1.2 (window.API) e SCORM 2004 (window.API_1484_11) para pacotes HTML5 em iframe.
// Sem React: guarda o modelo de dados (cmi.*) num mapa plano e avisa o exterior por callbacks:
//   onGuardar(snapshot, evento)  — em Commit / Finish / conclusão (o chamador decide quando persistir)
//   onConcluir(snapshot)         — uma vez, quando o pacote reporta completed / passed
const ESTADOS_12 = ['passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted'];
const COMPLETION_2004 = ['completed', 'incomplete', 'not attempted', 'unknown'];
const SUCCESS_2004 = ['passed', 'failed', 'unknown'];
const EXIT_12 = ['time-out', 'suspend', 'logout', ''];
const EXIT_2004 = ['time-out', 'suspend', 'logout', 'normal', ''];

const ERROS_12 = { 0: 'No error', 101: 'General exception', 201: 'Invalid argument error', 202: 'Element cannot have children', 203: 'Element not an array - cannot have count', 301: 'Not initialized', 401: 'Not implemented error', 402: 'Invalid set value, element is a keyword', 403: 'Element is read only', 404: 'Element is write only', 405: 'Incorrect data type' };
const ERROS_2004 = { 0: 'No error', 101: 'General exception', 102: 'General initialization failure', 103: 'Already initialized', 104: 'Content instance terminated', 111: 'General termination failure', 112: 'Termination before initialization', 113: 'Termination after termination', 122: 'Retrieve data before initialization', 123: 'Retrieve data after termination', 132: 'Store data before initialization', 133: 'Store data after termination', 142: 'Commit before initialization', 143: 'Commit after termination', 201: 'General argument error', 301: 'General get failure', 351: 'General set failure', 391: 'General commit failure', 401: 'Undefined data model element', 402: 'Unimplemented data model element', 403: 'Data model element value not initialized', 404: 'Data model element is read only', 405: 'Data model element is write only', 406: 'Data model element type mismatch', 407: 'Data model element value out of range', 408: 'Data model dependency not established' };

const pad = (n, w) => String(Math.floor(n)).padStart(w, '0');
// SCORM 1.2: HHHH:MM:SS.SS
export function segundosParaTempo12(s) { const n = Math.max(0, Math.round(Number(s) || 0)); return `${pad(n / 3600, 4)}:${pad((n % 3600) / 60, 2)}:${pad(n % 60, 2)}.00`; }
export function tempo12ParaSegundos(v) { const m = String(v || '').trim().match(/^(\d{2,4}):(\d{2}):(\d{2})(?:\.(\d{1,2}))?$/); if (!m) return null; return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + (m[4] ? Number(`0.${m[4]}`) : 0); }
// SCORM 2004 / xAPI: ISO 8601 duration (PT1H2M3.5S; aceita P#DT…)
export function segundosParaIso8601(s) { const n = Math.max(0, Math.round(Number(s) || 0)); return `PT${Math.floor(n / 3600)}H${Math.floor((n % 3600) / 60)}M${n % 60}S`; }
export function iso8601ParaSegundos(v) {
  const m = String(v || '').trim().match(/^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!m) return null;
  const [, y, mo, w, d, h, mi, s] = m.map(x => (x == null ? 0 : Number(x)));
  return y * 31536000 + mo * 2592000 + w * 604800 + d * 86400 + h * 3600 + mi * 60 + s;
}

// estado unificado (tabela scorm_estado) a partir do modelo 2004
function estadoDe2004(completion, success) {
  if (success === 'passed') return 'passed';
  if (success === 'failed') return 'failed';
  if (completion === 'completed') return 'completed';
  if (completion === 'incomplete') return 'incomplete';
  return 'not attempted';
}
export const concluidoScorm = (estado) => estado === 'completed' || estado === 'passed';

export function criarScormRuntime({ norma = 'scorm12', aluno = {}, inicial = {}, onGuardar, onConcluir, agora = () => Date.now() } = {}) {
  const dados = { ...((inicial && inicial.dados) || {}) };
  let estado = (inicial && inicial.estado) || 'not attempted';
  let nota = inicial && inicial.nota != null ? Number(inicial.nota) : null;
  let sucesso = inicial && typeof inicial.sucesso === 'boolean' ? inicial.sucesso : null;
  let totalS = Number((inicial && inicial.tempo_s) || 0) || 0;
  let sessaoS = null;      // reportado pelo pacote (session_time); se nunca for, medimos o relógio
  let inicioEm = null;
  let inicializado = false, terminado = false, concluiuAvisado = concluidoScorm(estado);
  let erro = 0, diag = '';
  const setErro = (c, d = '') => { erro = c; diag = d; };
  const sessaoAtual = () => (sessaoS != null ? sessaoS : inicioEm != null ? Math.round((agora() - inicioEm) / 1000) : 0);

  const snapshot = () => ({ norma, estado, nota, sucesso, tempo_s: totalS + sessaoAtual(), dados: { ...dados }, concluido: concluidoScorm(estado) });
  const guardar = (evento) => { try { onGuardar && onGuardar(snapshot(), evento); } catch { /* nunca rebentar o pacote */ } };
  const verificarConclusao = () => { if (!concluiuAvisado && concluidoScorm(estado)) { concluiuAvisado = true; guardar('conclusao'); try { onConcluir && onConcluir(snapshot()); } catch { /* */ } } };
  const contar = (prefixo) => { let max = -1; for (const k of Object.keys(dados)) { const m = k.startsWith(prefixo) && k.slice(prefixo.length).match(/^(\d+)\./); if (m) max = Math.max(max, Number(m[1])); } return String(max + 1); };
  const entry = () => (dados['cmi.suspend_data'] || dados['cmi.core.lesson_location'] || dados['cmi.location'] || totalS > 0 ? 'resume' : 'ab-initio');
  const terminar = () => { if (!inicializado) return; totalS += sessaoAtual(); sessaoS = null; inicioEm = null; inicializado = false; terminado = true; };
  const iniciar = () => { inicializado = true; terminado = false; inicioEm = agora(); sessaoS = null; dados['cmi.core.entry'] = entry(); dados['cmi.entry'] = dados['cmi.core.entry']; };

  // ---------------- SCORM 1.2 ----------------
  const api12 = {
    LMSInitialize() { if (inicializado) { setErro(101, 'Already initialized'); return 'false'; } iniciar(); setErro(0); return 'true'; },
    LMSFinish() { if (!inicializado) { setErro(301); return 'false'; } terminar(); setErro(0); guardar('finish'); verificarConclusao(); return 'true'; },
    LMSCommit() { if (!inicializado) { setErro(301); return 'false'; } setErro(0); guardar('commit'); verificarConclusao(); return 'true'; },
    LMSGetLastError() { return String(erro); },
    LMSGetErrorString(c) { return ERROS_12[Number(c)] || ''; },
    LMSGetDiagnostic() { return diag || ''; },
    LMSGetValue(el) {
      if (!inicializado) { setErro(301); return ''; }
      setErro(0);
      switch (el) {
        case 'cmi.core._children': return 'student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time';
        case 'cmi.core.student_id': return String(aluno.id || '');
        case 'cmi.core.student_name': return String(aluno.nome || '');
        case 'cmi.core.lesson_status': return estado === 'unknown' ? 'not attempted' : estado;
        case 'cmi.core.lesson_location': return dados[el] || '';
        case 'cmi.core.credit': return 'credit';
        case 'cmi.core.lesson_mode': return 'normal';
        case 'cmi.core.entry': return dados[el] || entry();
        case 'cmi.core.score._children': return 'raw,min,max';
        case 'cmi.core.score.raw': return dados[el] != null ? String(dados[el]) : (nota != null ? String(nota) : '');
        case 'cmi.core.score.min': case 'cmi.core.score.max': return dados[el] != null ? String(dados[el]) : '';
        case 'cmi.core.total_time': return segundosParaTempo12(totalS);
        case 'cmi.core.exit': case 'cmi.core.session_time': setErro(404); return '';
        case 'cmi.suspend_data': case 'cmi.comments': return dados[el] || '';
        case 'cmi.launch_data': case 'cmi.comments_from_lms': return dados[el] || '';
        case 'cmi.student_data._children': return 'mastery_score,max_time_allowed,time_limit_action';
        case 'cmi.student_data.mastery_score': case 'cmi.student_data.max_time_allowed': case 'cmi.student_data.time_limit_action': return dados[el] || '';
        case 'cmi.student_preference._children': return 'audio,language,speed,text';
        case 'cmi.student_preference.audio': case 'cmi.student_preference.language': case 'cmi.student_preference.speed': case 'cmi.student_preference.text': return dados[el] || '';
        case 'cmi.interactions._children': return 'id,objectives,time,type,correct_responses,weighting,student_response,result,latency';
        case 'cmi.interactions._count': return contar('cmi.interactions.');
        case 'cmi.objectives._children': return 'id,score,status';
        case 'cmi.objectives._count': return contar('cmi.objectives.');
        default:
          if (/^cmi\.(interactions|objectives)\.\d+\./.test(el)) { const m = el.match(/^(cmi\.(?:interactions|objectives)\.\d+\.(?:objectives|correct_responses)\.)_count$/); if (m) return contar(m[1]); return dados[el] != null ? String(dados[el]) : ''; }
          setErro(401, `Elemento desconhecido: ${el}`); return '';
      }
    },
    LMSSetValue(el, valor) {
      if (!inicializado) { setErro(301); return 'false'; }
      const v = valor == null ? '' : String(valor);
      setErro(0);
      switch (el) {
        case 'cmi.core.lesson_status': if (!ESTADOS_12.includes(v)) { setErro(405, `lesson_status inválido: ${v}`); return 'false'; } estado = v; dados[el] = v; if (v === 'passed') sucesso = true; if (v === 'failed') sucesso = false; verificarConclusao(); return 'true';
        case 'cmi.core.score.raw': { const n = Number(v); if (v !== '' && !Number.isFinite(n)) { setErro(405); return 'false'; } dados[el] = v; if (v !== '') { const max = Number(dados['cmi.core.score.max']); nota = Number.isFinite(max) && max > 0 && max !== 100 ? Math.round((n / max) * 1000) / 10 : Math.round(n * 10) / 10; } return 'true'; }
        case 'cmi.core.score.min': case 'cmi.core.score.max': if (v !== '' && !Number.isFinite(Number(v))) { setErro(405); return 'false'; } dados[el] = v; return 'true';
        case 'cmi.core.session_time': { const s = tempo12ParaSegundos(v); if (s == null) { setErro(405, `session_time inválido: ${v}`); return 'false'; } sessaoS = s; return 'true'; }
        case 'cmi.core.exit': if (!EXIT_12.includes(v)) { setErro(405); return 'false'; } dados[el] = v; return 'true';
        case 'cmi.core.lesson_location': case 'cmi.suspend_data': case 'cmi.student_preference.audio': case 'cmi.student_preference.language': case 'cmi.student_preference.speed': case 'cmi.student_preference.text': dados[el] = v; return 'true';
        case 'cmi.comments': dados[el] = (dados[el] || '') + v; return 'true';
        case 'cmi.core.student_id': case 'cmi.core.student_name': case 'cmi.core.credit': case 'cmi.core.entry': case 'cmi.core.total_time': case 'cmi.core.lesson_mode': case 'cmi.launch_data': case 'cmi.comments_from_lms': case 'cmi.student_data.mastery_score': case 'cmi.student_data.max_time_allowed': case 'cmi.student_data.time_limit_action': setErro(403, `${el} é só de leitura`); return 'false';
        default:
          if (/^cmi\.(interactions|objectives)\.\d+\./.test(el)) { dados[el] = v; return 'true'; }
          if (/_children$|_count$/.test(el)) { setErro(402); return 'false'; }
          setErro(401, `Elemento desconhecido: ${el}`); return 'false';
      }
    },
  };

  // ---------------- SCORM 2004 (4th ed.) ----------------
  const completion = () => dados['cmi.completion_status'] || (estado === 'completed' || estado === 'passed' || estado === 'failed' ? 'completed' : estado === 'incomplete' ? 'incomplete' : estado === 'not attempted' ? 'not attempted' : 'unknown');
  const success = () => dados['cmi.success_status'] || (sucesso === true ? 'passed' : sucesso === false ? 'failed' : 'unknown');
  const api2004 = {
    Initialize() { if (inicializado) { setErro(103); return 'false'; } if (terminado) { setErro(104); return 'false'; } iniciar(); setErro(0); return 'true'; },
    Terminate() { if (!inicializado) { setErro(terminado ? 113 : 112); return 'false'; } terminar(); setErro(0); guardar('finish'); verificarConclusao(); return 'true'; },
    Commit() { if (!inicializado) { setErro(terminado ? 143 : 142); return 'false'; } setErro(0); guardar('commit'); verificarConclusao(); return 'true'; },
    GetLastError() { return String(erro); },
    GetErrorString(c) { return ERROS_2004[Number(c)] || ''; },
    GetDiagnostic() { return diag || ''; },
    GetValue(el) {
      if (!inicializado) { setErro(terminado ? 123 : 122); return ''; }
      setErro(0);
      switch (el) {
        case 'cmi._version': return '1.0';
        case 'cmi.learner_id': return String(aluno.id || '');
        case 'cmi.learner_name': return String(aluno.nome || '');
        case 'cmi.completion_status': return completion();
        case 'cmi.success_status': return success();
        case 'cmi.score._children': return 'scaled,raw,min,max';
        case 'cmi.score.scaled': case 'cmi.score.raw': case 'cmi.score.min': case 'cmi.score.max': if (dados[el] == null) { if (el === 'cmi.score.scaled' && nota != null) return String(Math.round(nota) / 100); setErro(403); return ''; } return String(dados[el]);
        case 'cmi.location': case 'cmi.suspend_data': return dados[el] || '';
        case 'cmi.entry': return dados[el] || entry();
        case 'cmi.mode': return 'normal';
        case 'cmi.credit': return 'credit';
        case 'cmi.total_time': return segundosParaIso8601(totalS);
        case 'cmi.launch_data': return dados[el] || '';
        case 'cmi.completion_threshold': case 'cmi.scaled_passing_score': case 'cmi.max_time_allowed': case 'cmi.time_limit_action': if (dados[el] == null) { setErro(403); return ''; } return String(dados[el]);
        case 'cmi.progress_measure': if (dados[el] == null) { setErro(403); return ''; } return String(dados[el]);
        case 'cmi.exit': case 'cmi.session_time': setErro(405); return '';
        case 'cmi.learner_preference._children': return 'audio_level,language,delivery_speed,audio_captioning';
        case 'cmi.learner_preference.audio_level': return dados[el] || '1';
        case 'cmi.learner_preference.language': return dados[el] || '';
        case 'cmi.learner_preference.delivery_speed': return dados[el] || '1';
        case 'cmi.learner_preference.audio_captioning': return dados[el] || '0';
        case 'cmi.interactions._children': return 'id,type,objectives,timestamp,correct_responses,weighting,learner_response,result,latency,description';
        case 'cmi.interactions._count': return contar('cmi.interactions.');
        case 'cmi.objectives._children': return 'id,score,success_status,completion_status,progress_measure,description';
        case 'cmi.objectives._count': return contar('cmi.objectives.');
        case 'cmi.comments_from_learner._children': return 'comment,location,timestamp';
        case 'cmi.comments_from_learner._count': return contar('cmi.comments_from_learner.');
        case 'cmi.comments_from_lms._children': return 'comment,location,timestamp';
        case 'cmi.comments_from_lms._count': return '0';
        case 'adl.nav.request': return dados[el] || '_none_';
        default:
          if (/^adl\.nav\.request_valid\./.test(el)) return 'unknown';
          if (/^cmi\.(interactions|objectives|comments_from_learner)\.\d+\./.test(el)) { const m = el.match(/^(cmi\.interactions\.\d+\.(?:objectives|correct_responses)\.)_count$/); if (m) return contar(m[1]); if (dados[el] == null) { setErro(403); return ''; } return String(dados[el]); }
          setErro(401, `Elemento desconhecido: ${el}`); return '';
      }
    },
    SetValue(el, valor) {
      if (!inicializado) { setErro(terminado ? 133 : 132); return 'false'; }
      const v = valor == null ? '' : String(valor);
      setErro(0);
      const num = (min, max) => { const n = Number(v); if (!Number.isFinite(n)) { setErro(406); return null; } if ((min != null && n < min) || (max != null && n > max)) { setErro(407); return null; } return n; };
      switch (el) {
        case 'cmi.completion_status': if (!COMPLETION_2004.includes(v)) { setErro(406); return 'false'; } dados[el] = v; estado = estadoDe2004(v, success()); verificarConclusao(); return 'true';
        case 'cmi.success_status': if (!SUCCESS_2004.includes(v)) { setErro(406); return 'false'; } dados[el] = v; sucesso = v === 'passed' ? true : v === 'failed' ? false : null; estado = estadoDe2004(completion(), v); verificarConclusao(); return 'true';
        case 'cmi.score.scaled': { const n = num(-1, 1); if (n == null) return 'false'; dados[el] = v; nota = Math.round(n * 1000) / 10; return 'true'; }
        case 'cmi.score.raw': { const n = num(); if (n == null) return 'false'; dados[el] = v; if (dados['cmi.score.scaled'] == null) { const max = Number(dados['cmi.score.max']); nota = Number.isFinite(max) && max > 0 ? Math.round((n / max) * 1000) / 10 : Math.round(n * 10) / 10; } return 'true'; }
        case 'cmi.score.min': case 'cmi.score.max': if (num() == null) return 'false'; dados[el] = v; return 'true';
        case 'cmi.progress_measure': if (num(0, 1) == null) return 'false'; dados[el] = v; return 'true';
        case 'cmi.session_time': { const s = iso8601ParaSegundos(v); if (s == null) { setErro(406, `session_time inválido: ${v}`); return 'false'; } sessaoS = s; return 'true'; }
        case 'cmi.exit': if (!EXIT_2004.includes(v)) { setErro(406); return 'false'; } dados[el] = v; return 'true';
        case 'cmi.location': case 'cmi.suspend_data': case 'adl.nav.request': case 'cmi.learner_preference.audio_level': case 'cmi.learner_preference.language': case 'cmi.learner_preference.delivery_speed': case 'cmi.learner_preference.audio_captioning': dados[el] = v; return 'true';
        case 'cmi._version': case 'cmi.learner_id': case 'cmi.learner_name': case 'cmi.entry': case 'cmi.mode': case 'cmi.credit': case 'cmi.total_time': case 'cmi.launch_data': case 'cmi.completion_threshold': case 'cmi.scaled_passing_score': case 'cmi.max_time_allowed': case 'cmi.time_limit_action': setErro(404, `${el} é só de leitura`); return 'false';
        default:
          if (/^cmi\.(interactions|objectives|comments_from_learner)\.\d+\./.test(el)) { dados[el] = v; return 'true'; }
          if (/_children$|_count$/.test(el)) { setErro(404); return 'false'; }
          setErro(401, `Elemento desconhecido: ${el}`); return 'false';
      }
    },
  };

  return {
    api12, api2004, snapshot,
    // chamado pelo exterior ao desmontar: fecha a sessão se o pacote não chamou Finish/Terminate
    fechar() { if (inicializado) { terminar(); guardar('unload'); } },
    get inicializado() { return inicializado; },
  };
}

// Expõe as APIs na janela mãe (o pacote procura window.parent.API / API_1484_11). Devolve função para remover.
export function instalarScormApi(win, runtime) {
  if (!win) return () => {};
  const antes = { API: win.API, API_1484_11: win.API_1484_11 };
  win.API = runtime.api12;
  win.API_1484_11 = runtime.api2004;
  return () => { if (win.API === runtime.api12) { if (antes.API) win.API = antes.API; else delete win.API; } if (win.API_1484_11 === runtime.api2004) { if (antes.API_1484_11) win.API_1484_11 = antes.API_1484_11; else delete win.API_1484_11; } };
}

export const NORMAS_HTML5 = {
  scorm12: { label: 'SCORM 1.2', ajuda: 'O pacote comunica pela API SCORM 1.2 (window.API).' },
  scorm2004: { label: 'SCORM 2004', ajuda: 'O pacote comunica pela API SCORM 2004 (window.API_1484_11).' },
  xapi: { label: 'xAPI / Tin Can', ajuda: 'O pacote envia statements para o LRS interno da Universidade (lançamento com endpoint, auth, actor, registration).' },
  h5p: { label: 'H5P (Lumi, h5p.org)', ajuda: 'Conteúdo H5P (.h5p) reproduzido pelo leitor interno da plataforma; actividades com pontuação (quiz, arrastar, lacunas, vídeo interactivo…) reportam a conclusão e a nota.' },
};
