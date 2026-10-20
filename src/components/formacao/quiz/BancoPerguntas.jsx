import React, { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import Select from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Copy, Search, FileSpreadsheet, Download, Loader2, HelpCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Pergunta } from '@/entities/Pergunta';
import { usePerguntas } from '@/hooks/useQuizGestao';
import { TIPOS_PERGUNTA, validarPergunta, normalizarOpcoes, novoId } from './quizUtils';
import PerguntaForm from './PerguntaForm';
import BotoesExportar from '../gestao/BotoesExportar';
import { exportarExcel } from '@/lib/formacaoExport';

// Texto das opções / resposta correcta de uma pergunta, para exportação.
function descreverOpcoes(p) {
  const ops = Array.isArray(p.opcoes) ? p.opcoes : [];
  switch (p.tipo) {
    case 'escolha_unica': case 'escolha_multipla': case 'vf': return [ops.map(o => o.texto).join(' | '), ops.filter(o => o.correta).map(o => o.texto).join(' | ')];
    case 'lacuna': return ['', ops.map(o => o.texto).join(' | ')];
    case 'numerica': return ['', ops[0] ? `${ops[0].valor}${ops[0].tolerancia ? ` ± ${ops[0].tolerancia}` : ''}${ops[0].unidade ? ` ${ops[0].unidade}` : ''}` : ''];
    case 'ordenacao': return ['', ops.map((o, i) => `${i + 1}. ${o.texto}`).join(' | ')];
    case 'correspondencia': return ['', ops.map(o => `${o.esquerda} => ${o.direita}`).join(' | ')];
    case 'hotspot': return [`${ops.length} zona(s) na imagem`, ''];
    case 'rotulos': return [ops.map(o => o.rotulo).join(' | '), ''];
    case 'aberta': return ['resposta livre', ops[0]?.rubrica || ''];
    default: return ['', ''];
  }
}

