// A minha conta no Portal de Documentos: quem é, o que o perfil permite, a que aeroportos tem acesso, mudar a
// senha, o tamanho do texto e terminar sessão. Mesma densidade e hierarquia do ecrã de entrada: títulos de secção
// discretos, uma só caixa por secção, linhas compactas em vez de cartões. A acção destrutiva fica separada, no fim.
// Os dados de identificação são de leitura: quem os altera é a gestão do portal (Gestão › Acessos).
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, KeyRound, Loader2, LogOut, Mail, ShieldCheck, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { logAuthEvent } from '@/lib/auditLog';
import { traduzErroAuth } from '@/lib/authErros';
import { PERFIS_DOCUMENTOS, PERFIL_DOC_LABEL, perfisDocTexto, perfisPortal, iniciais } from '@/lib/portalDocumentos';
import { useAeroportosDocs, useAcessoAeroportoDocs, useDocumentosDocs, useConfigPortalDocs } from '../hooks';
import { sairDoPortal, T, Ref, TituloSeccao, EstadoVazio, EstadoErro, EsqueletoLinhas } from '../PortalLayout';
// O tamanho do texto é uma preferência guardada neste navegador e aplicada ao <html>: tem de vir do módulo que a
// aplica, senão ficavam duas verdades.
import { TAMANHOS_TEXTO_DOCS, preferenciaTextoDocs, guardarPreferenciaTextoDocs } from './PortalBiblioteca';

// Regras de senha do portal (as mesmas que o servidor exige).
function validarSenha(pw) {
  const p = String(pw || '');
  const erros = [];
  if (p.length < 8) erros.push('pelo menos 8 caracteres');
  if (!/[A-Z]/.test(p)) erros.push('uma letra maiúscula');
  if (!/[0-9]/.test(p)) erros.push('um número');
  return { ok: erros.length === 0, mensagem: erros.length ? `A senha precisa de ${erros.join(', ')}.` : '' };
}

