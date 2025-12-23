'use client';

import { useState, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useNotesStore } from '@/store/notes-store';
import { notesApi } from '@/lib/api';
import { markdownToTiptap } from '@/lib/export-utils';
import {
    FileText,
    FileUp,
    Loader2,
    Upload,
    X,
} from 'lucide-react';

interface ImportDialogProps {
    children: React.ReactNode;
    onImportComplete?: () => void;
}

export function ImportDialog({ children, onImportComplete }: ImportDialogProps) {
    const { token } = useAuthStore();
    const { addNote } = useNotesStore();
    const [open, setOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File) => {
        if (!token) return;

        const extension = file.name.split('.').pop()?.toLowerCase();

        if (!['md', 'txt', 'json'].includes(extension || '')) {
            toast.error('Formato não suportado. Use .md, .txt ou .json');
            return;
        }

        setIsImporting(true);
        try {
            const text = await file.text();
            let title = file.name.replace(/\.[^/.]+$/, '');
            let content: any;

            if (extension === 'json') {
                // JSON import (backup format)
                const parsed = JSON.parse(text);
                title = parsed.title || title;
                content = parsed.content;
            } else if (extension === 'md') {
                // Markdown import
                // Try to extract title from frontmatter or first heading
                const frontmatterMatch = text.match(/^---\s*\n([\s\S]*?)\n---/);
                if (frontmatterMatch && frontmatterMatch[1]) {
                    const titleMatch = frontmatterMatch[1].match(/title:\s*(.+)/);
                    if (titleMatch && titleMatch[1]) title = titleMatch[1].trim();
                }

                const headingMatch = text.match(/^#\s+(.+)$/m);
                if (headingMatch && !frontmatterMatch) {
                    title = headingMatch[1];
                }

                content = markdownToTiptap(text);
            } else {
                // Plain text import
                content = {
                    type: 'doc',
                    content: text.split('\n\n').map(para => ({
                        type: 'paragraph',
                        content: para.trim() ? [{ type: 'text', text: para }] : [],
                    })),
                };
            }

            // Create the note
            const newNote = await notesApi.create(token, { title, content });
            addNote(newNote);

            toast.success(`Importado: ${title}`);
            setOpen(false);
            onImportComplete?.();
        } catch (error) {
            console.error('Import error:', error);
            toast.error('Falha ao importar arquivo');
        } finally {
            setIsImporting(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);

        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
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
                            <Upload className="w-5 h-5" />
                            Importar Nota
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </Dialog.Close>
                    </div>

                    {/* Drop Zone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                            'border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors',
                            'flex flex-col items-center justify-center gap-3',
                            dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
                        )}
                    >
                        {isImporting ? (
                            <>
                                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Importando...</p>
                            </>
                        ) : (
                            <>
                                <FileUp className="w-10 h-10 text-muted-foreground" />
                                <div className="text-center">
                                    <p className="font-medium">Arraste um arquivo aqui</p>
                                    <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
                                </div>
                            </>
                        )}
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".md,.txt,.json"
                        onChange={handleFileInput}
                        className="hidden"
                    />

                    {/* Supported formats */}
                    <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Formatos suportados:</p>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { ext: '.md', label: 'Markdown' },
                                { ext: '.txt', label: 'Texto' },
                                { ext: '.json', label: 'JSON (backup)' },
                            ].map(format => (
                                <span
                                    key={format.ext}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs"
                                >
                                    <FileText className="w-3 h-3" />
                                    {format.label}
                                </span>
                            ))}
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
