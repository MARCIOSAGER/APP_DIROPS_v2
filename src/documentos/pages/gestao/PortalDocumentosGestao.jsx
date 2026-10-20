// Gestão de documentos: a bancada de trabalho do portal — lista densa com filtros no endereço, criar/editar,
// carregar o ficheiro para o armazenamento privado, nova versão e o percurso de estados (rascunho → em revisão →
// aprovado → em vigor → obsoleto).
// Cada linha mostra o que a lei manda ter à mão: número, estado, versão, entrada em vigor e validade.
// Quem aprova é o administrador do portal ou o responsável do aeroporto do documento
// (documentos_aeroporto_responsavel); a quem não o é o botão de aprovar não aparece — e a página explica porquê.
// O servidor é que decide o que cada pessoa vê e pode gravar (migrações 136a/136b/136c): aqui filtra-se só para o
// interface fazer sentido. A rota já envolve esta página em <PaginaGestao>, por isso o cabeçalho é próprio.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowUpCircle, Ban, CalendarClock, CheckCircle2, Copy, Download, Eye, FilePlus2,
  FileText, Fingerprint, Info, Loader2, Lock, MoreHorizontal, Pencil, RefreshCw, Send, ShieldCheck,
  Timer, Trash2, Upload, UserPlus, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import Select from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { fmtData, fmtDataHora } from '@/lib/safeDate';
import { supabase } from '@/lib/supabaseClient';
import { base44 } from '@/api/base44Client';
import { hashPassword } from '@/lib/hashPassword';
import { sanitizeFilename } from '@/lib/sanitize';
import { obterUrlAssinadaDocumento } from '@/functions/obterUrlAssinadaDocumento';
import {
  PORTAL_BASE, ESTADOS_DOCUMENTO, ESTADO_LABEL, PERFIS_PORTAL_DOCS, PERFIL_DOC_LABEL,
  ehAdminPortal, ehGestorDocs,
} from '@/lib/portalDocumentos';
import {
  useAeroportosDocs, useTiposDocumento, usePastasDocs, useResponsaveisAeroporto,
  useDocumentosDocs, useVersoesDocumento, useRecarregarDocs, auditarDocs,
  useAgendamentosVigor, agendarVigorVersao, cancelarAgendamentoVigor,
  useDuplicadosDocs, useSemImpressaoDigital, decidirDuplicado, reabrirDuplicado,
  impressaoDigital, gravarImpressaoDigital, documentosComMesmoFicheiro,
  useRetencaoDocs, useEliminacoesDocs, proporEliminacao, autorizarEliminacao, recusarEliminacao, executarEliminacao,
} from '../../hooks';
// Codificação (migração 157): o número de um documento é `CLASSE-AEROPORTO-PROCESSO-SEQ`. O formulário passa a
// perguntar as duas dimensões que o número carrega e a sugerir o número seguinte livre. SUGERE e VALIDA, não
// impõe: há documentos antigos legítimos fora do padrão e recusá-los seria estragar o arquivo.
import { useCodificacaoActiva, useNumeroSeguinte, useCodificacaoDocumentos } from '../../hooksCodificacao';
import { analisarNumero, EXEMPLO_NUMERO } from '../../apiCodificacao';
import { Ref } from '../../PortalLayout';
import { tituloLimpoDoc, formatoFicheiroDoc } from '../../nomeDocumento';
// Reserva para edição (migração 181): com o documento reservado por outra pessoa, não se cria revisão nova.
import { useReservaDocumento, bloqueioCarregamento } from '../../hooksEdicao';
import {
  EstadoChip, ValidadeChip, Vazio, Falha, mapaPorId, rotuloTipo, nomeAero, versaoDoc,
  OPCOES_ESTADO, OPCOES_VALIDADE, correspondeValidade, opcoesTipo, urlDoc, SEM_TIPO, correspondeTipo, FichasFiltro,
  SeloFormato,
} from '../PortalBiblioteca';
import {
  GD, Painel, Cabecalho, Tabela, Th, Tr, Td, AccoesLinha, LinhasEsqueleto, LinhaMensagem, Ficha,
  ResumoFiltros, CampoBusca, ComutadorDensidade, useDensidade, useFiltrosUrl, useBuscaDebounce,
  BarraSelecao, CelulaDocumento, textoVigor, DialogResponsavel,
} from './PortalGestaoPainel';

const CONFIDENCIALIDADE = [
  { value: 'interno', label: 'Interno — todos os membros com acesso à pasta' },
  { value: 'confidencial', label: 'Confidencial — acesso restrito, fica no registo' },
  { value: 'secreto', label: 'Secreto — sem links partilháveis com externos' },
];
const CONF_LABEL = { interno: 'Interno', confidencial: 'Confidencial', secreto: 'Secreto' };

// Caminho completo de uma pasta («Luanda / Operações / Manuais»), para os selectores e a lista.
function caminhoPasta(pastas, id, limite = 12) {
  const porId = mapaPorId(pastas);
  const partes = [];
  let actual = id ? porId.get(id) : null;
  let n = 0;
  while (actual && n < limite) { partes.unshift(actual.nome); actual = actual.pasta_pai_id ? porId.get(actual.pasta_pai_id) : null; n += 1; }
  return partes.join(' / ');
}

const hoje = () => new Date().toISOString().slice(0, 10);
const listaTags = (texto) => String(texto || '').split(',').map(t => t.trim()).filter(Boolean);
const nomeFicheiroDe = (uri) => String(uri || '').split('/').pop() || '';

// Percurso de estados. `aprova` marca os passos reservados a quem aprova (administrador do portal ou
// responsável do aeroporto do documento).
const PASSOS = {
  rascunho: [{ para: 'em_revisao', label: 'Enviar para revisão', icone: Send }],
  em_revisao: [
    { para: 'aprovado', label: 'Aprovar', icone: CheckCircle2, aprova: true },
    { para: 'rascunho', label: 'Devolver a rascunho', icone: X, variante: 'outline' },
  ],
  aprovado: [
    { para: 'em_vigor', label: 'Pôr em vigor', icone: ArrowUpCircle, aprova: true },
    { para: 'em_revisao', label: 'Voltar a revisão', icone: X, variante: 'outline' },
  ],
  em_vigor: [{ para: 'obsoleto', label: 'Marcar obsoleto', icone: X, variante: 'outline' }],
  obsoleto: [{ para: 'em_vigor', label: 'Repor em vigor', icone: ArrowUpCircle, aprova: true }],
};

function Campo({ id, label, ajuda, className, children }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {ajuda && <p className={cn('text-sm', GD.meta)}>{ajuda}</p>}
    </div>
  );
}

// ── o número do documento: sugerir e validar, nunca impor ───────────────────
// Debaixo do campo do número há no máximo uma coisa a dizer, e é esta a ordem de prioridade:
//   1. há um número sugerido e o campo não o tem → oferece-o num botão (nunca o impõe à força);
//   2. o número escrito não segue a codificação → di-lo, e diz logo que pode guardar assim mesmo;
//   3. o número segue a codificação → confirma-o em silêncio, com uma linha discreta.
// A terceira importa tanto como a segunda: sem ela, quem escreveu bem fica sem saber que escreveu bem.
function AvisoNumero({ numero, sugestao, aCalcular, avisos, conforme, aoUsarSugestao }) {
  const temSugestao = !!sugestao && sugestao !== String(numero || '').trim();
  return (
    <div className="space-y-1.5">
      {aCalcular && <p className={cn('flex items-center gap-1.5 text-sm', GD.meta)}><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />A procurar o número seguinte livre…</p>}
      {temSugestao && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('text-sm', GD.meta)}>Número seguinte livre:</span>
          <Button type="button" variant="outline" size="sm" onClick={() => aoUsarSugestao(sugestao)}>
            <Ref className="font-semibold">{sugestao}</Ref>
            <span className="sr-only">— usar este número</span>
          </Button>
          <span className={cn('text-sm', GD.meta)}>{numero?.trim() ? 'Substitui o que está escrito.' : 'Pode escrever outro.'}</span>
        </div>
      )}
      {avisos?.length > 0 && (
        <div className={cn('rounded-lg border p-2.5 text-sm', GD.avisoSuave)}>
          <p className="flex items-start gap-1.5 font-medium">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Este número foge à codificação da SGA
          </p>
          <ul className="ml-5 mt-1 list-disc space-y-0.5">{avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
          <p className="mt-1">Pode guardar assim: o portal não recusa números fora do padrão, só avisa.</p>
        </div>
      )}
      {conforme && (
        <p className={cn('flex items-center gap-1.5 text-sm', GD.bom)}>
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Segue a codificação da SGA.
        </p>
      )}
    </div>
  );
}

// Carregar o ficheiro para o armazenamento PRIVADO (bucket private-uploads): devolve só o caminho, que fica em
// arquivo_privado_uri. Nunca se grava um endereço público — os documentos servem-se por URL assinada.
function CampoFicheiro({ id, valor, nome, onCarregado, ajuda }) {
  const { toast } = useToast();
  const [aEnviar, setAEnviar] = useState(false);
  const escolher = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAEnviar(true);
    try {
      // Impressão digital do ficheiro escolhido, antes de o enviar: é ela que deixa ver que dois documentos são
      // o mesmo ficheiro. Não trava nada — o par mostra-se depois, no separador «Repetidos».
      const sha256 = await impressaoDigital(file);
      const r = await base44.integrations.Core.UploadPrivateFile({ file });
      const caminho = r?.path || r?.file_uri;
      if (!caminho) throw new Error('O servidor não devolveu o caminho do ficheiro.');
      onCarregado({ caminho, nome: sanitizeFilename(file.name), tamanho: file.size, mime: file.type || null, sha256 });
      toast({ title: 'Ficheiro carregado', description: 'Guarde as alterações para o associar ao documento.' });
    } catch (err) {
      toast({ title: 'Não foi possível carregar o ficheiro', description: err?.message || String(err), variant: 'destructive' });
    } finally { setAEnviar(false); }
  };
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Ficheiro</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input id={id} type="file" className="sr-only" onChange={escolher} aria-label="Escolher ficheiro" />
        <Button type="button" variant="outline" disabled={aEnviar} onClick={() => document.getElementById(id)?.click()} className="min-h-[2.75rem]">
          {aEnviar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
          {valor ? 'Substituir ficheiro' : 'Carregar ficheiro'}
        </Button>
        {valor && <span className={cn('inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-sm', GD.superficieFraca, GD.tintaMedia)}><Lock className="h-3 w-3 shrink-0" aria-hidden="true" />{nome || nomeFicheiroDe(valor)}</span>}
      </div>
      <p className={cn('text-sm', GD.meta)}>{ajuda || 'Fica no armazenamento privado e só se abre por endereço assinado de curta duração.'}</p>
    </div>
  );
}

