// A minha conta: dados do perfil, alteração de senha e preferências de estudo (modo foco, modo de leitura).
import { useAeroportosUc, useFormandoUc, guardarFormandoUc } from '../hooks';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User as UserIcon, KeyRound, Loader2, CheckCircle2, AlertTriangle, PanelLeftClose, BookOpen, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { User as UserEntity } from '@/entities/User';
import { preferenciaModoFoco, guardarPreferenciaModoFoco } from '@/lib/modoFoco';
import { logAuthEvent } from '@/lib/auditLog';
import { traduzErroAuth } from '@/lib/authErros';
import { validarSenha, PORTAL_BASE, iniciais, TAMANHOS_TEXTO, preferenciaTexto, guardarPreferenciaTexto } from '@/lib/universidade';
import Select from '@/components/ui/select';
import { Type } from 'lucide-react';
import { ehAdminPortal, PERFIS_UNIVERSIDADE, PERFIL_UC_LABEL } from '@/lib/universidade';
import { sairDoPortal } from '../PortalLayout';

const PERFIL_LABEL = { admin_universidade: 'Administrador da Universidade', administrador: 'Administrador', instrutor: 'Instrutor', formando: 'Formando', operacoes: 'Operações', safety: 'Safety', infraestrutura: 'Infraestrutura', credenciamento: 'Credenciamento', gestor_empresa: 'Gestor de empresa', visualizador: 'Visualizador', documentos_ged: 'Documentos (GED)' };
const CHAVE_LEITURA = 'aula:modo-leitura';

