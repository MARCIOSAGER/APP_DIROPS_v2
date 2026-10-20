// O selo de uma assinatura: as mesmas cinco linhas que vão carimbadas no PDF, mais os sinais de verificação.
//
// Porque é que as linhas são estas e não outras: o carimbo é produzido pela base de dados
// (`documento_assinatura_carimbo`) justamente para não divergir entre o PDF, o email e o ecrã — e a linha que
// mais importa é a terceira, o SIGNIFICADO DO ACTO, que é o elemento que a norma exige e que quase nenhum
// sistema grava. Aqui compõe-se a mesma frase a partir das colunas que a vista já traz, sem inventar texto novo:
// nome (e substituição), papel, significado, data/hora com fuso, código.
//
// A hora vai sempre em hora de Angola (UTC+1, sem mudança de hora) e com o fuso escrito. Não se usa a hora do
// computador de quem está a ver: um director a abrir o portal em viagem leria outra hora que a do carimbo, e a
// pergunta «a que horas foi assinado?» tem de ter uma só resposta.
import React, { useState } from 'react';
import { BadgeCheck, ChevronDown, ChevronRight, FileWarning, Link2Off, Loader2, ShieldAlert, ShieldCheck, Stamp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { T, MONO } from '../../PortalLayout';
import { papelRotulo, shaCurto } from '../../apiFluxo';
import { useVerificarAssinatura } from '../../hooksFluxo';
import { Caixa } from './comum';

// ── hora de Angola, escrita por extenso ─────────────────────────────────────
const FUSO = 'Africa/Luanda';
let formatador = null;
function fmt() {
  if (formatador) return formatador;
  try {
    formatador = new Intl.DateTimeFormat('pt-PT', {
      timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch {
    formatador = null;   // ambiente sem base de fusos: cai para a hora local, mas nunca deixa de mostrar a data
  }
  return formatador;
}
export function horaAngola(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '—';
  const f = fmt();
  if (!f) return `${d.toLocaleDateString('pt-PT')} às ${d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
  const partes = f.formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${partes.day}/${partes.month}/${partes.year} às ${partes.hour}:${partes.minute}`;
}
export const horaAngolaComFuso = (valor) => `${horaAngola(valor)} (UTC+01:00)`;

// Nome com a substituição, quando foi o suplente a assinar. É esta frase que um inspector precisa de ler, por
// isso não se abrevia nem se esconde num ícone.
export const nomeComSubstituicao = (a) => {
  const nome = a?.nome || a?.signatario_nome || a?.signatario_email || '—';
  return a?.em_substituicao_de ? `${nome} (em substituição de ${a.em_substituicao_de})` : nome;
};

// ── os três sinais ──────────────────────────────────────────────────────────
// Separados de propósito. Uma assinatura pode conferir e o ficheiro ter sido trocado — e é esse o caso misto que
// interessa apanhar. Juntá-los num só «válido/inválido» esconderia precisamente o que se quer ver.
function Sinal({ ok, bom, mau, indefinido, icone: Icone }) {
  if (ok === null || ok === undefined) {
    return <span className={cn('inline-flex items-center gap-1.5 text-sm', T.tintaFraca)}><Icone className="h-4 w-4 shrink-0" aria-hidden="true" />{indefinido}</span>;
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', ok ? T.verde : cn('font-medium', T.vermelho))}>
      <Icone className="h-4 w-4 shrink-0" aria-hidden="true" />{ok ? bom : mau}
    </span>
  );
}

export function SinaisVerificacao({ assinaturaConfere, ficheiroIntacto, eloConfere, ligacaoConfere, className }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      <Sinal ok={assinaturaConfere} icone={ShieldCheck} bom="Assinatura confere" mau="A assinatura NÃO confere" indefinido="Assinatura por verificar" />
      <Sinal ok={ficheiroIntacto} icone={BadgeCheck} bom="Ficheiro intacto" mau="O ficheiro foi substituído" indefinido="Ficheiro por verificar" />
      <Sinal ok={eloConfere} icone={Stamp} bom="Elo bem formado" mau="O elo está mal formado" indefinido="Elo por verificar" />
      {ligacaoConfere !== undefined && (
        <Sinal ok={ligacaoConfere} icone={Link2Off} bom="Cadeia intacta" mau="Falta uma assinatura na cadeia" indefinido="Cadeia por verificar" />
      )}
    </div>
  );
}

// ── o selo ──────────────────────────────────────────────────────────────────
// `assinatura` é uma linha de `documento_assinaturas_vista`; `elo` é a linha correspondente de
// `documento_assinatura_cadeia()`, quando o ecrã a tem. Sem o elo mostram-se os sinais que a vista já dá e
// oferece-se a verificação completa a pedido — recalcular um HMAC por assinatura em cada pintura seria trabalho
// para o servidor sem ninguém ter perguntado nada.
export default function SeloAssinatura({ assinatura: a, elo, ordem, className }) {
  const [aberto, setAberto] = useState(false);
  const verificacao = useVerificarAssinatura(a?.assinatura_id, { enabled: aberto });
  const v = verificacao.data || null;
  if (!a) return null;

  const intacto = v ? v.ficheiro_intacto : a.ficheiro_intacto;
  const problema = intacto === false || elo?.elo_confere === false || elo?.ligacao_confere === false
    || (v && v.assinatura_confere === false);

  return (
    <li className={cn('px-3 py-3 sm:px-4', className)}>
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums', T.linha, problema ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200' : cn(T.superficieFraca, T.tintaMedia))}>
          {ordem ?? elo?.ordem ?? a.acto_ordem ?? '·'}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          {/* linha 1 e 2 do carimbo: quem, e com que papel */}
          <p className={cn('font-medium', T.tinta)}>{nomeComSubstituicao(a)}</p>
          <p className={cn('text-sm', T.tintaMedia)}>
            {papelRotulo(a.signatario_papel)}
            {a.acto_rotulo && <> · acto <span className="font-medium">{a.acto_rotulo}</span></>}
            {Number(a.ronda) > 1 && <> · {a.ronda}.ª volta</>}
          </p>
          {/* linha 3: o SIGNIFICADO. É o que a norma exige e o que esta pessoa realmente assinou. */}
          {a.significado && <p className={cn('max-w-prose text-sm italic', T.tintaMedia)}>«{a.significado}»</p>}
          {/* linha 4 e 5: quando, e o código */}
          <p className={cn('flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm', T.tintaFraca)}>
            <span className="tabular-nums">{horaAngolaComFuso(a.assinado_em)}</span>
            <span>·</span>
            <span>código <span style={MONO} className={cn('font-medium', T.tinta)}>{a.codigo}</span></span>
            {a.carimbo_aplicado_em
              ? <><span>·</span><span>carimbado no PDF</span></>
              : <><span>·</span><span>carimbo ainda não desenhado no PDF</span></>}
          </p>

          {problema && (
            <Caixa tom="perigo" titulo={intacto === false ? 'O ficheiro assinado já não é o que está guardado' : 'A cadeia de assinaturas deste documento não fecha'} className="mt-2">
              {intacto === false && (
                <p>
                  Assinou-se a impressão digital <span style={MONO}>{shaCurto(a.ficheiro_sha256)}</span> e o ficheiro de hoje tem <span style={MONO}>{shaCurto(a.ficheiro_sha256_actual || v?.ficheiro_sha256_actual)}</span>.
                  Trate esta cópia como não verificada e avise a gestão do portal: a correcção faz-se por revisão nova, nunca substituindo o ficheiro.
                </p>
              )}
              {elo?.ligacao_confere === false && <p>Falta uma assinatura antes desta, ou foi intercalada uma. Peça à gestão do portal a verificação da cadeia completa.</p>}
              {elo?.elo_confere === false && <p>O elo desta assinatura não corresponde ao que está registado.</p>}
              {v?.assinatura_confere === false && <p>O cálculo criptográfico não confere com o texto guardado{v.chave_disponivel === false ? ' — e a chave da época não está disponível no servidor' : ''}.</p>}
            </Caixa>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              className="min-h-[2.75rem] px-2"
              aria-expanded={aberto}
              onClick={() => setAberto(x => !x)}
            >
              {aberto ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
              {aberto ? 'Esconder a verificação' : 'Verificar esta assinatura'}
            </Button>
          </div>

          {aberto && (
            <div className={cn('mt-1 space-y-2 rounded-xl border p-3', T.linha, T.superficieFraca)}>
              {verificacao.isLoading ? (
                <p className={cn('inline-flex items-center gap-2 text-sm', T.tintaFraca)}><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A recalcular a assinatura no servidor…</p>
              ) : verificacao.isError ? (
                <p role="alert" className={cn('inline-flex items-start gap-2 text-sm', T.vermelho)}>
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {verificacao.error?.message || 'Não foi possível verificar agora. Tente de novo.'}
                </p>
              ) : v?.existe === false ? (
                <p className={cn('text-sm', T.tintaFraca)}>Esta assinatura já não existe no registo.</p>
              ) : (
                <>
                  <SinaisVerificacao
                    assinaturaConfere={v?.assinatura_confere}
                    ficheiroIntacto={v?.ficheiro_intacto}
                    eloConfere={v?.elo_confere}
                    ligacaoConfere={elo?.ligacao_confere}
                  />
                  <dl className={cn('grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2', T.tintaFraca)}>
                    <div><dt className="inline font-medium">Ficheiro assinado: </dt><dd className="inline">{a.ficheiro_nome || '—'}</dd></div>
                    <div><dt className="inline font-medium">Algoritmo: </dt><dd className="inline">{v?.algoritmo || '—'} · chave <span style={MONO}>{v?.chave_id || '—'}</span></dd></div>
                    <div><dt className="inline font-medium">Assinado de: </dt><dd className="inline">{a.endereco_ip || 'endereço não registado'}</dd></div>
                    <div className="min-w-0"><dt className="inline font-medium">Equipamento: </dt><dd className="inline break-words">{a.equipamento || 'não registado'}</dd></div>
                  </dl>
                  <p className={cn('text-sm', T.tintaFraca)}>
                    O endereço e o equipamento ficam guardados como <strong>prova</strong>, não como porteiro: não há lista de endereços permitidos, porque os directores assinam em 23 aeroportos e em redes móveis.
                  </p>
                  {v?.texto_assinado && (
                    <details className="text-sm">
                      <summary className={cn('min-h-[2.75rem] cursor-pointer py-2.5', T.acento)}>Ver o texto exacto que foi assinado</summary>
                      <pre style={MONO} className={cn('mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border p-2 text-xs', T.linha, T.superficie, T.tintaMedia)}>{v.texto_assinado}</pre>
                      <p className={cn('mt-1', T.tintaFraca)}>Guarda-se o texto em bruto, e não a receita para o reconstruir: verificar daqui a dez anos não pode depender da versão da base de dados nem da ordem das chaves.</p>
                    </details>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {intacto === false && <FileWarning className={cn('mt-0.5 h-5 w-5 shrink-0', T.vermelho)} aria-hidden="true" />}
      </div>
    </li>
  );
}
