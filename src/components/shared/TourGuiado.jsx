import { useState, useEffect, useRef } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from '@/components/lib/i18n';

const TOUR_STEP_KEYS = [
  { titleKey: 'shared.tour.bemvindo_titulo', descKey: 'shared.tour.bemvindo_desc', target: null, position: "center" },
  { titleKey: 'shared.tour.menu_titulo', descKey: 'shared.tour.menu_desc', target: "nav", position: "right" },
  { titleKey: 'shared.tour.dashboard_titulo', descKey: 'shared.tour.dashboard_desc', target: "[data-tour='dashboard']", position: "bottom" },
  { titleKey: 'shared.tour.filtros_titulo', descKey: 'shared.tour.filtros_desc', target: "[data-tour='filters']", position: "bottom" },
  { titleKey: 'shared.tour.stats_titulo', descKey: 'shared.tour.stats_desc', target: "[data-tour='stats']", position: "bottom" },
  { titleKey: 'shared.tour.operacoes_titulo', descKey: 'shared.tour.operacoes_desc', target: null, position: "center" },
  { titleKey: 'shared.tour.safety_titulo', descKey: 'shared.tour.safety_desc', target: null, position: "center" },
  { titleKey: 'shared.tour.auditoria_titulo', descKey: 'shared.tour.auditoria_desc', target: null, position: "center" },
  { titleKey: 'shared.tour.manutencao_titulo', descKey: 'shared.tour.manutencao_desc', target: null, position: "center" },
  { titleKey: 'shared.tour.servicos_titulo', descKey: 'shared.tour.servicos_desc', target: null, position: "center" },
  { titleKey: 'shared.tour.notificacoes_titulo', descKey: 'shared.tour.notificacoes_desc', target: null, position: "center" },
  { titleKey: 'shared.tour.assistente_titulo', descKey: 'shared.tour.assistente_desc', target: "[data-tour='chatbot']", position: "top-left" },
  { titleKey: 'shared.tour.concluido_titulo', descKey: 'shared.tour.concluido_desc', target: null, position: "center" },
];

export default function TourGuiado({ onClose }) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: "50%", left: "50%" });
  const tooltipRef = useRef(null);
  const { t } = useI18n();

  const current = TOUR_STEP_KEYS[step];
  const totalSteps = TOUR_STEP_KEYS.length;

  useEffect(() => {
    if (current.target) {
      const el = document.querySelector(current.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        el.scrollIntoView({ behavior: "smooth", block: "center" });

        setTimeout(() => {
          const tip = tooltipRef.current;
          if (!tip) return;
          const tipH = tip.offsetHeight || 200;
          const tipW = tip.offsetWidth || 320;

          let top, left;
          if (current.position === "bottom") {
            top = rect.bottom + window.scrollY + 16;
            left = rect.left + rect.width / 2 - tipW / 2;
          } else if (current.position === "right") {
            top = rect.top + window.scrollY + rect.height / 2 - tipH / 2;
            left = rect.right + 16;
          } else if (current.position === "top-left") {
            top = rect.top + window.scrollY - tipH - 16;
            left = rect.left - tipW - 16;
          } else {
            top = window.innerHeight / 2 - tipH / 2 + window.scrollY;
            left = window.innerWidth / 2 - tipW / 2;
          }

          // Clamp to viewport
          left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
          top = Math.max(8, top);

          setTooltipPos({ top: `${top}px`, left: `${left}px` });
        }, 100);
      } else {
        setTargetRect(null);
        setTooltipPos({
          top: `${window.innerHeight / 2 - 100 + window.scrollY}px`,
          left: `${window.innerWidth / 2 - 160}px`,
        });
      }
    } else {
      setTargetRect(null);
      setTooltipPos({
        top: `${window.innerHeight / 2 - 100 + window.scrollY}px`,
        left: `${window.innerWidth / 2 - 160}px`,
      });
    }
  }, [step, current]);

  const next = () => {
    if (step < totalSteps - 1) setStep(step + 1);
    else onClose();
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[9998] pointer-events-none" style={{ background: "rgba(0,0,0,0.5)" }}>
        {/* Highlight cutout */}
        {targetRect && (
          <div
            style={{
              position: "absolute",
              top: targetRect.top + window.scrollY - 6,
              left: targetRect.left - 6,
              width: targetRect.width + 12,
              height: targetRect.height + 12,
              borderRadius: "12px",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
              border: "2px solid #3b82f6",
              background: "transparent",
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[9999] w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-1.5">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
              {t('shared.tour.passo')} {step + 1} {t('shared.tour.de')} {totalSteps}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-4">
          <div
            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>

        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base mb-2">{t(current.titleKey)}</h3>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-5">{t(current.descKey)}</p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {t('shared.tour.saltar')}
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={prev} className="h-8 px-3 text-xs">
                <ChevronLeft className="w-3 h-3 mr-1" />
                {t('shared.tour.anterior')}
              </Button>
            )}
            <Button size="sm" onClick={next} className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              {step === totalSteps - 1 ? t('shared.tour.concluir') : t('shared.tour.proximo')}
              {step < totalSteps - 1 && <ChevronRight className="w-3 h-3 ml-1" />}
            </Button>
          </div>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1 mt-4">
          {TOUR_STEP_KEYS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`rounded-full transition-all duration-200 ${
                i === step ? "bg-blue-600 w-4 h-1.5" : "bg-slate-200 dark:bg-slate-700 w-1.5 h-1.5"
              }`}
            />
          ))}
        </div>
      </div>
    </>
  );
}
