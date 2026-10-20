// Codificação documental — o ecrã onde o número de um documento deixa de ser convenção na cabeça das pessoas.
//
//     POP   -   FNMO   -   MGSO   -   010
//   classe    aeroporto   processo   sequência
//
// Duas tabelas, e a razão de serem duas: a CLASSE diz o QUE o documento é (manual, plano, procedimento, ficha) e
// o PROCESSO diz de que MANUAL OU PROGRAMA faz parte. É a segunda que a lei usa — o Manual de Operações tem
// capítulos e apêndices, e o Plano de Emergência e o SGSO são apêndices dele —, e era a que não existia em
// lado nenhum do interface.
//
// A decisão de desenho que manda nesta página: os DOIS processos cujo nome é interpretação e não leitura (MPIP e
// PGG, marcados pela migração 163 com `nome_confirmado = false`) têm de saltar à vista, e os outros vinte e um
// não podem alarmar ninguém. Um ecrã que pinta tudo de amarelo não distingue nada. Por isso há uma faixa própria
// em cima, só para esses, com a `fonte_nome` inteira — a frase que explica porque o nome é incerto — e a lista
// dos documentos que usam o código, porque nomear um código às cegas é exactamente o que produz nomes
// inventados. Nos restantes a `fonte_nome` aparece discreta, em texto pequeno: é a prova de onde o nome veio e
// não um aviso.
//
// Quem escreve é decidido pelo servidor (políticas da migração 157: os processos são do gestor documental, as
// classes do administrador do portal). Aqui esconde-se o que a pessoa não pode fazer e diz-se porquê, em vez de
// deixar o botão lá a dar erro.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, BadgeCheck, CheckCircle2, ChevronDown, FileText, HelpCircle, Layers, Loader2,
  Pencil, Plus, RefreshCw, Search, Tags,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import Select from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { ehAdminPortal, ehGestorDocs } from '@/lib/portalDocumentos';
import { useTiposDocumento, auditarDocs } from '../../hooks';
import {
  useCodificacao, useRecarregarCodificacao, useDocumentosDoProcesso, useDocumentosDaClasse, useSetoresDocs,
  guardarClasse, guardarProcesso, criarProcesso, confirmarNomeProcesso, processoPorConfirmar, nomeSetor,
} from '../../hooksCodificacao';
import { EXEMPLO_NUMERO } from '../../apiCodificacao';
import { Vazio, Falha, urlDoc, EstadoChip } from '../PortalBiblioteca';
import { PaginaGestao, Ref } from '../../PortalLayout';
import { Exportar, pdfDocumentos, descarregarCsv, exportarExcel } from '../../exportar';
import {
  GD, Painel, Cabecalho, Tabela, Th, Tr, Td, AccoesLinha, LinhasEsqueleto, LinhaMensagem,
} from './PortalGestaoPainel';

const COLUNAS_PROCESSO = 5;
const COLUNAS_CLASSE = 5;
const bate = (texto, termo) => String(texto || '').toLowerCase().includes(termo);

// ── o número, desmontado ────────────────────────────────────────────────────
// Uma só linha, com o exemplo em cima e o nome de cada segmento por baixo. É a chave de leitura de tudo o que
// vem a seguir: sem ela, «MGSO» numa coluna chamada «processo» não diz nada a quem chega de novo.
const SEGMENTOS = [
  { parte: 'POP', titulo: 'Classe', texto: 'o que o documento é' },
  { parte: 'FNMO', titulo: 'Aeroporto', texto: 'código ICAO' },
  { parte: 'MGSO', titulo: 'Processo', texto: 'de que manual faz parte' },
  { parte: '010', titulo: 'Sequência', texto: 'três algarismos' },
];
function Anatomia() {
  return (
    <div className={cn('flex flex-wrap items-start gap-x-1 gap-y-3 rounded-xl border px-3 py-3 sm:px-4', GD.borda, GD.superficieFraca)}>
      {SEGMENTOS.map((s, i) => (
        <React.Fragment key={s.parte}>
          {i > 0 && <span aria-hidden="true" className={cn('pt-0.5 text-lg font-semibold', GD.meta)}>-</span>}
          <span className="min-w-0">
            <Ref className={cn('block text-base font-semibold', GD.acento)}>{s.parte}</Ref>
            <span className={cn('block text-xs font-semibold uppercase tracking-wider', GD.tintaMedia)}>{s.titulo}</span>
            <span className={cn('block text-xs', GD.meta)}>{s.texto}</span>
          </span>
        </React.Fragment>
      ))}
      <p className={cn('ml-auto max-w-sm text-sm', GD.meta)}>
        O sistema <strong className={GD.tintaMedia}>sugere e valida</strong> este número, mas não o impõe: há
        documentos antigos legítimos fora do padrão e partir-lhes o número seria estragar o arquivo.
      </p>
    </div>
  );
}

