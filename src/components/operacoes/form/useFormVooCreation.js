import { normalizeAircraftRegistration } from '@/components/lib/utils';
import { notifyAdminsCreation } from '@/components/lib/notificacoes';
import { useI18n } from '@/components/lib/i18n';

import { Aeroporto } from '@/entities/Aeroporto';
import { CompanhiaAerea } from '@/entities/CompanhiaAerea';
import { RegistoAeronave } from '@/entities/RegistoAeronave';

/**
 * Hook that encapsulates the quick-create handlers for aeroporto, companhia, and registo.
 * Returns { handleCreateAeroporto, handleCreateCompanhia, handleCreateRegisto }.
 */
export default function useFormVooCreation({
  aeroportosOrigemDestino,
  companhias,
  aeronaves,
  currentUser,
  formData,
  setFormData,
  setAlertInfo,
  onRefreshData,
  setShowCreateAeroporto,
  setShowCreateCompanhia,
  setShowCreateRegisto
}) {
  const { t } = useI18n();

  const handleCreateAeroporto = async (data) => {
    try {
      const codigoIcaoNormalizado = data.codigo_icao?.trim().toUpperCase();

      const aeroportoExistente = aeroportosOrigemDestino.find(
        (a) => a.codigo_icao?.trim().toUpperCase() === codigoIcaoNormalizado
      );

      if (aeroportoExistente) {
        setAlertInfo({
          isOpen: true,
          type: 'warning',
          title: t('formVoo.alertAeroportoDuplicadoTitulo'),
          message: `${t('formVoo.alertAeroportoDuplicadoMsg1')} "${data.codigo_icao}". ${t('formVoo.alertNome')} ${aeroportoExistente.nome}.`
        });
        return;
      }

      let paisCode = data.pais?.trim().toUpperCase();

      if (paisCode && paisCode.length > 2) {
        const paisMapping = {
          'ANGOLA': 'AO',
          'PORTUGAL': 'PT',
          'BRASIL': 'BR',
          'SOUTH AFRICA': 'ZA',
          'NAMIBIA': 'NA',
          'ZAMBIA': 'ZM',
          'CONGO': 'CG',
          'DRC': 'CD'
        };
        paisCode = paisMapping[paisCode] || paisCode.substring(0, 2);
      }

      if (!paisCode || paisCode.length !== 2) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: t('formVoo.alertPaisInvalidoTitulo'),
          message: t('formVoo.alertPaisInvalidoMsg')
        });
        return;
      }

      const dataToSave = {
        ...data,
        codigo_icao: codigoIcaoNormalizado,
        pais: paisCode
      };

      const novoAeroporto = await Aeroporto.create(dataToSave);

      setTimeout(() => {
        notifyAdminsCreation('aeroporto', novoAeroporto, currentUser);
      }, 100);

      if (onRefreshData) {
        setTimeout(() => onRefreshData(['aeroportos']), 50);
      }

      if (!formData.aeroporto_origem_destino) {
        setFormData((prev) => ({ ...prev, aeroporto_origem_destino: novoAeroporto.codigo_icao }));
      }

      setShowCreateAeroporto(false);
      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: t('formVoo.alertAeroportoCriadoTitulo'),
        message: `${t('formVoo.alertAeroportoCriadoMsg1')} "${novoAeroporto.nome}" ${t('formVoo.alertCriadoSucesso')}`
      });
    } catch (error) {
      console.error('Erro ao criar aeroporto:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('formVoo.alertErroAeroportoTitulo'),
        message: error.message || t('formVoo.alertErroAeroportoMsg')
      });
    }
  };

  const handleCreateCompanhia = async (data) => {
    try {
      const codigoIcaoNormalizado = data.codigo_icao?.trim().toUpperCase();

      const companhiaExistente = companhias.find(
        (c) => c.codigo_icao?.trim().toUpperCase() === codigoIcaoNormalizado
      );

      if (companhiaExistente) {
        setAlertInfo({
          isOpen: true,
          type: 'warning',
          title: t('formVoo.alertCompanhiaDuplicadaTitulo'),
          message: `${t('formVoo.alertCompanhiaDuplicadaMsg1')} "${data.codigo_icao}". ${t('formVoo.alertNome')} ${companhiaExistente.nome}.`
        });
        return;
      }

      const novaCompanhia = await CompanhiaAerea.create(data);

      setTimeout(() => {
        notifyAdminsCreation('companhia', novaCompanhia, currentUser);
      }, 100);

      if (onRefreshData) {
        setTimeout(() => onRefreshData(['companhias']), 50);
      }

      setFormData((prev) => ({
        ...prev,
        companhia_aerea: novaCompanhia.codigo_icao,
        registo_aeronave: ''
      }));
      setShowCreateCompanhia(false);
      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: t('formVoo.alertCompanhiaCriadaTitulo'),
        message: `${t('formVoo.alertCompanhiaCriadaMsg1')} "${novaCompanhia.nome}" ${t('formVoo.alertCriadoSucesso')}`
      });
    } catch (error) {
      console.error('Erro ao criar companhia:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('formVoo.alertErroCompanhiaTitulo'),
        message: t('formVoo.alertErroCompanhiaMsg')
      });
    }
  };

  const handleCreateRegisto = async (data) => {
    try {
      const registoNormalizado = normalizeAircraftRegistration(data.registo);

      if (!registoNormalizado) {
        setAlertInfo({
          isOpen: true,
          type: 'error',
          title: t('formVoo.alertFormatoInvalidoTitulo'),
          message: t('formVoo.alertFormatoRegistoMsg')
        });
        return;
      }

      const registoExistente = aeronaves.find(
        (r) => normalizeAircraftRegistration(r.registo) === registoNormalizado
      );

      if (registoExistente) {
        setAlertInfo({
          isOpen: true,
          type: 'warning',
          title: t('formVoo.alertRegistoDuplicadoTitulo'),
          message: `${t('formVoo.alertRegistoDuplicadoMsg')} "${data.registo}".`
        });
        return;
      }

      const dataToSave = {
        ...data,
        registo: registoNormalizado
      };

      const novoRegisto = await RegistoAeronave.create({ ...dataToSave, empresa_id: currentUser?.empresa_id });

      setTimeout(() => {
        notifyAdminsCreation('registo', novoRegisto, currentUser);
      }, 100);

      if (onRefreshData) {
        setTimeout(() => onRefreshData(['aeronaves']), 50);
      }

      setFormData((prev) => ({ ...prev, registo_aeronave: novoRegisto.registo }));
      setShowCreateRegisto(false);
      setAlertInfo({
        isOpen: true,
        type: 'success',
        title: t('formVoo.alertRegistoCriadoTitulo'),
        message: `${t('formVoo.alertRegistoCriadoMsg1')} "${novoRegisto.registo}" ${t('formVoo.alertCriadoSucesso')}`
      });
    } catch (error) {
      console.error('Erro ao criar registo:', error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: t('formVoo.alertErroRegistoTitulo'),
        message: t('formVoo.alertErroRegistoMsg')
      });
    }
  };

  return { handleCreateAeroporto, handleCreateCompanhia, handleCreateRegisto };
}
