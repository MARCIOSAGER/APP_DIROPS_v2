import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, FileText, Upload, FileDown, BookOpen, BarChart2, FolderUp, Home, ChevronRight, FolderPlus, Grid3x3, List, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { Documento } from '@/entities/Documento';
import { Aeroporto } from '@/entities/Aeroporto';
import { User } from '@/entities/User';
import { downloadAsCSV } from '../components/lib/export';
import { getAeroportosPermitidos, filtrarDadosPorAcesso, isSuperAdmin } from '@/components/lib/userUtils';

import DocumentosList from '../components/documentos/DocumentosList';
import FormDocumento from '../components/documentos/FormDocumento';
import UploadMassaModal from '../components/documentos/UploadMassaModal';
import BuscaInteligente from '../components/documentos/BuscaInteligente';
import DragDropUpload from '../components/documentos/DragDropUpload';
import PastaCard from '../components/documentos/PastaCard';
import FormPasta from '../components/documentos/FormPasta';
import MoverDocumentoModal from '../components/documentos/MoverDocumentoModal';
import GerenciarAcessoModal from '../components/documentos/GerenciarAcessoModal';
import AlertModal from '../components/shared/AlertModal';
import SenhaModal from '../components/documentos/SenhaModal';
import { validarSenhaItem } from '@/functions/validarSenhaItem';
import { Pasta } from '@/entities/Pasta';

