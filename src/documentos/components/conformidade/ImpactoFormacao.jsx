// «Que formação ficou desactualizada por uma revisão de documento?» — o ecrã do lado da formação (migração 159).
//
// Este componente é deliberadamente autónomo (traz os seus próprios dados e o seu próprio estado de filtro) para
// poder ser montado em dois sítios: no portal de documentos, dentro da página de conformidade, e na Universidade
// Corporativa, ao lado da formação obrigatória — que é onde a pessoa que trata dos cursos realmente trabalha.
// Ver a nota de integração no fim da página de conformidade.
//
// O número que decide é `concluidas_antes`: quantas pessoas concluíram o curso ANTES de a revisão entrar em
// vigor. Se for zero, basta corrigir o material; se não for, há gente formada no procedimento antigo — e é essa
// a diferença entre uma correcção de conteúdo e uma recertificação.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, BookOpenCheck, Check, CircleSlash, FileClock, GraduationCap, Loader2, MinusCircle, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { fmtData, fmtDataHora } from '@/lib/safeDate';
import { tk, cartao, urlDoc, Vazio, Falha, Esqueleto } from '../../pages/PortalBiblioteca';
import {
  useImpactoFormacao, useLigacoesTodas, useRecarregarFormacao,
  ACCOES_REVISAO, marcarAlerta, porRever,
} from '../../hooksConformidade';
import { Selo, SeloSituacaoCurso } from './comuns';

const FILTROS = [
  { value: 'aberto', label: 'A tratar' },
  { value: 'resolvido', label: 'Resolvidos' },
  { value: 'sem_impacto', label: 'Sem impacto' },
  { value: 'todos', label: 'Todos' },
];

const ACCAO = {
  avisar: { tom: 'neutro', label: 'Avisar' },
  revisar_conteudo: { tom: 'aviso', label: 'Rever conteúdo' },
  recertificar: { tom: 'perigo', label: 'Recertificar' },
};
const explicacao = (valor) => ACCOES_REVISAO.find(a => a.value === valor)?.longo || '';

