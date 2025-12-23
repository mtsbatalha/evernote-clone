'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useNotesStore, Notebook } from '@/store/notes-store';
import { notebooksApi, notesApi } from '@/lib/api';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';

interface DeleteNotebookDialogProps {
    notebook: Notebook;
    children: React.ReactNode;
    onDeleted?: () => void;
}

export function DeleteNotebookDialog({ notebook, children, onDeleted }: DeleteNotebookDialogProps) {
    const { token } = useAuthStore();
    const { notes, removeNotebook, updateNote, removeNote } = useNotesStore();
    const [isOpen, setIsOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteOption, setDeleteOption] = useState<'move' | 'delete'>('move');
    const [confirmText, setConfirmText] = useState('');

    // Count notes in this notebook
    const notesInNotebook = notes.filter(n => n.notebookId === notebook.id && !n.isTrashed);
    const noteCount = notesInNotebook.length;
    const requiresConfirmation = noteCount >= 5;

    const handleDelete = async () => {
        if (!token) return;
        if (requiresConfirmation && confirmText !== notebook.name) {
            toast.error('Digite o nome do notebook para confirmar');
            return;
        }

        setIsDeleting(true);
        try {
            if (deleteOption === 'delete' && noteCount > 0) {
                // Delete all notes in the notebook first
                const noteIds = notesInNotebook.map(n => n.id);
                await notesApi.bulkDelete(token, noteIds);
                noteIds.forEach(id => removeNote(id));
            } else if (deleteOption === 'move' && noteCount > 0) {
                // Move notes to no notebook (null)
                for (const note of notesInNotebook) {
                    await notesApi.update(token, note.id, { notebookId: null });
                    updateNote(note.id, { notebookId: null, notebook: null });
                }
            }

            // Delete the notebook
            await notebooksApi.delete(token, notebook.id);
            removeNotebook(notebook.id);

            toast.success(`Notebook "${notebook.name}" deletado`);
            setIsOpen(false);
            onDeleted?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Falha ao deletar notebook');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <div onClick={() => setIsOpen(true)}>
                {children}
            </div>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => !isDeleting && setIsOpen(false)}
                    />

                    {/* Dialog */}
                    <div className="relative z-10 w-full max-w-md bg-card rounded-xl shadow-xl border p-6 mx-4">
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-destructive" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold">Deletar Notebook</h2>
                                <p className="text-sm text-muted-foreground">
                                    {notebook.name}
                                </p>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="space-y-4">
                            {noteCount > 0 ? (
                                <>
                                    <p className="text-sm text-muted-foreground">
                                        Este notebook contém <strong>{noteCount} nota{noteCount > 1 ? 's' : ''}</strong>.
                                        O que deseja fazer com elas?
                                    </p>

                                    {/* Options */}
                                    <div className="space-y-2">
                                        <label className={cn(
                                            'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                                            deleteOption === 'move' && 'border-primary bg-primary/5'
                                        )}>
                                            <input
                                                type="radio"
                                                name="deleteOption"
                                                checked={deleteOption === 'move'}
                                                onChange={() => setDeleteOption('move')}
                                                className="accent-primary"
                                            />
                                            <div className="flex-1">
                                                <p className="font-medium">Mover para "Todas as Notas"</p>
                                                <p className="text-xs text-muted-foreground">
                                                    As notas serão mantidas, apenas removidas do notebook
                                                </p>
                                            </div>
                                        </label>

                                        <label className={cn(
                                            'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                                            deleteOption === 'delete' && 'border-destructive bg-destructive/5'
                                        )}>
                                            <input
                                                type="radio"
                                                name="deleteOption"
                                                checked={deleteOption === 'delete'}
                                                onChange={() => setDeleteOption('delete')}
                                                className="accent-destructive"
                                            />
                                            <div className="flex-1">
                                                <p className="font-medium text-destructive">Deletar tudo permanentemente</p>
                                                <p className="text-xs text-muted-foreground">
                                                    O notebook e todas as notas serão excluídos para sempre
                                                </p>
                                            </div>
                                        </label>
                                    </div>

                                    {/* Confirmation input for many notes */}
                                    {requiresConfirmation && deleteOption === 'delete' && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-destructive font-medium">
                                                ⚠️ Ação irreversível
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Digite <strong>{notebook.name}</strong> para confirmar:
                                            </p>
                                            <input
                                                type="text"
                                                value={confirmText}
                                                onChange={(e) => setConfirmText(e.target.value)}
                                                placeholder={notebook.name}
                                                className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
                                            />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Este notebook está vazio e será deletado permanentemente.
                                </p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setIsOpen(false)}
                                disabled={isDeleting}
                                className="px-4 py-2 text-sm rounded-lg hover:bg-accent transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting || (requiresConfirmation && deleteOption === 'delete' && confirmText !== notebook.name)}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors',
                                    'disabled:opacity-50 disabled:cursor-not-allowed',
                                    deleteOption === 'delete'
                                        ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                )}
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Deletando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        <span>Deletar</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
