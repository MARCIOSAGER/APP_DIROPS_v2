// Configurações do portal: identidade, regras de acesso (pedidos, domínios, convites) e envio de email (remetente, destinatários, tipos de email, teste).
import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Settings, Mail, KeyRound, Palette, Loader2, Send, CheckCircle2, AlertTriangle, Info, Upload, RotateCcw, ImageIcon } from 'lucide-react';
import { useRef } from 'react';
import { imagemPortal, carregarImagemPortal, IMAGENS_PADRAO } from '../../imagens';
import { estiloVeu, corVeu, intensidadeVeu } from '@/lib/veuCabecalho';
import VeuCabecalhoCampo from '@/components/shared/VeuCabecalhoCampo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import Select from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useTodosCursos } from '@/hooks/useGestaoFormacao';
import { normalizarDominios, emailValido, listaEmails, emailsInvalidos } from '@/lib/universidade';
import { useConfigPortal, useEstadoAcessos, guardarConfigPortal } from '../../hooks';
import { univAcesso } from '../../api';
import { PaginaGestao } from '../../PortalLayout';

const TOGGLES = [
  { k: 'enviar_convites', t: 'Convites de acesso', d: 'Email com o link para criar a senha quando um pedido é aprovado ou alguém é convidado.' },
  { k: 'enviar_aprovacoes', t: 'Respostas a pedidos', d: 'Aviso ao requerente quando o pedido é rejeitado (a aprovação envia sempre o convite).' },
  { k: 'enviar_lembretes', t: 'Lembretes de formação', d: 'Inscrição em curso, curso por concluir, formação obrigatória em falta, certificação a expirar/expirada (envio diário automático).' },
  { k: 'enviar_certificados', t: 'Certificados emitidos', d: 'Email com o certificado quando é emitido.' },
  { k: 'enviar_sessoes', t: 'Sessões', d: 'Lembrete automático na véspera das sessões presenciais e online (as convocatórias manuais continuam disponíveis).' },
  { k: 'enviar_comentarios', t: 'Perguntas e comentários nas aulas', d: 'O instrutor recebe cada pergunta nova por email; o formando recebe a resposta do instrutor.' },
];

// Imagem do portal (cabeçalho ou entrada): pré-visualização, carregar (redimensionada a 1920 px), repor padrão e crédito.
export function ImagemPortalCampo({ qual, f, set, toast }) {
  const inputRef = useRef(null);
  const [aEnviar, setAEnviar] = useState(false);
  const urlKey = qual === 'entrada' ? 'imagem_entrada_url' : 'imagem_inicio_url';
  const creditoKey = qual === 'entrada' ? 'imagem_entrada_credito' : 'imagem_inicio_credito';
  const actual = imagemPortal(f, qual);
  const escolher = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setAEnviar(true);
    try { const url = await carregarImagemPortal(file, { maxLargura: 1920 }); set(urlKey, url); if (!f[creditoKey]) set(creditoKey, ''); toast({ title: 'Imagem carregada', description: 'Guarde as alterações para a aplicar.' }); }
    catch (err) { toast({ title: 'Falha no carregamento', description: err?.message || String(err), variant: 'destructive' }); }
    finally { setAEnviar(false); }
  };
  return (
    <div className="space-y-2 rounded-lg border p-3 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{qual !== 'entrada' ? 'Cabeçalho da página inicial' : 'Painel da página de entrada'}</p><span className="text-[11px] text-slate-500">{actual.personalizada ? 'imagem personalizada' : 'imagem padrão'}</span></div>
      <div className="relative aspect-[21/9] w-full overflow-hidden rounded-md" style={{ backgroundColor: corVeu(f) }}>
        {actual.url ? <img src={actual.url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-white/40" aria-hidden="true" />}
        <div className="absolute inset-0" style={estiloVeu(corVeu(f), intensidadeVeu(f))} aria-hidden="true" />
        <p className="absolute bottom-2 left-3 text-xs font-semibold text-white/90">Pré-visualização com o véu escolhido</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={escolher} aria-label="Carregar imagem" />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={aEnviar}>{aEnviar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}{actual.personalizada ? 'Substituir imagem' : 'Carregar imagem'}</Button>
        {actual.personalizada && <Button type="button" variant="ghost" size="sm" onClick={() => { set(urlKey, null); set(creditoKey, null); }}><RotateCcw className="h-4 w-4" aria-hidden="true" />Repor imagem padrão</Button>}
      </div>
      <Campo id={`cf-cred-${qual}`} label="Crédito / legenda (opcional)" ajuda={`Aparece discretamente no canto. Padrão: «${IMAGENS_PADRAO[qual].credito}».`}><Input id={`cf-cred-${qual}`} value={f[creditoKey] ?? ''} onChange={e => set(creditoKey, e.target.value)} maxLength={160} placeholder={IMAGENS_PADRAO[qual].credito} /></Campo>
      <p className="text-xs text-slate-500">Use fotografias panorâmicas (mínimo 1600 px de largura, proporção ~21:9). A imagem é reduzida a 1920 px antes de ser guardada. Fotografias do AIAAN não devem ser usadas.</p>
    </div>
  );
}

function Campo({ id, label, ajuda, children }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}{ajuda && <p className="text-xs text-slate-500">{ajuda}</p>}</div>;
}

