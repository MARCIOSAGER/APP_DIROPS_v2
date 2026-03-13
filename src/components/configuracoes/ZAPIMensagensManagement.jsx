import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  MessageSquare, 
  Image as ImageIcon, 
  FileText, 
  Mic, 
  Video,
  MapPin,
  User,
  Eye,
  Trash2,
  X,
  Send,
  Upload,
  Smile,
  Gift,
  Link as LinkIcon,
  ShoppingCart,
  BookOpen,
  Users,
  MessageCircle,
  Play,
  Share2,
  Calendar,
  Edit,
  Reply,
  UserPlus,
  ShoppingBag,
  Receipt,
  CreditCard,
  Pin,
  Menu
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ZAPIMensagensManagement({ onError, onSuccess }) {
  const [showModal, setShowModal] = useState(null);
  const [isSending, setIsSending] = useState(false);
  
  // Estados para cada tipo de mensagem
  const [textoSimples, setTextoSimples] = useState({ to: '', body: '' });
  const [imagemData, setImagemData] = useState({ to: '', image: '', caption: '' });
  const [documentoData, setDocumentoData] = useState({ to: '', document: '', filename: '' });
  const [audioData, setAudioData] = useState({ to: '', audio: '' });
  const [videoData, setVideoData] = useState({ to: '', video: '', caption: '' });
  const [localizacaoData, setLocalizacaoData] = useState({ to: '', latitude: '', longitude: '', name: '', address: '' });
  const [contatoData, setContatoData] = useState({ to: '', contactName: '', contactPhone: '' });
  const [stickerData, setStickerData] = useState({ to: '', sticker: '' });
  const [gifData, setGifData] = useState({ to: '', gif: '' });
  const [ptvData, setPtvData] = useState({ to: '', video: '' });
  const [linkData, setLinkData] = useState({ to: '', link: '' });
  const [produtoData, setProdutoData] = useState({ to: '', productId: '' });
  const [catalogoData, setCatalogoData] = useState({ to: '', catalogId: '' });

  const handleEnviarTextoSimples = async () => {
    if (!textoSimples.to || !textoSimples.body) {
      onError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setIsSending(true);
    try {
      const response = await base44.functions.invoke('sendWhatsAppMessageZAPI', {
        to: textoSimples.to,
        body: textoSimples.body
      });

      if (response.data) {
        onSuccess('Mensagem de texto enviada com sucesso!');
        setShowModal(null);
        setTextoSimples({ to: '', body: '' });
      }
    } catch (error) {
      console.error('Erro ao enviar texto:', error);
      onError(error.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setIsSending(false);
    }
  };

  const renderModal = () => {
    switch (showModal) {
      case 'texto':
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-slate-900">Enviar Texto Simples</h3>
                <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label>Número do Destinatário *</Label>
                  <Input
                    value={textoSimples.to}
                    onChange={(e) => setTextoSimples({ ...textoSimples, to: e.target.value })}
                    placeholder="+244XXXXXXXXX"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Mensagem *</Label>
                  <Textarea
                    value={textoSimples.body}
                    onChange={(e) => setTextoSimples({ ...textoSimples, body: e.target.value })}
                    placeholder="Digite sua mensagem..."
                    className="mt-1 h-32"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setShowModal(null)} variant="outline" className="flex-1">
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleEnviarTextoSimples} 
                    disabled={isSending}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isSending ? 'A enviar...' : 'Enviar'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'imagem':
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-slate-900">Enviar Imagem</h3>
                <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label>Número do Destinatário *</Label>
                  <Input
                    value={imagemData.to}
                    onChange={(e) => setImagemData({ ...imagemData, to: e.target.value })}
                    placeholder="+244XXXXXXXXX"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>URL da Imagem *</Label>
                  <Input
                    value={imagemData.image}
                    onChange={(e) => setImagemData({ ...imagemData, image: e.target.value })}
                    placeholder="https://example.com/imagem.jpg"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Legenda (Opcional)</Label>
                  <Textarea
                    value={imagemData.caption}
                    onChange={(e) => setImagemData({ ...imagemData, caption: e.target.value })}
                    placeholder="Adicione uma legenda..."
                    className="mt-1 h-20"
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded p-3">
                  <p className="text-xs text-amber-800">
                    <strong>Nota:</strong> Funcionalidade em desenvolvimento. Em breve disponível.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setShowModal(null)} variant="outline" className="flex-1">
                    Cancelar
                  </Button>
                  <Button disabled className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                    Em breve
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'documento':
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-slate-900">Enviar Documento</h3>
                <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label>Número do Destinatário *</Label>
                  <Input
                    value={documentoData.to}
                    onChange={(e) => setDocumentoData({ ...documentoData, to: e.target.value })}
                    placeholder="+244XXXXXXXXX"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>URL do Documento *</Label>
                  <Input
                    value={documentoData.document}
                    onChange={(e) => setDocumentoData({ ...documentoData, document: e.target.value })}
                    placeholder="https://example.com/documento.pdf"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Nome do Arquivo</Label>
                  <Input
                    value={documentoData.filename}
                    onChange={(e) => setDocumentoData({ ...documentoData, filename: e.target.value })}
                    placeholder="documento.pdf"
                    className="mt-1"
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded p-3">
                  <p className="text-xs text-amber-800">
                    <strong>Nota:</strong> Funcionalidade em desenvolvimento. Em breve disponível.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setShowModal(null)} variant="outline" className="flex-1">
                    Cancelar
                  </Button>
                  <Button disabled className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                    Em breve
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'audio':
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-slate-900">Enviar Áudio</h3>
                <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label>Número do Destinatário *</Label>
                  <Input
                    value={audioData.to}
                    onChange={(e) => setAudioData({ ...audioData, to: e.target.value })}
                    placeholder="+244XXXXXXXXX"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>URL do Áudio *</Label>
                  <Input
                    value={audioData.audio}
                    onChange={(e) => setAudioData({ ...audioData, audio: e.target.value })}
                    placeholder="https://example.com/audio.mp3"
                    className="mt-1"
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded p-3">
                  <p className="text-xs text-amber-800">
                    <strong>Nota:</strong> Funcionalidade em desenvolvimento. Em breve disponível.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setShowModal(null)} variant="outline" className="flex-1">
                    Cancelar
                  </Button>
                  <Button disabled className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                    Em breve
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-slate-900">Enviar Vídeo</h3>
                <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label>Número do Destinatário *</Label>
                  <Input
                    value={videoData.to}
                    onChange={(e) => setVideoData({ ...videoData, to: e.target.value })}
                    placeholder="+244XXXXXXXXX"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>URL do Vídeo *</Label>
                  <Input
                    value={videoData.video}
                    onChange={(e) => setVideoData({ ...videoData, video: e.target.value })}
                    placeholder="https://example.com/video.mp4"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Legenda (Opcional)</Label>
                  <Textarea
                    value={videoData.caption}
                    onChange={(e) => setVideoData({ ...videoData, caption: e.target.value })}
                    placeholder="Adicione uma legenda..."
                    className="mt-1 h-20"
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded p-3">
                  <p className="text-xs text-amber-800">
                    <strong>Nota:</strong> Funcionalidade em desenvolvimento. Em breve disponível.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setShowModal(null)} variant="outline" className="flex-1">
                    Cancelar
                  </Button>
                  <Button disabled className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                    Em breve
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'localizacao':
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-slate-900">Enviar Localização</h3>
                <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label>Número do Destinatário *</Label>
                  <Input
                    value={localizacaoData.to}
                    onChange={(e) => setLocalizacaoData({ ...localizacaoData, to: e.target.value })}
                    placeholder="+244XXXXXXXXX"
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Latitude *</Label>
                    <Input
                      value={localizacaoData.latitude}
                      onChange={(e) => setLocalizacaoData({ ...localizacaoData, latitude: e.target.value })}
                      placeholder="-8.8383"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Longitude *</Label>
                    <Input
                      value={localizacaoData.longitude}
                      onChange={(e) => setLocalizacaoData({ ...localizacaoData, longitude: e.target.value })}
                      placeholder="13.2344"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label>Nome do Local</Label>
                  <Input
                    value={localizacaoData.name}
                    onChange={(e) => setLocalizacaoData({ ...localizacaoData, name: e.target.value })}
                    placeholder="Nome do local"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Endereço</Label>
                  <Input
                    value={localizacaoData.address}
                    onChange={(e) => setLocalizacaoData({ ...localizacaoData, address: e.target.value })}
                    placeholder="Endereço completo"
                    className="mt-1"
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded p-3">
                  <p className="text-xs text-amber-800">
                    <strong>Nota:</strong> Funcionalidade em desenvolvimento. Em breve disponível.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setShowModal(null)} variant="outline" className="flex-1">
                    Cancelar
                  </Button>
                  <Button disabled className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                    Em breve
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'contato':
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-slate-900">Enviar Contato</h3>
                <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label>Número do Destinatário *</Label>
                  <Input
                    value={contatoData.to}
                    onChange={(e) => setContatoData({ ...contatoData, to: e.target.value })}
                    placeholder="+244XXXXXXXXX"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Nome do Contato *</Label>
                  <Input
                    value={contatoData.contactName}
                    onChange={(e) => setContatoData({ ...contatoData, contactName: e.target.value })}
                    placeholder="Nome completo"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Telefone do Contato *</Label>
                  <Input
                    value={contatoData.contactPhone}
                    onChange={(e) => setContatoData({ ...contatoData, contactPhone: e.target.value })}
                    placeholder="+244XXXXXXXXX"
                    className="mt-1"
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded p-3">
                  <p className="text-xs text-amber-800">
                    <strong>Nota:</strong> Funcionalidade em desenvolvimento. Em breve disponível.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setShowModal(null)} variant="outline" className="flex-1">
                    Cancelar
                  </Button>
                  <Button disabled className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                    Em breve
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'sticker':
      case 'gif':
      case 'ptv':
      case 'link':
      case 'produto':
      case 'catalogo':
      case 'varios-contatos':
      case 'texto-botoes-acao':
      case 'texto-botoes':
      case 'botoes-imagem':
      case 'botoes-video':
      case 'lista-opcoes':
      case 'botao-otp':
      case 'botao-pix':
      case 'carrossel':
      case 'ler-mensagens':
      case 'deletar-mensagens':
      case 'responder-mensagem':
      case 'reencaminhar':
      case 'reagir':
      case 'remover-reacao':
      case 'fixar':
      case 'enquete':
      case 'voto-enquete':
      case 'aprovacao-pedido':
      case 'status-pedido':
      case 'pagamento-pedido':
      case 'convite-canal':
      case 'evento':
      case 'editar-evento':
      case 'responder-evento':
        const modalTitles = {
          'sticker': 'Enviar Sticker',
          'gif': 'Enviar GIF',
          'ptv': 'Enviar PTV',
          'link': 'Enviar Link',
          'produto': 'Enviar Produto',
          'catalogo': 'Enviar Catálogo',
          'varios-contatos': 'Enviar Vários Contatos',
          'texto-botoes-acao': 'Texto com Botões de Ação',
          'texto-botoes': 'Texto com Botões',
          'botoes-imagem': 'Botões com Imagem',
          'botoes-video': 'Botões com Vídeo',
          'lista-opcoes': 'Lista de Opções',
          'botao-otp': 'Botão OTP',
          'botao-pix': 'Botão PIX',
          'carrossel': 'Carrossel',
          'ler-mensagens': 'Ler Mensagens',
          'deletar-mensagens': 'Deletar Mensagens',
          'responder-mensagem': 'Responder Mensagem',
          'reencaminhar': 'Reencaminhar Mensagem',
          'reagir': 'Enviar Reação',
          'remover-reacao': 'Remover Reação',
          'fixar': 'Fixar/Desafixar Mensagens',
          'enquete': 'Enviar Enquete',
          'voto-enquete': 'Enviar Voto para Enquete',
          'aprovacao-pedido': 'Aprovação de Pedido',
          'status-pedido': 'Status do Pedido',
          'pagamento-pedido': 'Pagamento do Pedido',
          'convite-canal': 'Convite Admin do Canal',
          'evento': 'Enviar Evento',
          'editar-evento': 'Editar Evento',
          'responder-evento': 'Responder Evento'
        };

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-slate-900">{modalTitles[showModal]}</h3>
                <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded p-4">
                  <p className="text-sm text-amber-800 mb-2">
                    <strong>⚠️ Funcionalidade em Desenvolvimento</strong>
                  </p>
                  <p className="text-xs text-amber-700">
                    Esta funcionalidade está sendo implementada e estará disponível em breve. 
                    Consulte a documentação da Z-API para mais detalhes sobre os parâmetros necessários.
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-xs text-blue-800">
                    <strong>📚 Documentação:</strong> <a href="https://developer.z-api.io/" target="_blank" rel="noopener noreferrer" className="underline">developer.z-api.io</a>
                  </p>
                </div>

                <Button onClick={() => setShowModal(null)} className="w-full">
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Send className="w-5 h-5" />
            Gestão de Mensagens Z-API
          </CardTitle>
          <CardDescription>
            Funcionalidades para enviar e gerir mensagens via Z-API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Mensagens Básicas */}
            <Button onClick={() => setShowModal('texto')} variant="outline" className="w-full justify-start border-blue-600 text-blue-700 hover:bg-blue-50">
              <MessageSquare className="w-4 h-4 mr-2" />
              Enviar texto simples
            </Button>
            <Button onClick={() => setShowModal('imagem')} variant="outline" className="w-full justify-start">
              <ImageIcon className="w-4 h-4 mr-2" />
              Enviar imagem
            </Button>
            <Button onClick={() => setShowModal('sticker')} variant="outline" className="w-full justify-start">
              <Smile className="w-4 h-4 mr-2" />
              Enviar sticker
            </Button>
            <Button onClick={() => setShowModal('gif')} variant="outline" className="w-full justify-start">
              <Gift className="w-4 h-4 mr-2" />
              Enviar GIF
            </Button>
            <Button onClick={() => setShowModal('audio')} variant="outline" className="w-full justify-start">
              <Mic className="w-4 h-4 mr-2" />
              Enviar áudio
            </Button>
            <Button onClick={() => setShowModal('video')} variant="outline" className="w-full justify-start">
              <Video className="w-4 h-4 mr-2" />
              Enviar vídeo
            </Button>
            <Button onClick={() => setShowModal('ptv')} variant="outline" className="w-full justify-start">
              <Play className="w-4 h-4 mr-2" />
              Enviar PTV
            </Button>
            <Button onClick={() => setShowModal('documento')} variant="outline" className="w-full justify-start">
              <FileText className="w-4 h-4 mr-2" />
              Enviar documento
            </Button>
            <Button onClick={() => setShowModal('link')} variant="outline" className="w-full justify-start">
              <LinkIcon className="w-4 h-4 mr-2" />
              Enviar link
            </Button>
            <Button onClick={() => setShowModal('localizacao')} variant="outline" className="w-full justify-start">
              <MapPin className="w-4 h-4 mr-2" />
              Enviar localização
            </Button>
            <Button onClick={() => setShowModal('produto')} variant="outline" className="w-full justify-start">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Enviar produto
            </Button>
            <Button onClick={() => setShowModal('catalogo')} variant="outline" className="w-full justify-start">
              <BookOpen className="w-4 h-4 mr-2" />
              Enviar catálogo
            </Button>
            <Button onClick={() => setShowModal('contato')} variant="outline" className="w-full justify-start">
              <User className="w-4 h-4 mr-2" />
              Enviar contato
            </Button>
            <Button onClick={() => setShowModal('varios-contatos')} variant="outline" className="w-full justify-start">
              <Users className="w-4 h-4 mr-2" />
              Enviar vários contatos
            </Button>

            {/* Mensagens Interativas */}
            <Button onClick={() => setShowModal('texto-botoes-acao')} variant="outline" className="w-full justify-start">
              <MessageCircle className="w-4 h-4 mr-2" />
              Texto com botões de ação
            </Button>
            <Button onClick={() => setShowModal('texto-botoes')} variant="outline" className="w-full justify-start">
              <MessageCircle className="w-4 h-4 mr-2" />
              Texto com botões
            </Button>
            <Button onClick={() => setShowModal('botoes-imagem')} variant="outline" className="w-full justify-start">
              <ImageIcon className="w-4 h-4 mr-2" />
              Botões com imagem
            </Button>
            <Button onClick={() => setShowModal('botoes-video')} variant="outline" className="w-full justify-start">
              <Video className="w-4 h-4 mr-2" />
              Botões com vídeo
            </Button>
            <Button onClick={() => setShowModal('lista-opcoes')} variant="outline" className="w-full justify-start">
              <Menu className="w-4 h-4 mr-2" />
              Lista de opções
            </Button>
            <Button onClick={() => setShowModal('botao-otp')} variant="outline" className="w-full justify-start">
              <MessageSquare className="w-4 h-4 mr-2" />
              Botão OTP
            </Button>
            <Button onClick={() => setShowModal('botao-pix')} variant="outline" className="w-full justify-start">
              <CreditCard className="w-4 h-4 mr-2" />
              Botão PIX
            </Button>
            <Button onClick={() => setShowModal('carrossel')} variant="outline" className="w-full justify-start">
              <Share2 className="w-4 h-4 mr-2" />
              Carrossel
            </Button>

            {/* Gestão de Mensagens */}
            <Button onClick={() => setShowModal('ler-mensagens')} variant="outline" className="w-full justify-start">
              <Eye className="w-4 h-4 mr-2" />
              Ler mensagens
            </Button>
            <Button onClick={() => setShowModal('deletar-mensagens')} variant="outline" className="w-full justify-start">
              <Trash2 className="w-4 h-4 mr-2" />
              Deletar mensagens
            </Button>
            <Button onClick={() => setShowModal('responder-mensagem')} variant="outline" className="w-full justify-start">
              <Reply className="w-4 h-4 mr-2" />
              Responder mensagem
            </Button>
            <Button onClick={() => setShowModal('reencaminhar')} variant="outline" className="w-full justify-start">
              <Share2 className="w-4 h-4 mr-2" />
              Reencaminhar mensagem
            </Button>
            <Button onClick={() => setShowModal('reagir')} variant="outline" className="w-full justify-start">
              <Smile className="w-4 h-4 mr-2" />
              Enviar reação
            </Button>
            <Button onClick={() => setShowModal('remover-reacao')} variant="outline" className="w-full justify-start">
              <X className="w-4 h-4 mr-2" />
              Remover reação
            </Button>
            <Button onClick={() => setShowModal('fixar')} variant="outline" className="w-full justify-start">
              <Pin className="w-4 h-4 mr-2" />
              Fixar/Desafixar mensagens
            </Button>

            {/* Enquetes */}
            <Button onClick={() => setShowModal('enquete')} variant="outline" className="w-full justify-start">
              <MessageCircle className="w-4 h-4 mr-2" />
              Enviar enquete
            </Button>
            <Button onClick={() => setShowModal('voto-enquete')} variant="outline" className="w-full justify-start">
              <MessageSquare className="w-4 h-4 mr-2" />
              Enviar voto para enquete
            </Button>

            {/* Pedidos/Pagamentos */}
            <Button onClick={() => setShowModal('aprovacao-pedido')} variant="outline" className="w-full justify-start">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Aprovação de pedido
            </Button>
            <Button onClick={() => setShowModal('status-pedido')} variant="outline" className="w-full justify-start">
              <Receipt className="w-4 h-4 mr-2" />
              Status do pedido
            </Button>
            <Button onClick={() => setShowModal('pagamento-pedido')} variant="outline" className="w-full justify-start">
              <CreditCard className="w-4 h-4 mr-2" />
              Pagamento do pedido
            </Button>

            {/* Canais */}
            <Button onClick={() => setShowModal('convite-canal')} variant="outline" className="w-full justify-start">
              <UserPlus className="w-4 h-4 mr-2" />
              Convite admin do canal
            </Button>
            <Button onClick={() => setShowModal('evento')} variant="outline" className="w-full justify-start">
              <Calendar className="w-4 h-4 mr-2" />
              Enviar evento
            </Button>
            <Button onClick={() => setShowModal('editar-evento')} variant="outline" className="w-full justify-start">
              <Edit className="w-4 h-4 mr-2" />
              Editar evento
            </Button>
            <Button onClick={() => setShowModal('responder-evento')} variant="outline" className="w-full justify-start">
              <Reply className="w-4 h-4 mr-2" />
              Responder evento
            </Button>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Funcionalidades Disponíveis</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>Enviar texto simples:</strong> Totalmente funcional</li>
              <li><strong>Outras funcionalidades:</strong> Em desenvolvimento progressivo</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {renderModal()}
    </div>
  );
}