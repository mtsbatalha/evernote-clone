import { create } from 'zustand';

export interface Note {
    id: string;
    title: string;
    content: any;
    plainText?: string;
    isPinned: boolean;
    isTrashed: boolean;
    createdAt: string;
    updatedAt: string;
    notebookId: string | null;
    notebook?: { id: string; name: string; color: string } | null;
    tags?: { tag: { id: string; name: string; color: string } }[];
    author?: { id: string; name: string; avatar: string | null };
    _count?: { attachments: number };
}

export interface Notebook {
    id: string;
    name: string;
    color: string;
    isDefault: boolean;
    _count?: { notes: number };
}

export interface Tag {
    id: string;
    name: string;
    color: string;
    _count?: { notes: number };
}

interface NotesState {
    notes: Note[];
    notebooks: Notebook[];
    tags: Tag[];
    selectedNoteId: string | null;
    selectedNotebookId: string | null;
    selectedTagId: string | null;
    showTrash: boolean;
    isLoading: boolean;
    searchQuery: string;

    // Actions
    setNotes: (notes: Note[]) => void;
    addNote: (note: Note) => void;
    updateNote: (id: string, updates: Partial<Note>) => void;
    removeNote: (id: string) => void;

    setNotebooks: (notebooks: Notebook[]) => void;
    addNotebook: (notebook: Notebook) => void;
    updateNotebook: (id: string, updates: Partial<Notebook>) => void;
    removeNotebook: (id: string) => void;

    setTags: (tags: Tag[]) => void;
    addTag: (tag: Tag) => void;
    updateTag: (id: string, updates: Partial<Tag>) => void;
    removeTag: (id: string) => void;

    selectNote: (id: string | null, highlightQuery?: string) => void;
    selectNotebook: (id: string | null) => void;
    selectTag: (id: string | null) => void;
    setShowTrash: (show: boolean) => void;
    setIsLoading: (loading: boolean) => void;
    setSearchQuery: (query: string) => void;
    searchHighlight: string | null;
    clearSearchHighlight: () => void;
}

export const useNotesStore = create<NotesState>((set) => ({
    notes: [],
    notebooks: [],
    tags: [],
    selectedNoteId: null,
    selectedNotebookId: null,
    selectedTagId: null,
    showTrash: false,
    isLoading: false,
    searchQuery: '',
    searchHighlight: null,

    setNotes: (notes) => set({ notes }),
    addNote: (note) => set((state) => ({ notes: [note, ...state.notes] })),
    updateNote: (id, updates) =>
        set((state) => ({
            notes: state.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
        })),
    removeNote: (id) =>
        set((state) => ({
            notes: state.notes.filter((n) => n.id !== id),
            selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
        })),

    setNotebooks: (notebooks) => set({ notebooks }),
    addNotebook: (notebook) =>
        set((state) => ({ notebooks: [...state.notebooks, notebook] })),
    updateNotebook: (id, updates) =>
        set((state) => ({
            notebooks: state.notebooks.map((n) =>
                n.id === id ? { ...n, ...updates } : n
            ),
        })),
    removeNotebook: (id) =>
        set((state) => ({
            notebooks: state.notebooks.filter((n) => n.id !== id),
            selectedNotebookId:
                state.selectedNotebookId === id ? null : state.selectedNotebookId,
        })),

    setTags: (tags) => set({ tags }),
    addTag: (tag) => set((state) => ({ tags: [...state.tags, tag] })),
    updateTag: (id, updates) =>
        set((state) => ({
            tags: state.tags.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
    removeTag: (id) =>
        set((state) => ({
            tags: state.tags.filter((t) => t.id !== id),
            selectedTagId: state.selectedTagId === id ? null : state.selectedTagId,
        })),

    selectNote: (id, highlightQuery) => set({ selectedNoteId: id, searchHighlight: highlightQuery || null }),
    selectNotebook: (id) =>
        set({ selectedNotebookId: id, selectedTagId: null, showTrash: false }),
    selectTag: (id) =>
        set({ selectedTagId: id, selectedNotebookId: null, showTrash: false }),
    setShowTrash: (show) =>
        set({
            showTrash: show,
            selectedNotebookId: null,
            selectedTagId: null,
        }),
    setIsLoading: (loading) => set({ isLoading: loading }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    clearSearchHighlight: () => set({ searchHighlight: null }),
}));
