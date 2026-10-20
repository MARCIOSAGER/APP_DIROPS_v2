import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Clock, ListChecks, CheckCircle2, ArrowRight, Loader2, ShieldAlert, RotateCcw, CalendarCheck } from 'lucide-react';
import { gradienteCategoria, fmtHoras, fmtMinutos, fmtData, NIVEL_LABEL } from './formacaoUtils';

// Cartão de curso no catálogo / nos meus cursos.
// info = { obrigatorio, estado, dias, validoAte } (ver lib/formacaoEstado) — opcional.
export default function CursoCard({ curso, resumo, matricula, info, onAbrir, onInscrever, onRecertificar, inscrevendo, recertificando }) {
  const grad = gradienteCategoria(curso.categoria);
  const nAulas = resumo?.aulas || 0;
  const duracao = curso.carga_horaria ? fmtHoras(curso.carga_horaria) : fmtMinutos(resumo?.minutos);
  const pct = matricula ? Math.round(Number(matricula.progresso_pct) || 0) : null;
  const concluido = matricula?.estado === 'concluido';
  const expirado = info?.estado === 'expirado';
  const aExpirar = info?.estado === 'a_expirar';
  const validoAte = info?.validoAte || matricula?.valido_ate;

  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => onAbrir(curso)}
        className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        aria-label={`Abrir curso ${curso.titulo}`}
      >
        <div className={`relative aspect-video w-full bg-gradient-to-br ${grad}`}>
          {curso.capa_url ? (
            <img src={curso.capa_url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          ) : (
            <BookOpen className="absolute inset-0 m-auto h-12 w-12 text-white/70" aria-hidden="true" />
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
            {curso.categoria && <Badge className="bg-white/90 text-slate-800 shadow-sm hover:bg-white">{curso.categoria}</Badge>}
            {info?.obrigatorio && <Badge className="bg-amber-500 text-white shadow-sm hover:bg-amber-500"><ShieldAlert className="mr-1 h-3 w-3" aria-hidden="true" />Obrigatório</Badge>}
            {curso.tipo_formacao === 'refrescamento' && <Badge className="bg-violet-600 text-white shadow-sm hover:bg-violet-600">Refrescamento</Badge>}
          </div>
          {expirado ? (
            <Badge className="absolute right-3 top-3 bg-red-600 text-white hover:bg-red-600">Expirado</Badge>
          ) : aExpirar ? (
            <Badge className="absolute right-3 top-3 bg-amber-600 text-white hover:bg-amber-600">Expira em {info.dias} d</Badge>
          ) : concluido ? (
            <Badge className="absolute right-3 top-3 bg-emerald-600 text-white hover:bg-emerald-600">
              <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />Concluído
            </Badge>
          ) : null}
        </div>
        <div className="p-4 pb-2">
          <h3 className="line-clamp-2 font-semibold leading-snug text-slate-900 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
            {curso.titulo}
          </h3>
          {curso.descricao && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{curso.descricao}</p>
          )}
        </div>
      </button>

      <div className="mt-auto space-y-3 px-4 pb-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />{nAulas} {nAulas === 1 ? 'aula' : 'aulas'}
          </span>
          {duracao && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />{duracao}
            </span>
          )}
          {curso.nivel && <span>{NIVEL_LABEL[curso.nivel] || curso.nivel}</span>}
          {curso.validade_meses && !concluido && <span className="inline-flex items-center gap-1"><CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />válido {curso.validade_meses} m</span>}
        </div>

        {matricula ? (
          <>
            <div className="flex items-center gap-2">
              <Progress value={pct} className="h-1.5 flex-1" aria-label={`Progresso ${pct}%`} />
              <span className="w-9 text-right text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">{pct}%</span>
            </div>
            {concluido && validoAte && (
              <p className={`text-xs ${expirado ? 'text-red-600' : aExpirar ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {expirado ? `Validade terminou em ${fmtData(validoAte)}` : `Válido até ${fmtData(validoAte)}`}
              </p>
            )}
            {concluido && (expirado || aExpirar) && onRecertificar ? (
              <Button className="w-full" variant={expirado ? 'default' : 'outline'} onClick={() => onRecertificar(curso)} disabled={recertificando}>
                {recertificando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}Recertificar
              </Button>
            ) : (
              <Button className="w-full" variant={concluido ? 'outline' : 'default'} onClick={() => onAbrir(curso)}>
                {concluido ? 'Rever curso' : pct > 0 ? 'Continuar' : 'Começar'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onAbrir(curso)}>Ver curso</Button>
            <Button className="flex-1" onClick={() => onInscrever(curso)} disabled={inscrevendo}>
              {inscrevendo && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Inscrever-se
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