export default function PortalConfiguracoes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: cfg, isLoading } = useConfigPortal();
  const estadoQ = useEstadoAcessos();
  const { data: cursos = [] } = useTodosCursos();
  const [f, setF] = useState(null);
  const [dominiosTexto, setDominiosTexto] = useState('');
  const [aGuardar, setAGuardar] = useState(false);
  const [emailTeste, setEmailTeste] = useState(user?.email || '');
  const [aTestar, setATestar] = useState(false);
  useEffect(() => { if (cfg && !f) { setF(cfg); setDominiosTexto((cfg.dominios_permitidos || []).join(', ')); } }, [cfg, f]);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  const guardar = async () => {
    if (!f) return;
    const invalidos = [...emailsInvalidos(f.emails_notificar_acessos), ...emailsInvalidos(f.email_resposta), ...emailsInvalidos(f.email_suporte)];
    if (invalidos.length) { toast({ title: 'Email inválido', description: invalidos.join(', '), variant: 'destructive' }); return; }
    setAGuardar(true);
    try {
      const patch = {
        nome_portal: f.nome_portal?.trim() || 'Universidade Corporativa', slogan: f.slogan?.trim() || null, mensagem_login: f.mensagem_login?.trim() || null, texto_boas_vindas: f.texto_boas_vindas?.trim() || null, guia_curso_id: f.guia_curso_id || null,
        registo_aberto: !!f.registo_aberto, dominios_permitidos: normalizarDominios(dominiosTexto), aprovacao_automatica_internos: !!f.aprovacao_automatica_internos, validade_convite_dias: Math.min(60, Math.max(1, Number(f.validade_convite_dias) || 7)),
        email_remetente_nome: f.email_remetente_nome?.trim() || null, email_resposta: listaEmails(f.email_resposta).join(', ') || null, emails_notificar_acessos: listaEmails(f.emails_notificar_acessos).join(', ') || null, email_suporte: listaEmails(f.email_suporte).join(', ') || null, rodape_email: f.rodape_email?.trim() || null,
        enviar_convites: !!f.enviar_convites, enviar_aprovacoes: !!f.enviar_aprovacoes, enviar_lembretes: !!f.enviar_lembretes, enviar_certificados: !!f.enviar_certificados, enviar_sessoes: !!f.enviar_sessoes, enviar_comentarios: !!f.enviar_comentarios,
        ...('hero_cor' in (cfg || {}) ? { hero_cor: f.hero_cor || '#0b1f3a', hero_intensidade: f.hero_intensidade || 'forte' } : {}),
        imagem_inicio_url: f.imagem_inicio_url || null, imagem_inicio_credito: f.imagem_inicio_url ? (f.imagem_inicio_credito ?? '') : (f.imagem_inicio_credito || null), imagem_entrada_url: f.imagem_entrada_url || null, imagem_entrada_credito: f.imagem_entrada_url ? (f.imagem_entrada_credito ?? '') : (f.imagem_entrada_credito || null),
        updated_by: user?.email || null,
      };
      const novo = await guardarConfigPortal(patch);
      setF(novo); setDominiosTexto((novo.dominios_permitidos || []).join(', '));
      qc.invalidateQueries({ queryKey: ['universidade_config'] });
      toast({ title: 'Configurações guardadas', description: 'As alterações ficaram registadas na auditoria.' });
    } catch (e) { toast({ title: 'Não foi possível guardar', description: e?.message, variant: 'destructive' }); } finally { setAGuardar(false); }
  };
  const testar = async () => {
    if (!emailValido(emailTeste)) { toast({ title: 'Indique um email válido', variant: 'destructive' }); return; }
    setATestar(true);
    try { await univAcesso('testar_email', { to: emailTeste.trim() }); toast({ title: 'Email de teste enviado', description: `Verifique a caixa de ${emailTeste}.` }); }
    catch (e) { toast({ title: 'Falha no envio', description: e?.message, variant: 'destructive' }); } finally { setATestar(false); }
  };

  if (isLoading || !f) return <PaginaGestao titulo="Configurações"><Skeleton className="h-64 w-full" /></PaginaGestao>;
  const opcoesCurso = [{ value: '', label: '— sem curso guia —' }, ...cursos.map(c => ({ value: c.id, label: c.titulo }))];

  return (
    <PaginaGestao titulo="Configurações" descricao="Identidade do portal, regras de acesso e envio de email. Cada alteração fica no registo de auditoria." accoes={<Button onClick={guardar} disabled={aGuardar}>{aGuardar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}Guardar alterações</Button>}>
      <Tabs defaultValue="email">
        <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="email" className="gap-1.5 py-1.5"><Mail className="h-4 w-4" aria-hidden="true" />Envio de email</TabsTrigger>
          <TabsTrigger value="acesso" className="gap-1.5 py-1.5"><KeyRound className="h-4 w-4" aria-hidden="true" />Acesso</TabsTrigger>
          <TabsTrigger value="portal" className="gap-1.5 py-1.5"><Palette className="h-4 w-4" aria-hidden="true" />Portal</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-3"><CardTitle className="text-base">Remetente e destinatários</CardTitle><CardDescription>O servidor de email é o da SGA (relay interno); aqui define-se como os emails da Universidade se apresentam e para quem vão os avisos.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Campo id="cf-rem" label="Nome do remetente" ajuda="Aparece no «De:» dos emails da Universidade."><Input id="cf-rem" value={f.email_remetente_nome || ''} onChange={e => set('email_remetente_nome', e.target.value)} maxLength={80} /></Campo>
              <Campo id="cf-resp" label="Responder para (reply-to)" ajuda="Um ou mais emails separados por vírgula. Quando o formando responde ao email, a resposta vai para aqui."><Input id="cf-resp" type="text" inputMode="email" value={f.email_resposta || ''} onChange={e => set('email_resposta', e.target.value)} placeholder="formacao@sga.co.ao" /></Campo>
              <Campo id="cf-not" label="Avisar dos pedidos de acesso" ajuda="Um ou mais emails separados por vírgula. Recebem cada novo pedido de acesso."><Input id="cf-not" value={f.emails_notificar_acessos || ''} onChange={e => set('emails_notificar_acessos', e.target.value)} placeholder="oaeroportos@sga.co.ao, formacao@sga.co.ao" /></Campo>
              <Campo id="cf-sup" label="Email de suporte da Universidade" ajuda="Um ou mais emails separados por vírgula. Mostrado aos formandos na página de ajuda e de entrada; recebe os tickets do portal."><Input id="cf-sup" type="text" inputMode="email" value={f.email_suporte || ''} onChange={e => set('email_suporte', e.target.value)} /></Campo>
              <Campo id="cf-rod" label="Rodapé dos emails"><Input id="cf-rod" value={f.rodape_email || ''} onChange={e => set('rodape_email', e.target.value)} maxLength={200} /></Campo>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card className="dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="pb-3"><CardTitle className="text-base">Que emails enviar</CardTitle></CardHeader>
              <CardContent className="divide-y dark:divide-slate-800">{TOGGLES.map(t => <div key={t.k} className="flex items-start justify-between gap-4 py-3"><div><Label htmlFor={`cf-${t.k}`} className="font-medium">{t.t}</Label><p className="text-xs text-slate-500">{t.d}</p></div><Switch id={`cf-${t.k}`} checked={!!f[t.k]} onCheckedChange={v => set(t.k, v)} /></div>)}</CardContent>
            </Card>
            <Card className="dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="pb-3"><CardTitle className="text-base">Teste e estado do servidor</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {estadoQ.isError ? <p className="flex items-start gap-2 text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />O serviço de acessos/email ainda não está activo no servidor (reiniciar dirops-functions-v2). O teste de envio fica disponível depois.</p> : estadoQ.data ? (
                  <ul className="space-y-1">
                    <li className="flex items-center gap-2">{estadoQ.data.smtp ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />}SMTP {estadoQ.data.smtp ? 'configurado' : 'não configurado'} · remetente técnico {estadoQ.data.remetente?.address || '—'}</li>
                    <li className="flex items-center gap-2"><Info className="h-4 w-4 text-slate-400" aria-hidden="true" />Só entrega a {(estadoQ.data.dominios_internos || []).map(d => '@' + d).join(', ')} (relay da SGA). Para emails externos use «copiar link do convite».</li>
                    <li className="flex items-center gap-2">{estadoQ.data.auth_isolada ? (estadoQ.data.auth_uc ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />) : <Info className="h-4 w-4 text-slate-400" aria-hidden="true" />}Contas de acesso: {estadoQ.data.auth_isolada ? (estadoQ.data.auth_uc ? 'base própria da Universidade' : 'base própria da Universidade — o serviço de autenticação (dirops-auth-uc-v2) está em baixo') : 'partilhadas com o sistema principal (mesmo email e senha)'}</li>
                  </ul>
                ) : <Skeleton className="h-10 w-full" />}
                <div className="flex gap-2"><Input type="email" value={emailTeste} onChange={e => setEmailTeste(e.target.value)} placeholder="para@sga.co.ao" /><Button variant="outline" onClick={testar} disabled={aTestar || estadoQ.isError}>{aTestar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}Enviar teste</Button></div>
                <p className="text-xs text-slate-500">O teste usa o remetente e o rodapé guardados (guarde primeiro as alterações).</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="acesso" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-3"><CardTitle className="text-base">Pedidos de acesso</CardTitle><CardDescription>Quem pode pedir acesso pela página de entrada e como é aprovado.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4"><div><Label htmlFor="cf-reg" className="font-medium">Aceitar pedidos de acesso</Label><p className="text-xs text-slate-500">Desligado: só entram utilizadores convidados por um gestor.</p></div><Switch id="cf-reg" checked={!!f.registo_aberto} onCheckedChange={v => set('registo_aberto', v)} /></div>
              <Campo id="cf-dom" label="Domínios de email aceites" ajuda="Separados por vírgula. Vazio = qualquer email (o convite só é entregue automaticamente a @sga.co.ao)."><Input id="cf-dom" value={dominiosTexto} onChange={e => setDominiosTexto(e.target.value)} placeholder="sga.co.ao" /></Campo>
              <div className="flex items-start justify-between gap-4"><div><Label htmlFor="cf-auto" className="font-medium">Aprovar automaticamente emails internos</Label><p className="text-xs text-slate-500">Pedidos de @sga.co.ao recebem logo o convite, sem passar pela aprovação manual (perfil «formando»).</p></div><Switch id="cf-auto" checked={!!f.aprovacao_automatica_internos} onCheckedChange={v => set('aprovacao_automatica_internos', v)} /></div>
            </CardContent>
          </Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-3"><CardTitle className="text-base">Convites</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Campo id="cf-val" label="Validade do convite (dias)" ajuda="Depois deste prazo o link deixa de funcionar; pode reenviar a qualquer momento."><Input id="cf-val" type="number" min={1} max={60} value={f.validade_convite_dias ?? 7} onChange={e => set('validade_convite_dias', e.target.value)} className="max-w-[8rem]" /></Campo>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <p className="font-medium text-slate-800 dark:text-slate-100">Como funciona</p>
                <ol className="mt-1 list-decimal space-y-1 pl-4"><li>O gestor aprova um pedido ou convida directamente (Acessos).</li><li>É criada a conta com o perfil «formando» (acesso só à Universidade) e enviado o link de convite, válido pelos dias acima.</li><li>A pessoa cria a senha no link e entra. Tudo fica na auditoria.</li><li>Quem já tem conta entra com as credenciais que já tem — não precisa de convite.</li></ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="portal" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
            <CardHeader className="pb-3"><CardTitle className="text-base">Imagens</CardTitle><CardDescription>Fotografias de fundo do cabeçalho da página inicial e do painel da página de entrada. Ficam por baixo de um degradé azul, por isso resultam melhor imagens claras e amplas.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2"><ImagemPortalCampo qual="inicio" f={f} set={set} toast={toast} /><ImagemPortalCampo qual="entrada" f={f} set={set} toast={toast} />
              {'hero_cor' in (cfg || {}) && <div className="rounded-lg border p-3 dark:border-slate-800 lg:col-span-2"><VeuCabecalhoCampo f={f} set={set} imagemUrl={imagemPortal(f, 'inicio').url} titulo={f.nome_portal || 'Universidade Corporativa'} texto={f.texto_boas_vindas || f.slogan || ''} /></div>}</CardContent>
          </Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-3"><CardTitle className="text-base">Identidade</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Campo id="cf-nome" label="Nome do portal"><Input id="cf-nome" value={f.nome_portal || ''} onChange={e => set('nome_portal', e.target.value)} maxLength={80} /></Campo>
              <Campo id="cf-slogan" label="Frase de apresentação" ajuda="Na página de entrada e no topo da página inicial."><Input id="cf-slogan" value={f.slogan || ''} onChange={e => set('slogan', e.target.value)} maxLength={200} /></Campo>
              <Campo id="cf-guia" label="Curso guia («Como usar a Universidade»)" ajuda="Sugerido na página inicial e na ajuda."><Select options={opcoesCurso} value={f.guia_curso_id || ''} onValueChange={v => set('guia_curso_id', v || null)} /></Campo>
            </CardContent>
          </Card>
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-3"><CardTitle className="text-base">Mensagens</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Campo id="cf-login" label="Mensagem na página de entrada" ajuda="Ex.: manutenção programada, novo curso obrigatório. Vazio = não aparece."><Textarea id="cf-login" value={f.mensagem_login || ''} onChange={e => set('mensagem_login', e.target.value)} rows={3} maxLength={400} /></Campo>
              <Campo id="cf-bv" label="Boas-vindas na página inicial" ajuda="Texto sob o nome do utilizador (substitui a frase de apresentação)."><Textarea id="cf-bv" value={f.texto_boas_vindas || ''} onChange={e => set('texto_boas_vindas', e.target.value)} rows={3} maxLength={400} /></Campo>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <p className="text-xs text-slate-500"><Settings className="mr-1 inline h-3 w-3" aria-hidden="true" />Última alteração: {cfg?.updated_by ? `${cfg.updated_by} · ` : ''}{cfg?.updated_date ? new Date(cfg.updated_date).toLocaleString('pt-PT') : '—'}</p>
    </PaginaGestao>
  );
}