export default function PortalConta() {
  const { user, logout, checkAppState } = useAuth();
  const [nome, setNome] = useState(user?.full_name || '');
  const [telefone, setTelefone] = useState(user?.telefone || '');
  const [aGuardar, setAGuardar] = useState(false); const [msgPerfil, setMsgPerfil] = useState(null);
  const [senha, setSenha] = useState(''); const [confirmar, setConfirmar] = useState(''); const [aMudar, setAMudar] = useState(false); const [msgSenha, setMsgSenha] = useState(null);
  const [foco, setFoco] = useState(() => preferenciaModoFoco());
  const [livro, setLivro] = useState(() => { try { return (localStorage.getItem(CHAVE_LEITURA) || 'livro') !== 'continuo'; } catch { return true; } });
  const [texto, setTexto] = useState(() => preferenciaTexto());
  const alterarTexto = (v) => { setTexto(v); guardarPreferenciaTexto(v); };

  const { data: aeroportosUc = [] } = useAeroportosUc();
  const { data: fUc } = useFormandoUc(user?.email);
  const [aero, setAero] = useState(''); const [dep, setDep] = useState(''); const [fun, setFun] = useState('');
  useEffect(() => { if (fUc) { setAero(fUc.aeroporto || ''); setDep(fUc.departamento || ''); setFun(fUc.funcao || ''); } }, [fUc]);
  const guardarPerfil = async (e) => {
    e.preventDefault(); setAGuardar(true); setMsgPerfil(null);
    try { await UserEntity.update(user.id, { full_name: nome.trim(), telefone: telefone.trim() || null }); await guardarFormandoUc(user.email, { aeroporto: aero, departamento: dep, funcao: fun }); await checkAppState(); setMsgPerfil({ ok: true, t: 'Dados guardados.' }); }
    catch (err) { setMsgPerfil({ ok: false, t: err?.message || 'Não foi possível guardar.' }); } finally { setAGuardar(false); }
  };
  const mudarSenha = async (e) => {
    e.preventDefault();
    const v = validarSenha(senha); if (!v.ok) { setMsgSenha({ ok: false, t: v.mensagem }); return; }
    if (senha !== confirmar) { setMsgSenha({ ok: false, t: 'As senhas não coincidem.' }); return; }
    setAMudar(true); setMsgSenha(null);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setAMudar(false);
    if (error) { setMsgSenha({ ok: false, t: traduzErroAuth(error.message) }); return; }
    logAuthEvent('senha_alterada', user?.email, 'Senha alterada pelo próprio no portal da Universidade', 'Universidade');
    setSenha(''); setConfirmar(''); setMsgSenha({ ok: true, t: 'Senha alterada. Use-a no próximo início de sessão.' });
  };
  const alternarFoco = (v) => { setFoco(v); guardarPreferenciaModoFoco(v); };
  const alternarLivro = (v) => { setLivro(v); try { localStorage.setItem(CHAVE_LEITURA, v ? 'livro' : 'continuo'); } catch { /* */ } };
  const Msg = ({ m }) => m ? <p role="status" className={`flex items-center gap-2 text-sm ${m.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{m.ok ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4" aria-hidden="true" />}{m.t}</p> : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-600 text-xl font-bold text-white" aria-hidden="true">{iniciais(user?.full_name || user?.email)}</span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-slate-900 dark:text-slate-100">{user?.full_name || user?.email}</h1>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
          <p className="mt-1 flex flex-wrap gap-1.5">{(user?.perfis || []).filter(p => PERFIS_UNIVERSIDADE.includes(p)).map(p => <span key={p} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">{PERFIL_UC_LABEL[p] || PERFIL_LABEL[p] || p}</span>)}{ehAdminPortal(user) && <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800 dark:bg-violet-950/60 dark:text-violet-200"><ShieldCheck className="h-3 w-3" aria-hidden="true" />Gestão</span>}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><UserIcon className="h-4 w-4 text-violet-600" aria-hidden="true" />Dados pessoais</CardTitle><CardDescription>O nome aparece nos certificados e no ranking.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={guardarPerfil} className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="ct-nome">Nome completo</Label><Input id="ct-nome" value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" required /></div>
              <div className="space-y-1.5"><Label htmlFor="ct-tel">Telefone</Label><Input id="ct-tel" value={telefone} onChange={e => setTelefone(e.target.value)} autoComplete="tel" /></div>
              <div className="space-y-1.5"><Label>Aeroporto onde trabalha</Label><Select value={aero} onValueChange={setAero} placeholder="—" options={[{ value: '', label: '— sem aeroporto —' }, ...aeroportosUc.map(a => ({ value: a.codigo, label: `${a.codigo} · ${a.nome}` }))]} /></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="ct-dep">Departamento</Label><Input id="ct-dep" value={dep} onChange={e => setDep(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="ct-fun">Função</Label><Input id="ct-fun" value={fun} onChange={e => setFun(e.target.value)} /></div></div>
              <div className="space-y-1.5"><Label htmlFor="ct-email">Email</Label><Input id="ct-email" value={user?.email || ''} readOnly className="bg-slate-50 dark:bg-slate-950" /><p className="text-xs text-slate-500">Para mudar o email contacte um administrador.</p></div>
              <Msg m={msgPerfil} />
              <Button type="submit" disabled={aGuardar || !nome.trim()}>{aGuardar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}Guardar</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-violet-600" aria-hidden="true" />Alterar senha</CardTitle><CardDescription>A senha da Universidade é só sua: mudá-la aqui não altera outras senhas.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={mudarSenha} className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="ct-senha">Nova senha</Label><Input id="ct-senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" required /></div>
              <div className="space-y-1.5"><Label htmlFor="ct-conf">Confirmar senha</Label><Input id="ct-conf" type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} autoComplete="new-password" required /></div>
              <p className="text-xs text-slate-500">Mínimo 8 caracteres, uma maiúscula e um número.</p>
              <Msg m={msgSenha} />
              <Button type="submit" disabled={aMudar || !senha || !confirmar}>{aMudar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}Alterar senha</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="pb-3"><CardTitle className="text-base">Preferências de estudo</CardTitle><CardDescription>Guardadas neste navegador.</CardDescription></CardHeader>
        <CardContent className="divide-y dark:divide-slate-800">
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-start gap-3"><Type className="mt-0.5 h-5 w-5 text-slate-400" aria-hidden="true" /><div><Label className="font-medium">Tamanho do texto</Label><p className="text-xs text-slate-500">Por omissão o portal ajusta-se ao tamanho do ecrã; aqui pode torná-lo maior ou menor neste navegador.</p></div></div>
            <div className="w-56"><Select options={TAMANHOS_TEXTO.map(t => ({ value: t.value, label: t.label }))} value={texto} onValueChange={alterarTexto} /></div>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-start gap-3"><PanelLeftClose className="mt-0.5 h-5 w-5 text-slate-400" aria-hidden="true" /><div><Label htmlFor="pref-foco" className="font-medium">Modo foco nas aulas e avaliações</Label><p className="text-xs text-slate-500">Esconde o cabeçalho e o rodapé enquanto estuda. Pode alternar a qualquer momento na aula.</p></div></div>
            <Switch id="pref-foco" checked={foco} onCheckedChange={alternarFoco} />
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-start gap-3"><BookOpen className="mt-0.5 h-5 w-5 text-slate-400" aria-hidden="true" /><div><Label htmlFor="pref-livro" className="font-medium">Leituras longas em modo livro</Label><p className="text-xs text-slate-500">Páginas com folheio em vez de texto corrido.</p></div></div>
            <Switch id="pref-livro" checked={livro} onCheckedChange={alternarLivro} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link to={`${PORTAL_BASE}/ajuda`}>Ajuda e suporte</Link></Button>
        <Button variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => sairDoPortal(user, logout)}><LogOut className="h-4 w-4" aria-hidden="true" />Terminar sessão</Button>
      </div>
    </div>
  );
}
