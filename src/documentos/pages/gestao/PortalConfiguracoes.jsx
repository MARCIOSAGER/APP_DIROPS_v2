// Configurações do Portal de Documentos: identidade (nome, frase, mensagem da entrada), emails, regras de acesso
// (pedidos abertos, domínios, validade dos convites), retenção da lixeira, marca de água e OCR.
// Reservado a administradores do portal — a gravação é travada pelo servidor (política docs_config_update da 135)
// e aqui esconde-se o formulário a quem não pode gravar, para não prometer o que não se cumpre.
// Os aeroportos do portal (lista própria, migração 145), quem aprova e quem vê os documentos de cada um não se
// configuram aqui: vivem em Acessos › Aeroportos, que é onde se criam e editam.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Building2, CheckCircle2, Droplets, Info, KeyRound, Loader2, Mail, Palette, Pencil,
  Plus, ScanText, Scale, Settings, ShieldAlert, Timer, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import Select from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { fmtDataHora } from '@/lib/safeDate';
import { PORTAL_BASE, ehAdminPortal } from '@/lib/portalDocumentos';
import {
  useConfigPortalDocs, guardarConfigPortalDocs, useRecarregarDocs, auditarDocs,
  useTiposDocumento, usePoliticasRetencao, guardarPoliticaRetencao, apagarPoliticaRetencao,
} from '../../hooks';
import { Vazio, Falha, mapaPorId, rotuloTipo } from '../PortalBiblioteca';
import { PaginaGestao } from '../../PortalLayout';
// Mesmo componente da Universidade: as colunas da foto têm o mesmo nome (imagem_inicio_url / _credito, migr 176).
import { ImagemPortalCampo } from '@/universidade/pages/gestao/PortalConfiguracoes';
import { imagemPortal } from '@/universidade/imagens';
import VeuCabecalhoCampo from '@/components/shared/VeuCabecalhoCampo';
import {
  GD, Painel, Cabecalho, Tabela, Th, Tr, Td, AccoesLinha, LinhasEsqueleto, LinhaMensagem, useFiltrosUrl,
} from './PortalGestaoPainel';

