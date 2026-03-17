import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Info, ExternalLink, Calendar, CalendarDays, CalendarRange } from 'lucide-react';

const reports = [
  {
    id: 'diario',
    title: 'Voos Diários',
    description: 'Relatório de voos do dia de ontem',
    icon: Calendar,
    url: 'https://app.powerbi.com/view?r=eyJrIjoiODYzNTM5Y2UtZDdmNS00NzVjLTg1NDUtNmI0ZDc1YjEyYmQ1IiwidCI6IjYwMzA1NmIzLWZmNDItNDQ4Mi1iOWQzLWRjYmU5YjJkOTNiNiJ9'
  },
  {
    id: 'semanal',
    title: 'Voos Semanais',
    description: 'Relatório de voos da última semana',
    icon: CalendarDays,
    url: 'https://app.powerbi.com/view?r=eyJrIjoiYjc0NTQyOWQtNDk0Yy00NjRhLThlM2EtNzgwZmMzODg5N2RjIiwidCI6IjYwMzA1NmIzLWZmNDItNDQ4Mi1iOWQzLWRjYmU5YjJkOTNiNiJ9'
  },
  {
    id: 'mensal',
    title: 'Voos Mensais',
    description: 'Relatório de voos do mês passado',
    icon: CalendarRange,
    url: 'https://app.powerbi.com/view?r=eyJrIjoiODMwM2QyZGUtMTQxZC00NWY5LTlhYTItYWM0ZTBmOTFmNWIzIiwidCI6IjYwMzA1NmIzLWZmNDItNDQ4Mi1iOWQzLWRjYmU5YjJkOTNiNiJ9'
  }
];

export default function PowerBi() {
  const [activeTab, setActiveTab] = React.useState('diario');

  const handleOpenFullScreen = (url) => {
    window.open(url, '_blank');
  };

  const activeReport = reports.find(r => r.id === activeTab);

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-full mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">Análise Power BI</h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">Visualização de dados e relatórios interativos</p>
          </div>
          <Button 
            onClick={() => handleOpenFullScreen(activeReport.url)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Abrir em Ecrã Completo
          </Button>
        </div>

        <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Dica:</strong> Para exportar o relatório em PDF, clique no botão "Abrir em Ecrã Completo" e utilize as opções de exportação nativas do Power BI disponíveis no menu do relatório (ícone "..." no canto superior direito).
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            {reports.map(report => {
              const Icon = report.icon;
              return (
                <TabsTrigger key={report.id} value={report.id} className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {report.title}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {reports.map(report => {
            const Icon = report.icon;
            return (
              <TabsContent key={report.id} value={report.id}>
                <Card className="border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      {report.title}
                    </CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{report.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="relative w-full bg-white rounded-lg overflow-hidden" style={{ paddingBottom: '56.25%', height: 0 }}>
                      <iframe 
                        title={report.title}
                        width="100%" 
                        height="100%" 
                        src={`${report.url}&embedImagePlaceholder=true`}
                        frameBorder="0" 
                        allowFullScreen={true} 
                        className="absolute top-0 left-0"
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}