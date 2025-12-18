'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useNotesStore } from '@/store/notes-store';
import { notesApi, searchApi } from '@/lib/api';
import { toast } from 'sonner';
import {
    ArrowDown,
    ArrowUp,
    Calendar,
    ChevronDown,
    Command,
    CornerDownLeft,
    FileText,
    Filter,
    Loader2,
    Plus,
    Search,
    Settings,
    SortAsc,
    User,
    X,
} from 'lucide-react';

interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type SortOption = 'recent' | 'created' | 'title';
type FilterOption = 'all' | 'title' | 'content';

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
    const { token } = useAuthStore();
    const { notes, selectNote, addNote } = useNotesStore();
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[] | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [sortBy, setSortBy] = useState<SortOption>('recent');
    const [filterBy, setFilterBy] = useState<FilterOption>('all');
    const [showFilters, setShowFilters] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset state when opening
    useEffect(() => {
        if (open) {
            setQuery('');
            setSearchResults(null);
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    // Group notes by date
    const groupedNotes = useMemo(() => {
        const items = searchResults || notes.filter(n => !n.isTrashed);

        // Sort
        const sorted = [...items].sort((a, b) => {
            if (sortBy === 'title') return a.title.localeCompare(b.title);
            if (sortBy === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

        // Group by date
        const groups: { label: string; notes: any[] }[] = [];
        const today: any[] = [];
        const yesterday: any[] = [];
        const thisWeek: any[] = [];
        const older: any[] = [];

        sorted.slice(0, 20).forEach(note => {
            const date = new Date(note.updatedAt);
            if (isToday(date)) today.push(note);
            else if (isYesterday(date)) yesterday.push(note);
            else if (isThisWeek(date)) thisWeek.push(note);
            else older.push(note);
        });

        if (today.length) groups.push({ label: 'Hoje', notes: today });
        if (yesterday.length) groups.push({ label: 'Ontem', notes: yesterday });
        if (thisWeek.length) groups.push({ label: 'Esta semana', notes: thisWeek });
        if (older.length) groups.push({ label: 'Mais antigos', notes: older });

        return groups;
    }, [notes, searchResults, sortBy]);

    // Flatten for keyboard navigation
    const allItems = useMemo(() => {
        return groupedNotes.flatMap(g => g.notes);
    }, [groupedNotes]);

    // Search handler - with local fallback
    const handleSearch = useCallback(async (searchQuery: string) => {
        setQuery(searchQuery);
        setSelectedIndex(0);

        if (!searchQuery.trim()) {
            setSearchResults(null);
            return;
        }

        // Try API search first, fallback to local filtering
        if (token) {
            setIsSearching(true);
            try {
                const result = await searchApi.search(token, searchQuery, {
                    limit: 20,
                });
                setSearchResults(result.hits);
                setIsSearching(false);
                return;
            } catch (error) {
                console.error('API search failed, using local search:', error);
            }
            setIsSearching(false);
        }

        // Local fallback search
        const lowerQuery = searchQuery.toLowerCase();
        const filtered = notes.filter(note => {
            if (note.isTrashed) return false;
            const titleMatch = note.title.toLowerCase().includes(lowerQuery);
            const contentMatch = note.plainText?.toLowerCase().includes(lowerQuery);
            return filterBy === 'title' ? titleMatch : (filterBy === 'content' ? contentMatch : (titleMatch || contentMatch));
        });
        setSearchResults(filtered);
    }, [token, notes, filterBy]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, allItems.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (allItems[selectedIndex]) {
                    selectNote(allItems[selectedIndex].id);
                    onOpenChange(false);
                }
                break;
            case 'Escape':
                onOpenChange(false);
                break;
        }
    }, [allItems, selectedIndex, selectNote, onOpenChange]);

    // Create new note
    const handleCreateNote = async () => {
        if (!token) return;
        try {
            const note = await notesApi.create(token, { title: query || 'Untitled' });
            addNote(note);
            selectNote(note.id);
            onOpenChange(false);
            toast.success('Nota criada');
        } catch (error) {
            toast.error('Falha ao criar nota');
        }
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
                <Dialog.Content className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-card border rounded-xl shadow-2xl z-50 overflow-hidden">
                    {/* Search Input */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b">
                        <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => handleSearch(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Pesquise ou faça uma pergunta..."
                            className="flex-1 bg-transparent text-lg focus:outline-none placeholder:text-muted-foreground/60"
                        />
                        {isSearching && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
                        <Dialog.Close asChild>
                            <button className="p-1 rounded hover:bg-accent">
                                <X className="w-4 h-4" />
                            </button>
                        </Dialog.Close>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
                        <button
                            onClick={() => setSortBy(s => s === 'recent' ? 'title' : s === 'title' ? 'created' : 'recent')}
                            className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-colors',
                                'hover:bg-accent border'
                            )}
                        >
                            <SortAsc className="w-3.5 h-3.5" />
                            <span>Ordenar</span>
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        <button
                            onClick={() => setFilterBy(f => f === 'all' ? 'title' : f === 'title' ? 'content' : 'all')}
                            className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-colors',
                                filterBy !== 'all' ? 'bg-primary/10 text-primary border-primary/30' : 'hover:bg-accent',
                                'border'
                            )}
                        >
                            <span>
                                {filterBy === 'all' ? 'Aa' : filterBy === 'title' ? 'Título' : 'Conteúdo'}
                            </span>
                            {filterBy === 'title' && <span className="text-xs">Somente título</span>}
                        </button>
                        <button
                            className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-colors',
                                'hover:bg-accent border'
                            )}
                        >
                            <User className="w-3.5 h-3.5" />
                            <span>Criado por</span>
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        <button
                            className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-colors',
                                'hover:bg-accent border'
                            )}
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Data</span>
                            <ChevronDown className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Results */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {groupedNotes.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">
                                <Search className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                <p>Nenhum resultado encontrado</p>
                            </div>
                        ) : (
                            groupedNotes.map((group, gi) => (
                                <div key={group.label}>
                                    <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/20">
                                        {group.label}
                                    </div>
                                    {group.notes.map((note, ni) => {
                                        const globalIndex = groupedNotes
                                            .slice(0, gi)
                                            .reduce((acc, g) => acc + g.notes.length, 0) + ni;
                                        return (
                                            <button
                                                key={note.id}
                                                onClick={() => {
                                                    selectNote(note.id);
                                                    onOpenChange(false);
                                                }}
                                                className={cn(
                                                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                                                    globalIndex === selectedIndex
                                                        ? 'bg-primary/10'
                                                        : 'hover:bg-accent'
                                                )}
                                            >
                                                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{note.title}</p>
                                                    {note.plainText && (
                                                        <p className="text-sm text-muted-foreground truncate">
                                                            {note.plainText.slice(0, 60)}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="text-xs text-muted-foreground shrink-0">
                                                    {format(new Date(note.updatedAt), 'd MMM', { locale: ptBR })}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Quick Actions Footer */}
                    <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleCreateNote}
                                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Nova página</span>
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                                <ArrowUp className="w-3 h-3" />
                                <ArrowDown className="w-3 h-3" />
                                Selecionar
                            </span>
                            <span className="flex items-center gap-1">
                                <CornerDownLeft className="w-3 h-3" />
                                Abrir
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">Esc</kbd>
                                Fechar
                            </span>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
