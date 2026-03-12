import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, RotateCcw, AlertTriangle, Mail, Plane } from 'lucide-react';
import { Voo } from '@/entities/Voo';
import { VooLigado } from '@/entities/VooLigado';
import { CalculoTarifa } from '@/entities/CalculoTarifa';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import AlertModal from '@/components/shared/AlertModal';
import SuccessModal from '@/components/shared/SuccessModal';
import { sendEmailDirect } from '@/functions/sendEmailDirect';
import { User } from '@/entities/User';

export default function LixeiraVoosModal({ isOpen, onClose, onSuccess, companhias, aeroportos, voosLigados }) {
  const [voosNaLixeira, setVoosNaLixeira] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteInfo, setDeleteInfo] = useState({ isOpen: false, id: null });
  const [restoreInfo, setRestoreInfo] = useState({ isOpen: false, id: null });
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [successInfo, setSuccessInfo] = useState({ isOpen: false, title: '', message: '' });
  const [isSendingNotification, setIsSendingNotification] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLixeira();
    }
  }, [isOpen]);

  const loadLixeira = async () => {
    setIsLoading(true);
    try {
      const todosVoos = await Voo.list('-deleted_at');
      const voosExcluidos = todosVoos.filter(v => v.deleted_at);
      setVoosNaLixeira(voosExcluidos);
    } catch (error) {
      console.error("Erro ao carregar lixeira:", error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível carregar os itens da lixeira.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreConfirm = async () => {
    try {
      await Voo.update(restoreInfo.id, {
        deleted_at: null,
        deleted_by: null
      });

      setSuccessInfo({
        isOpen: true,
        title: 'Restaurado',
        message: 'Voo restaurado com sucesso.'
      });
      
      loadLixeira();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao restaurar voo:", error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível restaurar o voo.'
      });
    } finally {
      setRestoreInfo({ isOpen: false, id: null });
    }
  };

  const handleDeletePermanentConfirm = async () => {
    try {
      const voo = voosNaLixeira.find(v => v.id === deleteInfo.id);
      
      // Verificar e excluir vinculações relacionadas
      const vinculacoesRelacionadas = voosLigados.filter(vl => 
        vl.id_voo_arr === voo.id || vl.id_voo_dep === voo.id
      );

      for (const vinculacao of vinculacoesRelacionadas) {
        // Excluir cálculos de tarifa relacionados
        const calculosRelacionados = await CalculoTarifa.filter({ voo_ligado_id: vinculacao.id });
        for (const calculo of calculosRelacionados) {
          await CalculoTarifa.delete(calculo.id);
        }
        
        // Excluir vinculação
        await VooLigado.delete(vinculacao.id);
      }

      // Excluir permanentemente o voo
      await Voo.delete(voo.id);

      setSuccessInfo({
        isOpen: true,
        title: 'Excluído Permanentemente',
        message: 'Voo excluído permanentemente do sistema.'
      });
      
      loadLixeira();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao excluir permanentemente:", error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível excluir o voo permanentemente.'
      });
    } finally {
      setDeleteInfo({ isOpen: false, id: null });
    }
  };

  const handleLimparLixeira = async () => {
    if (voosNaLixeira.length === 0) {
      setAlertInfo({
        isOpen: true,
        type: 'warning',
        title: 'Lixeira Vazia',
        message: 'Não há itens na lixeira para excluir.'
      });
      return;
    }

    setAlertInfo({
      isOpen: true,
      type: 'error',
      title: 'Limpar Lixeira',
      message: `ATENÇÃO: Isto irá excluir permanentemente ${voosNaLixeira.length} voo(s) e todas as suas vinculações. Esta acção é irreversível!`,
      showCancel: true,
      confirmText: 'Excluir Tudo',
      onConfirm: async () => {
        setAlertInfo(prev => ({ ...prev, isOpen: false }));
        
        try {
          for (const voo of voosNaLixeira) {
            // Verificar e excluir vinculações relacionadas
            const vinculacoesRelacionadas = voosLigados.filter(vl => 
              vl.id_voo_arr === voo.id || vl.id_voo_dep === voo.id
            );

            for (const vinculacao of vinculacoesRelacionadas) {
              // Excluir cálculos de tarifa relacionados
              const calculosRelacionados = await CalculoTarifa.filter({ voo_ligado_id: vinculacao.id });
              for (const calculo of calculosRelacionados) {
                await CalculoTarifa.delete(calculo.id);
              }
              
              // Excluir vinculação
              await VooLigado.delete(vinculacao.id);
            }

            // Excluir permanentemente o voo
            await Voo.delete(voo.id);
          }

          setSuccessInfo({
            isOpen: true,
            title: 'Lixeira Limpa',
            message: `${voosNaLixeira.length} voo(s) foram excluídos permanentemente.`
          });
          
          loadLixeira();
          if (onSuccess) onSuccess();
        } catch (error) {
          console.error("Erro ao limpar lixeira:", error);
          setAlertInfo({
            isOpen: true,
            type: 'error',
            title: 'Erro',
            message: 'Não foi possível limpar a lixeira completamente.'
          });
        }
      }
    });
  };

  const handleNotificarAdministradores = async () => {
    setIsSendingNotification(true);
    try {
      // Buscar todos os administradores
      const users = await User.list();
      const admins = users.filter(u => 
        u.role === 'admin' || (u.perfis && u.perfis.includes('administrador'))
      );

      if (admins.length === 0) {
        setAlertInfo({
          isOpen: true,
          type: 'warning',
          title: 'Sem Administradores',
          message: 'Não há administradores registados no sistema para notificar.'
        });
        return;
      }

      // Enviar email para cada administrador
      const emailPromises = admins.map(admin => 
        sendEmailDirect({
          to: admin.email,
          subject: `[DIROPS] ${voosNaLixeira.length} voos na lixeira`,
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #004A99; color: white; padding: 20px; text-align: center;">
                <h1>DIROPS - Notificação de Lixeira</h1>
              </div>
              
              <div style="padding: 20px; background-color: #f9f9f9;">
                <p style="font-size: 16px;">Olá <strong>${admin.full_name || admin.email}</strong>,</p>
                
                <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 18px; font-weight: bold; color: #92400E;">
                    <span style="font-size: 24px;">⚠️</span> ${voosNaLixeira.length} voos na lixeira
                  </p>
                </div>
                
                <p>Existem actualmente <strong>${voosNaLixeira.length} voos</strong> na lixeira do sistema que aguardam revisão.</p>
                
                <p>Como administrador, você pode:</p>
                <ul>
                  <li><strong>Restaurar</strong> voos movidos incorrectamente</li>
                  <li><strong>Excluir permanentemente</strong> voos que devem ser removidos</li>
                  <li><strong>Limpar toda a lixeira</strong> de uma só vez</li>
                </ul>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${window.location.origin}" 
                     style="background-color: #004A99; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Aceder ao Sistema
                  </a>
                </div>
                
                <p style="font-size: 12px; color: #666; margin-top: 30px;">
                  Esta é uma notificação automática do sistema DIROPS.<br>
                  Para gerir a lixeira, aceda à página de Operações e clique no botão "Lixeira".
                </p>
              </div>
            </div>
          `,
          from_name: 'DIROPS'
        })
      );

      await Promise.all(emailPromises);

      setSuccessInfo({
        isOpen: true,
        title: 'Notificações Enviadas',
        message: `${admins.length} administradores foram notificados sobre os itens na lixeira.`
      });
    } catch (error) {
      console.error("Erro ao notificar administradores:", error);
      setAlertInfo({
        isOpen: true,
        type: 'error',
        title: 'Erro ao Notificar',
        message: 'Não foi possível enviar as notificações aos administradores.'
      });
    } finally {
      setIsSendingNotification(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Trash2 className="w-6 h-6 text-yellow-600" />
              Lixeira de Voos
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {voosNaLixeira.length > 0 && (
              <div className="flex justify-between items-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="font-semibold text-yellow-900">
                      {voosNaLixeira.length} {voosNaLixeira.length === 1 ? 'voo' : 'voos'} na lixeira
                    </p>
                    <p className="text-sm text-yellow-700">
                      Estes voos podem ser restaurados ou excluídos permanentemente
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleNotificarAdministradores}
                    disabled={isSendingNotification}
                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    {isSendingNotification ? 'Enviando...' : 'Notificar Admins'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleLimparLixeira}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpar Lixeira
                  </Button>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-500">A carregar lixeira...</p>
              </div>
            ) : voosNaLixeira.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Trash2 className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">
                  Lixeira Vazia
                </h3>
                <p>Não há voos na lixeira no momento.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Voo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Rota</TableHead>
                      <TableHead>Companhia</TableHead>
                      <TableHead>Registo</TableHead>
                      <TableHead>Excluído Por</TableHead>
                      <TableHead>Excluído Em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {voosNaLixeira.map((voo) => {
                      const companhia = companhias.find(c => c.codigo_icao === voo.companhia_aerea);
                      const aeroportoOp = aeroportos.find(a => a.codigo_icao === voo.aeroporto_operacao);
                      const aeroportoOriDest = aeroportos.find(a => a.codigo_icao === voo.aeroporto_origem_destino);

                      return (
                        <TableRow key={voo.id}>
                          <TableCell>
                            <Badge className={voo.tipo_movimento === 'ARR' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                              {voo.tipo_movimento}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono font-semibold">{voo.numero_voo}</TableCell>
                          <TableCell>
                            {format(new Date(voo.data_operacao), 'dd/MM/yyyy', { locale: pt })}
                          </TableCell>
                          <TableCell className="text-sm">
                            {voo.tipo_movimento === 'ARR' 
                              ? `${voo.aeroporto_origem_destino} → ${voo.aeroporto_operacao}`
                              : `${voo.aeroporto_operacao} → ${voo.aeroporto_origem_destino}`
                            }
                          </TableCell>
                          <TableCell className="text-xs">
                            {companhia?.nome || voo.companhia_aerea}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{voo.registo_aeronave}</TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {voo.deleted_by || '-'}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {voo.deleted_at 
                              ? format(new Date(voo.deleted_at), 'dd/MM/yyyy HH:mm', { locale: pt })
                              : '-'
                            }
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRestoreInfo({ isOpen: true, id: voo.id })}
                                className="border-green-300 text-green-700 hover:bg-green-50"
                              >
                                <RotateCcw className="w-4 h-4 mr-1" />
                                Restaurar
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteInfo({ isOpen: true, id: voo.id })}
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Excluir
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertModal
        isOpen={restoreInfo.isOpen}
        onClose={() => setRestoreInfo({ isOpen: false, id: null })}
        onConfirm={handleRestoreConfirm}
        type="info"
        title="Restaurar Voo"
        message="Tem a certeza que deseja restaurar este voo? Ele voltará a aparecer na lista principal."
        confirmText="Restaurar"
        showCancel
      />

      <AlertModal
        isOpen={deleteInfo.isOpen}
        onClose={() => setDeleteInfo({ isOpen: false, id: null })}
        onConfirm={handleDeletePermanentConfirm}
        type="error"
        title="Excluir Permanentemente"
        message="ATENÇÃO: Esta acção é irreversível! O voo e todas as suas vinculações serão excluídos permanentemente do sistema. Tem a certeza?"
        confirmText="Excluir Permanentemente"
        showCancel
      />

      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ ...alertInfo, isOpen: false })}
        type={alertInfo.type}
        title={alertInfo.title}
        message={alertInfo.message}
        showCancel={alertInfo.showCancel}
        onConfirm={alertInfo.onConfirm}
        confirmText={alertInfo.confirmText}
      />

      <SuccessModal
        isOpen={successInfo.isOpen}
        onClose={() => setSuccessInfo({ ...successInfo, isOpen: false })}
        title={successInfo.title}
        message={successInfo.message}
      />
    </>
  );
}