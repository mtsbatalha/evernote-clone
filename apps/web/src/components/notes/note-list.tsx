'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useNotesStore, Note } from '@/store/notes-store';
import { notesApi, searchApi } from '@/lib/api';
import {
    FileText,
    Loader2,
    MoreHorizontal,
    Pin,
    Plus,
    Search,
    Trash2,
    Undo2,
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
        <div className="w-80 h-screen flex flex-col bg-background border-r shrink-0">
            {/* Header */}
            <div className="p-4 border-b space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-lg">{getTitle()}</h2>
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
                    <div className="divide-y">
                        {sortedNotes.map((note) => (
                            <div
                                key={note.id}
                                onClick={() => selectNote(note.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => e.key === 'Enter' && selectNote(note.id)}
                                className={cn(
                                    'w-full p-4 text-left transition-colors group cursor-pointer',
                                    selectedNoteId === note.id
                                        ? 'bg-primary/5 border-l-2 border-primary'
                                        : 'hover:bg-accent border-l-2 border-transparent'
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
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

                                    {/* Actions */}
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
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
