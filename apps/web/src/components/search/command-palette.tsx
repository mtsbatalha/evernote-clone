'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { format, isToday, isYesterday, isThisWeek, subDays, subWeeks, subMonths } from 'date-fns';
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
    Check,
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
type DateFilter = 'all' | 'today' | 'week' | 'month';

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
    const { token } = useAuthStore();
    const { notes, selectNote, addNote } = useNotesStore();
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[] | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [sortBy, setSortBy] = useState<SortOption>('recent');
    const [filterBy, setFilterBy] = useState<FilterOption>('all');
    const [dateFilter, setDateFilter] = useState<DateFilter>('all');
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

    // Re-run search when filterBy changes (if there's a query)
    useEffect(() => {
        if (query.trim()) {
            // Perform local search with current filter
            const lowerQuery = query.toLowerCase();
            const filtered = notes.filter(note => {
                if (note.isTrashed) return false;
                const titleMatch = note.title?.toLowerCase().includes(lowerQuery) || false;
                let contentMatch = false;
                if (note.plainText) {
                    contentMatch = note.plainText.toLowerCase().includes(lowerQuery);
                }
                if (filterBy === 'title') return titleMatch;
                if (filterBy === 'content') return contentMatch;
                return titleMatch || contentMatch;
            });
            setSearchResults(filtered);
        }
    }, [filterBy, query, notes]);

    // Group notes by date
    const groupedNotes = useMemo(() => {
        let items = searchResults || notes.filter(n => !n.isTrashed);

        // Apply date filter
        if (dateFilter !== 'all') {
            const now = new Date();
            items = items.filter(note => {
                const noteDate = new Date(note.updatedAt);
                if (dateFilter === 'today') return isToday(noteDate);
                if (dateFilter === 'week') return noteDate >= subWeeks(now, 1);
                if (dateFilter === 'month') return noteDate >= subMonths(now, 1);
                return true;
            });
        }

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
    }, [notes, searchResults, sortBy, dateFilter]);

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

        const lowerQuery = searchQuery.toLowerCase();

        // Local search function (works without API)
        const performLocalSearch = () => {
            console.log('Performing local search for:', lowerQuery, 'in', notes.length, 'notes');
            const filtered = notes.filter(note => {
                if (note.isTrashed) return false;

                // Search in title
                const titleMatch = note.title?.toLowerCase().includes(lowerQuery) || false;

                // Search in plainText or content
                let contentMatch = false;
                if (note.plainText) {
                    contentMatch = note.plainText.toLowerCase().includes(lowerQuery);
                } else if (note.content) {
                    // Extract text from TipTap content
                    const extractText = (node: any): string => {
                        if (!node) return '';
                        if (node.type === 'text') return node.text || '';
                        if (node.content) return node.content.map(extractText).join(' ');
                        return '';
                    };
                    const contentText = extractText(note.content);
                    contentMatch = contentText.toLowerCase().includes(lowerQuery);
                }

                if (filterBy === 'title') return titleMatch;
                if (filterBy === 'content') return contentMatch;
                return titleMatch || contentMatch;
            });
            console.log('Local search found:', filtered.length, 'results');
            return filtered;
        };

        // Run local search immediately for instant results
        const localResults = performLocalSearch();
        setSearchResults(localResults);

        // Try API search if available (will update results if successful)
        if (token) {
            setIsSearching(true);
            try {
                const result = await searchApi.search(token, searchQuery, {
                    limit: 20,
                });
                console.log('API search result:', result);
                if (result && result.hits && result.hits.length > 0) {
                    setSearchResults(result.hits);
                }
            } catch (error) {
                console.error('API search failed:', error);
                // Keep local results
            }
            setIsSearching(false);
        }
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
                    selectNote(allItems[selectedIndex].id, query.trim() || undefined);
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
                    {/* Visually hidden title for accessibility */}
                    <Dialog.Title className="sr-only">Pesquisar notas</Dialog.Title>

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
                        {/* Sort Dropdown */}
                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                                <button
                                    className={cn(
                                        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-colors',
                                        sortBy !== 'recent' ? 'bg-primary/10 text-primary border-primary/30' : 'hover:bg-accent',
                                        'border'
                                    )}
                                >
                                    <SortAsc className="w-3.5 h-3.5" />
                                    <span>{sortBy === 'recent' ? 'Recentes' : sortBy === 'title' ? 'Título' : 'Criação'}</span>
                                    <ChevronDown className="w-3 h-3" />
                                </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                                <DropdownMenu.Content className="min-w-[160px] bg-card border rounded-lg shadow-xl p-1 z-[100]">
                                    <DropdownMenu.Item
                                        className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer hover:bg-accent outline-none"
                                        onSelect={() => setSortBy('recent')}
                                    >
                                        {sortBy === 'recent' && <Check className="w-4 h-4" />}
                                        <span className={sortBy !== 'recent' ? 'pl-6' : ''}>Mais recentes</span>
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                        className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer hover:bg-accent outline-none"
                                        onSelect={() => setSortBy('created')}
                                    >
                                        {sortBy === 'created' && <Check className="w-4 h-4" />}
                                        <span className={sortBy !== 'created' ? 'pl-6' : ''}>Data de criação</span>
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                        className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer hover:bg-accent outline-none"
                                        onSelect={() => setSortBy('title')}
                                    >
                                        {sortBy === 'title' && <Check className="w-4 h-4" />}
                                        <span className={sortBy !== 'title' ? 'pl-6' : ''}>Título (A-Z)</span>
                                    </DropdownMenu.Item>
                                </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                        </DropdownMenu.Root>

                        {/* Filter By Dropdown */}
                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                                <button
                                    className={cn(
                                        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-colors',
                                        filterBy !== 'all' ? 'bg-primary/10 text-primary border-primary/30' : 'hover:bg-accent',
                                        'border'
                                    )}
                                >
                                    <span>{filterBy === 'all' ? 'Tudo' : filterBy === 'title' ? 'Título' : 'Conteúdo'}</span>
                                    <ChevronDown className="w-3 h-3" />
                                </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                                <DropdownMenu.Content className="min-w-[160px] bg-card border rounded-lg shadow-xl p-1 z-[100]">
                                    <DropdownMenu.Item
                                        className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer hover:bg-accent outline-none"
                                        onSelect={() => setFilterBy('all')}
                                    >
                                        {filterBy === 'all' && <Check className="w-4 h-4" />}
                                        <span className={filterBy !== 'all' ? 'pl-6' : ''}>Tudo</span>
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                        className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer hover:bg-accent outline-none"
                                        onSelect={() => setFilterBy('title')}
                                    >
                                        {filterBy === 'title' && <Check className="w-4 h-4" />}
                                        <span className={filterBy !== 'title' ? 'pl-6' : ''}>Somente título</span>
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                        className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer hover:bg-accent outline-none"
                                        onSelect={() => setFilterBy('content')}
                                    >
                                        {filterBy === 'content' && <Check className="w-4 h-4" />}
                                        <span className={filterBy !== 'content' ? 'pl-6' : ''}>Somente conteúdo</span>
                                    </DropdownMenu.Item>
                                </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                        </DropdownMenu.Root>

                        {/* Criado por - placeholder, single user app */}
                        <button
                            className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-colors',
                                'hover:bg-accent border opacity-50 cursor-not-allowed'
                            )}
                            title="Em breve"
                        >
                            <User className="w-3.5 h-3.5" />
                            <span>Criado por</span>
                        </button>

                        {/* Date Filter Dropdown */}
                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                                <button
                                    className={cn(
                                        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-colors',
                                        dateFilter !== 'all' ? 'bg-primary/10 text-primary border-primary/30' : 'hover:bg-accent',
                                        'border'
                                    )}
                                >
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>
                                        {dateFilter === 'all' ? 'Qualquer data' :
                                            dateFilter === 'today' ? 'Hoje' :
                                                dateFilter === 'week' ? 'Esta semana' : 'Este mês'}
                                    </span>
                                    <ChevronDown className="w-3 h-3" />
                                </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                                <DropdownMenu.Content className="min-w-[160px] bg-card border rounded-lg shadow-xl p-1 z-[100]">
                                    <DropdownMenu.Item
                                        className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer hover:bg-accent outline-none"
                                        onSelect={() => setDateFilter('all')}
                                    >
                                        {dateFilter === 'all' && <Check className="w-4 h-4" />}
                                        <span className={dateFilter !== 'all' ? 'pl-6' : ''}>Qualquer data</span>
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                        className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer hover:bg-accent outline-none"
                                        onSelect={() => setDateFilter('today')}
                                    >
                                        {dateFilter === 'today' && <Check className="w-4 h-4" />}
                                        <span className={dateFilter !== 'today' ? 'pl-6' : ''}>Hoje</span>
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                        className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer hover:bg-accent outline-none"
                                        onSelect={() => setDateFilter('week')}
                                    >
                                        {dateFilter === 'week' && <Check className="w-4 h-4" />}
                                        <span className={dateFilter !== 'week' ? 'pl-6' : ''}>Esta semana</span>
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                        className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer hover:bg-accent outline-none"
                                        onSelect={() => setDateFilter('month')}
                                    >
                                        {dateFilter === 'month' && <Check className="w-4 h-4" />}
                                        <span className={dateFilter !== 'month' ? 'pl-6' : ''}>Este mês</span>
                                    </DropdownMenu.Item>
                                </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                        </DropdownMenu.Root>
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
                                                    selectNote(note.id, query.trim() || undefined);
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