function Mensagem({ m }) {
  if (!m) return null;
  return (
    <p role="status" className={cn('flex items-start gap-2 text-sm', m.ok ? T.verde : T.vermelho)}>
      {m.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
      {m.texto}
    </p>
  );
}

// Secção da página: título discreto por fora, uma só caixa por dentro.
function Bloco({ titulo, descricao, children, className }) {
  return (
    <section className={className}>
      <TituloSeccao>{titulo}</TituloSeccao>
      <div className={cn('p-4 sm:p-5', T.caixa)}>
        {descricao && <p className={cn('mb-4 text-sm', T.tintaFraca)}>{descricao}</p>}
        {children}
      </div>
    </section>
  );
}

const selo = 'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm font-medium leading-5';

export default function PortalConta() {
  const { user, logout } = useAuth();
  const perfis = perfisPortal(user);
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [aMudar, setAMudar] = useState(false);
  const [msgSenha, setMsgSenha] = useState(null);
  const [texto, setTexto] = useState(() => preferenciaTextoDocs());

  const aeroQ = useAeroportosDocs();
  const acessoQ = useAcessoAeroportoDocs();
  const docsQ = useDocumentosDocs({ limite: 1000 });
  const cfgQ = useConfigPortalDocs();

  const email = String(user?.email || '').toLowerCase();
  const meusAeroportos = useMemo(() => {
    const ids = new Set((acessoQ.data || []).filter(r => String(r.email || '').toLowerCase() === email).map(r => r.aeroporto_id).filter(Boolean));
    // Sem registos próprios (contas de gestão, ou acessos ainda por lançar), mostra os aeroportos dos documentos
    // que o servidor lhe devolve — que é, na prática, o que consegue consultar.
    if (ids.size === 0) for (const d of (docsQ.data || [])) if (d.aeroporto_id) ids.add(d.aeroporto_id);
    const mapa = new Map((aeroQ.data || []).map(a => [a.id, a]));
    return [...ids].map(id => mapa.get(id) || { id, codigo_icao: '—', nome: 'Aeroporto' })
      .sort((a, b) => String(a.codigo_icao).localeCompare(String(b.codigo_icao), 'pt'));
  }, [acessoQ.data, docsQ.data, aeroQ.data, email]);

  const perfisDoPortal = (user?.perfis || []).filter(p => PERFIS_DOCUMENTOS.includes(p));
  const aCarregarAeroportos = acessoQ.isLoading || aeroQ.isLoading || docsQ.isLoading;
  const falhaAeroportos = !aCarregarAeroportos && (aeroQ.isError || acessoQ.isError || docsQ.isError);
  const emailApoio = cfgQ.data?.email_suporte || '';

  const mudarSenha = async (e) => {
    e.preventDefault();
    const v = validarSenha(senha);
    if (!v.ok) { setMsgSenha({ ok: false, texto: v.mensagem }); return; }
    if (senha !== confirmar) { setMsgSenha({ ok: false, texto: 'As senhas não coincidem.' }); return; }
    setAMudar(true); setMsgSenha(null);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setAMudar(false);
    if (error) { setMsgSenha({ ok: false, texto: traduzErroAuth(error.message) }); return; }
    logAuthEvent('senha_alterada', user?.email, 'Senha alterada pelo próprio no Portal de Documentos', 'Documentos');
    setSenha(''); setConfirmar('');
    setMsgSenha({ ok: true, texto: 'Senha alterada. Use-a no próximo início de sessão.' });
  };

  const alterarTexto = (v) => { setTexto(v); guardarPreferenciaTextoDocs(v); };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      {/* Identificação */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-800 text-base font-bold text-white" aria-hidden="true">{iniciais(user?.full_name || user?.email)}</span>
          <div className="min-w-0">
            <h1 className={cn('truncate text-xl font-bold tracking-tight sm:text-2xl', T.tinta)}>{user?.full_name || user?.email || 'A minha conta'}</h1>
            <p className={cn('truncate text-sm', T.tintaFraca)}>{user?.email}</p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {perfisDoPortal.map(p => (
            <li key={p} className={cn(selo, T.linha, T.superficieFraca, T.tintaMedia)}>{PERFIL_DOC_LABEL[p] || p}</li>
          ))}
          {perfis.gestor && (
            <li className={cn(selo, 'border-teal-300 dark:border-teal-800', T.acentoFundo)}>
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />Gestão documental
            </li>
          )}
        </ul>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Dados */}
        <Bloco titulo="Os meus dados" descricao="Para corrigir o nome ou o email, fale com a gestão do portal.">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="conta-nome">Nome</Label>
              <Input id="conta-nome" value={user?.full_name || ''} readOnly className={cn("h-11 text-base md:text-base", T.superficieFraca)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conta-email">Email</Label>
              <Input id="conta-email" value={user?.email || ''} readOnly className={cn("h-11 text-base md:text-base", T.superficieFraca)} />
            </div>
            <div className="space-y-1.5">
              <p className={cn('text-sm font-medium', T.tintaMedia)}>O que o seu perfil permite</p>
              <p className={cn('text-sm', T.tinta)}>{perfisDocTexto(user?.perfis) || 'Sem perfil do portal atribuído.'}</p>
              <p className={cn('text-sm', T.tintaFraca)}>
                {perfis.admin ? 'Administra o portal e as suas configurações.'
                  : perfis.gestor ? 'Aprova, publica e gere pastas, permissões e links.'
                    : perfis.editor ? 'Carrega e edita documentos; a aprovação é de um gestor.'
                      : 'Consulta os documentos dos seus aeroportos e confirma leituras.'}
              </p>
            </div>
          </div>
        </Bloco>

        {/* Senha */}
        <Bloco titulo="Alterar senha" descricao="A senha deste portal é só sua: mudá-la aqui não altera nenhuma outra.">
          <form onSubmit={mudarSenha} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="conta-senha">Nova senha</Label>
              <Input id="conta-senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" required className="h-11 text-base md:text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conta-conf">Confirmar senha</Label>
              <Input id="conta-conf" type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} autoComplete="new-password" required className="h-11 text-base md:text-base" />
            </div>
            <p className={cn('text-sm', T.tintaFraca)}>Mínimo 8 caracteres, uma maiúscula e um número.</p>
            <Mensagem m={msgSenha} />
            <Button type="submit" className="h-11" disabled={aMudar || !senha || !confirmar}>
              {aMudar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}Alterar senha
            </Button>
          </form>
        </Bloco>
      </div>

      {/* Aeroportos: linhas compactas, como no ecrã de entrada. */}
      <section>
        <TituloSeccao contagem={!aCarregarAeroportos && meusAeroportos.length ? meusAeroportos.length : null}>Aeroportos a que tem acesso</TituloSeccao>
        <div className={cn('overflow-hidden', T.caixa)}>
          <p className={cn('border-b px-4 py-3 text-sm', T.linha, T.tintaFraca)}>
            Só vê documentos e pastas destes aeroportos. Quem altera esta lista é a gestão do portal.
          </p>
          {aCarregarAeroportos ? (
            <EsqueletoLinhas linhas={2} />
          ) : falhaAeroportos ? (
            <EstadoErro titulo="Não foi possível carregar os seus aeroportos" onTentar={() => { aeroQ.refetch?.(); acessoQ.refetch?.(); docsQ.refetch?.(); }} />
          ) : meusAeroportos.length === 0 ? (
            <EstadoVazio
              icone={Building2}
              titulo="Ainda não tem nenhum aeroporto atribuído"
              texto="Sem aeroporto atribuído não lhe aparecem documentos. Peça à gestão do portal que o associe ao aeroporto onde trabalha."
            >
              {emailApoio && (
                <Button asChild variant="outline" className="h-11">
                  <a href={`mailto:${emailApoio}?subject=${encodeURIComponent('Acesso aos documentos do meu aeroporto')}`}>
                    <Mail className="h-4 w-4" aria-hidden="true" />Pedir acesso
                  </a>
                </Button>
              )}
            </EstadoVazio>
          ) : (
            <ul className={cn('divide-y', T.divisoria)}>
              {meusAeroportos.map(a => (
                <li key={a.id} className="flex min-h-[3rem] items-center gap-3 px-3 py-2.5 sm:px-4">
                  <Building2 className={cn('h-5 w-5 shrink-0', T.tintaFraca)} aria-hidden="true" />
                  <Ref className={cn('w-12 shrink-0 font-semibold', T.tinta)}>{a.codigo_icao || '—'}</Ref>
                  <span className={cn('min-w-0 flex-1 truncate text-sm', T.tintaMedia)}>{a.nome}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Preferências de leitura */}
      <Bloco titulo="Preferências de leitura" descricao="Guardadas neste navegador.">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-start gap-3">
            <Type className={cn('mt-0.5 h-5 w-5 shrink-0', T.tintaFraca)} aria-hidden="true" />
            <div>
              <Label htmlFor="conta-texto" className="font-medium">Tamanho do texto</Label>
              <p className={cn('text-sm', T.tintaFraca)}>Por omissão o portal acompanha o tamanho do ecrã; aqui pode torná-lo maior ou menor.</p>
            </div>
          </div>
          <div className="w-full sm:w-64">
            <Select id="conta-texto" options={TAMANHOS_TEXTO_DOCS.map(t => ({ value: t.value, label: t.label }))} value={texto} onValueChange={alterarTexto} />
          </div>
        </div>
      </Bloco>

      {/* Fim da sessão: separado do resto, no fim. */}
      <div className={cn('flex flex-wrap items-center justify-between gap-3 border-t pt-5', T.linha)}>
        <p className={cn('text-sm', T.tintaFraca)}>Termina a sessão neste dispositivo. Volta a entrar com o seu email e senha.</p>
        <Button variant="outline" className={cn('h-11 border-red-300 hover:text-red-800 dark:border-red-900 dark:hover:text-red-200', T.vermelho)} onClick={() => sairDoPortal(user, logout)}>
          <LogOut className="h-4 w-4" aria-hidden="true" />Terminar sessão
        </Button>
      </div>
    </div>
  );
}
