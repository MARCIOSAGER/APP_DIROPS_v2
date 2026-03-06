import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plane, Clock, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

const STATUS_CONFIG = {
  programado: { color: 'bg-blue-100 text-blue-800 border-blue-200' },
  confirmado: { color: 'bg-green-100 text-green-800 border-green-200' },
  cancelado: { color: 'bg-red-100 text-red-800 border-red-200' },
  atrasado: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  realizado: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
};

export default function RecentFlights({ voos, isLoading }) {
  const recentFlights = voos
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 8);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-2 h-6 bg-blue-600 rounded-full" />
          Voos Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        ) : recentFlights.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
            <Plane className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>Nenhum voo registrado recentemente</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200">
                  <TableHead className="text-slate-600">Voo</TableHead>
                  <TableHead className="text-slate-600">Rota</TableHead>
                  <TableHead className="text-slate-600">Horário</TableHead>
                  <TableHead className="text-slate-600">Status</TableHead>
                  <TableHead className="text-slate-600">PAX</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentFlights.map((voo) => {
                  const statusConfig = STATUS_CONFIG[voo.status] || STATUS_CONFIG.programado;
                  
                  return (
                    <TableRow key={voo.id} className="border-slate-200 hover:bg-slate-50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            voo.tipo_movimento === 'ARR' ? 'bg-blue-50' : 'bg-green-50'
                          }`}>
                            <Plane className={`h-4 w-4 ${
                              voo.tipo_movimento === 'ARR' ? 'text-blue-600 transform rotate-180' : 'text-green-600'
                            }`} />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{voo.numero_voo}</p>
                            <p className="text-sm text-slate-500">{voo.companhia_aerea}</p>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <span className="font-medium">
                            {voo.tipo_movimento === 'ARR' ? voo.aeroporto_origem : voo.aeroporto_operacao}
                          </span>
                          <MapPin className="h-3 w-3 text-slate-400" />
                          <span className="font-medium">
                            {voo.tipo_movimento === 'ARR' ? voo.aeroporto_operacao : voo.aeroporto_destino}
                          </span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span className="text-sm font-medium">
                            {voo.horario_real || voo.horario_previsto}
                          </span>
                          {voo.horario_real && voo.horario_real !== voo.horario_previsto && (
                            <span className="text-xs text-slate-500 line-through ml-1">
                              {voo.horario_previsto}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {format(parseISO(voo.data_operacao), 'dd/MM', { locale: pt })}
                        </p>
                      </TableCell>
                      
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`${statusConfig.color} border text-xs`}
                        >
                          {voo.status}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          {voo.tipo_movimento === 'ARR' 
                            ? voo.passageiros_desembarcados || 0
                            : voo.passageiros_embarcados || 0
                          }
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}