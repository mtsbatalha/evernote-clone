'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchInNoteProps {
    searchQuery: string;
    onClose: () => void;
    onQueryChange?: (query: string) => void;
    showInput?: boolean;
}

interface MatchPosition {
    top: number;
    left: number;
    width: number;
    height: number;
    text: string;
    range: Range;
}

export function SearchInNote({ searchQuery, onClose, onQueryChange, showInput = false }: SearchInNoteProps) {
    const [matches, setMatches] = useState<MatchPosition[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const matchesRef = useRef<MatchPosition[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    // Keep ref in sync with state
    useEffect(() => {
        matchesRef.current = matches;
    }, [matches]);

    // Find all matches and calculate their positions
    const findAllMatches = useCallback(() => {
        const editorElement = document.querySelector('.tiptap');
        const scrollContainer = editorElement?.closest('.overflow-y-auto') as HTMLElement | null;
        if (!editorElement || !scrollContainer || !searchQuery.trim()) return;

        const searchText = searchQuery.toLowerCase();
        const walker = document.createTreeWalker(
            editorElement,
            NodeFilter.SHOW_TEXT,
            null
        );

        const newMatches: MatchPosition[] = [];
        const containerRect = scrollContainer.getBoundingClientRect();
        const scrollTop = scrollContainer.scrollTop;

        while (walker.nextNode()) {
            const node = walker.currentNode as Text;
            const textContent = node.textContent || '';
            const lowerText = textContent.toLowerCase();

            let startIndex = 0;
            let index: number;

            while ((index = lowerText.indexOf(searchText, startIndex)) !== -1) {
                // Create a range to get the exact position
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + searchQuery.length);

                const rects = range.getClientRects();
                if (rects.length > 0) {
                    const rect = rects[0];
                    newMatches.push({
                        top: rect.top - containerRect.top + scrollTop,
                        left: rect.left - containerRect.left,
                        width: rect.width,
                        height: rect.height,
                        text: textContent.substring(index, index + searchQuery.length),
                        range: range.cloneRange()
                    });
                }

                startIndex = index + 1;
            }
        }

        setMatches(newMatches);
        matchesRef.current = newMatches;

        // Scroll to first match
        if (newMatches.length > 0) {
            setCurrentIndex(0);
            scrollToMatchByRange(newMatches[0].range);
        }
    }, [searchQuery]);

    // Scroll to match using the stored range
    const scrollToMatchByRange = useCallback((range: Range) => {
        const element = range.startContainer.parentElement;
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, []);

    // Navigate to next match
    const goToNext = useCallback(() => {
        const currentMatches = matchesRef.current;
        if (currentMatches.length === 0) return;

        const nextIndex = (currentIndex + 1) % currentMatches.length;
        setCurrentIndex(nextIndex);
        scrollToMatchByRange(currentMatches[nextIndex].range);
    }, [currentIndex, scrollToMatchByRange]);

    // Navigate to previous match
    const goToPrevious = useCallback(() => {
        const currentMatches = matchesRef.current;
        if (currentMatches.length === 0) return;

        const prevIndex = (currentIndex - 1 + currentMatches.length) % currentMatches.length;
        setCurrentIndex(prevIndex);
        scrollToMatchByRange(currentMatches[prevIndex].range);
    }, [currentIndex, scrollToMatchByRange]);

    // Handle close
    const handleClose = useCallback(() => {
        setMatches([]);
        matchesRef.current = [];
        onClose();
    }, [onClose]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
            } else if (e.key === 'Enter' || e.key === 'F3') {
                e.preventDefault();
                if (e.shiftKey) {
                    goToPrevious();
                } else {
                    goToNext();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleClose, goToNext, goToPrevious]);

    // Find matches on mount and when query changes
    useEffect(() => {
        if (searchQuery) {
            // Small delay to ensure editor content is loaded
            const timeout = setTimeout(findAllMatches, 300);
            return () => clearTimeout(timeout);
        }
    }, [searchQuery, findAllMatches]);

    // Recalculate overlay positions on scroll (only visual update)
    const updateOverlayPositions = useCallback(() => {
        const editorElement = document.querySelector('.tiptap');
        const scrollContainer = editorElement?.closest('.overflow-y-auto') as HTMLElement | null;
        if (!scrollContainer) return;

        const containerRect = scrollContainer.getBoundingClientRect();
        const scrollTop = scrollContainer.scrollTop;

        const updatedMatches = matchesRef.current.map(match => {
            try {
                const rects = match.range.getClientRects();
                if (rects.length > 0) {
                    const rect = rects[0];
                    return {
                        ...match,
                        top: rect.top - containerRect.top + scrollTop,
                        left: rect.left - containerRect.left,
                        width: rect.width,
                        height: rect.height,
                    };
                }
            } catch {
                // Range might be invalid after DOM changes
            }
            return match;
        });

        setMatches(updatedMatches);
    }, []);

    // Update overlay positions on scroll
    useEffect(() => {
        const editorContainer = document.querySelector('.tiptap')?.closest('.overflow-y-auto');
        if (!editorContainer) return;

        const handleScroll = () => {
            requestAnimationFrame(updateOverlayPositions);
        };

        editorContainer.addEventListener('scroll', handleScroll, { passive: true });
        return () => editorContainer.removeEventListener('scroll', handleScroll);
    }, [updateOverlayPositions]);

    // Only hide when there's no query AND we're not showing the input field
    if (!searchQuery && !showInput) return null;

    return (
        <>
            {/* Highlight overlays - positioned relative to scroll container */}
            <div
                className="absolute inset-0 pointer-events-none overflow-hidden"
                style={{ zIndex: 10 }}
            >
                {matches.map((match, index) => (
                    <div
                        key={`match-${index}-${match.left}`}
                        className={cn(
                            'absolute rounded-sm transition-colors duration-150',
                            index === currentIndex
                                ? 'bg-orange-400/70 ring-2 ring-orange-500'
                                : 'bg-yellow-300/50'
                        )}
                        style={{
                            top: match.top,
                            left: match.left,
                            width: match.width,
                            height: match.height,
                        }}
                    />
                ))}
            </div>

            {/* Navigation bar */}
            <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-card border rounded-lg shadow-lg px-3 py-2">
                {/* Search input or query display */}
                {showInput ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onQueryChange?.(e.target.value)}
                        placeholder="Buscar na nota..."
                        className="text-sm bg-transparent border-none focus:outline-none w-48 placeholder:text-muted-foreground"
                        autoFocus
                    />
                ) : (
                    <span className="text-sm text-muted-foreground">
                        Buscando: <span className="font-medium text-foreground">"{searchQuery}"</span>
                    </span>
                )}

                {/* Match counter */}
                <span className="text-sm text-muted-foreground px-2 border-l">
                    {!searchQuery ? (
                        'Digite para buscar'
                    ) : matches.length === 0 ? (
                        'Nenhuma correspondência'
                    ) : (
                        <span>
                            <span className="font-medium text-foreground">{currentIndex + 1}</span>
                            {' de '}
                            <span className="font-medium text-foreground">{matches.length}</span>
                        </span>
                    )}
                </span>

                {/* Navigation buttons */}
                <div className="flex items-center gap-1 border-l pl-2">
                    <button
                        onClick={goToPrevious}
                        disabled={matches.length === 0}
                        className={cn(
                            'p-1 rounded hover:bg-accent transition-colors',
                            matches.length === 0 && 'opacity-50 cursor-not-allowed'
                        )}
                        title="Anterior (Shift+Enter)"
                    >
                        <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                        onClick={goToNext}
                        disabled={matches.length === 0}
                        className={cn(
                            'p-1 rounded hover:bg-accent transition-colors',
                            matches.length === 0 && 'opacity-50 cursor-not-allowed'
                        )}
                        title="Próximo (Enter)"
                    >
                        <ChevronDown className="w-4 h-4" />
                    </button>
                </div>

                {/* Close button */}
                <button
                    onClick={handleClose}
                    className="p-1 rounded hover:bg-accent transition-colors ml-1"
                    title="Fechar (Esc)"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </>
    );
}
