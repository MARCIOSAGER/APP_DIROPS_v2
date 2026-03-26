import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  MessageCircle, 
  Send, 
  Search,
  Phone,
  MoreVertical,
  Paperclip,
  Smile,
  Check,
  CheckCheck
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ZAPIAtendimentoChat({ onError, onSuccess }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChats = async () => {
    setLoading(true);
    try {
      // Mock data para demonstração
      setChats([
        { 
          id: '+244923456789', 
          name: 'João Silva', 
          lastMessage: 'Olá, bom dia!', 
          timestamp: '10:30',
          unread: 2,
          avatar: null
        },
        { 
          id: '+244987654321', 
          name: 'Maria Santos', 
          lastMessage: 'Obrigado pela informação', 
          timestamp: 'Ontem',
          unread: 0,
          avatar: null
        }
      ]);
    } catch (error) {
      console.error('Erro ao carregar chats:', error);
      if (onError) onError('Erro ao carregar conversas');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (chatId) => {
    try {
      // Mock data
      setMessages([
        { 
          id: '1', 
          from: chatId, 
          body: 'Olá, bom dia!', 
          timestamp: '10:25',
          fromMe: false,
          status: 'read'
        },
        { 
          id: '2', 
          from: 'me', 
          body: 'Bom dia! Como posso ajudar?', 
          timestamp: '10:26',
          fromMe: true,
          status: 'read'
        },
        { 
          id: '3', 
          from: chatId, 
          body: 'Gostaria de informações sobre os voos.', 
          timestamp: '10:30',
          fromMe: false,
          status: 'read'
        }
      ]);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    loadMessages(chat.id);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    setSending(true);
    try {
      const response = await base44.functions.invoke('sendWhatsAppMessageZAPI', {
        to: selectedChat.id,
        body: newMessage
      });

      if (response.data) {
        const newMsg = {
          id: Date.now().toString(),
          from: 'me',
          body: newMessage,
          timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          fromMe: true,
          status: 'sent'
        };
        setMessages([...messages, newMsg]);
        setNewMessage('');
        if (onSuccess) onSuccess('Mensagem enviada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      if (onError) onError('Erro ao enviar mensagem. Verifique a configuração da Z-API.');
    } finally {
      setSending(false);
    }
  };

  const filteredChats = chats.filter(chat => 
    chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.id.includes(searchTerm)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-green-600" />
          Atendimento WhatsApp via Z-API
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-white rounded-lg border border-slate-200" style={{ height: '600px' }}>
          <div className="flex h-full">
            {/* Lista de Conversas */}
            <div className="w-1/3 border-r border-slate-200 flex flex-col">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Pesquisar conversas..."
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-slate-500">A carregar...</div>
                  </div>
                ) : filteredChats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 p-4">
                    <MessageCircle className="w-12 h-12 mb-2 text-slate-300" />
                    <p className="text-center text-sm">Nenhuma conversa encontrada</p>
                  </div>
                ) : (
                  filteredChats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => handleSelectChat(chat)}
                      className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                        selectedChat?.id === chat.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-300 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-semibold text-lg">
                            {chat.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900 truncate">{chat.name}</h3>
                            <span className="text-xs text-slate-500">{chat.timestamp}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-sm text-slate-600 truncate">{chat.lastMessage}</p>
                            {chat.unread > 0 && (
                              <span className="bg-green-500 text-white text-xs rounded-full px-2 py-0.5 ml-2">
                                {chat.unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Área de Chat */}
            <div className="flex-1 flex flex-col">
              {selectedChat ? (
                <>
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold">
                          {selectedChat.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{selectedChat.name}</h3>
                        <p className="text-xs text-slate-500">{selectedChat.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" aria-label="Ligar">
                        <Phone className="w-5 h-5" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Mais opções">
                        <MoreVertical className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 bg-slate-100">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`mb-3 flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-md px-4 py-2 rounded-lg ${
                            msg.fromMe
                              ? 'bg-green-500 text-white rounded-br-none'
                              : 'bg-white text-slate-900 rounded-bl-none shadow-sm'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                          <div className={`flex items-center justify-end gap-1 mt-1 ${msg.fromMe ? 'text-white' : 'text-slate-500'}`}>
                            <span className="text-xs">{msg.timestamp}</span>
                            {msg.fromMe && (
                              msg.status === 'read' ? (
                                <CheckCheck className="w-3 h-3" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="p-4 bg-slate-50 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="text-slate-500">
                        <Smile className="w-5 h-5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-slate-500">
                        <Paperclip className="w-5 h-5" />
                      </Button>
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        placeholder="Escreva uma mensagem..."
                        className="flex-1"
                      />
                      <Button 
                        onClick={handleSendMessage} 
                        disabled={!newMessage.trim() || sending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Send className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <MessageCircle className="w-24 h-24 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Atendimento WhatsApp</h3>
                  <p className="text-sm">Selecione uma conversa para começar</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            <strong>⚠️ Nota:</strong> A listagem de conversas está em desenvolvimento. 
            Atualmente, apenas o envio de mensagens está funcional.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}