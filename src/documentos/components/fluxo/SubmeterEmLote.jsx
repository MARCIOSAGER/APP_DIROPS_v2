// «Por submeter»: os fluxos em rascunho do próprio elaborador, com selecção e «Submeter seleccionados».
// A senha escreve-se uma vez; cada fluxo recebe a SUA assinatura (uma chamada por fluxo à rota de aprovações),
// em sequência, com progresso e o resultado de cada documento. Senha errada ou conta travada param o lote.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, FileText, KeyRound, ShieldCheck, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { T, MONO, EstadoVazio } from '../../PortalLayout';
import { assinar, enderecoFluxo } from '../../apiFluxo';
import { useActosFluxo, useRecarregarFluxo } from '../../hooksFluxo';
import { fluxosParaSubmeter, impedimentoLote, submeterEmLote } from '../../submeterLote';
import { BotaoAccao, Caixa, Campo } from './comum';


export default function SubmeterEmLote({ linhas, eu }) {
  const meus = useMemo(() => fluxosParaSubmeter(linhas, eu), [linhas, eu]);
  const actos = useActosFluxo();
  const recarregar = useRecarregarFluxo();
  const [sel, setSel] = useState(() => new Set());
  const [senha, setSenha] = useState('');
  const [aDecorrer, setADecorrer] = useState(null); // { indice, total, fluxo }
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  const aptos = meus.filter(l => !impedimentoLote(l));
  const escolhidos = meus.filter(l => sel.has(l.fluxo_id));
  const todos = aptos.length > 0 && aptos.every(l => sel.has(l.fluxo_id));
  const alternar = (id) => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const significado = actos.acto('elaboracao')?.significado || '';

  const correr = async (e) => {
    e?.preventDefault();
    if (!senha || !escolhidos.length || aDecorrer) return;
    setErro(''); setResultado(null);
    try {
      const r = await submeterEmLote(escolhidos, { senha, assinar, onProgresso: setADecorrer });
      setResultado(r);
      setSel(new Set(r.falhas.concat(r.naoTentados).map(x => x.fluxo.fluxo_id)));
    } catch (x) {
      setErro(x?.message || String(x));
    } finally {
      setSenha('');
      setADecorrer(null);
      recarregar();
    }
  };

  if (!meus.length && !resultado) {
    return <EstadoVazio icone={FileText} titulo="Não tem fluxos por submeter" texto="Os fluxos que abrir (por exemplo, os preparados a partir de um modelo-mestre) aparecem aqui até os submeter." />;
  }

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <p className={cn('max-w-prose text-sm', T.tintaFraca)}>
        Escolha os documentos e escreva a senha uma vez. Cada documento fica com a sua própria assinatura de elaboração e o revisor é avisado de cada um.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className={cn('border-b text-left', T.linha, T.tintaFraca)}>
            <th className="w-10 py-2 pl-1">
              <input type="checkbox" aria-label="Seleccionar todos os que podem ir no lote" checked={todos} disabled={!aptos.length || !!aDecorrer}
                onChange={() => setSel(todos ? new Set() : new Set(aptos.map(l => l.fluxo_id)))} />
            </th>
            <th className="py-2 pr-3 font-medium">Documento</th>
            <th className="py-2 pr-3 font-medium">Aeroporto</th>
            <th className="py-2 pr-3 font-medium">Revisão</th>
            <th className="py-2 pr-3 font-medium">Revisor</th>
            <th className="py-2 font-medium">Situação</th>
          </tr>
        </thead>
        <tbody className={cn('divide-y', T.divisoria)}>
          {meus.map(l => {
            const imp = impedimentoLote(l);
            const okR = resultado?.ok.find(x => x.fluxo.fluxo_id === l.fluxo_id);
            const falha = resultado?.falhas.find(x => x.fluxo.fluxo_id === l.fluxo_id);
            const actual = aDecorrer?.fluxo?.fluxo_id === l.fluxo_id;
            return (
              <tr key={l.fluxo_id}>
                <td className="py-2 pl-1"><input type="checkbox" aria-label={`Seleccionar ${l.numero || l.titulo}`} checked={sel.has(l.fluxo_id)} disabled={!!imp || !!aDecorrer} onChange={() => alternar(l.fluxo_id)} /></td>
                <td className="py-2 pr-3">
                  <Link to={enderecoFluxo(l.fluxo_id)} className={cn('hover:underline', T.foco)}>
                    {l.numero && <span style={MONO} className="mr-2 font-semibold">{l.numero}</span>}{l.titulo || 'Documento sem título'}
                  </Link>
                </td>
                <td className="py-2 pr-3">{l.aeroporto || '—'}</td>
                <td className="py-2 pr-3 tabular-nums">{l.revisao || '—'}</td>
                <td className="py-2 pr-3">{l.revisor_email || <span className={T.vermelho}>por indicar</span>}</td>
                <td className="py-2">
                  {actual ? <span className={T.tintaFraca}>a assinar…</span>
                    : okR ? <span className={cn('inline-flex items-center gap-1', T.verde)}><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Submetido{okR.codigo ? ` · ${okR.codigo}` : ''}</span>
                      : falha ? <span className={cn('inline-flex items-center gap-1', T.vermelho)}><XCircle className="h-4 w-4" aria-hidden="true" />{falha.erro}</span>
                        : imp ? <span className={T.ambar}>{imp}</span>
                          : l.estado === 'devolvido' ? <span className={T.ambar}>devolvido</span> : <span className={T.tintaFraca}>em rascunho</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {resultado && (
        <Caixa tom={resultado.falhas.length || resultado.naoTentados.length ? 'atencao' : 'feito'} titulo={`${resultado.ok.length} submetido(s), ${resultado.falhas.length} com falha${resultado.naoTentados.length ? `, ${resultado.naoTentados.length} por tentar` : ''}`}>
          {resultado.parouPor && <p>{resultado.parouPor}</p>}
          {resultado.falhas.length > 0 && <p>Os que falharam ficaram seleccionados: corrija e volte a submeter, ou abra cada um.</p>}
        </Caixa>
      )}
      {erro && <Caixa tom="perigo" titulo="Não foi possível submeter"><p>{erro}</p></Caixa>}

      <form onSubmit={correr} className={cn('space-y-3 rounded-xl border p-4', T.linha, T.superficie)}>
        <div className={cn('space-y-2 rounded-lg border p-3', T.linha, T.superficieFraca)}>
          <p className={T.tinta}>Vai assinar como <strong>Elaborador</strong> {escolhidos.length === 1 ? 'um documento' : <><strong>{escolhidos.length}</strong> documentos</>}, um a um.</p>
          {significado
            ? <p className={cn('max-w-prose italic', T.tintaMedia)}>«{significado}»</p>
            : <p className={cn('max-w-prose text-sm', T.ambar)}>O significado do acto não chegou do servidor. Recarregue antes de assinar.</p>}
          <p className={cn('text-sm', T.tintaFraca)}>Para cada documento fica registado o seu nome, a data e a hora, o endereço e o equipamento, e a impressão digital do PDF desse documento.</p>
        </div>
        <Campo id="lote-senha" label="Senha da sua conta" obrigatorio ajuda="Escreve-se uma vez para o lote; não é guardada. Senha errada pára o lote antes de travar a conta.">
          <Input id="lote-senha" type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} className="min-h-[2.75rem] max-w-sm" />
        </Campo>
        <div className="flex flex-wrap items-center gap-3">
          <BotaoAccao type="submit" icone={ShieldCheck} ocupado={!!aDecorrer} disabled={!senha || !escolhidos.length || !significado || !!aDecorrer}>
            Submeter {escolhidos.length || ''} seleccionado{escolhidos.length === 1 ? '' : 's'}
          </BotaoAccao>
          {aDecorrer && <span className={cn('text-sm', T.tintaFraca)} role="status">{aDecorrer.indice + 1} de {aDecorrer.total} · {aDecorrer.fluxo?.numero || ''}</span>}
          {!aDecorrer && sel.size > 0 && <Button type="button" variant="ghost" onClick={() => setSel(new Set())}>Limpar a selecção</Button>}
        </div>
        <p className={cn('text-sm', T.tintaFraca)}><KeyRound className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />Cada submissão avisa o revisor por email, um a um.</p>
      </form>
    </div>
  );
}
