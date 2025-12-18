'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useNotesStore } from '@/store/notes-store';
import { notesApi, notebooksApi, tagsApi } from '@/lib/api';
import { Sidebar } from '@/components/layout/sidebar';
import { NoteList } from '@/components/notes/note-list';
import { NoteEditor } from '@/components/editor/note-editor';
import { CommandPalette } from '@/components/search/command-palette';
import { Loader2 } from 'lucide-react';

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const { isAuthenticated, token } = useAuthStore();
    const { setNotes, setNotebooks, setTags, setIsLoading, selectedNoteId, showTrash, selectedNotebookId, selectedTagId } = useNotesStore();
    const [isInitialized, setIsInitialized] = useState(false);
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

    // Ctrl+K keyboard shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setCommandPaletteOpen(true);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        // Check auth on mount
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        // Fetch initial data
        const fetchData = async () => {
            if (!token) return;

            setIsLoading(true);
            try {
                const [notes, notebooks, tags] = await Promise.all([
                    notesApi.getAll(token, { trashed: showTrash, notebookId: selectedNotebookId || undefined, tagId: selectedTagId || undefined }),
                    notebooksApi.getAll(token),
                    tagsApi.getAll(token),
                ]);

                setNotes(notes);
                setNotebooks(notebooks);
                setTags(tags);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setIsLoading(false);
                setIsInitialized(true);
            }
        };

        fetchData();
    }, [isAuthenticated, token, showTrash, selectedNotebookId, selectedTagId]);

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isInitialized) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground">Loading your notes...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-background">
            <Sidebar />
            <NoteList />
            <main className="flex-1 flex flex-col min-w-0">
                {selectedNoteId ? (
                    <NoteEditor noteId={selectedNoteId} />
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <div className="text-center space-y-2">
                            <p className="text-lg">Select a note to view</p>
                            <p className="text-sm">or press <kbd className="px-2 py-1 rounded bg-muted border text-xs">Ctrl+K</kbd> to search</p>
                        </div>
                    </div>
                )}
            </main>

            {/* Command Palette */}
            <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
        </div>
    );
}