function Alerta({ a, podeMexer, aoRecarregar }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [ocupado, setOcupado] = useState('');
  const acc = ACCAO[a.acao_pedida] || ACCAO.avisar;
  const aberto = a.estado === 'aberto' || a.estado === 'em_revisao';

  const mudar = async (estado) => {
    setOcupado(estado);
    try {
      await marcarAlerta(a.alerta_id, estado, {}, user);
      toast({
        title: estado === 'resolvido' ? 'Alerta resolvido.'
          : estado === 'sem_impacto' ? 'Alerta fechado como sem impacto no curso.'
            : 'Alerta marcado como em revisão.',
      });
      aoRecarregar?.();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Não foi possível actualizar', description: e?.message });
    } finally {
      setOcupado('');
    }
  };

  return (
    <li className={cn('px-4 py-3.5', aberto && a.acao_pedida === 'recertificar' && tk.perigoFundo)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Selo tom={acc.tom}>{acc.label}</Selo>
            <Link to={urlDoc(a.documento_id)} className={cn('min-w-0 font-medium hover:underline', tk.acento, tk.foco)}>
              <span style={{ fontVariantNumeric: 'tabular-nums' }} className={tk.mono}>{a.documento_numero || '—'}</span>
              {a.documento_titulo ? ` · ${a.documento_titulo}` : ''}
            </Link>
            {!aberto && <Selo tom="neutro">{a.estado === 'resolvido' ? 'Resolvido' : 'Sem impacto'}</Selo>}
          </p>

          <p className={cn('mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm', tk.tintaMedia)}>
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap className={cn('h-4 w-4 shrink-0', tk.tintaFraca)} aria-hidden="true" />
              {a.curso_titulo}
            </span>
            <span className={tk.tintaFraca}>
              revisão <span className="tabular-nums">v{a.versao_anterior ?? '—'} → v{a.versao}</span>
              {a.vigor_desde ? ` · em vigor desde ${fmtData(a.vigor_desde)}` : ''}
              {a.emenda_numero ? ` · emenda n.º ${a.emenda_numero}` : ''}
            </span>
          </p>

          <p className={cn('mt-1 text-sm', tk.tintaFraca)}>{explicacao(a.acao_pedida)}</p>

          {Number(a.concluidas_antes) > 0 ? (
            <p className={cn('mt-1.5 flex items-start gap-1.5 text-sm font-medium', tk.perigo)}>
              <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="tabular-nums">{a.concluidas_antes}</span>
              {Number(a.concluidas_antes) === 1
                ? ' pessoa concluiu o curso antes desta revisão: aprendeu o procedimento anterior.'
                : ' pessoas concluíram o curso antes desta revisão: aprenderam o procedimento anterior.'}
            </p>
          ) : (
            <p className={cn('mt-1.5 text-sm', tk.tintaFraca)}>
              Ninguém concluiu o curso antes desta revisão
              {Number(a.matriculas) > 0
                ? ` (${a.matriculas} ${Number(a.matriculas) === 1 ? 'matrícula' : 'matrículas'} em curso).`
                : ' e não há matrículas.'}
            </p>
          )}

          <p className={cn('mt-1 text-xs', tk.tintaTenue)}>Aberto em {fmtDataHora(a.criado_em)}</p>
        </div>

        {podeMexer && aberto && (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {a.estado === 'aberto' && (
              <Button size="sm" variant="outline" onClick={() => mudar('em_revisao')} disabled={!!ocupado}>
                {ocupado === 'em_revisao' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileClock className="h-4 w-4" aria-hidden="true" />}
                Em revisão
              </Button>
            )}
            <Button size="sm" onClick={() => mudar('resolvido')} disabled={!!ocupado}>
              {ocupado === 'resolvido' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
              Resolvido
            </Button>
            <Button size="sm" variant="ghost" onClick={() => mudar('sem_impacto')} disabled={!!ocupado}
              title="A revisão não mudou nada do que o curso ensina.">
              {ocupado === 'sem_impacto' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MinusCircle className="h-4 w-4" aria-hidden="true" />}
              Sem impacto
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

// ── cursos por conferir: as ligações que nunca foram verificadas ────────────
// Não são alertas (não houve revisão nenhuma): são ligações a que ninguém disse ainda que o conteúdo do curso
// corresponde ao documento. É a lista de arranque do trabalho, e desaparece quando estiver feita.
function PorConferir() {
  const q = useLigacoesTodas();
  const lista = (q.data || []).filter(porRever);
  if (q.isLoading || q.isError || !lista.length) return null;

  return (
    <section className={cn(cartao, 'overflow-hidden')} aria-labelledby="gd-porconferir-titulo">
      <h3 id="gd-porconferir-titulo" className={cn('flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold', tk.borda, tk.tinta)}>
        <BookOpenCheck className={cn('h-4 w-4', tk.acento)} aria-hidden="true" />
        Cursos por conferir
        <span className={cn('font-normal tabular-nums', tk.tintaFraca)}>{lista.length}</span>
      </h3>
      <ul className={cn('divide-y', tk.divisoria)}>
        {lista.map(l => (
          <li key={l.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className={cn('font-medium', tk.tinta)}>{l.curso_titulo}</span>
                <SeloSituacaoCurso situacao={l.situacao} />
              </p>
              <p className={cn('mt-0.5 text-sm', tk.tintaFraca)}>
                <Link to={urlDoc(l.documento_id)} className={cn('hover:underline', tk.acento, tk.foco)}>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }} className={tk.mono}>{l.documento_numero || '—'}</span>
                  {l.documento_titulo ? ` · ${l.documento_titulo}` : ''}
                </Link>
                {' · '}documento na revisão <span className="tabular-nums">v{l.documento_versao ?? 1}</span>
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link to={urlDoc(l.documento_id)}>Abrir a ficha</Link>
            </Button>
          </li>
        ))}
      </ul>
      <p className={cn('border-t px-4 py-2.5 text-sm', tk.borda, tk.tintaFraca)}>
        Confere-se na ficha do documento, no bloco «Formação que ensina este documento». A conferência guarda a
        revisão contra a qual foi feita — é isso que a torna uma verificação e não uma intenção.
      </p>
    </section>
  );
}

export default function ImpactoFormacao({ podeMexer = false, mostrarPorConferir = true, className }) {
  const [filtro, setFiltro] = useState('aberto');
  const q = useImpactoFormacao(filtro);
  const recarregar = useRecarregarFormacao();
  const lista = q.data || [];

  return (
    <div className={cn('space-y-4', className)}>
      <section className={cn(cartao, 'overflow-hidden')} aria-labelledby="gd-impacto-titulo">
        <div className={cn('flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3', tk.borda)}>
          <h2 id="gd-impacto-titulo" className={cn('flex items-center gap-2 text-sm font-semibold', tk.tinta)}>
            <AlertTriangle className={cn('h-4 w-4', tk.aviso)} aria-hidden="true" />
            Revisões que podem ter desactualizado formação
            {lista.length > 0 && <span className={cn('font-normal tabular-nums', tk.tintaFraca)}>{lista.length}</span>}
          </h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
            {FILTROS.map(f => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filtro === f.value}
                onClick={() => setFiltro(f.value)}
                className={cn('inline-flex min-h-[2.25rem] items-center rounded-full border px-3 text-sm transition-colors', tk.foco,
                  filtro === f.value
                    ? cn(tk.acentoBorda, tk.acentoFundo, tk.acento, 'font-semibold')
                    : cn(tk.borda, tk.superficie, tk.tintaMedia, tk.hover))}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {q.isLoading ? (
          <Esqueleto linhas={3} />
        ) : q.isError ? (
          <Falha
            titulo="Não foi possível carregar os alertas"
            texto={q.error?.message || 'Tente de novo; se continuar, avise a gestão do portal.'}
            onTentar={() => q.refetch?.()}
          />
        ) : lista.length === 0 ? (
          <Vazio
            icone={filtro === 'aberto' ? Check : CircleSlash}
            titulo={filtro === 'aberto' ? 'Nada a tratar' : 'Nenhum alerta neste estado'}
            texto={filtro === 'aberto'
              ? 'Nenhuma revisão de documento ligado a um curso está à espera de decisão. Os alertas aparecem aqui sozinhos quando uma revisão entra em vigor.'
              : 'Mude o filtro para ver os restantes.'}
          />
        ) : (
          <ul className={cn('divide-y', tk.divisoria)}>
            {lista.map(a => <Alerta key={a.alerta_id} a={a} podeMexer={podeMexer} aoRecarregar={recarregar} />)}
          </ul>
        )}
      </section>

      {mostrarPorConferir && <PorConferir />}
    </div>
  );
}
