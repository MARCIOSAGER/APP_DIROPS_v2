// Utilitários partilhados da Universidade Corporativa (área do aluno e gestão).
import { PlayCircle, FileText, MonitorPlay, BookOpen, Link2, Users } from 'lucide-react';
import { isAdminProfile } from '@/components/lib/userUtils';

// Quem pode editar/apagar um curso (espelho da função SQL pode_editar_curso, migração 106):
// admin, ou instrutor responsável (instrutor_email), co-instrutor (instrutores) ou criador (created_by).
export function podeEditarCurso(user, curso) {
  if (!user || !curso) return false;
  if (isAdminProfile(user)) return true;
  const eu = String(user.email || '').toLowerCase();
  if (!eu) return false;
  const donos = [curso.instrutor_email, curso.created_by, ...(Array.isArray(curso.instrutores) ? curso.instrutores : [])].map(e => String(e || '').toLowerCase());
  return donos.includes(eu);
}
export function nomeResponsavel(curso) {
  return curso?.instrutor_nome || curso?.instrutor_email || curso?.created_by || 'administração';
}

export const TIPO_AULA = {
  video: { label: 'Vídeo', icon: PlayCircle },
  pdf: { label: 'PDF', icon: FileText },
  html5: { label: 'Conteúdo interativo', icon: MonitorPlay },
  texto: { label: 'Leitura', icon: BookOpen },
  link: { label: 'Ligação externa', icon: Link2 },
  presencial: { label: 'Sessão presencial', icon: Users },
};

// A conclusão desta aula é feita pelo aluno (botão) ou automaticamente (presença / SCORM-xAPI)?
export function conclusaoManual(aula) {
  if (!aula) return true;
  if (aula.tipo === 'presencial' || aula.conclusao === 'presenca') return false;
  if (aula.tipo === 'html5' && aula.conclusao === 'automatica') return false;
  return true;
}
export function fmtTamanho(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export const NIVEL_LABEL = {
  iniciante: 'Iniciante',
  intermedio: 'Intermédio',
  avancado: 'Avançado',
};

export const ESTADO_MATRICULA = {
  ativo: { label: 'Em curso', cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' },
  concluido: { label: 'Concluído', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  cancelado: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
};

// Gradientes de capa quando o curso não tem imagem — determinístico pela categoria,
// para a mesma categoria ter sempre a mesma cor no catálogo.
const GRADIENTES = [
  'from-blue-600 to-indigo-700',
  'from-emerald-600 to-teal-700',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-violet-600 to-purple-700',
  'from-cyan-600 to-sky-700',
  'from-slate-600 to-slate-800',
];
export function gradienteCategoria(categoria) {
  const s = String(categoria || 'geral').toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return GRADIENTES[h % GRADIENTES.length];
}

// "45 min" / "1h 30" / "2h" a partir de minutos.
export function fmtMinutos(min) {
  const m = Math.round(Number(min) || 0);
  if (!m) return '';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${String(r).padStart(2, '0')}` : `${h}h`;
}

// "8h" / "1,5h" a partir de horas (carga horária do curso).
export function fmtHoras(h) {
  const n = Number(h);
  if (!n) return '';
  return `${Number.isInteger(n) ? n : n.toLocaleString('pt-PT', { maximumFractionDigits: 1 })}h`;
}

export function fmtData(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

// Interpreta a URL de uma aula de vídeo: YouTube / Vimeo / ficheiro directo.
export function parseVideoUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      if (id) return { kind: 'youtube', id, embed: youtubeEmbed(id) };
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      let id = null;
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/);
      if (!id && m) id = m[1];
      if (id) return { kind: 'youtube', id, embed: youtubeEmbed(id) };
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const m = u.pathname.match(/(\d{5,})/);
      if (m) return { kind: 'vimeo', id: m[1], embed: `https://player.vimeo.com/video/${m[1]}?dnt=1&texttrack=pt` };
    }
    if (/\.(mp4|webm|ogv|ogg|m4v|mov)$/i.test(u.pathname)) return { kind: 'file', src: url };
    return { kind: 'unknown', src: url };
  } catch {
    return { kind: 'unknown', src: url };
  }
}
// Legendas em português ligadas por omissão (o YouTube traduz automaticamente quando o vídeo tem legendas);
// o aluno pode desligá-las no botão CC.
function youtubeEmbed(id) {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1&hl=pt-PT&cc_lang_pref=pt&cc_load_policy=1`;
}

// Achata módulos+aulas na ordem de leitura: [{...aula, modulo}]
export function ordenarConteudo(modulos = [], aulas = []) {
  const mods = [...modulos].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.titulo).localeCompare(String(b.titulo)));
  const porModulo = new Map();
  for (const a of aulas) {
    if (!porModulo.has(a.modulo_id)) porModulo.set(a.modulo_id, []);
    porModulo.get(a.modulo_id).push(a);
  }
  const sequencia = [];
  const arvore = mods.map(m => {
    const lista = (porModulo.get(m.id) || []).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.titulo).localeCompare(String(b.titulo)));
    lista.forEach(a => sequencia.push({ ...a, modulo: m }));
    return { ...m, aulas: lista };
  });
  return { arvore, sequencia };
}

// Lê um recurso same-origin (logo, assinatura) como data URL para o jsPDF. null se falhar.
export async function fetchDataUrl(url) {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => res(null);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}
