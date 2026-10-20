// Entrada do Portal de Documentos — uma superfície de trabalho, não uma montra: uma linha de saudação, a caixa de
// pesquisa utilizável aqui mesmo, e a seguir o trabalho (o que falta confirmar, o que é novo, os aeroportos da
// pessoa). Os indicadores vão numa só tira fina no fim, e só os que não são zero: um indicador a zero vira uma
// linha de texto. Sem painel decorativo, sem botões a repetir o menu, sem cartões grandes para listas.
// Regras: docs/desenho-portal-documentos.md. O que aparece é o que o servidor devolve a esta pessoa (136a/b/c).
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpenCheck, Building2, ChevronRight, FileText, Library, Search, ShieldCheck } from 'lucide-react';
import { imagemPortal } from '@/universidade/imagens';
import { estiloVeu, corVeu, intensidadeVeu } from '@/lib/veuCabecalho';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { fmtData } from '@/lib/safeDate';
import { useAuth } from '@/lib/AuthContext';
import { PORTAL_BASE, primeiroNome, estadoPublicado, diasParaExpirar } from '@/lib/portalDocumentos';
import { useDocumentosDocs, useMinhasLeituras, useAeroportosDocs, useConfigPortalDocs } from '../hooks';
import {
  ehGestor, usePodeVer, T, MONO, Ref, LinhaDocumento, LinhaMais, EstadoVazio, EstadoErro, EsqueletoLinhas,
  TituloSeccao, dataMovimento, versaoDe,
} from '../PortalLayout';

const MOSTRAR_NOVIDADES = 6;
const MOSTRAR_CONFIRMAR = 4;
const MINIMO_PESQUISA = 2;
const CHAVE_VISITA = 'gd:visto-em';

// Guia rápido «O que encontra aqui». `pagina` = permissão de página necessária (sem ela o cartão não aparece).
const GUIA = [
  { titulo: 'Biblioteca', icone: Library, pagina: 'biblioteca', para: '/biblioteca', cor: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
    texto: 'Os documentos de cada aeroporto, arrumados por setor (Operações, Safety, Emergência, Manutenção) e por classe: manuais, procedimentos, formulários.' },
  { titulo: 'Pesquisa', icone: Search, pagina: 'pesquisa', para: '/pesquisa', cor: 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300',
    texto: 'Encontre qualquer documento pelo código (ex.: POP-FNLU-PSCI-001), pelo título ou por uma palavra.' },
  { titulo: 'As minhas leituras', icone: BookOpenCheck, pagina: 'leituras', para: '/leituras', cor: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    texto: 'Os documentos que tem de ler e confirmar. A confirmação fica registada como prova de que tomou conhecimento.' },
  { titulo: 'Sempre a versão em vigor', icone: ShieldCheck, cor: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
    texto: 'O portal avisa quando está a ver uma versão substituída. Os documentos AVSEC estão numa pasta restrita, visível só a pessoal credenciado.' },
];

const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite'; };

// Confirmação de leitura: só os documentos marcados para isso (documento.exige_leitura, migração 135) e só aos
// perfis indicados em leitura_perfis (vazio = a toda a gente que vê o documento). A mesma regra de «As minhas
// leituras» — se mudar, muda nos dois sítios.
const exigeConfirmacao = (doc, user) => {
  if (!doc?.exige_leitura) return false;
  const alvo = Array.isArray(doc.leitura_perfis) ? doc.leitura_perfis.filter(Boolean) : [];
  if (!alvo.length) return true;
  const meus = Array.isArray(user?.perfis) ? user.perfis : [];
  return alvo.some(p => meus.includes(p));
};

// Última visita: guardada neste navegador, serve para marcar o que é novo desde a última vez. A marca só é
// reposta depois de meia hora, para um F5 não apagar os avisos que a pessoa ainda não leu.
function useUltimaVisita() {
  const [anterior] = useState(() => {
    try {
      const t = Date.parse(localStorage.getItem(CHAVE_VISITA) || '');
      return Number.isFinite(t) ? t : null;
    } catch { return null; }
  });
  useEffect(() => {
    try {
      const agora = Date.now();
      const t = Date.parse(localStorage.getItem(CHAVE_VISITA) || '');
      if (!Number.isFinite(t) || agora - t > 30 * 60 * 1000) localStorage.setItem(CHAVE_VISITA, new Date(agora).toISOString());
    } catch { /* navegador sem armazenamento */ }
  }, []);
  return anterior;
}

