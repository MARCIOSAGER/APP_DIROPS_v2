// «Que formação ensina este documento?» — o bloco que vive na ficha do documento (migração 159).
//
// Porque é que isto existe: um procedimento operacional que muda tem quase sempre uma aula que o ensina. Até
// agora, quando saía uma revisão, o curso continuava a ensinar o procedimento antigo até alguém se lembrar. A
// ligação declarada aqui faz com que o servidor abra um alerta sozinho, e a conferência (botão «Conteúdo em
// dia») é a assinatura de quem foi ver — com a revisão contra a qual foi conferido, que é o que distingue uma
// verificação de uma intenção.
//
// Quem mexe: gestão documental ou gestão da formação (é o servidor que decide, pelas políticas da 159; aqui a
// interface limita-se a não mostrar botões que iriam ser recusados).
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, BookOpenCheck, Check, GraduationCap, Link2, Loader2, Pencil, Plus, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { fmtData } from '@/lib/safeDate';
import { tk, cartao, versaoDoc, pessoaDeEmail, Vazio, Falha, Esqueleto } from '../../pages/PortalBiblioteca';
import {
  useLigacoesDocumento, useCursosDisponiveis, useRecarregarFormacao,
  RELACOES, ACCOES_REVISAO, ligarDocumentoCurso, guardarLigacao, desligarDocumentoCurso, conferirLigacao,
} from '../../hooksConformidade';
import { Selo, SeloSituacaoCurso } from './comuns';

const rotuloCurto = (lista, valor) => lista.find(o => o.value === valor)?.curto || valor || '';
const explicacao = (lista, valor) => lista.find(o => o.value === valor)?.longo || '';

