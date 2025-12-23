'use client';

import { useMemo, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useNotesStore, Note } from '@/store/notes-store';
import { notesApi, searchApi } from '@/lib/api';
import {
    CheckSquare,
    FileText,
    Loader2,
    MoreHorizontal,
    Pin,
    Plus,
    Search,
    Square,
    Trash2,
    Undo2,
    X,
} from 'lucide-react';

export function NoteList() {
    const { token } = useAuthStore();
    const {
        notes,
        selectedNoteId,
        selectedNotebookId,
        selectedTagId,
        showTrash,
        isLoading,
        searchQuery,
        setSearchQuery,
        selectNote,
        addNote,
        updateNote,
        removeNote,
    } = useNotesStore();

    const [isCreating, setIsCreating] = useState(false);
    const [searchResults, setSearchResults] = useState<any[] | null>(null);

    // Multi-select state
    const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
    const [isBulkOperating, setIsBulkOperating] = useState(false);

    // Filter notes based on current view
    const filteredNotes = useMemo(() => {
        if (searchResults) return searchResults;

        return notes.filter((note) => {
            if (showTrash) return note.isTrashed;
            if (!note.isTrashed) {
                if (selectedNotebookId) return note.notebookId === selectedNotebookId;
                if (selectedTagId) return note.tags?.some((t) => t.tag.id === selectedTagId);
                return true;
            }
            return false;
        });
    }, [notes, searchResults, showTrash, selectedNotebookId, selectedTagId]);

    // Sort: pinned first, then by updatedAt
    const sortedNotes = useMemo(() => {
        return [...filteredNotes].sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
    }, [filteredNotes]);

    // Clear selection when changing views
    const clearSelection = useCallback(() => {
        setSelectedNotes(new Set());
        setIsMultiSelectMode(false);
        setLastSelectedIndex(null);
    }, []);

    // Handle note selection with shift+click support
    const handleNoteClick = useCallback((note: Note, index: number, event: React.MouseEvent) => {
        if (isMultiSelectMode || event.shiftKey || event.ctrlKey || event.metaKey) {
            event.preventDefault();

            if (!isMultiSelectMode) {
                setIsMultiSelectMode(true);
            }

            if (event.shiftKey && lastSelectedIndex !== null) {
                // Range select
                const start = Math.min(lastSelectedIndex, index);
                const end = Math.max(lastSelectedIndex, index);
                const newSelected = new Set(selectedNotes);

                for (let i = start; i <= end; i++) {
                    newSelected.add(sortedNotes[i].id);
                }

                setSelectedNotes(newSelected);
            } else {
                // Toggle single selection
                const newSelected = new Set(selectedNotes);
                if (newSelected.has(note.id)) {
                    newSelected.delete(note.id);
                } else {
                    newSelected.add(note.id);
                }
                setSelectedNotes(newSelected);
                setLastSelectedIndex(index);
            }

            // Exit multi-select if no items selected
            if (selectedNotes.size === 0) {
                setIsMultiSelectMode(false);
            }
        } else {
            // Normal click - open note
            clearSelection();
            selectNote(note.id);
        }
    }, [isMultiSelectMode, lastSelectedIndex, selectedNotes, sortedNotes, clearSelection, selectNote]);

    // Toggle all notes selection
    const handleSelectAll = useCallback(() => {
        if (selectedNotes.size === sortedNotes.length) {
            setSelectedNotes(new Set());
        } else {
            setSelectedNotes(new Set(sortedNotes.map(n => n.id)));
        }
        setIsMultiSelectMode(true);
    }, [selectedNotes.size, sortedNotes]);

    // Bulk trash selected notes
    const handleBulkTrash = useCallback(async () => {
        if (!token || selectedNotes.size === 0) return;

        setIsBulkOperating(true);
        try {
            const noteIds = Array.from(selectedNotes);
            await notesApi.bulkTrash(token, noteIds);

            noteIds.forEach(id => {
                updateNote(id, { isTrashed: true });
            });

            toast.success(`${noteIds.length} nota${noteIds.length > 1 ? 's' : ''} movida${noteIds.length > 1 ? 's' : ''} para lixeira`);
            clearSelection();
        } catch (error) {
            toast.error('Falha ao mover notas para lixeira');
        } finally {
            setIsBulkOperating(false);
        }
    }, [token, selectedNotes, updateNote, clearSelection]);

    // Bulk delete selected notes
    const handleBulkDelete = useCallback(async () => {
        if (!token || selectedNotes.size === 0) return;

        setIsBulkOperating(true);
        try {
            const noteIds = Array.from(selectedNotes);
            await notesApi.bulkDelete(token, noteIds);

            noteIds.forEach(id => {
                removeNote(id);
            });

            toast.success(`${noteIds.length} nota${noteIds.length > 1 ? 's' : ''} deletada${noteIds.length > 1 ? 's' : ''} permanentemente`);
            clearSelection();
        } catch (error) {
            toast.error('Falha ao deletar notas');
        } finally {
            setIsBulkOperating(false);
        }
    }, [token, selectedNotes, removeNote, clearSelection]);

    // Bulk restore selected notes
    const handleBulkRestore = useCallback(async () => {
        if (!token || selectedNotes.size === 0) return;

        setIsBulkOperating(true);
        try {
            const noteIds = Array.from(selectedNotes);

            // Restore each note
            for (const id of noteIds) {
                await notesApi.update(token, id, { isTrashed: false });
                updateNote(id, { isTrashed: false });
            }

            toast.success(`${noteIds.length} nota${noteIds.length > 1 ? 's' : ''} restaurada${noteIds.length > 1 ? 's' : ''}`);
            clearSelection();
        } catch (error) {
            toast.error('Falha ao restaurar notas');
        } finally {
            setIsBulkOperating(false);
        }
    }, [token, selectedNotes, updateNote, clearSelection]);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);

        if (!query.trim()) {
            setSearchResults(null);
            return;
        }

        if (!token) return;

        try {
            const result = await searchApi.search(token, query);
            setSearchResults(result.hits.map((hit) => ({
                ...hit,
                id: hit.id,
                title: hit.title,
                updatedAt: new Date(hit.updatedAt).toISOString(),
            })));
        } catch (error) {
            console.error('Search failed:', error);
        }
    };

    const handleCreateNote = async () => {
        if (!token) return;

        setIsCreating(true);
        try {
            const note = await notesApi.create(token, {
                title: 'Untitled',
                notebookId: selectedNotebookId || undefined,
            });
            addNote(note);
            selectNote(note.id);
            toast.success('Note created');
        } catch (error) {
            toast.error('Failed to create note');
        } finally {
            setIsCreating(false);
        }
    };

    const handleTogglePin = async (note: Note, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!token) return;

        try {
            await notesApi.update(token, note.id, { isPinned: !note.isPinned });
            updateNote(note.id, { isPinned: !note.isPinned });
        } catch (error) {
            toast.error('Failed to update note');
        }
    };

    const handleTrash = async (note: Note, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!token) return;

        try {
            await notesApi.update(token, note.id, { isTrashed: true });
            updateNote(note.id, { isTrashed: true });
            if (selectedNoteId === note.id) selectNote(null);
            toast.success('Note moved to trash');
        } catch (error) {
            toast.error('Failed to trash note');
        }
    };

    const handleRestore = async (note: Note, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!token) return;

        try {
            await notesApi.update(token, note.id, { isTrashed: false });
            updateNote(note.id, { isTrashed: false });
            toast.success('Note restored');
        } catch (error) {
            toast.error('Failed to restore note');
        }
    };

    const handleDelete = async (note: Note, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!token) return;

        try {
            await notesApi.delete(token, note.id);
            removeNote(note.id);
            toast.success('Note deleted permanently');
        } catch (error) {
            toast.error('Failed to delete note');
        }
    };

    const getTitle = () => {
        if (showTrash) return 'Trash';
        if (selectedNotebookId) {
            const notebook = useNotesStore.getState().notebooks.find((n) => n.id === selectedNotebookId);
            return notebook?.name || 'Notebook';
        }
        if (selectedTagId) {
            const tag = useNotesStore.getState().tags.find((t) => t.id === selectedTagId);
            return `#${tag?.name || 'Tag'}`;
        }
        return 'All Notes';
    };

    return (
        <div className="w-80 h-screen flex flex-col bg-background border-r shrink-0 relative">
            {/* Header */}
            <div className="p-4 border-b space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-lg">{getTitle()}</h2>
                    <div className="flex items-center gap-2">
                        {sortedNotes.length > 0 && (
                            <button
                                onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                                className={cn(
                                    'p-2 rounded-lg transition-colors',
                                    isMultiSelectMode
                                        ? 'bg-primary/10 text-primary'
                                        : 'hover:bg-accent text-muted-foreground'
                                )}
                                title="Seleção múltipla"
                            >
                                <CheckSquare className="w-4 h-4" />
                            </button>
                        )}
                        {!showTrash && (
                            <button
                                onClick={handleCreateNote}
                                disabled={isCreating}
                                className={cn(
                                    'p-2 rounded-lg bg-primary text-primary-foreground',
                                    'hover:bg-primary/90 transition-colors',
                                    'disabled:opacity-50'
                                )}
                            >
                                {isCreating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Plus className="w-4 h-4" />
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Search notes..."
                        className={cn(
                            'w-full pl-9 pr-4 py-2 rounded-lg border bg-background text-sm',
                            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
                        )}
                    />
                </div>
            </div>

            {/* Multi-select toolbar */}
            {isMultiSelectMode && (
                <div className="p-3 border-b bg-muted/30 flex items-center gap-2">
                    <button
                        onClick={handleSelectAll}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg hover:bg-accent transition-colors"
                    >
                        {selectedNotes.size === sortedNotes.length ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                            <Square className="w-4 h-4" />
                        )}
                        <span>{selectedNotes.size > 0 ? `${selectedNotes.size} selecionada${selectedNotes.size > 1 ? 's' : ''}` : 'Selecionar todas'}</span>
                    </button>

                    <div className="flex-1" />

                    <button
                        onClick={clearSelection}
                        className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
                        title="Cancelar seleção"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Floating action bar for selected notes */}
            {selectedNotes.size > 0 && (
                <div className="absolute bottom-4 left-4 right-4 z-10 p-3 bg-card border rounded-xl shadow-lg flex items-center gap-2">
                    <span className="text-sm font-medium flex-1">
                        {selectedNotes.size} nota{selectedNotes.size > 1 ? 's' : ''}
                    </span>

                    {showTrash ? (
                        <>
                            <button
                                onClick={handleBulkRestore}
                                disabled={isBulkOperating}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {isBulkOperating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                                <span>Restaurar</span>
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                disabled={isBulkOperating}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                            >
                                {isBulkOperating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                <span>Deletar</span>
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleBulkTrash}
                            disabled={isBulkOperating}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                        >
                            {isBulkOperating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            <span>Mover para Lixeira</span>
                        </button>
                    )}
                </div>
            )}

            {/* Note list */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : sortedNotes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <FileText className="w-12 h-12 text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground">
                            {showTrash ? 'Trash is empty' : 'No notes yet'}
                        </p>
                        {!showTrash && (
                            <button
                                onClick={handleCreateNote}
                                className="mt-4 text-sm text-primary hover:underline"
                            >
                                Create your first note
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="divide-y pb-20">
                        {sortedNotes.map((note, index) => (
                            <div
                                key={note.id}
                                onClick={(e) => handleNoteClick(note, index, e)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => e.key === 'Enter' && selectNote(note.id)}
                                className={cn(
                                    'w-full p-4 text-left transition-colors group cursor-pointer',
                                    selectedNoteId === note.id && !isMultiSelectMode
                                        ? 'bg-primary/5 border-l-2 border-primary'
                                        : 'hover:bg-accent border-l-2 border-transparent',
                                    selectedNotes.has(note.id) && 'bg-primary/10'
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    {/* Checkbox for multi-select */}
                                    {isMultiSelectMode && (
                                        <div className="pt-0.5">
                                            {selectedNotes.has(note.id) ? (
                                                <CheckSquare className="w-4 h-4 text-primary" />
                                            ) : (
                                                <Square className="w-4 h-4 text-muted-foreground" />
                                            )}
                                        </div>
                                    )}

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            {note.isPinned && (
                                                <Pin className="w-3 h-3 text-primary shrink-0" />
                                            )}
                                            <h3 className="font-medium truncate">{note.title}</h3>
                                        </div>
                                        {note.plainText && (
                                            <p className="text-sm text-muted-foreground truncate mt-1">
                                                {note.plainText.slice(0, 100)}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(note.updatedAt), 'MMM d, yyyy')}
                                            </span>
                                            {note.notebook && (
                                                <span
                                                    className="text-xs px-1.5 py-0.5 rounded"
                                                    style={{
                                                        backgroundColor: `${note.notebook.color}20`,
                                                        color: note.notebook.color,
                                                    }}
                                                >
                                                    {note.notebook.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions (only when not in multi-select mode) */}
                                    {!isMultiSelectMode && (
                                        <div className={cn(
                                            'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
                                            selectedNoteId === note.id && 'opacity-100'
                                        )}>
                                            {showTrash ? (
                                                <>
                                                    <button
                                                        onClick={(e) => handleRestore(note, e)}
                                                        className="p-1.5 rounded hover:bg-background"
                                                        title="Restore"
                                                    >
                                                        <Undo2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDelete(note, e)}
                                                        className="p-1.5 rounded hover:bg-background text-destructive"
                                                        title="Delete permanently"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={(e) => handleTogglePin(note, e)}
                                                        className={cn(
                                                            'p-1.5 rounded hover:bg-background',
                                                            note.isPinned && 'text-primary'
                                                        )}
                                                        title={note.isPinned ? 'Unpin' : 'Pin'}
                                                    >
                                                        <Pin className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleTrash(note, e)}
                                                        className="p-1.5 rounded hover:bg-background text-muted-foreground hover:text-destructive"
                                                        title="Move to trash"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