// Caixa de pesquisa: escreve-se aqui e vai-se direito aos resultados (uma caixa visível é muito mais usada do que
// uma ligação). O termo segue no endereço, para a pesquisa poder ser partilhada.
function CaixaPesquisa({ escuro = false }) {
  const navigate = useNavigate();
  const [termo, setTermo] = useState('');
  const [aviso, setAviso] = useState('');
  const submeter = (e) => {
    e.preventDefault();
    const t = termo.trim();
    if (t.length < MINIMO_PESQUISA) { setAviso(`Escreva pelo menos ${MINIMO_PESQUISA} letras para procurar.`); return; }
    setAviso('');
    navigate(`${PORTAL_BASE}/pesquisa?q=${encodeURIComponent(t)}`);
  };
  return (
    <form role="search" onSubmit={submeter}>
      <label htmlFor="gd-pesquisa" className={cn('mb-1.5 block text-sm font-medium', escuro ? 'text-white' : T.tintaMedia)}>Procurar um documento</label>
      <div className="relative">
        <Search className={cn('pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2', T.tintaFraca)} aria-hidden="true" />
        <input
          id="gd-pesquisa"
          name="q"
          type="search"
          value={termo}
          onChange={(e) => { setTermo(e.target.value); if (aviso) setAviso(''); }}
          placeholder="Número, título ou palavra"
          autoComplete="off"
          enterKeyHint="search"
          aria-describedby="gd-pesquisa-ajuda"
          className={cn(
            'h-14 w-full rounded-xl border pl-12 pr-28 text-base outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400',
            T.linha, T.superficie, T.tinta,
            'focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25 dark:focus:border-teal-400 dark:focus:ring-teal-400/25',
          )}
        />
        <Button type="submit" className="absolute right-1.5 top-1.5 h-11 px-4">Procurar</Button>
      </div>
      <p id="gd-pesquisa-ajuda" role={aviso ? 'status' : undefined} className={cn('mt-1.5 text-sm', aviso ? (escuro ? 'text-amber-200' : T.ambar) : (escuro ? 'text-blue-100/80' : T.tintaFraca))}>
        {aviso || 'Procura no número, no título, na descrição e nas etiquetas dos documentos a que tem acesso.'}
      </p>
    </form>
  );
}

// Tira fina de indicadores: só os que não são zero; cada um leva ao sítio onde se trata do assunto.
function Indicador({ valor, label, para }) {
  const conteudo = (
    <>
      <span style={MONO} className={cn('text-base font-semibold', T.tinta)}>{valor}</span>
      <span className={cn('text-sm', T.tintaFraca)}>{label}</span>
    </>
  );
  if (!para) return <span className="inline-flex min-h-[2.75rem] items-center gap-2">{conteudo}</span>;
  return (
    <Link to={para} className={cn('inline-flex min-h-[2.75rem] items-center gap-2 rounded hover:underline', T.foco)}>{conteudo}</Link>
  );
}