// Banco de perguntas: do curso (cursoId) + globais. Sem cursoId = só globais (separador da gestão).
export default function BancoPerguntas({ cursoId = null, user, onCriada }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: perguntas = [], isLoading } = usePerguntas(cursoId);
  const [form, setForm] = useState({ open: false, pergunta: null });
  const [importar, setImportar] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [categoria, setCategoria] = useState('todas');
  const [ocupado, setOcupado] = useState(null);
  const refrescar = () => qc.invalidateQueries({ queryKey: ['pergunta'] });

  const categorias = useMemo(() => [...new Set(perguntas.map(p => p.categoria).filter(Boolean))].sort(), [perguntas]);
  const q = busca.trim().toLowerCase();
  const lista = perguntas.filter(p => (tipo === 'todos' || p.tipo === tipo) && (categoria === 'todas' || p.categoria === categoria) && (!q || String(p.enunciado || '').toLowerCase().includes(q)));

  const alternar = async (p) => {
    setOcupado(p.id);
    try { await Pergunta.update(p.id, { ativo: !(p.ativo !== false) }); await refrescar(); }
    catch (e) { toast({ title: 'Não foi possível actualizar', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };
  const duplicar = async (p) => {
    setOcupado(p.id);
    try {
      const { id: _id, created_date: _cd, updated_date: _ud, created_by: _cb, updated_by: _ub, ...resto } = p;
      await Pergunta.create({ ...resto, enunciado: p.enunciado + ' (cópia)', created_by: user?.email || null });
      toast({ title: 'Pergunta duplicada' }); await refrescar();
    } catch (e) { toast({ title: 'Não foi possível duplicar', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };
  const apagar = async () => {
    const p = confirm; setConfirm(null); setOcupado(p.id);
    try { await Pergunta.delete(p.id); toast({ title: 'Pergunta apagada' }); await refrescar(); await qc.invalidateQueries({ queryKey: ['quiz_item'] }); }
    catch (e) { toast({ title: 'Não foi possível apagar', description: e?.message, variant: 'destructive' }); }
    finally { setOcupado(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar no enunciado…" aria-label="Pesquisar perguntas" className="pl-9" />
          </div>
          <div className="w-full sm:w-48"><Select value={tipo} onValueChange={setTipo} searchable={false} options={[{ value: 'todos', label: 'Todos os tipos' }, ...Object.entries(TIPOS_PERGUNTA).map(([value, t]) => ({ value, label: t.label }))]} /></div>
          {categorias.length > 0 && <div className="w-full sm:w-44"><Select value={categoria} onValueChange={setCategoria} searchable={false} options={[{ value: 'todas', label: 'Todas as categorias' }, ...categorias.map(c => ({ value: c, label: c }))]} /></div>}
        </div>
        <div className="flex gap-2">
          <BotoesExportar rotuloExcel="Exportar Excel" size="default" disabled={lista.length === 0} onExcel={() => exportarExcel(`Banco_perguntas${cursoId ? '' : '_global'}`, [{ nome: 'Perguntas', cabecalho: ['Tipo', 'Enunciado', 'Categoria', 'Pontos', 'Activa', 'Âmbito', 'Opções', 'Resposta correcta', 'Explicação', 'Imagem'], linhas: lista.map(p => { const [ops, certas] = descreverOpcoes(p); return [TIPOS_PERGUNTA[p.tipo]?.label || p.tipo, p.enunciado, p.categoria || '', Number(p.pontos) || 1, p.ativo === false ? 'Não' : 'Sim', p.curso_id ? 'Curso' : 'Global', ops, certas, p.explicacao || '', p.imagem_url || '']; }), larguras: [18, 60, 16, 7, 7, 8, 50, 40, 40, 30] }])} />
          <Button variant="outline" onClick={() => setImportar(true)}><FileSpreadsheet className="h-4 w-4" aria-hidden="true" />Importar Excel</Button>
          <Button onClick={() => setForm({ open: true, pergunta: null })}><Plus className="h-4 w-4" aria-hidden="true" />Nova pergunta</Button>
        </div>
      </div>

      <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : lista.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <HelpCircle className="h-8 w-8 text-slate-400" aria-hidden="true" />
            <p className="font-medium text-slate-900 dark:text-slate-100">{perguntas.length === 0 ? 'O banco de perguntas está vazio' : 'Nenhuma pergunta corresponde aos filtros'}</p>
            {perguntas.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Crie perguntas uma a uma ou importe um ficheiro Excel com o modelo.</p>}
          </div>
        ) : (
          <ul className="divide-y dark:divide-slate-800">
            {lista.map(p => {
              const T = TIPOS_PERGUNTA[p.tipo] || TIPOS_PERGUNTA.escolha_unica; const Icon = T.icon;
              return (
                <li key={p.id} className={`flex items-start gap-3 px-4 py-3 ${p.ativo === false ? 'opacity-60' : ''}`}>
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-slate-900 dark:text-slate-100">{p.enunciado}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Badge variant="secondary" className="font-normal">{T.label}</Badge>
                      {p.categoria && <Badge variant="outline" className="font-normal dark:border-slate-700">{p.categoria}</Badge>}
                      <span>{Number(p.pontos) || 1} {Number(p.pontos) === 1 ? 'ponto' : 'pontos'}</span>
                      {!p.curso_id && <span className="text-violet-600 dark:text-violet-400">global</span>}
                      {p.imagem_url && <span>· com imagem</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Switch checked={p.ativo !== false} disabled={ocupado === p.id} onCheckedChange={() => alternar(p)} aria-label="Activa" />
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar" onClick={() => setForm({ open: true, pergunta: p })}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Duplicar" disabled={ocupado === p.id} onClick={() => duplicar(p)}>{ocupado === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}</Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" aria-label="Apagar" disabled={ocupado === p.id} onClick={() => setConfirm(p)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent></Card>
      <p className="text-xs text-slate-500 dark:text-slate-400">{lista.length} de {perguntas.length} perguntas{cursoId ? ' (deste curso + globais)' : ' globais'}.</p>

      <PerguntaForm isOpen={form.open} onClose={() => setForm({ open: false, pergunta: null })} pergunta={form.pergunta} cursoId={cursoId} categorias={categorias} user={user}
        onSaved={(saved, nova) => { toast({ title: nova ? 'Pergunta criada' : 'Pergunta actualizada' }); refrescar(); if (nova) onCriada?.(saved); }} />
      <ImportarPerguntasDialog isOpen={importar} onClose={() => setImportar(false)} cursoId={cursoId} user={user} onDone={(n) => { toast({ title: `${n} ${n === 1 ? 'pergunta importada' : 'perguntas importadas'}` }); refrescar(); }} />
      <ConfirmModal isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={apagar} variant="destructive" title="Apagar pergunta?" confirmText="Apagar"
        message="A pergunta sai do banco e de todas as avaliações onde estava. As tentativas já feitas mantêm o seu registo." />
    </div>
  );
}

// ── Importação por Excel ─────────────────────────────────────────────────
const COLUNAS = ['tipo', 'enunciado', 'categoria', 'pontos', 'explicacao', 'corretas', 'opcao_1', 'opcao_2', 'opcao_3', 'opcao_4', 'opcao_5', 'opcao_6', 'opcao_7', 'opcao_8'];
const EXEMPLOS = [
  { tipo: 'escolha_unica', enunciado: 'Qual é a velocidade máxima de veículos autónomos nas plataformas?', categoria: 'Circulação', pontos: 1, explicacao: 'Norma de circulação no lado ar.', corretas: '2', opcao_1: '40 km/h', opcao_2: '25 km/h', opcao_3: '10 km/h' },
  { tipo: 'escolha_multipla', enunciado: 'Que equipamentos são obrigatórios nas viaturas que circulam em áreas restritas?', categoria: 'Circulação', pontos: 2, corretas: '1,2,4', opcao_1: 'Abafa-chamas no escape', opcao_2: 'Extintor visível', opcao_3: 'Buzina', opcao_4: 'Placas reflectoras' },
  { tipo: 'vf', enunciado: 'É permitida a circulação de motociclos na área de movimento.', categoria: 'Circulação', pontos: 1, corretas: 'F' },
  { tipo: 'lacuna', enunciado: 'A sigla do código de condição da pista é ____.', categoria: 'GRF', pontos: 1, opcao_1: 'RWYCC', opcao_2: 'Runway Condition Code' },
  { tipo: 'numerica', enunciado: 'Raio, em metros, da zona segura de abastecimento.', categoria: 'Abastecimento', pontos: 1, opcao_1: '6', opcao_2: '0', opcao_3: 'm' },
  { tipo: 'ordenacao', enunciado: 'Ordene os passos do OPA num dia de chuva.', categoria: 'GRF', pontos: 3, opcao_1: 'Iniciar o Monitoramento Operacional', opcao_2: 'Verificar a lâmina de água e registar o RWYCC', opcao_3: 'Repassar o RWYCC à TWR ao livrar a pista' },
  { tipo: 'correspondencia', enunciado: 'Ligue a letra à pronúncia.', categoria: 'Fraseologia', pontos: 2, opcao_1: 'A => AL FA', opcao_2: 'B => BRA VO', opcao_3: 'C => CHAR LI' },
];
const INSTRUCOES = [
  ['Coluna', 'Como preencher'],
  ['tipo', 'escolha_unica | escolha_multipla | vf | lacuna | numerica | ordenacao | correspondencia'],
  ['enunciado', 'Texto da pergunta (obrigatório).'],
  ['categoria', 'Tema, para sortear perguntas (opcional).'],
  ['pontos', 'Número; vazio = 1.'],
  ['explicacao', 'Mostrada na revisão (opcional).'],
  ['corretas', 'escolha_unica/multipla: números das opções correctas separados por vírgula (ex.: 2 ou 1,3). vf: V ou F.'],
  ['opcao_1..8', 'escolha: texto das opções · lacuna: respostas aceites · numerica: opcao_1=valor, opcao_2=tolerância, opcao_3=unidade · ordenacao: itens pela ORDEM CORRECTA · correspondencia: "termo => correspondência".'],
];

function linhaParaPergunta(r) {
  const tipo = String(r.tipo || '').trim().toLowerCase();
  const ops = COLUNAS.filter(c => c.startsWith('opcao_')).map(c => String(r[c] ?? '').trim()).filter(Boolean);
  const corretas = String(r.corretas ?? '').trim();
  let opcoes = [];
  switch (tipo) {
    case 'escolha_unica': case 'escolha_multipla': {
      const idx = new Set(corretas.split(/[,;\s]+/).map(x => parseInt(x, 10)).filter(n => n >= 1));
      opcoes = ops.map((t, i) => ({ id: novoId(), texto: t, correta: idx.has(i + 1) }));
      break;
    }
    case 'vf': {
      const v = /^v/i.test(corretas);
      opcoes = [{ id: 'v', texto: 'Verdadeiro', correta: v }, { id: 'f', texto: 'Falso', correta: !v && /^f/i.test(corretas) }];
      break;
    }
    case 'lacuna': case 'ordenacao': opcoes = ops.map(t => ({ id: novoId(), texto: t })); break;
    case 'numerica': opcoes = [{ valor: ops[0], tolerancia: ops[1] || 0, unidade: ops[2] || '' }]; break;
    case 'correspondencia': opcoes = ops.map(t => { const [e, d] = t.split(/\s*=>\s*/); return { id: novoId(), esquerda: e || '', direita: d || '' }; }); break;
    default: break;
  }
  return { tipo, enunciado: String(r.enunciado || '').trim(), categoria: String(r.categoria || '').trim() || null, pontos: Number(r.pontos) > 0 ? Number(r.pontos) : 1, explicacao: String(r.explicacao || '').trim() || null, opcoes };
}

function ImportarPerguntasDialog({ isOpen, onClose, cursoId, user, onDone }) {
  const fileRef = useRef(null);
  const [linhas, setLinhas] = useState(null); // [{ ok, pergunta, erros, n }]
  const [aLer, setALer] = useState(false);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState('');

  const fechar = () => { if (aGravar) return; setLinhas(null); setErro(''); onClose(); };

  const modelo = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(EXEMPLOS, { header: COLUNAS }), 'Perguntas');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(INSTRUCOES), 'Instruções');
    XLSX.writeFile(wb, 'modelo-perguntas-quiz.xlsx');
  };

  const ler = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setALer(true); setErro(''); setLinhas(null);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets['Perguntas'] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const parsed = rows.map((r, i) => {
        const chaves = Object.fromEntries(Object.entries(r).map(([k, v]) => [String(k).trim().toLowerCase(), v]));
        const p = linhaParaPergunta(chaves);
        const errs = validarPergunta({ ...p, opcoes: normalizarOpcoes(p.tipo, p.opcoes) });
        return { n: i + 2, pergunta: { ...p, opcoes: normalizarOpcoes(p.tipo, p.opcoes) }, erros: errs, ok: errs.length === 0 };
      }).filter(l => l.pergunta.enunciado || l.pergunta.tipo);
      if (!parsed.length) setErro('O ficheiro não tem linhas com perguntas. Use a folha "Perguntas" do modelo.');
      setLinhas(parsed);
    } catch (err) { setErro('Não foi possível ler o ficheiro: ' + (err?.message || err)); }
    finally { setALer(false); }
  };

  const gravar = async () => {
    const validas = (linhas || []).filter(l => l.ok);
    if (!validas.length) return;
    setAGravar(true);
    try {
      await Pergunta.bulkCreate(validas.map(l => ({ ...l.pergunta, ativo: true, curso_id: cursoId || null, created_by: user?.email || null })));
      onDone?.(validas.length); fechar();
    } catch (err) { setErro(err?.message || String(err)); }
    finally { setAGravar(false); }
  };

  const nOk = (linhas || []).filter(l => l.ok).length;
  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) fechar(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar perguntas de Excel</DialogTitle>
          <DialogDescription>Descarregue o modelo, preencha a folha "Perguntas" e carregue o ficheiro. As perguntas entram {cursoId ? 'neste curso' : 'como globais'}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={modelo}><Download className="h-4 w-4" aria-hidden="true" />Descarregar modelo</Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={ler} aria-label="Escolher ficheiro Excel" />
            <Button type="button" onClick={() => fileRef.current?.click()} disabled={aLer}>{aLer ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}Escolher ficheiro</Button>
          </div>
          {erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{erro}</p>}
          {linhas && linhas.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-slate-700 dark:text-slate-300"><strong>{nOk}</strong> válidas de {linhas.length}{linhas.length - nOk > 0 ? ` · ${linhas.length - nOk} com erros (não serão importadas)` : ''}.</p>
              <ul className="max-h-64 divide-y overflow-y-auto rounded-md border text-sm dark:divide-slate-800 dark:border-slate-700">
                {linhas.map(l => (
                  <li key={l.n} className={`px-3 py-2 ${l.ok ? '' : 'bg-red-50 dark:bg-red-950/30'}`}>
                    <span className="mr-2 text-xs text-slate-400">linha {l.n}</span>
                    <span className="text-slate-800 dark:text-slate-200">{l.pergunta.enunciado || '(sem enunciado)'}</span>
                    <span className="ml-2 text-xs text-slate-500">{TIPOS_PERGUNTA[l.pergunta.tipo]?.label || l.pergunta.tipo || 'tipo?'}</span>
                    {!l.ok && <p className="text-xs text-red-700 dark:text-red-300">{l.erros.join(' ')}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={aGravar}>Cancelar</Button>
          <Button onClick={gravar} disabled={!nOk || aGravar}>{aGravar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Importar {nOk || ''}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
