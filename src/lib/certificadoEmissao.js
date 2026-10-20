// Emissão e preparação de certificados da Universidade Corporativa.
//   - emitirCertificado: cria a linha em `certificado` (snapshots) e liga a matrícula.
//   - prepararCertParaPdf: transforma uma linha em input do gerarCertificadoPdf
//     (imagens como data URL, layout, URL de validação).
import { Certificado } from '@/entities/Certificado';
import { Matricula } from '@/entities/Matricula';
import { supabase } from '@/lib/supabaseClient';
import { recortarMargens } from '@/lib/imagemRecorte';

// Plano de aula do verso: um tema por módulo, horas = soma das aulas.
export function planoAulaDoCurso(modulos = [], aulas = []) {
  return [...modulos]
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map(m => {
      const min = aulas.filter(a => a.modulo_id === m.id).reduce((s, a) => s + (Number(a.duracao_min) || 0), 0);
      const horas = min ? Math.round((min / 60) * 10) / 10 : undefined;
      return horas ? { tema: m.titulo, horas } : { tema: m.titulo };
    });
}

// Assinantes que entram no certificado deste curso: globais seleccionados + específicos do curso.
//   config.assinantes_globais_ids = [id, …]  -> só esses globais (selecção por curso)
//   sem lista: todos os globais activos, salvo config.usar_assinantes_globais === false (compat.)
export function assinantesParaCurso(assinantes = [], cursoId, config) {
  const ids = Array.isArray(config?.assinantes_globais_ids) ? new Set(config.assinantes_globais_ids) : null;
  const usarGlobais = config?.usar_assinantes_globais !== false;
  const globalEntra = (a) => (ids ? ids.has(a.id) : usarGlobais);
  return assinantes
    .filter(a => a.ativo !== false && ((!a.curso_id && globalEntra(a)) || a.curso_id === cursoId))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .slice(0, 4)
    .map(a => ({ nome: a.nome, cargo: a.cargo || '', assinatura_url: a.assinatura_url || null }));
}

export async function emitirCertificado({ curso, matricula, modulos, aulas, assinantes, emitidoPor, empresaId }) {
  const config = curso.certificado_config || null;
  const cert = await Certificado.create({
    matricula_id: matricula.id,
    curso_id: curso.id,
    aluno_nome: matricula.aluno_nome || matricula.aluno_email,
    aluno_email: matricula.aluno_email,
    curso_titulo: curso.titulo,
    carga_horaria: curso.carga_horaria || null,
    plano_aula: planoAulaDoCurso(modulos, aulas),
    assinantes: assinantesParaCurso(assinantes, curso.id, config),
    config,
    emitido_em: new Date().toISOString(),
    emitido_por: emitidoPor || null,
    empresa_id: empresaId || curso.empresa_id || null,
  });
  try { await Matricula.update(matricula.id, { certificado_num: cert.numero }); } catch { /* opcional */ }
  return cert;
}

let _baseUrlCache = null;
export async function getPublicBaseUrl() {
  if (_baseUrlCache) return _baseUrlCache;
  try {
    const { data } = await supabase.functions.invoke('share-link-config');
    if (data?.base_url) _baseUrlCache = String(data.base_url).replace(/\/$/, '');
  } catch { /* usa a origem actual */ }
  return _baseUrlCache || window.location.origin;
}

// Lê um recurso same-origin (logo, arte, assinatura) como data URL. null se falhar.
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

// Constrói o input do gerarCertificadoPdf a partir de uma linha `certificado`
// (ou de um objecto equivalente de pré-visualização com `config` explícito).
export async function prepararCertParaPdf(cert, { config: configOverride, baseUrl } = {}) {
  const config = configOverride || cert.config || {};
  const base = baseUrl || await getPublicBaseUrl();
  const [logoDataUrl, fundoDataUrl, fundoVersoDataUrl] = await Promise.all([
    fetchDataUrl(config.logo_url || '/logo-sga.png'),
    fetchDataUrl(config.fundo_url),
    fetchDataUrl(config.fundo_verso_url),
  ]);
  const assinantes = await Promise.all((Array.isArray(cert.assinantes) ? cert.assinantes : []).map(async (a) => ({
    ...a,
    assinaturaDataUrl: await recortarMargens(a.assinaturaDataUrl || (a.assinatura_url ? await fetchDataUrl(a.assinatura_url) : null)), // margens transparentes/brancas recortadas
  })));
  return {
    ...cert,
    logoDataUrl,
    fundoDataUrl,
    fundoVersoDataUrl,
    layout: config.layout || null,
    textos: config.textos || null,
    assinatura_cargo_acima: !!config.assinatura_cargo_acima,
    assinantes,
    validacaoUrl: cert.token ? `${base}/cert/${cert.token}` : (cert.validacaoUrl || ''),
  };
}
