// Carregar e corrigir um requisito da matriz (migração 159).
//
// Os requisitos semeados pela migração vêm da leitura dos normativos feita em docs/pesquisa-mercado-ged.md e são
// um ponto de partida: o texto tem de ser confirmado contra o original antes de ser citado à ANAC. É por isso
// que esta janela mostra a fonte do requisito e deixa corrigir o texto — e é por isso que a semente nunca
// sobrepõe o que aqui for gravado.
//
// O parágrafo pode ficar em branco, de propósito: há exigências apuradas cujo número ainda não está confirmado
// (por exemplo as do Programa de Segurança do Aeroporto), e inventar um número numa matriz que vai a uma
// inspecção é pior do que deixá-lo vazio e dizer que está por confirmar.
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Archive, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { tk } from '../../pages/PortalBiblioteca';
import { useProcessosDocs } from '../../hooksCodificacao';
import { CRITICIDADES, guardarRequisito, activarRequisito } from '../../hooksConformidade';

export default function ModalRequisito({ aberta, aoFechar, diplomas = [], requisito, diplomaInicial, aoGravar }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const edicao = !!(requisito?.requisito_id || requisito?.id);
  const id = requisito?.requisito_id || requisito?.id || null;

  const [diploma, setDiploma] = useState(requisito?.diploma_codigo || diplomaInicial || '');
  const [artigo, setArtigo] = useState(requisito?.artigo || '');
  const [titulo, setTitulo] = useState(requisito?.titulo || '');
  const [texto, setTexto] = useState(requisito?.texto || '');
  const [processo, setProcesso] = useState(requisito?.processo_codigo || '');
  const [criticidade, setCriticidade] = useState(requisito?.criticidade || 'media');
  const [notas, setNotas] = useState(requisito?.notas || '');
  const [ocupado, setOcupado] = useState('');
  const [erro, setErro] = useState('');

  const processosQ = useProcessosDocs();
  const opcoesProcesso = useMemo(() => ([
    { value: '', label: 'Não indicado' },
    ...(processosQ.data || []).filter(p => p.ativo !== false)
      .map(p => ({ value: p.codigo, label: p.nome ? `${p.codigo} — ${p.nome}` : p.codigo })),
  ]), [processosQ.data]);
  const opcoesDiploma = useMemo(
    () => (diplomas || []).map(d => ({ value: d.codigo || d.diploma_codigo, label: d.nome || d.diploma_nome })),
    [diplomas],
  );

  const gravar = async () => {
    setErro('');
    setOcupado('gravar');
    try {
      await guardarRequisito({
        id, diploma_codigo: diploma, artigo, titulo, texto,
        processo_codigo: processo || null, criticidade, notas,
      }, user);
      toast({ title: edicao ? 'Requisito actualizado.' : 'Requisito carregado na matriz.' });
      aoGravar?.();
      aoFechar();
    } catch (e) {
      setErro(e?.message || 'Não foi possível guardar.');
    } finally {
      setOcupado('');
    }
  };

  // Arquivar em vez de apagar: um requisito apagado leva consigo as provas, e com elas a memória de onde a
  // resposta estava. Arquivado sai da matriz e das contas de cobertura, e pode voltar.
  const arquivar = async () => {
    setErro('');
    setOcupado('arquivar');
    try {
      await activarRequisito(id, false);
      toast({ title: 'Requisito arquivado.', description: 'Sai da matriz e das contas de cobertura; as provas ficam guardadas.' });
      aoGravar?.();
      aoFechar();
    } catch (e) {
      setErro(e?.message || 'Não foi possível arquivar.');
    } finally {
      setOcupado('');
    }
  };

  return (
    <Dialog open={aberta} onOpenChange={v => { if (!v) aoFechar(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{edicao ? 'Requisito' : 'Carregar um requisito'}</DialogTitle>
          <DialogDescription>
            {edicao && requisito?.fonte
              ? `Texto vindo de ${requisito.fonte}. Confirme-o contra o original antes de o citar à ANAC.`
              : 'Um requisito é uma exigência concreta de um diploma: o parágrafo, o que ele obriga, e nada mais.'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="gd-req-diploma">Diploma</Label>
            <Select id="gd-req-diploma" options={opcoesDiploma} value={diploma} onValueChange={setDiploma}
              placeholder="Escolha o diploma…" />
          </div>

          <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="gd-req-artigo">Artigo ou parágrafo</Label>
              <Input id="gd-req-artigo" value={artigo} onChange={e => setArtigo(e.target.value)}
                placeholder="Ex.: 1.1.2.2 ou Anexo 3" />
              <p className={cn('text-sm', tk.tintaFraca)}>Pode ficar vazio se o número ainda não estiver confirmado.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gd-req-titulo">O requisito numa linha</Label>
              <Input id="gd-req-titulo" value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder="Ex.: Ordem fixa das nove primeiras páginas" required />
              <p className={cn('text-sm', tk.tintaFraca)}>É por este título que se procura na matriz.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gd-req-texto">O que a norma exige</Label>
            <Textarea id="gd-req-texto" rows={4} value={texto} onChange={e => setTexto(e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gd-req-processo">Manual ou programa a que se aplica</Label>
              <Select id="gd-req-processo" options={opcoesProcesso} value={processo} onValueChange={setProcesso} />
              <p className={cn('text-sm', tk.tintaFraca)}>Serve para a matriz sugerir onde a prova deve estar.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gd-req-crit">Criticidade</Label>
              <Select id="gd-req-crit" options={CRITICIDADES.map(c => ({ value: c.value, label: c.label }))}
                value={criticidade} onValueChange={setCriticidade} searchable={false} />
              <p className={cn('text-sm', tk.tintaFraca)}>Alta = a falta é achado de inspecção.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gd-req-notas">Notas internas (opcional)</Label>
            <Textarea id="gd-req-notas" rows={2} value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Ex.: confirmar a redacção com a DAIA." />
          </div>

          {erro && (
            <p role="alert" className={cn('flex items-start gap-2 text-sm', tk.perigo)}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{erro}
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {edicao ? (
            <Button variant="ghost" onClick={arquivar} disabled={!!ocupado}>
              {ocupado === 'arquivar' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Archive className="h-4 w-4" aria-hidden="true" />}
              Arquivar
            </Button>
          ) : <span />}
          <span className="flex gap-2">
            <Button variant="ghost" onClick={aoFechar} disabled={!!ocupado}>Cancelar</Button>
            <Button onClick={gravar} disabled={!!ocupado || !diploma || !titulo.trim()}>
              {ocupado === 'gravar' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
              Guardar
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
