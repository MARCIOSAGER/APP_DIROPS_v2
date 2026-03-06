import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, X } from 'lucide-react';
import { sanitizeHtml } from '@/lib/sanitize';

export default function EmailPreviewModal({ isOpen, onClose, title, body }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] w-full rounded border p-4">
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }}
          />
        </ScrollArea>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            <X className="w-4 h-4 mr-2" />
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}