export default function Documentos() {
  const [currentUser, setCurrentUser] = useState(null);
  const [documentos, setDocumentos] = useState([]);
  const [aeroportos, setAeroportos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDocumento, setEditingDocumento] = useState(null);
  const [isUploadMassaOpen, setIsUploadMassaOpen] = useState(false);
  const [buscaInteligente, setBuscaInteligente] = useState(null);
  const [pastas, setPastas] = useState([]);
  const [pastaAtual, setPastaAtual] = useState(null);
  const [caminhoPasta, setCaminhoPasta] = useState([]);
  const [isFormPastaOpen, setIsFormPastaOpen] = useState(false);
  const [editingPasta, setEditingPasta] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [isMoverModalOpen, setIsMoverModalOpen] = useState(false);
  const [movingDocumento, setMovingDocumento] = useState(null);
  const [aeroportoFilter, setAeroportoFilter] = useState('todos');
  const [pastaFilter, setPastaFilter] = useState('todos');
  const [deleteModalInfo, setDeleteModalInfo] = useState({ isOpen: false, id: null, tipo: null, nome: null, detalhes: null, isBulk: false, bulkIds: [] });
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const [confirmCascadeModal, setConfirmCascadeModal] = useState({ isOpen: false, data: null, stats: null });
  const [successModal, setSuccessModal] = useState({ isOpen: false, message: '' });
  const [senhaModal, setSenhaModal] = useState({ isOpen: false, pasta: null, tipo: 'pasta' });
  const [isGerenciarAcessoOpen, setIsGerenciarAcessoOpen] = useState(false);
  const [documentoParaGerenciar, setDocumentoParaGerenciar] = useState(null);
  const [vooLigadoFilter, setVooLigadoFilter] = useState(null);

  useEffect(() => {
    // Verificar se há parâmetro de filtro na URL
    const urlParams = new URLSearchParams(window.location.search);
    const vooLigadoId = urlParams.get('voo_ligado_id');
    if (vooLigadoId) {
      setVooLigadoFilter(vooLigadoId);
    }
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      // Server-side filter by empresa_id when user belongs to one
      const empId = user.empresa_id;
      const documentoPromise = empId
        ? Documento.filter({ empresa_id: empId }, '-data_publicacao')
        : Documento.list('-data_publicacao');

      const [documentosData, aeroportosData, pastasData] = await Promise.all([
        documentoPromise,
        empId ? Aeroporto.filter({ empresa_id: empId }) : Aeroporto.list(),
        Pasta.list()
      ]);

      const aeroportosAngola = aeroportosData.filter(a => a.pais === 'AO');

      // Filtrar aeroportos pelos aeroportos de acesso do utilizador (empresa-based)
      const aeroportosFiltrados = getAeroportosPermitidos(user, aeroportosAngola, user.empresa_id);
      setAeroportos(aeroportosFiltrados);

      // Filtrar documentos pelos aeroportos de acesso do utilizador
      // Documentos sem aeroporto específico são "gerais" e visíveis para todos
      const docsFiltradosPorAcesso = filtrarDadosPorAcesso(user, documentosData, 'aeroporto', aeroportosAngola);
      // Incluir documentos gerais (sem aeroporto) que não entraram no filtro
      const docsGerais = documentosData.filter(doc => !doc.aeroporto);
      const documentosFiltrados = [...new Map([...docsFiltradosPorAcesso, ...docsGerais].map(d => [d.id, d])).values()];

      setDocumentos(documentosFiltrados);
      setPastas(pastasData);
    } catch (error) {
      console.error("Erro ao carregar documentos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (doc) => {
    setEditingDocumento(doc);
    setIsFormOpen(true);
  };
  
  const handleDelete = (docId, options = {}) => {
    const { isBulk = false, bulkIds = [] } = options;
    
    if (isBulk && bulkIds.length > 0) {
      // Exclusão em massa
      setDeleteModalInfo({
        isOpen: true,
        id: null,
        tipo: 'escolha',
        nome: `${bulkIds.length} documento(s)`,
        detalhes: null,
        isBulk: true,
        bulkIds: bulkIds
      });
      setShowDeleteOptions(true);
    } else {
      // Exclusão individual
      const doc = documentos.find(d => d.id === docId);
      setDeleteModalInfo({
        isOpen: true,
        id: docId,
        tipo: 'escolha',
        nome: doc?.titulo || 'Documento',
        detalhes: null
      });
      setShowDeleteOptions(true);
    }
  };

  const handleDeleteOption = (opcao) => {
    setShowDeleteOptions(false);
    
    const detalhes = opcao === 'excluir' 
      ? 'Esta ação é irreversível. O documento será removido permanentemente da base de dados.' 
      : null;
    
    setDeleteModalInfo(prev => ({
      ...prev,
      isOpen: true,
      tipo: opcao,
      detalhes: detalhes
    }));
  };

  const handleConfirmDelete = async () => {
    try {
      if (deleteModalInfo.isBulk && deleteModalInfo.bulkIds) {
        // Exclusão em massa
        if (deleteModalInfo.tipo === 'arquivar') {
          await Promise.all(
            deleteModalInfo.bulkIds.map(id => Documento.update(id, { status: 'arquivado' }))
          );
        } else if (deleteModalInfo.tipo === 'excluir') {
          await Promise.all(
            deleteModalInfo.bulkIds.map(id => Documento.delete(id))
          );
        }
      } else {
        // Exclusão individual
        if (deleteModalInfo.tipo === 'arquivar') {
          await Documento.update(deleteModalInfo.id, { status: 'arquivado' });
        } else if (deleteModalInfo.tipo === 'excluir') {
          await Documento.delete(deleteModalInfo.id);
        } else if (deleteModalInfo.tipo === 'pasta') {
          await Pasta.delete(deleteModalInfo.id);
        }
      }
      setDeleteModalInfo({ isOpen: false, id: null, tipo: null, nome: null, detalhes: null, isBulk: false, bulkIds: [] });
      setShowDeleteOptions(false);
      loadData();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      setSuccessModal({
        isOpen: true,
        type: 'error',
        message: 'Erro ao excluir. Por favor, tente novamente.'
      });
    }
  };

  const handleFormSubmit = async (data) => {
    try {
      if (editingDocumento) {
        await Documento.update(editingDocumento.id, data);
      } else {
        await Documento.create(data);
      }
      setIsFormOpen(false);
      setEditingDocumento(null);
      loadData();
    } catch (error) {
        console.error("Erro ao submeter formulário:", error);
    }
  };

  const handleExportCSV = () => {
    const dataToExport = documentos.map(doc => ({
      'Título': doc.titulo,
      'Categoria': doc.categoria,
      'Versão': doc.versao,
      'Data de Publicação': doc.data_publicacao,
      'Status': doc.status,
      'Aeroporto': doc.aeroporto || 'Geral',
      'URL': doc.arquivo_url
    }));
    downloadAsCSV(dataToExport, `biblioteca_documentos_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const canManage = true;

  const handleDragDropUpload = async (docData) => {
    try {
      await Documento.create({
        ...docData,
        categoria: 'outro',
        versao: '1.0',
        data_publicacao: new Date().toISOString().split('T')[0],
        nivel_acesso: ['visualizador'],
        status: 'ativo',
        pasta_id: pastaAtual?.id || null,
        aeroporto: pastaAtual?.aeroporto_id || null
      });
      loadData();
    } catch (error) {
      console.error('Erro ao criar documento:', error);
    }
  };

  const handlePastaSubmit = async (data) => {
    try {
      if (editingPasta) {
        const aeroportoAlterado = editingPasta.aeroporto_id !== data.aeroporto_id;
        
        if (aeroportoAlterado) {
          // Buscar todas as subpastas recursivamente
          const getSubpastas = (pastaId) => {
            const subs = pastas.filter(p => p.pasta_pai_id === pastaId);
            const allSubs = [...subs];
            subs.forEach(sub => {
              allSubs.push(...getSubpastas(sub.id));
            });
            return allSubs;
          };

          const subpastas = getSubpastas(editingPasta.id);
          const todasPastas = [editingPasta.id, ...subpastas.map(p => p.id)];
          
          // Buscar todos os documentos dessas pastas
          const docsAfetados = documentos.filter(doc => todasPastas.includes(doc.pasta_id));
          
          if (docsAfetados.length > 0) {
            const aeroportoNome = data.aeroporto_id 
              ? aeroportos.find(a => a.codigo_icao === data.aeroporto_id)?.nome 
              : 'Geral (Todos os aeroportos)';

            // Mostrar modal de confirmação
            setConfirmCascadeModal({
              isOpen: true,
              data: data,
              stats: {
                documentos: docsAfetados.length,
                subpastas: subpastas.length,
                aeroportoNome: aeroportoNome,
                subpastasIds: subpastas.map(p => p.id),
                docsIds: docsAfetados.map(d => d.id)
              }
            });
            return;
          } else {
            await Pasta.update(editingPasta.id, data);
          }
        } else {
          await Pasta.update(editingPasta.id, data);
        }
      } else {
        await Pasta.create({
          ...data,
          pasta_pai_id: pastaAtual?.id || null
        });
      }
      setIsFormPastaOpen(false);
      setEditingPasta(null);
      loadData();
    } catch (error) {
      console.error('Erro ao salvar pasta:', error);
      setSuccessModal({
        isOpen: true,
        type: 'error',
        message: 'Erro ao salvar pasta. Por favor, tente novamente.'
      });
    }
  };

  const handleConfirmCascadeUpdate = async () => {
    try {
      const { data, stats } = confirmCascadeModal;
      
      // Atualizar a pasta
      await Pasta.update(editingPasta.id, data);
      
      // Atualizar todas as subpastas
      await Promise.all(
        stats.subpastasIds.map(subId => Pasta.update(subId, { aeroporto_id: data.aeroporto_id }))
      );
      
      // Atualizar todos os documentos
      await Promise.all(
        stats.docsIds.map(docId => Documento.update(docId, { aeroporto: data.aeroporto_id }))
      );
      
      setConfirmCascadeModal({ isOpen: false, data: null, stats: null });
      setIsFormPastaOpen(false);
      setEditingPasta(null);
      
      setSuccessModal({
        isOpen: true,
        type: 'success',
        message: `Atualização concluída!\n\n${stats.documentos} documento(s) e ${stats.subpastas} subpasta(s) foram atualizados com sucesso.`
      });
      
      loadData();
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      setConfirmCascadeModal({ isOpen: false, data: null, stats: null });
      setSuccessModal({
        isOpen: true,
        type: 'error',
        message: 'Erro ao atualizar. Por favor, tente novamente.'
      });
    }
  };

  const handleAbrirPasta = async (pasta) => {
    // Verificar se a pasta está protegida por senha
    if (pasta.protegida_senha) {
      setSenhaModal({ isOpen: true, pasta: pasta, tipo: 'pasta' });
    } else {
      setPastaAtual(pasta);
      setCaminhoPasta([...caminhoPasta, pasta]);
    }
  };

  const handleConfirmSenhaPasta = async (senha) => {
    try {
      const result = await validarSenhaItem({
        item_id: senhaModal.pasta.id,
        tipo: 'pasta',
        senha: senha
      });

      if (result.data.valido) {
        setPastaAtual(senhaModal.pasta);
        setCaminhoPasta([...caminhoPasta, senhaModal.pasta]);
        setSenhaModal({ isOpen: false, pasta: null, tipo: 'pasta' });
      } else {
        alert('Senha incorreta. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao validar senha:', error);
      alert('Erro ao validar senha. Tente novamente.');
    }
  };

  const handleVoltarPasta = (index) => {
    if (index === -1) {
      setPastaAtual(null);
      setCaminhoPasta([]);
    } else {
      const novoCaminho = caminhoPasta.slice(0, index + 1);
      setPastaAtual(novoCaminho[novoCaminho.length - 1]);
      setCaminhoPasta(novoCaminho);
    }
  };

  const handleDeletePasta = (pasta) => {
    const canDelete = canDeleteFolder(pasta);
    if (!canDelete) {
      setDeleteModalInfo({
        isOpen: true,
        id: null,
        tipo: 'permissao',
        nome: pasta.nome,
        detalhes: 'Você não tem permissão para excluir esta pasta. Apenas administradores e o criador podem excluir.'
      });
      return;
    }

    const numSubpastas = pastas.filter(p => p.pasta_pai_id === pasta.id).length;
    const numDocumentos = documentos.filter(d => d.pasta_id === pasta.id).length;
    
    let detalhes = [];
    if (numDocumentos > 0) {
      detalhes.push(`⚠️ Esta pasta contém ${numDocumentos} documento(s)`);
    }
    if (numSubpastas > 0) {
      detalhes.push(`⚠️ Esta pasta contém ${numSubpastas} subpasta(s)`);
    }
    
    setDeleteModalInfo({
      isOpen: true,
      id: pasta.id,
      tipo: 'pasta',
      nome: pasta.nome,
      detalhes: detalhes.length > 0 ? detalhes.join('\n') : null
    });
  };

  const handleMoverDocumento = (documento) => {
    setMovingDocumento(documento);
    setIsMoverModalOpen(true);
  };

  const handleMoverConfirm = async (novaPastaId, bulkIds = null) => {
    try {
      if (bulkIds && bulkIds.length > 0) {
        // Mover em massa
        await Promise.all(
          bulkIds.map(docId => Documento.update(docId, { pasta_id: novaPastaId }))
        );
      } else {
        // Mover único documento
        await Documento.update(movingDocumento.id, { pasta_id: novaPastaId });
      }
      setIsMoverModalOpen(false);
      setMovingDocumento(null);
      loadData();
    } catch (error) {
      console.error('Erro ao mover documento:', error);
    }
  };

  const handleGerenciarAcesso = (documento) => {
    setDocumentoParaGerenciar(documento);
    setIsGerenciarAcessoOpen(true);
  };

  const handleSalvarAcesso = async (usuariosAcesso) => {
    try {
      await Documento.update(documentoParaGerenciar.id, {
        usuarios_acesso_explicito: usuariosAcesso
      });
      
      setSuccessModal({
        isOpen: true,
        type: 'success',
        message: 'Permissões de acesso atualizadas com sucesso.'
      });
      
      loadData();
    } catch (error) {
      console.error('Erro ao atualizar acesso:', error);
      setSuccessModal({
        isOpen: true,
        type: 'error',
        message: 'Erro ao atualizar permissões de acesso.'
      });
    }
  };

  const canDeleteFolder = (pasta) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin' || (currentUser.perfis && currentUser.perfis.includes('administrador'))) return true;
    return pasta.created_by === currentUser.email;
  };

  const pastasVisiveis = pastas
    .filter(p => p.pasta_pai_id === (pastaAtual?.id || null))
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome));

  let documentosVisiveis = (buscaInteligente ? buscaInteligente.documentos : documentos)
    .filter(d => (d.pasta_id || null) === (pastaAtual?.id || null));

  if (aeroportoFilter !== 'todos') {
    documentosVisiveis = documentosVisiveis.filter(d => 
      aeroportoFilter === 'null' ? !d.aeroporto : d.aeroporto === aeroportoFilter
    );
  }

  if (pastaFilter !== 'todos') {
    documentosVisiveis = documentosVisiveis.filter(d => 
      pastaFilter === 'null' ? !d.pasta_id : d.pasta_id === pastaFilter
    );
  }

  // Filtrar por voo ligado se houver filtro na URL
  if (vooLigadoFilter) {
    documentosVisiveis = documentosVisiveis.filter(d => d.voo_ligado_id === vooLigadoFilter);
  }

  // Aeroportos que realmente têm documentos
  const aeroportosComDocumentos = aeroportos.filter(aeroporto => 
    documentos.some(doc => doc.aeroporto === aeroporto.codigo_icao)
  );

  // Pastas que realmente têm documentos
  const pastasComDocumentos = pastas.filter(pasta =>
    documentos.some(doc => doc.pasta_id === pasta.id)
  ); 

  const stats = {
    total: documentos.length,
    ativos: documentos.filter(d => d.status === 'ativo').length,
    porCategoria: documentos.reduce((acc, doc) => {
      acc[doc.categoria] = (acc[doc.categoria] || 0) + 1;
      return acc;
    }, {})
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              Biblioteca de Documentos
            </h1>
            <p className="text-slate-600 mt-1">Gestão de manuais, procedimentos e documentação técnica</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={handleExportCSV}>
              <FileDown className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
            <Button variant="outline" onClick={() => setIsUploadMassaOpen(true)} className="border-purple-300 text-purple-700 hover:bg-purple-50">
              <FolderUp className="w-4 h-4 mr-2" />
              Upload em Massa
            </Button>
            <Button onClick={() => { setEditingDocumento(null); setIsFormOpen(true); }}>
              <Upload className="w-4 h-4 mr-2" />
              Novo Documento
            </Button>
          </div>
        </div>

        {/* Drag and Drop Upload */}
        <DragDropUpload 
          onUploadComplete={handleDragDropUpload}
          pastaAtual={pastaAtual}
          documentosExistentes={documentos}
        />

        {/* Alerta de Filtro Ativo */}
        {vooLigadoFilter && (
          <Alert className="border-blue-200 bg-blue-50">
            <AlertDescription className="flex items-center justify-between">
              <span className="text-blue-900">
                📄 Exibindo documentos do voo ligado específico
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setVooLigadoFilter(null);
                  window.history.pushState({}, '', '/documentos');
                }}
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                Limpar Filtro
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Busca Inteligente */}
        <BuscaInteligente 
          documentos={documentos} 
          onResultados={(docs, info) => {
            setBuscaInteligente({ documentos: docs, info });
          }}
        />

        {/* Filtros Globais */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2 text-blue-900">
                <FileText className="w-5 h-5" />
                <span className="font-semibold">Filtros Globais:</span>
              </div>
              
              <div className="flex-1 min-w-[200px] space-y-1">
                <label className="text-xs font-medium text-slate-700">Aeroporto</label>
                <select
                  value={aeroportoFilter}
                  onChange={(e) => setAeroportoFilter(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todos">Todos os Aeroportos</option>
                  <option value="null">📋 Documentos Gerais</option>
                  {aeroportosComDocumentos.map(a => (
                    <option key={a.codigo_icao} value={a.codigo_icao}>
                      ✈️ {a.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px] space-y-1">
                <label className="text-xs font-medium text-slate-700">Localização</label>
                <select
                  value={pastaFilter}
                  onChange={(e) => setPastaFilter(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todos">Todas as Localizações</option>
                  <option value="null">📂 Sem Pasta</option>
                  {pastasComDocumentos.map(p => (
                    <option key={p.id} value={p.id}>
                      📁 {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="text-sm font-medium text-blue-900 px-4 py-2 bg-white rounded-lg shadow-sm border border-blue-200">
                <strong className="text-blue-600">{documentosVisiveis.length}</strong> documento(s) encontrado(s)
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Breadcrumb e Ações */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => handleVoltarPasta(-1)}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
            >
              <Home className="w-4 h-4" />
              Raiz
            </button>
            {caminhoPasta.map((pasta, index) => (
              <React.Fragment key={pasta.id}>
                <ChevronRight className="w-4 h-4 text-slate-400" />
                <button
                  onClick={() => handleVoltarPasta(index)}
                  className="text-slate-600 hover:text-slate-900"
                >
                  {pasta.nome}
                </button>
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3x3 className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEditingPasta(null); setIsFormPastaOpen(true); }}
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              Nova Pasta
            </Button>
          </div>
        </div>

        {/* Pastas */}
        {pastasVisiveis.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              Pastas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {pastasVisiveis.map(pasta => {
                const numSubpastas = pastas.filter(p => p.pasta_pai_id === pasta.id).length;
                const numDocumentos = documentos.filter(d => d.pasta_id === pasta.id).length;
                
                return (
                  <PastaCard
                    key={pasta.id}
                    pasta={pasta}
                    numSubpastas={numSubpastas}
                    numDocumentos={numDocumentos}
                    onOpen={handleAbrirPasta}
                    onEdit={(p) => { setEditingPasta(p); setIsFormPastaOpen(true); }}
                    onDelete={handleDeletePasta}
                    canDelete={canDeleteFolder(pasta)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Título da seção de documentos */}
        {documentosVisiveis.length > 0 && (
          <h2 className="text-lg font-semibold text-slate-900 mt-6">Documentos</h2>
        )}

        {/* Estatísticas */}
        <div className="hidden grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total de Documentos</CardTitle>
              <BookOpen className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Documentos Ativos</CardTitle>
              <FileText className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.ativos}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Por Categoria</CardTitle>
              <BarChart2 className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-xs space-y-1">
                {Object.entries(stats.porCategoria).map(([cat, count]) => (
                  <div key={cat} className="flex justify-between">
                    <span className="capitalize text-slate-500">{cat.replace('_', ' ')}:</span>
                    <span className="font-medium text-slate-700">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <DocumentosList
          documentos={documentosVisiveis}
          aeroportos={aeroportos}
          isLoading={isLoading}
          onReload={loadData}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onMove={handleMoverDocumento}
          onGerenciarAcesso={handleGerenciarAcesso}
          user={currentUser}
          viewMode={viewMode}
        />
        
        {buscaInteligente && (
          <div className="mt-4">
            <Button variant="outline" onClick={() => setBuscaInteligente(null)}>
              Limpar Busca Inteligente
            </Button>
          </div>
        )}
      </div>

      {isFormOpen && (
        <FormDocumento
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingDocumento(null); }}
          onSubmit={handleFormSubmit}
          aeroportos={aeroportos}
          documentoInitial={editingDocumento}
        />
      )}

      {isUploadMassaOpen && (
        <UploadMassaModal
          isOpen={isUploadMassaOpen}
          onClose={() => setIsUploadMassaOpen(false)}
          onSuccess={loadData}
          aeroporto={null}
        />
      )}

      {isFormPastaOpen && (
        <FormPasta
          isOpen={isFormPastaOpen}
          onClose={() => { setIsFormPastaOpen(false); setEditingPasta(null); }}
          onSubmit={handlePastaSubmit}
          pastaInitial={editingPasta}
          aeroportos={aeroportos}
          pastaPai={pastaAtual}
        />
      )}

      {isMoverModalOpen && (
        <MoverDocumentoModal
          isOpen={isMoverModalOpen}
          onClose={() => { setIsMoverModalOpen(false); setMovingDocumento(null); }}
          onMove={handleMoverConfirm}
          documento={movingDocumento}
          pastas={pastas}
        />
      )}

      {showDeleteOptions ? (
        <AlertModal
          isOpen={deleteModalInfo.isOpen}
          onClose={() => {
            setDeleteModalInfo({ isOpen: false, id: null, tipo: null, nome: null, detalhes: null });
            setShowDeleteOptions(false);
          }}
          type="info"
          title="Escolha uma Opção"
          message={`O que deseja fazer com "${deleteModalInfo.nome}"?`}
          confirmText=""
          showCancel={false}
        >
          <div className="flex flex-col gap-3 mt-4">
            <Button
              onClick={() => handleDeleteOption('arquivar')}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              Arquivar Documento
            </Button>
            <Button
              onClick={() => handleDeleteOption('excluir')}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              Excluir Permanentemente
            </Button>
          </div>
        </AlertModal>
      ) : (
        <AlertModal
          isOpen={deleteModalInfo.isOpen}
          onClose={() => setDeleteModalInfo({ isOpen: false, id: null, tipo: null, nome: null, detalhes: null })}
          onConfirm={deleteModalInfo.tipo === 'permissao' ? undefined : handleConfirmDelete}
          type={deleteModalInfo.tipo === 'permissao' ? 'error' : 'warning'}
          title={deleteModalInfo.tipo === 'permissao' ? 'Sem Permissão' : deleteModalInfo.tipo === 'excluir' ? 'Confirmar Exclusão Permanente' : deleteModalInfo.tipo === 'arquivar' ? 'Confirmar Arquivamento' : 'Confirmar Exclusão'}
          message={
            deleteModalInfo.tipo === 'permissao' 
              ? deleteModalInfo.detalhes
              : `Tem certeza que deseja ${deleteModalInfo.tipo === 'arquivar' ? 'arquivar' : 'excluir'} "${deleteModalInfo.nome}"?\n\n${deleteModalInfo.detalhes || ''}\n\nEsta ação não pode ser desfeita.`
          }
          confirmText={deleteModalInfo.tipo === 'arquivar' ? 'Arquivar' : deleteModalInfo.tipo === 'pasta' ? 'Excluir' : 'Excluir Permanentemente'}
          showCancel={deleteModalInfo.tipo !== 'permissao'}
        />
      )}

      {/* Modal de Confirmação de Atualização em Cascata */}
      {confirmCascadeModal.isOpen && (
        <AlertModal
          isOpen={true}
          onClose={() => setConfirmCascadeModal({ isOpen: false, data: null, stats: null })}
          onConfirm={handleConfirmCascadeUpdate}
          type="warning"
          title="Atualização em Cascata"
          message={`Alterar o aeroporto desta pasta irá atualizar automaticamente:\n\n• ${confirmCascadeModal.stats.documentos} documento(s)\n• ${confirmCascadeModal.stats.subpastas} subpasta(s)\n\nTodos receberão o aeroporto:\n${confirmCascadeModal.stats.aeroportoNome}\n\nDeseja continuar?`}
          confirmText="Sim, Atualizar Tudo"
          cancelText="Cancelar"
          showCancel={true}
        />
      )}

      {/* Modal de Sucesso/Erro */}
      <AlertModal
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal({ isOpen: false, message: '', type: 'success' })}
        type={successModal.type || 'success'}
        title={successModal.type === 'error' ? 'Erro' : 'Sucesso'}
        message={successModal.message}
        confirmText="OK"
      />

      {/* Modal de Senha */}
      <SenhaModal
        isOpen={senhaModal.isOpen}
        onClose={() => setSenhaModal({ isOpen: false, pasta: null, tipo: 'pasta' })}
        onConfirm={handleConfirmSenhaPasta}
        titulo={senhaModal.pasta?.nome}
        tipo="pasta"
      />

      {/* Modal de Gerenciar Acesso */}
      <GerenciarAcessoModal
        isOpen={isGerenciarAcessoOpen}
        onClose={() => {
          setIsGerenciarAcessoOpen(false);
          setDocumentoParaGerenciar(null);
        }}
        documento={documentoParaGerenciar}
        onSave={handleSalvarAcesso}
      />
    </div>
  );
}