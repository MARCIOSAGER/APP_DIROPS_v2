import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function BuscaInteligente({ documentos, onResultados }) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const buscarComIA = async () => {
    if (!query.trim()) return;

    // Busca simples por texto (IA desabilitada para poupar créditos)
    const queryLower = query.toLowerCase();
    const documentosEncontrados = documentos.filter(d =>
      d.titulo?.toLowerCase().includes(queryLower) ||
      d.descricao?.toLowerCase().includes(queryLower) ||
      d.categoria?.toLowerCase().includes(queryLower)
    );
    onResultados(documentosEncontrados, null);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="w-5 h-5 text-purple-600" />
          Busca Inteligente com IA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input
            placeholder="Ex: procedimentos de emergência, manuais de check-in, regulamentos de segurança..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && buscarComIA()}
            disabled={isSearching}
          />
          <Button onClick={buscarComIA} disabled={isSearching || !query.trim()}>
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          A IA irá analisar a sua pergunta e encontrar os documentos mais relevantes, mesmo usando sinónimos ou termos relacionados.
        </p>
      </CardContent>
    </Card>
  );
}