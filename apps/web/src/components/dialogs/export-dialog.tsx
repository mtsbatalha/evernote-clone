'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
    exportAsMarkdown,
    exportAsHtml,
    exportAsJson,
    exportAsText,
    tiptapToHtml,
    ExportableNote,
} from '@/lib/export-utils';
import {
    Download,
    FileCode,
    FileImage,
    FileJson,
    FileText,
    FileType,
    Loader2,
    X,
} from 'lucide-react';

interface ExportDialogProps {
    note: ExportableNote;
    children: React.ReactNode;
}

// Export as PDF using print dialog
const exportAsPdf = (note: ExportableNote): void => {
    const htmlContent = tiptapToHtml(note.content);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        toast.error('Pop-up bloqueado. Permita pop-ups para exportar PDF.');
        return;
    }

    printWindow.document.write(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>${note.title}</title>
    <style>
        @media print {
            body { margin: 0; padding: 20mm; }
            @page { margin: 15mm; }
        }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
        }
        h1, h2, h3 { margin-top: 1.5em; }
        pre { background: #f4f4f4; padding: 1rem; border-radius: 4px; overflow-x: auto; }
        code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; }
        blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 1rem; color: #666; }
        img { max-width: 100%; }
    </style>
</head>
<body>
    <h1>${note.title}</h1>
    <p style="color: #666; font-size: 0.875rem;">Criado: ${new Date(note.createdAt).toLocaleDateString('pt-BR')} | Atualizado: ${new Date(note.updatedAt).toLocaleDateString('pt-BR')}</p>
    ${htmlContent}
    <script>setTimeout(() => { window.print(); window.close(); }, 250);<\/script>
</body>
</html>
    `);
    printWindow.document.close();
};

const EXPORT_FORMATS = [
    {
        id: 'pdf',
        name: 'PDF',
        description: 'Documento para impressão',
        icon: <FileImage className="w-5 h-5" />,
        extension: '.pdf',
        action: exportAsPdf,
    },
    {
        id: 'markdown',
        name: 'Markdown',
        description: 'Arquivo .md compatível com outros editores',
        icon: <FileCode className="w-5 h-5" />,
        extension: '.md',
        action: exportAsMarkdown,
    },
    {
        id: 'html',
        name: 'HTML',
        description: 'Página web formatada',
        icon: <FileType className="w-5 h-5" />,
        extension: '.html',
        action: exportAsHtml,
    },
    {
        id: 'json',
        name: 'JSON',
        description: 'Backup completo com metadados',
        icon: <FileJson className="w-5 h-5" />,
        extension: '.json',
        action: exportAsJson,
    },
    {
        id: 'text',
        name: 'Texto Puro',
        description: 'Arquivo .txt simples',
        icon: <FileText className="w-5 h-5" />,
        extension: '.txt',
        action: exportAsText,
    },
];

export function ExportDialog({ note, children }: ExportDialogProps) {
    const [open, setOpen] = useState(false);
    const [isExporting, setIsExporting] = useState<string | null>(null);

    const handleExport = async (formatId: string) => {
        const format = EXPORT_FORMATS.find(f => f.id === formatId);
        if (!format) return;

        setIsExporting(formatId);
        try {
            // Small delay for UX
            await new Promise(r => setTimeout(r, 300));
            format.action(note);
            toast.success(`Exportado como ${format.name}!`);
            setOpen(false);
        } catch (error) {
            toast.error('Falha ao exportar');
        } finally {
            setIsExporting(null);
        }
    };

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                {children}
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card border rounded-xl shadow-xl z-50 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
                            <Download className="w-5 h-5" />
                            Exportar Nota
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </Dialog.Close>
                    </div>

                    <p className="text-sm text-muted-foreground mb-4">
                        Escolha o formato para exportar "{note.title}"
                    </p>

                    <div className="space-y-2">
                        {EXPORT_FORMATS.map(format => (
                            <button
                                key={format.id}
                                onClick={() => handleExport(format.id)}
                                disabled={isExporting !== null}
                                className={cn(
                                    'w-full flex items-center gap-4 p-4 rounded-lg border transition-colors',
                                    'hover:bg-accent hover:border-primary/50',
                                    'disabled:opacity-50 disabled:cursor-not-allowed'
                                )}
                            >
                                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                    {isExporting === format.id ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        format.icon
                                    )}
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-medium">{format.name}</p>
                                    <p className="text-xs text-muted-foreground">{format.description}</p>
                                </div>
                                <span className="text-xs text-muted-foreground font-mono">
                                    {format.extension}
                                </span>
                            </button>
                        ))}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
