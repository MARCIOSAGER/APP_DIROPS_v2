import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Route, ChevronDown, ChevronUp, Lock, CheckCircle2, Circle, ArrowRight, Loader2, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ESTADOS, estadoFormacao } from '@/lib/formacaoEstado';
import { gradienteCategoria } from './formacaoUtils';

const CHIP = { red: 'bg-red-100 text-red-800', amber: 'bg-amber-100 text-amber-800', blue: 'bg-blue-100 text-blue-800', emerald: 'bg-emerald-100 text-emerald-800', slate: 'bg-slate-100 text-slate-600' };

// Trilhas de formação na área do aluno: progresso e cursos por ordem (com bloqueio sequencial).
export default function TrilhasAluno({ trilhas = [], trilhaCursos = [], cursosById = {}, matriculaPorCurso = {}, user, onAbrirCurso, onInscrever, inscrevendoId }) {
  const [aberta, setAberta] = useState(null);
  const perfis = (user?.perfis || []).map(p => String(p).toLowerCase());
  if (trilhas.length === 0) {
    return (
      <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"><Route className="h-7 w-7 text-slate-400" aria-hidden="true" /></div>
        <p className="font-medium text-slate-900 dark:text-slate-100">Ainda não há trilhas publicadas</p>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">Uma trilha é um percurso de vários cursos por ordem, por exemplo a integração de novos colaboradores.</p>
      </CardContent></Card>
    );
  }
  // Agrupa por tema (o prefixo do título antes de « — »: GED, AVSEC…), pela ordem da primeira trilha de cada tema.
  const grupos = [];
  for (const t of trilhas) {
    const chave = String(t.titulo || '').split(' — ')[0].trim() || 'Outras';
    let g = grupos.find(x => x.chave === chave);
    if (!g) { g = { chave, trilhas: [] }; grupos.push(g); }
    g.trilhas.push(t);
  }
  const tituloGrupo = (g) => (g.chave === 'GED' ? 'Plataforma GED — escolha a trilha da sua função' : g.chave === 'AVSEC' ? 'AVSEC — Segurança da Aviação' : g.chave);
  return (
    <div className="space-y-8">
      {grupos.map(g => (
      <section key={g.chave} aria-label={tituloGrupo(g)}>
        {grupos.length > 1 && <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{tituloGrupo(g)}</h3>}
        {/* items-start: abrir «Ver cursos» num cartão não estica nem desloca os outros */}
        <div className="grid items-start gap-4 md:grid-cols-2">
      {g.trilhas.map(t => {
        const itens = trilhaCursos.filter(tc => tc.trilha_id === t.id).map(tc => ({ ...tc, curso: cursosById[tc.curso_id] })).filter(i => i.curso);
        const concluidos = itens.filter(i => matriculaPorCurso[i.curso_id]?.estado === 'concluido').length;
        const pct = itens.length ? Math.round((concluidos / itens.length) * 100) : 0;
        const obrigatoria = t.obrigatorio_todos || (t.obrigatorio_perfis || []).some(p => perfis.includes(String(p).toLowerCase()));
        const expandida = aberta === t.id;
        let anteriorOk = true;
        return (
          <Card key={t.id} className="overflow-hidden dark:border-slate-800 dark:bg-slate-900">
            <div className={`relative h-20 w-full bg-gradient-to-r ${gradienteCategoria(t.titulo)}`}>
              {t.capa_url && <img src={t.capa_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
              <div className="absolute inset-0 flex items-end justify-between p-3">
                <div className="flex items-center gap-2"><Route className="h-5 w-5 text-white/90" aria-hidden="true" /><span className="font-semibold text-white drop-shadow">{t.titulo}</span></div>
                {obrigatoria && <Badge className="bg-white/90 text-slate-800 hover:bg-white">Obrigatória</Badge>}
              </div>
            </div>
            <CardContent className="space-y-3 p-4">
              {t.descricao && <p className="text-sm text-slate-600 dark:text-slate-400">{t.descricao}</p>}
              <div className="flex items-center gap-2"><Progress value={pct} className="h-1.5 flex-1" aria-label={`Progresso ${pct}%`} /><span className="text-xs tabular-nums text-slate-600 dark:text-slate-300">{concluidos}/{itens.length} cursos</span></div>
              <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setAberta(expandida ? null : t.id)} aria-expanded={expandida}>
                {expandida ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}{expandida ? 'Ocultar cursos' : 'Ver cursos'}
              </Button>
              {expandida && (
                <ol className="space-y-1.5">{itens.map((i, idx) => {
                  const m = matriculaPorCurso[i.curso_id];
                  const est = estadoFormacao(i.curso, m, { obrigatorio: obrigatoria && i.obrigatorio !== false });
                  const e = ESTADOS[est.estado];
                  const bloqueado = t.sequencial !== false && !anteriorOk;
                  const feito = m?.estado === 'concluido';
                  if (i.obrigatorio !== false) anteriorOk = anteriorOk && feito;
                  return (
                    <li key={i.id} className={cn('flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center dark:border-slate-700', bloqueado && 'opacity-60')}>
                      <span className="w-6 text-sm tabular-nums text-slate-400">{idx + 1}.</span>
                      {feito ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="Concluído" /> : bloqueado ? <Lock className="h-5 w-5 shrink-0 text-slate-400" aria-label="Bloqueado" /> : <Circle className="h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{i.curso.titulo}</p>
                        <p className="text-xs"><span className={cn('rounded px-1.5 py-0.5', CHIP[e.cor])}>{e.label}</span>{i.obrigatorio === false && <span className="ml-2 text-slate-400">opcional</span>}</p>
                      </div>
                      {m ? (
                        <Button size="sm" variant={feito ? 'outline' : 'default'} disabled={bloqueado} onClick={() => onAbrirCurso(i.curso)}>{feito ? 'Rever' : 'Continuar'}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Button>
                      ) : (
                        <div className="flex gap-1.5"><Button size="sm" variant="outline" onClick={() => onAbrirCurso(i.curso)}><BookOpen className="h-4 w-4" aria-hidden="true" />Ver</Button><Button size="sm" disabled={bloqueado || inscrevendoId === i.curso_id} onClick={() => onInscrever({ ...i.curso, _origem: 'trilha' })}>{inscrevendoId === i.curso_id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Inscrever-me</Button></div>
                      )}
                    </li>
                  );
                })}</ol>
              )}
            </CardContent>
          </Card>
        );
      })}
        </div>
      </section>
      ))}
    </div>
  );
}
