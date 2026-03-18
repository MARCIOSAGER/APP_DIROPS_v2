import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, CheckCircle, Ticket } from "lucide-react";
import Select from "@/components/ui/select";
import { enviarTicketSuporte } from "@/functions/enviarTicketSuporte";
import useSubmitGuard from "@/hooks/useSubmitGuard";
import { useI18n } from '@/components/lib/i18n';

const categorias = [
  { value: "", label: "Selecione (opcional)" },
  { value: "bug", label: "Bug / Erro no sistema" },
  { value: "duvida", label: "Dúvida sobre funcionalidade" },
  { value: "sugestao", label: "Sugestão de melhoria" },
  { value: "acesso", label: "Problema de acesso" },
  { value: "outro", label: "Outro" },
];

export default function Suporte() {
  const { t } = useI18n();
  const [assunto, setAssunto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(null);
  const [erro, setErro] = useState(null);
  const { guardedSubmit } = useSubmitGuard();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (assunto.length < 5 || mensagem.length < 10) return;

    guardedSubmit(async () => {
    setEnviando(true);
    setErro(null);
    try {
      const res = await enviarTicketSuporte({ assunto, categoria, mensagem });
      setSucesso(res.data?.numero_ticket);
    } catch (err) {
      setErro("Erro ao enviar o ticket. Tente novamente.");
    } finally {
      setEnviando(false);
    }
    });
  };

  const handleNovo = () => {
    setSucesso(null);
    setAssunto("");
    setCategoria("");
    setMensagem("");
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            {t('page.suporte.title')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {t('page.suporte.subtitle')}
          </p>
        </div>
      </div>

      {sucesso ? (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">Ticket enviado com sucesso!</h2>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Ticket className="w-5 h-5 text-green-700" />
              <Badge className="bg-green-700 text-white text-base px-4 py-1">{sucesso}</Badge>
            </div>
            <p className="text-green-700 dark:text-green-300 text-sm mb-6">
              Guarde este número para acompanhar o seu pedido.<br />
              Receberá uma confirmação por email.
            </p>
            <Button onClick={handleNovo} variant="outline" className="border-green-600 text-green-700 hover:bg-green-100">
              Abrir Novo Ticket
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-slate-700 dark:text-slate-300">Novo Ticket de Suporte</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Assunto <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Resumo do seu problema ou dúvida"
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                  minLength={5}
                  required
                />
                {assunto.length > 0 && assunto.length < 5 && (
                  <p className="text-xs text-slate-400 mt-1">Mínimo 5 caracteres</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                <Select
                  options={categorias}
                  value={categoria}
                  onValueChange={setCategoria}
                  placeholder="Selecione (opcional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mensagem <span className="text-red-500">*</span>
                </label>
                <Textarea
                  placeholder="Descreva seu problema ou dúvida com o máximo de detalhes possível..."
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  className="min-h-[140px] resize-y"
                  required
                />
                {mensagem.length > 0 && mensagem.length < 10 && (
                  <p className="text-xs text-slate-400 mt-1">Mínimo 10 caracteres</p>
                )}
              </div>

              {erro && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded px-3 py-2">{erro}</p>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={enviando || assunto.length < 5 || mensagem.length < 10}
                  className="bg-slate-800 hover:bg-slate-900 text-white"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {enviando ? "A enviar..." : "Enviar Ticket"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}