const NOME_PADRAO = 'Documentos SGA';
const ABAS = ['portal', 'acesso', 'email', 'documentos', 'retencao'];
const listaEmails = (texto) => String(texto || '').split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);
const emailsInvalidos = (texto) => listaEmails(texto).filter(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
const dominios = (texto) => [...new Set(String(texto || '').split(/[,;\s]+/).map(d => d.trim().toLowerCase().replace(/^@+/, '')).filter(Boolean))];
const numero = (v, min, max, padrao) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : padrao;
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
// ── retenção: prazo por tipo de documento ───────────────────────────────────
// O que a lei angolana fixa (pesquisa de mercado, secção 3): 5 anos para os relatórios de auditoria interna do
// SGSO (22C.113.d) e 1 ano para as fichas de inspecção (22C.609.b). São prazos MÍNIMOS de guarda — não ordens de
// eliminação. Para o resto, é a SGA que fixa. Nada se apaga por aqui: a eliminação precisa sempre de autorização
// registada, em Documentos › Retenção e eliminação.
const CONTAR_DE = [
  { value: 'em_vigor_desde', label: 'Da entrada em vigor' },
  { value: 'publicacao_em', label: 'Da publicação' },
  { value: 'expira_em', label: 'Do fim da validade' },
  { value: 'created_date', label: 'Da entrada no portal' },
  { value: 'obsoleto_em', label: 'De quando passou a obsoleto' },
];
const CONTAR_DE_LABEL = Object.fromEntries(CONTAR_DE.map(o => [o.value, o.label]));
const ACCAO_FIM = [
  { value: 'rever', label: 'Rever — só avisa, não propõe nada' },
  { value: 'propor_eliminacao', label: 'Propor a eliminação (fica à espera de autorização)' },
  { value: 'arquivar_definitivo', label: 'Guardar para sempre — nunca entra em eliminação' },
];
const ACCAO_FIM_CURTO = { rever: 'Rever', propor_eliminacao: 'Propor eliminação', arquivar_definitivo: 'Guardar para sempre' };
const prazoTexto = (meses) => {
  const m = Number(meses) || 0;
  if (m % 12 === 0 && m >= 12) return `${m / 12} ano${m === 12 ? '' : 's'}`;
  return `${m} ${m === 1 ? 'mês' : 'meses'}`;
};

function DialogPolitica({ politica, tipos, actor, onFechar, onFeito }) {
  const { toast } = useToast();
  const nova = !politica?.id;
  const [f, setF] = useState(() => ({
    id: politica?.id,
    nome: politica?.nome || '',
    tipo_id: politica?.tipo_id || '',
    tags: (Array.isArray(politica?.aplica_tags) ? politica.aplica_tags : []).join(', '),
    prazo_meses: politica?.prazo_meses ?? 60,
    contar_de: politica?.contar_de || 'em_vigor_desde',
    acao_no_fim: politica?.acao_no_fim || 'rever',
    fundamento_legal: politica?.fundamento_legal || '',
    minimo_legal: !!politica?.minimo_legal,
    prioridade: politica?.prioridade ?? 0,
    ativo: politica?.ativo !== false,
    nota: politica?.nota || '',
  }));
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const guardar = async () => {
    setBusy(true);
    try {
      await guardarPoliticaRetencao({
        ...f,
        tipo_id: f.tipo_id || null,
        aplica_tags: String(f.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
      }, actor);
      await auditarDocs(actor, {
        acao: nova ? 'retencao_politica_criada' : 'retencao_politica_alterada', entidade: 'retencao', id: f.id || null,
        detalhes: `Política de retenção «${f.nome}»: ${prazoTexto(f.prazo_meses)} ${CONTAR_DE_LABEL[f.contar_de]?.toLowerCase()} · no fim: ${ACCAO_FIM_CURTO[f.acao_no_fim]}`,
      });
      toast({ title: nova ? 'Política criada' : 'Política actualizada', description: 'Passa a valer para os documentos que correspondem.' });
      onFeito();
    } catch (e) {
      toast({ title: 'Não foi possível guardar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Timer className="h-5 w-5 text-teal-600" aria-hidden="true" />{nova ? 'Nova política de retenção' : 'Editar política de retenção'}</DialogTitle>
          <DialogDescription>
            Quanto tempo se guarda, a contar de quando, e o que acontece no fim. Mais específica ganha: uma política
            com etiquetas ganha a do tipo, que ganha a regra de base.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="rp-nome" label="Nome *" className="sm:col-span-2" ajuda="É por ele que se distingue das outras. Ex.: «Relatórios de auditoria interna do SGSO».">
            <Input id="rp-nome" value={f.nome} onChange={e => set('nome', e.target.value)} maxLength={160} autoComplete="off" />
          </Campo>
          <Campo id="rp-tipo" label="Tipo de documento" ajuda="Vazio = regra de base, vale para todos os tipos.">
            <Select id="rp-tipo" options={[{ value: '', label: '— todos os tipos (regra de base) —' }, ...(tipos || []).map(t => ({ value: t.id, label: t.nome }))]} value={f.tipo_id} onValueChange={v => set('tipo_id', v)} />
          </Campo>
          <Campo id="rp-tags" label="Só com estas etiquetas" ajuda="Separadas por vírgula. Vazio = todos os documentos do tipo. Ex.: «sgso, auditoria».">
            <Input id="rp-tags" value={f.tags} onChange={e => set('tags', e.target.value)} maxLength={200} autoComplete="off" />
          </Campo>
          <Campo id="rp-prazo" label="Prazo (meses) *" ajuda={`Entre 1 e 1200. ${prazoTexto(f.prazo_meses)}.`}>
            <Input id="rp-prazo" type="number" min={1} max={1200} value={f.prazo_meses} onChange={e => set('prazo_meses', e.target.value)} className="max-w-[8rem]" />
          </Campo>
          <Campo id="rp-contar" label="Contado a partir de">
            <Select id="rp-contar" options={CONTAR_DE} value={f.contar_de} onValueChange={v => set('contar_de', v)} />
          </Campo>
          <Campo id="rp-fim" label="O que acontece no fim" className="sm:col-span-2" ajuda="Mesmo «propor a eliminação» não apaga nada: a proposta espera autorização de uma pessoa.">
            <Select id="rp-fim" options={ACCAO_FIM} value={f.acao_no_fim} onValueChange={v => set('acao_no_fim', v)} />
          </Campo>
          <Campo id="rp-lei" label="Fundamento legal" className="sm:col-span-2" ajuda="A norma que fixa o prazo, quando há. Ex.: «NTA 22C, 22C.113.d) — 5 anos».">
            <Input id="rp-lei" value={f.fundamento_legal} onChange={e => set('fundamento_legal', e.target.value)} maxLength={200} autoComplete="off" />
          </Campo>
          <Campo id="rp-prio" label="Prioridade" ajuda="Desempata quando duas políticas servem. Maior ganha.">
            <Input id="rp-prio" type="number" min={-100} max={100} value={f.prioridade} onChange={e => set('prioridade', e.target.value)} className="max-w-[8rem]" />
          </Campo>
          <div className={cn('space-y-3 rounded-lg border p-3', GD.borda)}>
            <Interruptor id="rp-min" titulo="Prazo imposto pela lei" texto="Marca a política como mínimo legal: fica à vista que não se encurta." valor={f.minimo_legal} onMudar={v => set('minimo_legal', v)} />
            <Interruptor id="rp-activa" titulo="Política activa" texto="Desligada, deixa de se aplicar; o que já foi proposto mantém-se." valor={f.ativo} onMudar={v => set('ativo', v)} />
          </div>
          <Campo id="rp-nota" label="Nota" className="sm:col-span-2" ajuda="Para quem vier depois: porque é que o prazo é este.">
            <Textarea id="rp-nota" value={f.nota} onChange={e => set('nota', e.target.value)} rows={2} maxLength={500} />
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={busy}>Cancelar</Button>
          <Button onClick={guardar} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{nova ? 'Criar política' : 'Guardar alterações'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Interruptor({ id, titulo, texto, valor, onMudar }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div><Label htmlFor={id} className="font-medium">{titulo}</Label><p className={cn('text-sm', GD.meta)}>{texto}</p></div>
      <Switch id={id} checked={!!valor} onCheckedChange={onMudar} />
    </div>
  );
}

export default function PortalConfiguracoes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const recarregar = useRecarregarDocs();
  const admin = ehAdminPortal(user);
  const { data: cfg, isLoading, isError, error, refetch } = useConfigPortalDocs();
  const [{ tab }, definir] = useFiltrosUrl({ tab: 'portal' });
  const aba = ABAS.includes(tab) ? tab : 'portal';
  const [f, setF] = useState(null);
  const [dominiosTexto, setDominiosTexto] = useState('');
  const [busy, setBusy] = useState(false);
  // Retenção: prazo por tipo de documento (migração 153). As eliminações propriamente ditas vivem na gestão de
  // documentos, porque são trabalho a fazer — aqui define-se a regra.
  const tiposQ = useTiposDocumento();
  const politicasQ = usePoliticasRetencao();
  const [politica, setPolitica] = useState(null);
  const [apagar, setApagar] = useState(null);
  const mapaTipos = useMemo(() => mapaPorId(tiposQ.data || []), [tiposQ.data]);

  const apagarPolitica = async (p) => {
    try {
      await apagarPoliticaRetencao(p.id);
      await auditarDocs(user, { acao: 'retencao_politica_apagada', entidade: 'retencao', id: p.id, detalhes: `Política de retenção «${p.nome}» apagada` });
      toast({ title: 'Política apagada', description: 'Os documentos que lhe correspondiam passam a seguir a política seguinte, ou nenhuma.' });
      recarregar('retencao-politicas');
      recarregar('retencao');
    } catch (e) {
      toast({ title: 'Não foi possível apagar', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (cfg && !f) { setF({ ...cfg }); setDominiosTexto((cfg.dominios_permitidos || []).join(', ')); }
  }, [cfg, f]);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const guardar = async () => {
    if (!f) return;
    const maus = [...emailsInvalidos(f.email_resposta), ...emailsInvalidos(f.email_suporte), ...emailsInvalidos(f.emails_notificar_acessos)];
    if (maus.length) { toast({ title: 'Email inválido', description: maus.join(', '), variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const patch = {
        nome_portal: f.nome_portal?.trim() || NOME_PADRAO,
        slogan: f.slogan?.trim() || null,
        mensagem_login: f.mensagem_login?.trim() || null,
        email_remetente_nome: f.email_remetente_nome?.trim() || null,
        email_resposta: listaEmails(f.email_resposta).join(', ') || null,
        email_suporte: listaEmails(f.email_suporte).join(', ') || null,
        emails_notificar_acessos: listaEmails(f.emails_notificar_acessos).join(', ') || null,
        rodape_email: f.rodape_email?.trim() || null,
        registo_aberto: !!f.registo_aberto,
        dominios_permitidos: dominios(dominiosTexto),
        validade_convite_dias: numero(f.validade_convite_dias, 1, 60, 7),
        retencao_lixeira_dias: numero(f.retencao_lixeira_dias, 7, 3650, 90),
        marca_dagua: !!f.marca_dagua,
        texto_marca_dagua: f.texto_marca_dagua?.trim() || null,
        ocr: !!f.ocr,
        updated_by: user?.email || null,
      };
      // Página inicial (migr 176): só se grava quando as colunas já existem na base, para nunca partir a gravação.
      if (cfg && 'imagem_inicio_url' in cfg) {
        patch.imagem_inicio_url = f.imagem_inicio_url || null;
        patch.imagem_inicio_credito = f.imagem_inicio_url ? (f.imagem_inicio_credito ?? '') : (f.imagem_inicio_credito || null);
        patch.texto_apresentacao = f.texto_apresentacao?.trim() || null;
        patch.mostrar_guia_inicio = f.mostrar_guia_inicio !== false;
      }
      if (cfg && 'hero_cor' in cfg) { patch.hero_cor = f.hero_cor || '#0b1f3a'; patch.hero_intensidade = f.hero_intensidade || 'forte'; }
      await guardarConfigPortalDocs(patch);
      await auditarDocs(user, { acao: 'config_alterada', entidade: 'portal', id: 'geral', detalhes: `Configurações do portal alteradas por ${user?.email || 'desconhecido'}` });
      recarregar('config');
      setF(x => ({ ...x, ...patch }));
      toast({ title: 'Configurações guardadas', description: 'As alterações aplicam-se de imediato e ficam na auditoria.' });
    } catch (e) {
      toast({ title: 'Não foi possível guardar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  if (!admin) {
    return (
      <PaginaGestao titulo="Configurações">
        <Painel>
          <Vazio
            icone={ShieldAlert}
            titulo="Reservado aos administradores do portal"
            texto="As configurações do Portal de Documentos — identidade, emails, regras de acesso, retenção e marca de água — só se alteram com o perfil «Administrador de documentos». Peça a um administrador, ou trate do que é seu nas outras páginas da gestão."
          />
        </Painel>
      </PaginaGestao>
    );
  }
  if (isLoading || (!f && !isError)) {
    return (
      <PaginaGestao titulo="Configurações">
        <Painel>
          <Tabela alturaMax="none" rotulo="A carregar as configurações">
            <thead><tr><Th>Opção</Th><Th>Valor</Th></tr></thead>
            <LinhasEsqueleto linhas={6} colunas={2} />
          </Tabela>
        </Painel>
      </PaginaGestao>
    );
  }
  if (isError) {
    return (
      <PaginaGestao titulo="Configurações">
        <Painel>
          <Falha
            titulo="Não foi possível carregar as configurações"
            texto={`${error?.message || 'O servidor não respondeu.'} Nada foi alterado: tente de novo. Enquanto isso, o portal continua a funcionar com as configurações que já tem.`}
            onTentar={() => refetch()}
          />
        </Painel>
      </PaginaGestao>
    );
  }

  const guardarBotao = (
    <Button onClick={guardar} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}Guardar alterações</Button>
  );

  return (
    <PaginaGestao
      titulo="Configurações"
      descricao="Identidade do portal, emails, regras de acesso, retenção da lixeira e marca de água. Cada alteração fica registada na auditoria."
      accoes={guardarBotao}
    >
      <Tabs value={aba} onValueChange={(t) => definir({ tab: t })}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="portal" className="gap-1.5 py-1.5"><Palette className="h-4 w-4" aria-hidden="true" />Portal</TabsTrigger>
          <TabsTrigger value="acesso" className="gap-1.5 py-1.5"><KeyRound className="h-4 w-4" aria-hidden="true" />Acesso</TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5 py-1.5"><Mail className="h-4 w-4" aria-hidden="true" />Email</TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1.5 py-1.5"><Droplets className="h-4 w-4" aria-hidden="true" />Documentos</TabsTrigger>
          <TabsTrigger value="retencao" className="gap-1.5 py-1.5"><Timer className="h-4 w-4" aria-hidden="true" />Retenção</TabsTrigger>
        </TabsList>

        <TabsContent value="portal" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Painel>
            <Cabecalho titulo="Identidade" descricao="Aparece no cabeçalho, na página de entrada e nos emails do portal." />
            <div className="space-y-4 p-3">
              <Campo id="cf-nome" label="Nome do portal" ajuda={`Vazio volta a «${NOME_PADRAO}».`}><Input id="cf-nome" value={f.nome_portal || ''} onChange={e => set('nome_portal', e.target.value)} maxLength={80} /></Campo>
              <Campo id="cf-slogan" label="Frase de apresentação" ajuda="Uma linha curta sob o nome, na entrada e no início."><Input id="cf-slogan" value={f.slogan || ''} onChange={e => set('slogan', e.target.value)} maxLength={200} /></Campo>
            </div>
          </Painel>
          <Painel>
            <Cabecalho titulo="Mensagem da página de entrada" descricao="Para avisos passageiros: manutenção, nova norma obrigatória, mudança de regras." />
            <div className="space-y-4 p-3">
              <Campo id="cf-login" label="Mensagem" ajuda="Vazio = não aparece nada."><Textarea id="cf-login" value={f.mensagem_login || ''} onChange={e => set('mensagem_login', e.target.value)} rows={4} maxLength={400} /></Campo>
            </div>
          </Painel>
          <Painel className="lg:col-span-2">
            <Cabecalho titulo="Página inicial" descricao="A foto de cabeçalho, o texto de apresentação e o guia rápido que quem entra vê no Início." />
            {cfg && 'imagem_inicio_url' in cfg ? (
              <div className="grid gap-4 p-3 lg:grid-cols-2">
                <ImagemPortalCampo qual="ged" f={f} set={set} toast={toast} />
                <div className="space-y-4">
                  <Campo id="cf-apres" label="Texto de apresentação" ajuda="Duas ou três frases sobre para que serve o portal. Vazio = usa a frase de apresentação acima.">
                    <Textarea id="cf-apres" value={f.texto_apresentacao || ''} onChange={e => set('texto_apresentacao', e.target.value)} rows={5} maxLength={500}
                      placeholder="O arquivo oficial dos manuais, procedimentos e formulários dos aeroportos da SGA. Consulte sempre aqui a versão em vigor antes de operar." />
                  </Campo>
                  <Interruptor id="cf-guia" titulo="Mostrar o guia «O que encontra aqui»" texto="Os cartões que explicam a Biblioteca, a Pesquisa, as Leituras e o AVSEC. Desligue quando a equipa já conhecer o portal." valor={f.mostrar_guia_inicio !== false} onMudar={v => set('mostrar_guia_inicio', v)} />
                </div>
                {'hero_cor' in cfg
                  ? <div className={cn('rounded-lg border p-3 lg:col-span-2', GD.borda)}><VeuCabecalhoCampo f={f} set={set} imagemUrl={imagemPortal(f, 'ged').url} titulo={f.nome_portal || 'Portal de Documentos'} texto={f.texto_apresentacao || f.slogan || ''} /></div>
                  : <p className={cn('text-sm lg:col-span-2', GD.meta)}>Para escolher a cor e a intensidade do véu sobre a foto é preciso aplicar a migração 177 (tools/ged-config/177_degrade_inicio.sql).</p>}
              </div>
            ) : (
              <p className={cn('p-3 text-sm', GD.meta)}>Para configurar a página inicial é preciso aplicar primeiro a migração 176 na base de dados (tools/ged-config/176_pagina_inicial.sql).</p>
            )}
          </Painel>
        </TabsContent>

        <TabsContent value="acesso" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Painel>
            <Cabecalho titulo="Pedidos de acesso" descricao="Quem pode pedir acesso pela página de entrada." />
            <div className="space-y-4 p-3">
              <Interruptor id="cf-registo" titulo="Aceitar pedidos de acesso" texto="Desligado: só entra quem for convidado por um gestor ou administrador." valor={f.registo_aberto} onMudar={v => set('registo_aberto', v)} />
              <Campo id="cf-dom" label="Domínios de email aceites" ajuda="Separados por vírgula, sem o @. Vazio = qualquer email (mas o relay da SGA só entrega a @sga.co.ao).">
                <Input id="cf-dom" value={dominiosTexto} onChange={e => setDominiosTexto(e.target.value)} placeholder="sga.co.ao" />
              </Campo>
            </div>
          </Painel>
          <Painel>
            <Cabecalho titulo="Convites" descricao="Quanto tempo vale o endereço que se envia a quem é convidado." />
            <div className="space-y-4 p-3">
              <Campo id="cf-convite" label="Validade do convite (dias)" ajuda="Entre 1 e 60. Depois deste prazo o endereço do convite deixa de funcionar; pode convidar de novo a qualquer momento.">
                <Input id="cf-convite" type="number" min={1} max={60} value={f.validade_convite_dias ?? 7} onChange={e => set('validade_convite_dias', e.target.value)} className="max-w-[8rem]" />
              </Campo>
              <div className={cn('rounded-lg border p-3 text-sm', GD.borda, GD.superficieFraca, GD.tintaMedia)}>
                <p className={cn('font-medium', GD.tinta)}>Como entra alguém no portal</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                  <li>Pede acesso na entrada (se os pedidos estiverem abertos) ou é convidado em Acessos › Convites.</li>
                  <li>Recebe um endereço de uso único para criar a senha, válido pelos dias acima.</li>
                  <li>Entra como leitor; os perfis mudam-se depois em Acessos › Utilizadores.</li>
                </ol>
              </div>
              {/* Os aeroportos do portal gerem-se no portal: aqui fica só o caminho para lá. */}
              <p className={cn('flex items-start gap-2 text-sm', GD.meta)}>
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Os <strong>aeroportos</strong> do portal, quem aprova e quem vê os documentos de cada um gerem-se em{' '}
                  <Link to={`${PORTAL_BASE}/gestao/acessos?tab=aeroportos`} className="underline">Acessos › Aeroportos</Link>.
                </span>
              </p>
            </div>
          </Painel>
        </TabsContent>

        <TabsContent value="email" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Painel>
            <Cabecalho titulo="Remetente e respostas" descricao="O servidor de email é o relay interno da SGA; aqui define-se como os emails do portal se apresentam." />
            <div className="space-y-4 p-3">
              <Campo id="cf-rem" label="Nome do remetente" ajuda="Aparece no «De:» dos emails do portal."><Input id="cf-rem" value={f.email_remetente_nome || ''} onChange={e => set('email_remetente_nome', e.target.value)} maxLength={80} placeholder={NOME_PADRAO} /></Campo>
              <Campo id="cf-resp" label="Responder para" ajuda="Um ou mais emails separados por vírgula. É para aqui que vão as respostas de quem recebe os emails."><Input id="cf-resp" value={f.email_resposta || ''} onChange={e => set('email_resposta', e.target.value)} placeholder="documentos@sga.co.ao" /></Campo>
              <Campo id="cf-rod" label="Rodapé dos emails"><Input id="cf-rod" value={f.rodape_email || ''} onChange={e => set('rodape_email', e.target.value)} maxLength={200} /></Campo>
            </div>
          </Painel>
          <Painel>
            <Cabecalho titulo="Quem recebe o quê" descricao="Endereços internos que recebem os avisos do portal." />
            <div className="space-y-4 p-3">
              <Campo id="cf-not" label="Avisar dos pedidos de acesso" ajuda="Um ou mais emails separados por vírgula. Recebem cada novo pedido feito na entrada."><Input id="cf-not" value={f.emails_notificar_acessos || ''} onChange={e => set('emails_notificar_acessos', e.target.value)} placeholder="documentos@sga.co.ao" /></Campo>
              <Campo id="cf-sup" label="Email de suporte do portal" ajuda="Mostrado a quem consulta, na entrada e na ajuda."><Input id="cf-sup" value={f.email_suporte || ''} onChange={e => set('email_suporte', e.target.value)} /></Campo>
              <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.avisoSuave)}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                O relay da SGA só entrega a endereços @sga.co.ao e recusa envios em massa. Para pessoas de fora, use os links partilháveis e envie-os pelo seu próprio email.
              </p>
            </div>
          </Painel>
        </TabsContent>

        <TabsContent value="documentos" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Painel>
            <Cabecalho icone={Droplets} titulo="Marca de água" descricao="Texto sobreposto na pré-visualização dos documentos, para desencorajar cópias e fotografias de ecrã." />
            <div className="space-y-4 p-3">
              <Interruptor id="cf-marca" titulo="Mostrar marca de água" texto="Aplica-se a quem consulta; não altera o ficheiro guardado." valor={f.marca_dagua} onMudar={v => set('marca_dagua', v)} />
              <Campo id="cf-marca-txt" label="Texto da marca de água" ajuda="Curto. Pode incluir o uso previsto, por exemplo «SGA — uso interno».">
                <Input id="cf-marca-txt" value={f.texto_marca_dagua || ''} onChange={e => set('texto_marca_dagua', e.target.value)} maxLength={80} disabled={!f.marca_dagua} placeholder="SGA — uso interno" />
              </Campo>
            </div>
          </Painel>
          <Painel>
            <Cabecalho icone={ScanText} titulo="Texto e lixeira" descricao="Pesquisa dentro de digitalizações e quanto tempo um documento apagado fica recuperável." />
            <div className="space-y-4 p-3">
              <Interruptor id="cf-ocr" titulo="Ler o texto dos documentos digitalizados (OCR)" texto="Deixa encontrar palavras dentro de PDF digitalizados. Torna o carregamento mais lento." valor={f.ocr} onMudar={v => set('ocr', v)} />
              <Campo id="cf-ret" label="Retenção da lixeira (dias)" ajuda="Entre 7 e 3650. Um documento apagado fica recuperável durante este prazo; depois é eliminado definitivamente.">
                <Input id="cf-ret" type="number" min={7} max={3650} value={f.retencao_lixeira_dias ?? 90} onChange={e => set('retencao_lixeira_dias', e.target.value)} className="max-w-[8rem]" />
              </Campo>
              <p className={cn('flex items-start gap-2 text-sm', GD.meta)}>
                <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                O histórico de versões e as confirmações de leitura não se apagam com o documento: ficam no registo para efeitos de auditoria.
              </p>
            </div>
          </Painel>
        </TabsContent>

        {/* ── retenção: prazo por tipo de documento ── */}
        <TabsContent value="retencao" className="mt-4 space-y-4">
          <p className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', GD.borda, GD.superficieFraca, GD.tintaMedia)}>
            <Scale className={cn('mt-0.5 h-4 w-4 shrink-0', GD.acento)} aria-hidden="true" />
            <span>
              A lei angolana fixa <strong>5 anos</strong> para os relatórios de auditoria interna do SGSO
              (22C.113.d) e <strong>1 ano</strong> para as fichas de inspecção (22C.609.b). São prazos mínimos de
              guarda, não ordens de eliminação — para o resto, é a SGA que fixa. Nada é apagado automaticamente: no
              fim do prazo o sistema propõe, e a eliminação só acontece com autorização registada, em{' '}
              <Link to={`${PORTAL_BASE}/gestao/documentos?tab=eliminacao`} className="underline">Documentos › Retenção e eliminação</Link>.
            </span>
          </p>

          <Painel>
            <Cabecalho
              icone={Timer}
              titulo="Políticas de retenção"
              contagem={(politicasQ.data || []).length}
              descricao="Mais específica ganha: etiquetas ganham o tipo, o tipo ganha a regra de base. Em empate decide a prioridade."
              accoes={<Button size="sm" onClick={() => setPolitica({})}><Plus className="h-4 w-4" aria-hidden="true" />Nova política</Button>}
            />
            <Tabela alturaMax="none" rotulo="Políticas de retenção">
              <thead>
                <tr>
                  <Th>Política</Th>
                  <Th className="hidden md:table-cell">Aplica-se a</Th>
                  <Th numerico estreito>Prazo</Th>
                  <Th className="hidden lg:table-cell">Conta de</Th>
                  <Th className="hidden lg:table-cell">No fim</Th>
                  <Th numerico>Acções</Th>
                </tr>
              </thead>
              {politicasQ.isLoading ? <LinhasEsqueleto linhas={4} colunas={6} />
                : politicasQ.isError ? (
                  <LinhaMensagem colunas={6}>
                    <Falha
                      titulo="Não foi possível carregar as políticas"
                      texto={`${politicasQ.error?.message || 'O servidor não respondeu.'} Se a mensagem falar de «documento_retencao_politica», a migração 153 ainda não foi aplicada.`}
                      onTentar={() => politicasQ.refetch()}
                    />
                  </LinhaMensagem>
                ) : (politicasQ.data || []).length === 0 ? (
                  <LinhaMensagem colunas={6}>
                    <Vazio
                      icone={Timer}
                      titulo="Nenhuma política de retenção"
                      texto="Sem políticas, nenhum documento tem prazo a correr e nada é proposto para eliminação. Comece pelos dois prazos que a lei fixa: 5 anos para os relatórios de auditoria do SGSO e 1 ano para as fichas de inspecção."
                    >
                      <Button onClick={() => setPolitica({})}><Plus className="h-4 w-4" aria-hidden="true" />Nova política</Button>
                    </Vazio>
                  </LinhaMensagem>
                ) : (
                  <tbody>
                    {(politicasQ.data || []).map(p => (
                      <Tr key={p.id} className={p.ativo ? undefined : 'opacity-60'}>
                        <Td className="max-w-[20rem]">
                          <div className="min-w-0">
                            <span className={cn('block truncate font-medium', GD.tinta)}>{p.nome}</span>
                            <span className={cn('block truncate text-sm', GD.meta)}>
                              {[p.fundamento_legal, p.minimo_legal ? 'prazo da lei' : null, p.ativo ? null : 'desactivada'].filter(Boolean).join(' · ') || 'sem fundamento legal indicado'}
                            </span>
                          </div>
                        </Td>
                        <Td className={cn('hidden max-w-[14rem] truncate text-sm md:table-cell', GD.meta)}>
                          {[rotuloTipo(mapaTipos, p.tipo_id) || 'todos os tipos',
                            (p.aplica_tags || []).length ? `etiquetas: ${(p.aplica_tags || []).join(', ')}` : null].filter(Boolean).join(' · ')}
                        </Td>
                        <Td numerico className={cn('whitespace-nowrap text-sm', GD.ref, GD.tintaMedia)}>{prazoTexto(p.prazo_meses)}</Td>
                        <Td className={cn('hidden text-sm lg:table-cell', GD.meta)}>{CONTAR_DE_LABEL[p.contar_de] || p.contar_de}</Td>
                        <Td className={cn('hidden text-sm lg:table-cell', p.acao_no_fim === 'propor_eliminacao' ? GD.alerta : GD.meta)}>
                          {ACCAO_FIM_CURTO[p.acao_no_fim] || p.acao_no_fim}
                        </Td>
                        <Td>
                          <AccoesLinha destrutivas={
                            <Button size="sm" variant="ghost" className={GD.perigo} onClick={() => setApagar(p)}>
                              <Trash2 className="h-4 w-4" aria-hidden="true" />Apagar
                            </Button>
                          }>
                            <Button size="sm" variant="outline" onClick={() => setPolitica(p)}><Pencil className="h-4 w-4" aria-hidden="true" />Editar</Button>
                          </AccoesLinha>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                )}
            </Tabela>
          </Painel>

          <p className={cn('flex items-start gap-1.5 text-sm', GD.meta)}>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            A retenção da lixeira (quanto tempo um documento apagado fica recuperável) é outra coisa e define-se no
            separador «Documentos».
          </p>
        </TabsContent>
      </Tabs>

      {politica && (
        <DialogPolitica
          politica={politica.id ? politica : null}
          tipos={tiposQ.data || []}
          actor={user}
          onFechar={() => setPolitica(null)}
          onFeito={() => { setPolitica(null); recarregar('retencao-politicas'); recarregar('retencao'); }}
        />
      )}
      <ConfirmModal
        isOpen={!!apagar}
        onClose={() => setApagar(null)}
        onConfirm={() => { const p = apagar; setApagar(null); apagarPolitica(p); }}
        title="Apagar a política de retenção"
        message={apagar ? `Apagar «${apagar.nome}»? Os documentos que lhe correspondiam deixam de ter este prazo a correr. Nenhum documento é apagado. Se o prazo vem da lei, prefira desactivar em vez de apagar.` : ''}
        confirmText="Apagar"
        variant="destructive"
      />

      <div className="flex flex-wrap items-center gap-2">
        {guardarBotao}
        <Button variant="outline" onClick={() => { setF({ ...cfg }); setDominiosTexto((cfg?.dominios_permitidos || []).join(', ')); }} disabled={busy}>Descartar alterações</Button>
        <span className={cn('flex items-center gap-1.5 text-sm', GD.meta)}>
          <Settings className="h-3 w-3" aria-hidden="true" />Última alteração: {cfg?.updated_by ? `${cfg.updated_by} · ` : ''}{cfg?.updated_date ? fmtDataHora(cfg.updated_date) : '—'}
        </span>
      </div>
      <p className={cn('flex items-start gap-1.5 text-sm', GD.meta)}>
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        A forma como as contas do portal são autenticadas é decidida na instalação do servidor e não se altera aqui.
      </p>
    </PaginaGestao>
  );
}