// ── documentos de um código, para quem está a decidir ───────────────────────
// Carrega só quando a linha é aberta. Mostra o número e o título: é o par que permite reconhecer o documento sem
// o abrir, e é a prova de que o nome escolhido para o código descreve o que lá está dentro.
function DocumentosDoCodigo({ dados, vazio }) {
  const { data, isLoading } = dados;
  if (isLoading) {
    return <p className={cn('flex items-center gap-2 px-1 py-2 text-sm', GD.meta)}><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />A carregar os documentos…</p>;
  }
  const lista = data || [];
  if (!lista.length) return <p className={cn('px-1 py-2 text-sm', GD.meta)}>{vazio}</p>;
  return (
    <ul className={cn('divide-y rounded-lg border', GD.divisoria, GD.borda)}>
      {lista.map(d => (
        <li key={d.id}>
          <Link to={urlDoc(d.id)} className={cn('flex min-h-[2.75rem] flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5', GD.foco, GD.hover)}>
            <Ref className={cn('shrink-0', GD.meta)}>{d.numero || 'sem número'}</Ref>
            <span className={cn('min-w-0 flex-1 truncate text-sm', GD.tinta)}>{d.titulo}</span>
            <EstadoChip estado={d.estado} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Sub-linha da tabela com a lista de documentos. Fica dentro da própria tabela (um <tr> a toda a largura) para a
// lista não perder o contexto da linha que a abriu.
function LinhaDocumentos({ colunas, children }) {
  return (
    <tr>
      <td colSpan={colunas} className={cn('border-b px-3 pb-3 pt-0', GD.borda, GD.superficieFraca)}>{children}</td>
    </tr>
  );
}

function BotaoContagem({ total, aberta, aoAlternar, rotulo }) {
  if (!total) return <span className={cn('text-sm tabular-nums', GD.meta)}>0</span>;
  return (
    <button
      type="button" onClick={aoAlternar} aria-expanded={aberta}
      className={cn('inline-flex min-h-[2.25rem] items-center gap-1 rounded-lg px-2 text-sm font-medium tabular-nums', GD.foco, GD.acento, GD.hover)}
    >
      {total}
      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', aberta && 'rotate-180')} aria-hidden="true" />
      <span className="sr-only">{rotulo}</span>
    </button>
  );
}

// ── faixa dos nomes a confirmar ─────────────────────────────────────────────
// A única parte alarmante da página, e é alarmante de propósito. Cada processo traz: a frase que explica a dúvida
// (inteira, sem cortes — é o que permite decidir), os documentos que usam o código, e um campo com o nome
// proposto já escrito, para quem confirma poder aceitar, corrigir ou reescrever de raiz.
function CartaoConfirmar({ processo, actor, aoFeito }) {
  const { toast } = useToast();
  const [nome, setNome] = useState(processo.nome || '');
  const [descricao, setDescricao] = useState(processo.descricao || '');
  const [docsAbertos, setDocsAbertos] = useState(true);
  const [busy, setBusy] = useState(false);
  const docs = useDocumentosDoProcesso(docsAbertos ? processo.codigo : '');

  const mudado = nome.trim() !== String(processo.nome || '').trim();
  const confirmar = async () => {
    setBusy(true);
    try {
      await confirmarNomeProcesso(processo.codigo, {
        nome, descricao,
        porQuem: actor?.full_name || actor?.email || '',
        origemAnterior: processo.fonte_nome,
      });
      await auditarDocs(actor, {
        acao: 'codificacao_processo_confirmado', entidade: 'documento_processo', id: processo.codigo,
        detalhes: `Nome do processo ${processo.codigo} confirmado: «${nome.trim()}»${mudado ? ` (corrigido; antes dizia «${processo.nome || 'sem nome'}»)` : ''}`,
      });
      toast({
        title: mudado ? 'Nome corrigido e confirmado' : 'Nome confirmado',
        description: `${processo.codigo} passa a aparecer como «${nome.trim()}» na biblioteca e na pesquisa.`,
      });
      aoFeito();
    } catch (e) {
      toast({ title: 'Não foi possível confirmar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const idNome = `cf-nome-${processo.codigo}`;
  const idDesc = `cf-desc-${processo.codigo}`;
  return (
    <li className={cn('rounded-xl border p-3 sm:p-4', GD.avisoSuave)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Ref className="text-base font-bold">{processo.codigo}</Ref>
        <span className="text-sm font-medium">
          {processo.nome ? <>nome proposto: «{processo.nome}»</> : <>ainda sem nome</>}
        </span>
        <span className={cn('ml-auto text-sm tabular-nums')}>
          {processo.total === 1 ? '1 documento usa este código' : `${processo.total} documentos usam este código`}
        </span>
      </div>

      {/* a frase inteira, não cortada: é ela que diz porque o nome é incerto */}
      {processo.fonte_nome && (
        <p className="mt-2 flex items-start gap-2 text-sm">
          <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{processo.fonte_nome}</span>
        </p>
      )}

      {processo.total > 0 && (
        <div className="mt-3">
          <button
            type="button" onClick={() => setDocsAbertos(v => !v)} aria-expanded={docsAbertos}
            className={cn('inline-flex min-h-[2.25rem] items-center gap-1.5 rounded-lg text-sm font-medium underline-offset-2 hover:underline', GD.foco)}
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            {docsAbertos ? 'Esconder os documentos' : 'Ver os documentos com este código'}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', docsAbertos && 'rotate-180')} aria-hidden="true" />
          </button>
          {docsAbertos && (
            <div className="mt-2">
              <DocumentosDoCodigo dados={docs} vazio="Nenhum documento usa este código." />
            </div>
          )}
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={idNome}>Nome do manual ou programa</Label>
          <Input id={idNome} value={nome} onChange={e => setNome(e.target.value)} maxLength={200} autoComplete="off" />
          <p className="text-sm opacity-80">É por este nome que o código aparece na biblioteca e na pesquisa. Aceite o proposto, corrija-o, ou escreva outro.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={idDesc}>Nota (opcional)</Label>
          <Textarea id={idDesc} value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} maxLength={1000} />
          <p className="text-sm opacity-80">O que distingue este manual dos vizinhos, para quem numerar o próximo documento.</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button className="min-h-[2.75rem]" onClick={confirmar} disabled={busy || !nome.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BadgeCheck className="h-4 w-4" aria-hidden="true" />}
          {mudado ? 'Corrigir e confirmar' : 'Confirmar este nome'}
        </Button>
        {mudado && <span className="text-sm">Vai ficar registado que o nome foi corrigido.</span>}
      </div>
    </li>
  );
}

function FaixaConfirmar({ processos, actor, podeEscrever, aoFeito }) {
  if (!processos.length) return null;
  const n = processos.length;
  return (
    <Painel>
      <Cabecalho
        titulo={n === 1 ? 'Um nome à espera de confirmação' : `${n} nomes à espera de confirmação`}
        icone={AlertTriangle}
        caixaAlta={false}
        descricao={podeEscrever
          ? 'Estes nomes são interpretação do contexto, não leitura do documento: o código não está expandido em sítio nenhum do acervo. Confirme, corrija ou reescreva — um nome adivinhado e um nome lido não valem o mesmo, e é por isso que a diferença está à vista.'
          : 'Estes nomes são interpretação do contexto, não leitura do documento. Quem os pode confirmar é o gestor documental.'}
      />
      <div className="p-3">
        {podeEscrever ? (
          <ul className="space-y-3">
            {processos.map(p => <CartaoConfirmar key={p.codigo} processo={p} actor={actor} aoFeito={aoFeito} />)}
          </ul>
        ) : (
          <ul className="space-y-2">
            {processos.map(p => (
              <li key={p.codigo} className={cn('rounded-xl border p-3 text-sm', GD.avisoSuave)}>
                <Ref className="font-bold">{p.codigo}</Ref>
                <span className="ml-2 font-medium">{p.nome ? `«${p.nome}»` : 'ainda sem nome'}</span>
                {p.fonte_nome && <p className="mt-1">{p.fonte_nome}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Painel>
  );
}

// ── editar / criar ──────────────────────────────────────────────────────────
// Um diálogo só, para os dois lados da codificação: muda o título, os campos e quem pode gravar. O código nunca
// se altera depois de existir — é ele que está escrito nos números dos documentos e numa chave estrangeira.
function DialogCodificacao({ alvo, actor, temDescricaoClasse, onFechar, onFeito }) {
  const { toast } = useToast();
  const { modo, registo } = alvo;                    // modo: 'classe' | 'processo' | 'novo-processo'
  const ehClasse = modo === 'classe';
  const ehNovo = modo === 'novo-processo';
  const setoresQ = useSetoresDocs();
  const setores = setoresQ.data || [];
  const [f, setF] = useState(() => ({
    codigo: registo?.codigo || '',
    nome: registo?.nome || '',
    descricao: registo?.descricao || '',
    ativo: registo ? registo.ativo !== false : true,
    setor_codigo: registo?.setor_codigo || '',
  }));
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const guardar = async () => {
    setBusy(true);
    try {
      if (ehNovo) {
        const cod = await criarProcesso({ codigo: f.codigo, nome: f.nome, descricao: f.descricao });
        if (f.setor_codigo) await guardarProcesso(cod, { setor_codigo: f.setor_codigo });
        await auditarDocs(actor, {
          acao: 'codificacao_processo_criado', entidade: 'documento_processo', id: cod,
          detalhes: `Manual ou programa criado: ${cod}${f.nome.trim() ? ` — ${f.nome.trim()}` : ''}`,
        });
        toast({ title: 'Manual ou programa criado', description: `${cod} já pode ser escolhido ao carregar um documento.` });
      } else if (ehClasse) {
        await guardarClasse(registo.codigo, f, { temDescricao: temDescricaoClasse });
        await auditarDocs(actor, {
          acao: 'codificacao_classe_alterada', entidade: 'documento_classe', id: registo.codigo,
          detalhes: `Classe ${registo.codigo} alterada: «${f.nome.trim()}»`,
        });
        toast({ title: 'Classe actualizada' });
      } else {
        // Editar um processo não mexe em `nome_confirmado`: confirmar é um acto próprio, com a sua faixa e o seu
        // botão. Mudar a descrição de um processo confirmado não pode desconfirmá-lo, nem o contrário.
        await guardarProcesso(registo.codigo, f);
        await auditarDocs(actor, {
          acao: 'codificacao_processo_alterado', entidade: 'documento_processo', id: registo.codigo,
          detalhes: `Manual ou programa ${registo.codigo} alterado: «${f.nome.trim() || 'sem nome'}»`,
        });
        toast({ title: 'Manual ou programa actualizado' });
      }
      onFeito();
    } catch (e) {
      toast({ title: 'Não foi possível guardar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const titulo = ehNovo ? 'Novo manual ou programa' : ehClasse ? `Classe ${registo.codigo}` : `Manual ou programa ${registo.codigo}`;
  const mostrarDescricao = !ehClasse || temDescricaoClasse;
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ehClasse ? <Tags className="h-5 w-5 text-teal-600" aria-hidden="true" /> : <Layers className="h-5 w-5 text-teal-600" aria-hidden="true" />}
            {titulo}
          </DialogTitle>
          <DialogDescription>
            {ehNovo
              ? `O código é o terceiro segmento do número (${EXEMPLO_NUMERO}): 2 a 8 letras, sem espaços nem números. Depois de criado não se altera, porque fica escrito nos números dos documentos.`
              : `O código não se altera: está escrito no número de ${registo.total === 1 ? 'um documento' : `${registo.total} documentos`} e é por ele que a codificação os encontra.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {ehNovo && (
            <div className="space-y-1.5">
              <Label htmlFor="cd-codigo">Código *</Label>
              <Input
                id="cd-codigo" value={f.codigo} maxLength={8} autoComplete="off"
                onChange={e => set('codigo', e.target.value.toUpperCase().replace(/[^A-Za-z]/g, ''))}
                placeholder="MOA, PSCI, SMGCS…" className="font-mono uppercase"
              />
              <p className={cn('text-sm', GD.meta)}>Só letras. É assim que ele vai aparecer no número dos documentos.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="cd-nome">{ehClasse ? 'Nome da classe' : 'Nome do manual ou programa'}{ehClasse ? ' *' : ''}</Label>
            <Input id="cd-nome" value={f.nome} onChange={e => set('nome', e.target.value)} maxLength={200} autoComplete="off" />
            <p className={cn('text-sm', GD.meta)}>
              {ehClasse
                ? 'É o que aparece a quem consulta, em vez do prefixo cru.'
                : 'Deixe vazio só se não souber: um nome inventado é pior do que um código sem nome, porque parece verdade.'}
            </p>
          </div>
          {mostrarDescricao && (
            <div className="space-y-1.5">
              <Label htmlFor="cd-desc">Descrição</Label>
              <Textarea id="cd-desc" value={f.descricao} onChange={e => set('descricao', e.target.value)} rows={3} maxLength={1000} />
              <p className={cn('text-sm', GD.meta)}>O que distingue {ehClasse ? 'esta classe das vizinhas' : 'este manual dos vizinhos'}, para quem numerar o próximo documento.</p>
            </div>
          )}
          {!ehClasse && (
            <div className="space-y-1.5">
              <Label htmlFor="cd-setor">Setor (área)</Label>
              <Select
                value={f.setor_codigo}
                onValueChange={v => set('setor_codigo', v)}
                options={[{ value: '', label: 'Geral / Administração' }, ...setores.filter(s => s.ativo !== false).map(s => ({ value: s.codigo, label: s.nome }))]}
              />
              <p className={cn('text-sm', GD.meta)}>Agrupa este manual numa área (Operações, Safety, AVSEC, Emergência, Manutenção) para navegar e tirar relatórios por setor. Não esconde documentos — é só organização.</p>
            </div>
          )}
          {!ehNovo && (
            <div className={cn('flex items-start justify-between gap-4 rounded-lg border p-3', GD.borda)}>
              <div>
                <Label htmlFor="cd-activo" className="font-medium">Disponível para documentos novos</Label>
                <p className={cn('text-sm', GD.meta)}>
                  Desligado, deixa de se propor no formulário de carregamento. Os documentos que já o usam ficam como estão — desactivar não é apagar.
                </p>
              </div>
              <Switch id="cd-activo" checked={f.ativo} onCheckedChange={v => set('ativo', v)} />
            </div>
          )}
          {!ehClasse && registo?.fonte_nome && (
            <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.borda, GD.meta)}>
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span><span className="font-medium">De onde veio o nome:</span> {registo.fonte_nome}</span>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={busy}>Cancelar</Button>
          <Button onClick={guardar} disabled={busy || (ehNovo && f.codigo.trim().length < 2) || (ehClasse && !f.nome.trim())}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
            {ehNovo ? 'Criar' : 'Guardar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── linhas das duas tabelas ─────────────────────────────────────────────────
function LinhaProcesso({ p, podeEscrever, aoEditar, mapaSetores }) {
  const [aberta, setAberta] = useState(false);
  const docs = useDocumentosDoProcesso(aberta ? p.codigo : '');
  const porConfirmar = processoPorConfirmar(p);
  const setor = p.setor_codigo ? mapaSetores?.get?.(p.setor_codigo) : null;
  return (
    <>
      <Tr className={p.ativo === false ? 'opacity-60' : undefined}>
        <Td><Ref className={cn('font-semibold', GD.tinta)}>{p.codigo}</Ref></Td>
        <Td className="max-w-[26rem]">
          <span className={cn('block font-medium', GD.tinta)}>{p.nome || <span className={cn('italic font-normal', GD.meta)}>ainda sem nome</span>}</span>
          {p.descricao && <span className={cn('block truncate text-sm', GD.meta)}>{p.descricao}</span>}
          <span className={cn('mt-0.5 inline-flex items-center gap-1 text-xs', GD.meta)}>
            <span className="inline-block h-2 w-2 rounded-full" style={setor?.cor ? { backgroundColor: setor.cor } : { backgroundColor: '#94a3b8' }} aria-hidden="true" />
            {setor?.nome || 'Geral / Administração'}
          </span>
          {p.ativo === false && <span className={cn('block text-sm', GD.meta)}>Não se propõe em documentos novos</span>}
        </Td>
        {/* a prova de onde o nome veio, discreta: quem não a procura não tropeça nela, quem a procura tem-na ali */}
        <Td className={cn('hidden max-w-[22rem] xl:table-cell text-sm', GD.meta)}>
          {porConfirmar
            ? <span className={cn('inline-flex items-center gap-1 font-medium', GD.alerta)}><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />A confirmar</span>
            : <span className="line-clamp-2">{p.fonte_nome || '—'}</span>}
        </Td>
        <Td numerico>
          <BotaoContagem total={p.total} aberta={aberta} aoAlternar={() => setAberta(v => !v)} rotulo={`documentos com o código ${p.codigo}`} />
        </Td>
        <Td>
          <AccoesLinha>
            {podeEscrever && <Button size="sm" variant="outline" onClick={() => aoEditar(p)}><Pencil className="h-4 w-4" aria-hidden="true" />Editar</Button>}
          </AccoesLinha>
        </Td>
      </Tr>
      {aberta && (
        <LinhaDocumentos colunas={COLUNAS_PROCESSO}>
          <DocumentosDoCodigo dados={docs} vazio="Nenhum documento usa este código." />
        </LinhaDocumentos>
      )}
    </>
  );
}

function LinhaClasse({ c, tipos, podeEscrever, aoEditar }) {
  const [aberta, setAberta] = useState(false);
  const docs = useDocumentosDaClasse(aberta ? c.codigo : '');
  return (
    <>
      <Tr className={c.ativo === false ? 'opacity-60' : undefined}>
        <Td><Ref className={cn('font-semibold', GD.tinta)}>{c.codigo}</Ref></Td>
        <Td className="max-w-[26rem]">
          <span className={cn('block font-medium', GD.tinta)}>{c.nome}</span>
          {c.descricao && <span className={cn('block truncate text-sm', GD.meta)}>{c.descricao}</span>}
          {c.ativo === false && <span className={cn('block text-sm', GD.meta)}>Não se propõe em documentos novos</span>}
        </Td>
        <Td className={cn('hidden text-sm sm:table-cell', GD.meta)}>{tipos.get(c.tipo_codigo) || c.tipo_codigo || '—'}</Td>
        <Td numerico>
          <BotaoContagem total={c.total} aberta={aberta} aoAlternar={() => setAberta(v => !v)} rotulo={`documentos da classe ${c.codigo}`} />
        </Td>
        <Td>
          <AccoesLinha>
            {podeEscrever && <Button size="sm" variant="outline" onClick={() => aoEditar(c)}><Pencil className="h-4 w-4" aria-hidden="true" />Editar</Button>}
          </AccoesLinha>
        </Td>
      </Tr>
      {aberta && (
        <LinhaDocumentos colunas={COLUNAS_CLASSE}>
          <DocumentosDoCodigo dados={docs} vazio="Nenhum documento tem esta classe." />
        </LinhaDocumentos>
      )}
    </>
  );
}

// ── a página ────────────────────────────────────────────────────────────────
export default function PortalCodificacao() {
  const { user } = useAuth();
  const gestor = ehGestorDocs(user);
  const admin = ehAdminPortal(user);
  const recarregar = useRecarregarCodificacao();
  const cod = useCodificacao();
  const tiposQ = useTiposDocumento();
  const [busca, setBusca] = useState('');
  const [alvo, setAlvo] = useState(null);

  const tipos = useMemo(() => new Map((tiposQ.data || []).map(t => [t.codigo, t.nome])), [tiposQ.data]);
  const termo = busca.trim().toLowerCase();
  const processos = useMemo(
    () => (termo ? cod.processos.filter(p => bate(p.codigo, termo) || bate(p.nome, termo) || bate(p.descricao, termo)) : cod.processos),
    [cod.processos, termo],
  );
  const classes = useMemo(
    () => (termo ? cod.classes.filter(c => bate(c.codigo, termo) || bate(c.nome, termo) || bate(c.descricao, termo)) : cod.classes),
    [cod.classes, termo],
  );
  const feito = () => { recarregar(); setAlvo(null); };

  // Exportação (CSV / Excel / PDF): o que está à vista — respeita o filtro de texto.
  const linhasProc = processos.map(p => [p.codigo, p.nome || '', nomeSetor(cod.mapaSetores, p.setor_codigo) || 'Geral / Administração', p.ativo === false ? 'Inactivo' : 'Activo', p.total ?? 0, p.fonte_nome || '']);
  const linhasClasse = classes.map(c => [c.codigo, c.nome || '', tipos.get(c.tipo_codigo) || c.tipo_codigo || '', c.ativo === false ? 'Inactiva' : 'Activa', c.total ?? 0]);
  const cabProc = ['Código', 'Manual ou programa', 'Setor', 'Estado', 'Documentos', 'Origem do nome'];
  const cabClasse = ['Código', 'Classe', 'Tipo', 'Estado', 'Documentos'];
  const exCodificacao = {
    csv: () => descarregarCsv('Codificacao', ['Tabela', ...cabProc], [
      ...linhasProc.map(l => ['Manual ou programa', ...l]),
      ...linhasClasse.map(l => ['Classe', l[0], l[1], l[2], l[3], l[4], '']),
    ]),
    excel: () => exportarExcel('Codificacao', [
      { nome: 'Manuais e programas', cabecalho: cabProc, linhas: linhasProc },
      { nome: 'Classes', cabecalho: cabClasse, linhas: linhasClasse },
    ]),
    pdf: () => pdfDocumentos({
      base: 'Codificacao', titulo: 'Codificação de documentos', subtitulo: `Classes e manuais · ${new Date().toLocaleDateString('pt-PT')}`, geradoPor: user?.email,
      meta: [`${processos.length} manual(is) ou programa(s)`, `${classes.length} classe(s)`, ...(termo ? [`Filtro: «${busca.trim()}»`] : [])],
      seccoes: [
        { titulo: 'Manuais e programas', colunas: [{ label: 'Código', width: 20 }, { label: 'Manual ou programa', width: 80 }, { label: 'Setor', width: 50 }, { label: 'Estado', width: 18 }, { label: 'Docs', width: 16 }, { label: 'Origem do nome', width: 65 }], linhas: linhasProc },
        { titulo: 'Classes', colunas: [{ label: 'Código', width: 20 }, { label: 'Classe', width: 110 }, { label: 'Tipo', width: 60 }, { label: 'Estado', width: 20 }, { label: 'Docs', width: 20 }], linhas: linhasClasse },
      ],
    }),
  };

  if (cod.isError) {
    return (
      <PaginaGestao titulo="Codificação" descricao="Classes e manuais que dão sentido ao número de cada documento.">
        <Painel><Falha titulo="Não foi possível carregar a codificação" texto={cod.error?.message || 'Tente de novo; se continuar, avise a gestão documental.'} onTentar={() => cod.recarregar()} /></Painel>
      </PaginaGestao>
    );
  }

  return (
    <PaginaGestao
      titulo="Codificação"
      descricao="O número de um documento diz duas coisas: a classe — o que ele é — e o manual ou programa de que faz parte. É esta tabela que lhes dá nome, e é esse nome que aparece na biblioteca, na pesquisa e na ficha."
      accoes={<>
        <Exportar onCsv={exCodificacao.csv} onExcel={exCodificacao.excel} onPdf={exCodificacao.pdf} desactivado={cod.isLoading || (!processos.length && !classes.length)} />
        <Button variant="outline" onClick={() => cod.recarregar()} disabled={cod.isFetching}>
          <RefreshCw className={cn('h-4 w-4', cod.isFetching && 'animate-spin')} aria-hidden="true" />Actualizar
        </Button>
        {gestor && (
          <Button onClick={() => setAlvo({ modo: 'novo-processo', registo: null })}>
            <Plus className="h-4 w-4" aria-hidden="true" />Novo manual ou programa
          </Button>
        )}
      </>}
    >
      <Anatomia />

      <FaixaConfirmar processos={cod.porConfirmar} actor={user} podeEscrever={gestor} aoFeito={feito} />

      <div className="relative max-w-md">
        <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', GD.meta)} aria-hidden="true" />
        <Input
          value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Filtrar por código, nome ou descrição…"
          aria-label="Filtrar as classes e os manuais"
          className="h-11 pl-9"
        />
      </div>

      {/* ── manuais e programas ─────────────────────────────────────── */}
      <Painel>
        <Cabecalho
          titulo="Manuais e programas"
          contagem={termo ? `${processos.length} de ${cod.processos.length}` : cod.processos.length}
          icone={Layers}
          descricao="O terceiro segmento do número. É por aqui que um inspector procura: o Manual de Operações tem capítulos e apêndices, e o Plano de Emergência e o SGSO são apêndices dele."
        />
        <Tabela rotulo="Manuais e programas da codificação" altura={48} alturaMax="none">
          <thead>
            <tr>
              <Th estreito>Código</Th>
              <Th>Manual ou programa</Th>
              <Th className="hidden xl:table-cell">Origem do nome</Th>
              <Th numerico estreito>Documentos</Th>
              <Th estreito><span className="sr-only">Acções</span></Th>
            </tr>
          </thead>
          {cod.isLoading ? (
            <LinhasEsqueleto linhas={8} colunas={COLUNAS_PROCESSO} />
          ) : processos.length === 0 ? (
            <LinhaMensagem colunas={COLUNAS_PROCESSO}>
              <Vazio
                icone={Search}
                titulo={termo ? 'Nenhum manual corresponde ao filtro' : 'Ainda não há manuais nem programas'}
                texto={termo
                  ? 'Experimente o código (MOA, PSCI) ou uma palavra do nome.'
                  : 'Os códigos aparecem aqui assim que houver documentos numerados com eles; também os pode criar à mão.'}
              >
                {termo && <Button variant="outline" onClick={() => setBusca('')}>Limpar o filtro</Button>}
              </Vazio>
            </LinhaMensagem>
          ) : (
            <tbody>
              {processos.map(p => (
                <LinhaProcesso key={p.codigo} p={p} podeEscrever={gestor} mapaSetores={cod.mapaSetores} aoEditar={(r) => setAlvo({ modo: 'processo', registo: r })} />
              ))}
            </tbody>
          )}
        </Tabela>
        {!gestor && (
          <p className={cn('border-t px-3 py-2 text-sm', GD.borda, GD.meta)}>
            Os nomes dos manuais e programas são do gestor documental. Está a ver a codificação em leitura.
          </p>
        )}
      </Painel>

      {/* ── classes ─────────────────────────────────────────────────── */}
      <Painel>
        <Cabecalho
          titulo="Classes"
          contagem={termo ? `${classes.length} de ${cod.classes.length}` : cod.classes.length}
          icone={Tags}
          descricao="O prefixo do número: o que o documento é. Cada classe puxa consigo o tipo grosso do documento, que é o que a biblioteca usa nos filtros."
        />
        <Tabela rotulo="Classes da codificação" altura={48} alturaMax="none">
          <thead>
            <tr>
              <Th estreito>Código</Th>
              <Th>Classe</Th>
              <Th className="hidden sm:table-cell">Tipo</Th>
              <Th numerico estreito>Documentos</Th>
              <Th estreito><span className="sr-only">Acções</span></Th>
            </tr>
          </thead>
          {cod.isLoading ? (
            <LinhasEsqueleto linhas={6} colunas={COLUNAS_CLASSE} />
          ) : classes.length === 0 ? (
            <LinhaMensagem colunas={COLUNAS_CLASSE}>
              <Vazio
                icone={Search}
                titulo={termo ? 'Nenhuma classe corresponde ao filtro' : 'Ainda não há classes'}
                texto={termo ? 'Experimente o código (POP, FR, MA) ou uma palavra do nome.' : 'As classes são instaladas com a codificação.'}
              >
                {termo && <Button variant="outline" onClick={() => setBusca('')}>Limpar o filtro</Button>}
              </Vazio>
            </LinhaMensagem>
          ) : (
            <tbody>
              {classes.map(c => (
                <LinhaClasse key={c.codigo} c={c} tipos={tipos} podeEscrever={admin} aoEditar={(r) => setAlvo({ modo: 'classe', registo: r })} />
              ))}
            </tbody>
          )}
        </Tabela>
        {!admin && (
          <p className={cn('border-t px-3 py-2 text-sm', GD.borda, GD.meta)}>
            As classes são do administrador do portal: mudam o significado do prefixo em todos os documentos que já o usam. Está a vê-las em leitura.
          </p>
        )}
      </Painel>

      {/* ── o que fica de fora, dito em voz alta ─────────────────────── */}
      {!cod.isLoading && (cod.semClasse > 0 || cod.semProcesso > 0) && (
        <p className={cn('flex items-start gap-2 text-sm', GD.meta)}>
          <FileText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            De {cod.totalDocumentos} documentos,{' '}
            {cod.semClasse > 0 && <>{cod.semClasse === 1 ? '1 não tem classe' : `${cod.semClasse} não têm classe`}</>}
            {cod.semClasse > 0 && cod.semProcesso > 0 && ' e '}
            {cod.semProcesso > 0 && <>{cod.semProcesso === 1 ? '1 não tem manual atribuído' : `${cod.semProcesso} não têm manual atribuído`}</>}
            : o número não segue o padrão. Não é um erro a corrigir à força — há documentos antigos legítimos fora
            dele —, mas esses não aparecem nos filtros por manual nem por classe.
          </span>
        </p>
      )}

      {alvo && (
        <DialogCodificacao
          alvo={alvo}
          actor={user}
          temDescricaoClasse={cod.temDescricaoClasse}
          onFechar={() => setAlvo(null)}
          onFeito={feito}
        />
      )}
    </PaginaGestao>
  );
}
