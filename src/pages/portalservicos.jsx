import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserCheck, FileText, ArrowRight, Building, Mail, Globe, Phone, LogIn } from 'lucide-react';
import { Empresa } from '@/entities/Empresa';
import { getEmpresaLogoByUser } from '@/components/lib/userUtils';

export default function PortalServicos() {
  const [empresas, setEmpresas] = useState([]);

  useEffect(() => {
    Empresa.list().then(data => setEmpresas(data || [])).catch(() => setEmpresas([]));
  }, []);

  const logoUrl = getEmpresaLogoByUser(null, empresas);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <header className="absolute top-0 right-0 p-6">
          <Button 
            variant="outline" 
            className="flex items-center gap-2 bg-white/80 backdrop-blur-sm"
            onClick={() => window.location.href = createPageUrl('PaginaInicial')}
          >
            <LogIn className="w-4 h-4" />
            Entrar no Sistema
          </Button>
        </header>

        <div className="text-center mb-10">
          <img
            src={logoUrl}
            alt="DIROPS Logo"
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800">
            Portal de Serviços Públicos
          </h1>
          <p className="text-slate-600 mt-2">
            Aceda aos serviços públicos disponibilizados pela DIROPS.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow border-2 border-blue-100">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserCheck className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-xl text-slate-700">Solicitar Credencial</CardTitle>
              <CardDescription>Inicie um novo pedido de credenciamento.</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link to={createPageUrl('CredenciamentoPublico')}>
                <Button className="w-full text-lg py-6 bg-blue-600 hover:bg-blue-700 text-white">
                  Solicitar
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow border-2 border-pink-100">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-pink-600" />
              </div>
              <CardTitle className="text-xl text-slate-700">Fazer Reclamação</CardTitle>
              <CardDescription>Relate problemas, sugestões ou reclamações.</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link to={createPageUrl('FormularioReclamacaoPublico')}>
                <Button className="w-full text-lg py-6 bg-pink-600 hover:bg-pink-700 text-white">
                  Reclamar
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-slate-700 flex items-center justify-center gap-2">
              <Building className="w-5 h-5" />
              Contactos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <Phone className="w-5 h-5 text-slate-500" />
                <span className="font-medium text-slate-700">Telefone</span>
                <span className="text-slate-600">+244 932 043 077</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Mail className="w-5 h-5 text-slate-500" />
                <span className="font-medium text-slate-700">Email</span>
                <span className="text-slate-600">oaeroportos@sga.co.ao</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Globe className="w-5 h-5 text-slate-500" />
                <span className="font-medium text-slate-700">Website</span>
                <span className="text-slate-600">www.sga.co.ao</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}