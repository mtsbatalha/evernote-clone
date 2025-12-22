'use client';

import { useState, useRef, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useNotesStore } from '@/store/notes-store';
import { notesApi, notebooksApi } from '@/lib/api';
import { parseFiles, getFileType, ImportedNote, htmlToTiptap } from '@/lib/import-utils';
import {
    FileText,
    FolderOpen,
    Loader2,
    Plus,
    Trash2,
    Upload,
    X,
    CheckCircle2,
    AlertCircle,
} from 'lucide-react';

interface ImportNotesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type ImportStep = 'select' | 'configure' | 'importing' | 'done';
type DuplicateHandling = 'replace' | 'rename' | 'ignore';

export function ImportNotesDialog({ open, onOpenChange }: ImportNotesDialogProps) {
    const { token } = useAuthStore();
    const { notebooks, notes: existingNotes, addNotebook, addNote, updateNote } = useNotesStore();

    const [step, setStep] = useState<ImportStep>('select');
    const [files, setFiles] = useState<File[]>([]);
    const [selectedNotebookId, setSelectedNotebookId] = useState<string>('');
    const [createNewNotebook, setCreateNewNotebook] = useState(false);
    const [newNotebookName, setNewNotebookName] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [results, setResults] = useState<{ success: number; errors: string[]; skipped: number }>({ success: 0, errors: [], skipped: 0 });
    const [duplicateHandling, setDuplicateHandling] = useState<DuplicateHandling>('rename');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleClose = () => {
        onOpenChange(false);
        // Reset state after animation
        setTimeout(() => {
            setStep('select');
            setFiles([]);
            setSelectedNotebookId('');
            setCreateNewNotebook(false);
            setNewNotebookName('');
            setProgress({ current: 0, total: 0 });
            setResults({ success: 0, errors: [], skipped: 0 });
            setDuplicateHandling('rename');
        }, 200);
    };

    const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
        if (!selectedFiles) return;

        const validFiles: File[] = [];
        const invalidFiles: string[] = [];

        Array.from(selectedFiles).forEach((file) => {
            const fileType = getFileType(file.name);
            if (fileType !== 'unknown') {
                validFiles.push(file);
            } else {
                invalidFiles.push(file.name);
            }
        });

        if (invalidFiles.length > 0) {
            toast.warning(`Arquivos ignorados (formato não suportado): ${invalidFiles.join(', ')}`);
        }

        setFiles((prev) => [...prev, ...validFiles]);

        // Auto-advance to configure step if we have files
        if (validFiles.length > 0 && files.length === 0) {
            setStep('configure');
        }
    }, [files.length]);

    const handleRemoveFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleImport = async () => {
        if (!token || files.length === 0) return;

        setIsImporting(true);
        setStep('importing');

        try {
            // Create new notebook if requested
            let targetNotebookId = selectedNotebookId;
            if (createNewNotebook && newNotebookName.trim()) {
                try {
                    const newNotebook = await notebooksApi.create(token, {
                        name: newNotebookName.trim()
                    });
                    addNotebook(newNotebook);
                    targetNotebookId = newNotebook.id;
                } catch (error) {
                    toast.error('Falha ao criar novo caderno');
                    setIsImporting(false);
                    setStep('configure');
                    return;
                }
            }

            // Parse all files
            const { notes, errors } = await parseFiles(files);
            setProgress({ current: 0, total: notes.length });

            // Pre-process notes: check duplicates and convert content
            const processedNotes: { note: any; action: 'create' | 'update' | 'skip'; existingId?: string }[] = [];

            for (const note of notes) {
                if (!note) continue;

                const existingNote = existingNotes.find(
                    n => n.title.toLowerCase() === note.title.toLowerCase()
                );

                if (existingNote) {
                    if (duplicateHandling === 'ignore') {
                        processedNotes.push({ note, action: 'skip' });
                    } else if (duplicateHandling === 'replace') {
                        processedNotes.push({ note, action: 'update', existingId: existingNote.id });
                    } else {
                        // 'rename'
                        note.title = `${note.title} (cópia)`;
                        processedNotes.push({ note, action: 'create' });
                    }
                } else {
                    processedNotes.push({ note, action: 'create' });
                }
            }

            // Separate notes by action type
            const BATCH_SIZE = 50; // Larger batch for bulk API
            let successCount = 0;
            let skippedCount = 0;
            const importErrors: string[] = [...errors];
            const createdNotes: any[] = [];

            // Group notes by action
            const toCreate = processedNotes.filter(p => p.action === 'create');
            const toUpdate = processedNotes.filter(p => p.action === 'update');
            const toSkip = processedNotes.filter(p => p.action === 'skip');

            skippedCount = toSkip.length;

            // Process updates in parallel batches (these need individual requests)
            for (let i = 0; i < toUpdate.length; i += 5) {
                const batch = toUpdate.slice(i, i + 5);
                const updatePromises = batch.map(async ({ note, existingId }) => {
                    try {
                        const tiptapContent = htmlToTiptap(note.content);
                        await notesApi.update(token, existingId!, { content: tiptapContent });
                        updateNote(existingId!, { content: tiptapContent });
                        return { success: true };
                    } catch (error) {
                        return { success: false, error: `${note.title}: ${error instanceof Error ? error.message : 'Falha ao atualizar'}` };
                    }
                });
                const results = await Promise.all(updatePromises);
                for (const r of results) {
                    if (r.success) successCount++;
                    else if (r.error) importErrors.push(r.error);
                }
                setProgress({ current: skippedCount + i + batch.length, total: processedNotes.length });
            }

            // Process creates using bulk API (much faster!)
            for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
                const batch = toCreate.slice(i, i + BATCH_SIZE);
                const notesToCreate = batch.map(({ note }) => ({
                    title: note.title,
                    content: htmlToTiptap(note.content),
                    notebookId: targetNotebookId || undefined,
                }));

                try {
                    const bulkCreated = await notesApi.bulkCreate(token, notesToCreate);
                    createdNotes.push(...bulkCreated);
                    successCount += bulkCreated.length;
                } catch (error) {
                    // Fallback to individual creates if bulk fails
                    for (const { note } of batch) {
                        try {
                            const tiptapContent = htmlToTiptap(note.content);
                            const createdNote = await notesApi.create(token, {
                                title: note.title,
                                content: tiptapContent,
                                notebookId: targetNotebookId || undefined,
                            });
                            createdNotes.push(createdNote);
                            successCount++;
                        } catch (err) {
                            importErrors.push(`${note.title}: ${err instanceof Error ? err.message : 'Falha ao importar'}`);
                        }
                    }
                }
                setProgress({ current: skippedCount + toUpdate.length + i + batch.length, total: processedNotes.length });
            }

            // Add all created notes to store at once
            for (const note of createdNotes) {
                addNote(note);
            }

            setResults({ success: successCount, errors: importErrors, skipped: skippedCount });
            setStep('done');

            if (successCount > 0) {
                toast.success(`${successCount} nota(s) importada(s) com sucesso!`);
            }
        } catch (error) {
            toast.error('Falha durante a importação');
            setStep('configure');
        } finally {
            setIsImporting(false);
        }
    };

    const getFileIcon = (filename: string) => {
        const type = getFileType(filename);
        switch (type) {
            case 'enex':
                return '📓';
            case 'html':
                return '🌐';
            case 'markdown':
                return '📝';
            default:
                return '📄';
        }
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-card border rounded-xl shadow-xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b">
                        <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
                            <Upload className="w-5 h-5" />
                            Importar Notas
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button
                                onClick={handleClose}
                                className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </Dialog.Close>
                    </div>

                    {/* Content */}
                    <div className="p-5 max-h-[60vh] overflow-y-auto">
                        {/* Step 1: Select Files */}
                        {step === 'select' && (
                            <div className="space-y-4">
                                <Dialog.Description className="text-sm text-muted-foreground">
                                    Selecione arquivos para importar. Formatos suportados: Evernote (.enex), HTML, Markdown (.md)
                                </Dialog.Description>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept=".enex,.html,.htm,.md,.markdown"
                                    onChange={(e) => handleFileSelect(e.target.files)}
                                    className="hidden"
                                />

                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={cn(
                                        'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer',
                                        'hover:border-primary hover:bg-primary/5 transition-colors'
                                    )}
                                >
                                    <FolderOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                                    <p className="font-medium">Clique para selecionar arquivos</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        ou arraste e solte aqui
                                    </p>
                                </div>

                                <div className="flex gap-2 flex-wrap">
                                    <span className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-600">
                                        .enex (Evernote)
                                    </span>
                                    <span className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-600">
                                        .html
                                    </span>
                                    <span className="text-xs px-2 py-1 rounded bg-purple-500/10 text-purple-600">
                                        .md (Markdown)
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Configure Import */}
                        {step === 'configure' && (
                            <div className="space-y-4">
                                {/* Selected files */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-medium">
                                            Arquivos selecionados ({files.length})
                                        </label>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="text-xs text-primary hover:underline"
                                        >
                                            + Adicionar mais
                                        </button>
                                    </div>

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept=".enex,.html,.htm,.md,.markdown"
                                        onChange={(e) => handleFileSelect(e.target.files)}
                                        className="hidden"
                                    />

                                    <div className="max-h-32 overflow-y-auto space-y-1 border rounded-lg p-2">
                                        {files.map((file, index) => (
                                            <div
                                                key={`${file.name}-${index}`}
                                                className="flex items-center justify-between p-2 rounded hover:bg-accent/50"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span>{getFileIcon(file.name)}</span>
                                                    <span className="text-sm truncate max-w-[250px]">
                                                        {file.name}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        ({(file.size / 1024).toFixed(1)} KB)
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveFile(index)}
                                                    className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Notebook selection */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        Importar para
                                    </label>

                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="notebook"
                                                checked={!createNewNotebook}
                                                onChange={() => setCreateNewNotebook(false)}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm">Caderno existente</span>
                                        </label>

                                        {!createNewNotebook && (
                                            <select
                                                value={selectedNotebookId}
                                                onChange={(e) => setSelectedNotebookId(e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                            >
                                                <option value="">Sem caderno (Notas Gerais)</option>
                                                {notebooks.map((nb) => (
                                                    <option key={nb.id} value={nb.id}>
                                                        {nb.name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}

                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="notebook"
                                                checked={createNewNotebook}
                                                onChange={() => setCreateNewNotebook(true)}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm">Criar novo caderno</span>
                                        </label>

                                        {createNewNotebook && (
                                            <input
                                                type="text"
                                                value={newNotebookName}
                                                onChange={(e) => setNewNotebookName(e.target.value)}
                                                placeholder="Nome do novo caderno"
                                                className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Duplicate handling */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        Notas com mesmo nome
                                    </label>

                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="duplicate"
                                                checked={duplicateHandling === 'rename'}
                                                onChange={() => setDuplicateHandling('rename')}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm">Renomear (adicionar "cópia" ao título)</span>
                                        </label>

                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="duplicate"
                                                checked={duplicateHandling === 'replace'}
                                                onChange={() => setDuplicateHandling('replace')}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm">Substituir (sobrescrever conteúdo existente)</span>
                                        </label>

                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="duplicate"
                                                checked={duplicateHandling === 'ignore'}
                                                onChange={() => setDuplicateHandling('ignore')}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm">Ignorar (não importar duplicatas)</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Importing */}
                        {step === 'importing' && (
                            <div className="space-y-4 text-center py-8">
                                <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
                                <div>
                                    <p className="font-medium">Importando notas...</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {progress.current} de {progress.total} notas
                                    </p>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2">
                                    <div
                                        className="bg-primary h-2 rounded-full transition-all"
                                        style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 4: Done */}
                        {step === 'done' && (
                            <div className="space-y-4 text-center py-4">
                                {results.success > 0 ? (
                                    <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
                                ) : (
                                    <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
                                )}

                                <div>
                                    <p className="font-medium">Importação concluída!</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {results.success} nota(s) importada(s) com sucesso
                                        {results.skipped > 0 && (
                                            <span className="text-amber-600"> • {results.skipped} ignorada(s)</span>
                                        )}
                                    </p>
                                </div>

                                {results.errors.length > 0 && (
                                    <div className="text-left p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                        <p className="text-sm font-medium text-destructive mb-2">
                                            {results.errors.length} erro(s):
                                        </p>
                                        <ul className="text-xs text-destructive/80 space-y-1 max-h-24 overflow-y-auto">
                                            {results.errors.map((err, i) => (
                                                <li key={i}>{err}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2 p-4 border-t bg-muted/30">
                        {step === 'select' && (
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 rounded-lg border hover:bg-accent transition-colors text-sm"
                            >
                                Cancelar
                            </button>
                        )}

                        {step === 'configure' && (
                            <>
                                <button
                                    onClick={() => setStep('select')}
                                    className="px-4 py-2 rounded-lg border hover:bg-accent transition-colors text-sm"
                                >
                                    Voltar
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={files.length === 0 || (createNewNotebook && !newNotebookName.trim())}
                                    className={cn(
                                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                                        'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
                                        'disabled:opacity-50 disabled:cursor-not-allowed'
                                    )}
                                >
                                    <Upload className="w-4 h-4" />
                                    Importar {files.length} arquivo(s)
                                </button>
                            </>
                        )}

                        {step === 'done' && (
                            <button
                                onClick={handleClose}
                                className={cn(
                                    'px-4 py-2 rounded-lg text-sm font-medium',
                                    'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors'
                                )}
                            >
                                Concluído
                            </button>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
