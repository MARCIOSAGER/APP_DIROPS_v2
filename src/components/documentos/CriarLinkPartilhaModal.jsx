import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import { Link2, Copy, Check, Loader2, Mail, ExternalLink, Shield, AlertCircle } from 'lucide-react';

const OPCOES_VALIDADE = [
  { label: '24 horas', dias: 1 },
  { label: '7 dias', dias: 7, recomendado: true },
  { label: '30 dias', dias: 30 },
];

export default function CriarLinkPartilhaModal({ isOpen, onClose, documento }) {
  const [dias, setDias] = useState(7);
  const [password, setPassword] = useState('');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [linkCriado, setLinkCriado] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const podeCriar = documento && documento.nivel_confidencialidade !== 'secreto';

  const resetForm = () => {
    setDias(7); setPassword(''); setMaxDownloads('');
    setLinkCriado(null); setCopiado(false); setErro('');
  };

  const handleClose = () => { resetForm(); onClose(); };

  const criarLink = async () => {
    setLoading(true); setErro('');
    try {
      const { data, error } = await supabase.functions.invoke('share-link-create', {
        body: {
          documento_id: documento.id,
          dias_validade: dias,
          password: password || null,
          max_downloads: maxDownloads ? parseInt(maxDownloads, 10) : null,
        },
      });
      if (error) throw new Error(error.message || 'Falha ao criar link');
      if (data?.error) throw new Error(data.error);
      setLinkCriado(data);
    } catch (e) {
      setErro(e.message || 'Erro desconhecido ao criar link');
    } finally {
      setLoading(false);
    }
  };

  const copiar = () => {
    if (!linkCriado?.url) return;
    navigator.clipboard.writeText(linkCriado.url).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  };

  const enviarEmail = () => {
    if (!linkCriado?.url || !documento) return;
    const subject = encodeURIComponent(`Documento partilhado: ${documento.titulo}`);
    const body = encodeURIComponent(
      `Olá,\n\nO documento "${documento.titulo}" está disponível através do link abaixo:\n\n${linkCriado.url}\n\n` +
      `Este link expira em ${new Date(linkCriado.expira_em).toLocaleString('pt-PT')}.\n` +
      (linkCriado.tem_password ? '⚠️ Este link é protegido por password (partilhada em separado).\n' : '') +
      (linkCriado.max_downloads ? `Limite de ${linkCriado.max_downloads} acessos.\n` : '') +
      `\nSistema DIROPS-SGA`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-600" />
            Criar link partilhável
          </DialogTitle>
        </DialogHeader>

        {!podeCriar && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md flex gap-2 text-sm text-red-800">
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Documentos <strong>secretos</strong> não podem ter link partilhável externo.</span>
          </div>
        )}

        {podeCriar && !linkCriado && (
          <div className="space-y-4">
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-900">{documento?.titulo}</p>
              <p className="text-xs text-slate-500">Versão {documento?.versao || '—'} · {documento?.categoria || '—'}</p>
            </div>

            <div className="space-y-2">
              <Label>Validade</Label>
              <div className="grid grid-cols-3 gap-2">
                {OPCOES_VALIDADE.map((o) => (
                  <button
                    key={o.dias}
                    type="button"
                    onClick={() => setDias(o.dias)}
                    className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                      dias === o.dias
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {o.label}{o.recomendado ? ' ★' : ''}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">Máximo 30 dias. O link deixa de funcionar após expirar.</p>
            </div>

            <div className="space-y-2">
              <Label>Password (opcional)</Label>
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ex: uma frase curta que envias em separado"
              />
              <p className="text-xs text-slate-500">Se definida, quem abrir o link tem que introduzir esta password.</p>
            </div>

            <div className="space-y-2">
              <Label>Máximo de downloads (opcional)</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={maxDownloads}
                onChange={(e) => setMaxDownloads(e.target.value)}
                placeholder="Deixe vazio para ilimitado"
              />
              <p className="text-xs text-slate-500">O link é revogado automaticamente ao atingir este limite.</p>
            </div>

            {erro && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md flex gap-2 text-sm text-red-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{erro}</span>
              </div>
            )}
          </div>
        )}

        {linkCriado && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm font-medium text-green-900 flex items-center gap-2">
                <Check className="w-4 h-4" />
                Link criado com sucesso
              </p>
            </div>

            <div className="space-y-2">
              <Label>Link partilhável</Label>
              <div className="flex gap-2">
                <Input value={linkCriado.url} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copiar} title="Copiar">
                  {copiado ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <p>Expira: <span className="font-medium">{new Date(linkCriado.expira_em).toLocaleString('pt-PT')}</span></p>
              <p>{linkCriado.tem_password ? '🔒 Protegido por password' : '🔓 Sem password'}</p>
              <p>{linkCriado.max_downloads ? `📊 Máx ${linkCriado.max_downloads} downloads` : '♾️ Downloads ilimitados'}</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={enviarEmail} className="flex-1">
                <Mail className="w-4 h-4 mr-2" /> Enviar por email
              </Button>
              <Button variant="outline" onClick={() => window.open(linkCriado.url, '_blank')} className="flex-1">
                <ExternalLink className="w-4 h-4 mr-2" /> Abrir
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {!linkCriado ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>Cancelar</Button>
              <Button onClick={criarLink} disabled={!podeCriar || loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A criar...</> : 'Criar link'}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
