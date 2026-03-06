import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Camera, Upload, X, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const TIPOS_DOCUMENTO = {
  'general_declaration': 'General Declaration',
  'manifesto_passageiros': 'Manifesto de Passageiros',
  'manifesto_carga': 'Manifesto de Carga',
  'formulario_trafego': 'Formulário de Tráfego',
  'proforma_assinada': 'Proforma Assinada'
};

export default function UploadDocumentoVooModal({
  isOpen,
  onClose,
  onConfirm,
  vooLigado,
  voos,
  tipoDocumento
}) {
  const [mode, setMode] = useState(null); // 'camera' ou 'upload'
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const arrVoo = voos.find(v => v.id === vooLigado?.id_voo_arr);
  const depVoo = voos.find(v => v.id === vooLigado?.id_voo_dep);

  const handleStartCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCapturing(true);
      setMode('camera');
    } catch (err) {
      console.error('Erro ao acessar câmera:', err);
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const handleStopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      const file = new File([blob], `${tipoDocumento}_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(blob));
      handleStopCamera();
    }, 'image/jpeg', 0.9);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setMode('upload');
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Por favor, selecione ou capture um arquivo.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(selectedFile, tipoDocumento);
      handleClose();
    } catch (err) {
      setError(err.message || 'Erro ao enviar documento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    handleStopCamera();
    setSelectedFile(null);
    setPreviewUrl(null);
    setMode(null);
    setError(null);
    onClose();
  };

  const handleReset = () => {
    handleStopCamera();
    setSelectedFile(null);
    setPreviewUrl(null);
    setMode(null);
    setError(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Upload: {TIPOS_DOCUMENTO[tipoDocumento]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info do voo */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="text-sm text-slate-600">
              <span className="font-semibold">Voo ARR:</span> {arrVoo?.numero_voo || 'N/A'} →{' '}
              <span className="font-semibold">DEP:</span> {depVoo?.numero_voo || 'N/A'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Registo: {depVoo?.registo_aeronave || 'N/A'}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Seleção de modo */}
          {!mode && !selectedFile && (
            <div className="grid grid-cols-2 gap-4">
              <Button
                type="button"
                variant="outline"
                className="h-32 flex flex-col items-center justify-center gap-3 hover:border-blue-500 hover:bg-blue-50"
                onClick={handleStartCamera}
              >
                <Camera className="w-8 h-8 text-blue-600" />
                <span className="font-medium">Tirar Foto</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-32 flex flex-col items-center justify-center gap-3 hover:border-green-500 hover:bg-green-50"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-green-600" />
                <span className="font-medium">Fazer Upload</span>
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Câmera ativa */}
          {isCapturing && (
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-auto"
                />
              </div>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleCapture} className="bg-blue-600 hover:bg-blue-700">
                  <Camera className="w-4 h-4 mr-2" />
                  Capturar
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Preview do arquivo */}
          {previewUrl && !isCapturing && (
            <div className="space-y-4">
              <Label>Preview:</Label>
              <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-4 bg-slate-50">
                {selectedFile?.type.startsWith('image/') ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-auto max-h-96 object-contain rounded"
                  />
                ) : (
                  <div className="flex items-center justify-center p-8">
                    <FileText className="w-16 h-16 text-slate-400" />
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-white hover:bg-red-50"
                  onClick={handleReset}
                >
                  <X className="w-4 h-4 text-red-600" />
                </Button>
              </div>
              <div className="text-sm text-slate-600">
                <span className="font-medium">Arquivo:</span> {selectedFile?.name}
                {' '}({(selectedFile?.size / 1024).toFixed(0)} KB)
              </div>
            </div>
          )}

          {/* Canvas oculto para captura */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {selectedFile && !isCapturing && (
          <DialogFooter>
            <Button variant="outline" onClick={handleReset} disabled={isSubmitting}>
              Alterar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Confirmar Upload'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}