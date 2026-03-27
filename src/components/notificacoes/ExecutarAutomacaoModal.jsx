import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RefreshCw, Play } from 'lucide-react';

export default function ExecutarAutomacaoModal({
  regras,
  runRegraId,
  voosLigados,
  selectedVooLigadoId,
  aeroportosModal,
  selectedAeroporto,
  testeData,
  isRunning,
  aeroportosAngola,
  t,
  onSetSelectedVooLigadoId,
  onSetSelectedAeroporto,
  onSetTesteData,
  onExecutar,
  onClose,
}) {
  const regra = regras.find(r => r.id === runRegraId);
  const eventoGatilho = regra?.evento_gatilho;

  const isConsolidado = eventoGatilho === 'relatorio_operacional_consolidado_diario' ||
    eventoGatilho === 'relatorio_operacional_consolidado_semanal' ||
    eventoGatilho === 'relatorio_operacional_consolidado_mensal';

  const isRelatorioIndividual = eventoGatilho === 'relatorio_operacional_diario' ||
    eventoGatilho === 'relatorio_operacional_semanal' ||
    eventoGatilho === 'relatorio_operacional_mensal';

  const isVooLigado = eventoGatilho === 'voo_ligado_criado';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">{t('notificacoes.executarAutomacao')}</h3>

        {isConsolidado ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Será executado o relatório operacional consolidado {eventoGatilho.replace('relatorio_operacional_consolidado_', '')}.
            </p>

            <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg mb-6">
              <input
                type="checkbox"
                id="forcar-reenvio"
                checked={testeData.forcar_reenvio || false}
                onChange={(e) => onSetTesteData(prev => ({ ...prev, forcar_reenvio: e.target.checked }))}
                className="rounded w-4 h-4 cursor-pointer"
              />
              <label htmlFor="forcar-reenvio" className="cursor-pointer text-sm">
                <span className="font-medium text-orange-900">🔄 {t('notificacoes.forcarReenvio')}</span>
                <p className="text-xs text-orange-700 mt-0.5">{t('notificacoes.forcarReenvioDesc')}</p>
              </label>
            </div>
          </>
        ) : isVooLigado ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Selecione um voo ligado existente para simular o evento e executar a automação.
            </p>

            <div className="mb-6">
              <Label htmlFor="voo-ligado">{t('notificacoes.vooLigadoLabel')}</Label>
              <select
                id="voo-ligado"
                value={selectedVooLigadoId}
                onChange={(e) => onSetSelectedVooLigadoId(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md"
              >
                <option value="">{t('notificacoes.selecioneVooLigado')}</option>
                {voosLigados.map(voo => {
                  let descricao = '';
                  if (voo.vooArr && voo.vooDep) {
                    descricao = `${voo.vooArr.numero_voo} (${voo.vooArr.aeroporto_origem_destino}) → ${voo.vooDep.numero_voo} (${voo.vooDep.aeroporto_origem_destino})`;
                  } else {
                    descricao = `ID: ${voo.id.substring(0, 8)}...`;
                  }
                  const data = new Date(voo.created_date).toLocaleDateString('pt-PT');
                  return (
                    <option key={voo.id} value={voo.id}>
                      {descricao} - {data}
                    </option>
                  );
                })}
              </select>
            </div>
          </>
        ) : isRelatorioIndividual ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Será executado o relatório operacional {eventoGatilho.replace('relatorio_operacional_', '')}.
            </p>
            {regra?.aeroporto_icao_relatorio ? (
              <div className="mb-6">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Será gerado o relatório operacional para o aeroporto:
                </p>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="font-semibold text-blue-900">
                    {aeroportosModal[0]?.codigo_icao} - {aeroportosModal[0]?.nome || regra?.aeroporto_icao_relatorio}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Selecione o aeroporto ou todos os aeroportos para gerar e enviar o relatório operacional.
                </p>

                <div className="mb-6">
                  <Label htmlFor="aeroporto">{t('notificacoes.aeroporto')} *</Label>
                  <select
                    id="aeroporto"
                    value={selectedAeroporto}
                    onChange={(e) => onSetSelectedAeroporto(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md"
                  >
                    <option value="">{t('notificacoes.selecioneAeroporto')}</option>
                    <option value="TODOS">🌍 TODOS OS AEROPORTOS</option>
                    {aeroportosModal.filter(a => aeroportosAngola.includes(a.codigo_icao)).map(aeroporto => (
                      <option key={aeroporto.codigo_icao} value={aeroporto.codigo_icao}>
                        {aeroporto.codigo_icao} - {aeroporto.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            A automação será executada para o evento "{eventoGatilho}".
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isRunning}
          >
            {t('notificacoes.cancelar')}
          </Button>
          <Button
            onClick={onExecutar}
            disabled={isRunning}
            className="bg-green-600 hover:bg-green-700"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                {t('notificacoes.executando')}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                {t('notificacoes.executar')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
