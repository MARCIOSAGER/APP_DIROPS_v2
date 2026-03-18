import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/lib/i18n';

export default function PoliticaPrivacidade() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" className="mb-6 text-slate-600 dark:text-slate-400" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('politica.voltar')}
        </Button>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('politica.titulo')}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">{t('politica.ultimaAtualizacao')}</p>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-4 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('politica.sec1Titulo')}</h2>
            <p>
              {t('politica.sec1Corpo')}
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>{t('politica.sec1Item1')}</li>
              <li>{t('politica.sec1Item2')}</li>
              <li>{t('politica.sec1Item3')}</li>
              <li>{t('politica.sec1Item4')}</li>
              <li>{t('politica.sec1Item5')}</li>
            </ul>

            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('politica.sec2Titulo')}</h2>
            <p>{t('politica.sec2Corpo')}</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>{t('politica.sec2Item1')}</li>
              <li>{t('politica.sec2Item2')}</li>
              <li>{t('politica.sec2Item3')}</li>
              <li>{t('politica.sec2Item4')}</li>
              <li>{t('politica.sec2Item5')}</li>
            </ul>

            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('politica.sec3Titulo')}</h2>
            <p>
              {t('politica.sec3Corpo')}
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>{t('politica.sec3Item1')}</li>
              <li>{t('politica.sec3Item2')}</li>
              <li>{t('politica.sec3Item3')}</li>
            </ul>

            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('politica.sec4Titulo')}</h2>
            <p>
              {t('politica.sec4Corpo')}
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>{t('politica.sec4Item1')}</li>
              <li>{t('politica.sec4Item2')}</li>
              <li>{t('politica.sec4Item3')}</li>
              <li>{t('politica.sec4Item4')}</li>
              <li>{t('politica.sec4Item5')}</li>
            </ul>

            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('politica.sec5Titulo')}</h2>
            <p>
              {t('politica.sec5Corpo')}
            </p>

            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('politica.sec6Titulo')}</h2>
            <p>{t('politica.sec6Corpo')}</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>{t('politica.sec6Item1')}</li>
              <li>{t('politica.sec6Item2')}</li>
              <li>{t('politica.sec6Item3')}</li>
              <li>{t('politica.sec6Item4')}</li>
            </ul>

            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('politica.sec7Titulo')}</h2>
            <p>
              {t('politica.sec7Corpo')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
