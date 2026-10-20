// Apontar um requisito a um parágrafo: a janela onde se registam (e corrigem) as provas da matriz (migração 159).
//
// A prova é a resposta literal à pergunta do inspector, e por isso o formulário pede as quatro coisas que ele
// pede: QUE documento, QUE revisão, ONDE dentro dele (capítulo, parágrafo, página) e, se quem registou quiser
// deixar escrito, a CITAÇÃO. O grau existe porque «cumpre em parte» e «não aplicável» são respostas legítimas —
// desde que fundamentadas, e é por isso que o «não aplicável» exige nota.
//
// Um detalhe que poupa tempo real: se o requisito declara o manual a que se aplica (o `processo_codigo` da
// codificação documental, migração 157), os documentos desse manual aparecem primeiro na lista. Procurar o
// capítulo certo do MOA entre 217 documentos é a parte chata do trabalho.
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Save, Trash2 } from 'lucide-react';
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
import { useDocumentosDocs, useVersoesDocumento } from '../../hooks';
import { useDocumentosCodificados } from '../../hooksCodificacao';
import { GRAUS, guardarProva, apagarProva } from '../../hooksConformidade';
import { Artigo } from './comuns';

export default function ModalProva({ aberta, aoFechar, requisito, prova, aoGravar }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const edicao = !!prova?.id;

  const [documentoId, setDocumentoId] = useState(prova?.documento_id || '');
  const [versaoId, setVersaoId] = useState(prova?.versao_id || '');
  const [capitulo, setCapitulo] = useState(prova?.capitulo || '');
  const [paragrafo, setParagrafo] = useState(prova?.paragrafo || '');
  const [pagina, setPagina] = useState(prova?.pagina ?? '');
  const [paginaFim, setPaginaFim] = useState(prova?.pagina_fim ?? '');
  const [citacao, setCitacao] = useState(prova?.citacao || '');
  const [grau, setGrau] = useState(prova?.grau || 'cumpre');
  const [nota, setNota] = useState(prova?.nota || '');
  const [ocupado, setOcupado] = useState('');
  const [erro, setErro] = useState('');

  const docsQ = useDocumentosDocs({ limite: 500 });
  const docs = useDocumentosCodificados(docsQ.data);
  const versoesQ = useVersoesDocumento(documentoId || null);

  // os documentos do manual a que o requisito se aplica vêm primeiro, e dizem-no no rótulo
  const opcoesDoc = useMemo(() => {
    const proc = requisito?.processo_codigo || '';
    const rotulo = (d) => [d.numero, d.titulo].filter(Boolean).join(' — ');
    const lista = (docs || []).map(d => ({
      value: d.id,
      label: proc && d.processo_codigo === proc ? `★ ${rotulo(d)}` : rotulo(d),
      prioritario: !!(proc && d.processo_codigo === proc),
    }));
    return lista.sort((a, b) => (Number(b.prioritario) - Number(a.prioritario))
      || String(a.label).localeCompare(String(b.label), 'pt'));
  }, [docs, requisito?.processo_codigo]);

  const opcoesVersao = useMemo(() => ([
    { value: '', label: 'A revisão que está em vigor' },
    ...(versoesQ.data || []).map(v => ({
      value: v.id,
      label: `v${v.versao}${v.rotulo ? ` · ${v.rotulo}` : ''}${v.estado === 'em_vigor' ? ' (em vigor)' : ''}`,
    })),
  ]), [versoesQ.data]);

  const gravar = async () => {
    setErro('');
    setOcupado('gravar');
    try {
      await guardarProva({
        id: prova?.id,
        requisito_id: requisito?.requisito_id || requisito?.id,
        documento_id: documentoId,
        versao_id: versaoId || null,
        versao: versaoId ? (versoesQ.data || []).find(v => v.id === versaoId)?.versao : null,
        capitulo, paragrafo, pagina, pagina_fim: paginaFim, citacao, grau, nota,
      }, user);
      toast({ title: edicao ? 'Prova actualizada.' : 'Prova registada.' });
      aoGravar?.();
      aoFechar();
    } catch (e) {
      setErro(e?.message || 'Não foi possível guardar.');
    } finally {
      setOcupado('');
    }
  };

  const retirar = async () => {
    setErro('');
    setOcupado('apagar');
    try {
      await apagarProva(prova.id);
      toast({ title: 'Prova retirada da matriz.' });
      aoGravar?.();
      aoFechar();
    } catch (e) {
      setErro(e?.message || 'Não foi possível retirar a prova.');
    } finally {
      setOcupado('');
    }
  };

  const grauEscolhido = GRAUS.find(g => g.value === grau);

  return (
    <Dialog open={aberta} onOpenChange={v => { if (!v) aoFechar(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{edicao ? 'Prova de conformidade' : 'Apontar este requisito a um parágrafo'}</DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="flex flex-wrap items-baseline gap-2">
              <Artigo valor={requisito?.artigo} />
              <span>{requisito?.titulo}</span>
            </span>
            {requisito?.texto && <span className={cn('block text-sm', tk.tintaFraca)}>{requisito.texto}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="gd-prova-doc">Documento onde está a resposta</Label>
            {docsQ.isLoading ? (
              <p className={cn('text-sm', tk.tintaFraca)}>A carregar os documentos…</p>
            ) : (
              <Select id="gd-prova-doc" options={opcoesDoc} value={documentoId} onValueChange={setDocumentoId}
                placeholder="Escolha o documento…" />
            )}
            {requisito?.processo_nome && (
              <p className={cn('text-sm', tk.tintaFraca)}>
                Marcados com ★ os documentos de {requisito.processo_nome}, que é o manual a que este requisito se aplica.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gd-prova-versao">Revisão a que a prova se refere</Label>
            <Select id="gd-prova-versao" options={opcoesVersao} value={versaoId} onValueChange={setVersaoId}
              searchable={false} disabled={!documentoId} />
            <p className={cn('text-sm', tk.tintaFraca)}>
              Fica guardada para se saber, mais tarde, que a prova é anterior a uma revisão nova — e precisa de ser reconfirmada.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gd-prova-cap">Capítulo (opcional)</Label>
              <Input id="gd-prova-cap" value={capitulo} onChange={e => setCapitulo(e.target.value)} placeholder="Ex.: 4" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gd-prova-par">Parágrafo</Label>
              <Input id="gd-prova-par" value={paragrafo} onChange={e => setParagrafo(e.target.value)} placeholder="Ex.: 4.3.2" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gd-prova-pag">Página</Label>
              <Input id="gd-prova-pag" type="number" min="1" inputMode="numeric" value={pagina}
                onChange={e => setPagina(e.target.value)} placeholder="Ex.: 47" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gd-prova-pagfim">Até à página (opcional)</Label>
              <Input id="gd-prova-pagfim" type="number" min="1" inputMode="numeric" value={paginaFim}
                onChange={e => setPaginaFim(e.target.value)} placeholder="Ex.: 49" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gd-prova-citacao">Citação (opcional)</Label>
            <Textarea id="gd-prova-citacao" rows={3} value={citacao} onChange={e => setCitacao(e.target.value)}
              placeholder="O excerto do documento que cumpre o requisito, tal como está escrito." />
            <p className={cn('text-sm', tk.tintaFraca)}>
              Deixar a frase escrita poupa a quem for responder à ANAC ter de abrir o ficheiro para a ir procurar.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gd-prova-grau">Grau</Label>
            <Select id="gd-prova-grau" options={GRAUS.map(g => ({ value: g.value, label: g.label }))}
              value={grau} onValueChange={setGrau} searchable={false} />
            <p className={cn('text-sm', tk.tintaFraca)}>{grauEscolhido?.longo}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gd-prova-nota">
              Nota{grau === 'nao_aplicavel' ? ' (obrigatória: diga porque não se aplica)' : ' (opcional)'}
            </Label>
            <Textarea id="gd-prova-nota" rows={2} value={nota} onChange={e => setNota(e.target.value)} />
          </div>

          {erro && (
            <p role="alert" className={cn('flex items-start gap-2 text-sm', tk.perigo)}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{erro}
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {edicao ? (
            <Button variant="ghost" onClick={retirar} disabled={!!ocupado} className={tk.perigo}>
              {ocupado === 'apagar' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              Retirar da matriz
            </Button>
          ) : <span />}
          <span className="flex gap-2">
            <Button variant="ghost" onClick={aoFechar} disabled={!!ocupado}>Cancelar</Button>
            <Button onClick={gravar} disabled={!!ocupado || !documentoId}>
              {ocupado === 'gravar' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
              {edicao ? 'Guardar' : 'Registar prova'}
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