// ── janela de ligar / editar ────────────────────────────────────────────────
// Modal só para formulários (ver um documento nunca é em modal — regra do desenho do portal). As duas escolhas
// que se fazem aqui têm a sua explicação escrita por baixo: é onde as pessoas erram.
function JanelaLigacao({ aberta, aoFechar, documento, ligacao, ligacoesExistentes, aoGravar }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const cursosQ = useCursosDisponiveis();
  const edicao = !!ligacao?.id;

  const [cursoId, setCursoId] = useState(ligacao?.curso_id || '');
  const [relacao, setRelacao] = useState(ligacao?.relacao || 'ensina');
  const [accao, setAccao] = useState(ligacao?.acao_na_revisao || 'avisar');
  const [notas, setNotas] = useState(ligacao?.notas || '');
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState('');

  // reabre limpa (ou com os valores da ligação a editar) sem precisar de efeito: a chave da janela muda com o id
  const jaLigados = useMemo(
    () => new Set((ligacoesExistentes || []).filter(l => l.id !== ligacao?.id).map(l => l.curso_id)),
    [ligacoesExistentes, ligacao?.id],
  );
  const opcoesCurso = useMemo(() => (cursosQ.data || [])
    .filter(c => !jaLigados.has(c.id))
    .map(c => ({ value: c.id, label: c.publicado ? c.titulo : `${c.titulo} (não publicado)` })), [cursosQ.data, jaLigados]);

  const gravar = async () => {
    setErro('');
    setAGravar(true);
    try {
      if (edicao) {
        await guardarLigacao(ligacao.id, { relacao, acao_na_revisao: accao, notas });
      } else {
        await ligarDocumentoCurso({
          documento_id: documento.id, curso_id: cursoId, relacao, acao_na_revisao: accao, notas,
        }, user);
      }
      toast({ title: edicao ? 'Ligação actualizada.' : 'Curso ligado a este documento.' });
      aoGravar?.();
      aoFechar();
    } catch (e) {
      setErro(e?.message || 'Não foi possível guardar.');
    } finally {
      setAGravar(false);
    }
  };

  return (
    <Dialog open={aberta} onOpenChange={v => { if (!v) aoFechar(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{edicao ? 'Ligação à formação' : 'Ligar um curso a este documento'}</DialogTitle>
          <DialogDescription>
            {documento?.numero ? `${documento.numero} — ` : ''}{documento?.titulo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!edicao && (
            <div className="space-y-1.5">
              <Label htmlFor="gd-curso">Curso da Universidade Corporativa</Label>
              {cursosQ.isLoading ? (
                <p className={cn('text-sm', tk.tintaFraca)}>A carregar os cursos…</p>
              ) : cursosQ.isError ? (
                <p role="alert" className={cn('text-sm', tk.perigo)}>
                  Não foi possível carregar os cursos. Tente de novo; se continuar, avise quem gere a Universidade.
                </p>
              ) : opcoesCurso.length === 0 ? (
                <p className={cn('text-sm', tk.tintaFraca)}>
                  Todos os cursos existentes já estão ligados a este documento.
                </p>
              ) : (
                <Select id="gd-curso" options={opcoesCurso} value={cursoId} onValueChange={setCursoId}
                  placeholder="Escolha o curso…" />
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="gd-relacao">O que liga os dois</Label>
            <Select id="gd-relacao" options={RELACOES.map(r => ({ value: r.value, label: r.label }))}
              value={relacao} onValueChange={setRelacao} searchable={false} />
            <p className={cn('text-sm', tk.tintaFraca)}>{explicacao(RELACOES, relacao)}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gd-accao">Quando sair uma revisão deste documento</Label>
            <Select id="gd-accao" options={ACCOES_REVISAO.map(a => ({ value: a.value, label: a.label }))}
              value={accao} onValueChange={setAccao} searchable={false} />
            <p className={cn('text-sm', tk.tintaFraca)}>{explicacao(ACCOES_REVISAO, accao)}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gd-notas">Notas (opcional)</Label>
            <Textarea id="gd-notas" rows={3} value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Ex.: a aula 3 do módulo 2 é a que cobre este procedimento." />
          </div>

          {erro && (
            <p role="alert" className={cn('flex items-start gap-2 text-sm', tk.perigo)}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{erro}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar} disabled={aGravar}>Cancelar</Button>
          <Button onClick={gravar} disabled={aGravar || (!edicao && !cursoId)}>
            {aGravar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
            {edicao ? 'Guardar' : 'Ligar curso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── uma ligação, em linha ───────────────────────────────────────────────────
function LinhaLigacao({ l, versaoActual, podeMexer, aoEditar, aoRecarregar }) {
  const { toast } = useToast();
  const [ocupado, setOcupado] = useState('');

  const conferir = async () => {
    setOcupado('conferir');
    try {
      const r = await conferirLigacao(l.id, { versao: versaoActual });
      toast({
        title: 'Conteúdo do curso dado como conferido.',
        description: r.alertasFechados
          ? `Revisão ${r.versao} · ${r.alertasFechados} ${r.alertasFechados === 1 ? 'alerta fechado' : 'alertas fechados'}.`
          : `Revisão ${r.versao}.`,
      });
      aoRecarregar?.();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Não foi possível confirmar', description: e?.message });
    } finally {
      setOcupado('');
    }
  };

  const desligar = async () => {
    setOcupado('desligar');
    try {
      await desligarDocumentoCurso(l.id);
      toast({ title: 'Curso desligado deste documento.' });
      aoRecarregar?.();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Não foi possível desligar', description: e?.message });
    } finally {
      setOcupado('');
    }
  };

  const atrasado = l.situacao === 'desactualizado';

  return (
    <li className={cn('px-4 py-3', atrasado && tk.avisoFundo)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <GraduationCap className={cn('h-4 w-4 shrink-0', tk.tintaFraca)} aria-hidden="true" />
            <span className={cn('min-w-0 font-medium', tk.tinta)}>{l.curso_titulo}</span>
            {!l.curso_publicado && <Selo tom="neutro" titulo="O curso existe mas ainda não está publicado aos alunos.">Não publicado</Selo>}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Selo tom="acento" titulo={explicacao(RELACOES, l.relacao)}>{rotuloCurto(RELACOES, l.relacao)}</Selo>
            <SeloSituacaoCurso situacao={l.situacao} />
            <span className={cn('text-sm', tk.tintaFraca)}>
              {l.versao_conferida
                ? <>conferido na revisão <span className="tabular-nums">v{l.versao_conferida}</span>
                    {l.conferido_em ? ` · ${fmtData(l.conferido_em)}` : ''}
                    {l.conferido_por ? ` · ${pessoaDeEmail(l.conferido_por)}` : ''}</>
                : 'sem conferência registada'}
            </span>
          </p>
          {atrasado && (
            <p className={cn('mt-1.5 flex items-start gap-1.5 text-sm font-medium', tk.perigo)}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              O documento está na revisão v{versaoActual} e o curso foi conferido na v{l.versao_conferida}.
              {' '}{explicacao(ACCOES_REVISAO, l.acao_na_revisao)}
            </p>
          )}
          {l.notas && <p className={cn('mt-1.5 text-sm', tk.tintaMedia)}>{l.notas}</p>}
        </div>

        {podeMexer && (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Button size="sm" variant={atrasado ? 'default' : 'outline'} onClick={conferir} disabled={!!ocupado}>
              {ocupado === 'conferir'
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <Check className="h-4 w-4" aria-hidden="true" />}
              Conteúdo em dia
            </Button>
            <Button size="sm" variant="ghost" onClick={() => aoEditar(l)} aria-label={`Editar a ligação ao curso ${l.curso_titulo}`}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button size="sm" variant="ghost" onClick={desligar} disabled={!!ocupado}
              aria-label={`Desligar o curso ${l.curso_titulo} deste documento`}>
              {ocupado === 'desligar'
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <Trash2 className={cn('h-4 w-4', tk.perigo)} aria-hidden="true" />}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

// ── o bloco, como aparece na ficha ──────────────────────────────────────────
export default function FormacaoDoDocumento({ documento, podeLigar = false, className }) {
  const q = useLigacoesDocumento(documento?.id);
  const recarregar = useRecarregarFormacao();
  const [janela, setJanela] = useState(null);   // { ligacao } | { nova: true }
  const versaoActual = Number(versaoDoc(documento)) || 1;

  const ligacoes = q.data || [];
  const porRever = ligacoes.filter(l => l.situacao !== 'conferido').length;

  return (
    <section className={cn(cartao, 'overflow-hidden', className)} aria-labelledby="gd-formacao-titulo">
      <div className={cn('flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3', tk.borda)}>
        <h2 id="gd-formacao-titulo" className={cn('flex items-center gap-2 text-sm font-semibold', tk.tinta)}>
          <BookOpenCheck className={cn('h-4 w-4', tk.acento)} aria-hidden="true" />
          Formação que ensina este documento
          {ligacoes.length > 0 && <span className={cn('font-normal tabular-nums', tk.tintaFraca)}>{ligacoes.length}</span>}
        </h2>
        {podeLigar && ligacoes.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setJanela({ nova: true })}>
            <Plus className="h-4 w-4" aria-hidden="true" />Ligar outro curso
          </Button>
        )}
      </div>

      {porRever > 0 && (
        <p className={cn('flex items-start gap-2 border-b px-4 py-2.5 text-sm', tk.borda, tk.avisoFundo, tk.tintaMedia)}>
          <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', tk.aviso)} aria-hidden="true" />
          {porRever === 1
            ? 'Há um curso cujo conteúdo não foi conferido contra a revisão em vigor.'
            : `Há ${porRever} cursos cujo conteúdo não foi conferido contra a revisão em vigor.`}
          {' '}Quem gere a formação vê isto no painel de conformidade.
        </p>
      )}

      {q.isLoading ? (
        <Esqueleto linhas={2} />
      ) : q.isError ? (
        <Falha
          titulo="Não foi possível carregar a formação ligada"
          texto={q.error?.message || 'Tente de novo; se continuar, avise a gestão do portal.'}
          onTentar={() => q.refetch?.()}
          className="py-10"
        />
      ) : ligacoes.length === 0 ? (
        <Vazio
          icone={GraduationCap}
          titulo="Nenhum curso ligado a este documento"
          texto="Ligar o curso que ensina este documento faz com que, quando sair uma revisão, quem gere a formação seja avisado de que o conteúdo pode ter ficado desactualizado. Sem a ligação, isso depende de alguém se lembrar."
          className="py-10"
        >
          {podeLigar && (
            <Button onClick={() => setJanela({ nova: true })}>
              <Link2 className="h-4 w-4" aria-hidden="true" />Ligar um curso
            </Button>
          )}
        </Vazio>
      ) : (
        <ul className={cn('divide-y', tk.divisoria)}>
          {ligacoes.map(l => (
            <LinhaLigacao
              key={l.id}
              l={l}
              versaoActual={versaoActual}
              podeMexer={podeLigar}
              aoEditar={(lig) => setJanela({ ligacao: lig })}
              aoRecarregar={recarregar}
            />
          ))}
        </ul>
      )}

      {janela && (
        <JanelaLigacao
          key={janela.ligacao?.id || 'nova'}
          aberta
          aoFechar={() => setJanela(null)}
          documento={documento}
          ligacao={janela.ligacao}
          ligacoesExistentes={ligacoes}
          aoGravar={recarregar}
        />
      )}
    </section>
  );
}
