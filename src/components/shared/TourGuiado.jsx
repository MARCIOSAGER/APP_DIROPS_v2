import React, { useState, useEffect, useRef } from "react";
import { X, ChevronRight, ChevronLeft, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOUR_STEPS = [
  {
    title: "Bem-vindo ao DIROPS! 🎉",
    description: "Este é o sistema de gestão operacional aeroportuária DIROPS. Vamos fazer um tour rápido pelas principais funcionalidades. Clica em 'Próximo' para começar.",
    target: null,
    position: "center",
  },
  {
    title: "Menu de Navegação",
    description: "No painel lateral encontras todos os módulos do sistema. Cada secção dá acesso a funcionalidades específicas conforme o teu perfil de acesso.",
    target: "nav",
    position: "right",
  },
  {
    title: "Dashboard Principal",
    description: "O Dashboard mostra uma visão geral das operações: movimentos de voos, alertas de safety, receitas e desempenho dos aeroportos em tempo real.",
    target: "[data-tour='dashboard']",
    position: "bottom",
  },
  {
    title: "Filtros de Período e Aeroporto",
    description: "Usa estes filtros para selecionar o aeroporto e período que queres analisar. Os dados do dashboard atualizam automaticamente.",
    target: "[data-tour='filters']",
    position: "bottom",
  },
  {
    title: "Estatísticas Operacionais",
    description: "Aqui vês os totais de voos, chegadas, partidas, passageiros e alertas abertos para o período selecionado.",
    target: "[data-tour='stats']",
    position: "bottom",
  },
  {
    title: "Módulo de Operações",
    description: "Em 'Operações' geres todos os voos ARR/DEP, voos ligados, cálculo de tarifas aeroportuárias e faturação. Também podes importar voos do Flightradar24.",
    target: null,
    position: "center",
  },
  {
    title: "Safety e Inspeções",
    description: "Regista ocorrências de safety (FOD, incursões de pista, bird strike) e realiza inspeções com checklists. Itens não conformes geram automaticamente Solicitações de Serviço (SS) na Manutenção.",
    target: null,
    position: "center",
  },
  {
    title: "Auditoria Interna",
    description: "Cria processos de auditoria com checklists e Planos de Ação Corretiva (PAC). Não conformidades na auditoria também geram SS automáticas na Manutenção.",
    target: null,
    position: "center",
  },
  {
    title: "Manutenção (SS → OS)",
    description: "O módulo de Manutenção recebe Solicitações de Serviço (SS) — criadas manualmente ou via inspeções/auditorias. A equipa de infraestrutura analisa cada SS e, se aprovada, gera uma Ordem de Serviço (OS) para execução interna ou terceirizada.",
    target: null,
    position: "center",
  },
  {
    title: "Serviços Aeroportuários",
    description: "Em 'Serviços Aeroportuários' podes lançar cobranças de serviços adicionais por voo (check-in, CUPPSS, fast track) e registar cobranças de bombeiros, cursos e licenças associadas a clientes.",
    target: null,
    position: "center",
  },
  {
    title: "Notificações Automáticas",
    description: "O sistema envia notificações automáticas por WhatsApp e email para os utilizadores conforme as regras configuradas — alertas de voos, relatórios diários/semanais/mensais.",
    target: null,
    position: "center",
  },
  {
    title: "Assistente Virtual",
    description: "O botão azul no canto inferior direito é o teu assistente virtual! Podes fazer perguntas sobre o sistema ou pedir ajuda para abrir tickets de suporte.",
    target: "[data-tour='chatbot']",
    position: "top-left",
  },
  {
    title: "Tour Concluído! 🚀",
    description: "Já conheces as principais funcionalidades do DIROPS. Se precisares de ajuda, usa o Assistente Virtual ou a página de Suporte. Bom trabalho!",
    target: null,
    position: "center",
  },
];

export default function TourGuiado({ onClose }) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: "50%", left: "50%" });
  const tooltipRef = useRef(null);

  const current = TOUR_STEPS[step];

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
    if (step < TOUR_STEPS.length - 1) setStep(step + 1);
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
              Passo {step + 1} de {TOUR_STEPS.length}
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
            style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base mb-2">{current.title}</h3>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-5">{current.description}</p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            Saltar tour
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={prev} className="h-8 px-3 text-xs">
                <ChevronLeft className="w-3 h-3 mr-1" />
                Anterior
              </Button>
            )}
            <Button size="sm" onClick={next} className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              {step === TOUR_STEPS.length - 1 ? "Concluir" : "Próximo"}
              {step < TOUR_STEPS.length - 1 && <ChevronRight className="w-3 h-3 ml-1" />}
            </Button>
          </div>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1 mt-4">
          {TOUR_STEPS.map((_, i) => (
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