import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chatbotIA } from "@/functions/chatbotIA";
import { enviarTicketSuporte } from "@/functions/enviarTicketSuporte";

const TICKET_DATA_PREFIX = "TICKET_DATA:";

export default function ChatbotIA({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Olá! Sou o **SIGA**, o assistente virtual do DIROPS-SGA. 👋\n\nPosso ajudar-te com dúvidas sobre o sistema ou abrir um ticket de suporte. Como posso ajudar?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ticketPending, setTicketPending] = useState(null);
  const [ticketSuccess, setTicketSuccess] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await chatbotIA({ messages: newMessages });
      const reply = res.data?.reply || "Desculpa, não consegui processar a tua mensagem.";

      // Check if reply contains ticket data
      if (reply.includes(TICKET_DATA_PREFIX)) {
        const parts = reply.split(TICKET_DATA_PREFIX);
        const visibleText = parts[0].trim();
        const jsonStr = parts[1]?.trim();

        let ticketData = null;
        try { ticketData = JSON.parse(jsonStr); } catch {}

        if (ticketData) {
          setTicketPending(ticketData);
          setMessages(prev => [...prev, {
            role: "assistant",
            content: visibleText || "Vou abrir um ticket com as seguintes informações:"
          }]);
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: reply }]);
        }
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erro ao comunicar com o assistente. Tente novamente." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!ticketPending) return;
    setIsLoading(true);
    try {
      const res = await enviarTicketSuporte({
        assunto: ticketPending.assunto,
        categoria: ticketPending.categoria || "outro",
        mensagem: ticketPending.mensagem,
      });
      const numero = res.data?.numero_ticket || "N/A";
      setTicketSuccess(numero);
      setTicketPending(null);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `✅ Ticket **${numero}** criado com sucesso! A nossa equipa irá analisar e responder brevemente. Posso ajudar com mais alguma coisa?`
      }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erro ao criar o ticket. Por favor tenta mais tarde ou vai à página de Suporte." }]);
      setTicketPending(null);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = (content) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition-all duration-200"
        title="Assistente Virtual SIGA"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-36 right-4 lg:bottom-24 lg:right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" style={{ maxHeight: '500px' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 to-blue-600 text-white px-4 py-3 flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-1.5">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">SIGA – Assistente Virtual</div>
              <div className="text-xs text-blue-100">DIROPS-SGA • Online</div>
            </div>
            <button onClick={() => setIsOpen(false)} className="ml-auto hover:bg-white/20 rounded-full p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ minHeight: '280px', maxHeight: '320px' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="bg-blue-100 rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-blue-700" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                  }`}
                  dangerouslySetInnerHTML={{ __html: renderMessage(msg.content) }}
                />
                {msg.role === 'user' && (
                  <div className="bg-slate-200 rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4 text-slate-600" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="bg-blue-100 rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-blue-700" />
                </div>
                <div className="bg-slate-100 px-3 py-2 rounded-2xl rounded-tl-sm">
                  <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                </div>
              </div>
            )}

            {/* Ticket confirmation card */}
            {ticketPending && !isLoading && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm space-y-2">
                <div className="flex items-center gap-2 text-amber-700 font-semibold">
                  <AlertCircle className="w-4 h-4" />
                  Confirmar Ticket de Suporte
                </div>
                <div className="text-slate-700 space-y-1">
                  <p><strong>Assunto:</strong> {ticketPending.assunto}</p>
                  <p><strong>Categoria:</strong> {ticketPending.categoria}</p>
                  <p><strong>Mensagem:</strong> {ticketPending.mensagem}</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs" onClick={handleCreateTicket}>
                    Criar Ticket
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setTicketPending(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Escreve a tua mensagem..."
              className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl px-3 flex items-center justify-center transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}