import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Select from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, Upload, ExternalLink, FileUp, Presentation, PackageOpen, Film, X } from 'lucide-react';
import { Modulo } from '@/entities/Modulo';
import { Aula } from '@/entities/Aula';
import { TIPO_AULA, parseVideoUrl } from '../formacaoUtils';
import { NORMAS_HTML5 } from '@/lib/scormApi';
import RichTextEditor from './RichTextEditor';
import { uploadGrande, capacidadesUpload } from './uploadGrande';

// ── Módulo ──────────────────────────────────────────────────────────────────
export function ModuloForm({ isOpen, onClose, curso, modulo, proximaOrdem = 1, onSaved }) {
  const [form, setForm] = useState({ titulo: '', descricao: '' });
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErro('');
    setForm({ titulo: modulo?.titulo || '', descricao: modulo?.descricao || '' });
  }, [isOpen, modulo]);

  const submeter = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) { setErro('O título é obrigatório.'); return; }
    setAGuardar(true); setErro('');
    try {
      const payload = { titulo: form.titulo.trim(), descricao: form.descricao.trim() || null };
      const saved = modulo
        ? await Modulo.update(modulo.id, payload)
        : await Modulo.create({ ...payload, curso_id: curso.id, ordem: proximaOrdem });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setErro(err?.message || String(err));
    } finally {
      setAGuardar(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !aGuardar) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submeter} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{modulo ? 'Editar módulo' : 'Novo módulo'}</DialogTitle>
            <DialogDescription>Um módulo agrupa aulas sobre o mesmo tema. Aparece como tema no verso do certificado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="mf-titulo">Título <span className="text-red-600">*</span></Label>
            <Input id="mf-titulo" value={form.titulo} onChange={(e) => setForm(f => ({ ...f, titulo: e.target.value }))} required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mf-desc">Descrição</Label>
            <Textarea id="mf-desc" rows={3} value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
          {erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{erro}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={aGuardar}>Cancelar</Button>
            <Button type="submit" disabled={aGuardar}>{aGuardar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{modulo ? 'Guardar' : 'Criar módulo'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Aula ────────────────────────────────────────────────────────────────────
const AJUDA_URL = {
  presencial: 'Sessão em sala ou no terreno; a presença conclui a aula.',
  video: 'Cole a ligação do YouTube ou Vimeo, ou carregue o ficheiro de vídeo (.mp4, .webm).',
  pdf: 'Carregue o PDF, converta um PowerPoint/Word, ou cole a ligação de um documento já no sistema.',
  html5: 'Carregue o pacote .zip exportado em HTML5 (iSpring, Articulate, H5P…) ou cole a ligação do index.html.',
  link: 'Página externa ou interna (ex.: /Safety) que abre numa nova aba.',
  texto: '',
};

// Botões de carregamento por tipo de aula: [kind do backend, accept, ícone, rótulo]
const BOTOES_UPLOAD = {
  video: [{ kind: 'video', accept: '.mp4,.m4v,.webm', acceptFfmpeg: '.mp4,.m4v,.webm,.avi,.mov,.wmv,.mkv,.mpg,.mpeg', icon: Film, label: 'Carregar vídeo' }],
  pdf: [
    { kind: 'file', accept: '.pdf', icon: FileUp, label: 'Carregar PDF' },
    { kind: 'office', accept: '.pptx,.ppt,.docx,.doc,.odp,.odt', icon: Presentation, label: 'Converter PowerPoint/Word', precisaLibreOffice: true },
  ],
  html5: [
    { kind: 'html5', accept: '.zip', icon: PackageOpen, label: 'Carregar pacote .zip (SCORM, xAPI, HTML5)' },
    { kind: 'h5p', accept: '.h5p', icon: PackageOpen, label: 'Carregar H5P (.h5p)' },
  ],
  link: [],
  texto: [],
  presencial: [],
};
const ACCEPT_MATERIAL = '.pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.odt,.odp,.ods,.zip,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.mp3,.mp4';

export function AulaForm({ isOpen, onClose, curso, modulos = [], aula, moduloId, proximaOrdem = 1, onSaved }) {
  const [form, setForm] = useState({ titulo: '', tipo: 'video', modulo_id: '', conteudo_url: '', conteudo_texto: '', duracao_min: '', legendas_url: '', poster_url: '', materiais: [], conclusao: 'manual' });
  const [aGuardar, setAGuardar] = useState(false);
  const [envio, setEnvio] = useState(null); // { pct, fase: 'upload'|'processar', label }
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [caps, setCaps] = useState(null);
  const fileRef = useRef(null);
  const pendente = useRef(null); // { kind }

  useEffect(() => {
    if (!isOpen) return;
    setErro(''); setEnvio(null);
    setForm({
      titulo: aula?.titulo || '',
      tipo: aula?.tipo || 'video',
      modulo_id: aula?.modulo_id || moduloId || modulos[0]?.id || '',
      conteudo_url: aula?.conteudo_url || '',
      conteudo_texto: aula?.conteudo_texto || '',
      duracao_min: aula?.duracao_min ?? '',
      legendas_url: aula?.legendas_url || '',
      poster_url: aula?.poster_url || '',
      materiais: Array.isArray(aula?.materiais) ? aula.materiais : [],
      conclusao: aula?.conclusao || (aula?.tipo === 'presencial' ? 'presenca' : 'manual'),
      creditos: aula?.creditos || '',
      norma: aula?.opcoes?.norma || '',
      activity_id: aula?.opcoes?.activity_id || '',
    });
    capacidadesUpload().then(setCaps).catch(() => setCaps({ libreoffice: false, max_mb: 1024 }));
  }, [isOpen, aula, moduloId, modulos]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const escolherFicheiro = (b) => {
    pendente.current = b;
    if (fileRef.current) { fileRef.current.accept = (caps?.ffmpeg && b.acceptFfmpeg) ? b.acceptFfmpeg : b.accept; fileRef.current.click(); }
  };

  const carregar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const b = pendente.current;
    if (!file || !b) return;
    setErro(''); setAviso('');
    setEnvio({ pct: 0, fase: 'upload', label: b.label });
    try {
      const r = await uploadGrande({ file, kind: b.kind, onProgress: (pct, fase) => setEnvio({ pct, fase, label: b.label }) });
      if (b.kind === 'legendas') { set('legendas_url', r.url); setEnvio(null); return; }
      if (b.kind === 'material') { setForm(f => ({ ...f, materiais: [...f.materiais, { nome: file.name, url: r.url, tamanho: r.size || file.size }] })); setEnvio(null); return; }
      set('conteudo_url', r.url);
      if (b.kind === 'html5') {
        if (r.norma) { setForm(f => ({ ...f, norma: r.norma, activity_id: r.activity_id || '', conclusao: 'automatica', titulo: f.titulo.trim() || r.titulo || f.titulo })); setAviso(`Pacote ${NORMAS_HTML5[r.norma]?.label || r.norma} detectado: a aula passa a concluir-se automaticamente quando o conteúdo reportar a conclusão.`); }
        else setForm(f => ({ ...f, norma: '', activity_id: '' }));
      }
      if (b.kind === 'h5p') {
        setForm(f => ({ ...f, norma: 'h5p', activity_id: '', conclusao: r.pontuavel ? 'automatica' : 'manual', titulo: f.titulo.trim() || r.titulo || f.titulo }));
        setAviso(r.pontuavel ? `Conteúdo H5P "${r.titulo || ''}" (${r.main_library || ''}) carregado: tem pontuação, por isso a aula conclui-se automaticamente quando o aluno terminar a actividade.` : `Conteúdo H5P "${r.titulo || ''}" (${r.main_library || ''}) carregado. Este tipo não reporta conclusão — o aluno carrega em "Concluir aula".`);
      }
      if (b.kind === 'video') { set('poster_url', r.poster_url || ''); if (r.transcodificado) setAviso('Vídeo optimizado no servidor (H.264, até 1280 px) e poster gerado.'); }
      if (r.media_removidos > 0) setAviso(`O ficheiro tinha ${r.media_removidos} ${r.media_removidos === 1 ? 'vídeo/áudio embutido, que não entra' : 'vídeos/áudios embutidos, que não entram'} no PDF (só a imagem do slide). Carregue-os como aulas de vídeo à parte.`);
      if (!form.titulo.trim()) set('titulo', file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
    } catch (err) {
      setErro(err?.message || String(err));
    } finally {
      setEnvio(null);
    }
  };

  const submeter = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) { setErro('O título é obrigatório.'); return; }
    if (!form.modulo_id) { setErro('Escolha o módulo.'); return; }
    if (form.tipo === 'texto' && !form.conteudo_texto.replace(/<[^>]*>/g, '').trim()) { setErro('Escreva o conteúdo da aula.'); return; }
    if (form.tipo !== 'texto' && form.tipo !== 'presencial' && !form.conteudo_url.trim()) { setErro('Indique a ligação ou carregue o ficheiro.'); return; }
    setAGuardar(true); setErro('');
    const payload = {
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      modulo_id: form.modulo_id,
      curso_id: curso.id,
      conteudo_url: form.tipo === 'texto' || form.tipo === 'presencial' ? null : form.conteudo_url.trim(),
      conteudo_texto: form.tipo === 'texto' || form.tipo === 'presencial' ? form.conteudo_texto : null,
      duracao_min: form.duracao_min === '' ? null : Number(form.duracao_min),
      legendas_url: form.tipo === 'video' ? (form.legendas_url || null) : null,
      poster_url: form.tipo === 'video' ? (form.poster_url || null) : null,
      materiais: form.materiais,
      conclusao: form.tipo === 'presencial' ? 'presenca' : (form.tipo === 'html5' ? (form.norma ? form.conclusao : 'manual') : 'manual'),
      creditos: String(form.creditos || '').trim() || null,
      opcoes: { ...(aula?.opcoes && typeof aula.opcoes === 'object' ? aula.opcoes : {}), norma: form.tipo === 'html5' ? (form.norma || null) : null, activity_id: form.tipo === 'html5' && form.norma === 'xapi' ? (form.activity_id || null) : null },
    };
    try {
      const mudouModulo = aula && aula.modulo_id !== form.modulo_id;
      const saved = aula
        ? await Aula.update(aula.id, mudouModulo ? { ...payload, ordem: proximaOrdem } : payload)
        : await Aula.create({ ...payload, ordem: proximaOrdem });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setErro(err?.message || String(err));
    } finally {
      setAGuardar(false);
    }
  };

  const video = form.tipo === 'video' ? parseVideoUrl(form.conteudo_url) : null;
  const botoes = BOTOES_UPLOAD[form.tipo] || [];
  const aEnviar = !!envio;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !aGuardar) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submeter} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{aula ? 'Editar aula' : 'Nova aula'}</DialogTitle>
            <DialogDescription>Escolha o tipo de conteúdo e preencha o material da aula.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="af-titulo">Título <span className="text-red-600">*</span></Label>
              <Input id="af-titulo" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => set('tipo', v)} searchable={false}
                options={Object.entries(TIPO_AULA).map(([value, t]) => ({ value, label: t.label }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Módulo</Label>
              <Select value={form.modulo_id} onValueChange={(v) => set('modulo_id', v)} searchable={false} placeholder="Escolha o módulo"
                options={modulos.map(m => ({ value: m.id, label: m.titulo }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="af-dur">Duração estimada (min)</Label>
              <Input id="af-dur" type="number" min="0" step="1" value={form.duracao_min} onChange={(e) => set('duracao_min', e.target.value)} placeholder="Ex.: 15" />
            </div>

            {form.tipo === 'texto' ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Conteúdo <span className="text-red-600">*</span></Label>
                <RichTextEditor value={form.conteudo_texto} onChange={(v) => set('conteudo_texto', v)} />
              </div>
            ) : form.tipo === 'presencial' ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Descrição da sessão (opcional)</Label>
                <RichTextEditor value={form.conteudo_texto} onChange={(v) => set('conteudo_texto', v)} placeholder="O que acontece na sessão, o que trazer, onde é…" minHeight="min-h-[140px]" />
                <p className="text-xs text-slate-500 dark:text-slate-400">A aula é concluída quando o instrutor marca a presença numa sessão do curso (separador Sessões). Junte abaixo os materiais para os formandos descarregarem.</p>
              </div>
            ) : (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="af-url">{form.tipo === 'link' ? 'Ligação' : 'Ligação ou ficheiro'} <span className="text-red-600">*</span></Label>
                <div className="flex gap-2">
                  <Input id="af-url" value={form.conteudo_url} onChange={(e) => set('conteudo_url', e.target.value)} placeholder={form.tipo === 'video' ? 'https://www.youtube.com/watch?v=…' : 'https://…'} className="flex-1" disabled={aEnviar} />
                  {form.conteudo_url && (
                    <Button asChild type="button" variant="ghost" size="icon" aria-label="Abrir ligação"><a href={form.conteudo_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                  )}
                </div>
                {botoes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input ref={fileRef} type="file" className="hidden" onChange={carregar} aria-label="Carregar ficheiro" />
                    {botoes.map(b => {
                      const semLibre = b.precisaLibreOffice && caps && !caps.libreoffice;
                      const Icon = b.icon;
                      return (
                        <Button key={b.kind} type="button" variant="outline" size="sm" onClick={() => escolherFicheiro(b)} disabled={aEnviar || semLibre}
                          title={semLibre ? 'Conversão indisponível: o LibreOffice ainda não está instalado no servidor.' : undefined}>
                          {aEnviar && envio?.label === b.label ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}{b.label}
                        </Button>
                      );
                    })}
                    {form.tipo === 'pdf' && caps && !caps.libreoffice && (
                      <span className="text-xs text-amber-700 dark:text-amber-400">Conversão automática indisponível (sem LibreOffice no servidor): exporte para PDF e carregue.</span>
                    )}
                  </div>
                )}
                {envio && (
                  <div className="space-y-1 rounded-md border bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800" role="status" aria-live="polite">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span>{envio.fase === 'upload' ? `A enviar… ${envio.pct}%` : (pendente.current?.kind === 'office' ? 'A converter para PDF no servidor…' : pendente.current?.kind === 'html5' ? 'A extrair o pacote no servidor…' : 'A finalizar…')}</span>
                      <span className="inline-flex items-center gap-1"><Upload className="h-3 w-3" aria-hidden="true" />{envio.label}</span>
                    </div>
                    <Progress value={envio.fase === 'upload' ? envio.pct : 100} className={`h-1.5 ${envio.fase !== 'upload' ? 'animate-pulse' : ''}`} />
                  </div>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400">{AJUDA_URL[form.tipo]}{botoes.length ? ` Máx. ${caps?.max_mb || 1024} MB por ficheiro.` : ''}</p>
                {video?.kind === 'unknown' && form.conteudo_url && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">Ligação não reconhecida como YouTube/Vimeo/MP4: o aluno verá um botão para abrir fora.</p>
                )}
                {(video?.kind === 'youtube' || video?.kind === 'vimeo') && (
                  <div className="aspect-video w-full max-w-md overflow-hidden rounded-md bg-black"><iframe src={video.embed} title="Pré-visualização" className="h-full w-full" allow="fullscreen" /></div>
                )}
                {form.tipo === 'video' && video?.kind === 'file' && (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Legendas:</span>
                    {form.legendas_url ? <><a href={form.legendas_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 underline dark:text-blue-300">ficheiro .vtt</a><Button type="button" variant="ghost" size="sm" onClick={() => set('legendas_url', '')}><X className="h-4 w-4" aria-hidden="true" />Remover</Button></> : <span className="text-xs text-slate-500">nenhumas</span>}
                    <Button type="button" variant="outline" size="sm" disabled={aEnviar} onClick={() => escolherFicheiro({ kind: 'legendas', accept: '.vtt,.srt', label: 'Legendas' })}><Upload className="h-4 w-4" aria-hidden="true" />{form.legendas_url ? 'Substituir' : 'Carregar .vtt / .srt'}</Button>
                    {caps && <span className="ml-auto text-xs text-slate-500">{caps.ffmpeg ? 'Vídeos são optimizados no servidor (ffmpeg).' : 'Sem ffmpeg no servidor: carregue MP4 (H.264).'}</span>}
                  </div>
                )}
                {form.tipo === 'html5' && (
                  <div className="space-y-2 rounded-md border p-2 dark:border-slate-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor="af-norma" className="text-xs">Norma do pacote</Label>
                      <div className="w-72"><Select id="af-norma" value={form.norma} onValueChange={(v) => setForm(f => ({ ...f, norma: v, conclusao: v ? f.conclusao : 'manual' }))} searchable={false} options={[{ value: '', label: 'Nenhuma — HTML simples (sem comunicação com o LMS)' }, ...Object.entries(NORMAS_HTML5).map(([k, n]) => ({ value: k, label: n.label }))]} /></div>
                      {form.norma && <span className="text-xs text-slate-500">{NORMAS_HTML5[form.norma]?.ajuda}</span>}
                    </div>
                    {form.norma && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Label className="text-xs">Conclusão da aula</Label>
                        <div className="w-72"><Select value={form.conclusao} onValueChange={(v) => set('conclusao', v)} searchable={false} options={[{ value: 'manual', label: 'Manual — o aluno carrega em "Concluir aula"' }, { value: 'automatica', label: 'Automática — o pacote reporta completed / passed' }]} /></div>
                      </div>
                    )}
                    {form.norma === 'xapi' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Label htmlFor="af-activity" className="text-xs">Activity ID (tincan.xml)</Label>
                        <Input id="af-activity" value={form.activity_id} onChange={(e) => set('activity_id', e.target.value)} placeholder="Detectado automaticamente ao carregar o .zip" className="w-96 max-w-full" />
                      </div>
                    )}
                    <p className="text-xs text-slate-500">A norma é detectada ao carregar (imsmanifest.xml → SCORM; tincan.xml → xAPI; .h5p → H5P). Pacotes do eXeLearning, Adapt, Articulate, iSpring (SCORM) e do Lumi (H5P) funcionam directamente. O pacote corre no mesmo domínio, por isso encontra a API em window.parent.</p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Materiais para download</Label>
              {form.materiais.length > 0 && (
                <ul className="divide-y rounded-md border dark:divide-slate-800 dark:border-slate-700">{form.materiais.map((m, i) => (
                  <li key={m.url || i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"><span className="truncate">{m.nome || m.url}</span><Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-600" aria-label={`Remover material ${m.nome || ''}`} onClick={() => setForm(f => ({ ...f, materiais: f.materiais.filter((_, k) => k !== i) }))}><X className="h-4 w-4" /></Button></li>
                ))}</ul>
              )}
              <div className="flex items-center gap-2">
                {botoes.length === 0 && <input ref={fileRef} type="file" className="hidden" onChange={carregar} aria-label="Carregar ficheiro" />}
                <Button type="button" variant="outline" size="sm" disabled={aEnviar} onClick={() => escolherFicheiro({ kind: 'material', accept: ACCEPT_MATERIAL, label: 'Material' })}><Upload className="h-4 w-4" aria-hidden="true" />Adicionar material</Button>
                <span className="text-xs text-slate-500 dark:text-slate-400">PDF, Office, imagens, zip… Ficam disponíveis por baixo do conteúdo da aula.</span>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="af-creditos">Fonte / créditos</Label>
              <Input id="af-creditos" value={form.creditos || ''} onChange={(e) => set('creditos', e.target.value)} placeholder="Ex.: Vídeo do canal oficial da ICAO no YouTube; fotografia de X (Unsplash); baseado no Instrutivo ANAC 22A.117.001.A" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Mostrado ao aluno por baixo do conteúdo. Dê sempre crédito a vídeos, imagens e documentos de terceiros.</p>
            </div>
          </div>

          {erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{erro}</p>}
          {aviso && <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{aviso}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={aGuardar}>Cancelar</Button>
            <Button type="submit" disabled={aGuardar || aEnviar}>{aGuardar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{aula ? 'Guardar' : 'Criar aula'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
