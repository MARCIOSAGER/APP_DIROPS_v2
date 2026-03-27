import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Mail,
  XCircle,
  CheckCircle,
} from 'lucide-react';
import { useI18n } from '@/components/lib/i18n';

const PERFIL_LABELS = {
  administrador: 'Administrador',
  operacoes: 'Operações',
  safety: 'Safety',
  infraestrutura: 'Infraestrutura',
  credenciamento: 'Credenciamento',
  gestor_empresa: 'Gestor de Empresa',
  visualizador: 'Visualizador'
};

export default function SolicitacoesTab({
  solicitacoesPendentes,
  isLoading,
  getEmpresaNome,
  onAprovar,
  onRejeitar,
  onExcluir,
}) {
  const { t } = useI18n();

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>{t('acessos.novosPedidos')}</CardTitle>
        <CardDescription>{t('acessos.novosPedidosDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('acessos.solicitante')}</TableHead>
                <TableHead>{t('acessos.perfilSolicitado')}</TableHead>
                <TableHead>{t('acessos.empresa')}</TableHead>
                <TableHead>{t('acessos.data')}</TableHead>
                <TableHead className="text-right">{t('acessos.acoes')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                    <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                    <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                    <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                    <TableCell><div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div></TableCell>
                  </TableRow>
                ))
              ) : solicitacoesPendentes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    <Mail className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <p className="text-lg font-medium">{t('acessos.nenhumResultado')}</p>
                    <p className="text-sm mt-1">{t('acessos.semSolicitacoes')}</p>
                  </TableCell>
                </TableRow>
              ) : solicitacoesPendentes.map((solicitacao) => (
                <TableRow key={solicitacao.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{solicitacao.nome_completo}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{solicitacao.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {PERFIL_LABELS[solicitacao.perfil_solicitado] || solicitacao.perfil_solicitado}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {solicitacao.empresa_solicitante_id ? getEmpresaNome(solicitacao.empresa_solicitante_id) : 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(solicitacao.created_date).toLocaleDateString('pt-AO')}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onExcluir(solicitacao)}
                      className="text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      {t('acessos.excluir')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRejeitar(solicitacao)}
                      className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      {t('acessos.rejeitar')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onAprovar(solicitacao)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {t('acessos.aprovar')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
