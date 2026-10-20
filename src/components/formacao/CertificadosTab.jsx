import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Award, Download, ShieldCheck, Loader2, Clock, Compass } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { prepararCertParaPdf, getPublicBaseUrl } from '@/lib/certificadoEmissao';
import { fmtData, fmtHoras } from './formacaoUtils';

// Separador "Certificados": os emitidos (PDF + validação) e os cursos concluídos à espera de emissão.
export default function CertificadosTab({ certificados = [], pendentes = [], loading, onExplorar, onAbrirCurso }) {
  const { toast } = useToast();
  const [aGerar, setAGerar] = useState(null);

  const descarregar = async (cert) => {
    setAGerar(cert.id);
    try {
      const [{ gerarCertificadoPdf, nomeFicheiroCertificado }, input] = await Promise.all([import('@/lib/certificadoPdf'), prepararCertParaPdf(cert)]);
      const doc = await gerarCertificadoPdf(input);
      doc.save(nomeFicheiroCertificado(cert));
    } catch (e) {
      toast({ title: 'Não foi possível gerar o PDF', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setAGerar(null);
    }
  };

  const validar = async (cert) => {
    const base = await getPublicBaseUrl();
    window.open(`${base}/cert/${cert.token}`, '_blank', 'noopener');
  };

  if (loading) {
    return <div className="space-y-3">{[0, 1].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  if (certificados.length === 0 && pendentes.length === 0) {
    return (
      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/40">
            <Award className="h-7 w-7 text-amber-500" aria-hidden="true" />
          </div>
          <p className="font-medium text-slate-900 dark:text-slate-100">Ainda não tem certificados</p>
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">Conclua um curso para receber o seu certificado, com número único e QR de validação.</p>
          <Button variant="outline" onClick={onExplorar}><Compass className="h-4 w-4" aria-hidden="true" />Explorar o catálogo</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {certificados.length > 0 && (
        <section className="space-y-3" aria-label="Certificados emitidos">
          {certificados.map(cert => {
            const revogado = !!cert.revogado_em;
            return (
              <Card key={cert.id} className={`dark:border-slate-800 dark:bg-slate-900 ${revogado ? 'opacity-70' : ''}`}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40">
                    <Award className="h-6 w-6 text-amber-500" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{cert.curso_titulo}</p>
                      {revogado
                        ? <Badge variant="destructive">Revogado</Badge>
                        : <Badge className="bg-emerald-600 text-white hover:bg-emerald-600"><ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" />Válido</Badge>}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                      <span className="font-mono text-xs">{cert.numero}</span>
                      {' · '}Emitido em {fmtData(cert.emitido_em)}
                      {cert.carga_horaria ? ` · ${fmtHoras(cert.carga_horaria)}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => validar(cert)}>
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />Validar
                    </Button>
                    <Button size="sm" onClick={() => descarregar(cert)} disabled={aGerar === cert.id || revogado}>
                      {aGerar === cert.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      {pendentes.length > 0 && (
        <section className="space-y-3" aria-label="Certificados pendentes">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">A aguardar emissão</h3>
          {pendentes.map(({ matricula, curso }) => (
            <Card key={matricula.id} className="border-dashed dark:border-slate-800 dark:bg-slate-900">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  <Clock className="h-6 w-6 text-slate-400" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{curso?.titulo || 'Curso'}</p>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    Concluído em {fmtData(matricula.concluido_em)} · o certificado será emitido pela Gestão de Formação.
                  </p>
                </div>
                {curso && <Button variant="ghost" size="sm" onClick={() => onAbrirCurso(curso)}>Ver curso</Button>}
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
