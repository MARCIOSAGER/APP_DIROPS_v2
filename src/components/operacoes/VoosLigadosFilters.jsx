import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Search, Filter, X } from 'lucide-react';
import Combobox from '@/components/ui/combobox';
import AeroportoMultiSelect from '@/components/ui/aeroporto-multi-select';

export default function VoosLigadosFilters({ filtros, onFilterChange, onClearFilters, companhias, aeroportos }) {
  const hasActiveFilters = 
    filtros.dataInicio !== '' || 
    filtros.dataFim !== '' || 
    filtros.companhia !== 'todos' || 
    (Array.isArray(filtros.aeroportos) && filtros.aeroportos.length > 0) ||
    filtros.tipoVoo !== 'todos' ||
    filtros.statusCalculo !== 'todos' ||
    filtros.permanenciaMin !== '' ||
    filtros.permanenciaMax !== '' ||
    filtros.busca !== '';

  const companhiaOptions = [
    { value: 'todos', label: 'Todas as Companhias' },
    ...companhias.map(c => ({ value: c.codigo_icao, label: `${c.nome} (${c.codigo_icao})` }))
  ];

  const aeroportoOptions = [
    { value: 'todos', label: 'Todos os Aeroportos' },
    ...aeroportos.map(a => ({ value: a.codigo_icao, label: `${a.nome} (${a.codigo_icao})` }))
  ];

  const tipoVooOptions = [
    { value: 'todos', label: 'Todos os Tipos' },
    { value: 'Regular', label: 'Regular' },
    { value: 'Não Regular', label: 'Não Regular' },
    { value: 'Humanitário', label: 'Humanitário' },
    { value: 'Charter', label: 'Charter' },
    { value: 'Carga', label: 'Carga' },
    { value: 'Privado', label: 'Privado' },
    { value: 'Militar', label: 'Militar' },
    { value: 'Oficial', label: 'Oficial' },
    { value: 'Técnico', label: 'Técnico' },
    { value: 'Outro', label: 'Outro' }
  ];

  const statusCalculoOptions = [
    { value: 'todos', label: 'Todos os Status' },
    { value: 'com_calculo', label: 'Com Cálculo' },
    { value: 'sem_calculo', label: 'Sem Cálculo' },
    { value: 'isento', label: 'Isento' },
    { value: 'zerado', label: 'Voos com 0,00 Kz' }
  ];

  return (
    <Card className="mb-6 border-slate-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-500" />
            Filtros de Voos Ligados
          </CardTitle>
          {hasActiveFilters && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClearFilters}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <X className="w-4 h-4 mr-1" />
              Limpar Filtros
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Busca */}
          <div className="lg:col-span-4">
            <Label htmlFor="busca-ligados">Pesquisar por Voo ou Registo</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                id="busca-ligados"
                placeholder="Ex: TP1530, DT461, D2-EUA..."
                value={filtros.busca}
                onChange={(e) => onFilterChange('busca', e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Período */}
          <div>
            <Label htmlFor="data-inicio-ligados">Data Início</Label>
            <Input 
              id="data-inicio-ligados"
              type="date" 
              value={filtros.dataInicio} 
              onChange={(e) => onFilterChange('dataInicio', e.target.value)} 
            />
          </div>
          <div>
            <Label htmlFor="data-fim-ligados">Data Fim</Label>
            <Input 
              id="data-fim-ligados"
              type="date" 
              value={filtros.dataFim} 
              onChange={(e) => onFilterChange('dataFim', e.target.value)} 
            />
          </div>

          {/* Aeroportos com Multi-Select */}
          <div className="lg:col-span-2">
            <Label htmlFor="filtro-aeroportos-ligados">Aeroportos (SGA)</Label>
            <AeroportoMultiSelect
              aeroportos={aeroportos.filter(a => a.isSGA === true)}
              values={Array.isArray(filtros.aeroportos) ? filtros.aeroportos : []}
              onValuesChange={(v) => onFilterChange('aeroportos', v)}
              placeholder="Selecionar aeroportos..."
              maxItems={23}
            />
          </div>

          {/* Companhia com Combobox */}
          <div>
            <Label htmlFor="filtro-companhia-ligados">Companhia</Label>
            <Combobox
              options={companhiaOptions}
              value={filtros.companhia}
              onValueChange={(v) => onFilterChange('companhia', v)}
              placeholder="Pesquisar companhia..."
              searchPlaceholder="Pesquisar..."
            />
          </div>

          {/* Tipo de Voo com Combobox */}
          <div>
            <Label htmlFor="filtro-tipo-voo-ligados">Tipo de Voo</Label>
            <Combobox
              options={tipoVooOptions}
              value={filtros.tipoVoo}
              onValueChange={(v) => onFilterChange('tipoVoo', v)}
              placeholder="Pesquisar tipo..."
              searchPlaceholder="Pesquisar..."
            />
          </div>

          {/* Status de Cálculo com Combobox */}
          <div>
            <Label htmlFor="filtro-status-calculo">Status de Cálculo</Label>
            <Combobox
              options={statusCalculoOptions}
              value={filtros.statusCalculo}
              onValueChange={(v) => onFilterChange('statusCalculo', v)}
              placeholder="Pesquisar status..."
              searchPlaceholder="Pesquisar..."
            />
          </div>

          {/* Permanência Mínima */}
          <div>
            <Label htmlFor="permanencia-min">Permanência Mín. (horas)</Label>
            <Input
              id="permanencia-min"
              type="number"
              step="0.5"
              min="0"
              placeholder="Ex: 2"
              value={filtros.permanenciaMin}
              onChange={(e) => onFilterChange('permanenciaMin', e.target.value)}
            />
          </div>

          {/* Permanência Máxima */}
          <div>
            <Label htmlFor="permanencia-max">Permanência Máx. (horas)</Label>
            <Input
              id="permanencia-max"
              type="number"
              step="0.5"
              min="0"
              placeholder="Ex: 24"
              value={filtros.permanenciaMax}
              onChange={(e) => onFilterChange('permanenciaMax', e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}