export default function PortalInicio() {
  const { user } = useAuth();
  const podeVer = usePodeVer();
  const gestor = ehGestor(user);
  const ultimaVisita = useUltimaVisita();

  const { data: cfg } = useConfigPortalDocs();
  const imagem = imagemPortal(cfg, 'ged');
  const docsQ = useDocumentosDocs({ limite: 1000 });
  const leiturasQ = useMinhasLeituras(user?.email);
  const aeroQ = useAeroportosDocs();

  const docs = docsQ.data || [];
  const aCarregar = docsQ.isLoading;
  const mapaAero = useMemo(() => new Map((aeroQ.data || []).map(a => [a.id, a])), [aeroQ.data]);
  const codigoAero = (id) => { const a = id ? mapaAero.get(id) : null; return a ? (a.codigo_icao || a.nome || '') : ''; };

  const emVigor = useMemo(() => docs.filter(d => estadoPublicado(d.estado)), [docs]);

  // Novos ou actualizados: ordenados pela última movimentação (publicação ou alteração).
  const novidades = useMemo(() => emVigor.slice()
    .sort((a, b) => String(dataMovimento(b) || '').localeCompare(String(dataMovimento(a) || '')))
    .slice(0, MOSTRAR_NOVIDADES), [emVigor]);
  const eNovo = (doc) => {
    if (!ultimaVisita) return false;
    const t = Date.parse(dataMovimento(doc) || '');
    return Number.isFinite(t) && t > ultimaVisita;
  };

  // Os aeroportos da pessoa, em linhas compactas, com o número de documentos em vigor.
  const porAeroporto = useMemo(() => {
    const m = new Map();
    for (const d of emVigor) {
      const k = d.aeroporto_id || 'geral';
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].map(([chave, total]) => {
      const a = chave === 'geral' ? null : mapaAero.get(chave);
      return {
        chave,
        total,
        codigo: a?.codigo_icao || (chave === 'geral' ? '—' : 'Aeroporto'),
        nome: a?.nome || (chave === 'geral' ? 'Documentos gerais (sem aeroporto)' : 'Aeroporto'),
      };
    }).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt'));
  }, [emVigor, mapaAero]);

  // Leituras por confirmar: documentos marcados como «exige confirmação» cuja versão actual ainda não foi confirmada.
  const porConfirmar = useMemo(() => {
    const porDoc = new Map();
    for (const l of (leiturasQ.data || [])) {
      if (!porDoc.has(l.documento_id)) porDoc.set(l.documento_id, []);
      porDoc.get(l.documento_id).push(l);
    }
    return emVigor.filter(d => {
      if (!exigeConfirmacao(d, user)) return false;
      const lista = porDoc.get(d.id);
      if (!lista?.length) return true;
      const v = String(versaoDe(d));
      if (lista.some(l => String(l.versao ?? '') === v)) return false;
      return !lista.every(l => !l.versao); // leituras antigas sem versão contam como feitas
    });
  }, [emVigor, leiturasQ.data, user]);

  // Validade (interessa a quem faz gestão documental).
  const validade = useMemo(() => {
    const comPrazo = emVigor.map(d => ({ doc: d, dias: diasParaExpirar(d) })).filter(x => x.dias !== null);
    return {
      expirados: comPrazo.filter(x => x.dias < 0).length,
      d90: comPrazo.filter(x => x.dias >= 0 && x.dias <= 90).length,
    };
  }, [emVigor]);

  // Indicadores: só os que não são zero. Os que estão a zero descem para uma linha de texto.
  const indicadores = [];
  if (emVigor.length) indicadores.push({ chave: 'em_vigor', valor: emVigor.length, label: emVigor.length === 1 ? 'documento em vigor' : 'documentos em vigor', para: podeVer('biblioteca') ? `${PORTAL_BASE}/biblioteca` : null });
  if (porConfirmar.length) indicadores.push({ chave: 'confirmar', valor: porConfirmar.length, label: porConfirmar.length === 1 ? 'leitura por confirmar' : 'leituras por confirmar', para: podeVer('leituras') ? `${PORTAL_BASE}/leituras` : null });
  if (gestor && validade.expirados) indicadores.push({ chave: 'expirados', valor: validade.expirados, label: validade.expirados === 1 ? 'documento expirado' : 'documentos expirados', para: podeVer('gestao_relatorios') ? `${PORTAL_BASE}/gestao/relatorios` : null });
  if (gestor && validade.d90) indicadores.push({ chave: 'd90', valor: validade.d90, label: 'a expirar em 90 dias', para: podeVer('gestao_relatorios') ? `${PORTAL_BASE}/gestao/relatorios` : null });

  const linhasZero = [];
  if (podeVer('leituras') && !leiturasQ.isLoading && porConfirmar.length === 0) linhasZero.push('Não tem leituras por confirmar.');
  if (gestor && !validade.expirados && !validade.d90) linhasZero.push('Nada a expirar nos próximos 90 dias.');

  const semDocumentos = !aCarregar && !docsQ.isError && docs.length === 0;

  return (
    <div className="w-full space-y-8">
      {/* Banda de acolhimento: a saudação com hierarquia a sério e, quando a pessoa pode pesquisar, a caixa de
          pesquisa como acto central da página. É a única superfície com gradiente — dá à entrada um sentido de
          lugar sem trair a sobriedade do resto do portal. */}
      {/* Cabeçalho com fotografia (configurável em Gestão → Configurações → Portal, migr 176): nome do portal,
          apresentação, saudação e a pesquisa — que continua a ser o acto central da página. */}
      <header className="relative overflow-hidden rounded-3xl text-white" style={{ backgroundColor: corVeu(cfg) }}>
        <picture className="pointer-events-none absolute inset-0" aria-hidden="true">
          {imagem.urlPequena && <source media="(max-width: 767px)" srcSet={imagem.urlPequena} />}
          <img src={imagem.url} alt="" className="h-full w-full object-cover object-center" loading="eager" fetchPriority="high" />
        </picture>
        <div className="pointer-events-none absolute inset-0" style={estiloVeu(corVeu(cfg), intensidadeVeu(cfg))} aria-hidden="true" />
        {imagem.credito && <p className="absolute bottom-2 right-4 z-10 text-[10px] text-white/50">{imagem.credito}</p>}
        <div className="relative px-6 py-9 sm:px-10 sm:py-12">
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">{cfg?.nome_portal || 'Portal de Documentos'}</h1>
          <p className="mt-3 max-w-2xl text-base text-blue-100/90 sm:text-lg">
            {cfg?.texto_apresentacao || cfg?.slogan || 'O arquivo oficial dos manuais, procedimentos e formulários dos aeroportos da SGA. Consulte aqui sempre a versão em vigor antes de operar.'}
          </p>
          <p className="mt-5 text-sm text-blue-200/90">
            {saudacao()}, {primeiroNome(user?.full_name || user?.email) || 'bem-vindo'}.
            {ultimaVisita && <> A sua última visita foi a <span className="tabular-nums">{fmtData(new Date(ultimaVisita))}</span>.</>}
          </p>
          {podeVer('pesquisa') && <div className="mt-6 max-w-3xl"><CaixaPesquisa escuro /></div>}
        </div>
      </header>

      {/* Guia rápido: para quem chega pela primeira vez. Desliga-se em Configurações. */}
      {cfg?.mostrar_guia_inicio !== false && (
        <section aria-label="O que encontra aqui">
          <TituloSeccao>O que encontra aqui</TituloSeccao>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {GUIA.filter(g => !g.pagina || podeVer(g.pagina)).map(g => {
              const corpo = (
                <>
                  <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-xl', g.cor)}><g.icone className="h-5 w-5" aria-hidden="true" /></span>
                  <p className={cn('mt-3 font-semibold', T.tinta)}>{g.titulo}</p>
                  <p className={cn('mt-1 text-sm leading-relaxed', T.tintaFraca)}>{g.texto}</p>
                </>
              );
              return g.para
                ? <Link key={g.titulo} to={`${PORTAL_BASE}${g.para}`} className={cn('group block p-4 transition-colors hover:border-teal-300 dark:hover:border-teal-700', T.caixa)}>{corpo}<span className={cn('mt-3 inline-flex items-center gap-1 text-sm font-medium', T.acento)}>Abrir<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span></Link>
                : <div key={g.titulo} className={cn('p-4', T.caixa)}>{corpo}</div>;
            })}
          </div>
        </section>
      )}

      {docsQ.isError ? (
        <div className={T.caixa}>
          <EstadoErro titulo="Não foi possível carregar os seus documentos" onTentar={() => docsQ.refetch?.()} />
        </div>
      ) : semDocumentos ? (
        <div className={T.caixa}>
          <EstadoVazio
            icone={FileText}
            titulo="Ainda não há documentos para consultar"
            texto="A sua conta já entra no portal, mas ainda não há documentos publicados nas pastas dos aeroportos a que tem acesso. Assim que houver, aparecem aqui."
          >
            <Button asChild variant="outline" className="h-11"><Link to={`${PORTAL_BASE}/conta`}>Ver os meus aeroportos</Link></Button>
          </EstadoVazio>
        </div>
      ) : (
        <>
          {/* Falta confirmar — só aparece se houver. */}
          {podeVer('leituras') && !leiturasQ.isLoading && porConfirmar.length > 0 && (
            <section>
              <TituloSeccao contagem={porConfirmar.length}>Falta confirmar a leitura</TituloSeccao>
              <ul className={cn('divide-y overflow-hidden', T.caixa, T.divisoria)}>
                {porConfirmar.slice(0, MOSTRAR_CONFIRMAR).map(d => (
                  <LinhaDocumento key={d.id} doc={d} aeroporto={codigoAero(d.aeroporto_id)} />
                ))}
                {porConfirmar.length > MOSTRAR_CONFIRMAR && podeVer('leituras') && (
                  <LinhaMais texto={`Ver as ${porConfirmar.length} leituras por confirmar`} para={`${PORTAL_BASE}/leituras`} />
                )}
              </ul>
            </section>
          )}

          {/* Novos ou actualizados. */}
          <section>
            <TituloSeccao>Novos ou actualizados</TituloSeccao>
            <div className={cn('overflow-hidden', T.caixa)}>
              {aCarregar ? (
                <EsqueletoLinhas linhas={5} />
              ) : novidades.length === 0 ? (
                <EstadoVazio
                  icone={FileText}
                  titulo="Nenhum documento em vigor"
                  texto="Há documentos no portal, mas nenhum chegou ainda ao estado «Em vigor». Os rascunhos e as revisões ficam na Biblioteca, à vista de quem os gere."
                >
                  {podeVer('biblioteca') && <Button asChild variant="outline" className="h-11"><Link to={`${PORTAL_BASE}/biblioteca`}>Abrir a Biblioteca</Link></Button>}
                </EstadoVazio>
              ) : (
                <ul className={cn('divide-y', T.divisoria)}>
                  {novidades.map(d => (
                    <LinhaDocumento
                      key={d.id}
                      doc={d}
                      aeroporto={codigoAero(d.aeroporto_id)}
                      marca={eNovo(d) ? <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-sm font-semibold', T.acentoFundo)}>Novo</span> : null}
                    />
                  ))}
                  {podeVer('biblioteca') && emVigor.length > novidades.length && (
                    <LinhaMais texto={`Ver os ${emVigor.length} documentos em vigor`} para={`${PORTAL_BASE}/biblioteca`} />
                  )}
                </ul>
              )}
            </div>
          </section>

          {/* Os aeroportos da pessoa, em linhas compactas: código, nome, quantos documentos e o atalho às pastas. */}
          {podeVer('biblioteca') && (aCarregar || porAeroporto.length > 0) && (
            <section>
              <TituloSeccao>{porAeroporto.length === 1 ? 'O seu aeroporto' : 'Os seus aeroportos'}</TituloSeccao>
              {aCarregar ? (
                <div className={cn('overflow-hidden', T.caixa)}><EsqueletoLinhas linhas={2} /></div>
              ) : (
                <ul className={cn('divide-y overflow-hidden', T.caixa, T.divisoria)}>
                  {porAeroporto.map(a => (
                    <li key={a.chave}>
                      <Link
                        to={`${PORTAL_BASE}/biblioteca?aeroporto=${encodeURIComponent(a.chave)}`}
                        className={cn('flex min-h-[3rem] items-center gap-3 px-3 py-2.5 transition-colors sm:px-4', T.realce, T.focoDentro)}
                      >
                        <Building2 className={cn('h-5 w-5 shrink-0', T.tintaFraca)} aria-hidden="true" />
                        <Ref className={cn('w-12 shrink-0 font-semibold', T.tinta)}>{a.codigo}</Ref>
                        <span className={cn('min-w-0 flex-1 truncate text-sm', T.tintaMedia)}>{a.nome}</span>
                        {/* Em telemóvel fica só o número (o rótulo completo vai no aria-label), para o nome do aeroporto ter espaço. */}
                        <span className={cn('shrink-0 text-sm', T.tintaFraca)} aria-label={`${a.total} ${a.total === 1 ? 'documento em vigor' : 'documentos em vigor'}`}>
                          <span className="tabular-nums">{a.total}</span><span className="hidden sm:inline"> {a.total === 1 ? 'documento' : 'documentos'}</span>
                        </span>
                        <span className={cn('hidden shrink-0 text-sm font-medium sm:inline', T.acento)}>Abrir pastas</span>
                        <ChevronRight className={cn('h-5 w-5 shrink-0', T.tintaFraca)} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Tira fina de indicadores: só os que não são zero; os que estão a zero dizem-se por palavras. */}
          <section aria-label="Resumo">
            {aCarregar ? (
              <Skeleton className="h-[3.25rem] w-full rounded-xl" />
            ) : (
              <>
                {indicadores.length > 0 && (
                  <ul className={cn('flex flex-wrap items-center gap-x-6 px-4 py-1', T.caixa)}>
                    {indicadores.map(i => (
                      <li key={i.chave}><Indicador valor={i.valor} label={i.label} para={i.para} /></li>
                    ))}
                  </ul>
                )}
                {linhasZero.length > 0 && (
                  <p className={cn('text-sm', indicadores.length > 0 && 'mt-2', T.tintaFraca)}>{linhasZero.join(' ')}</p>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