// ── criar / editar documento ────────────────────────────────────────────────
function DialogDocumento({ doc, pastaInicial, aeroportoInicial, actor, aeroportos, tipos, pastas, onFechar, onFeito }) {
  const { toast } = useToast();
  const novo = !doc?.id;
  const [f, setF] = useState(() => ({
    titulo: doc?.titulo || '',
    numero: doc?.numero || '',
    classe_codigo: doc?.classe_codigo || '',
    processo_codigo: doc?.processo_codigo || '',
    descricao: doc?.descricao || '',
    tipo_id: doc?.tipo_id || '',
    entidade_emissora: doc?.entidade_emissora || '',
    pasta_id: doc?.pasta_id || pastaInicial || '',
    aeroporto_id: doc?.aeroporto_id || aeroportoInicial || '',
    responsavel_email: doc?.responsavel_email || '',
    publicacao_em: doc?.publicacao_em || '',
    em_vigor_desde: doc?.em_vigor_desde || '',
    expira_em: doc?.expira_em || '',
    tags: (Array.isArray(doc?.tags) ? doc.tags : []).join(', '),
    nivel_confidencialidade: doc?.nivel_confidencialidade || 'interno',
    bloquear_download: !!doc?.bloquear_download,
    requer_senha_adicional: !!doc?.requer_senha_adicional,
    exige_leitura: !!doc?.exige_leitura,
    leitura_perfis: Array.isArray(doc?.leitura_perfis) ? doc.leitura_perfis.filter(Boolean) : [],
    leitura_prazo_dias: doc?.leitura_prazo_dias ?? '',
    senha: '',
    arquivo_privado_uri: doc?.arquivo_privado_uri || '',
    arquivo_nome: '',
    sha256: null,
  }));
  const [busy, setBusy] = useState(false);
  // Pares encontrados à entrada: mostram-se, não travam o carregamento (desenho do Paperless).
  const [repetidos, setRepetidos] = useState([]);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const alternarPerfil = (p) => setF(x => {
    const s = new Set(x.leitura_perfis || []);
    if (s.has(p)) s.delete(p); else s.add(p);
    return { ...x, leitura_perfis: [...s] };
  });

  // A pasta escolhida sugere o aeroporto (cada pasta pertence a um aeroporto).
  const pastaEscolhida = useMemo(() => pastas.find(p => p.id === f.pasta_id) || null, [pastas, f.pasta_id]);
  useEffect(() => {
    if (pastaEscolhida?.aeroporto_id && !f.aeroporto_id) set('aeroporto_id', pastaEscolhida.aeroporto_id);
  }, [pastaEscolhida]);

  // ── codificação ───────────────────────────────────────────────────────────
  const cod = useCodificacaoActiva();
  const codDocsQ = useCodificacaoDocumentos();
  // A lista de documentos da gestão não traz as colunas da codificação (COLS_DOC, em hooks.js). Para editar um
  // documento sem lhe apagar a classe e o manual, a tabela leve de id → códigos — que já está em cache — enche-as
  // uma vez. Enquanto ela não chegar, o `guardar` nem envia essas duas colunas: um campo que não se sabe ler não
  // se pode gravar por cima.
  const codificacaoPronta = useRef(novo);
  useEffect(() => {
    if (novo || codificacaoPronta.current || !doc?.id || !codDocsQ.data) return;
    const linha = codDocsQ.data.find(x => x.id === doc.id);
    codificacaoPronta.current = true;
    if (!linha) return;
    setF(x => ({
      ...x,
      classe_codigo: x.classe_codigo || linha.classe_codigo || '',
      processo_codigo: x.processo_codigo || linha.processo_codigo || '',
    }));
  }, [codDocsQ.data, doc?.id, novo]);

  const icaoAeroporto = useMemo(
    () => (aeroportos.find(a => a.id === f.aeroporto_id)?.codigo_icao || '').toUpperCase(),
    [aeroportos, f.aeroporto_id],
  );
  const sugestaoQ = useNumeroSeguinte(f.classe_codigo, icaoAeroporto, f.processo_codigo);
  const sugestao = sugestaoQ.data || '';
  // Preencher o número de um documento NOVO que ainda não tem nenhum é o caso comum e não surpreende ninguém: o
  // campo fica à vista e editável. Depois de alguém lhe pôr a mão, a sugestão passa a ser só um botão.
  const numeroTocado = useRef(!novo || !!doc?.numero);
  useEffect(() => {
    if (numeroTocado.current || !sugestao) return;
    setF(x => (x.numero.trim() ? x : { ...x, numero: sugestao }));
  }, [sugestao]);
  const escreverNumero = (v) => { numeroTocado.current = true; set('numero', v); };

  // Avisos sobre o número escrito à mão. Nunca travam o `guardar`.
  const analise = useMemo(
    () => analisarNumero(f.numero, { classes: cod.classes, processos: cod.processos, aeroportoCodigo: icaoAeroporto }),
    [f.numero, cod.classes, cod.processos, icaoAeroporto],
  );
  // O erro realista não é a forma do número: é escolher o manual numa caixa e escrever outro no número.
  const avisosNumero = useMemo(() => {
    const lista = [...analise.avisos];
    const p = analise.partes;
    if (p) {
      if (f.classe_codigo && p.classe !== f.classe_codigo) lista.push(`O número diz a classe ${p.classe} mas em cima está escolhida a classe ${f.classe_codigo}.`);
      if (f.processo_codigo && p.processo !== f.processo_codigo) lista.push(`O número diz o manual ${p.processo} mas em cima está escolhido o ${f.processo_codigo}.`);
    }
    return lista;
  }, [analise, f.classe_codigo, f.processo_codigo]);

  const opcoesClasse = useMemo(() => [
    { value: '', label: '— sem classe —' },
    ...cod.classesActivas.map(c => ({ value: c.codigo, label: `${c.codigo} · ${c.nome}` })),
  ], [cod.classesActivas]);
  const opcoesProcesso = useMemo(() => [
    { value: '', label: '— sem manual nem programa —' },
    ...cod.processosActivos.map(p => ({ value: p.codigo, label: p.nome ? `${p.codigo} · ${p.nome}` : p.codigo })),
  ], [cod.processosActivos]);

  const guardar = async () => {
    if (!f.titulo.trim()) { toast({ title: 'Indique o título do documento', variant: 'destructive' }); return; }
    if (f.expira_em && f.em_vigor_desde && f.expira_em < f.em_vigor_desde) { toast({ title: 'A validade termina antes de entrar em vigor', description: 'Verifique as datas.', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const patch = {
        titulo: f.titulo.trim(),
        numero: f.numero.trim() || null,
        descricao: f.descricao.trim() || null,
        tipo_id: f.tipo_id || null,
        entidade_emissora: f.entidade_emissora.trim() || null,
        pasta_id: f.pasta_id || null,
        aeroporto_id: f.aeroporto_id || null,
        responsavel_email: f.responsavel_email.trim().toLowerCase() || null,
        publicacao_em: f.publicacao_em || null,
        em_vigor_desde: f.em_vigor_desde || null,
        expira_em: f.expira_em || null,
        tags: listaTags(f.tags),
        nivel_confidencialidade: f.nivel_confidencialidade,
        bloquear_download: !!f.bloquear_download,
        requer_senha_adicional: !!f.requer_senha_adicional,
        exige_leitura: !!f.exige_leitura,
        leitura_perfis: f.exige_leitura && f.leitura_perfis.length ? f.leitura_perfis : null,
        leitura_prazo_dias: f.exige_leitura && f.leitura_prazo_dias ? Number(f.leitura_prazo_dias) : null,
        updated_date: new Date().toISOString(),
      };
      // Só se gravam as duas colunas da codificação quando se sabe o que elas tinham: num documento novo, ou
      // depois de a tabela leve as ter trazido. De outro modo, abrir e guardar um documento apagava-lhe a classe
      // e o manual sem ninguém ter mexido em nada.
      if (codificacaoPronta.current) {
        patch.classe_codigo = f.classe_codigo || null;
        patch.processo_codigo = f.processo_codigo || null;
      }
      if (f.arquivo_privado_uri) { patch.arquivo_privado_uri = f.arquivo_privado_uri; patch.usar_storage_privado = true; patch.arquivo_url = null; }
      if (f.sha256) { patch.sha256 = f.sha256; patch.sha256_em = new Date().toISOString(); }
      if (f.requer_senha_adicional && f.senha) patch.senha_hash = await hashPassword(f.senha);
      if (!f.requer_senha_adicional) patch.senha_hash = null;

      if (novo) {
        const { data, error } = await supabase.from('documento').insert({
          ...patch, estado: 'rascunho', versao: '1', versao_atual: 1,
          created_by: actor?.email || null, created_date: new Date().toISOString(),
        }).select('id,titulo').single();
        if (error) throw error;
        // primeira versão no histórico, para o documento nunca ficar sem rasto
        if (f.arquivo_privado_uri) {
          await supabase.from('documento_versao').insert({
            documento_id: data.id, versao: 1, rotulo: '1', arquivo_uri: f.arquivo_privado_uri,
            arquivo_nome: f.arquivo_nome || nomeFicheiroDe(f.arquivo_privado_uri), nota: 'Versão inicial',
            estado: 'rascunho', criado_por: actor?.email || null, sha256: f.sha256 || null,
          });
        }
        await auditarDocs(actor, { acao: 'documento_criado', id: data.id, detalhes: `Documento criado: ${data.titulo}` });
        toast({ title: 'Documento criado', description: 'Está em rascunho: carregue o ficheiro e envie para revisão.' });
      } else {
        const { error } = await supabase.from('documento').update(patch).eq('id', doc.id);
        if (error) throw error;
        await auditarDocs(actor, { acao: 'documento_editado', id: doc.id, detalhes: `Documento alterado: ${patch.titulo}` });
        toast({ title: 'Documento actualizado' });
      }
      onFeito();
    } catch (e) {
      toast({ title: 'Não foi possível guardar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const opcoesPasta = [{ value: '', label: '— sem pasta (fica fora da biblioteca) —' }, ...pastas.map(p => ({ value: p.id, label: caminhoPasta(pastas, p.id) || p.nome }))];
  const opcoesAero = [{ value: '', label: '— sem aeroporto (documento geral) —' }, ...aeroportos.map(a => ({ value: a.id, label: nomeAero(mapaPorId(aeroportos), a.id) }))];

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-teal-600" aria-hidden="true" />{novo ? 'Novo documento' : 'Editar documento'}</DialogTitle>
          <DialogDescription>{novo ? 'O documento nasce em rascunho. Só fica visível a quem consulta quando estiver em vigor.' : `Versão actual: ${versaoDoc(doc)} · estado: ${ESTADO_LABEL[doc.estado] || doc.estado}`}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="dc-titulo" label="Título *" className="sm:col-span-2"><Input id="dc-titulo" value={f.titulo} onChange={e => set('titulo', e.target.value)} maxLength={300} autoComplete="off" /></Campo>
          {/* ── codificação: a classe e o manual escrevem-se no número, por isso vêm antes dele ── */}
          <Campo
            id="dc-classe" label="Classe"
            ajuda="O que o documento é. É o prefixo do número e arrasta consigo o tipo."
          >
            <Select id="dc-classe" options={opcoesClasse} value={f.classe_codigo} onValueChange={v => set('classe_codigo', v)} />
          </Campo>
          <Campo
            id="dc-processo" label="Manual ou programa"
            ajuda="De que manual, plano ou programa este documento faz parte. É por aqui que um inspector procura."
          >
            <Select id="dc-processo" options={opcoesProcesso} value={f.processo_codigo} onValueChange={v => set('processo_codigo', v)} />
          </Campo>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="dc-numero">Número / referência</Label>
            <Input id="dc-numero" value={f.numero} onChange={e => escreverNumero(e.target.value)} maxLength={120} autoComplete="off" className={cn(GD.ref, 'sm:max-w-sm')} />
            <p className={cn('text-sm', GD.meta)}>
              Classe-aeroporto-manual-sequência (ex.: {EXEMPLO_NUMERO}). Documentos de fora da SGA guardam o número
              da entidade que os emitiu (ex.: Instrutivo 22A.117.001.A) — isso não é um erro.
            </p>
            <AvisoNumero
              numero={f.numero}
              sugestao={sugestao}
              aCalcular={sugestaoQ.isFetching && !sugestao}
              avisos={avisosNumero}
              conforme={analise.estado === 'conforme' && avisosNumero.length === 0}
              aoUsarSugestao={escreverNumero}
            />
          </div>

          <Campo id="dc-tipo" label="Tipo"><Select id="dc-tipo" options={[{ value: '', label: '— sem tipo —' }, ...(tipos || []).map(t => ({ value: t.id, label: t.nome }))]} value={f.tipo_id} onValueChange={v => set('tipo_id', v)} /></Campo>
          <Campo id="dc-emissor" label="Entidade emissora" ajuda="Quem emitiu: SGA, ANAC, ICAO, IATA…"><Input id="dc-emissor" value={f.entidade_emissora} onChange={e => set('entidade_emissora', e.target.value)} maxLength={160} autoComplete="off" /></Campo>
          <Campo id="dc-resp" label="Responsável (email)" ajuda="Mantém o documento actualizado e recebe os avisos de validade."><Input id="dc-resp" type="email" value={f.responsavel_email} onChange={e => set('responsavel_email', e.target.value)} placeholder="nome@sga.co.ao" autoComplete="off" /></Campo>
          <Campo id="dc-pasta" label="Pasta"><Select id="dc-pasta" options={opcoesPasta} value={f.pasta_id} onValueChange={v => set('pasta_id', v)} /></Campo>
          <Campo id="dc-aero" label="Aeroporto" ajuda="Define quem vê o documento quando a pasta não tem permissões próprias."><Select id="dc-aero" options={opcoesAero} value={f.aeroporto_id} onValueChange={v => set('aeroporto_id', v)} /></Campo>
          <Campo id="dc-desc" label="Descrição" className="sm:col-span-2"><Textarea id="dc-desc" value={f.descricao} onChange={e => set('descricao', e.target.value)} rows={3} maxLength={2000} /></Campo>

          <Campo id="dc-pub" label="Publicação"><Input id="dc-pub" type="date" value={f.publicacao_em || ''} onChange={e => set('publicacao_em', e.target.value)} /></Campo>
          <Campo id="dc-vig" label="Entrada em vigor"><Input id="dc-vig" type="date" value={f.em_vigor_desde || ''} onChange={e => set('em_vigor_desde', e.target.value)} /></Campo>
          <Campo id="dc-exp" label="Validade (expira em)" ajuda="Vazio = não expira. Entra nos avisos de 30/60/90 dias."><Input id="dc-exp" type="date" value={f.expira_em || ''} onChange={e => set('expira_em', e.target.value)} /></Campo>
          <Campo id="dc-tags" label="Etiquetas" ajuda="Separadas por vírgula; usadas na pesquisa."><Input id="dc-tags" value={f.tags} onChange={e => set('tags', e.target.value)} placeholder="segurança, pista, RTA" autoComplete="off" /></Campo>

          <Campo id="dc-conf" label="Confidencialidade" className="sm:col-span-2"><Select id="dc-conf" options={CONFIDENCIALIDADE} value={f.nivel_confidencialidade} onValueChange={v => set('nivel_confidencialidade', v)} /></Campo>

          <div className="sm:col-span-2">
            <CampoFicheiro
              id="dc-ficheiro" valor={f.arquivo_privado_uri} nome={f.arquivo_nome}
              onCarregado={async ({ caminho, nome, sha256 }) => {
                setF(x => ({ ...x, arquivo_privado_uri: caminho, arquivo_nome: nome, sha256: sha256 || null, titulo: x.titulo || nome.replace(/\.[^/.]+$/, '') }));
                setRepetidos(sha256 ? await documentosComMesmoFicheiro(sha256, { excepto: doc?.id }) : []);
              }}
            />
            {repetidos.length > 0 && (
              <div className={cn('mt-2 rounded-lg border p-3 text-sm', GD.avisoSuave)}>
                <p className="font-medium">Este ficheiro já está no portal{repetidos.length > 1 ? ` (${repetidos.length} vezes)` : ''}.</p>
                <ul className="mt-1 space-y-0.5">
                  {repetidos.map(d => (
                    <li key={d.id} className="truncate">
                      {d.numero && <span className={GD.ref}>{d.numero} · </span>}{d.titulo}
                    </li>
                  ))}
                </ul>
                <p className="mt-1">Pode guardar: o par fica marcado no separador «Repetidos», para alguém decidir se são dois exemplares legítimos.</p>
              </div>
            )}
          </div>

          <div className={cn('space-y-3 rounded-lg border p-3 sm:col-span-2', GD.borda)}>
            <div className="flex items-start justify-between gap-4">
              <div><Label htmlFor="dc-bloq" className="font-medium">Bloquear descarga</Label><p className={cn('text-sm', GD.meta)}>Quem consulta só vê o documento no portal; não há botão para descarregar.</p></div>
              <Switch id="dc-bloq" checked={f.bloquear_download} onCheckedChange={v => set('bloquear_download', v)} />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div><Label htmlFor="dc-senha-sw" className="font-medium">Pedir senha adicional</Label><p className={cn('text-sm', GD.meta)}>Além de ter acesso, é preciso introduzir uma senha para abrir o documento.</p></div>
              <Switch id="dc-senha-sw" checked={f.requer_senha_adicional} onCheckedChange={v => set('requer_senha_adicional', v)} />
            </div>
            {f.requer_senha_adicional && (
              <Campo id="dc-senha" label="Senha do documento" ajuda={novo ? 'Entregue a senha por outro meio a quem precisa de abrir o documento.' : 'Deixe em branco para manter a senha actual.'}>
                <Input id="dc-senha" type="text" value={f.senha} onChange={e => set('senha', e.target.value)} autoComplete="new-password" placeholder="uma frase curta" />
              </Campo>
            )}
          </div>

          {/* Confirmação de leitura: é isto que faz um documento entrar nas «leituras em falta» do painel. */}
          <div className={cn('space-y-3 rounded-lg border p-3 sm:col-span-2', GD.borda)}>
            <div className="flex items-start justify-between gap-4">
              <div><Label htmlFor="dc-leitura" className="font-medium">Exigir «li e tomei conhecimento»</Label><p className={cn('text-sm', GD.meta)}>Pede confirmação a quem abre o documento e deixa provar, numa auditoria, quem tomou conhecimento.</p></div>
              <Switch id="dc-leitura" checked={f.exige_leitura} onCheckedChange={v => set('exige_leitura', v)} />
            </div>
            {f.exige_leitura && (
              <>
                <fieldset className="space-y-1.5">
                  <legend className={cn('text-sm font-medium', GD.tintaMedia)}>A quem se pede (nenhum escolhido = a todos os que vêem o documento)</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {PERFIS_PORTAL_DOCS.map(p => (
                      <Ficha key={p.chave} activa={(f.leitura_perfis || []).includes(p.chave)} aoClicar={() => alternarPerfil(p.chave)}>{PERFIL_DOC_LABEL[p.chave]}</Ficha>
                    ))}
                  </div>
                </fieldset>
                <Campo id="dc-prazo" label="Prazo para confirmar (dias)" ajuda="Vazio = sem prazo. Conta a partir da entrada em vigor.">
                  <Input id="dc-prazo" type="number" min={1} max={365} value={f.leitura_prazo_dias} onChange={e => set('leitura_prazo_dias', e.target.value)} className="max-w-[8rem]" />
                </Campo>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={busy}>Cancelar</Button>
          <Button onClick={guardar} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{novo ? 'Criar documento' : 'Guardar alterações'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── nova versão ─────────────────────────────────────────────────────────────
function DialogNovaVersao({ doc, actor, podeSubstituirSemRevisao, onFechar, onFeito }) {
  const { toast } = useToast();
  const { data: versoes = [], isLoading } = useVersoesDocumento(doc.id);
  const proxima = useMemo(() => Math.max(Number(doc.versao_atual) || 0, ...versoes.map(v => Number(v.versao) || 0)) + 1, [doc, versoes]);
  const [rotulo, setRotulo] = useState('');
  const [nota, setNota] = useState('');
  const [ficheiro, setFicheiro] = useState({ caminho: '', nome: '', tamanho: null, mime: null, sha256: null });
  // Por omissão a revisão nova entra em RASCUNHO e o documento em vigor não muda (segue depois o fluxo de aprovação).
  const [modo, setModo] = useState('rascunho');
  const [dataVigor, setDataVigor] = useState('');
  const [busy, setBusy] = useState(false);
  const reservaQ = useReservaDocumento(doc.id);
  const bloqueio = bloqueioCarregamento(reservaQ.data, actor?.email, { fmt: (d) => fmtData(d) });

  const submeter = async () => {
    if (bloqueio) { toast({ title: 'Documento reservado para edição', description: bloqueio, variant: 'destructive' }); return; }
    if (!ficheiro.caminho) { toast({ title: 'Carregue o ficheiro da nova versão', variant: 'destructive' }); return; }
    if (modo === 'agendar' && !dataVigor) { toast({ title: 'Indique a data de entrada em vigor', description: 'É a data que a autoridade aprovou.', variant: 'destructive' }); return; }
    if (modo === 'agendar' && dataVigor < hoje()) { toast({ title: 'A data já passou', description: 'Para pôr em vigor agora, escolha «Substituir sem revisão».', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const agora = new Date().toISOString();
      // Estado da REVISÃO nova. No agendamento fica «aprovado» à espera da data: o documento continua a servir a
      // revisão anterior, que é o que a lei manda — até à data marcada, em vigor está a antiga.
      const estadoVersao = modo === 'rascunho' ? 'rascunho' : modo === 'revisao' ? 'em_revisao' : modo === 'agendar' ? 'aprovado' : (doc.estado || 'em_vigor');

      // Nunca duas revisões em vigor: a anterior sai antes de a nova entrar (a base também o recusa, por índice
      // único — isto evita o erro em vez de o apanhar).
      if (estadoVersao === 'em_vigor') {
        await supabase.from('documento_versao')
          .update({ estado: 'obsoleto', vigor_ate: hoje() })
          .eq('documento_id', doc.id).eq('estado', 'em_vigor');
      }

      const { error: erroV } = await supabase.from('documento_versao').insert({
        documento_id: doc.id, versao: proxima, rotulo: rotulo.trim() || String(proxima),
        arquivo_uri: ficheiro.caminho, arquivo_nome: ficheiro.nome || nomeFicheiroDe(ficheiro.caminho),
        tamanho: ficheiro.tamanho || null, mime: ficheiro.mime || null, sha256: ficheiro.sha256 || null,
        nota: nota.trim() || null, estado: estadoVersao, criado_por: actor?.email || null,
        ...(modo === 'agendar'
          ? { vigor_desde: dataVigor, agendada_por: actor?.email || null, agendada_em: agora, agendamento_nota: nota.trim() || null }
          : {}),
      });
      if (erroV) throw erroV;

      // O agendamento NÃO mexe no documento: só na data marcada é que a revisão nova passa a ser a do documento.
      // O rascunho também não: o documento continua a servir a revisão em vigor até a nova ser aprovada.
      if (modo !== 'agendar' && modo !== 'rascunho') {
        const { error } = await supabase.from('documento').update({
          versao: rotulo.trim() || String(proxima), versao_atual: proxima,
          arquivo_privado_uri: ficheiro.caminho, usar_storage_privado: true, arquivo_url: null,
          ...(ficheiro.sha256 ? { sha256: ficheiro.sha256, sha256_em: agora } : {}),
          estado: estadoVersao, updated_date: agora,
        }).eq('id', doc.id);
        if (error) throw error;
      }

      const descricaoModo = modo === 'rascunho' ? ' (rascunho)' : modo === 'revisao' ? ' (enviada para revisão)'
        : modo === 'agendar' ? ` (entra em vigor em ${fmtData(dataVigor)})`
          : ' (substituição sem revisão)';
      await auditarDocs(actor, { acao: 'documento_nova_versao', id: doc.id, detalhes: `Versão ${proxima} de «${doc.titulo}»${descricaoModo}` });
      toast({
        title: `Versão ${proxima} criada`,
        description: modo === 'rascunho' ? 'Ficou em rascunho: o documento em vigor não mudou. Peça a aprovação na ficha do documento.'
          : modo === 'revisao' ? 'O documento ficou em revisão até ser aprovado de novo.'
          : modo === 'agendar' ? `Fica à espera: em ${fmtData(dataVigor)} entra em vigor sozinha e a anterior passa a obsoleta. Até lá, quem consulta vê a versão ${versaoDoc(doc)}.`
            : 'O ficheiro foi substituído; o estado do documento manteve-se.',
      });
      onFeito();
    } catch (e) {
      toast({ title: 'Não foi possível criar a versão', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const opcoesModo = [
    { value: 'rascunho', label: 'Guardar em rascunho (o documento em vigor não muda; segue depois para aprovação)' },
    ...(podeSubstituirSemRevisao ? [
      { value: 'agendar', label: 'Agendar a entrada em vigor para uma data' },
      { value: 'substituir', label: 'Substituir sem revisão (mantém o estado actual)' },
    ] : []),
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5 text-teal-600" aria-hidden="true" />Nova versão</DialogTitle>
          <DialogDescription className="break-words">{doc.titulo} · versão actual {versaoDoc(doc)} → nova versão {proxima}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {bloqueio && <p role="alert" className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.avisoSuave)}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{bloqueio}</p>}
          <CampoFicheiro id="nv-ficheiro" valor={ficheiro.caminho} nome={ficheiro.nome} onCarregado={setFicheiro} ajuda="A versão anterior mantém-se no histórico do documento." />
          <Campo id="nv-rotulo" label="Rótulo da versão" ajuda={`Vazio = «${proxima}». Use por exemplo «3.ª edição» ou «Rev. B».`}><Input id="nv-rotulo" value={rotulo} onChange={e => setRotulo(e.target.value)} maxLength={60} autoComplete="off" /></Campo>
          <Campo id="nv-nota" label="O que mudou" ajuda="Fica no histórico de versões e ajuda quem lê a saber o que rever."><Textarea id="nv-nota" value={nota} onChange={e => setNota(e.target.value)} rows={3} maxLength={1000} /></Campo>
          <Campo id="nv-modo" label="Depois de criar a versão"><Select id="nv-modo" options={opcoesModo} value={modo} onValueChange={setModo} /></Campo>
          {modo === 'agendar' && (
            <>
              <Campo id="nv-data" label="Entra em vigor em *" ajuda="A data que a autoridade aprovou. Até lá, quem consulta continua a ver a versão actual.">
                <Input id="nv-data" type="date" min={hoje()} value={dataVigor} onChange={e => setDataVigor(e.target.value)} className="max-w-[12rem]" />
              </Campo>
              <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.borda, GD.superficieFraca, GD.tintaMedia)}>
                <CalendarClock className={cn('mt-0.5 h-4 w-4 shrink-0', GD.acento)} aria-hidden="true" />
                <span>
                  Nessa data a troca faz-se sozinha: a versão {proxima} entra em vigor e a {versaoDoc(doc)} passa a
                  obsoleta. Ninguém tem de clicar — quem conta o tempo é o agendador, que passa de 15 em 15 minutos.
                  Nunca há duas em vigor ao mesmo tempo.
                </span>
              </p>
            </>
          )}
          {!isLoading && versoes.length > 0 && (
            <div className={cn('rounded-lg border p-3 text-sm', GD.borda)}>
              <p className={cn('mb-1 font-medium', GD.tintaMedia)}>Histórico</p>
              <ul className={cn('space-y-0.5', GD.meta)}>{versoes.slice(0, 5).map(v => <li key={v.id}><span className={GD.ref}>v{v.rotulo || v.versao}</span> · {fmtData(v.created_date)} · {v.criado_por || '—'}{v.nota ? ` · ${v.nota}` : ''}</li>)}</ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={busy}>Cancelar</Button>
          <Button onClick={submeter} disabled={busy || !!bloqueio}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FilePlus2 className="h-4 w-4" aria-hidden="true" />}Criar versão {proxima}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── entrada em vigor agendada ───────────────────────────────────────────────
// Marcar a data numa revisão que já está aprovada (o caso em que a aprovação da ANAC chega depois de a revisão
// estar pronta). Criar uma revisão nova já com data faz-se em «Nova versão → Agendar».
function DialogAgendarVigor({ doc, actor, onFechar, onFeito }) {
  const { toast } = useToast();
  const { data: versoes = [], isLoading, isError, refetch } = useVersoesDocumento(doc.id);
  // Só revisões aprovadas podem ser agendadas para entrar em vigor — nunca a «Fonte editável» (.docx de origem),
  // que é o mesmo documento noutro formato e não se põe em vigor.
  const candidatas = useMemo(() => versoes.filter(v => v.estado === 'aprovado' && !/^\s*fonte\s*edit/i.test(String(v.rotulo || ''))), [versoes]);
  const [versaoId, setVersaoId] = useState('');
  const [data, setData] = useState('');
  const [nota, setNota] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!versaoId && candidatas.length) {
      const alvo = candidatas[0];
      setVersaoId(alvo.id);
      setData(alvo.vigor_desde || '');
      setNota(alvo.agendamento_nota || '');
    }
  }, [candidatas, versaoId]);

  const escolhida = candidatas.find(v => v.id === versaoId) || null;

  const guardar = async () => {
    if (!versaoId || !data) { toast({ title: 'Escolha a revisão e a data', variant: 'destructive' }); return; }
    if (data < hoje()) { toast({ title: 'A data já passou', description: 'Para pôr em vigor agora, use «Pôr em vigor» na lista.', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      await agendarVigorVersao({ versaoId, data, nota }, actor);
      await auditarDocs(actor, {
        acao: 'documento_vigor_agendado', id: doc.id,
        detalhes: `Entrada em vigor da revisão ${escolhida?.rotulo || escolhida?.versao} de «${doc.titulo}» marcada para ${fmtData(data)}`,
      });
      toast({ title: 'Data marcada', description: `Em ${fmtData(data)} a revisão entra em vigor sozinha e a anterior passa a obsoleta.` });
      onFeito();
    } catch (e) {
      toast({ title: 'Não foi possível marcar a data', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-teal-600" aria-hidden="true" />Agendar a entrada em vigor</DialogTitle>
          <DialogDescription className="break-words">{doc.numero ? `${doc.numero} · ` : ''}{doc.titulo}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2" aria-busy="true"><span className="sr-only">A carregar as revisões…</span><div className={cn('h-10 animate-pulse rounded', GD.superficieFraca)} /><div className={cn('h-10 animate-pulse rounded', GD.superficieFraca)} /></div>
        ) : isError ? (
          <Falha titulo="Não foi possível carregar as revisões" onTentar={() => refetch()} />
        ) : candidatas.length === 0 ? (
          <Vazio
            icone={CalendarClock}
            titulo="Não há revisão aprovada à espera"
            texto="Só se marca data a uma revisão já aprovada. Crie a revisão nova em «Nova versão» e escolha lá «Agendar a entrada em vigor», ou aprove primeiro a revisão que está em apreciação."
          />
        ) : (
          <div className="space-y-4">
            <Campo id="av-versao" label="Revisão que espera a data">
              <Select
                id="av-versao"
                options={candidatas.map(v => ({ value: v.id, label: `Revisão ${v.rotulo || v.versao}${v.vigor_desde ? ` · já marcada para ${fmtData(v.vigor_desde)}` : ''}` }))}
                value={versaoId}
                onValueChange={(v) => { const alvo = candidatas.find(x => x.id === v); setVersaoId(v); setData(alvo?.vigor_desde || ''); setNota(alvo?.agendamento_nota || ''); }}
              />
            </Campo>
            <Campo id="av-data" label="Entra em vigor em *" ajuda="A data aprovada pela autoridade. Até lá, em vigor continua a revisão anterior.">
              <Input id="av-data" type="date" min={hoje()} value={data} onChange={e => setData(e.target.value)} className="max-w-[12rem]" />
            </Campo>
            <Campo id="av-nota" label="Nota" ajuda="Por exemplo o ofício da ANAC que aprovou a emenda. Fica no registo.">
              <Textarea id="av-nota" value={nota} onChange={e => setNota(e.target.value)} rows={2} maxLength={500} />
            </Campo>
            <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.borda, GD.superficieFraca, GD.tintaMedia)}>
              <Info className={cn('mt-0.5 h-4 w-4 shrink-0', GD.acento)} aria-hidden="true" />
              A passagem é automática: o agendador passa de 15 em 15 minutos e, na data, troca as revisões. Nunca
              ficam duas em vigor — a base de dados recusa-o.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={busy}>Cancelar</Button>
          {candidatas.length > 0 && (
            <Button onClick={guardar} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CalendarClock className="h-4 w-4" aria-hidden="true" />}Marcar a data
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Tira de agendamentos por cima da lista. Só aparece quando há datas marcadas: um painel vazio não ocupa ecrã.
function PainelAgendamentos({ agendamentos, docsPorId, aeroportos, onRetirar }) {
  if (!agendamentos.length) return null;
  const hojeTexto = hoje();
  return (
    <Painel>
      <Cabecalho
        icone={CalendarClock}
        titulo="Entradas em vigor marcadas"
        contagem={agendamentos.length}
        descricao="A revisão anterior mantém-se em vigor até à data. Na data, a nova entra sozinha — ninguém tem de clicar."
      />
      <Tabela altura={40} alturaMax="18rem" rotulo="Entradas em vigor marcadas">
        <thead>
          <tr>
            <Th>Documento</Th>
            <Th numerico estreito>Revisão</Th>
            <Th>Entra em vigor</Th>
            <Th className="hidden md:table-cell">Marcada por</Th>
            <Th numerico>Acções</Th>
          </tr>
        </thead>
        <tbody>
          {agendamentos.map(a => {
            const d = docsPorId.get(a.documento_id);
            const atrasada = a.vigor_desde <= hojeTexto;
            return (
              <Tr key={a.id}>
                <Td className="max-w-[24rem]">
                  {d
                    ? <CelulaDocumento doc={d} meta={nomeAero(aeroportos, d.aeroporto_id)} />
                    : <span className={GD.meta}>documento fora da lista actual</span>}
                </Td>
                <Td numerico className={cn('text-sm', GD.ref, GD.meta)}>{a.rotulo || a.versao}</Td>
                <Td className={cn('text-sm tabular-nums', atrasada ? GD.alerta : GD.tintaMedia)}>
                  {fmtData(a.vigor_desde)}
                  {atrasada && <span className="block text-xs">a aplicar na próxima passagem do agendador</span>}
                </Td>
                <Td className={cn('hidden max-w-[12rem] truncate text-sm md:table-cell', GD.meta)}>{a.agendada_por || '—'}</Td>
                <Td>
                  <AccoesLinha destrutivas={
                    <Button size="sm" variant="ghost" className={GD.perigo} onClick={() => onRetirar(a, d)}>
                      <X className="h-4 w-4" aria-hidden="true" />Retirar a data
                    </Button>
                  }>
                    {d && <Button size="sm" variant="outline" asChild><Link to={urlDoc(d.id)}><Eye className="h-4 w-4" aria-hidden="true" />Ver</Link></Button>}
                  </AccoesLinha>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Tabela>
    </Painel>
  );
}

// ── separador: documentos repetidos ─────────────────────────────────────────
// Um par por linha, o exemplar mais antigo à esquerda. Não se apaga nada daqui: decide-se.
function AbaRepetidos({ actor, aeroportos, gestor }) {
  const { toast } = useToast();
  const recarregar = useRecarregarDocs();
  const [altura] = useDensidade();
  const paresQ = useDuplicadosDocs();
  const faltamQ = useSemImpressaoDigital();
  const [decidir, setDecidir] = useState(null);
  const [nota, setNota] = useState('');
  const [busy, setBusy] = useState(false);
  const [progresso, setProgresso] = useState(null);   // { feitos, total } enquanto calcula
  const parar = useRef(false);

  const pares = paresQ.data || [];
  const faltam = faltamQ.data || [];
  const porDecidir = pares.filter(p => !p.decidido_em);

  // Impressão digital dos ficheiros que já estavam no portal antes desta funcionalidade: abre-se cada ficheiro por
  // endereço assinado e calcula-se no navegador. É lento de propósito — um ficheiro de cada vez, para não afogar
  // o servidor — e pode ser parado a qualquer momento sem perder o que já foi calculado.
  const calcularEmFalta = async () => {
    parar.current = false;
    setProgresso({ feitos: 0, total: faltam.length });
    let feitos = 0; let falhas = 0;
    for (const d of faltam) {
      if (parar.current) break;
      try {
        const r = await obterUrlAssinadaDocumento({ documento_id: d.id });
        if (!r?.url) throw new Error('sem endereço');
        const resposta = await fetch(r.url);
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        const blob = await resposta.blob();
        const sha256 = await impressaoDigital(blob);
        if (sha256) await gravarImpressaoDigital(d.id, sha256, { versao: d.versao_atual });
        feitos += 1;
      } catch { falhas += 1; }
      setProgresso({ feitos: feitos + falhas, total: faltam.length });
    }
    setProgresso(null);
    recarregar('duplicados');
    recarregar('sem-impressao');
    toast({
      title: parar.current ? 'Cálculo interrompido' : 'Impressões digitais calculadas',
      description: `${feitos} ficheiro(s) identificados${falhas ? `, ${falhas} que não foi possível abrir` : ''}.`,
    });
  };

  const guardarDecisao = async () => {
    if (!decidir) return;
    setBusy(true);
    try {
      await decidirDuplicado({ sha256: decidir.sha256, documentoId: decidir.documento_id, parId: decidir.par_id, nota }, actor);
      await auditarDocs(actor, {
        acao: 'duplicado_decidido', id: decidir.documento_id,
        detalhes: `Par de ficheiros iguais aceite como legítimo: «${decidir.titulo}» e «${decidir.par_titulo}»${nota ? ` — ${nota}` : ''}`,
      });
      toast({ title: 'Par aceite como legítimo', description: 'Sai da lista de trabalho; a decisão fica no registo.' });
      setDecidir(null); setNota('');
      recarregar('duplicados');
    } catch (e) {
      toast({ title: 'Não foi possível guardar a decisão', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const reabrir = async (p) => {
    try {
      await reabrirDuplicado(p.decisao_id);
      toast({ title: 'Par de novo em aberto' });
      recarregar('duplicados');
    } catch (e) {
      toast({ title: 'Não foi possível reabrir', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.borda, GD.superficieFraca, GD.tintaMedia)}>
        <Fingerprint className={cn('mt-0.5 h-4 w-4 shrink-0', GD.acento)} aria-hidden="true" />
        <span>
          Dois documentos aparecem aqui quando o ficheiro é <strong>byte a byte o mesmo</strong> (igual impressão
          digital SHA-256), tenham o nome que tiverem. O carregamento nunca é recusado: mostra-se o par e decide
          uma pessoa — dois exemplares podem ser legítimos, por exemplo a mesma norma arquivada em dois aeroportos.
        </span>
      </p>

      {/* Ficheiros antigos ainda sem impressão digital: sem isto, a lista de pares fica incompleta e engana. */}
      {(faltam.length > 0 || progresso) && (
        <Painel>
          <Cabecalho
            titulo="Ficheiros ainda sem impressão digital"
            contagem={faltam.length}
            descricao="Os documentos que já estavam no portal antes desta funcionalidade. Enquanto não forem identificados, não podem aparecer como repetidos."
            accoes={progresso
              ? <Button variant="outline" size="sm" onClick={() => { parar.current = true; }}><Ban className="h-4 w-4" aria-hidden="true" />Parar</Button>
              : <Button size="sm" onClick={calcularEmFalta} disabled={!faltam.length}><Fingerprint className="h-4 w-4" aria-hidden="true" />Calcular agora</Button>}
          />
          <div className="p-3">
            {progresso
              ? <p className={cn('text-sm tabular-nums', GD.tintaMedia)} aria-live="polite">A identificar {progresso.feitos} de {progresso.total}… pode sair desta página quando quiser parar.</p>
              : <p className={cn('text-sm', GD.meta)}>Abre cada ficheiro e calcula a impressão digital no seu navegador, um de cada vez. Com {faltam.length} ficheiro(s) pode levar alguns minutos.</p>}
          </div>
        </Painel>
      )}

      <Painel>
        <Cabecalho
          titulo="Pares por decidir"
          contagem={porDecidir.length}
          descricao="O exemplar mais antigo fica à esquerda: é o que já lá estava."
          accoes={<Button variant="outline" size="sm" onClick={() => paresQ.refetch()} disabled={paresQ.isFetching}><RefreshCw className={cn('h-4 w-4', paresQ.isFetching && 'animate-spin')} aria-hidden="true" />Actualizar</Button>}
        />
        <Tabela altura={altura} rotulo="Pares de documentos com o mesmo ficheiro">
          <thead>
            <tr>
              <Th>Já estava no portal</Th>
              <Th>Entrou depois</Th>
              <Th className="hidden lg:table-cell">Decisão</Th>
              <Th numerico>Acções</Th>
            </tr>
          </thead>
          {paresQ.isLoading ? <LinhasEsqueleto linhas={5} colunas={4} altura={altura} />
            : paresQ.isError ? (
              <LinhaMensagem colunas={4}>
                <Falha
                  titulo="Não foi possível carregar os pares"
                  texto={`${paresQ.error?.message || 'O servidor não respondeu.'} Se a mensagem falar de «documento_duplicado», a migração 152 ainda não foi aplicada.`}
                  onTentar={() => paresQ.refetch()}
                />
              </LinhaMensagem>
            ) : pares.length === 0 ? (
              <LinhaMensagem colunas={4}>
                <Vazio
                  icone={Copy}
                  titulo={faltam.length ? 'Nenhum repetido entre os ficheiros já identificados' : 'Nenhum ficheiro repetido'}
                  texto={faltam.length
                    ? `Faltam identificar ${faltam.length} ficheiro(s) que já estavam no portal. Calcule as impressões digitais em falta para a lista ficar completa.`
                    : 'Todos os ficheiros do portal são diferentes uns dos outros. Quando alguém carregar um ficheiro que já existe, o par aparece aqui.'}
                />
              </LinhaMensagem>
            ) : (
              <tbody>
                {pares.map(p => (
                  <Tr key={`${p.documento_id}-${p.par_id}`}>
                    <Td className="max-w-[22rem]">
                      <div className="min-w-0">
                        <Ref className={cn('block truncate', GD.meta)}>{p.numero || 'sem número'}</Ref>
                        <Link to={urlDoc(p.documento_id)} className={cn('block truncate font-medium hover:underline', GD.tinta, GD.foco)}>{p.titulo}</Link>
                        <span className={cn('block truncate text-sm', GD.meta)}>
                          {[nomeAero(aeroportos, p.aeroporto_id), fmtData(p.entrou_em), p.carregado_por].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    </Td>
                    <Td className="max-w-[22rem]">
                      <div className="min-w-0">
                        <Ref className={cn('block truncate', GD.meta)}>{p.par_numero || 'sem número'}</Ref>
                        <Link to={urlDoc(p.par_id)} className={cn('block truncate font-medium hover:underline', GD.tinta, GD.foco)}>{p.par_titulo}</Link>
                        <span className={cn('block truncate text-sm', GD.meta)}>
                          {[nomeAero(aeroportos, p.par_aeroporto_id), fmtData(p.par_entrou_em), p.par_carregado_por].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    </Td>
                    <Td className={cn('hidden max-w-[14rem] text-sm lg:table-cell', GD.meta)}>
                      {p.decidido_em
                        ? <span><span className={cn('font-medium', GD.bom)}>Dois exemplares legítimos</span><br />{p.decidido_por} · {fmtData(p.decidido_em)}{p.decisao_nota ? ` · ${p.decisao_nota}` : ''}</span>
                        : <span>por decidir</span>}
                    </Td>
                    <Td>
                      <AccoesLinha>
                        {gestor && (p.decidido_em
                          ? <Button size="sm" variant="ghost" onClick={() => reabrir(p)}><RefreshCw className="h-4 w-4" aria-hidden="true" />Reabrir</Button>
                          : <Button size="sm" variant="outline" onClick={() => { setDecidir(p); setNota(''); }}><CheckCircle2 className="h-4 w-4" aria-hidden="true" />São legítimos</Button>)}
                      </AccoesLinha>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            )}
        </Tabela>
      </Painel>

      {decidir && (
        <Dialog open onOpenChange={(o) => !o && setDecidir(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-teal-600" aria-hidden="true" />São dois exemplares legítimos</DialogTitle>
              <DialogDescription className="break-words">«{decidir.titulo}» e «{decidir.par_titulo}» ficam os dois, e o par sai da lista de trabalho.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Campo id="dup-nota" label="Porquê" ajuda="Fica no registo com o seu nome e a data. Ajuda quem vier depois a não voltar a levantar a questão.">
                <Textarea id="dup-nota" value={nota} onChange={e => setNota(e.target.value)} rows={3} maxLength={500} placeholder="A mesma norma arquivada em dois aeroportos, por exigência de cada um." />
              </Campo>
              <p className={cn('text-sm', GD.meta)}>Para eliminar um dos dois, use a lista de documentos: eliminar passa pela autorização registada, no separador «Retenção e eliminação».</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDecidir(null)} disabled={busy}>Cancelar</Button>
              <Button onClick={guardarDecisao} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}Registar a decisão</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── separador: retenção e eliminação autorizada ─────────────────────────────
const ACCAO_FIM_LABEL = {
  rever: 'Rever no fim do prazo',
  propor_eliminacao: 'Propor a eliminação',
  arquivar_definitivo: 'Guardar para sempre',
};
const ELIM_LABEL = { proposta: 'À espera de autorização', autorizada: 'Autorizada', recusada: 'Recusada', executada: 'Eliminado' };
const ELIM_TOM = { proposta: 'alerta', autorizada: 'acento', recusada: 'meta', executada: 'perigo' };

// Uma janela para as três decisões: propor, autorizar, recusar. O fundamento é obrigatório para propor e para
// autorizar — é o que a lei vai pedir a ver, e o servidor recusa sem ele.
function DialogDecisaoEliminacao({ modo, alvo, actor, onFechar, onFeito }) {
  const { toast } = useToast();
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const obrigatorio = modo !== 'recusar';
  const titulos = {
    propor: 'Propor a eliminação',
    autorizar: 'Autorizar a eliminação',
    recusar: 'Recusar a proposta',
  };

  const confirmar = async () => {
    if (obrigatorio && texto.trim().length < 10) {
      toast({ title: 'Escreva o fundamento', description: 'Pelo menos 10 caracteres. Fica no registo para sempre.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      if (modo === 'propor') await proporEliminacao(alvo.documento_id, texto.trim());
      if (modo === 'autorizar') await autorizarEliminacao(alvo.id, texto.trim());
      if (modo === 'recusar') await recusarEliminacao(alvo.id, texto.trim());
      await auditarDocs(actor, {
        acao: `eliminacao_${modo}`, entidade: 'documento_eliminacao', id: alvo.documento_id || alvo.id,
        detalhes: `${titulos[modo]}: «${alvo.documento_titulo || alvo.titulo}»${texto.trim() ? ` — ${texto.trim()}` : ''}`,
      });
      toast({
        title: titulos[modo],
        description: modo === 'autorizar'
          ? 'Fica registado quem autorizou, quando e com que fundamento. A eliminação ainda tem de ser executada por um administrador.'
          : modo === 'propor' ? 'A proposta espera autorização de um gestor ou administrador.' : 'O documento mantém-se.',
      });
      onFeito();
    } catch (e) {
      toast({ title: 'Não foi possível concluir', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {modo === 'recusar'
              ? <Ban className={cn('h-5 w-5', GD.meta)} aria-hidden="true" />
              : <ShieldCheck className={cn('h-5 w-5', modo === 'autorizar' ? GD.perigo : 'text-teal-600')} aria-hidden="true" />}
            {titulos[modo]}
          </DialogTitle>
          <DialogDescription className="break-words">
            {alvo.documento_numero || alvo.numero ? `${alvo.documento_numero || alvo.numero} · ` : ''}{alvo.documento_titulo || alvo.titulo}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {alvo.motivo && <p className={cn('rounded-lg border p-3 text-sm', GD.borda, GD.superficieFraca, GD.tintaMedia)}>{alvo.motivo}</p>}
          <Campo
            id="el-texto"
            label={modo === 'recusar' ? 'Motivo da recusa' : 'Fundamento *'}
            ajuda={modo === 'autorizar'
              ? 'Em nome de quê se elimina: deliberação, prazo legal cumprido, substituição por outro documento. Fica no registo com o seu nome e a data, e não se apaga.'
              : modo === 'propor' ? 'Porque é que este documento devia ser eliminado.' : 'Por que é que o documento se mantém. Fica no registo.'}
          >
            <Textarea id="el-texto" value={texto} onChange={e => setTexto(e.target.value)} rows={4} maxLength={1000} />
          </Campo>
          {modo === 'autorizar' && (
            <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.avisoSuave)}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Autorizar não elimina nada: deixa a eliminação pronta a ser executada por um administrador do portal.
              O histórico de versões, as confirmações de leitura e este registo mantêm-se depois de eliminado.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={busy}>Cancelar</Button>
          <Button variant={modo === 'autorizar' ? 'destructive' : 'default'} onClick={confirmar} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{titulos[modo]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AbaEliminacao({ actor, admin, gestor, tipos }) {
  const { toast } = useToast();
  const recarregar = useRecarregarDocs();
  const [altura] = useDensidade();
  const retencaoQ = useRetencaoDocs();
  const elimQ = useEliminacoesDocs();
  const [decisao, setDecisao] = useState(null);     // { modo, alvo }
  const [confirmar, setConfirmar] = useState(null);
  const mapaTipos = useMemo(() => mapaPorId(tipos), [tipos]);

  const hojeTexto = hoje();
  const linhas = retencaoQ.data || [];
  const eliminacoes = elimQ.data || [];
  // Prazo terminado e sem decisão em curso. «Guardar para sempre» nunca entra nesta lista.
  const terminados = useMemo(() => linhas.filter(l => l.prazo_termina_em && l.prazo_termina_em <= hojeTexto
    && l.acao_no_fim !== 'arquivar_definitivo'
    && (!l.eliminacao_estado || l.eliminacao_estado === 'recusada')), [linhas, hojeTexto]);
  const semPolitica = useMemo(() => linhas.filter(l => !l.politica_id).length, [linhas]);

  const executar = async (e) => {
    try {
      await executarEliminacao(e.id);
      await auditarDocs(actor, {
        acao: 'eliminacao_executada', entidade: 'documento_eliminacao', id: e.documento_id || e.id,
        detalhes: `«${e.documento_titulo}» eliminado ao abrigo da autorização de ${e.autorizado_por}`,
      });
      toast({ title: 'Eliminado', description: 'O documento saiu do portal. O registo da autorização e o histórico ficam.' });
      recarregar();
    } catch (err) {
      toast({ title: 'Não foi possível eliminar', description: err?.message || String(err), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.borda, GD.superficieFraca, GD.tintaMedia)}>
        <Timer className={cn('mt-0.5 h-4 w-4 shrink-0', GD.acento)} aria-hidden="true" />
        <span>
          Nada é apagado automaticamente: o sistema <strong>propõe</strong> e uma pessoa <strong>autoriza</strong>,
          com nome, data e fundamento escrito. Os prazos por tipo de documento definem-se em{' '}
          <Link to={`${PORTAL_BASE}/gestao/configuracoes?tab=retencao`} className="underline">Configurações › Retenção</Link>.
          {semPolitica > 0 && <> Há {semPolitica} documento(s) sem política atribuída: para esses não há prazo nenhum a correr.</>}
        </span>
      </p>

      <Painel>
        <Cabecalho
          icone={Timer}
          titulo="Prazo de retenção terminado"
          contagem={terminados.length}
          descricao="O prazo da política acabou. Para os tipos marcados «rever», a decisão é de quem gere; nada entra em eliminação sem alguém propor."
          accoes={<Button variant="outline" size="sm" onClick={() => retencaoQ.refetch()} disabled={retencaoQ.isFetching}><RefreshCw className={cn('h-4 w-4', retencaoQ.isFetching && 'animate-spin')} aria-hidden="true" />Actualizar</Button>}
        />
        <Tabela altura={altura} alturaMax="26rem" rotulo="Documentos com o prazo de retenção terminado">
          <thead>
            <tr>
              <Th>Documento</Th>
              <Th className="hidden md:table-cell">Política</Th>
              <Th>Prazo terminou</Th>
              <Th className="hidden lg:table-cell">No fim</Th>
              <Th numerico>Acções</Th>
            </tr>
          </thead>
          {retencaoQ.isLoading ? <LinhasEsqueleto linhas={4} colunas={5} altura={altura} />
            : retencaoQ.isError ? (
              <LinhaMensagem colunas={5}>
                <Falha
                  titulo="Não foi possível carregar a retenção"
                  texto={`${retencaoQ.error?.message || 'O servidor não respondeu.'} Se a mensagem falar de «documento_retencao», a migração 153 ainda não foi aplicada.`}
                  onTentar={() => retencaoQ.refetch()}
                />
              </LinhaMensagem>
            ) : terminados.length === 0 ? (
              <LinhaMensagem colunas={5}>
                <Vazio
                  icone={Timer}
                  titulo="Nenhum prazo de retenção terminado"
                  texto="Nenhum documento passou o prazo da sua política. Quando passar, aparece aqui — e continua a ser preciso alguém propor e alguém autorizar."
                />
              </LinhaMensagem>
            ) : (
              <tbody>
                {terminados.map(l => (
                  <Tr key={l.documento_id}>
                    <Td className="max-w-[24rem]">
                      <CelulaDocumento doc={{ id: l.documento_id, numero: l.numero, titulo: l.titulo }} meta={rotuloTipo(mapaTipos, l.tipo_id)} />
                    </Td>
                    <Td className={cn('hidden max-w-[14rem] truncate text-sm md:table-cell', GD.meta)} title={l.fundamento_legal || ''}>
                      {l.politica}{l.minimo_legal ? ' · prazo da lei' : ''}
                    </Td>
                    <Td className={cn('text-sm tabular-nums', GD.alerta)}>{fmtData(l.prazo_termina_em)}</Td>
                    <Td className={cn('hidden text-sm lg:table-cell', GD.meta)}>{ACCAO_FIM_LABEL[l.acao_no_fim] || l.acao_no_fim}</Td>
                    <Td>
                      <AccoesLinha>
                        <Button size="sm" variant="outline" asChild><Link to={urlDoc(l.documento_id)}><Eye className="h-4 w-4" aria-hidden="true" />Ver</Link></Button>
                        {gestor && (
                          <Button size="sm" variant="ghost" onClick={() => setDecisao({ modo: 'propor', alvo: l })}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />Propor eliminação
                          </Button>
                        )}
                      </AccoesLinha>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            )}
        </Tabela>
      </Painel>

      <Painel>
        <Cabecalho
          icone={ShieldCheck}
          titulo="Propostas, autorizações e eliminações"
          contagem={eliminacoes.length}
          descricao="O registo que uma auditoria vem ver: o que se propôs, quem autorizou, quando e com que fundamento. Não se altera nem se apaga."
          accoes={<Button variant="outline" size="sm" onClick={() => elimQ.refetch()} disabled={elimQ.isFetching}><RefreshCw className={cn('h-4 w-4', elimQ.isFetching && 'animate-spin')} aria-hidden="true" />Actualizar</Button>}
        />
        <Tabela altura={altura} rotulo="Registo de eliminações">
          <thead>
            <tr>
              <Th>Documento</Th>
              <Th>Estado</Th>
              <Th className="hidden md:table-cell">Proposta</Th>
              <Th className="hidden lg:table-cell">Autorização</Th>
              <Th numerico>Acções</Th>
            </tr>
          </thead>
          {elimQ.isLoading ? <LinhasEsqueleto linhas={4} colunas={5} altura={altura} />
            : elimQ.isError ? (
              <LinhaMensagem colunas={5}>
                <Falha
                  titulo="Não foi possível carregar o registo"
                  texto={`${elimQ.error?.message || 'O servidor não respondeu.'} Se a mensagem falar de «documento_eliminacao», a migração 153 ainda não foi aplicada.`}
                  onTentar={() => elimQ.refetch()}
                />
              </LinhaMensagem>
            ) : eliminacoes.length === 0 ? (
              <LinhaMensagem colunas={5}>
                <Vazio
                  icone={ShieldCheck}
                  titulo="Nunca se eliminou nada"
                  texto="Não há propostas nem autorizações de eliminação. É o estado normal: a retenção só propõe quando um prazo termina, e eliminar exige sempre autorização registada."
                />
              </LinhaMensagem>
            ) : (
              <tbody>
                {eliminacoes.map(e => (
                  <Tr key={e.id}>
                    <Td className="max-w-[22rem]">
                      <div className="min-w-0">
                        <Ref className={cn('block truncate', GD.meta)}>{e.documento_numero || 'sem número'}</Ref>
                        {e.documento_id
                          ? <Link to={urlDoc(e.documento_id)} className={cn('block truncate font-medium hover:underline', GD.tinta, GD.foco)}>{e.documento_titulo}</Link>
                          : <span className={cn('block truncate font-medium', GD.tinta)}>{e.documento_titulo}</span>}
                        <span className={cn('block truncate text-sm', GD.meta)}>{e.motivo}</span>
                      </div>
                    </Td>
                    <Td className={cn('text-sm font-medium', GD[ELIM_TOM[e.estado]] || GD.tintaMedia)}>{ELIM_LABEL[e.estado] || e.estado}</Td>
                    <Td className={cn('hidden max-w-[12rem] text-sm md:table-cell', GD.meta)}>
                      {e.proposto_por}<br />{fmtDataHora(e.proposto_em)}
                    </Td>
                    <Td className={cn('hidden max-w-[18rem] text-sm lg:table-cell', GD.meta)}>
                      {e.autorizado_por
                        ? <span><span className={cn('font-medium', GD.tintaMedia)}>{e.autorizado_por}</span> · {fmtDataHora(e.autorizado_em)}<br />{e.fundamento}</span>
                        : e.recusado_por
                          ? <span>recusada por {e.recusado_por} · {fmtData(e.recusado_em)}{e.recusa_fundamento ? <><br />{e.recusa_fundamento}</> : null}</span>
                          : <span>—</span>}
                    </Td>
                    <Td>
                      <AccoesLinha destrutivas={e.estado === 'autorizada' && admin
                        ? (
                          <Button
                            size="sm" variant="destructive"
                            onClick={() => setConfirmar({
                              t: 'Eliminar o documento',
                              m: `Eliminar «${e.documento_titulo}»? Foi autorizado por ${e.autorizado_por} em ${fmtDataHora(e.autorizado_em)}, com o fundamento: «${e.fundamento}». O documento sai do portal; o histórico de versões, as confirmações de leitura e este registo mantêm-se.`,
                              f: () => executar(e),
                            })}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />Eliminar
                          </Button>
                        )
                        : null}
                      >
                        {e.estado === 'proposta' && gestor && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setDecisao({ modo: 'autorizar', alvo: e })}><ShieldCheck className="h-4 w-4" aria-hidden="true" />Autorizar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setDecisao({ modo: 'recusar', alvo: e })}><Ban className="h-4 w-4" aria-hidden="true" />Recusar</Button>
                          </>
                        )}
                        {e.estado === 'autorizada' && gestor && (
                          <Button size="sm" variant="ghost" onClick={() => setDecisao({ modo: 'recusar', alvo: e })}><Ban className="h-4 w-4" aria-hidden="true" />Retirar a autorização</Button>
                        )}
                        {e.estado === 'autorizada' && !admin && <span className={cn('text-xs', GD.meta)}>a execução é de um administrador</span>}
                      </AccoesLinha>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            )}
        </Tabela>
      </Painel>

      {decisao && (
        <DialogDecisaoEliminacao
          modo={decisao.modo}
          alvo={decisao.alvo}
          actor={actor}
          onFechar={() => setDecisao(null)}
          onFeito={() => { setDecisao(null); recarregar(); }}
        />
      )}
      <ConfirmModal
        isOpen={!!confirmar} onClose={() => setConfirmar(null)} onConfirm={() => confirmar?.f?.()}
        title={confirmar?.t} message={confirmar?.m} confirmText="Eliminar" variant="destructive"
      />
    </div>
  );
}

// ── página ──────────────────────────────────────────────────────────────────
const COLUNAS = 10;

// Ordenação local da lista (os documentos já vêm do servidor; ordenar à mão evita uma ida à base por cada clique).
const SEM_DATA = 8640000000000000; // vai para o fim quando não há data
const valorOrdemGestao = (d, campo) => {
  switch (campo) {
    case 'codigo': return String(d.numero || '~~~').toLowerCase(); // sem número vai para o fim
    case 'estado': return String(ESTADO_LABEL[d.estado] || d.estado || '').toLowerCase();
    case 'versao': return Number(d.versao_atual || d.versao || 1);
    case 'vigor': { const v = d.em_vigor_desde || d.publicacao_em || d.data_publicacao; return v ? new Date(v).getTime() : SEM_DATA; }
    case 'validade': { const v = d.expira_em || d.data_expiracao; return v ? new Date(v).getTime() : SEM_DATA; }
    case 'responsavel': return String(d.responsavel_email || '~~~').toLowerCase();
    case 'formato': return formatoFicheiroDoc(d) || '~~~';
    default: return tituloLimpoDoc(d).toLowerCase(); // 'documento'
  }
};
function ordenarDocsGestao(docs, campo, dir) {
  if (!campo) return docs;
  const sinal = dir === 'asc' ? 1 : -1;
  return [...docs].sort((a, b) => {
    const va = valorOrdemGestao(a, campo), vb = valorOrdemGestao(b, campo);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sinal;
    return String(va).localeCompare(String(vb), 'pt') * sinal;
  });
}

const ABAS = ['documentos', 'repetidos', 'eliminacao'];

export default function PortalDocumentosGestao() {
  const { user } = useAuth();
  const { toast } = useToast();
  const recarregar = useRecarregarDocs();
  const admin = ehAdminPortal(user);
  const gestor = ehGestorDocs(user);
  const [altura, setAltura] = useDensidade();

  // O estado vive no endereço: qualquer vista é partilhável e citável (e o painel liga-se a ela).
  const [filtros, definir, limparFiltros] = useFiltrosUrl({ tab: 'documentos', q: '', aeroporto: '', pasta: '', tipo: '', estado: '', validade: '', responsavel: '' });
  const { q, aeroporto, pasta, tipo, estado, validade, responsavel } = filtros;
  const aba = ABAS.includes(filtros.tab) ? filtros.tab : 'documentos';
  const [busca, setBusca] = useBuscaDebounce(q, (v) => definir({ q: v }));

  const [editar, setEditar] = useState(null);
  const [versaoDe, setVersaoDe] = useState(null);
  const [agendar, setAgendar] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [aMudar, setAMudar] = useState(null);
  const [seleccionados, setSeleccionados] = useState(() => new Set());
  // Ordenação da lista: clicar num cabeçalho ordena por essa coluna; clicar de novo inverte. Sem escolha, fica a
  // ordem do servidor (os mais recentemente alterados primeiro).
  const [ordenacao, setOrdenacao] = useState({ campo: '', dir: 'asc' });
  const ordenarPor = (campo) => setOrdenacao(o => (o.campo === campo ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'asc' }));
  const [atribuir, setAtribuir] = useState(null);

  const aeroportosQ = useAeroportosDocs();
  const tiposQ = useTiposDocumento();
  const pastasQ = usePastasDocs();
  const responsaveisQ = useResponsaveisAeroporto();
  // «Por classificar» não é um tipo que o servidor possa comparar (tipo_id é nulo): esse fica para o filtro local.
  const docsQ = useDocumentosDocs({ aeroportoId: aeroporto, pastaId: pasta, tipoId: tipo === SEM_TIPO ? '' : tipo, estado, texto: q, limite: 1000 });
  // Entradas em vigor marcadas e pares repetidos: servem a tira por cima da lista, as marcas nas linhas e as
  // contagens nos separadores. As consultas são partilhadas com os separadores (mesma chave, uma só ida ao servidor).
  const agendamentosQ = useAgendamentosVigor();
  const duplicadosQ = useDuplicadosDocs();

  const aeroportos = aeroportosQ.data || [];
  const tipos = tiposQ.data || [];
  const pastas = pastasQ.data || [];
  const mapaAero = useMemo(() => mapaPorId(aeroportos), [aeroportos]);
  const mapaTipos = useMemo(() => mapaPorId(tipos), [tipos]);

  // Aeroportos de que sou responsável: é isso que me deixa aprovar os documentos desses aeroportos.
  const meusAeroportos = useMemo(() => {
    const meu = String(user?.email || '').toLowerCase();
    return new Set((responsaveisQ.data || []).filter(r => String(r.email || '').toLowerCase() === meu).map(r => r.aeroporto_id));
  }, [responsaveisQ.data, user]);
  const podeAprovar = (doc) => admin || (!!doc?.aeroporto_id && meusAeroportos.has(doc.aeroporto_id));
  const responsaveisDoAeroporto = (id) => (responsaveisQ.data || []).filter(r => r.aeroporto_id === id);

  const carregados = docsQ.data || [];
  const docs = useMemo(() => {
    const resp = String(responsavel || '').trim().toLowerCase();
    return carregados.filter(d => correspondeValidade(d, validade)
      && correspondeTipo(d, tipo)
      && (!resp
        || (resp === '__sem__' ? !d.responsavel_email : String(d.responsavel_email || '').toLowerCase().includes(resp))));
  }, [carregados, validade, responsavel, tipo]);
  const docsVista = useMemo(() => ordenarDocsGestao(docs, ordenacao.campo, ordenacao.dir), [docs, ordenacao]);

  const semResponsavel = useMemo(() => carregados.filter(d => !d.responsavel_email), [carregados]);
  const porEstado = useMemo(() => {
    const c = {};
    for (const d of carregados) { const k = d.estado || 'rascunho'; c[k] = (c[k] || 0) + 1; }
    return c;
  }, [carregados]);
  // Contagens por tipo (os documentos já estão classificados na base de dados: 72 formulários, 35 procedimentos,
  // 19 manuais, 6 normas — e os que faltam classificar, que são trabalho a fazer).
  const porTipo = useMemo(() => {
    const c = { [SEM_TIPO]: 0 };
    for (const d of carregados) { const k = d.tipo_id || SEM_TIPO; c[k] = (c[k] || 0) + 1; }
    return c;
  }, [carregados]);

  // Documentos com um ficheiro repetido (de um lado ou do outro do par) e que ninguém decidiu ainda: a marca
  // aparece na linha, para quem gere ver o problema onde trabalha e não só no separador.
  const repetidosPorDecidir = useMemo(() => {
    const s = new Set();
    for (const p of (duplicadosQ.data || [])) {
      if (p.decidido_em) continue;
      s.add(p.documento_id); s.add(p.par_id);
    }
    return s;
  }, [duplicadosQ.data]);
  const docsPorId = useMemo(() => mapaPorId(carregados), [carregados]);
  const agendamentos = agendamentosQ.data || [];
  // documento → data marcada da próxima revisão. Vem dos agendamentos e não da lista de documentos: a consulta
  // da lista traz um conjunto fixo de colunas, partilhado com as outras páginas.
  const vigorMarcado = useMemo(() => {
    const m = new Map();
    for (const a of agendamentos) if (!m.has(a.documento_id)) m.set(a.documento_id, a.vigor_desde);
    return m;
  }, [agendamentos]);

  const retirarAgendamento = async (a, d) => {
    try {
      await cancelarAgendamentoVigor(a.id);
      await auditarDocs(user, {
        acao: 'documento_vigor_agendado_retirado', id: a.documento_id,
        detalhes: `Data de entrada em vigor (${fmtData(a.vigor_desde)}) retirada da revisão ${a.rotulo || a.versao}${d ? ` de «${d.titulo}»` : ''}`,
      });
      toast({ title: 'Data retirada', description: 'A revisão fica aprovada, à espera de uma data ou de ser posta em vigor à mão.' });
      recarregar('agendamentos-vigor');
    } catch (e) {
      toast({ title: 'Não foi possível retirar a data', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const temFiltros = !!(q || aeroporto || pasta || tipo || estado || validade || responsavel);
  // A selecção não sobrevive a uma mudança de filtros: o que está marcado tem de ser o que está à vista.
  useEffect(() => { setSeleccionados(new Set()); }, [q, aeroporto, pasta, tipo, estado, validade, responsavel]);

  const alternarSel = (id) => setSeleccionados(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const todosSel = docs.length > 0 && docs.every(d => seleccionados.has(d.id));
  const alternarTodos = () => setSeleccionados(s => (todosSel ? new Set() : new Set(docs.map(d => d.id))));
  const docsSel = useMemo(() => docs.filter(d => seleccionados.has(d.id)), [docs, seleccionados]);

  // Mudança de estado: grava, registra na auditoria e guarda quem aprovou.
  const mudarEstado = async (doc, para, label) => {
    setAMudar(doc.id);
    try {
      const agora = new Date().toISOString();
      const patch = { estado: para, updated_date: agora };
      if (para === 'aprovado') { patch.aprovado_por = user?.email || null; patch.aprovado_em = agora; }
      if (para === 'em_vigor' && !doc.em_vigor_desde) patch.em_vigor_desde = hoje();
      const { error } = await supabase.from('documento').update(patch).eq('id', doc.id);
      if (error) throw error;
      if (doc.versao_atual) {
        await supabase.from('documento_versao').update(para === 'aprovado'
          ? { estado: para, aprovado_por: user?.email || null, aprovado_em: agora }
          : { estado: para }).eq('documento_id', doc.id).eq('versao', doc.versao_atual);
      }
      await auditarDocs(user, { acao: `documento_${para}`, id: doc.id, detalhes: `${label}: «${doc.titulo}» (${ESTADO_LABEL[doc.estado] || doc.estado} → ${ESTADO_LABEL[para] || para})` });
      toast({ title: label, description: `«${doc.titulo}» passou a ${ESTADO_LABEL[para] || para}.` });
      recarregar('documentos');
    } catch (e) {
      toast({ title: 'Não foi possível mudar o estado', description: e?.message || String(e), variant: 'destructive' });
    } finally { setAMudar(null); }
  };

  const apagar = async (doc) => {
    setAMudar(doc.id);
    try {
      const { error } = await supabase.from('documento').update({ deleted_at: new Date().toISOString(), deleted_by: user?.email || null }).eq('id', doc.id);
      if (error) throw error;
      await auditarDocs(user, { acao: 'documento_apagado', id: doc.id, detalhes: `Documento enviado para a lixeira: «${doc.titulo}»` });
      toast({ title: 'Documento enviado para a lixeira', description: 'Fica recuperável durante o prazo de retenção definido nas configurações.' });
      recarregar('documentos');
    } catch (e) {
      toast({ title: 'Não foi possível apagar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setAMudar(null); }
  };

  const opcoesAero = [{ value: '', label: 'Todos os aeroportos' }, ...aeroportos.map(a => ({ value: a.id, label: nomeAero(mapaAero, a.id) }))];
  // Filtro de pastas em ÁRVORE: com um aeroporto escolhido, mostra só as pastas desse aeroporto (raiz + subpastas por
  // classe, indentadas); sem aeroporto, mostra todas com o caminho completo. As subpastas herdam o aeroporto_id da raiz.
  const opcoesPasta = useMemo(() => {
    const dentro = aeroporto ? pastas.filter(p => p.aeroporto_id === aeroporto) : pastas;
    if (!aeroporto) return [{ value: '', label: 'Todas as pastas' }, ...dentro.map(p => ({ value: p.id, label: caminhoPasta(pastas, p.id) || p.nome }))];
    const ids = new Set(dentro.map(p => p.id));
    const filhos = new Map(); const raizes = [];
    for (const p of dentro) {
      const pai = p.pasta_pai_id && ids.has(p.pasta_pai_id) ? p.pasta_pai_id : null;
      if (pai) { if (!filhos.has(pai)) filhos.set(pai, []); filhos.get(pai).push(p); } else raizes.push(p);
    }
    const ordenar = (arr) => (arr || []).sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || String(a.nome).localeCompare(String(b.nome), 'pt'));
    const out = [];
    const walk = (p, d) => { out.push({ value: p.id, label: `${' '.repeat(d * 3)}${d ? '↳ ' : ''}${p.nome}` }); for (const f of ordenar(filhos.get(p.id))) walk(f, d + 1); };
    for (const r of ordenar(raizes)) walk(r, 0);
    return [{ value: '', label: 'Todas as pastas deste aeroporto' }, ...out];
  }, [pastas, aeroporto]);
  // Trocar de aeroporto não deve deixar presa uma pasta de outro aeroporto (daria lista vazia).
  useEffect(() => {
    if (pasta && !opcoesPasta.some(o => o.value === pasta)) definir({ pasta: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aeroporto]);
  const opcoesResp = [
    { value: '', label: 'Qualquer responsável' },
    { value: '__sem__', label: `Sem responsável${semResponsavel.length ? ` (${semResponsavel.length})` : ''}` },
    ...[...new Set(carregados.map(d => d.responsavel_email).filter(Boolean))].sort().map(e => ({ value: e, label: e })),
  ];
  const rotuloDe = (opcoes, valor) => opcoes.find(o => o.value === valor)?.label || valor;
  // Resumo dos filtros aplicados (a peça é a da biblioteca): cada um sai sozinho.
  const aplicados = [
    { chave: 'q', valor: q, rotulo: `Texto: ${q}`, aoRemover: () => { setBusca(''); definir({ q: '' }); } },
    { chave: 'aeroporto', valor: aeroporto, rotulo: rotuloDe(opcoesAero, aeroporto), aoRemover: () => definir({ aeroporto: '' }) },
    { chave: 'pasta', valor: pasta, rotulo: `Pasta: ${rotuloDe(opcoesPasta, pasta)}`, aoRemover: () => definir({ pasta: '' }) },
    { chave: 'tipo', valor: tipo, rotulo: `Tipo: ${tipo === SEM_TIPO ? 'por classificar' : rotuloTipo(mapaTipos, tipo)}`, aoRemover: () => definir({ tipo: '' }) },
    { chave: 'estado', valor: estado, rotulo: ESTADO_LABEL[estado] || '', aoRemover: () => definir({ estado: '' }) },
    { chave: 'validade', valor: validade, rotulo: rotuloDe(OPCOES_VALIDADE, validade), aoRemover: () => definir({ validade: '' }) },
    { chave: 'responsavel', valor: responsavel, rotulo: responsavel === '__sem__' ? 'Sem responsável' : `Responsável: ${responsavel}`, aoRemover: () => definir({ responsavel: '' }) },
  ].filter(x => x.valor);
  // Limpar filtros não muda de separador: o separador não é um filtro.
  const limparTudo = () => { setBusca(''); limparFiltros(['q', 'aeroporto', 'pasta', 'tipo', 'estado', 'validade', 'responsavel']); };

  // ── acções em massa sobre os documentos seleccionados ─────────────────────
  const obsoletoEmMassa = async (lista) => {
    const ids = lista.map(d => d.id);
    try {
      const agora = new Date().toISOString();
      const { error } = await supabase.from('documento').update({ estado: 'obsoleto', vigor_ate: hoje(), updated_date: agora }).in('id', ids);
      if (error) throw error;
      await auditarDocs(user, { acao: 'documento_obsoleto_massa', detalhes: `${ids.length} documento(s) marcados como obsoletos em massa` });
      toast({ title: 'Marcados como obsoletos', description: `${ids.length} documento(s) deixaram de contar como em vigor.` });
      setSeleccionados(new Set());
      recarregar('documentos');
    } catch (e) {
      toast({ title: 'Não foi possível marcar como obsoletos', description: e?.message || String(e), variant: 'destructive' });
    }
  };
  const apagarEmMassa = async (lista) => {
    const ids = lista.map(d => d.id);
    try {
      const { error } = await supabase.from('documento').update({ deleted_at: new Date().toISOString(), deleted_by: user?.email || null }).in('id', ids);
      if (error) throw error;
      await auditarDocs(user, { acao: 'documento_apagado_massa', detalhes: `${ids.length} documento(s) enviados para a lixeira em massa` });
      toast({ title: 'Enviados para a lixeira', description: `${ids.length} documento(s). Ficam recuperáveis durante o prazo de retenção.` });
      setSeleccionados(new Set());
      recarregar('documentos');
    } catch (e) {
      toast({ title: 'Não foi possível apagar', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className={cn('text-2xl font-bold', GD.tinta)}>Documentos</h1>
          <p className={cn('mt-1 text-sm', GD.tintaMedia)}>Carregar, editar, versionar, aprovar e pôr em vigor. Os ficheiros ficam no armazenamento privado e só se abrem por endereço assinado.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ComutadorDensidade valor={altura} aoMudar={setAltura} />
          <Button variant="outline" onClick={() => recarregar('documentos')} disabled={docsQ.isFetching}><RefreshCw className={cn('h-4 w-4', docsQ.isFetching && 'animate-spin')} aria-hidden="true" />Actualizar</Button>
          <Button onClick={() => setEditar({})}><FilePlus2 className="h-4 w-4" aria-hidden="true" />Novo documento</Button>
        </div>
      </div>

      <Tabs value={aba} onValueChange={(t) => definir({ tab: t === 'documentos' ? '' : t })}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="documentos" className="gap-1.5 py-1.5"><FileText className="h-4 w-4" aria-hidden="true" />Documentos</TabsTrigger>
          <TabsTrigger value="repetidos" className="gap-1.5 py-1.5">
            <Fingerprint className="h-4 w-4" aria-hidden="true" />Repetidos
            {repetidosPorDecidir.size > 0 && <span className={cn('ml-1 rounded-full px-1.5 text-xs tabular-nums', GD.avisoSuave)}>{repetidosPorDecidir.size}</span>}
          </TabsTrigger>
          <TabsTrigger value="eliminacao" className="gap-1.5 py-1.5"><Timer className="h-4 w-4" aria-hidden="true" />Retenção e eliminação</TabsTrigger>
        </TabsList>

        <TabsContent value="documentos" className="mt-4 space-y-4">
      {!admin && (
        <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.borda, GD.superficieFraca, GD.tintaMedia)}>
          <Info className={cn('mt-0.5 h-4 w-4 shrink-0', GD.acento)} aria-hidden="true" />
          <span>
            {meusAeroportos.size > 0
              ? <>É responsável por {[...meusAeroportos].map(id => nomeAero(mapaAero, id)).join(', ')}: pode aprovar e pôr em vigor os documentos desses aeroportos.</>
              : <>Não é responsável por nenhum aeroporto, por isso não aparecem botões de aprovar. Pode criar, editar e enviar documentos para revisão; a aprovação é do administrador do portal ou do responsável do aeroporto do documento.</>}
          </span>
        </p>
      )}

      {/* Entradas em vigor marcadas: a revisão anterior fica até à data, e na data a nova entra sozinha. */}
      <PainelAgendamentos agendamentos={agendamentos} docsPorId={docsPorId} aeroportos={mapaAero} onRetirar={retirarAgendamento} />

      {/* ── filtros ── */}
      <Painel>
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
          <CampoBusca id="dg-texto" valor={busca} aoMudar={setBusca} dica="título, número ou descrição…" className="xl:col-span-2" />
          <div className="space-y-1.5"><Label>Aeroporto</Label><Select options={opcoesAero} value={aeroporto} onValueChange={v => definir({ aeroporto: v })} /></div>
          <div className="space-y-1.5"><Label>Pasta</Label><Select options={opcoesPasta} value={pasta} onValueChange={v => definir({ pasta: v })} /></div>
          <div className="space-y-1.5"><Label>Tipo</Label><Select options={[...opcoesTipo(tipos), { value: SEM_TIPO, label: 'Por classificar' }]} value={tipo} onValueChange={v => definir({ tipo: v })} /></div>
          <div className="space-y-1.5"><Label>Estado</Label><Select options={OPCOES_ESTADO} value={estado} onValueChange={v => definir({ estado: v })} /></div>
          <div className="space-y-1.5"><Label>Validade</Label><Select options={OPCOES_VALIDADE} value={validade} onValueChange={v => definir({ validade: v })} /></div>
          <div className="space-y-1.5"><Label>Responsável</Label><Select options={opcoesResp} value={responsavel} onValueChange={v => definir({ responsavel: v })} /></div>
        </div>
        {/* Fichas com contagem (a peça é a da biblioteca): mostram só o que tem resultados. */}
        <div className={cn('space-y-2 border-t px-3 py-2.5', GD.borda)}>
          <FichasFiltro
            titulo="Estado"
            opcoes={ESTADOS_DOCUMENTO.map(e => ({ value: e.chave, label: e.label, total: porEstado[e.chave] || 0 }))}
            valor={estado}
            aoEscolher={v => definir({ estado: v })}
          />
          <FichasFiltro
            titulo="Tipo"
            opcoes={[
              ...tipos.map(t => ({ value: t.id, label: t.nome, total: porTipo[t.id] || 0 })),
              { value: SEM_TIPO, label: 'Por classificar', total: porTipo[SEM_TIPO] || 0 },
            ]}
            valor={tipo}
            aoEscolher={v => definir({ tipo: v })}
          />
          {semResponsavel.length > 0 && (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
              <span className={cn('w-24 shrink-0 text-xs font-semibold uppercase tracking-wide', GD.meta)}>Falhas</span>
              <Ficha activa={responsavel === '__sem__'} contagem={semResponsavel.length} aoClicar={() => definir({ responsavel: responsavel === '__sem__' ? '' : '__sem__' })} titulo="Ver só os documentos sem responsável">
                Sem responsável
              </Ficha>
            </div>
          )}
        </div>
      </Painel>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('text-sm tabular-nums', GD.tintaMedia)}>
          {docsQ.isLoading ? 'A carregar…' : <>{docs.length} documento{docs.length === 1 ? '' : 's'}{docs.length !== carregados.length && ` de ${carregados.length}`}</>}
        </p>
        <ResumoFiltros aplicados={aplicados} aoLimparTudo={limparTudo} />
      </div>

      {/* ── lista ── */}
      <Painel>
        <Tabela altura={altura} rotulo="Documentos do portal">
          <thead>
            <tr>
              <Th estreito>
                <Checkbox checked={todosSel} onCheckedChange={alternarTodos} aria-label={todosSel ? 'Desmarcar todos os documentos à vista' : 'Marcar todos os documentos à vista'} disabled={!docs.length} />
              </Th>
              <Th ordenavel activa={ordenacao.campo === 'codigo'} dir={ordenacao.dir} aoOrdenar={() => ordenarPor('codigo')}>Código</Th>
              <Th ordenavel activa={ordenacao.campo === 'documento'} dir={ordenacao.dir} aoOrdenar={() => ordenarPor('documento')}>Documento</Th>
              <Th className="hidden sm:table-cell" ordenavel activa={ordenacao.campo === 'formato'} dir={ordenacao.dir} aoOrdenar={() => ordenarPor('formato')}>Formato</Th>
              <Th ordenavel activa={ordenacao.campo === 'estado'} dir={ordenacao.dir} aoOrdenar={() => ordenarPor('estado')}>Estado</Th>
              <Th numerico estreito ordenavel activa={ordenacao.campo === 'versao'} dir={ordenacao.dir} aoOrdenar={() => ordenarPor('versao')}>Versão</Th>
              <Th className="hidden md:table-cell" ordenavel activa={ordenacao.campo === 'vigor'} dir={ordenacao.dir} aoOrdenar={() => ordenarPor('vigor')}>Em vigor desde</Th>
              <Th className="hidden lg:table-cell" ordenavel activa={ordenacao.campo === 'validade'} dir={ordenacao.dir} aoOrdenar={() => ordenarPor('validade')}>Validade</Th>
              <Th className="hidden xl:table-cell" ordenavel activa={ordenacao.campo === 'responsavel'} dir={ordenacao.dir} aoOrdenar={() => ordenarPor('responsavel')}>Responsável</Th>
              <Th numerico>Acções</Th>
            </tr>
          </thead>
          {docsQ.isLoading ? <LinhasEsqueleto linhas={8} colunas={COLUNAS} altura={altura} />
            : docsQ.isError ? (
              <LinhaMensagem colunas={COLUNAS}>
                <Falha
                  titulo="Não foi possível carregar os documentos"
                  texto={`${docsQ.error?.message || 'O servidor não respondeu.'} Tente de novo; se continuar, confirme que a sessão do portal não expirou (volte a entrar).`}
                  onTentar={() => docsQ.refetch()}
                />
              </LinhaMensagem>
            ) : docs.length === 0 ? (
              <LinhaMensagem colunas={COLUNAS}>
                <Vazio
                  icone={FileText}
                  titulo={temFiltros ? 'Nenhum documento com estes filtros' : 'Ainda não há documentos no portal'}
                  texto={temFiltros
                    ? 'Os filtros aplicados não deixam passar nenhum documento. Retire um filtro ou limpe tudo.'
                    : 'Crie o primeiro documento, carregue o ficheiro e envie-o para revisão. Enquanto estiver em rascunho ninguém o vê na biblioteca.'}
                >
                  {temFiltros
                    ? <Button variant="outline" onClick={limparTudo}><X className="h-4 w-4" aria-hidden="true" />Limpar filtros</Button>
                    : <Button onClick={() => setEditar({})}><FilePlus2 className="h-4 w-4" aria-hidden="true" />Novo documento</Button>}
                </Vazio>
              </LinhaMensagem>
            ) : (
              <tbody>
                {docsVista.map(d => {
                  const passos = PASSOS[d.estado || 'rascunho'] || [];
                  const aprova = podeAprovar(d);
                  const ocupado = aMudar === d.id;
                  const resps = responsaveisDoAeroporto(d.aeroporto_id);
                  const visiveis = passos.filter(p => !p.aprova || aprova);
                  const principal = visiveis[0];
                  const restantes = visiveis.slice(1);
                  const semFicheiro = !d.arquivo_privado_uri && !d.arquivo_url;
                  const meta = [caminhoPasta(pastas, d.pasta_id) || 'sem pasta', nomeAero(mapaAero, d.aeroporto_id), rotuloTipo(mapaTipos, d.tipo_id)].filter(Boolean).join(' · ');
                  return (
                    <Tr key={d.id} activa={seleccionados.has(d.id)}>
                      <Td>
                        <Checkbox checked={seleccionados.has(d.id)} onCheckedChange={() => alternarSel(d.id)} aria-label={`Seleccionar ${d.titulo}`} />
                      </Td>
                      <Td className="align-middle">
                        {d.numero
                          ? <Link to={urlDoc(d.id)} className={cn('whitespace-nowrap hover:underline', GD.ref, GD.foco, GD.tintaMedia)} title={d.numero}>{d.numero}</Link>
                          : <span className={cn('whitespace-nowrap text-sm', GD.alerta)} title="Documento sem código atribuído">sem código</span>}
                      </Td>
                      <Td className="max-w-[26rem]">
                        <CelulaDocumento doc={d} meta={meta} semNumero />
                        {(semFicheiro || d.nivel_confidencialidade !== 'interno' || d.bloquear_download || d.exige_leitura || vigorMarcado.has(d.id) || repetidosPorDecidir.has(d.id)) && (
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                            {semFicheiro && <span className={cn('inline-flex items-center gap-1', GD.alerta)}><AlertTriangle className="h-3 w-3" aria-hidden="true" />sem ficheiro</span>}
                            {vigorMarcado.has(d.id) && <span className={cn('inline-flex items-center gap-1', GD.acento)}><CalendarClock className="h-3 w-3" aria-hidden="true" />revisão nova entra em vigor em {fmtData(vigorMarcado.get(d.id))}</span>}
                            {repetidosPorDecidir.has(d.id) && <span className={cn('inline-flex items-center gap-1', GD.alerta)}><Copy className="h-3 w-3" aria-hidden="true" />ficheiro repetido</span>}
                            {d.nivel_confidencialidade && d.nivel_confidencialidade !== 'interno' && <span className={cn('inline-flex items-center gap-1', GD.meta)}><ShieldCheck className="h-3 w-3" aria-hidden="true" />{CONF_LABEL[d.nivel_confidencialidade]}</span>}
                            {d.bloquear_download && <span className={cn('inline-flex items-center gap-1', GD.meta)}><Download className="h-3 w-3" aria-hidden="true" />só leitura</span>}
                            {d.exige_leitura && <span className={cn('inline-flex items-center gap-1', GD.meta)}>exige confirmação</span>}
                          </span>
                        )}
                      </Td>
                      <Td className="hidden sm:table-cell"><SeloFormato doc={d} /></Td>
                      <Td><EstadoChip estado={d.estado} /></Td>
                      <Td numerico className={cn('text-sm', GD.ref, GD.meta)}>{versaoDoc(d)}</Td>
                      <Td className={cn('hidden text-sm tabular-nums md:table-cell', GD.meta)}>{textoVigor(d)}</Td>
                      <Td className="hidden lg:table-cell"><ValidadeChip documento={d} sempre /></Td>
                      <Td className={cn('hidden max-w-[12rem] truncate text-sm xl:table-cell', d.responsavel_email ? GD.meta : GD.alerta)}>
                        {d.responsavel_email || 'sem responsável'}
                      </Td>
                      <Td>
                        <AccoesLinha>
                          {principal && (
                            <Button size="sm" variant={principal.variante || 'default'} disabled={ocupado}
                              onClick={() => setConfirmar({
                                t: principal.label,
                                m: `${principal.label}: «${d.titulo}»? O documento passa de ${ESTADO_LABEL[d.estado] || d.estado} a ${ESTADO_LABEL[principal.para] || principal.para}.${principal.para === 'em_vigor' ? ' Fica visível a quem tem acesso à pasta.' : ''}${principal.para === 'obsoleto' ? ' Deixa de contar como documento em vigor.' : ''}`,
                                f: () => mudarEstado(d, principal.para, principal.label),
                                destrutivo: principal.para === 'obsoleto',
                              })}>
                              {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <principal.icone className="h-4 w-4" aria-hidden="true" />}{principal.label}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => setEditar(d)}><Pencil className="h-4 w-4" aria-hidden="true" />Editar</Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" aria-label={`Mais acções para ${d.titulo}`}><MoreHorizontal className="h-4 w-4" aria-hidden="true" />Mais</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-60">
                              <DropdownMenuItem asChild><Link to={urlDoc(d.id)} className="flex items-center gap-2"><Eye className="h-4 w-4" aria-hidden="true" />Abrir como quem consulta</Link></DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setVersaoDe(d)} className="flex items-center gap-2"><FilePlus2 className="h-4 w-4" aria-hidden="true" />Nova versão</DropdownMenuItem>
                              {aprova && (
                                <DropdownMenuItem onSelect={() => setAgendar(d)} className="flex items-center gap-2">
                                  <CalendarClock className="h-4 w-4" aria-hidden="true" />
                                  {vigorMarcado.has(d.id) ? 'Mudar a data de entrada em vigor' : 'Agendar entrada em vigor'}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onSelect={() => setAtribuir([d])} className="flex items-center gap-2"><UserPlus className="h-4 w-4" aria-hidden="true" />{d.responsavel_email ? 'Mudar responsável' : 'Atribuir responsável'}</DropdownMenuItem>
                              {restantes.map(p => (
                                <DropdownMenuItem key={p.para} className="flex items-center gap-2"
                                  onSelect={() => setConfirmar({
                                    t: p.label,
                                    m: `${p.label}: «${d.titulo}»? O documento passa de ${ESTADO_LABEL[d.estado] || d.estado} a ${ESTADO_LABEL[p.para] || p.para}.`,
                                    f: () => mudarEstado(d, p.para, p.label),
                                    destrutivo: p.para === 'obsoleto',
                                  })}>
                                  <p.icone className="h-4 w-4" aria-hidden="true" />{p.label}
                                </DropdownMenuItem>
                              ))}
                              {gestor && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className={cn('flex items-center gap-2', GD.perigo)}
                                    onSelect={() => setConfirmar({ t: 'Enviar para a lixeira', m: `Apagar «${d.titulo}»? Fica na lixeira e deixa de aparecer no portal. O histórico de versões e de leituras mantém-se.`, f: () => apagar(d), destrutivo: true })}>
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />Enviar para a lixeira
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </AccoesLinha>
                        {passos.some(p => p.aprova) && !aprova && (
                          <p className={cn('mt-0.5 text-right text-xs', GD.meta)}>
                            Aprovação reservada ao administrador{resps.length ? ` ou a ${resps.map(r => r.nome || r.email).join(', ')}` : ' ou ao responsável do aeroporto'}.
                          </p>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            )}
        </Tabela>
      </Painel>

      <BarraSelecao n={docsSel.length} aoLimpar={() => setSeleccionados(new Set())}>
        <Button size="sm" variant="outline" onClick={() => setAtribuir(docsSel)}><UserPlus className="h-4 w-4" aria-hidden="true" />Atribuir responsável</Button>
        <Button size="sm" variant="outline" onClick={() => setConfirmar({
          t: 'Marcar como obsoletos',
          m: `Marcar ${docsSel.length} documento(s) como obsoletos? Deixam de contar como documentos em vigor e saem da biblioteca de quem consulta. O histórico mantém-se.`,
          f: () => obsoletoEmMassa(docsSel), destrutivo: true,
        })}><Ban className="h-4 w-4" aria-hidden="true" />Marcar obsoleto</Button>
        {gestor && (
          <Button size="sm" variant="outline" className={GD.perigo} onClick={() => setConfirmar({
            t: 'Enviar para a lixeira',
            m: `Apagar ${docsSel.length} documento(s)? Ficam na lixeira e deixam de aparecer no portal. O histórico de versões e de leituras mantém-se, e são recuperáveis durante o prazo de retenção.`,
            f: () => apagarEmMassa(docsSel), destrutivo: true,
          })}><Trash2 className="h-4 w-4" aria-hidden="true" />Enviar para a lixeira</Button>
        )}
      </BarraSelecao>

      {carregados.length >= 1000 && <p className={cn('text-sm', GD.meta)}>Está a ver os 1000 documentos alterados mais recentemente. Use os filtros para chegar aos restantes.</p>}
      <p className={cn('text-sm', GD.meta)}>As pastas e as permissões gerem-se em <Link to={`${PORTAL_BASE}/gestao/pastas`} className="underline">Pastas</Link>.</p>
        </TabsContent>

        <TabsContent value="repetidos" className="mt-4">
          <AbaRepetidos actor={user} aeroportos={mapaAero} gestor={gestor} />
        </TabsContent>

        <TabsContent value="eliminacao" className="mt-4">
          <AbaEliminacao actor={user} admin={admin} gestor={gestor} tipos={tipos} />
        </TabsContent>
      </Tabs>

      {editar && (
        <DialogDocumento
          doc={editar.id ? editar : null}
          pastaInicial={pasta}
          aeroportoInicial={aeroporto}
          actor={user}
          aeroportos={aeroportos}
          tipos={tipos}
          pastas={pastas}
          onFechar={() => setEditar(null)}
          onFeito={() => { setEditar(null); recarregar('documentos'); }}
        />
      )}
      {versaoDe && (
        <DialogNovaVersao
          doc={versaoDe}
          actor={user}
          podeSubstituirSemRevisao={podeAprovar(versaoDe)}
          onFechar={() => setVersaoDe(null)}
          onFeito={() => { setVersaoDe(null); recarregar(); }}
        />
      )}
      {agendar && (
        <DialogAgendarVigor
          doc={agendar}
          actor={user}
          onFechar={() => setAgendar(null)}
          onFeito={() => { setAgendar(null); recarregar(); }}
        />
      )}
      {atribuir && atribuir.length > 0 && (
        <DialogResponsavel
          alvo={atribuir}
          semResponsavel={semResponsavel}
          responsaveis={responsaveisQ.data || []}
          aeroportos={mapaAero}
          actor={user}
          onFechar={() => setAtribuir(null)}
          onFeito={() => { setAtribuir(null); setSeleccionados(new Set()); recarregar('documentos'); }}
        />
      )}
      <ConfirmModal isOpen={!!confirmar} onClose={() => setConfirmar(null)} onConfirm={() => confirmar?.f?.()} title={confirmar?.t} message={confirmar?.m} confirmText={confirmar?.t} variant={confirmar?.destrutivo ? 'destructive' : 'default'} />
    </>
  );
}
