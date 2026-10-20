import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, Save, Loader2, PenLine } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Curso } from '@/entities/Curso';
import { useAssinantes } from '@/hooks/useGestaoFormacao';
import { assinantesParaCurso, planoAulaDoCurso, prepararCertParaPdf } from '@/lib/certificadoEmissao';
import ImagemUpload from './ImagemUpload';
import LayoutEditor from './LayoutEditor';
import { AssinantesLista } from './AssinantesGlobais';

// Configuração do certificado de um curso: imagens (logo/arte), signatários e layout da frente.
export default function CertificadoConfig({ curso, modulos = [], aulas = [], user }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: assinantes = [] } = useAssinantes();
  const [config, setConfig] = useState(curso.certificado_config || {});
  const [guardado, setGuardado] = useState(JSON.stringify(curso.certificado_config || {}));
  const [aGuardar, setAGuardar] = useState(false);
  const [aPrever, setAPrever] = useState(false);

  useEffect(() => {
    setConfig(curso.certificado_config || {});
    setGuardado(JSON.stringify(curso.certificado_config || {}));
  }, [curso.id, curso.certificado_config]);

  const set = (k, v) => setConfig(c => ({ ...c, [k]: v }));
  const sujo = JSON.stringify(config) !== guardado;
  const efetivos = useMemo(() => assinantesParaCurso(assinantes, curso.id, config), [assinantes, curso.id, config]);
  const globais = useMemo(() => assinantes.filter(a => !a.curso_id && a.ativo !== false).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)), [assinantes]);
  // Selecção por curso: lista de ids; sem lista = todos os globais (salvo o interruptor antigo desligado).
  const globaisSel = useMemo(() => new Set(Array.isArray(config.assinantes_globais_ids)
    ? config.assinantes_globais_ids
    : (config.usar_assinantes_globais === false ? [] : globais.map(a => a.id))), [config.assinantes_globais_ids, config.usar_assinantes_globais, globais]);
  const alternarGlobal = (id, marcado) => {
    const atual = new Set(globaisSel);
    if (marcado) atual.add(id); else atual.delete(id);
    set('assinantes_globais_ids', globais.map(a => a.id).filter(x => atual.has(x)));
  };

  const guardar = async () => {
    setAGuardar(true);
    try {
      await Curso.update(curso.id, { certificado_config: config, updated_by: user?.email || null });
      setGuardado(JSON.stringify(config));
      toast({ title: 'Configuração do certificado guardada' });
      await qc.invalidateQueries({ queryKey: ['curso'] });
    } catch (e) {
      toast({ title: 'Não foi possível guardar', description: e?.message, variant: 'destructive' });
    } finally {
      setAGuardar(false);
    }
  };

  const prever = async () => {
    setAPrever(true);
    try {
      const [{ gerarCertificadoPdf }, input] = await Promise.all([
        import('@/lib/certificadoPdf'),
        prepararCertParaPdf({
          aluno_nome: user?.full_name || 'Maria João Silva',
          curso_titulo: curso.titulo,
          carga_horaria: curso.carga_horaria,
          numero: `DO-${new Date().getFullYear()}/0000`, codigo: '7F3A2C',
          emitido_em: new Date().toISOString(),
          plano_aula: planoAulaDoCurso(modulos, aulas),
          assinantes: efetivos,
          validacaoUrl: `${window.location.origin}/cert/exemplo`,
        }, { config, baseUrl: window.location.origin }),
      ]);
      const doc = await gerarCertificadoPdf(input);
      const url = doc.output('bloburl');
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast({ title: 'Não foi possível gerar a pré-visualização', description: e?.message, variant: 'destructive' });
    } finally {
      setAPrever(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">Personalize o certificado deste curso. As alterações só se aplicam aos certificados emitidos depois de guardar.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={prever} disabled={aPrever}>{aPrever ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}Pré-visualizar PDF</Button>
          <Button onClick={guardar} disabled={!sujo || aGuardar}>{aGuardar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}Guardar</Button>
        </div>
      </div>

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader><CardTitle className="text-base">Imagens</CardTitle><CardDescription>Logótipo no topo e, opcionalmente, uma arte de fundo desenhada à medida (A4 paisagem). Sem arte usa-se a moldura padrão.</CardDescription></CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <ImagemUpload label="Logótipo" value={config.logo_url} onChange={(v) => set('logo_url', v)} ajuda="PNG com fundo transparente. Sem logótipo usa-se o da SGA." />
          <ImagemUpload label="Arte de fundo — frente" value={config.fundo_url} onChange={(v) => set('fundo_url', v)} ajuda="Imagem A4 paisagem (ex.: 3508×2480 px). Cobre a página toda." fundoEscuro />
          <ImagemUpload label="Arte de fundo — verso" value={config.fundo_verso_url} onChange={(v) => set('fundo_verso_url', v)} ajuda="Opcional. O plano de aula e o QR são sobrepostos." fundoEscuro />
        </CardContent>
      </Card>

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-base">Signatários</CardTitle>
          <CardDescription>
            No certificado (máx. 4): {efetivos.length ? efetivos.map(a => a.nome).join(', ') : 'nenhum — adicione signatários abaixo ou active os globais.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Signatários globais <span className="font-normal text-slate-500 dark:text-slate-400">— escolha quem assina este curso</span></p>
              {globais.length > 0 && (
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => set('assinantes_globais_ids', globais.map(a => a.id))}>Todos</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => set('assinantes_globais_ids', [])}>Nenhum</Button>
                </div>
              )}
            </div>
            {globais.length === 0 ? (
              <p className="rounded-md border border-dashed px-4 py-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Ainda não há signatários globais. Crie-os no separador Signatários da Gestão de Formação.</p>
            ) : (
              <ul className="divide-y rounded-md border dark:divide-slate-800 dark:border-slate-700">
                {globais.map(a => {
                  const marcado = globaisSel.has(a.id);
                  return (
                    <li key={a.id}>
                      <label className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 ${marcado ? '' : 'opacity-70'}`}>
                        <Checkbox checked={marcado} onCheckedChange={(v) => alternarGlobal(a.id, !!v)} aria-label={`${marcado ? 'Retirar' : 'Incluir'} ${a.nome}`} />
                        <div className="flex h-9 w-16 shrink-0 items-center justify-center overflow-hidden rounded border bg-white dark:border-slate-700">
                          {a.assinatura_url ? <img src={a.assinatura_url} alt="" className="max-h-full max-w-full object-contain" /> : <PenLine className="h-4 w-4 text-slate-300" aria-hidden="true" />}
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{a.nome}</span>
                          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{a.cargo || 'Sem cargo'}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">A ordem no certificado é a do separador Signatários. Máximo 4 assinaturas no total.</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">Signatários só deste curso</p>
            <AssinantesLista cursoId={curso.id} assinantes={assinantes} user={user} vazio="Sem signatários específicos deste curso." />
          </div>
        </CardContent>
      </Card>

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-base">Verso e assinaturas</CardTitle>
          <CardDescription>Os textos da frente editam-se directamente no editor de layout abaixo (seleccione o elemento ou crie caixas de texto).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cc-txt-verso">Título do verso</Label>
            <Input id="cc-txt-verso" value={config.textos?.verso_titulo ?? ''} placeholder="Conteúdo Programático" onChange={(e) => set('textos', { ...(config.textos || {}), verso_titulo: e.target.value })} />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2 dark:border-slate-700">
            <div>
              <Label htmlFor="cc-cargo-acima" className="cursor-pointer">Cargo acima do nome nas assinaturas</Label>
              <p className="text-xs text-slate-500 dark:text-slate-400">Modelo SGA: linha, cargo, nome. Desligado: linha, nome, cargo.</p>
            </div>
            <Switch id="cc-cargo-acima" checked={!!config.assinatura_cargo_acima} onCheckedChange={(v) => set('assinatura_cargo_acima', !!v)} />
          </div>
        </CardContent>
      </Card>

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader><CardTitle className="text-base">Layout e textos da frente</CardTitle><CardDescription>Seleccione um elemento para editar o texto, a fonte e a posição, ou adicione caixas de texto livres. O verso (plano de aula + QR) tem layout fixo.</CardDescription></CardHeader>
        <CardContent>
          <LayoutEditor
            layout={config.layout || null}
            onChange={(l) => set('layout', l)}
            textos={config.textos}
            onTextosChange={(t) => set('textos', t)}
            fundoUrl={config.fundo_url}
            logoUrl={config.logo_url || '/logo-sga.png'}
            assinantes={efetivos}
            cursoTitulo={curso.titulo}
            cargaHoraria={curso.carga_horaria}
            validadeMeses={curso.validade_meses}
            cargoAcima={!!config.assinatura_cargo_acima}
          />
        </CardContent>
      </Card>

      {sujo && (
        <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 shadow-md dark:border-amber-900 dark:bg-amber-950/60">
          <p className="text-sm text-amber-900 dark:text-amber-100">Tem alterações por guardar.</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfig(JSON.parse(guardado))}>Descartar</Button>
            <Button size="sm" onClick={guardar} disabled={aGuardar}>{aGuardar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}Guardar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
